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
import { useSettings, useUpdateSetting, useUpdateDataPath } from "@/hooks/useSettings";

export function Settings() {
  const { data: settings, isLoading } = useSettings();
  const updateSetting = useUpdateSetting();
  const updateDataPath = useUpdateDataPath();

  const [localDataPath, setLocalDataPath] = useState("");
  const [localAutoLock, setLocalAutoLock] = useState(5);
  const [platform, setPlatform] = useState<string>("unknown");
  const [saved, setSaved] = useState<string | null>(null);

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

  async function saveDataPath() {
    await updateDataPath.mutateAsync(localDataPath);
    showSaved("dataPath");
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
              onClick={saveDataPath}
              disabled={
                updateDataPath.isPending || localDataPath === settings?.dataPath
              }
            >
              {updateDataPath.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : saved === "dataPath" ? (
                <Check className="mr-2 h-4 w-4" />
              ) : null}
              Speichern
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            💡 Tipp: Wähle einen OneDrive- oder iCloud-Ordner für automatische
            Synchronisation zwischen Geräten.
          </p>
        </CardContent>
      </Card>

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
