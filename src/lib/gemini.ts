import { fetch } from "@tauri-apps/plugin-http";
import { getSecretsByProvider } from "./secrets";
import { logAudit, AuditActions } from "./audit";
import type { DailyUsage, ProjectUsage } from "./openai";

// Google AI Studio / Gemini API
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";

interface GeminiApiKey {
  name: string;
  value: string;
}

async function getAllGeminiApiKeys(): Promise<GeminiApiKey[]> {
  const secrets = await getSecretsByProvider("google");
  
  console.log("=== getAllGeminiApiKeys ===");
  console.log(`Total secrets with provider 'google': ${secrets.length}`);
  secrets.forEach((s, i) => {
    console.log(`Secret ${i + 1}: name="${s.name}", category="${s.category}", provider="${s.provider}", value prefix="${s.value.substring(0, 10)}..."`);
  });
  
  // Find Gemini API keys - typically start with "AIza"
  const apiKeys = secrets
    .filter((s) => {
      const isGeminiKey = s.value.startsWith("AIza");
      const isLlmCategory = s.category?.toLowerCase() === "llm";
      console.log(`Checking "${s.name}": isGeminiKey=${isGeminiKey}, isLlmCategory=${isLlmCategory}`);
      return isGeminiKey || isLlmCategory;
    })
    .map((s) => ({ name: s.name, value: s.value }));
  
  console.log(`Found ${apiKeys.length} Gemini API keys:`, apiKeys.map(k => k.name));
  return apiKeys;
}

// Diagnosis result for a single key
export interface GeminiKeyDiagnosisResult {
  keyName: string;
  valid: boolean;
  keyType: string;
  projectId: string | null;
  models: string[];
  error: string | null;
}

// Combined diagnosis for all keys
export interface GeminiDiagnosis {
  keys: GeminiKeyDiagnosisResult[];
  totalKeys: number;
  validKeys: number;
}

// Diagnose Gemini API Key by listing available models
export async function diagnoseGeminiKey(): Promise<GeminiDiagnosis> {
  const apiKeys = await getAllGeminiApiKeys();
  
  if (apiKeys.length === 0) {
    return {
      keys: [{
        keyName: "Kein Key",
        valid: false,
        keyType: "none",
        projectId: null,
        models: [],
        error: "Kein Google/Gemini API Key gefunden. Bitte in Secrets hinzufügen.",
      }],
      totalKeys: 0,
      validKeys: 0,
    };
  }

  const keyResults: GeminiKeyDiagnosisResult[] = [];

  for (const apiKey of apiKeys) {
    console.log(`\n=== Diagnosing Gemini key: ${apiKey.name} ===`);
    console.log("Key prefix:", apiKey.value.substring(0, 10) + "...");

    const keyType = apiKey.value.startsWith("AIza") ? "api_key" : "unknown";
    const models: string[] = [];
    let projectId: string | null = null;

    try {
      // Test the key by listing available models
      const modelsUrl = `${GEMINI_API_BASE}/v1beta/models?key=${apiKey.value}`;
      console.log("Testing Gemini key with models endpoint...");
      
      const response = await fetch(modelsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("Models response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Gemini models response:", data);
        
        // Extract model names
        for (const model of data.models || []) {
          if (model.name) {
            const shortName = model.name.replace("models/", "");
            models.push(shortName);
          }
        }

        // Try to extract project ID from response headers or other sources
        // Google AI Studio keys are typically associated with a project
        projectId = "Google AI Studio";

        keyResults.push({
          keyName: apiKey.name,
          valid: true,
          keyType,
          projectId,
          models: models.slice(0, 5), // Just show first 5 models
          error: null,
        });
      } else {
        const errorText = await response.text();
        console.log("Gemini models error:", response.status, errorText);
        
        keyResults.push({
          keyName: apiKey.name,
          valid: false,
          keyType,
          projectId: null,
          models: [],
          error: `API Fehler: ${response.status} - ${errorText.substring(0, 100)}`,
        });
      }

    } catch (error) {
      console.error(`Error diagnosing Gemini key ${apiKey.name}:`, error);
      keyResults.push({
        keyName: apiKey.name,
        valid: false,
        keyType,
        projectId: null,
        models: [],
        error: `Fehler: ${error}`,
      });
    }
  }

  return {
    keys: keyResults,
    totalKeys: apiKeys.length,
    validKeys: keyResults.filter(k => k.valid).length,
  };
}

