import { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Loader2,
  Bug,
  Key,
  CheckCircle,
  XCircle,
  FolderOpen,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCombinedLLMUsage } from "@/hooks/useOpenAI";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { diagnoseOpenAIKey, type OpenAIDiagnosis } from "@/lib/openai";
import { diagnoseAnthropicKey, type AnthropicDiagnosis } from "@/lib/anthropic";
import { diagnoseGeminiKey, type GeminiDiagnosis } from "@/lib/gemini";

interface CombinedDiagnosis {
  openai: OpenAIDiagnosis | null;
  anthropic: AnthropicDiagnosis | null;
  gemini: GeminiDiagnosis | null;
}

export function Costs() {
  const [timeRange, setTimeRange] = useState<"week" | "month">("week");
  const [showDebug, setShowDebug] = useState(false);
  const [diagnosis, setDiagnosis] = useState<CombinedDiagnosis | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { data: usage, isLoading, error, refetch, isFetching } = useCombinedLLMUsage();

  const runDiagnosis = async () => {
    setDiagnosing(true);
    try {
      const [openaiResult, anthropicResult, geminiResult] = await Promise.all([
        diagnoseOpenAIKey(),
        diagnoseAnthropicKey(),
        diagnoseGeminiKey(),
      ]);
      setDiagnosis({
        openai: openaiResult,
        anthropic: anthropicResult,
        gemini: geminiResult,
      });
    } catch (e) {
      console.error("Diagnosis failed:", e);
    } finally {
      setDiagnosing(false);
    }
  };

  // Run diagnosis on mount if no data
  useEffect(() => {
    if (!isLoading && usage?.totalCostMonth === 0) {
      runDiagnosis();
    }
  }, [isLoading, usage]);

  // Get selected project data
  const selectedProject = selectedProjectId 
    ? usage?.projects?.find(p => p.project.id === selectedProjectId) 
    : null;

  // Calculate aggregated totals from all projects (for when no project is selected)
  const allProjectsTotals = usage?.projects?.reduce(
    (acc, p) => ({
      inputTokens: acc.inputTokens + p.inputTokens,
      outputTokens: acc.outputTokens + p.outputTokens,
      totalTokens: acc.totalTokens + p.totalTokens,
      requests: acc.requests + p.requests,
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 }
  ) || { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 };

  // Calculate display values based on selection
  const displayCostToday = selectedProject ? selectedProject.costToday : (usage?.totalCostToday || 0);
  const displayCostWeek = selectedProject ? selectedProject.costWeek : (usage?.totalCostWeek || 0);
  const displayCostMonth = selectedProject ? selectedProject.costMonth : (usage?.totalCostMonth || 0);
  const displayTokensToday = selectedProject ? selectedProject.totalTokens : allProjectsTotals.totalTokens;
  const displayInputTokensToday = selectedProject ? selectedProject.inputTokens : allProjectsTotals.inputTokens;
  const displayOutputTokensToday = selectedProject ? selectedProject.outputTokens : allProjectsTotals.outputTokens;
  const displayRequestsToday = selectedProject ? selectedProject.requests : allProjectsTotals.requests;

  // Get chart data - either from selected project or aggregated
  const getChartData = () => {
    if (selectedProject) {
      console.log("Selected project dailyUsage:", selectedProject.dailyUsage);
      console.log("dailyUsage length:", selectedProject.dailyUsage?.length);
      if (selectedProject.dailyUsage && selectedProject.dailyUsage.length > 0) {
        // Use project-specific daily data
        const days = timeRange === "week" ? 7 : 30;
        return selectedProject.dailyUsage.slice(0, days);
      }
    }
    // Use aggregated data
    return (timeRange === "week" ? usage?.thisWeek : usage?.thisMonth) || [];
  };

  const chartData = getChartData();

  // Format data for charts
  const formattedChartData = chartData
    .slice()
    .reverse()
    .map((d) => ({
      date: d.date.slice(5), // MM-DD format
      cost: d.costUsd,
      tokens: d.totalTokens,
      requests: d.requests,
    }));

  const costTrend =
    chartData.length >= 2
      ? ((chartData[0]?.costUsd - chartData[1]?.costUsd) /
          (chartData[1]?.costUsd || 1)) *
        100
      : 0;

  // Toggle project selection
  const handleProjectClick = (projectId: string) => {
    setSelectedProjectId(prev => prev === projectId ? null : projectId);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">LLM Kosten</h1>
          <p className="mt-1 text-muted-foreground">
            Übersicht und Analyse deiner API-Kosten.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (diagnosis) {
                setDiagnosis(null);
              } else {
                runDiagnosis();
              }
            }}
            title="API Key Status anzeigen"
            disabled={diagnosing}
          >
            {diagnosing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Key className={`h-4 w-4 ${diagnosis ? "text-primary" : ""}`} />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowDebug(!showDebug)}
            title="Debug-Infos anzeigen"
          >
            <Bug className={`h-4 w-4 ${showDebug ? "text-warning" : ""}`} />
          </Button>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Debug Info */}
      {showDebug && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <Bug className="h-5 w-5" />
              Debug-Informationen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded bg-black/50 p-4 text-xs text-green-400">
              {JSON.stringify(
                {
                  error: error ? String(error) : null,
                  usage: usage,
                  chartData: chartData,
                },
                null,
                2
              )}
            </pre>
            <p className="mt-4 text-sm text-muted-foreground">
              Öffne auch die Browser-Konsole (Cmd+Option+I → Console) für mehr Details.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Key Diagnosis */}
      {diagnosis && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys Diagnose
              <Button
                variant="ghost"
                size="sm"
                onClick={runDiagnosis}
                disabled={diagnosing}
                className="ml-auto"
              >
                {diagnosing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Erneut prüfen"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* OpenAI Section */}
            {diagnosis.openai && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <img src="/openai-logo.png" alt="OpenAI" className="h-5 w-5" />
                  <h3 className="font-semibold">OpenAI</h3>
                  <span className="text-xs text-muted-foreground">
                    {diagnosis.openai.validKeys}/{diagnosis.openai.totalKeys} Keys · {diagnosis.openai.totalProjects} Projekte
                  </span>
                </div>
                <div className="space-y-2">
                  {diagnosis.openai.keys.map((keyDiag, index) => (
                    <div 
                      key={`openai-${index}`} 
                      className={`rounded-lg border p-3 ${
                        keyDiag.valid ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-7 w-7 items-center justify-center rounded ${
                            keyDiag.valid ? "bg-success/20" : "bg-destructive/20"
                          }`}>
                            {keyDiag.valid ? (
                              <CheckCircle className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{keyDiag.keyName}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <code className={`rounded px-1 py-0.5 text-[10px] ${
                                keyDiag.keyType === "admin" 
                                  ? "bg-success/20 text-success" 
                                  : "bg-warning/20 text-warning"
                              }`}>
                                {keyDiag.keyType}
                              </code>
                              {keyDiag.organization && <span>{keyDiag.organization}</span>}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs">{keyDiag.projects.length} Projekte</p>
                      </div>
                      {keyDiag.error && (
                        <div className="mt-2 rounded bg-warning/10 px-2 py-1 text-xs text-warning">
                          {keyDiag.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Anthropic Section */}
            {diagnosis.anthropic && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-orange-500/20">
                    <span className="text-xs font-bold text-orange-500">A</span>
                  </div>
                  <h3 className="font-semibold">Anthropic (Claude)</h3>
                  <span className="text-xs text-muted-foreground">
                    {diagnosis.anthropic.validKeys}/{diagnosis.anthropic.totalKeys} Keys · {diagnosis.anthropic.totalWorkspaces} Workspaces
                  </span>
                </div>
                <div className="space-y-2">
                  {diagnosis.anthropic.keys.map((keyDiag, index) => (
                    <div 
                      key={`anthropic-${index}`} 
                      className={`rounded-lg border p-3 ${
                        keyDiag.valid ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-7 w-7 items-center justify-center rounded ${
                            keyDiag.valid ? "bg-success/20" : "bg-destructive/20"
                          }`}>
                            {keyDiag.valid ? (
                              <CheckCircle className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{keyDiag.keyName}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <code className={`rounded px-1 py-0.5 text-[10px] ${
                                keyDiag.keyType === "admin" 
                                  ? "bg-success/20 text-success" 
                                  : "bg-warning/20 text-warning"
                              }`}>
                                {keyDiag.keyType}
                              </code>
                              {keyDiag.organization && <span>{keyDiag.organization}</span>}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs">{keyDiag.workspaces.length} Workspaces</p>
                      </div>
                      {keyDiag.error && (
                        <div className="mt-2 rounded bg-warning/10 px-2 py-1 text-xs text-warning">
                          {keyDiag.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gemini Section */}
            {diagnosis.gemini && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-500/20">
                    <span className="text-xs font-bold text-blue-500">G</span>
                  </div>
                  <h3 className="font-semibold">Google (Gemini)</h3>
                  <span className="text-xs text-muted-foreground">
                    {diagnosis.gemini.validKeys}/{diagnosis.gemini.totalKeys} Keys
                  </span>
                </div>
                <div className="space-y-2">
                  {diagnosis.gemini.keys.map((keyDiag, index) => (
                    <div 
                      key={`gemini-${index}`} 
                      className={`rounded-lg border p-3 ${
                        keyDiag.valid ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-7 w-7 items-center justify-center rounded ${
                            keyDiag.valid ? "bg-success/20" : "bg-destructive/20"
                          }`}>
                            {keyDiag.valid ? (
                              <CheckCircle className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{keyDiag.keyName}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <code className="rounded bg-blue-500/20 px-1 py-0.5 text-[10px] text-blue-500">
                                {keyDiag.keyType}
                              </code>
                              {keyDiag.projectId && <span>{keyDiag.projectId}</span>}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs">{keyDiag.models.length} Modelle</p>
                      </div>
                      {keyDiag.models.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {keyDiag.models.slice(0, 4).map((model) => (
                            <code key={model} className="rounded bg-muted px-1 py-0.5 text-[10px]">
                              {model}
                            </code>
                          ))}
                          {keyDiag.models.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{keyDiag.models.length - 4} mehr
                            </span>
                          )}
                        </div>
                      )}
                      {keyDiag.error && (
                        <div className="mt-2 rounded bg-warning/10 px-2 py-1 text-xs text-warning">
                          {keyDiag.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {diagnosis.gemini.validKeys > 0 && (
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-xs text-blue-400">
                    <strong>Hinweis:</strong> Google AI Studio bietet leider keine öffentliche Usage API. 
                    Verbrauchsdaten sind nur im Dashboard unter aistudio.google.com einsehbar.
                  </div>
                )}
              </div>
            )}

            {/* Help Text */}
            {(diagnosis.openai?.totalKeys === 0 || diagnosis.anthropic?.totalKeys === 0 || diagnosis.gemini?.totalKeys === 0) && (
              <div className="rounded-lg border border-border bg-card p-3 text-sm">
                <p className="font-medium">So erstellst du API Keys:</p>
                <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-emerald-500">OpenAI:</span> platform.openai.com → Settings → Organization → Admin API keys
                  </div>
                  <div>
                    <span className="font-medium text-orange-500">Anthropic:</span> console.anthropic.com → Settings → Admin API (nur für Organisationen)
                  </div>
                  <div>
                    <span className="font-medium text-blue-500">Gemini:</span> aistudio.google.com → Get API Key
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">
              Fehler beim Laden der Daten
            </p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "Stelle sicher, dass ein OpenAI Admin Key in den Secrets gespeichert ist."}
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Stats Grid */}
      {usage && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Today */}
            <Card className={selectedProject ? "border-primary/30" : ""}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Heute
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(displayCostToday)}
                </div>
                <div className="mt-1 flex items-center text-xs">
                  {!selectedProject && costTrend !== 0 && (
                    <>
                      {costTrend > 0 ? (
                        <TrendingUp className="mr-1 h-3 w-3 text-destructive" />
                      ) : (
                        <TrendingDown className="mr-1 h-3 w-3 text-success" />
                      )}
                      <span
                        className={
                          costTrend > 0 ? "text-destructive" : "text-success"
                        }
                      >
                        {costTrend > 0 ? "+" : ""}
                        {costTrend.toFixed(1)}% vs. gestern
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* This Week */}
            <Card className={selectedProject ? "border-primary/30" : ""}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Diese Woche
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(displayCostWeek)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Letzte 7 Tage
                </p>
              </CardContent>
            </Card>

            {/* This Month */}
            <Card className={selectedProject ? "border-primary/30" : ""}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Dieser Monat
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(displayCostMonth)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Letzte 30 Tage
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Project Usage List */}
          {usage.projects && usage.projects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5" />
                    Verbrauch nach Projekt
                  </div>
                  <span className="text-xs font-normal text-muted-foreground">
                    Klicke auf ein Projekt zum Filtern
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {usage.projects.map((projectUsage) => {
                    const isSelected = selectedProjectId === projectUsage.project.id;
                    return (
                      <div
                        key={`${projectUsage.provider}-${projectUsage.project.id}`}
                        onClick={() => handleProjectClick(projectUsage.project.id)}
                        className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 ring-1 ring-primary"
                            : "border-border bg-card/50 hover:border-primary/50 hover:bg-card"
                        }`}
                      >
                        {/* Left: Project info */}
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                            isSelected
                              ? "bg-primary/20"
                              : projectUsage.provider === "openai" 
                                ? "bg-white/10" 
                                : projectUsage.provider === "anthropic"
                                ? "bg-orange-500/10"
                                : projectUsage.provider === "google"
                                ? "bg-blue-500/10"
                                : "bg-muted/10"
                          }`}>
                            {projectUsage.provider === "openai" ? (
                              <img 
                                src="/openai-logo.png" 
                                alt="OpenAI" 
                                className={`h-9 w-9 ${isSelected ? "opacity-70" : ""}`}
                              />
                            ) : projectUsage.provider === "google" ? (
                              <img 
                                src="/gemini-logo.png" 
                                alt="Gemini" 
                                className={`h-7 w-7 ${isSelected ? "opacity-70" : ""}`}
                              />
                            ) : projectUsage.provider === "anthropic" ? (
                              <img 
                                src="/anthropic-logo.png" 
                                alt="Anthropic" 
                                className={`h-6 w-6 ${isSelected ? "opacity-70" : ""}`}
                              />
                            ) : (
                              <FolderOpen className={`h-4 w-4 ${
                                isSelected ? "text-primary" : "text-muted-foreground"
                              }`} />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={`font-medium ${isSelected ? "text-primary" : ""}`}>
                                {projectUsage.project.name}
                              </p>
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                projectUsage.provider === "openai"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : projectUsage.provider === "anthropic"
                                  ? "bg-orange-500/10 text-orange-500"
                                  : projectUsage.provider === "google"
                                  ? "bg-blue-500/10 text-blue-500"
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                {projectUsage.provider === "openai" ? "OpenAI" : 
                                 projectUsage.provider === "anthropic" ? "Anthropic" : 
                                 projectUsage.provider === "google" ? "Gemini" : projectUsage.provider}
                              </span>
                              {isSelected && (
                                <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                  Ausgewählt
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatNumber(projectUsage.requests)} Requests · {formatNumber(projectUsage.totalTokens)} Tokens
                            </p>
                          </div>
                        </div>

                        {/* Right: Costs (Today | Week | Month) */}
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Heute</p>
                            <p className="font-semibold">{formatCurrency(projectUsage.costToday || 0)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">7 Tage</p>
                            <p className="font-semibold">{formatCurrency(projectUsage.costWeek)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">30 Tage</p>
                            <p className={`font-semibold ${isSelected ? "text-primary" : "text-primary"}`}>
                              {formatCurrency(projectUsage.costMonth)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Usage Details */}
          <Card className={selectedProject ? "border-primary/30" : ""}>
            <CardHeader>
              <CardTitle>
                {selectedProject ? `Nutzung: ${selectedProject.project.name}` : "Gesamtnutzung (30 Tage)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Input Tokens</p>
                  <p className="text-xl font-semibold">
                    {formatNumber(displayInputTokensToday)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Output Tokens</p>
                  <p className="text-xl font-semibold">
                    {formatNumber(displayOutputTokensToday)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gesamt Tokens</p>
                  <p className="text-xl font-semibold">
                    {formatNumber(displayTokensToday)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Requests</p>
                  <p className="text-xl font-semibold">
                    {formatNumber(displayRequestsToday)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="space-y-4">
            {/* Time Range Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant={timeRange === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeRange("week")}
                >
                  7 Tage
                </Button>
                <Button
                  variant={timeRange === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeRange("month")}
                >
                  30 Tage
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Cost Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Kosten-Verlauf</CardTitle>
                </CardHeader>
                <CardContent>
                  {formattedChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={formattedChartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#262626"
                        />
                        <XAxis
                          dataKey="date"
                          stroke="#a1a1a1"
                          fontSize={12}
                        />
                        <YAxis stroke="#a1a1a1" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#141414",
                            border: "1px solid #262626",
                            borderRadius: "8px",
                          }}
                          formatter={(value) => [
                            formatCurrency(value as number),
                            "Kosten",
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="cost"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ fill: "#3b82f6" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                      Keine Daten verfügbar
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Token Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Token-Verbrauch</CardTitle>
                </CardHeader>
                <CardContent>
                  {formattedChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={formattedChartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#262626"
                        />
                        <XAxis
                          dataKey="date"
                          stroke="#a1a1a1"
                          fontSize={12}
                        />
                        <YAxis stroke="#a1a1a1" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#141414",
                            border: "1px solid #262626",
                            borderRadius: "8px",
                          }}
                          formatter={(value) => [
                            formatNumber(value as number),
                            "Tokens",
                          ]}
                        />
                        <Bar
                          dataKey="tokens"
                          fill="#22c55e"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                      Keine Daten verfügbar
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Info */}
      <div className="rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground">
        <p>
          📊 Die Daten werden von den <strong>OpenAI</strong> und <strong>Anthropic</strong> Usage APIs abgerufen. 
          Du benötigst jeweils einen <strong>Admin Key</strong> für volle Funktionalität.
        </p>
        <div className="mt-2 flex flex-wrap gap-4 text-xs">
          <span>
            <span className="text-emerald-500">OpenAI:</span> platform.openai.com → Admin API keys
          </span>
          <span>
            <span className="text-orange-500">Anthropic:</span> console.anthropic.com → Admin API
          </span>
        </div>
      </div>
    </div>
  );
}
