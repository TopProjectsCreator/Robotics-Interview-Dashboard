import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface WorkspaceSettings {
  density: "comfortable" | "compact";
  showPhotos: boolean;
  reduceMotion: boolean;
  displayName: string;
  initials: string;
  defaultSort: string;
  autoRefresh: boolean;
  refreshMs: number;
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  density: "comfortable",
  showPhotos: true,
  reduceMotion: false,
  displayName: "",
  initials: "",
  defaultSort: "rank",
  autoRefresh: true,
  refreshMs: 3000,
};

export const REFRESH_OPTIONS = [
  { value: 3000, label: "3s" },
  { value: 10000, label: "10s" },
  { value: 30000, label: "30s" },
];

const STORAGE_KEY = "robotics-workspace-settings";

function load(): WorkspaceSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<WorkspaceSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SettingsContextValue {
  settings: WorkspaceSettings;
  update: (patch: Partial<WorkspaceSettings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => undefined,
  reset: () => undefined,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<WorkspaceSettings>(load);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Private browsing etc.
    }
  }, [settings]);
  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      update: (patch) => setSettings((current) => ({ ...current, ...patch })),
      reset: () => setSettings(DEFAULT_SETTINGS),
    }),
    [settings],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useWorkspaceSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}

export function avatarInitials(settings: WorkspaceSettings): string {
  if (settings.initials.trim()) return settings.initials.trim().slice(0, 2).toUpperCase();
  const derived = settings.displayName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return derived || "MZ";
}
