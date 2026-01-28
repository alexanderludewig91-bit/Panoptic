import { fetch } from "@tauri-apps/plugin-http";
import { getSecretsByProvider } from "./secrets";
import { logAudit, AuditActions } from "./audit";
import type { DailyUsage, ProjectUsage, ProjectInfo } from "./openai";

// Anthropic Admin API requires these headers
const ANTHROPIC_API_VERSION = "2023-06-01";

interface AnthropicAdminKey {
  name: string;
  value: string;
}

async function getAllAnthropicAdminKeys(): Promise<AnthropicAdminKey[]> {
  const secrets = await getSecretsByProvider("anthropic");
  
  console.log("=== getAllAnthropicAdminKeys ===");
  console.log(`Total secrets with provider 'anthropic': ${secrets.length}`);
  secrets.forEach((s, i) => {
    console.log(`Secret ${i + 1}: name="${s.name}", category="${s.category}", provider="${s.provider}", value prefix="${s.value.substring(0, 15)}..."`);
  });
  
  // Find admin keys - either by name containing "admin" OR by value starting with admin prefix
  const adminKeys = secrets
    .filter((s) => {
      const nameHasAdmin = s.name.toLowerCase().includes("admin");
      const valueIsAdminKey = s.value.startsWith("sk-ant-admin-");
      const isLlmCategory = s.category?.toLowerCase() === "llm";
      console.log(`Checking "${s.name}": nameHasAdmin=${nameHasAdmin}, valueIsAdminKey=${valueIsAdminKey}, isLlmCategory=${isLlmCategory}`);
      return nameHasAdmin || valueIsAdminKey || isLlmCategory;
    })
    .map((s) => ({ name: s.name, value: s.value }));
  
  console.log(`Found ${adminKeys.length} Anthropic admin keys:`, adminKeys.map(k => k.name));
  return adminKeys;
}

// Single key diagnosis result
export interface AnthropicKeyDiagnosisResult {
  keyName: string;
  valid: boolean;
  keyType: string;
  organization: string | null;
  workspaces: { id: string; name: string }[];
  error: string | null;
}

// Combined diagnosis for all keys
export interface AnthropicDiagnosis {
  keys: AnthropicKeyDiagnosisResult[];
  totalKeys: number;
  validKeys: number;
  totalWorkspaces: number;
}

