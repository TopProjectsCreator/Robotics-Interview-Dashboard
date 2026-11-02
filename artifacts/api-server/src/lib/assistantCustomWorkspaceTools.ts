import { createHash, randomUUID } from "node:crypto";
import { DEFAULT_TEAM_ID, pool } from "@workspace/db";
import { accountById } from "./interviewerAccounts";
import { teamSqlCondition } from "./teams";

export type WorkspaceToolField = {
  type: "string" | "number" | "integer" | "boolean";
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
};

export type WorkspaceToolDeclaration = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  intent: "read" | "write";
  inputSchema: {
    type: "object";
    properties: Record<string, WorkspaceToolField>;
    required: string[];
    additionalProperties: false;
  };
  operation: "list" | "get" | "create" | "update" | "delete";
  recordIdArgument?: string;
  fields?: Record<string, string>;
};

type WorkspaceToolSource = {
  id: string;
  title: string;
  status: string;
  capabilities: string[];
  createdBy: string;
  accessMode: "team" | "owner" | "selected";
  allowedInterviewerIds: string[];
  assistantTools: WorkspaceToolDeclaration[];
};

export const CUSTOM_WORKSPACE_TOOL_NAME_PATTERN = /^cw_[a-f0-9]{16}_[a-z][a-z0-9_]{0,31}$/;
export const CUSTOM_WORKSPACE_RESERVED_ACTIONS = new Set([
  "list_records", "get_record", "create_record", "update_record", "delete_record",
]);
const MAX_DECLARATIONS = 24;
const MAX_SCHEMA_BYTES = 12_000;
const MAX_ARGUMENT_BYTES = 16_000;
const MAX_RECORD_BYTES = 16_000;
const MAX_RESULT_BYTES = 30_000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function workspaceAssistantToolName(workspaceId: string, action: string): string {
  const workspaceHash = createHash("sha256").update(workspaceId).digest("hex").slice(0, 16);
  return `cw_${workspaceHash}_${action}`;
}

function validationError(message: string): Error {
  const error = new Error(message);
  error.name = "WorkspaceToolValidationError";
  return error;
}

