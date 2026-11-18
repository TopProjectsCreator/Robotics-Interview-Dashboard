import {
  Box,
  Boxes,
  Bot,
  Activity,
  BatteryCharging,
  Cable,
  CircleDot,
  Component,
  CircuitBoard,
  Cpu,
  Cog,
  Drill,
  Fan,
  FolderTree,
  Gauge,
  Joystick,
  Lightbulb,
  Magnet,
  Radar,
  Radio,
  Rocket,
  Satellite,
  ScanLine,
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
  { id: "activity", label: "Activity", Icon: Activity },
  { id: "battery-charging", label: "Battery", Icon: BatteryCharging },
  { id: "cable", label: "Cable", Icon: Cable },
  { id: "circuit-board", label: "Circuit board", Icon: CircuitBoard },
  { id: "fan", label: "Fan", Icon: Fan },
  { id: "gauge", label: "Gauge", Icon: Gauge },
  { id: "joystick", label: "Joystick", Icon: Joystick },
  { id: "magnet", label: "Magnet", Icon: Magnet },
  { id: "radar", label: "Radar", Icon: Radar },
  { id: "radio", label: "Radio", Icon: Radio },
  { id: "satellite", label: "Satellite", Icon: Satellite },
  { id: "scan-line", label: "Scanner", Icon: ScanLine },
];

export const DEFAULT_CAD_ICON_IDS: CadIcon[] = CAD_ICON_OPTIONS.map(({ id }) => id);

export function cadIconComponent(icon: CadIcon): LucideIcon {
  return CAD_ICON_OPTIONS.find((option) => option.id === icon)?.Icon ?? Boxes;
}
