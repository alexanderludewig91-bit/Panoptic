import { useState, useEffect } from "react";
import {
  FolderOpen,
  Shield,
  Bell,
  Palette,
  Database,
  Info,
  Check,
  Loader2,
  AlertTriangle,
  HardDrive,
  ArrowRight,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings, useUpdateSetting, useUpdateDataPath, useDatabaseInfo, useGetDatabaseInfoAt, useSwitchToExistingDatabase } from "@/hooks/useSettings";

export function Settings() {
  const { data: settings, isLoading } = useSettings();
  const updateSetting = useUpdateSetting();
  const updateDataPath = useUpdateDataPath();
  const { data: dbInfo, refetch: refetchDbInfo } = useDatabaseInfo();
  const getTargetDbInfo = useGetDatabaseInfoAt();
  const switchToExisting = useSwitchToExistingDatabase();

  const [localDataPath, setLocalDataPath] = useState("");
  const [localAutoLock, setLocalAutoLock] = useState(5);
  const [platform, setPlatform] = useState<string>("unknown");
  const [saved, setSaved] = useState<string | null>(null);
  
  // Migration dialog state
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [targetDbInfo, setTargetDbInfo] = useState<{ exists: boolean; secretsCount: number } | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    detectPlatform();
  }, []);

  useEffect(() => {
    if (settings) {
      setLocalDataPath(settings.dataPath);
      setLocalAutoLock(settings.autoLockMinutes);
    }
  }, [settings]);

  async function detectPlatform() {
    try {
      const { platform: getPlatform } = await import("@tauri-apps/plugin-os");
      setPlatform(await getPlatform());
    } catch {
      setPlatform("web");
    }
  }

  async function selectDataPath() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Wähle den Speicherort für deine Daten",
      });
      if (selected && typeof selected === "string") {
        setLocalDataPath(selected);
      }
    } catch (err) {
      console.error("Dialog error:", err);
    }
  }

  async function initiateDataPathChange() {
    if (localDataPath === settings?.dataPath) return;
    
    setMigrationError(null);
    setPendingPath(localDataPath);
    
    // Get detailed info about target database
    const targetInfo = await getTargetDbInfo.mutateAsync(localDataPath);
    setTargetDbInfo({ exists: targetInfo.exists, secretsCount: targetInfo.secretsCount });
    setShowMigrationDialog(true);
  }

  async function confirmMigration(overwrite: boolean = false) {
    if (!pendingPath) return;
    
    setMigrationError(null);
    
    const result = await updateDataPath.mutateAsync({ 
      path: pendingPath, 
      overwrite 
    });
    
    if (result.success) {
      setShowMigrationDialog(false);
      setPendingPath(null);
      setTargetDbInfo(null);
      refetchDbInfo();
      showSaved("dataPath");
    } else {
      setMigrationError(result.error || "Migration fehlgeschlagen");
    }
  }

  async function useExistingDatabase() {
    if (!pendingPath) return;
    
    setMigrationError(null);
    
    const result = await switchToExisting.mutateAsync(pendingPath);
    
    if (result.success) {
      setShowMigrationDialog(false);
      setPendingPath(null);
      setTargetDbInfo(null);
      refetchDbInfo();
      showSaved("dataPath");
    } else {
      setMigrationError(result.error || "Wechsel fehlgeschlagen");
    }
  }

  function cancelMigration() {
    setShowMigrationDialog(false);
    setPendingPath(null);
    setMigrationError(null);
    setTargetDbInfo(null);
    setLocalDataPath(settings?.dataPath || "");
  }

  async function saveAutoLock() {
    await updateSetting.mutateAsync({
      key: "autoLockMinutes",
      value: localAutoLock,
    });
    showSaved("autoLock");
  }

  function showSaved(key: string) {
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Einstellungen</h1>
        <p className="mt-1 text-muted-foreground">
          Konfiguriere Panoptic nach deinen Wünschen.
        </p>
      </div>

      {/* Data Storage */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Datenspeicher</CardTitle>
              <CardDescription>
                Wähle, wo deine verschlüsselten Daten gespeichert werden.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              value={localDataPath}
              onChange={(e) => setLocalDataPath(e.target.value)}
              placeholder="Pfad zum Datenordner"
              className="flex-1"
            />
            <Button variant="outline" onClick={selectDataPath}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Durchsuchen
            </Button>
            <Button
              onClick={initiateDataPathChange}
              disabled={
                updateDataPath.isPending || getTargetDbInfo.isPending || localDataPath === settings?.dataPath
              }
            >
              {(updateDataPath.isPending || getTargetDbInfo.isPending) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : saved === "dataPath" ? (
                <Check className="mr-2 h-4 w-4" />
              ) : null}
              Speichern
            </Button>
          </div>
          
          {/* Current database info */}
          {dbInfo && dbInfo.exists && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <HardDrive className="h-4 w-4" />
                <span>Aktuelle Datenbank: <strong>{dbInfo.secretsCount}</strong> Secrets gespeichert</span>
              </div>
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            💡 Tipp: Wähle einen OneDrive- oder iCloud-Ordner für automatische
            Synchronisation zwischen Geräten. Deine Daten werden automatisch migriert.
          </p>
        </CardContent>
      </Card>

      {/* Migration Confirmation Dialog */}
      {showMigrationDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Speicherort ändern</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={cancelMigration}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="mt-4 space-y-4">
              {/* Migration path info */}
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="truncate max-w-[140px]">{settings?.dataPath?.split('/').pop()}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                  <span className="truncate max-w-[140px] font-medium text-foreground">{pendingPath?.split('/').pop()}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground truncate">
                  {pendingPath}
                </div>
              </div>

              {/* Scenario: Target has existing database with data */}
              {targetDbInfo?.exists && targetDbInfo.secretsCount > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <HardDrive className="mt-0.5 h-5 w-5 text-emerald-500" />
                    <div>
                      <p className="font-medium text-emerald-700 dark:text-emerald-400">
                        Bestehende Datenbank gefunden!
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Am Zielort existiert eine Datenbank mit <strong>{targetDbInfo.secretsCount}</strong> Secrets.
                      </p>
                      {dbInfo && dbInfo.secretsCount > 0 && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Deine aktuelle DB hat <strong>{dbInfo.secretsCount}</strong> Secrets.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Scenario: Target is empty, source has data */}
              {!targetDbInfo?.exists && dbInfo && dbInfo.secretsCount > 0 && (
                <div className="text-sm text-muted-foreground">
                  <strong>{dbInfo.secretsCount}</strong> Secrets werden zum neuen Speicherort migriert.
                </div>
              )}

              {/* Scenario: Both empty */}
              {!targetDbInfo?.exists && (!dbInfo || dbInfo.secretsCount === 0) && (
                <div className="text-sm text-muted-foreground">
                  Eine neue Datenbank wird am Zielort erstellt.
                </div>
              )}

              {/* Error message */}
              {migrationError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>{migrationError}</div>
                </div>
              )}

              {/* Actions based on scenario */}
              <div className="space-y-2 pt-2">
                {/* If target has data: Show "Use existing" as primary option */}
                {targetDbInfo?.exists && targetDbInfo.secretsCount > 0 && (
                  <>
                    <Button 
                      onClick={useExistingDatabase} 
                      disabled={switchToExisting.isPending || updateDataPath.isPending}
                      className="w-full"
                    >
                      {switchToExisting.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <HardDrive className="mr-2 h-4 w-4" />
                      Bestehende Datenbank verwenden
                    </Button>
                    
                    {dbInfo && dbInfo.secretsCount > 0 && (
                      <Button 
                        onClick={() => confirmMigration(true)} 
                        disabled={switchToExisting.isPending || updateDataPath.isPending}
                        variant="destructive"
                        className="w-full"
                      >
                        {updateDataPath.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Meine Daten migrieren (überschreibt Ziel)
                      </Button>
                    )}
                  </>
                )}

                {/* If target is empty: Show migrate option */}
                {!targetDbInfo?.exists && (
                  <Button 
                    onClick={() => confirmMigration(false)} 
                    disabled={updateDataPath.isPending}
                    className="w-full"
                  >
                    {updateDataPath.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {dbInfo && dbInfo.secretsCount > 0 ? "Daten migrieren" : "Speicherort ändern"}
                  </Button>
                )}

                {/* Target has empty DB */}
                {targetDbInfo?.exists && targetDbInfo.secretsCount === 0 && (
                  <>
                    {dbInfo && dbInfo.secretsCount > 0 ? (
                      <Button 
                        onClick={() => confirmMigration(true)} 
                        disabled={updateDataPath.isPending}
                        className="w-full"
                      >
                        {updateDataPath.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Daten migrieren
                      </Button>
                    ) : (
                      <Button 
                        onClick={useExistingDatabase} 
                        disabled={switchToExisting.isPending}
                        className="w-full"
                      >
                        {switchToExisting.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Speicherort wechseln
                      </Button>
                    )}
                  </>
                )}

                <Button variant="outline" onClick={cancelMigration} className="w-full">
                  Abbrechen
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Sicherheit</CardTitle>
              <CardDescription>
                Authentifizierung und Auto-Lock Einstellungen.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Biometrische Authentifizierung</p>
              <p className="text-sm text-muted-foreground">
                {platform === "macos"
                  ? "Touch ID"
                  : platform === "windows"
                    ? "Windows Hello"
                    : "Nicht verfügbar"}{" "}
                – kommt in V0.2
              </p>
            </div>
            <Button variant="outline" disabled>
              Bald verfügbar
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-Lock</p>
              <p className="text-sm text-muted-foreground">
                Automatisch sperren nach Inaktivität
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={localAutoLock}
                onChange={(e) =>
                  setLocalAutoLock(parseInt(e.target.value) || 5)
                }
                className="w-20"
                min={1}
                max={60}
              />
              <span className="text-sm text-muted-foreground">Minuten</span>
              <Button
                variant="outline"
                size="sm"
                onClick={saveAutoLock}
                disabled={
                  updateSetting.isPending ||
                  localAutoLock === settings?.autoLockMinutes
                }
              >
                {saved === "autoLock" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  "Speichern"
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Passwort ändern</p>
              <p className="text-sm text-muted-foreground">
                Master-Passwort aktualisieren
              </p>
            </div>
            <Button variant="outline">Ändern</Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Benachrichtigungen</CardTitle>
              <CardDescription>
                Konfiguriere, wann du benachrichtigt werden möchtest.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">System-Benachrichtigungen</p>
              <p className="text-sm text-muted-foreground">
                Native Desktop-Benachrichtigungen
              </p>
            </div>
            <Button
              variant={settings?.notificationsEnabled ? "default" : "outline"}
              onClick={() =>
                updateSetting.mutate({
                  key: "notificationsEnabled",
                  value: !settings?.notificationsEnabled,
                })
              }
            >
              {settings?.notificationsEnabled ? "Aktiviert" : "Deaktiviert"}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Kosten-Alerts</p>
              <p className="text-sm text-muted-foreground">
                Warnungen bei hohen API-Kosten
              </p>
            </div>
            <Button variant="outline">Konfigurieren</Button>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Palette className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Erscheinungsbild</CardTitle>
              <CardDescription>
                Passe das Aussehen der App an.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant={settings?.theme === "dark" ? "default" : "outline"}
              onClick={() =>
                updateSetting.mutate({ key: "theme", value: "dark" })
              }
            >
              Dunkel
            </Button>
            <Button
              variant={settings?.theme === "light" ? "default" : "outline"}
              onClick={() =>
                updateSetting.mutate({ key: "theme", value: "light" })
              }
            >
              Hell
            </Button>
            <Button
              variant={settings?.theme === "system" ? "default" : "outline"}
              onClick={() =>
                updateSetting.mutate({ key: "theme", value: "system" })
              }
            >
              System
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Über Panoptic</CardTitle>
              <CardDescription>Version und Systeminformationen.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span>0.1.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plattform</span>
            <span className="capitalize">{platform}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Framework</span>
            <span>Tauri 2.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Datenpfad</span>
            <span className="max-w-[300px] truncate text-right">
              {settings?.dataPath}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