// Diagnose Anthropic API Key
export async function diagnoseAnthropicKey(): Promise<AnthropicDiagnosis> {
  const adminKeys = await getAllAnthropicAdminKeys();
  
  if (adminKeys.length === 0) {
    return {
      keys: [{
        keyName: "Kein Key",
        valid: false,
        keyType: "none",
        organization: null,
        workspaces: [],
        error: "Kein Anthropic Admin Key gefunden. Bitte in Secrets hinzufügen.",
      }],
      totalKeys: 0,
      validKeys: 0,
      totalWorkspaces: 0,
    };
  }

  const keyResults: AnthropicKeyDiagnosisResult[] = [];

  for (const adminKey of adminKeys) {
    console.log(`\n=== Diagnosing Anthropic key: ${adminKey.name} ===`);
    console.log("Key prefix:", adminKey.value.substring(0, 15) + "...");

    // Check key type by prefix
    let keyType = "unknown";
    if (adminKey.value.startsWith("sk-ant-admin-")) {
      keyType = "admin";
    } else if (adminKey.value.startsWith("sk-ant-")) {
      keyType = "standard";
    }

    let organization: string | null = null;
    const workspaces: { id: string; name: string }[] = [];

    try {
      // Try to list workspaces (requires admin key)
      console.log("Trying workspaces endpoint...");
      const workspacesResponse = await fetch("https://api.anthropic.com/v1/organizations/workspaces", {
        method: "GET",
        headers: {
          "x-api-key": adminKey.value,
          "anthropic-version": ANTHROPIC_API_VERSION,
          "Content-Type": "application/json",
        },
      });

      console.log("Workspaces response status:", workspacesResponse.status);

      if (workspacesResponse.ok) {
        const workspacesData = await workspacesResponse.json();
        console.log("Workspaces response:", workspacesData);
        
        // Extract organization from response
        if (workspacesData.organization) {
          organization = workspacesData.organization.name || workspacesData.organization.id;
        }
        
        for (const ws of workspacesData.data || workspacesData.workspaces || []) {
          workspaces.push({
            id: ws.id,
            name: ws.name || ws.display_name || ws.id,
          });
        }
      } else {
        const errorText = await workspacesResponse.text();
        console.log("Workspaces error:", workspacesResponse.status, errorText);
        
        // Try alternative endpoint for organization info
        console.log("Trying organizations endpoint...");
        const orgResponse = await fetch("https://api.anthropic.com/v1/organizations", {
          method: "GET",
          headers: {
            "x-api-key": adminKey.value,
            "anthropic-version": ANTHROPIC_API_VERSION,
            "Content-Type": "application/json",
          },
        });

        console.log("Organizations response status:", orgResponse.status);

        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          console.log("Organization response:", orgData);
          organization = orgData.name || orgData.id || "Unknown";
        } else {
          const orgErrorText = await orgResponse.text();
          console.log("Organizations error:", orgResponse.status, orgErrorText);
        }
      }

      // If no workspaces found via API, still mark as valid if we got organization
      keyResults.push({
        keyName: adminKey.name,
        valid: true,
        keyType,
        organization,
        workspaces,
        error: workspaces.length === 0 && !organization ? "Admin API nicht verfügbar (normaler API Key)" : null,
      });

    } catch (error) {
      console.error(`Error diagnosing Anthropic key ${adminKey.name}:`, error);
      keyResults.push({
        keyName: adminKey.name,
        valid: false,
        keyType,
        organization: null,
        workspaces: [],
        error: `Fehler: ${error}`,
      });
    }
  }

  return {
    keys: keyResults,
    totalKeys: adminKeys.length,
    validKeys: keyResults.filter(k => k.valid).length,
    totalWorkspaces: keyResults.reduce((sum, k) => sum + k.workspaces.length, 0),
  };
}

// Fetch usage data from Anthropic
async function fetchAnthropicUsage(
  apiKey: string,
  startDate: string,
  endDate: string
): Promise<Record<string, DailyUsage>> {
  const dailyUsage: Record<string, DailyUsage> = {};
  
  try {
    // Try multiple potential endpoint formats
    const endpoints = [
      `https://api.anthropic.com/v1/organizations/usage?start_date=${startDate}&end_date=${endDate}&granularity=day`,
      `https://api.anthropic.com/v1/usage?start_date=${startDate}&end_date=${endDate}`,
      `https://api.anthropic.com/v1/admin/usage?start_date=${startDate}&end_date=${endDate}`,
    ];
    
    console.log("=== Fetching Anthropic Usage ===");
    
    await logAudit(AuditActions.API_CALL, "anthropic", "usage", {
      startDate,
      endDate,
    });

    for (const url of endpoints) {
      console.log("Trying Anthropic usage endpoint:", url);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_API_VERSION,
          "Content-Type": "application/json",
        },
      });

      console.log("Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Anthropic usage response:", data);
        
        // Parse the usage data
        for (const bucket of data.data || data.usage || []) {
          const date = bucket.date || bucket.start_date;
          if (!date) continue;

          if (!dailyUsage[date]) {
            dailyUsage[date] = {
              date,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              requests: 0,
              costUsd: 0,
            };
          }

          const inputTokens = bucket.input_tokens || bucket.prompt_tokens || 0;
          const outputTokens = bucket.output_tokens || bucket.completion_tokens || 0;
          const requests = bucket.request_count || bucket.num_requests || 0;
          const cost = parseFloat(bucket.cost_usd || bucket.total_cost || "0") || 0;

          dailyUsage[date].inputTokens += inputTokens;
          dailyUsage[date].outputTokens += outputTokens;
          dailyUsage[date].totalTokens += inputTokens + outputTokens;
          dailyUsage[date].requests += requests;
          dailyUsage[date].costUsd += cost;
        }
        
        console.log("Processed Anthropic daily usage:", dailyUsage);
        return dailyUsage;
      } else {
        const errorText = await response.text();
        console.log("Endpoint failed:", response.status, errorText.substring(0, 200));
      }
    }
    
    console.log("All Anthropic usage endpoints failed");
    return dailyUsage;

  } catch (error) {
    console.error("Error fetching Anthropic usage:", error);
    return dailyUsage;
  }
}


