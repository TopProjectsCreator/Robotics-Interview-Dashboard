import type { Applicant } from "@workspace/db";

type AgeFilter =
  | { kind: "exact"; value: number }
  | { kind: "comparison"; operator: ">" | ">=" | "<" | "<="; value: number }
  | { kind: "range"; min: number; max: number };

type SearchField =
  | "name"
  | "age"
  | "gender"
  | "grade"
  | "skill"
  | "recommendation"
  | "category"
  | "status"
  | "invalid"
  | "text";

type SearchPredicate = {
  field: SearchField;
  value: string;
  age?: AgeFilter;
};

type SearchExpression =
  | { kind: "predicate"; predicate: SearchPredicate }
  | { kind: "and"; left: SearchExpression; right: SearchExpression }
  | { kind: "or"; left: SearchExpression; right: SearchExpression }
  | { kind: "not"; expression: SearchExpression }
  | { kind: "if"; condition: SearchExpression; consequence: SearchExpression };

export interface ApplicantSearchQuery {
  expression: SearchExpression | null;
  invalid: string[];
}

const QUALIFIER_ALIASES: Record<string, SearchField> = {
  name: "name",
  age: "age",
  gender: "gender",
  grade: "grade",
  skill: "skill",
  recommendation: "recommendation",
  recommend: "recommendation",
  category: "category",
  status: "status",
  interviewstatus: "status",
  "interview-status": "status",
  invalid: "invalid",
  "invalid-score": "invalid",
  score: "invalid",
};

const GENDER_ALIASES: Record<string, string> = {
  f: "female",
  female: "female",
  woman: "female",
  girl: "female",
  m: "male",
  male: "male",
  man: "male",
  boy: "male",
};

const SKILL_ALIASES: Record<string, string> = {
  build: "build",
  builder: "build",
  building: "build",
  code: "code",
  coding: "code",
  programmer: "code",
  programming: "code",
  cad: "cad",
  design: "cad",
  "3d": "cad",
};

function emptyQuery(): ApplicantSearchQuery {
  return { expression: null, invalid: [] };
}

function normalizeGender(value: string): string {
  const normalized = value.trim().toLowerCase();
  return GENDER_ALIASES[normalized] ?? normalized;
}

export function normalizeApplicantGender(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  return normalized ? normalizeGender(normalized) : null;
}

export function normalizeApplicantGrade(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  const match = /^(?:grade\s*)?(\d+)(?:st|nd|rd|th)?$/.exec(normalized);
  return match ? match[1] : normalized;
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseAge(value: string): AgeFilter | null {
  const normalized = value.trim();
  const exact = /^(\d+)$/.exec(normalized);
  if (exact) return { kind: "exact", value: Number(exact[1]) };
  const comparison = /^(>=|<=|>|<)\s*(\d+)$/.exec(normalized);
  if (comparison) {
    return { kind: "comparison", operator: comparison[1] as ">" | ">=" | "<" | "<=", value: Number(comparison[2]) };
  }
  const range = /^(\d+)\.\.(\d+)$/.exec(normalized);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return min <= max ? { kind: "range", min, max } : null;
  }
  return null;
}

type QueryToken = string | "(" | ")";

function tokenize(input: string): QueryToken[] {
  const tokens: QueryToken[] = [];
  let cursor = 0;
  while (cursor < input.length) {
    while (/\s/.test(input[cursor] ?? "")) cursor += 1;
    if (cursor >= input.length) break;
    if (input[cursor] === "(" || input[cursor] === ")") {
      tokens.push(input[cursor] as "(" | ")");
      cursor += 1;
      continue;
    }

    const start = cursor;
    let quoted = false;
    while (cursor < input.length) {
      const character = input[cursor];
      if (character === '"') {
        quoted = !quoted;
        cursor += 1;
        continue;
      }
      if (!quoted && (/\s/.test(character) || character === "(" || character === ")")) break;
      cursor += 1;
    }
    tokens.push(input.slice(start, cursor));
  }
  return tokens;
}

function isOperator(token: QueryToken | undefined, operator: string): boolean {
  return typeof token === "string" && token.toLowerCase() === operator;
}

function readTokenValue(raw: string): { value: string; malformed: boolean } {
  const value = raw.trim();
  if (!value.startsWith('"')) return { value, malformed: false };
  if (!value.endsWith('"') || value.length === 1) return { value: value.slice(1), malformed: true };
  return { value: value.slice(1, -1), malformed: false };
}