export function validateWorkspaceToolDeclarations(
  value: unknown,
  existing: WorkspaceToolDeclaration[] = [],
): WorkspaceToolDeclaration[] {
  if (!Array.isArray(value) || value.length > MAX_DECLARATIONS) {
    throw validationError(`Provide at most ${MAX_DECLARATIONS} assistant actions.`);
  }
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_SCHEMA_BYTES) {
    throw validationError("Assistant action definitions must be 12 KB or smaller.");
  }
  const existingById = new Map(existing.map((item) => [item.id, item]));
  const ids = new Set<string>();
  const names = new Set<string>();
  return value.map((raw, index) => {
    if (!isPlainObject(raw)) throw validationError(`Action ${index + 1} must be an object.`);
    if (Object.keys(raw).some((key) => ![
      "id", "name", "description", "enabled", "intent", "inputSchema", "operation", "recordIdArgument", "fields",
    ].includes(key))) {
      throw validationError(`Action ${index + 1} contains an unsupported setting.`);
    }
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(name) || CUSTOM_WORKSPACE_RESERVED_ACTIONS.has(name)) {
      throw validationError(`Action ${index + 1} needs a unique lowercase name (letters, numbers, underscores; 32 characters maximum).`);
    }
    if (names.has(name)) throw validationError(`The action name "${name}" is used more than once.`);
    names.add(name);
    const description = typeof raw.description === "string" ? raw.description.trim() : "";
    if (!description || description.length > 240) {
      throw validationError(`Action "${name}" needs a description of 1–240 characters.`);
    }
    const operation = raw.operation;
    if (!["list", "get", "create", "update", "delete"].includes(String(operation))) {
      throw validationError(`Action "${name}" must use a supported workspace data operation.`);
    }
    const intent = raw.intent;
    const expectedIntent = operation === "create" || operation === "update" || operation === "delete" ? "write" : "read";
    if (intent !== expectedIntent) {
      throw validationError(`Action "${name}" must be marked ${expectedIntent} because it ${expectedIntent === "write" ? "changes" : "only reads"} data.`);
    }

    const schema = raw.inputSchema;
    if (!isPlainObject(schema) || schema.type !== "object" || schema.additionalProperties !== false ||
      !isPlainObject(schema.properties) || !Array.isArray(schema.required)) {
      throw validationError(`Action "${name}" needs an object input schema with additional properties disabled.`);
    }
    if (Object.keys(schema).some((key) => !["type", "properties", "required", "additionalProperties"].includes(key))) {
      throw validationError(`Action "${name}" input schema contains an unsupported setting.`);
    }
    const propertyEntries = Object.entries(schema.properties);
    if (propertyEntries.length > 12) throw validationError(`Action "${name}" can have at most 12 input fields.`);
    const properties: Record<string, WorkspaceToolField> = {};
    for (const [key, field] of propertyEntries) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) || !isPlainObject(field)) {
        throw validationError(`Action "${name}" has an invalid input field name or definition.`);
      }
      const type = field.type;
      if (Object.keys(field).some((item) => ![
        "type", "description", "enum", "minimum", "maximum", "minLength", "maxLength",
      ].includes(item))) {
        throw validationError(`Field "${key}" in "${name}" contains an unsupported setting.`);
      }
      if (type !== "string" && type !== "number" && type !== "integer" && type !== "boolean") {
        throw validationError(`Field "${key}" in "${name}" must be a string, number, integer, or boolean.`);
      }
      const normalized: WorkspaceToolField = { type };
      if (field.description !== undefined) {
        if (typeof field.description !== "string" || field.description.length > 160) {
          throw validationError(`Field "${key}" in "${name}" has an invalid description.`);
        }
        normalized.description = field.description;
      }
      if (field.enum !== undefined) {
        if (type !== "string" || !Array.isArray(field.enum) || field.enum.length < 1 || field.enum.length > 20 ||
          field.enum.some((item) => typeof item !== "string" || item.length > 80) ||
          new Set(field.enum).size !== field.enum.length) {
          throw validationError(`Field "${key}" in "${name}" has an invalid choice list.`);
        }
        normalized.enum = field.enum as string[];
      }
      for (const bound of ["minimum", "maximum", "minLength", "maxLength"] as const) {
        const boundValue = field[bound];
        if (boundValue === undefined) continue;
        if (typeof boundValue !== "number" || !Number.isInteger(boundValue) || (bound === "minLength" || bound === "maxLength"
          ? boundValue < 0 || boundValue > 2000
          : Math.abs(boundValue as number) > 1_000_000_000)) {
          throw validationError(`Field "${key}" in "${name}" has an invalid ${bound}.`);
        }
        normalized[bound] = boundValue as number;
      }
      if (
        (normalized.minimum !== undefined && normalized.maximum !== undefined && normalized.minimum > normalized.maximum) ||
        (normalized.minLength !== undefined && normalized.maxLength !== undefined && normalized.minLength > normalized.maxLength) ||
        ((type !== "string") && (normalized.minLength !== undefined || normalized.maxLength !== undefined)) ||
        ((type !== "number" && type !== "integer") && (normalized.minimum !== undefined || normalized.maximum !== undefined)) ||
        ((type === "boolean" || normalized.enum) &&
          (normalized.minimum !== undefined || normalized.maximum !== undefined || normalized.minLength !== undefined || normalized.maxLength !== undefined))
      ) {
        throw validationError(`Field "${key}" in "${name}" has conflicting constraints.`);
      }
      properties[key] = normalized;
    }
    const required = schema.required;
    if (required.length > propertyEntries.length ||
      required.some((key) => typeof key !== "string" || !Object.hasOwn(properties, key)) ||
      new Set(required).size !== required.length) {
      throw validationError(`Action "${name}" has invalid required input fields.`);
    }

    let recordIdArgument: string | undefined;
    if (operation === "get" || operation === "update" || operation === "delete") {
      recordIdArgument = typeof raw.recordIdArgument === "string" ? raw.recordIdArgument : "";
      if (!Object.hasOwn(properties, recordIdArgument) || properties[recordIdArgument].type !== "string" ||
        !required.includes(recordIdArgument)) {
        throw validationError(`Action "${name}" must map a required string input to the workspace record ID.`);
      }
    } else if (raw.recordIdArgument !== undefined) {
      throw validationError(`Action "${name}" cannot map a record ID for the ${operation} operation.`);
    }

    let fields: Record<string, string> | undefined;
    if (operation === "create" || operation === "update") {
      if (!isPlainObject(raw.fields) || Object.keys(raw.fields).length < 1 || Object.keys(raw.fields).length > 12) {
        throw validationError(`Action "${name}" must map 1–12 input fields into the saved record.`);
      }
      fields = {};
      const mappedFields = fields;
      const recordNames = new Set<string>();
      for (const [argumentName, recordName] of Object.entries(raw.fields)) {
        if (!Object.hasOwn(properties, argumentName) ||
          typeof recordName !== "string" ||
          !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(recordName) ||
          recordName === "__proto__" || recordName === "constructor") {
          throw validationError(`Action "${name}" contains an invalid record field mapping.`);
        }
        if (recordNames.has(recordName)) throw validationError(`Action "${name}" maps multiple inputs to the same record field.`);
        recordNames.add(recordName);
        mappedFields[argumentName] = recordName;
      }
      const expectedArguments = Object.keys(properties).filter((key) => key !== recordIdArgument);
      if (expectedArguments.length !== Object.keys(mappedFields).length ||
        expectedArguments.some((key) => !Object.hasOwn(mappedFields, key))) {
        throw validationError(`Action "${name}" must map every non-ID input to a saved record field.`);
      }
    } else if (raw.fields !== undefined) {
      throw validationError(`Action "${name}" cannot map record fields for the ${operation} operation.`);
    }
    if ((operation === "list" || operation === "get" || operation === "delete") &&
      Object.keys(properties).some((key) => key !== recordIdArgument)) {
      throw validationError(`Action "${name}" has input fields that its ${operation} operation cannot use.`);
    }

    const id = typeof raw.id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(raw.id)
      ? raw.id
      : randomUUID();
    if (ids.has(id)) throw validationError(`Action "${name}" repeats a saved action ID.`);
    ids.add(id);
    const previous = existingById.get(id);
    if (previous && previous.name !== name && names.has(previous.name)) {
      throw validationError(`Action "${name}" conflicts with another saved action.`);
    }
    return {
      id,
      name,
      description,
      enabled: raw.enabled === true,
      intent: expectedIntent,
      inputSchema: { type: "object", properties, required: [...required] as string[], additionalProperties: false },
      operation: operation as WorkspaceToolDeclaration["operation"],
      ...(recordIdArgument ? { recordIdArgument } : {}),
      ...(fields ? { fields } : {}),
    };
  });
}

