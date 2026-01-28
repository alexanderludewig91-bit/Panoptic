import { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2, AlertTriangle, RefreshCw, Database } from "lucide-react";

import { Layout } from "@/components/layout/Layout";
import { LockScreen } from "@/pages/LockScreen";
import { Dashboard } from "@/pages/Dashboard";
import { Costs } from "@/pages/Costs";
import { Secrets } from "@/pages/Secrets";
import { Settings } from "@/pages/Settings";
import { AuditLog } from "@/pages/AuditLog";
import { Placeholder } from "@/pages/Placeholder";
import { initializeDatabase } from "@/lib/database";
import { Button } from "@/components/ui/button";

import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Auto-lock timeout in milliseconds (5 minutes)
const AUTO_LOCK_TIMEOUT = 5 * 60 * 1000;

// Database initialization states
type DbState = "loading" | "ready" | "error";

function App() {
  const [dbState, setDbState] = useState<DbState>("loading");
  const [dbError, setDbError] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  // Initialize database on app start
  useEffect(() => {
    async function initDb() {
      setDbState("loading");
      setDbError(null);
      
      const result = await initializeDatabase();
      
      if (result.success) {
        setDbState("ready");
      } else {
        setDbState("error");
        setDbError(result.error || "Unbekannter Fehler");
      }
    }
    
    initDb();
  }, []);

  const lock = useCallback(() => {
    console.log("Auto-locking app due to inactivity");
    setIsUnlocked(false);
  }, []);

  const resetTimer = useCallback(() => {
    // Clear existing timer
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    
    // Only set new timer if unlocked
    if (isUnlocked) {
      timeoutRef.current = window.setTimeout(lock, AUTO_LOCK_TIMEOUT);
    }
  }, [isUnlocked, lock]);

  // Setup auto-lock on activity
  useEffect(() => {
    if (!isUnlocked) {
      // Clear timer when locked
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Start initial timer
    resetTimer();

    // Reset timer on user activity
    const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"];
    
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [isUnlocked, resetTimer]);

  // Show loading screen while initializing database
  if (dbState === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Database className="h-12 w-12 text-primary/30" />
            <Loader2 className="absolute inset-0 h-12 w-12 animate-spin text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold">Panoptic wird gestartet...</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Datenbank wird initialisiert
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error screen if database initialization failed
  if (dbState === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-destructive">
                Datenbank-Fehler
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Die Datenbank konnte nicht initialisiert werden.
              </p>
              {dbError && (
                <p className="mt-2 rounded bg-muted/50 p-2 font-mono text-xs text-destructive">
                  {dbError}
                </p>
              )}
            </div>
            <Button
              onClick={() => {
                setDbState("loading");
                setDbError(null);
                initializeDatabase().then((result) => {
                  if (result.success) {
                    setDbState("ready");
                  } else {
                    setDbState("error");
                    setDbError(result.error || "Unbekannter Fehler");
                  }
                });
              }}
              variant="outline"
              className="mt-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Erneut versuchen
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              Falls das Problem weiterhin besteht, überprüfe die App-Berechtigungen
              oder starte die App neu.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show lock screen if not authenticated
  if (!isUnlocked) {
    return (
      <QueryClientProvider client={queryClient}>
        <LockScreen onUnlock={() => setIsUnlocked(true)} />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="costs" element={<Costs />} />
            <Route
              path="infrastructure"
              element={
                <Placeholder
                  title="Infrastruktur"
                  description="Status und Verwaltung deiner Cloud-Services."
                />
              }
            />
            <Route
              path="users"
              element={
                <Placeholder
                  title="Benutzerverwaltung"
                  description="Zentrale Verwaltung der Benutzer deiner Anwendungen."
                />
              }
            />
            <Route path="secrets" element={<Secrets />} />
            <Route
              path="alerts"
              element={
                <Placeholder
                  title="Alerts"
                  description="Konfiguriere Benachrichtigungen für wichtige Events."
                />
              }
            />
            <Route path="audit" element={<AuditLog />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