function searchableText(applicant: Applicant): string {
  return [
    applicant.name,
    applicant.id,
    applicant.email,
    applicant.grade,
    applicant.gender,
    applicant.roboticsExperience,
    applicant.transcript,
    applicant.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const BUILD_RES = [
  /\b(vex(\s+iq)?|fll\b|first\s+lego\s+league|lego\s+league|ftc\b|frc\b|first\s+(robotics|tech\s+challenge))\b/g,
  /\b(mindstorms|spike(\s+prime)?|ev3|nxt|tetrix|rev\s+robotics|andymark|gobilda|actobotics|mbot|elegoo)\b/g,
  /\b(build|built|building|builder|builds|assembl\w*|chassis|drivetrain|gearbox|mechanic\w*|fabricat\w*|construct\w*)\b/g,
  /\b(wiring|wired|solder\w*|power\s?tools?|drill\w*|dremel|bandsaw|lego\s+technic|robot\s+build)\b/g,
  /\brobots?\b/g,
  /\brobotics?\b/g,
];
const CODE_RES = [
  /\b(cod\w*|programming|programmers?|programmed|python|javascript|typescript|c\+\+|scratch|robotc|micropython|software|algorithms?|debugg\w*|block\s+(coding|programming|code)|code\.org)\b/g,
];
const CAD_RES = [
  /\b(cad|onshape|fusion\s?360|tinkercad|solidworks|autodesk(\s+inventor)?|inventor|freecad|sketchup)\b/g,
  /\b(3d\s+(model\w*|design\w*|print\w*|cad))\b/g,
  /\bdesigned?\s+(a\s+|the\s+)?(robot|chassis|part|bracket|mount|intake|arm|claw)\b/g,
];
const NEGATION_RE =
  /^\W*(none|n\/?a|unknown|nothing|never|no\s+(known\s+|robotics\s+|prior\s+|previous\s+)?(experience|background|idea)|not\s+(much|any|really)|nope|no\s+idea|didn'?t\s+do|haven'?t\s+done)/;

function informative(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || (trimmed.length < 120 && NEGATION_RE.test(trimmed.toLowerCase()))) return null;
  return trimmed.toLowerCase();
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((total, pattern) => {
    pattern.lastIndex = 0;
    const count = text.match(pattern)?.length ?? 0;
    pattern.lastIndex = 0;
    return total + count;
  }, 0);
}

function applicantSkill(applicant: Applicant): string | null {
  const fields = [
    applicant.roboticsExperience,
    applicant.transcript,
    applicant.aiSummary,
    applicant.aiStrengths,
    applicant.aiConcerns,
    applicant.notes,
  ]
    .map(informative)
    .filter((value): value is string => value !== null);
  let build = 0;
  let code = 0;
  let cad = 0;
  for (const field of fields) {
    build += countMatches(field, BUILD_RES);
    code += countMatches(field, CODE_RES);
    cad += countMatches(field, CAD_RES);
  }
  const best = Math.max(build, code, cad);
  if (best === 0) return null;
  return code === best ? "code" : cad === best ? "cad" : "build";
}

class SearchParser {
  private cursor = 0;

  constructor(private readonly tokens: QueryToken[], private readonly invalid: string[]) {}

  parse(): SearchExpression | null {
    if (!this.tokens.length) return null;
    const expression = this.parseIf();
    while (this.cursor < this.tokens.length) {
      this.invalid.push(String(this.tokens[this.cursor]));
      this.cursor += 1;
    }
    return expression;
  }

  private parseIf(): SearchExpression | null {
    if (!isOperator(this.tokens[this.cursor], "if")) return this.parseOr();
    this.cursor += 1;
    const condition = this.parseOr();
    if (!condition || !isOperator(this.tokens[this.cursor], "then")) {
      this.invalid.push("IF requires THEN");
      return condition;
    }
    this.cursor += 1;
    const consequence = this.parseOr();
    if (!consequence) this.invalid.push("IF requires a consequence");
    return consequence ? { kind: "if", condition, consequence } : condition;
  }

  private parseOr(): SearchExpression | null {
    let expression = this.parseAnd();
    while (isOperator(this.tokens[this.cursor], "or")) {
      this.cursor += 1;
      const right = this.parseAnd();
      if (!right) {
        this.invalid.push("OR requires a condition");
        break;
      }
      expression = expression ? { kind: "or", left: expression, right } : right;
    }
    return expression;
  }

  private parseAnd(): SearchExpression | null {
    let expression = this.parseUnary();
    while (this.cursor < this.tokens.length) {
      if (isOperator(this.tokens[this.cursor], "and")) {
        this.cursor += 1;
        const right = this.parseUnary();
        if (!right) {
          this.invalid.push("AND requires a condition");
          break;
        }
        expression = expression ? { kind: "and", left: expression, right } : right;
        continue;
      }
      if (isOperator(this.tokens[this.cursor], "or") || isOperator(this.tokens[this.cursor], "then") || this.tokens[this.cursor] === ")") break;
      const right = this.parseUnary();
      if (!right) break;
      expression = expression ? { kind: "and", left: expression, right } : right;
    }
    return expression;
  }

  private parseUnary(): SearchExpression | null {
    if (isOperator(this.tokens[this.cursor], "not")) {
      this.cursor += 1;
      const expression = this.parseUnary();
      if (!expression) {
        this.invalid.push("NOT requires a condition");
        return null;
      }
      return { kind: "not", expression };
    }
    if (this.tokens[this.cursor] === "(") {
      this.cursor += 1;
      const expression = this.parseIf();
      if (this.tokens[this.cursor] !== ")") this.invalid.push("Missing closing parenthesis");
      else this.cursor += 1;
      return expression;
    }
    const token = this.tokens[this.cursor];
    if (!token || token === ")") return null;
    this.cursor += 1;
    return this.parsePredicate(token);
  }

  private parsePredicate(raw: string): SearchExpression | null {
    const separator = raw.indexOf(":");
    if (separator <= 0) {
      const value = readTokenValue(raw);
      if (value.malformed || !value.value.trim()) {
        this.invalid.push(raw);
        return null;
      }
      return { kind: "predicate", predicate: { field: "text", value: value.value.toLowerCase() } };
    }

    const field = QUALIFIER_ALIASES[raw.slice(0, separator).toLowerCase()];
    const parsed = readTokenValue(raw.slice(separator + 1));
    if (!field || parsed.malformed || !parsed.value.trim()) {
      this.invalid.push(raw);
      return null;
    }
    const value = parsed.value.trim();
    if (field === "age") {
      const age = parseAge(value);
      if (!age) {
        this.invalid.push(raw);
        return null;
      }
      return { kind: "predicate", predicate: { field, value, age } };
    }
    if (field === "invalid") {
      const normalized = value.toLowerCase();
      if (!["true", "yes", "only", "invalid", "score"].includes(normalized)) {
        this.invalid.push(raw);
        return null;
      }
    }
    return {
      kind: "predicate",
      predicate: {
        field,
        value: field === "gender" ? normalizeGender(value) : field === "skill" ? (SKILL_ALIASES[value.toLowerCase()] ?? value.toLowerCase()) : field === "grade" ? normalizeApplicantGrade(value) : normalizeLabel(value),
      },
    };
  }
}

export function parseApplicantSearchQuery(input: string): ApplicantSearchQuery {
  const query = emptyQuery();
  const parser = new SearchParser(tokenize(input), query.invalid);
  query.expression = parser.parse();
  return query;
}

function matchesAge(age: number | null, filter: AgeFilter): boolean {
  if (age === null) return false;
  if (filter.kind === "exact") return age === filter.value;
  if (filter.kind === "range") return age >= filter.min && age <= filter.max;
  if (filter.operator === ">") return age > filter.value;
  if (filter.operator === ">=") return age >= filter.value;
  if (filter.operator === "<") return age < filter.value;
  return age <= filter.value;
}

function matchesPredicate(applicant: Applicant, predicate: SearchPredicate): boolean {
  if (predicate.field === "text") return searchableText(applicant).includes(predicate.value);
  if (predicate.field === "name") return applicant.name.toLowerCase().includes(predicate.value);
  if (predicate.field === "age") return Boolean(predicate.age && matchesAge(applicant.age, predicate.age));
  if (predicate.field === "gender") return normalizeGender(applicant.gender ?? "") === predicate.value;
  if (predicate.field === "grade") return normalizeApplicantGrade(applicant.grade) === predicate.value;
  if (predicate.field === "skill") return applicantSkill(applicant) === predicate.value;
  if (predicate.field === "recommendation") return normalizeLabel(applicant.aiRecommendation) === predicate.value;
  if (predicate.field === "category") return normalizeLabel(applicant.category) === predicate.value;
  if (predicate.field === "status") return normalizeLabel(applicant.interviewStatus) === predicate.value;
  return applicant.aiScore === -1;
}

function matchesExpression(applicant: Applicant, expression: SearchExpression): boolean {
  if (expression.kind === "predicate") return matchesPredicate(applicant, expression.predicate);
  if (expression.kind === "and") return matchesExpression(applicant, expression.left) && matchesExpression(applicant, expression.right);
  if (expression.kind === "or") return matchesExpression(applicant, expression.left) || matchesExpression(applicant, expression.right);
  if (expression.kind === "not") return !matchesExpression(applicant, expression.expression);
  return !matchesExpression(applicant, expression.condition) || matchesExpression(applicant, expression.consequence);
}

export function matchesApplicantSearch(applicant: Applicant, query: ApplicantSearchQuery): boolean {
  if (query.invalid.length > 0) return false;
  return query.expression ? matchesExpression(applicant, query.expression) : true;
}