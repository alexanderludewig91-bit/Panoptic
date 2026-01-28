import { useQuery } from "@tanstack/react-query";
import { getUsageSummary, type UsageSummary, type ProjectUsage, type DailyUsage } from "@/lib/openai";
import { getAnthropicUsageSummary } from "@/lib/anthropic";
import { getGeminiUsageSummary } from "@/lib/gemini";

export function useOpenAIUsage() {
  return useQuery({
    queryKey: ["openai", "usage"],
    queryFn: getUsageSummary,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}

export function useAnthropicUsage() {
  return useQuery({
    queryKey: ["anthropic", "usage"],
    queryFn: getAnthropicUsageSummary,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}

export function useGeminiUsage() {
  return useQuery({
    queryKey: ["gemini", "usage"],
    queryFn: getGeminiUsageSummary,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}

// Combined usage from all LLM providers
export interface CombinedUsageSummary {
  today: DailyUsage;
  thisWeek: DailyUsage[];
  thisMonth: DailyUsage[];
  totalCostToday: number;
  totalCostWeek: number;
  totalCostMonth: number;
  projects: ProjectUsage[];
  providers: {
    openai: UsageSummary | null;
    anthropic: UsageSummary | null;
    gemini: UsageSummary | null;
  };
}

export function useCombinedLLMUsage() {
  const openai = useOpenAIUsage();
  const anthropic = useAnthropicUsage();
  const gemini = useGeminiUsage();

  const isLoading = openai.isLoading || anthropic.isLoading || gemini.isLoading;
  const isFetching = openai.isFetching || anthropic.isFetching || gemini.isFetching;
  const error = openai.error || anthropic.error || gemini.error;

  // Combine data from all providers
  const data: CombinedUsageSummary | undefined = (() => {
    if (!openai.data && !anthropic.data && !gemini.data) return undefined;

    const openaiData = openai.data;
    const anthropicData = anthropic.data;
    const geminiData = gemini.data;

    // Merge daily usage data
    const dailyMap: Record<string, DailyUsage> = {};
    
    // Add OpenAI data
    for (const day of openaiData?.thisMonth || []) {
      if (!dailyMap[day.date]) {
        dailyMap[day.date] = { ...day };
      } else {
        dailyMap[day.date].inputTokens += day.inputTokens;
        dailyMap[day.date].outputTokens += day.outputTokens;
        dailyMap[day.date].totalTokens += day.totalTokens;
        dailyMap[day.date].requests += day.requests;
        dailyMap[day.date].costUsd += day.costUsd;
      }
    }
    
    // Add Anthropic data
    for (const day of anthropicData?.thisMonth || []) {
      if (!dailyMap[day.date]) {
        dailyMap[day.date] = { ...day };
      } else {
        dailyMap[day.date].inputTokens += day.inputTokens;
        dailyMap[day.date].outputTokens += day.outputTokens;
        dailyMap[day.date].totalTokens += day.totalTokens;
        dailyMap[day.date].requests += day.requests;
        dailyMap[day.date].costUsd += day.costUsd;
      }
    }

    // Add Gemini data
    for (const day of geminiData?.thisMonth || []) {
      if (!dailyMap[day.date]) {
        dailyMap[day.date] = { ...day };
      } else {
        dailyMap[day.date].inputTokens += day.inputTokens;
        dailyMap[day.date].outputTokens += day.outputTokens;
        dailyMap[day.date].totalTokens += day.totalTokens;
        dailyMap[day.date].requests += day.requests;
        dailyMap[day.date].costUsd += day.costUsd;
      }
    }

    const sortedDates = Object.keys(dailyMap).sort().reverse();
    const thisMonth = sortedDates.map(d => dailyMap[d]);
    const thisWeek = thisMonth.slice(0, 7);
    const todayStr = new Date().toISOString().split("T")[0];
    const today = dailyMap[todayStr] || {
      date: todayStr,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      requests: 0,
      costUsd: 0,
    };

    // Combine all projects from all providers
    const allProjects: ProjectUsage[] = [
      ...(openaiData?.projects || []),
      ...(anthropicData?.workspaces || []),
      ...(geminiData?.projects || []),
    ];

    // Sort by cost
    allProjects.sort((a, b) => b.costUsd - a.costUsd);

    return {
      today,
      thisWeek,
      thisMonth,
      totalCostToday: (openaiData?.totalCostToday || 0) + (anthropicData?.totalCostToday || 0) + (geminiData?.totalCostToday || 0),
      totalCostWeek: (openaiData?.totalCostWeek || 0) + (anthropicData?.totalCostWeek || 0) + (geminiData?.totalCostWeek || 0),
      totalCostMonth: (openaiData?.totalCostMonth || 0) + (anthropicData?.totalCostMonth || 0) + (geminiData?.totalCostMonth || 0),
      projects: allProjects,
      providers: {
        openai: openaiData || null,
        anthropic: anthropicData || null,
        gemini: geminiData || null,
      },
    };
  })();

  const refetch = async () => {
    await Promise.all([openai.refetch(), anthropic.refetch(), gemini.refetch()]);
  };

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}
