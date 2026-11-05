export type CustomWorkspaceTab = {
  id: string;
  label: string;
};

const MAX_TABS = 12;
const MAX_MANIFEST_BYTES = 16_000;
const TAB_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function parseCustomWorkspaceTabs(raw: unknown): CustomWorkspaceTab[] {
  if (typeof raw !== "string" || Buffer.byteLength(raw, "utf8") > MAX_MANIFEST_BYTES) return [];

  let manifest: unknown;
  try {
    manifest = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!manifest || typeof manifest !== "object" || !Array.isArray((manifest as { tabs?: unknown }).tabs)) {
    return [];
  }

  const tabs = (manifest as { tabs: unknown[] }).tabs;
  if (tabs.length < 2 || tabs.length > MAX_TABS) return [];

  const seen = new Set<string>();
  const parsed: CustomWorkspaceTab[] = [];
  for (const value of tabs) {
    if (!value || typeof value !== "object") return [];
    const { id, label } = value as { id?: unknown; label?: unknown };
    if (
      typeof id !== "string" ||
      id.length > 40 ||
      !TAB_ID_PATTERN.test(id) ||
      seen.has(id) ||
      typeof label !== "string" ||
      label.trim().length === 0 ||
      label.trim().length > 40 ||
      CONTROL_CHARACTERS.test(label)
    ) {
      return [];
    }
    seen.add(id);
    parsed.push({ id, label: label.trim() });
  }

  return parsed;
}
