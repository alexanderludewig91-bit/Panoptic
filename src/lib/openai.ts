import { fetch } from "@tauri-apps/plugin-http";
import { getSecretsByProvider } from "./secrets";
import { logAudit, AuditActions } from "./audit";

export interface DailyUsage {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  costUsd: number;
}

export interface ProjectInfo {
  id: string;
  name: string;
}

export interface ProjectUsage {
  project: ProjectInfo;
  provider: "openai" | "anthropic" | "google";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  costUsd: number;
  costToday: number;
  costWeek: number;
  costMonth: number;
  dailyUsage: DailyUsage[]; // Daily breakdown for charts
}

export interface UsageSummary {
  today: DailyUsage;
  thisWeek: DailyUsage[];
  thisMonth: DailyUsage[];
  totalCostToday: number;
  totalCostWeek: number;
  totalCostMonth: number;
  projects: ProjectUsage[];
}

// All OpenAI usage endpoints
const USAGE_ENDPOINTS = [
  "completions",
  "embeddings", 
  "images",
  "audio_speeches",
  "audio_transcriptions",
  "code_interpreter_sessions",
  "vector_stores",
];

interface OpenAIAdminKey {
  name: string;
  value: string;
}

async function getAllOpenAIAdminKeys(): Promise<OpenAIAdminKey[]> {
  const secrets = await getSecretsByProvider("openai");
  
  console.log("=== getAllOpenAIAdminKeys ===");
  console.log(`Total secrets with provider 'openai': ${secrets.length}`);
  secrets.forEach((s, i) => {
    console.log(`Secret ${i + 1}: name="${s.name}", category="${s.category}", provider="${s.provider}", value prefix="${s.value.substring(0, 12)}..."`);
  });
  
  // Find all admin keys - either by name containing "admin" OR by value starting with "sk-admin-"
  const adminKeys = secrets
    .filter((s) => {
      const nameHasAdmin = s.name.toLowerCase().includes("admin");
      const valueIsAdminKey = s.value.startsWith("sk-admin-");
      const isLlmCategory = s.category?.toLowerCase() === "llm";
      console.log(`Checking "${s.name}": nameHasAdmin=${nameHasAdmin}, valueIsAdminKey=${valueIsAdminKey}, isLlmCategory=${isLlmCategory}`);
      return nameHasAdmin || valueIsAdminKey || isLlmCategory;
    })
    .map((s) => ({ name: s.name, value: s.value }));
  
  console.log(`Found ${adminKeys.length} OpenAI admin keys:`, adminKeys.map(k => k.name));
  return adminKeys;
}

async function getOpenAIAdminKey(): Promise<string | null> {
  const keys = await getAllOpenAIAdminKeys();
  return keys[0]?.value || null;
}

// Single key diagnosis result
export interface KeyDiagnosisResult {
  keyName: string;
  valid: boolean;
  keyType: string;
  organization: string | null;
  projects: { id: string; name: string }[];
  error: string | null;
}

// Combined diagnosis for all keys
export interface OpenAIDiagnosis {
  keys: KeyDiagnosisResult[];
  totalKeys: number;
  validKeys: number;
  totalProjects: number;
}

