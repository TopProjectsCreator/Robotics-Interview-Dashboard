export type TeamNameRule = {
  matchType: "contains" | "startsWith" | "endsWith" | "exact";
  text: string;
};

function normalizeNameText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const descriptions: Record<TeamNameRule["matchType"], (text: string) => string> = {
  contains: (text) => `Names containing “${text}” aren't allowed by this team.`,
  startsWith: (text) => `Names starting with “${text}” aren't allowed by this team.`,
  endsWith: (text) => `Names ending with “${text}” aren't allowed by this team.`,
  exact: (text) => `“${text}” isn't allowed as a name for this team.`,
};

export function validateTeamNameRules(name: string, rules: readonly TeamNameRule[]): string | null {
  const candidate = normalizeNameText(name);
  for (const rule of rules) {
    const text = normalizeNameText(rule.text);
    if (!text) continue;

    let matches: boolean;
    switch (rule.matchType) {
      case "contains":
        matches = candidate.includes(text);
        break;
      case "startsWith":
        matches = candidate.startsWith(text);
        break;
      case "endsWith":
        matches = candidate.endsWith(text);
        break;
      case "exact":
        matches = candidate === text;
        break;
      default:
        throw new TypeError("Unsupported team name rule match type.");
    }

    if (matches) return `${descriptions[rule.matchType](rule.text.trim())} Choose a different name.`;
  }
  return null;
}