// Fetch cost data from Anthropic
async function fetchAnthropicCosts(
  apiKey: string,
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  const dailyCosts: Record<string, number> = {};
  
  try {
    // Try multiple potential endpoint formats
    const endpoints = [
      `https://api.anthropic.com/v1/organizations/costs?start_date=${startDate}&end_date=${endDate}&granularity=day`,
      `https://api.anthropic.com/v1/costs?start_date=${startDate}&end_date=${endDate}`,
      `https://api.anthropic.com/v1/admin/costs?start_date=${startDate}&end_date=${endDate}`,
    ];
    
    console.log("=== Fetching Anthropic Costs ===");

    for (const url of endpoints) {
      console.log("Trying Anthropic costs endpoint:", url);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_API_VERSION,
          "Content-Type": "application/json",
        },
      });

      console.log("Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Anthropic costs response:", data);

        // Parse the cost data
        for (const bucket of data.data || data.costs || []) {
          const date = bucket.date || bucket.start_date;
          if (!date) continue;

          const cost = parseFloat(bucket.cost_usd || bucket.total_cost || bucket.amount || "0") || 0;
          dailyCosts[date] = (dailyCosts[date] || 0) + cost;
        }

        console.log("Processed Anthropic daily costs:", dailyCosts);
        return dailyCosts;
      } else {
        const errorText = await response.text();
        console.log("Endpoint failed:", response.status, errorText.substring(0, 200));
      }
    }

    console.log("All Anthropic costs endpoints failed");
    return dailyCosts;

  } catch (error) {
    console.error("Error fetching Anthropic costs:", error);
    return dailyCosts;
  }
}

// Fetch workspaces (similar to OpenAI projects)
async function fetchWorkspaces(apiKey: string): Promise<ProjectInfo[]> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/organizations/workspaces", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn("Failed to fetch Anthropic workspaces:", response.status);
      return [];
    }

    const data = await response.json();
    const workspaces: ProjectInfo[] = (data.data || data.workspaces || []).map((ws: { id: string; name?: string; display_name?: string }) => ({
      id: ws.id,
      name: ws.name || ws.display_name || ws.id,
    }));
    console.log("Found Anthropic workspaces:", workspaces);
    return workspaces;
  } catch (error) {
    console.warn("Error fetching Anthropic workspaces:", error);
    return [];
  }
}

// Usage summary for Anthropic
export interface AnthropicUsageSummary {
  today: DailyUsage;
  thisWeek: DailyUsage[];
  thisMonth: DailyUsage[];
  totalCostToday: number;
  totalCostWeek: number;
  totalCostMonth: number;
  workspaces: ProjectUsage[];
}

