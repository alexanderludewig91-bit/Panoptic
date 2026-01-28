import { useState, useEffect, useRef, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Layout } from "@/components/layout/Layout";
import { LockScreen } from "@/pages/LockScreen";
import { Dashboard } from "@/pages/Dashboard";
import { Costs } from "@/pages/Costs";
import { Secrets } from "@/pages/Secrets";
import { Settings } from "@/pages/Settings";
import { AuditLog } from "@/pages/AuditLog";
import { Placeholder } from "@/pages/Placeholder";

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

function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const timeoutRef = useRef<number | null>(null);

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
