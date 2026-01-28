import { useState } from "react";
import {
  KeyRound,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Search,
  Trash2,
  Edit,
  Clock,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maskSecret, formatRelativeTime } from "@/lib/utils";
import {
  useSearchSecrets,
  useCreateSecret,
  useUpdateSecret,
  useDeleteSecret,
} from "@/hooks/useSecrets";
import { logAudit, AuditActions } from "@/lib/audit";
import type { Secret } from "@/lib/secrets";

const categoryLabels = {
  llm: "LLM",
  infrastructure: "Infrastruktur",
  app: "Anwendung",
};

const categoryColors = {
  llm: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  infrastructure: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  app: "bg-green-500/10 text-green-400 border-green-500/20",
};

const providerOptions = [
  { value: "openai", label: "OpenAI", category: "llm" },
  { value: "anthropic", label: "Anthropic (Claude)", category: "llm" },
  { value: "google", label: "Google (Gemini)", category: "llm" },
  { value: "mistral", label: "Mistral AI", category: "llm" },
  { value: "cohere", label: "Cohere", category: "llm" },
  { value: "railway", label: "Railway", category: "infrastructure" },
  { value: "vercel", label: "Vercel", category: "infrastructure" },
  { value: "supabase", label: "Supabase", category: "infrastructure" },
  { value: "neondb", label: "NeonDB", category: "infrastructure" },
  { value: "cloudflare", label: "Cloudflare", category: "infrastructure" },
  { value: "aws", label: "AWS", category: "infrastructure" },
  { value: "github", label: "GitHub", category: "app" },
  { value: "stripe", label: "Stripe", category: "app" },
  { value: "resend", label: "Resend", category: "app" },
  { value: "other", label: "Sonstiger", category: "app" },
];

interface SecretFormData {
  name: string;
  category: Secret["category"];
  provider: string;
  value: string;
}

const emptyFormData: SecretFormData = {
  name: "",
  category: "llm",
  provider: "",
  value: "",
};

export function Secrets() {
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SecretFormData>(emptyFormData);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: secrets = [], isLoading } = useSearchSecrets(searchQuery);
  const createMutation = useCreateSecret();
  const updateMutation = useUpdateSecret();
  const deleteMutation = useDeleteSecret();

  const toggleVisibility = (id: string) => {
    setVisibleSecrets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
        // Auto-hide after 30 seconds
        setTimeout(() => {
          setVisibleSecrets((current) => {
            const updated = new Set(current);
            updated.delete(id);
            return updated;
          });
        }, 30000);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (secret: Secret) => {
    try {
      const { writeText } = await import(
        "@tauri-apps/plugin-clipboard-manager"
      );
      await writeText(secret.value);
      setCopiedId(secret.id);
      await logAudit(AuditActions.SECRET_COPIED, "secret", secret.id, {
        name: secret.name,
      });
      setTimeout(() => setCopiedId(null), 2000);

      // Clear clipboard after 30 seconds
      setTimeout(async () => {
        try {
          await writeText("");
        } catch {
          // Ignore
        }
      }, 30000);
    } catch {
      // Fallback for development
      await navigator.clipboard.writeText(secret.value);
      setCopiedId(secret.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        data: formData,
      });
      setEditingId(null);
    } else {
      await createMutation.mutateAsync(formData);
      setShowAddForm(false);
    }

    setFormData(emptyFormData);
  };

  const startEdit = (secret: Secret) => {
    setFormData({
      name: secret.name,
      category: secret.category,
      provider: secret.provider,
      value: secret.value,
    });
    setEditingId(secret.id);
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(emptyFormData);
    setShowAddForm(false);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Secrets Vault</h1>
          <p className="mt-1 text-muted-foreground">
            Sichere Verwaltung deiner API-Keys und Credentials.
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Key
        </Button>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? "Secret bearbeiten" : "Neues Secret erstellen"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    placeholder="z.B. OpenAI Admin Key"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Provider</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formData.provider}
                    onChange={(e) => {
                      const selectedProvider = providerOptions.find(p => p.value === e.target.value);
                      setFormData((prev) => ({
                        ...prev,
                        provider: e.target.value,
                        // Auto-select category based on provider
                        category: selectedProvider?.category as Secret["category"] || prev.category,
                      }));
                    }}
                    required
                  >
                    <option value="">Provider wählen...</option>
                    <optgroup label="LLM">
                      {providerOptions.filter(p => p.category === "llm").map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Infrastruktur">
                      {providerOptions.filter(p => p.category === "infrastructure").map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Anwendung">
                      {providerOptions.filter(p => p.category === "app").map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Kategorie</label>
                <div className="flex gap-2">
                  {(["llm", "infrastructure", "app"] as const).map((cat) => (
                    <Button
                      key={cat}
                      type="button"
                      variant={formData.category === cat ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, category: cat }))
                      }
                    >
                      {categoryLabels[cat]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">API Key / Secret</label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={formData.value}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, value: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingId ? "Speichern" : "Erstellen"}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Abbrechen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Secrets durchsuchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Secrets List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {isLoading ? "..." : secrets.length} Secrets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {secrets.map((secret) => (
                <div
                  key={secret.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <KeyRound className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{secret.name}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${categoryColors[secret.category]}`}
                        >
                          {categoryLabels[secret.category]}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                        <code className="font-mono">
                          {visibleSecrets.has(secret.id)
                            ? secret.value
                            : maskSecret(secret.value)}
                        </code>
                      </div>
                      {secret.lastUsedAt && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Zuletzt verwendet:{" "}
                          {formatRelativeTime(secret.lastUsedAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {deleteConfirmId === secret.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(secret.id)}
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleVisibility(secret.id)}
                          title={
                            visibleSecrets.has(secret.id)
                              ? "Verstecken"
                              : "Anzeigen"
                          }
                        >
                          {visibleSecrets.has(secret.id) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(secret)}
                          title="Kopieren (30s)"
                        >
                          <Copy
                            className={`h-4 w-4 ${copiedId === secret.id ? "text-success" : ""}`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(secret)}
                          title="Bearbeiten"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(secret.id)}
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {secrets.length === 0 && !isLoading && (
                <div className="py-12 text-center text-muted-foreground">
                  {searchQuery
                    ? "Keine Secrets gefunden."
                    : "Noch keine Secrets gespeichert. Füge deinen ersten API-Key hinzu!"}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground">
        <p>
          🔒 Alle Secrets werden verschlüsselt in der lokalen SQLite-Datenbank
          gespeichert. Kopierte Werte werden nach 30 Sekunden automatisch aus
          der Zwischenablage gelöscht.
        </p>
      </div>
    </div>
  );
}