export async function getAnthropicUsageSummary(): Promise<AnthropicUsageSummary> {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  
  // Calculate date range
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().split("T")[0];

  console.log("=== Fetching Anthropic Usage Summary ===");
  console.log("Date range:", startDate, "to", todayStr);

  const emptyDay: DailyUsage = {
    date: todayStr,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    requests: 0,
    costUsd: 0,
  };

  try {
    const adminKeys = await getAllAnthropicAdminKeys();
    
    if (adminKeys.length === 0) {
      console.log("No Anthropic admin keys found");
      return {
        today: emptyDay,
        thisWeek: [],
        thisMonth: [],
        totalCostToday: 0,
        totalCostWeek: 0,
        totalCostMonth: 0,
        workspaces: [],
      };
    }

    const dailyUsage: Record<string, DailyUsage> = {};
    const allWorkspaceUsage: ProjectUsage[] = [];

    // Process each admin key
    for (const adminKey of adminKeys) {
      console.log(`\n=== Processing Anthropic key: ${adminKey.name} ===`);
      
      try {
        // Fetch workspaces
        const workspaces = await fetchWorkspaces(adminKey.value);
        
        // Fetch usage data
        const usage = await fetchAnthropicUsage(adminKey.value, startDate, todayStr);
        
        // Fetch costs
        const costs = await fetchAnthropicCosts(adminKey.value, startDate, todayStr);

        // Merge usage into daily usage
        for (const [date, data] of Object.entries(usage)) {
          if (!dailyUsage[date]) {
            dailyUsage[date] = {
              date,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              requests: 0,
              costUsd: 0,
            };
          }
          dailyUsage[date].inputTokens += data.inputTokens;
          dailyUsage[date].outputTokens += data.outputTokens;
          dailyUsage[date].totalTokens += data.totalTokens;
          dailyUsage[date].requests += data.requests;
        }

        // Merge costs
        for (const [date, cost] of Object.entries(costs)) {
          if (!dailyUsage[date]) {
            dailyUsage[date] = {
              date,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              requests: 0,
              costUsd: 0,
            };
          }
          dailyUsage[date].costUsd += cost;
        }

        // Calculate workspace totals
        const totalUsage = Object.values(usage).reduce((sum, d) => ({
          inputTokens: sum.inputTokens + d.inputTokens,
          outputTokens: sum.outputTokens + d.outputTokens,
          totalTokens: sum.totalTokens + d.totalTokens,
          requests: sum.requests + d.requests,
        }), { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 });

        const totalCost = Object.values(costs).reduce((sum, c) => sum + c, 0);
        
        // Calculate time-based costs
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const weekStartStr = sevenDaysAgo.toISOString().split("T")[0];
        
        let costToday = 0;
        let costWeek = 0;
        
        for (const [date, cost] of Object.entries(costs)) {
          if (date === todayStr) costToday += cost;
          if (date >= weekStartStr) costWeek += cost;
        }

        // If we have workspaces, create entries for each
        if (workspaces.length > 0) {
          for (const ws of workspaces) {
            allWorkspaceUsage.push({
              project: ws,
              provider: "anthropic",
              ...totalUsage,
              costUsd: totalCost,
              costToday,
              costWeek,
              costMonth: totalCost,
              dailyUsage: Object.values(dailyUsage).sort((a, b) => b.date.localeCompare(a.date)),
            });
          }
        } else {
          // No workspaces - create a single "Default" entry
          allWorkspaceUsage.push({
            project: { id: "default", name: `Anthropic (${adminKey.name})` },
            provider: "anthropic",
            ...totalUsage,
            costUsd: totalCost,
            costToday,
            costWeek,
            costMonth: totalCost,
            dailyUsage: Object.values(dailyUsage).sort((a, b) => b.date.localeCompare(a.date)),
          });
        }

      } catch (keyError) {
        console.error(`Error processing Anthropic key ${adminKey.name}:`, keyError);
      }
    }

    // Calculate summaries
    const sortedDates = Object.keys(dailyUsage).sort().reverse();
    const todayData = dailyUsage[todayStr] || emptyDay;
    
    const thisWeek = sortedDates
      .slice(0, 7)
      .map((d) => dailyUsage[d])
      .filter(Boolean);

    const thisMonth = sortedDates
      .slice(0, 30)
      .map((d) => dailyUsage[d])
      .filter(Boolean);

    // Sort workspaces by cost
    allWorkspaceUsage.sort((a, b) => b.costUsd - a.costUsd);

    const summary: AnthropicUsageSummary = {
      today: todayData,
      thisWeek,
      thisMonth,
      totalCostToday: todayData.costUsd,
      totalCostWeek: thisWeek.reduce((sum, d) => sum + (d?.costUsd || 0), 0),
      totalCostMonth: thisMonth.reduce((sum, d) => sum + (d?.costUsd || 0), 0),
      workspaces: allWorkspaceUsage,
    };

    console.log("=== Anthropic Final Summary ===");
    console.log("Today:", summary.today);
    console.log("Total cost month:", summary.totalCostMonth);
    console.log("Workspaces:", summary.workspaces.length);

    return summary;

  } catch (error) {
    console.error("Failed to fetch Anthropic usage:", error);
    return {
      today: emptyDay,
      thisWeek: [],
      thisMonth: [],
      totalCostToday: 0,
      totalCostWeek: 0,
      totalCostMonth: 0,
      workspaces: [],
    };
  }
}