function isWorkspaceAccessible(workspace: WorkspaceToolSource, accountId: string): boolean {
  return workspace.status === "published" && (
    workspace.accessMode === "team" ||
    (workspace.accessMode === "owner" && workspace.createdBy === accountId) ||
    (workspace.accessMode === "selected" && workspace.allowedInterviewerIds.includes(accountId))
  );
}

const standardWorkspaceActions = [
  {
    action: "list_records",
    label: "List workspace records",
    description: "Read recent records saved by this custom workspace. Results are limited to 50 records.",
    write: false,
    parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50 } }, additionalProperties: false },
  },
  {
    action: "get_record",
    label: "Read a workspace record",
    description: "Read one record by its exact ID from this custom workspace.",
    write: false,
    parameters: { type: "object", properties: { recordId: { type: "string", minLength: 1, maxLength: 64 } }, required: ["recordId"], additionalProperties: false },
  },
  {
    action: "create_record",
    label: "Create a workspace record",
    description: "Save one record in this custom workspace. Use only when the user asks to create or save data.",
    write: true,
    parameters: { type: "object", properties: { record: { type: "object", additionalProperties: true } }, required: ["record"], additionalProperties: false },
  },
  {
    action: "update_record",
    label: "Update a workspace record",
    description: "Replace one record in this custom workspace by exact ID. Use only when the user asks to change data.",
    write: true,
    parameters: { type: "object", properties: { recordId: { type: "string", minLength: 1, maxLength: 64 }, record: { type: "object", additionalProperties: true } }, required: ["recordId", "record"], additionalProperties: false },
  },
  {
    action: "delete_record",
    label: "Delete a workspace record",
    description: "Permanently delete one record from this custom workspace by exact ID. Use only when the user explicitly asks.",
    write: true,
    parameters: { type: "object", properties: { recordId: { type: "string", minLength: 1, maxLength: 64 } }, required: ["recordId"], additionalProperties: false },
  },
] as const;

export type AssistantCustomWorkspaceTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export async function listAssistantCustomWorkspaceTools(
  accountId: string,
  teamId: string,
): Promise<AssistantCustomWorkspaceTool[]> {
  const account = await accountById(accountId);
  if (!account || account.role !== "coordinator" ||
    (account.teamId && account.teamId !== teamId) || (!account.teamId && teamId !== DEFAULT_TEAM_ID)) return [];
  const result = await pool.query<WorkspaceToolSource>(
    `select "id", "title", "status", "capabilities", "created_by" as "createdBy",
            "access_mode" as "accessMode", "allowed_interviewer_ids" as "allowedInterviewerIds",
            "assistant_tools" as "assistantTools"
       from "custom_workspaces"
      where ${teamSqlCondition('"team_id"', "$1")} and "status" = 'published'`,
    [teamId],
  );
  const tools: AssistantCustomWorkspaceTool[] = [];
  for (const workspace of result.rows) {
    if (!isWorkspaceAccessible(workspace, accountId) || !workspace.capabilities.includes("data")) continue;
    const prefix = workspaceAssistantToolName(workspace.id, "list_records").replace(/_list_records$/, "_");
    for (const item of standardWorkspaceActions) {
      tools.push({
        type: "function",
        function: {
          name: `${prefix}${item.action}`,
          description: `${item.write ? "[Changes data]" : "[Read-only]"} ${item.description} Workspace: ${workspace.title.slice(0, 100)}.`,
          parameters: item.parameters,
        },
      });
    }
    let declarations: WorkspaceToolDeclaration[] = [];
    try {
      declarations = validateWorkspaceToolDeclarations(workspace.assistantTools ?? []);
    } catch {
      continue;
    }
    for (const declaration of declarations) {
      if (!declaration?.enabled) continue;
      tools.push({
        type: "function",
        function: {
          name: workspaceAssistantToolName(workspace.id, declaration.name),
          description: `${declaration.intent === "write" ? "[Changes data]" : "[Read-only]"} ${declaration.description} Workspace: ${workspace.title.slice(0, 100)}.`,
          parameters: declaration.inputSchema,
        },
      });
    }
  }
  return tools;
}

function validateArguments(
  args: Record<string, unknown>,
  declaration: WorkspaceToolDeclaration,
): string | null {
  if (Buffer.byteLength(JSON.stringify(args), "utf8") > MAX_ARGUMENT_BYTES) return "Input is larger than 16 KB.";
  const allowed = new Set(Object.keys(declaration.inputSchema.properties));
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) return `Unexpected input field "${key}".`;
  }
  for (const key of declaration.inputSchema.required) {
    if (!Object.hasOwn(args, key)) return `Required input "${key}" is missing.`;
  }
  for (const [key, field] of Object.entries(declaration.inputSchema.properties)) {
    const value = args[key];
    if (value === undefined) continue;
    if (field.type === "string" && typeof value !== "string") return `Input "${key}" must be text.`;
    if (field.type === "boolean" && typeof value !== "boolean") return `Input "${key}" must be true or false.`;
    if ((field.type === "number" || field.type === "integer") &&
      (typeof value !== "number" || !Number.isFinite(value) || (field.type === "integer" && !Number.isInteger(value)))) {
      return `Input "${key}" must be a valid ${field.type}.`;
    }
    if (typeof value === "string") {
      if (field.minLength !== undefined && value.length < field.minLength) return `Input "${key}" is too short.`;
      if (field.maxLength !== undefined && value.length > field.maxLength) return `Input "${key}" is too long.`;
      if (field.enum && !field.enum.includes(value)) return `Input "${key}" is not one of the allowed choices.`;
    }
    if (typeof value === "number") {
      if (field.minimum !== undefined && value < field.minimum) return `Input "${key}" is below its minimum.`;
      if (field.maximum !== undefined && value > field.maximum) return `Input "${key}" is above its maximum.`;
    }
  }
  return null;
}

function boundedResult(value: unknown): string {
  const encoded = JSON.stringify(value);
  return Buffer.byteLength(encoded, "utf8") <= MAX_RESULT_BYTES
    ? encoded
    : JSON.stringify({ error: "The workspace returned too much data to show in one assistant result." });
}