// Try to fetch usage data from various Google endpoints
async function fetchGeminiUsage(
  apiKey: string,
  startDate: string,
  endDate: string
): Promise<Record<string, DailyUsage>> {
  const dailyUsage: Record<string, DailyUsage> = {};
  
  console.log("=== Fetching Gemini Usage ===");
  console.log("Date range:", startDate, "to", endDate);
  
  await logAudit(AuditActions.API_CALL, "google", "usage", {
    startDate,
    endDate,
  });

  // Try various potential endpoints
  const endpoints = [
    // Google AI Studio doesn't have a public usage API
    // These are speculative endpoints that might work
    `${GEMINI_API_BASE}/v1beta/usage?key=${apiKey}&startDate=${startDate}&endDate=${endDate}`,
    `${GEMINI_API_BASE}/v1/usage?key=${apiKey}`,
  ];

  for (const url of endpoints) {
    try {
      console.log("Trying Gemini usage endpoint:", url.substring(0, 80) + "...");
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Gemini usage response:", data);
        
        // Parse the data if we get any
        for (const item of data.usage || data.data || []) {
          const date = item.date || item.start_date;
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

          dailyUsage[date].inputTokens += item.input_tokens || item.promptTokenCount || 0;
          dailyUsage[date].outputTokens += item.output_tokens || item.candidatesTokenCount || 0;
          dailyUsage[date].totalTokens += item.total_tokens || 0;
          dailyUsage[date].requests += item.requests || item.request_count || 0;
          dailyUsage[date].costUsd += parseFloat(item.cost || item.cost_usd || "0") || 0;
        }

        if (Object.keys(dailyUsage).length > 0) {
          console.log("Processed Gemini daily usage:", dailyUsage);
          return dailyUsage;
        }
      } else {
        const errorText = await response.text();
        console.log("Endpoint failed:", response.status, errorText.substring(0, 150));
      }
    } catch (error) {
      console.log("Endpoint error:", error);
    }
  }

  console.log("No Gemini usage data available via API");
  console.log("Note: Google AI Studio does not provide a public usage API.");
  console.log("Usage data is only visible in the Google AI Studio dashboard.");
  
  return dailyUsage;
}

// Usage summary for Gemini
export interface GeminiUsageSummary {
  today: DailyUsage;
  thisWeek: DailyUsage[];
  thisMonth: DailyUsage[];
  totalCostToday: number;
  totalCostWeek: number;
  totalCostMonth: number;
  projects: ProjectUsage[];
}

export async function getGeminiUsageSummary(): Promise<GeminiUsageSummary> {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  
  // Calculate date range
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().split("T")[0];

  console.log("=== Fetching Gemini Usage Summary ===");
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
    const apiKeys = await getAllGeminiApiKeys();
    
    if (apiKeys.length === 0) {
      console.log("No Gemini API keys found");
      return {
        today: emptyDay,
        thisWeek: [],
        thisMonth: [],
        totalCostToday: 0,
        totalCostWeek: 0,
        totalCostMonth: 0,
        projects: [],
      };
    }

    const dailyUsage: Record<string, DailyUsage> = {};
    const allProjects: ProjectUsage[] = [];

    // Process each API key
    for (const apiKey of apiKeys) {
      console.log(`\n=== Processing Gemini key: ${apiKey.name} ===`);
      
      try {
        // Try to fetch usage data
        const usage = await fetchGeminiUsage(apiKey.value, startDate, todayStr);
        
        // Merge usage data
        for (const [date, data] of Object.entries(usage)) {
          if (!dailyUsage[date]) {
            dailyUsage[date] = { ...data };
          } else {
            dailyUsage[date].inputTokens += data.inputTokens;
            dailyUsage[date].outputTokens += data.outputTokens;
            dailyUsage[date].totalTokens += data.totalTokens;
            dailyUsage[date].requests += data.requests;
            dailyUsage[date].costUsd += data.costUsd;
          }
        }

        // Create a project entry for this key
        // Since we can't get real usage data, we just create a placeholder
        const totalUsage = Object.values(usage).reduce((sum, d) => ({
          inputTokens: sum.inputTokens + d.inputTokens,
          outputTokens: sum.outputTokens + d.outputTokens,
          totalTokens: sum.totalTokens + d.totalTokens,
          requests: sum.requests + d.requests,
          costUsd: sum.costUsd + d.costUsd,
        }), { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, costUsd: 0 });

        allProjects.push({
          project: { id: apiKey.name, name: `Gemini (${apiKey.name})` },
          provider: "google",
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
          totalTokens: totalUsage.totalTokens,
          requests: totalUsage.requests,
          costUsd: totalUsage.costUsd,
          costToday: 0,
          costWeek: 0,
          costMonth: totalUsage.costUsd,
          dailyUsage: Object.values(dailyUsage).sort((a, b) => b.date.localeCompare(a.date)),
        });

      } catch (keyError) {
        console.error(`Error processing Gemini key ${apiKey.name}:`, keyError);
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

    const summary: GeminiUsageSummary = {
      today: todayData,
      thisWeek,
      thisMonth,
      totalCostToday: todayData.costUsd,
      totalCostWeek: thisWeek.reduce((sum, d) => sum + (d?.costUsd || 0), 0),
      totalCostMonth: thisMonth.reduce((sum, d) => sum + (d?.costUsd || 0), 0),
      projects: allProjects,
    };

    console.log("=== Gemini Final Summary ===");
    console.log("Today:", summary.today);
    console.log("Total cost month:", summary.totalCostMonth);
    console.log("Projects:", summary.projects.length);

    return summary;

  } catch (error) {
    console.error("Failed to fetch Gemini usage:", error);
    return {
      today: emptyDay,
      thisWeek: [],
      thisMonth: [],
      totalCostToday: 0,
      totalCostWeek: 0,
      totalCostMonth: 0,
      projects: [],
    };
  }
}
