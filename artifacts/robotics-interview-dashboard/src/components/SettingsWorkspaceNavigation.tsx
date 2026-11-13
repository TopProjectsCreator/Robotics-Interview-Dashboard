import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

export type SettingsSectionId =
  | "profile"
  | "appearance"
  | "assistant"
  | "team"
  | "branding"
  | "chat"
  | "operations";

export type SettingsNavigationItem = {
  id: SettingsSectionId;
  label: string;
  description: string;
  keywords: string;
};

const BASE_SECTIONS: SettingsNavigationItem[] = [
  { id: "profile", label: "Profile", description: "Your name, passkeys, and sign-in options.", keywords: "account identity avatar initials password passkey" },
  { id: "appearance", label: "Appearance", description: "Theme and personal dashboard preferences.", keywords: "theme dark light density photos motion" },
  { id: "assistant", label: "Assistant", description: "Team AI provider, usage, and tool controls.", keywords: "ai model provider governance tools productivity" },
  { id: "team", label: "Team", description: "Team members, access, inbox, and naming rules.", keywords: "members roles passwords access workspace mailbox email rules" },
  { id: "branding", label: "Branding", description: "Shared team colors, logo, and background.", keywords: "color logo background image" },
  { id: "chat", label: "Chat", description: "Chat behavior and assistant conversation settings.", keywords: "slow mode messages assistant" },
  { id: "operations", label: "Operations", description: "Live updates, broadcasts, and data controls.", keywords: "refresh notifications broadcast data reset parts order" },
];

export function getSettingsNavigationItems({
  canManageAssistant,
  canManageBranding,
}: {
  canManageAssistant: boolean;
  canManageBranding: boolean;
}): SettingsNavigationItem[] {
  return BASE_SECTIONS.filter((section) =>
    (section.id !== "assistant" || canManageAssistant)
    && (section.id !== "branding" || canManageBranding),
  );
}

export function SettingsWorkspaceNavigation({
  items,
  activeSection,
  onSectionChange,
}: {
  items: SettingsNavigationItem[];
  activeSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
}) {
  const [search, setSearch] = useState("");
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      `${item.label} ${item.description} ${item.keywords}`.toLocaleLowerCase().includes(query),
    );
  }, [items, search]);

  useEffect(() => {
    if (filteredItems.length && !filteredItems.some((item) => item.id === activeSection)) {
      onSectionChange(filteredItems[0].id);
    }
  }, [activeSection, filteredItems, onSectionChange]);

  const moveFocus = (currentIndex: number, direction: -1 | 1) => {
    if (!filteredItems.length) return;
    const nextIndex = (currentIndex + direction + filteredItems.length) % filteredItems.length;
    const next = filteredItems[nextIndex];
    onSectionChange(next.id);
    document.getElementById(`settings-tab-${next.id}`)?.focus();
  };

  return (
    <nav
      aria-label="Settings sections"
      data-testid="settings-navigation"
      className="min-w-0 border-b border-border bg-card/60 p-3 dark:border-border sm:w-56 sm:shrink-0 sm:border-b-0 sm:border-r sm:p-4"
    >
      <label htmlFor="settings-section-search" className="sr-only">Search settings sections</label>
      <div className="relative">
        <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          id="settings-section-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a setting"
          autoComplete="off"
          data-testid="input-settings-section-search"
          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div
        role="tablist"
        aria-label="Settings sections"
        aria-orientation="horizontal"
        data-testid="settings-section-tabs"
        className="mt-3 flex max-w-full gap-1 overflow-x-auto pb-1 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:pb-0"
      >
        {filteredItems.map((item, index) => (
          <button
            key={item.id}
            id={`settings-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={activeSection === item.id}
            aria-controls="settings-section-panel"
            tabIndex={activeSection === item.id ? 0 : -1}
            data-testid={`settings-tab-${item.id}`}
            onClick={() => onSectionChange(item.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                moveFocus(index, 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                moveFocus(index, -1);
              } else if (event.key === "Home") {
                event.preventDefault();
                onSectionChange(filteredItems[0].id);
                document.getElementById(`settings-tab-${filteredItems[0].id}`)?.focus();
              } else if (event.key === "End") {
                event.preventDefault();
                const last = filteredItems[filteredItems.length - 1];
                onSectionChange(last.id);
                document.getElementById(`settings-tab-${last.id}`)?.focus();
              }
            }}
            className={`min-h-10 shrink-0 rounded-lg px-3 text-left text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring sm:w-full ${
              activeSection === item.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
        {!filteredItems.length && (
          <p role="status" data-testid="settings-no-search-results" className="px-2 py-3 text-xs text-muted-foreground">
            No settings sections match that search.
          </p>
        )}
      </div>
    </nav>
  );
}
