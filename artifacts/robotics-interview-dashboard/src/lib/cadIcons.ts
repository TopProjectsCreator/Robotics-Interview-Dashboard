import {
  Box,
  Boxes,
  Bot,
  CircleDot,
  Component,
  Cpu,
  Cog,
  Drill,
  FolderTree,
  Lightbulb,
  Rocket,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { CadIcon } from "@workspace/api-client-react";

export const CAD_ICON_OPTIONS: { id: CadIcon; label: string; Icon: LucideIcon }[] = [
  { id: "boxes", label: "Robot stack", Icon: Boxes },
  { id: "box", label: "Cube", Icon: Box },
  { id: "bot", label: "Robot", Icon: Bot },
  { id: "cog", label: "Gear", Icon: Cog },
  { id: "wrench", label: "Wrench", Icon: Wrench },
  { id: "cpu", label: "Processor", Icon: Cpu },
  { id: "rocket", label: "Rocket", Icon: Rocket },
  { id: "lightbulb", label: "Idea", Icon: Lightbulb },
  { id: "component", label: "Component", Icon: Component },
  { id: "drill", label: "Drill", Icon: Drill },
  { id: "circle-dot", label: "Target", Icon: CircleDot },
  { id: "folder-tree", label: "Folder tree", Icon: FolderTree },
];

export const DEFAULT_CAD_ICON_IDS: CadIcon[] = CAD_ICON_OPTIONS.map(({ id }) => id);

export function cadIconComponent(icon: CadIcon): LucideIcon {
  return CAD_ICON_OPTIONS.find((option) => option.id === icon)?.Icon ?? Boxes;
}