export async function runAssistantCustomWorkspaceTool(
  name: string,
  args: Record<string, unknown>,
  context: { accountId: string; teamId: string },
): Promise<{ content: string; detail: string } | null> {
  if (!CUSTOM_WORKSPACE_TOOL_NAME_PATTERN.test(name)) return null;
  if (!isPlainObject(args)) {
    return { content: "The workspace action input must be a JSON object. No data was changed.", detail: "invalid workspace action arguments" };
  }
  const account = await accountById(context.accountId);
  if (!account || account.role !== "coordinator" || (account.teamId && account.teamId !== context.teamId) ||
    (!account.teamId && context.teamId !== DEFAULT_TEAM_ID)) {
    return { content: "Your account is no longer available in this team. No workspace data was changed.", detail: "workspace account unavailable" };
  }
  const workspaceResult = await pool.query<WorkspaceToolSource>(
    `select "id", "title", "status", "capabilities", "created_by" as "createdBy",
            "access_mode" as "accessMode", "allowed_interviewer_ids" as "allowedInterviewerIds",
            "assistant_tools" as "assistantTools"
       from "custom_workspaces"
      where ${teamSqlCondition('"team_id"', "$1")} and "status" = 'published'`,
    [context.teamId],
  );
  const toolPrefix = name.slice(0, 20);
  const workspace = workspaceResult.rows.find((item) =>
    isWorkspaceAccessible(item, context.accountId) &&
    item.capabilities.includes("data") &&
    workspaceAssistantToolName(item.id, "list_records").slice(0, 20) === toolPrefix,
  );
  if (!workspace) return { content: "That custom workspace is unavailable or you no longer have access. No data was changed.", detail: "workspace access denied" };
  const action = name.slice(20);
  const standard = standardWorkspaceActions.find((item) => item.action === action);
  let declarations: WorkspaceToolDeclaration[] = [];
  try {
    declarations = validateWorkspaceToolDeclarations(workspace.assistantTools ?? []);
  } catch {
    return { content: "This workspace has an invalid saved action definition. No data was changed.", detail: "workspace action definition invalid" };
  }
  const declaration = declarations.find((item) => item.name === action && item.enabled);
  let operation: WorkspaceToolDeclaration["operation"];
  let operationDeclaration: WorkspaceToolDeclaration;
  if (standard) {
    operation = standard.action.replace(/_records?$/, "") as WorkspaceToolDeclaration["operation"];
    const standardSchema: WorkspaceToolDeclaration["inputSchema"] = standard.action === "list_records"
      ? { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50 } }, required: [], additionalProperties: false }
      : standard.action === "get_record" || standard.action === "delete_record"
        ? { type: "object", properties: { recordId: { type: "string", maxLength: 64 } }, required: ["recordId"], additionalProperties: false }
        : standard.action === "create_record"
          ? { type: "object", properties: { record: { type: "object" } as unknown as WorkspaceToolField }, required: ["record"], additionalProperties: false }
          : { type: "object", properties: { recordId: { type: "string", maxLength: 64 }, record: { type: "object" } as unknown as WorkspaceToolField }, required: ["recordId", "record"], additionalProperties: false };
    operationDeclaration = {
      id: `standard:${action}`,
      name: action,
      description: standard.description,
      enabled: true,
      intent: standard.write ? "write" : "read",
      inputSchema: standardSchema,
      operation,
      ...(["get", "update", "delete"].includes(operation) ? { recordIdArgument: "recordId" } : {}),
      ...(["create", "update"].includes(operation) ? { fields: { record: "__whole_record__" } } : {}),
    };
  } else if (declaration) {
    operation = declaration.operation;
    operationDeclaration = declaration;
  } else {
    return { content: "This workspace action is disabled or no longer exists. No data was changed.", detail: "workspace tool disabled or removed" };
  }
  const invalid = standard
    ? validateStandardArguments(args, action)
    : validateArguments(args, operationDeclaration);
  if (invalid) return { content: `The workspace action input was rejected: ${invalid}`, detail: `invalid input for ${action}` };
  const teamId = context.teamId;
  const workspaceId = workspace.id;
  try {
    if (operation === "list") {
      const limit = standard ? Math.max(1, Math.min(50, Number(args.limit) || 50)) : 50;
      const result = await pool.query(
        `select "id", "value", "created_at" as "createdAt", "updated_at" as "updatedAt"
           from "custom_workspace_data"
          where "workspace_id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
          order by "updated_at" desc limit $3`,
        [workspaceId, teamId, limit],
      );
      const records: unknown[] = [];
      for (const row of result.rows) {
        const next = [...records, row];
        if (Buffer.byteLength(JSON.stringify({ records: next }), "utf8") > MAX_RESULT_BYTES) break;
        records.push(row);
      }
      return { content: boundedResult({ records, truncated: records.length < result.rows.length }), detail: `read ${records.length} records from ${workspace.title}` };
    }

    if (operation === "get") {
      const id = String(args[operationDeclaration.recordIdArgument ?? ""] ?? "");
      const result = await pool.query(
        `select "id", "value", "created_at" as "createdAt", "updated_at" as "updatedAt"
           from "custom_workspace_data"
          where "id" = $1 and "workspace_id" = $2 and ${teamSqlCondition('"team_id"', "$3")} limit 1`,
        [id, workspaceId, teamId],
      );
      return result.rows[0]
        ? { content: boundedResult(result.rows[0]), detail: `read a record from ${workspace.title}` }
        : { content: "No record with that ID exists in this workspace.", detail: "workspace record not found" };
    }

    const record = operation === "create" || operation === "update"
      ? operationDeclaration.fields?.record === "__whole_record__"
        ? args.record
        : Object.fromEntries(Object.entries(operationDeclaration.fields ?? {}).map(([argument, recordKey]) => [recordKey, args[argument]]))
      : undefined;
    if (record !== undefined && (!isPlainObject(record) || Object.keys(record).length === 0 ||
      Buffer.byteLength(JSON.stringify(record), "utf8") > MAX_RECORD_BYTES)) {
      return { content: "The workspace record must be a non-empty object smaller than 16 KB.", detail: `invalid record for ${action}` };
    }
    if (operation === "create") {
      const result = await pool.query(
        `insert into "custom_workspace_data" ("id", "team_id", "workspace_id", "value")
         values ($1, $2, $3, $4::jsonb)
         returning "id", "value", "created_at" as "createdAt", "updated_at" as "updatedAt"`,
        [randomUUID(), teamId, workspaceId, JSON.stringify(record)],
      );
      return { content: boundedResult(result.rows[0]), detail: `created a record in ${workspace.title}` };
    }
    if (operation === "update") {
      const id = String(args[operationDeclaration.recordIdArgument ?? ""] ?? "");
      const result = await pool.query(
        `update "custom_workspace_data" set "value" = $3::jsonb, "updated_at" = now()
          where "id" = $1 and "workspace_id" = $2 and ${teamSqlCondition('"team_id"', "$4")}
          returning "id", "value", "created_at" as "createdAt", "updated_at" as "updatedAt"`,
        [id, workspaceId, JSON.stringify(record), teamId],
      );
      return result.rows[0]
        ? { content: boundedResult(result.rows[0]), detail: `updated a record in ${workspace.title}` }
        : { content: "No record with that ID exists in this workspace. Nothing was changed.", detail: "workspace record not found for update" };
    }
    const id = String(args[operationDeclaration.recordIdArgument ?? ""] ?? "");
    const result = await pool.query(
      `delete from "custom_workspace_data"
        where "id" = $1 and "workspace_id" = $2 and ${teamSqlCondition('"team_id"', "$3")}
        returning "id"`,
      [id, workspaceId, teamId],
    );
    return result.rowCount
      ? { content: JSON.stringify({ deleted: true, id }), detail: `deleted a record from ${workspace.title}` }
      : { content: "No record with that ID exists in this workspace. Nothing was changed.", detail: "workspace record not found for delete" };
  } catch {
    return { content: "The workspace data operation failed. No successful result was confirmed.", detail: `workspace ${operation} failed` };
  }
}

function validateStandardArguments(args: Record<string, unknown>, action: string): string | null {
  const allowed = action === "list_records" ? ["limit"]
    : action === "create_record" ? ["record"]
      : ["recordId", ...(action === "update_record" ? ["record"] : [])];
  if (Buffer.byteLength(JSON.stringify(args), "utf8") > MAX_ARGUMENT_BYTES) return "Input is larger than 16 KB.";
  if (Object.keys(args).some((key) => !allowed.includes(key))) return "Input contains an unsupported field.";
  if (action === "list_records" && args.limit !== undefined &&
    (!Number.isInteger(args.limit) || Number(args.limit) < 1 || Number(args.limit) > 50)) {
    return "Input \"limit\" must be an integer from 1 to 50.";
  }
  if (["get_record", "update_record", "delete_record"].includes(action) &&
    (typeof args.recordId !== "string" || !args.recordId.length || args.recordId.length > 64)) {
    return "Input \"recordId\" must be a non-empty ID up to 64 characters.";
  }
  if (["create_record", "update_record"].includes(action) && !isPlainObject(args.record)) {
    return "Input \"record\" must be an object.";
  }
  return null;
}