// Diagnose API Key permissions - now returns all keys
export async function diagnoseOpenAIKey(): Promise<OpenAIDiagnosis> {
  const adminKeys = await getAllOpenAIAdminKeys();
  
  if (adminKeys.length === 0) {
    return {
      keys: [{
        keyName: "Kein Key",
        valid: false,
        keyType: "none",
        organization: null,
        projects: [],
        error: "Kein OpenAI Admin Key gefunden. Bitte in Secrets hinzufügen.",
      }],
      totalKeys: 0,
      validKeys: 0,
      totalProjects: 0,
    };
  }

  const keyResults: KeyDiagnosisResult[] = [];

  for (const adminKey of adminKeys) {
    console.log(`\n=== Diagnosing key: ${adminKey.name} ===`);
    console.log("Key prefix:", adminKey.value.substring(0, 12) + "...");

    // Check key type by prefix
    let keyType = "unknown";
    if (adminKey.value.startsWith("sk-admin-")) {
      keyType = "admin";
    } else if (adminKey.value.startsWith("sk-proj-")) {
      keyType = "project";
    } else if (adminKey.value.startsWith("sk-")) {
      keyType = "user/legacy";
    }

    let organization: string | null = null;
    const projects: { id: string; name: string }[] = [];

    try {
      // Try to get organization info
      const meResponse = await fetch("https://api.openai.com/v1/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminKey.value}`,
        },
      });

      if (meResponse.ok) {
        const meData = await meResponse.json();
        organization = meData.name || meData.email || meData.id || "Unknown";
      }

      // List projects
      const projectsResponse = await fetch("https://api.openai.com/v1/organization/projects?limit=100", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminKey.value}`,
        },
      });

      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        for (const proj of projectsData.data || []) {
          projects.push({
            id: proj.id,
            name: proj.name,
          });
        }
      }

      keyResults.push({
        keyName: adminKey.name,
        valid: true,
        keyType,
        organization,
        projects,
        error: projects.length === 0 ? "Keine Projekte gefunden" : null,
      });

    } catch (error) {
      console.error(`Error diagnosing key ${adminKey.name}:`, error);
      keyResults.push({
        keyName: adminKey.name,
        valid: false,
        keyType,
        organization: null,
        projects: [],
        error: `Fehler: ${error}`,
      });
    }
  }

  return {
    keys: keyResults,
    totalKeys: adminKeys.length,
    validKeys: keyResults.filter(k => k.valid).length,
    totalProjects: keyResults.reduce((sum, k) => sum + k.projects.length, 0),
  };
}

async function fetchUsageEndpoint(
  apiKey: string,
  endpoint: string,
  startTime: number,
  endTime: number,
  projectIds?: string[]
): Promise<Record<string, { inputTokens: number; outputTokens: number; requests: number }>> {
  const dailyData: Record<string, { inputTokens: number; outputTokens: number; requests: number }> = {};
  
  // Build base URL - use group_by=project_id to get actual data
  let baseUrl = `https://api.openai.com/v1/organization/usage/${endpoint}?start_time=${startTime}&end_time=${endTime}&bucket_width=1d&limit=31&group_by=project_id`;
  
  // Add project_ids filter if provided (optional, but good for filtering)
  if (projectIds && projectIds.length > 0) {
    baseUrl += `&project_ids=${projectIds.join(",")}`;
  }

  let nextPage: string | null = null;
  let pageCount = 0;
  const maxPages = 10; // Safety limit

  try {
    do {
      let url = baseUrl;
      if (nextPage) {
        url += `&page=${nextPage}`;
      }

      console.log(`Fetching ${endpoint} (page ${pageCount + 1}):`, url.substring(0, 120) + "...");

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Endpoint ${endpoint} returned ${response.status}:`, errorText);
        break;
      }

      const data = await response.json();
      
      // Check for pagination
      nextPage = data.has_more ? data.next_page : null;
      pageCount++;

      // Log raw response for debugging on first page
      if (pageCount === 1 && data.data && data.data.length > 0) {
        const hasResults = data.data.some((b: { results?: unknown[] }) => b.results && b.results.length > 0);
        if (hasResults) {
          console.log(`${endpoint} RAW response with data:`, JSON.stringify(data.data.slice(0, 2), null, 2));
        }
        console.log(`${endpoint}: ${data.data.length} buckets, has_more: ${data.has_more}`);
      }

      for (const bucket of data.data || []) {
        const timestamp = bucket.start_time;
        if (!timestamp) continue;

        const date = new Date(timestamp * 1000).toISOString().split("T")[0];

        if (!dailyData[date]) {
          dailyData[date] = { inputTokens: 0, outputTokens: 0, requests: 0 };
        }

        for (const result of bucket.results || []) {
          // Different endpoints have different field names
          const inputTokens = result.input_tokens ?? result.num_tokens ?? result.input_characters ?? 0;
          const outputTokens = result.output_tokens ?? result.generated_tokens ?? result.output_characters ?? 0;
          const requests = result.num_model_requests ?? result.num_requests ?? result.num_images ?? 1;

          dailyData[date].inputTokens += inputTokens;
          dailyData[date].outputTokens += outputTokens;
          dailyData[date].requests += requests;
        }
      }

    } while (nextPage && pageCount < maxPages);

    if (Object.keys(dailyData).length > 0) {
      console.log(`${endpoint} processed usage (${Object.keys(dailyData).length} days):`, dailyData);
    }

    return dailyData;
  } catch (error) {
    console.warn(`Error fetching ${endpoint}:`, error);
    return {};
  }
}

// Fetch all projects with their info
async function fetchProjects(apiKey: string): Promise<ProjectInfo[]> {
  try {
    const response = await fetch("https://api.openai.com/v1/organization/projects?limit=100", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.warn("Failed to fetch projects:", response.status);
      return [];
    }

    const data = await response.json();
    const projects: ProjectInfo[] = (data.data || []).map((p: { id: string; name: string }) => ({
      id: p.id,
      name: p.name,
    }));
    console.log("Found projects:", projects);
    return projects;
  } catch (error) {
    console.warn("Error fetching projects:", error);
    return [];
  }
}

// Internal function with explicit key and projectIds
async function fetchAllOpenAIUsageWithKey(
  apiKey: string,
  startTime: number,
  endTime: number,
  projectIds: string[]
): Promise<Record<string, DailyUsage>> {
  console.log("=== Fetching all OpenAI usage ===");
  console.log("Time range:", new Date(startTime * 1000).toISOString(), "to", new Date(endTime * 1000).toISOString());
  console.log("Using project IDs:", projectIds);

  await logAudit(AuditActions.API_CALL, "openai", "usage", {
    endpoints: USAGE_ENDPOINTS,
    startTime,
    endTime,
    projectIds,
  });

  // Fetch all endpoints in parallel - WITH project filter
  const results = await Promise.all(
    USAGE_ENDPOINTS.map((endpoint) =>
      fetchUsageEndpoint(apiKey, endpoint, startTime, endTime, projectIds.length > 0 ? projectIds : undefined)
    )
  );

  // Merge all results
  const dailyUsage: Record<string, DailyUsage> = {};

  for (const endpointData of results) {
    for (const [date, data] of Object.entries(endpointData)) {
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
      dailyUsage[date].totalTokens += data.inputTokens + data.outputTokens;
      dailyUsage[date].requests += data.requests;
    }
  }

  console.log("Combined usage data:", dailyUsage);
  return dailyUsage;
}

export async function fetchAllOpenAIUsage(
  startTime: number,
  endTime: number
): Promise<Record<string, DailyUsage>> {
  const apiKey = await getOpenAIAdminKey();
  if (!apiKey) {
    throw new Error("No OpenAI Admin Key found. Please add one in Secrets.");
  }

  // First, get all projects
  const projects = await fetchProjects(apiKey);
  const projectIds = projects.map(p => p.id);

  return fetchAllOpenAIUsageWithKey(apiKey, startTime, endTime, projectIds);
}

// Internal function with explicit key
async function fetchOpenAICostsWithKey(
  apiKey: string,
  startTime: number,
  endTime: number,
  projectIds?: string[]
): Promise<Record<string, number>> {

  // Use group_by=project_id to get detailed cost data
  let baseUrl = `https://api.openai.com/v1/organization/costs?start_time=${startTime}&end_time=${endTime}&bucket_width=1d&limit=31&group_by=project_id`;
  
  // Add project filter
  if (projectIds && projectIds.length > 0) {
    baseUrl += `&project_ids=${projectIds.join(",")}`;
  }

  const dailyCosts: Record<string, number> = {};
  let nextPage: string | null = null;
  let pageCount = 0;
  const maxPages = 10;

  try {
    do {
      let url = baseUrl;
      if (nextPage) {
        url += `&page=${nextPage}`;
      }

      console.log(`Fetching OpenAI costs (page ${pageCount + 1}):`, url.substring(0, 100) + "...");

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI costs API error:", response.status, errorText);
        break;
      }

      const data = await response.json();
      
      // Check for pagination
      nextPage = data.has_more ? data.next_page : null;
      pageCount++;
      
      if (pageCount === 1) {
        console.log(`Costs: ${data.data?.length || 0} buckets, has_more: ${data.has_more}`);
        if (data.data && data.data.length > 0) {
          const hasResults = data.data.some((b: { results?: unknown[] }) => b.results && b.results.length > 0);
          if (hasResults) {
            console.log("First cost bucket with data:", JSON.stringify(data.data.find((b: { results?: unknown[] }) => (b.results?.length ?? 0) > 0), null, 2));
          }
        }
      }

      for (const bucket of data.data || []) {
        const timestamp = bucket.start_time;
        if (!timestamp) continue;

        const date = new Date(timestamp * 1000).toISOString().split("T")[0];

        let totalCost = 0;
        for (const result of bucket.results || []) {
          // The amount.value is a string like "0.001589850000000000000000000000"
          const amountStr = result.amount?.value ?? result.amount ?? result.cost ?? "0";
          const amount = parseFloat(amountStr) || 0;
          totalCost += amount;
        }

        dailyCosts[date] = (dailyCosts[date] || 0) + totalCost;
      }

    } while (nextPage && pageCount < maxPages);

    console.log(`Processed daily costs (${Object.keys(dailyCosts).length} days):`, dailyCosts);
    return dailyCosts;
  } catch (error) {
    console.error("OpenAI costs fetch error:", error);
    return {};
  }
}

// Type for per-project usage with daily breakdown
interface ProjectUsageData {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
  costUsd: number;
  costToday: number;
  costWeek: number;
  costMonth: number;
  dailyUsage: DailyUsage[];
}

// Fetch usage data per project with time breakdowns and daily data
async function fetchPerProjectUsage(
  apiKey: string,
  startTime: number,
  endTime: number,
  projects: ProjectInfo[]
): Promise<Record<string, ProjectUsageData>> {
  const projectUsage: Record<string, ProjectUsageData> = {};
  
  // Track daily data per project
  const projectDailyData: Record<string, Record<string, DailyUsage>> = {};

  // Calculate time boundaries
  const now = Math.floor(Date.now() / 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartUnix = Math.floor(todayStart.getTime() / 1000);
  const oneWeekAgo = now - 7 * 86400;

  // Initialize all projects
  for (const project of projects) {
    projectUsage[project.id] = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      requests: 0,
      costUsd: 0,
      costToday: 0,
      costWeek: 0,
      costMonth: 0,
      dailyUsage: [],
    };
    projectDailyData[project.id] = {};
  }

  // Fetch completions usage grouped by project
  try {
    const url = `https://api.openai.com/v1/organization/usage/completions?start_time=${startTime}&end_time=${endTime}&bucket_width=1d&limit=31&group_by=project_id`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      for (const bucket of data.data || []) {
        const date = new Date(bucket.start_time * 1000).toISOString().split("T")[0];
        
        for (const result of bucket.results || []) {
          const projectId = result.project_id;
          if (projectId && projectUsage[projectId]) {
            const inputTokens = result.input_tokens || 0;
            const outputTokens = result.output_tokens || 0;
            const requests = result.num_model_requests || 0;
            
            // Aggregate totals
            projectUsage[projectId].inputTokens += inputTokens;
            projectUsage[projectId].outputTokens += outputTokens;
            projectUsage[projectId].totalTokens += inputTokens + outputTokens;
            projectUsage[projectId].requests += requests;
            
            // Track daily data
            if (!projectDailyData[projectId][date]) {
              projectDailyData[projectId][date] = {
                date,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                requests: 0,
                costUsd: 0,
              };
            }
            projectDailyData[projectId][date].inputTokens += inputTokens;
            projectDailyData[projectId][date].outputTokens += outputTokens;
            projectDailyData[projectId][date].totalTokens += inputTokens + outputTokens;
            projectDailyData[projectId][date].requests += requests;
          }
        }
      }
    }
  } catch (error) {
    console.warn("Error fetching per-project usage:", error);
  }

  // Fetch costs grouped by project (with time tracking)
  try {
    const url = `https://api.openai.com/v1/organization/costs?start_time=${startTime}&end_time=${endTime}&bucket_width=1d&limit=31&group_by=project_id`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      for (const bucket of data.data || []) {
        const bucketTime = bucket.start_time || 0;
        const date = new Date(bucketTime * 1000).toISOString().split("T")[0];
        
        for (const result of bucket.results || []) {
          const projectId = result.project_id;
          if (projectId && projectUsage[projectId]) {
            const cost = parseFloat(result.amount?.value || "0") || 0;
            
            // Total (month)
            projectUsage[projectId].costMonth += cost;
            projectUsage[projectId].costUsd += cost;
            
            // Week (last 7 days)
            if (bucketTime >= oneWeekAgo) {
              projectUsage[projectId].costWeek += cost;
            }
            
            // Today
            if (bucketTime >= todayStartUnix) {
              projectUsage[projectId].costToday += cost;
            }
            
            // Track daily cost
            if (!projectDailyData[projectId][date]) {
              projectDailyData[projectId][date] = {
                date,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                requests: 0,
                costUsd: 0,
              };
            }
            projectDailyData[projectId][date].costUsd += cost;
          }
        }
      }
    }
  } catch (error) {
    console.warn("Error fetching per-project costs:", error);
  }

  // Convert daily data to sorted arrays
  for (const projectId of Object.keys(projectUsage)) {
    const dailyDataMap = projectDailyData[projectId];
    projectUsage[projectId].dailyUsage = Object.values(dailyDataMap)
      .sort((a, b) => b.date.localeCompare(a.date)); // Newest first
  }

  // Log dailyUsage for first project to verify
  const firstProjectId = Object.keys(projectUsage)[0];
  if (firstProjectId) {
    console.log(`Per-project usage for ${firstProjectId}:`, {
      ...projectUsage[firstProjectId],
      dailyUsageCount: projectUsage[firstProjectId].dailyUsage?.length || 0,
      dailyUsageSample: projectUsage[firstProjectId].dailyUsage?.slice(0, 2),
    });
  }
  return projectUsage;
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const now = Math.floor(Date.now() / 1000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfDay = Math.floor(today.getTime() / 1000);
  const startOfMonth = startOfDay - 29 * 86400; // Last 30 days

  console.log("=== Fetching OpenAI Usage Summary ===");
  console.log("Current time:", new Date().toISOString());
  console.log("Fetching from:", new Date(startOfMonth * 1000).toISOString());

  const emptyDay: DailyUsage = {
    date: new Date().toISOString().split("T")[0],
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    requests: 0,
    costUsd: 0,
  };

  try {
    // Get ALL admin keys
    const adminKeys = await getAllOpenAIAdminKeys();
    
    if (adminKeys.length === 0) {
      throw new Error("No OpenAI Admin Keys found. Please add one in Secrets.");
    }

    // Aggregate data from all keys
    const dailyUsage: Record<string, DailyUsage> = {};
    const allProjectUsageList: ProjectUsage[] = [];

    // Process each admin key
    for (const adminKey of adminKeys) {
      console.log(`\n=== Processing key: ${adminKey.name} ===`);
      
      try {
        // Get projects for this key
        const projects = await fetchProjects(adminKey.value);
        const projectIds = projects.map(p => p.id);
        
        if (projects.length === 0) {
          console.log(`No projects found for key: ${adminKey.name}`);
          continue;
        }

        // Fetch per-project usage for this key
        const projectUsageMap = await fetchPerProjectUsage(adminKey.value, startOfMonth, now, projects);

        // Add projects to list
        for (const project of projects) {
          const projectData = projectUsageMap[project.id];
          allProjectUsageList.push({
            project: {
              ...project,
              name: `${project.name}`, // Could add key name suffix if needed
            },
            provider: "openai" as const,
            inputTokens: projectData?.inputTokens || 0,
            outputTokens: projectData?.outputTokens || 0,
            totalTokens: projectData?.totalTokens || 0,
            requests: projectData?.requests || 0,
            costUsd: projectData?.costUsd || 0,
            costToday: projectData?.costToday || 0,
            costWeek: projectData?.costWeek || 0,
            costMonth: projectData?.costMonth || 0,
            dailyUsage: projectData?.dailyUsage || [],
          });
        }

        // Fetch daily usage (tokens) for this key
        const keyDailyUsage = await fetchAllOpenAIUsageWithKey(adminKey.value, startOfMonth, now, projectIds);
        
        // Merge token usage into daily usage
        for (const [date, data] of Object.entries(keyDailyUsage)) {
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

        // Fetch costs for this key
        const dailyCosts = await fetchOpenAICostsWithKey(adminKey.value, startOfMonth, now, projectIds);

        // Merge costs into daily usage
        for (const [date, cost] of Object.entries(dailyCosts)) {
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

      } catch (keyError) {
        console.error(`Error processing key ${adminKey.name}:`, keyError);
      }
    }

    // Get sorted dates (newest first)
    const sortedDates = Object.keys(dailyUsage).sort().reverse();
    console.log("Dates with data:", sortedDates);

    const todayStr = new Date().toISOString().split("T")[0];
    const todayData = dailyUsage[todayStr] || { ...emptyDay, date: todayStr };

    // Last 7 days
    const thisWeek = sortedDates
      .slice(0, 7)
      .map((d) => dailyUsage[d])
      .filter(Boolean);

    // Last 30 days
    const thisMonth = sortedDates
      .slice(0, 30)
      .map((d) => dailyUsage[d])
      .filter(Boolean);

    // Sort projects by cost
    const projectUsageList = allProjectUsageList;

    // Sort by cost descending
    projectUsageList.sort((a, b) => b.costUsd - a.costUsd);

    const summary: UsageSummary = {
      today: todayData,
      thisWeek,
      thisMonth,
      totalCostToday: todayData.costUsd,
      totalCostWeek: thisWeek.reduce((sum, d) => sum + (d?.costUsd || 0), 0),
      totalCostMonth: thisMonth.reduce((sum, d) => sum + (d?.costUsd || 0), 0),
      projects: projectUsageList,
    };

    console.log("=== Final Summary ===");
    console.log("Today:", summary.today);
    console.log("Total cost today:", summary.totalCostToday);
    console.log("Total cost week:", summary.totalCostWeek);
    console.log("Total cost month:", summary.totalCostMonth);
    console.log("Projects:", summary.projects);

    return summary;
  } catch (error) {
    console.error("Failed to fetch OpenAI usage:", error);

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
