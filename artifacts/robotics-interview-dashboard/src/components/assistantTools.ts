export type AssistantToolItem = {
  name: string;
  label: string;
  hint: string;
  write: boolean;
};

export type AssistantToolGroup = {
  id: string;
  label: string;
  description: string;
  tools: AssistantToolItem[];
};

export const ASSISTANT_TOOL_GROUPS: AssistantToolGroup[] = [
  {
    id: "search",
    label: "Search & analysis",
    description: "Web, code, images, and reviewed SVG diagrams.",
    tools: [
      { name: "web_search", label: "Web search", hint: "Live web facts", write: false },
      { name: "python_exec", label: "Python", hint: "Calculations", write: false },
      { name: "generate_image", label: "Generate image", hint: "Posters & graphics", write: false },
      { name: "show_svg", label: "Show SVG", hint: "Diagrams with review", write: false },
    ],
  },
  {
    id: "applicant-read",
    label: "Applicants · read",
    description: "Look up records without changing them.",
    tools: [
      { name: "search_applicants", label: "Search applicants", hint: "Filter & list", write: false },
      { name: "get_applicant", label: "Get applicant", hint: "Full details", write: false },
      { name: "list_interviewers", label: "List interviewers", hint: "Valid labels", write: false },
      { name: "list_uploads", label: "List uploads", hint: "Roster files", write: false },
      { name: "preview_import", label: "Preview import", hint: "Dry run only", write: false },
      { name: "list_snapshots", label: "List snapshots", hint: "Saved versions", write: false },
      { name: "list_conversations", label: "List chats", hint: "Past threads", write: false },
      { name: "read_conversation", label: "Read chat", hint: "Recall context", write: false },
      { name: "list_presence", label: "List presence", hint: "Who is online", write: false },
      { name: "presence_stats", label: "Presence stats", hint: "Per-IP detail", write: false },
    ],
  },
  {
    id: "applicant-write",
    label: "Applicants · write",
    description: "Change records, queue, imports, and access.",
    tools: [
      { name: "create_applicant", label: "Create applicant", hint: "Add record", write: true },
      { name: "update_applicant", label: "Update applicant", hint: "Edit any field", write: true },
      { name: "delete_applicant", label: "Delete applicant", hint: "Irreversible", write: true },
      { name: "reorder_queue", label: "Reorder queue", hint: "Full order", write: true },
      { name: "move_applicant_in_queue", label: "Move in queue", hint: "Single move", write: true },
      { name: "transfer_interviewer", label: "Transfer interviewer", hint: "Move everyone", write: true },
      { name: "assign_interviewers", label: "Assign interviewers", hint: "Bulk assign", write: true },
      { name: "commit_import", label: "Commit import", hint: "Write roster file", write: true },
      { name: "create_snapshot", label: "Create snapshot", hint: "Save version", write: true },
      { name: "restore_snapshot", label: "Restore snapshot", hint: "Undoable restore", write: true },
      { name: "kick_presence", label: "Kick presence", hint: "Revoke login", write: true },
    ],
  },
  {
    id: "artifacts",
    label: "Boards & docs",
    description: "Whiteboards, boards, documents, sheets.",
    tools: [
      { name: "list_collaboration_artifacts", label: "List artifacts", hint: "Find by kind", write: false },
      { name: "read_collaboration_artifact", label: "Read artifact", hint: "Before editing", write: false },
      { name: "create_board", label: "Create board", hint: "Kanban tasks", write: true },
      { name: "create_document", label: "Create document", hint: "Notes & prose", write: true },
      { name: "create_spreadsheet", label: "Create spreadsheet", hint: "Workbook grid", write: true },
      { name: "create_whiteboard", label: "Create whiteboard", hint: "Freeform canvas", write: true },
      { name: "edit_board", label: "Edit board", hint: "Cards & columns", write: true },
      { name: "edit_document", label: "Edit document", hint: "Append/replace", write: true },
      { name: "edit_spreadsheet", label: "Edit spreadsheet", hint: "Cells & rows", write: true },
      { name: "edit_whiteboard", label: "Edit whiteboard", hint: "Shapes & text", write: true },
    ],
  },
  {
    id: "parts",
    label: "Parts",
    description: "Supplier search and shared inventory.",
    tools: [
      { name: "search_supplier_parts", label: "Search supplier parts", hint: "Verified pages", write: false },
      { name: "list_parts_robots", label: "List robots", hint: "Existing IDs", write: false },
      { name: "list_parts_catalog", label: "List catalog", hint: "Stock & IDs", write: false },
      { name: "create_parts_robot", label: "Create robot", hint: "Add robot", write: true },
      { name: "rename_parts_robot", label: "Rename robot", hint: "By exact ID", write: true },
      { name: "create_parts_catalog_item", label: "Create catalog item", hint: "Save part", write: true },
      { name: "update_parts_stock", label: "Update stock", hint: "Set quantity", write: true },
      { name: "set_parts_robot_allocation", label: "Set allocation", hint: "Assign to robot", write: true },
    ],
  },
  {
    id: "chat",
    label: "Chat",
    description: "Titles and model switching.",
    tools: [
      { name: "rename_conversation", label: "Rename chat", hint: "Short title", write: false },
      { name: "set_assistant_model", label: "Switch model", hint: "On request", write: false },
    ],
  },
];

export const ALL_ASSISTANT_TOOL_NAMES = ASSISTANT_TOOL_GROUPS.flatMap((group) =>
  group.tools.map((tool) => tool.name),
);

export const WRITE_TOOL_NAMES = new Set(
  ASSISTANT_TOOL_GROUPS.flatMap((group) => group.tools.filter((tool) => tool.write).map((tool) => tool.name)),
);

export const ASSISTANT_TOOLS_STORAGE_KEY = "robotics-assistant-disabled-tools";

export function normalizeDisabledTools(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(ALL_ASSISTANT_TOOL_NAMES);
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const name = entry.trim();
    if (!name || !known.has(name) || seen.has(name)) continue;
    seen.add(name);
  }
  return [...seen].sort();
}

export function loadDisabledTools(): string[] {
  try {
    const raw = window.localStorage.getItem(ASSISTANT_TOOLS_STORAGE_KEY);
    if (!raw) return [];
    return normalizeDisabledTools(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveDisabledTools(tools: string[]): void {
  try {
    window.localStorage.setItem(ASSISTANT_TOOLS_STORAGE_KEY, JSON.stringify(normalizeDisabledTools(tools)));
  } catch {
    // Storage can be unavailable in private browsing.
  }
}
