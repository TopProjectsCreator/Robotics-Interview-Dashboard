import { CadIcon } from "@workspace/api-zod";

export const DEFAULT_CAD_ICONS = [
  CadIcon.boxes,
  CadIcon.box,
  CadIcon.bot,
  CadIcon.cog,
  CadIcon.wrench,
  CadIcon.cpu,
  CadIcon.rocket,
  CadIcon.lightbulb,
  CadIcon.component,
  CadIcon.drill,
  CadIcon["circle-dot"],
  CadIcon["folder-tree"],
] as const;

export const CAD_ICON_IDS = Object.values(CadIcon);
export type CadIconId = (typeof CAD_ICON_IDS)[number];
const CAD_ICON_ID_SET = new Set<string>(CAD_ICON_IDS);

export function normalizeCadIcons(value: unknown): CadIconId[] {
  if (!Array.isArray(value)) return [...DEFAULT_CAD_ICONS];
  const normalized = [...new Set(value.filter((icon): icon is CadIconId =>
    typeof icon === "string" && CAD_ICON_ID_SET.has(icon),
  ))];
  return normalized.length > 0 ? normalized : [...DEFAULT_CAD_ICONS];
}
