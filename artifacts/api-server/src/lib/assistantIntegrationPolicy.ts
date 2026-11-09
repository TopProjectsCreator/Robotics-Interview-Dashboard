import { pool } from "@workspace/db";
import { normalizePublicGitHubRepositoryUrl } from "./assistantGitHub";

export type AssistantIntegrationPolicy = {
  blockedMcpServers: string[];
  blockedGithubRepositories: string[];
  updatedAt: Date | null;
};

export const ON_SHAPE_MCP_SERVER_ID = "onshape";

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function normalizeMcpServerIdentifier(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 2048) return null;
  const candidate = value.trim();
  if (candidate.toLowerCase() === ON_SHAPE_MCP_SERVER_ID) return ON_SHAPE_MCP_SERVER_ID;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.hash) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeBlockedMcpServers(values: unknown): string[] | null {
  if (!Array.isArray(values) || values.length > 100) return null;
  const normalized = values.map(normalizeMcpServerIdentifier);
  if (normalized.some((value) => value === null)) return null;
  const result = unique(normalized as string[]);
  return result.length === values.length ? result : null;
}

export function normalizeBlockedGithubRepositories(values: unknown): string[] | null {
  if (!Array.isArray(values) || values.length > 100) return null;
  const normalized = values.map(normalizePublicGitHubRepositoryUrl);
  if (normalized.some((value) => value === null)) return null;
  const result = unique(normalized as string[]);
  return result.length === values.length ? result : null;
}

export function parseAssistantIntegrationPolicyRow(row: {
  blocked_mcp_servers?: unknown;
  blocked_github_repositories?: unknown;
  updated_at?: Date | string | null;
} | undefined): AssistantIntegrationPolicy {
  if (!row) return { blockedMcpServers: [], blockedGithubRepositories: [], updatedAt: null };
  const blockedMcpServers = normalizeBlockedMcpServers(row.blocked_mcp_servers);
  const blockedGithubRepositories = normalizeBlockedGithubRepositories(row.blocked_github_repositories);
  if (!blockedMcpServers || !blockedGithubRepositories) {
    throw new Error("The team integration policy is invalid. An admin must review the saved blocks.");
  }
  const updatedAt = row?.updated_at ? new Date(row.updated_at) : null;
  return {
    blockedMcpServers,
    blockedGithubRepositories,
    updatedAt: updatedAt && Number.isFinite(updatedAt.getTime()) ? updatedAt : null,
  };
}

export async function getAssistantIntegrationPolicy(teamId: string): Promise<AssistantIntegrationPolicy> {
  const result = await pool.query(
    `select blocked_mcp_servers, blocked_github_repositories, updated_at
       from assistant_integration_policies where team_id = $1`,
    [teamId],
  );
  return parseAssistantIntegrationPolicyRow(result.rows[0] as Parameters<typeof parseAssistantIntegrationPolicyRow>[0]);
}

export async function saveAssistantIntegrationPolicy(
  teamId: string,
  input: { blockedMcpServers: string[]; blockedGithubRepositories: string[] },
): Promise<AssistantIntegrationPolicy> {
  const result = await pool.query(
    `insert into assistant_integration_policies
       (team_id, blocked_mcp_servers, blocked_github_repositories, updated_at)
     values ($1, $2::jsonb, $3::jsonb, now())
     on conflict (team_id) do update set
       blocked_mcp_servers = excluded.blocked_mcp_servers,
       blocked_github_repositories = excluded.blocked_github_repositories,
       updated_at = now()
     returning blocked_mcp_servers, blocked_github_repositories, updated_at`,
    [teamId, JSON.stringify(input.blockedMcpServers), JSON.stringify(input.blockedGithubRepositories)],
  );
  return parseAssistantIntegrationPolicyRow(result.rows[0] as Parameters<typeof parseAssistantIntegrationPolicyRow>[0]);
}

export function isMcpServerBlocked(policy: AssistantIntegrationPolicy, identifier: unknown): boolean {
  const normalized = normalizeMcpServerIdentifier(identifier);
  return normalized !== null && policy.blockedMcpServers.includes(normalized);
}

export function withoutBlockedGithubSkills<T extends { githubRepositoryUrl?: string | null }>(
  skills: T[],
  policy: AssistantIntegrationPolicy,
): T[] {
  const blocked = new Set(policy.blockedGithubRepositories);
  return skills.filter((skill) => {
    if (!skill.githubRepositoryUrl) return true;
    return !blocked.has(normalizePublicGitHubRepositoryUrl(skill.githubRepositoryUrl) ?? "");
  });
}
