import { useState } from "react";
import { KeyRound, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { verifyPassword, setMasterPassword, getSetting } from "@/lib/settings";
import { logAudit, AuditActions } from "@/lib/audit";

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);

  // Check if this is first time setup
  useState(() => {
    getSetting("masterPasswordHash").then((hash) => {
      setIsFirstTime(!hash);
    });
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isFirstTime) {
        // First time setup - create password
        if (password.length < 4) {
          setError("Passwort muss mindestens 4 Zeichen haben");
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwörter stimmen nicht überein");
          setIsLoading(false);
          return;
        }

        await setMasterPassword(password);
        await logAudit(AuditActions.APP_UNLOCKED, "app", "setup", {
          firstTime: true,
        });
        onUnlock();
      } else {
        // Verify existing password
        const isValid = await verifyPassword(password);
        if (isValid) {
          await logAudit(AuditActions.APP_UNLOCKED, "app", "login");
          onUnlock();
        } else {
          setError("Falsches Passwort");
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError("Ein Fehler ist aufgetreten");
    }

    setIsLoading(false);
  }

  // Still loading
  if (isFirstTime === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/logo.png"
            alt="Panoptic"
            className="mb-4 h-20 w-20 rounded-2xl shadow-lg shadow-primary/20"
          />
          <h1 className="text-2xl font-bold tracking-tight">Panoptic</h1>
          <p className="mt-1 text-sm text-muted-foreground">Alles im Blick</p>
        </div>

        {/* Auth Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardContent className="pt-6">
            {isFirstTime && (
              <div className="mb-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">
                👋 Willkommen! Erstelle ein Master-Passwort für deine App.
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-foreground"
                >
                  {isFirstTime ? "Neues Master-Passwort" : "Master-Passwort"}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="pl-10"
                    autoFocus
                    disabled={isLoading}
                  />
                </div>
              </div>

              {isFirstTime && (
                <div className="space-y-2">
                  <label
                    htmlFor="confirmPassword"
                    className="text-sm font-medium text-foreground"
                  >
                    Passwort bestätigen
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isFirstTime ? "Passwort erstellen" : "Entsperren"}
              </Button>
            </form>

            {/* Info about biometric auth coming soon */}
            <div className="mt-4 rounded-lg bg-muted/50 p-3 text-center text-xs text-muted-foreground">
              💡 Touch ID / Windows Hello Support kommt in V0.2
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Deine Daten bleiben lokal und werden nie in die Cloud übertragen.
        </p>
      </div>
    </div>
  );
}
