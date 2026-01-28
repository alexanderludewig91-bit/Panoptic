import { useState } from "react";
import {
  ScrollText,
  KeyRound,
  Settings,
  Globe,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuditLog, useAuditLogCount } from "@/hooks/useAuditLog";
import { formatRelativeTime } from "@/lib/utils";

const PAGE_SIZE = 20;

const actionIcons: Record<string, React.ReactNode> = {
  secret_created: <KeyRound className="h-4 w-4 text-success" />,
  secret_updated: <KeyRound className="h-4 w-4 text-warning" />,
  secret_deleted: <KeyRound className="h-4 w-4 text-destructive" />,
  secret_accessed: <KeyRound className="h-4 w-4 text-primary" />,
  secret_copied: <KeyRound className="h-4 w-4 text-muted-foreground" />,
  settings_updated: <Settings className="h-4 w-4 text-primary" />,
  data_path_changed: <Settings className="h-4 w-4 text-warning" />,
  api_call: <Globe className="h-4 w-4 text-success" />,
  api_error: <Globe className="h-4 w-4 text-destructive" />,
  app_unlocked: <ScrollText className="h-4 w-4 text-success" />,
  app_locked: <ScrollText className="h-4 w-4 text-muted-foreground" />,
};

const actionLabels: Record<string, string> = {
  secret_created: "Secret erstellt",
  secret_updated: "Secret aktualisiert",
  secret_deleted: "Secret gelöscht",
  secret_accessed: "Secret abgerufen",
  secret_copied: "Secret kopiert",
  settings_updated: "Einstellungen geändert",
  data_path_changed: "Datenpfad geändert",
  api_call: "API-Aufruf",
  api_error: "API-Fehler",
  app_unlocked: "App entsperrt",
  app_locked: "App gesperrt",
};

export function AuditLog() {
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  const { data: entries = [], isLoading } = useAuditLog({
    limit: PAGE_SIZE,
    offset,
  });
  const { data: totalCount = 0 } = useAuditLogCount();

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="mt-1 text-muted-foreground">
          Vollständige Nachvollziehbarkeit aller Aktionen.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-sm text-muted-foreground">Einträge gesamt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {entries.filter((e) => e.action.includes("secret")).length}
            </div>
            <p className="text-sm text-muted-foreground">
              Secret-Aktionen (diese Seite)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {entries.filter((e) => e.action.includes("api")).length}
            </div>
            <p className="text-sm text-muted-foreground">
              API-Aufrufe (diese Seite)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Log Entries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Aktivitäten
          </CardTitle>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Seite {page + 1} von {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Noch keine Aktivitäten aufgezeichnet.
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-4 rounded-lg border border-border bg-secondary/20 p-4"
                >
                  <div className="mt-1">
                    {actionIcons[entry.action] || (
                      <ScrollText className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {actionLabels[entry.action] || entry.action}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                    </div>
                    {entry.details && (
                      <div className="mt-1 text-sm text-muted-foreground">
                        {"name" in entry.details && (
                          <span className="mr-2">
                            <strong>Name:</strong> {String(entry.details.name)}
                          </span>
                        )}
                        {"provider" in entry.details && (
                          <span className="mr-2">
                            <strong>Provider:</strong>{" "}
                            {String(entry.details.provider)}
                          </span>
                        )}
                        {"category" in entry.details && (
                          <span className="mr-2">
                            <strong>Kategorie:</strong>{" "}
                            {String(entry.details.category)}
                          </span>
                        )}
                        {"endpoint" in entry.details && (
                          <span className="mr-2">
                            <strong>Endpoint:</strong>{" "}
                            {String(entry.details.endpoint)}
                          </span>
                        )}
                        {"error" in entry.details && (
                          <span className="text-destructive">
                            <strong>Fehler:</strong>{" "}
                            {String(entry.details.error).slice(0, 100)}
                          </span>
                        )}
                      </div>
                    )}
                    {entry.resourceType && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {entry.resourceType}
                        {entry.resourceId && ` • ${entry.resourceId.slice(0, 8)}...`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground">
        <p>
          📋 Audit-Logs werden automatisch nach 90 Tagen gelöscht. Alle
          Secret-Zugriffe und Änderungen werden protokolliert.
        </p>
      </div>
    </div>
  );
}
