import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Server,
  KeyRound,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useSecrets } from "@/hooks/useSecrets";
import { useOpenAIUsage } from "@/hooks/useOpenAI";
import { useAuditLog } from "@/hooks/useAuditLog";

export function Dashboard() {
  const { data: secrets = [], isLoading: secretsLoading } = useSecrets();
  const { data: usage, isLoading: usageLoading, error: usageError } = useOpenAIUsage();
  const { data: recentActivity = [], isLoading: activityLoading } = useAuditLog({
    limit: 5,
  });

  const llmSecrets = secrets.filter((s) => s.category === "llm");
  const infraSecrets = secrets.filter((s) => s.category === "infrastructure");

  // Calculate cost trend
  const costTrend =
    usage?.thisWeek && usage.thisWeek.length >= 2
      ? ((usage.thisWeek[0]?.costUsd - usage.thisWeek[1]?.costUsd) /
          (usage.thisWeek[1]?.costUsd || 1)) *
        100
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Willkommen zurück. Hier ist deine Übersicht.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Today's Costs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kosten Heute
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : usageError ? (
              <div className="text-sm text-muted-foreground">
                <AlertCircle className="mb-1 h-4 w-4 text-warning" />
                Kein API-Key
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(usage?.totalCostToday || 0)}
                </div>
                {costTrend !== 0 && (
                  <div className="mt-1 flex items-center text-xs">
                    {costTrend > 0 ? (
                      <>
                        <TrendingUp className="mr-1 h-3 w-3 text-destructive" />
                        <span className="text-destructive">
                          +{costTrend.toFixed(1)}% vs. gestern
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="mr-1 h-3 w-3 text-success" />
                        <span className="text-success">
                          {costTrend.toFixed(1)}% vs. gestern
                        </span>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Monthly Costs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kosten Monat
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(usage?.totalCostMonth || 0)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Letzte 30 Tage
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* LLM Keys */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              LLM Keys
            </CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {secretsLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{llmSecrets.length}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  OpenAI, Anthropic, etc.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Secrets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gespeicherte Keys
            </CardTitle>
            <KeyRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {secretsLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{secrets.length}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {infraSecrets.length} Infrastruktur
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* LLM Keys Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>LLM Provider</CardTitle>
            <Link to="/costs">
              <Button variant="ghost" size="sm">
                Details
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {secretsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : llmSecrets.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p>Noch keine LLM-Keys gespeichert.</p>
                <Link to="/secrets">
                  <Button variant="link" className="mt-2">
                    Key hinzufügen
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {llmSecrets.map((secret) => (
                  <div
                    key={secret.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-success" />
                      <span className="font-medium">{secret.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {secret.provider}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Letzte Aktivitäten</CardTitle>
            <Link to="/audit">
              <Button variant="ghost" size="sm">
                Alle anzeigen
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Noch keine Aktivitäten aufgezeichnet.
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {activity.action.includes("secret") && (
                          <KeyRound className="h-4 w-4 text-primary" />
                        )}
                        {activity.action.includes("api") && (
                          <Server className="h-4 w-4 text-success" />
                        )}
                        {activity.action.includes("app") && (
                          <DollarSign className="h-4 w-4 text-warning" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm">{activity.action}</p>
                        {activity.details && "name" in activity.details && (
                          <p className="text-xs text-muted-foreground">
                            {String(activity.details.name)}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Schnellzugriff</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link to="/secrets">
              <Button variant="outline">
                <KeyRound className="mr-2 h-4 w-4" />
                Neuen Key hinzufügen
              </Button>
            </Link>
            <Link to="/costs">
              <Button variant="outline">
                <DollarSign className="mr-2 h-4 w-4" />
                Kostenübersicht
              </Button>
            </Link>
            <Link to="/audit">
              <Button variant="outline">
                <Server className="mr-2 h-4 w-4" />
                Audit Log
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
