import type { Applicant } from "@workspace/db";

type AgeFilter =
  | { kind: "exact"; value: number }
  | { kind: "comparison"; operator: ">" | ">=" | "<" | "<="; value: number }
  | { kind: "range"; min: number; max: number };

export interface ApplicantSearchQuery {
  name: string[];
  age: AgeFilter[];
  gender: string[];
  grade: string[];
  terms: string[];
  invalid: string[];
}

const QUALIFIERS = new Set(["name", "age", "gender", "grade"]);
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

function emptyQuery(): ApplicantSearchQuery {
  return { name: [], age: [], gender: [], grade: [], terms: [], invalid: [] };
}

function readValue(query: string, start: number): { value: string; next: number; malformed: boolean } {
  let cursor = start;
  while (/\s/.test(query[cursor] ?? "")) cursor += 1;
  if (query[cursor] === '"') {
    const end = query.indexOf('"', cursor + 1);
    if (end === -1) return { value: query.slice(cursor + 1), next: query.length, malformed: true };
    return { value: query.slice(cursor + 1, end), next: end + 1, malformed: false };
  }
  const end = query.slice(cursor).search(/\s/);
  if (end === -1) return { value: query.slice(cursor), next: query.length, malformed: false };
  return { value: query.slice(cursor, cursor + end), next: cursor + end, malformed: false };
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

export function parseApplicantSearchQuery(input: string): ApplicantSearchQuery {
  const query = emptyQuery();
  let cursor = 0;
  while (cursor < input.length) {
    while (/\s/.test(input[cursor] ?? "")) cursor += 1;
    if (cursor >= input.length) break;

    const tokenStart = cursor;
    while (cursor < input.length && !/[\s:]/.test(input[cursor])) cursor += 1;
    const key = input.slice(tokenStart, cursor).toLowerCase();
    if (input[cursor] === ":" && QUALIFIERS.has(key)) {
      const value = readValue(input, cursor + 1);
      cursor = value.next;
      const trimmed = value.value.trim();
      if (value.malformed || !trimmed) {
        query.invalid.push(`${key}:`);
        continue;
      }
      if (key === "name") query.name.push(trimmed.toLowerCase());
      else if (key === "gender") query.gender.push(normalizeGender(trimmed));
      else if (key === "grade") query.grade.push(normalizeApplicantGrade(trimmed));
      else {
        const age = parseAge(trimmed);
        if (age) query.age.push(age);
        else query.invalid.push(`age:${trimmed}`);
      }
      continue;
    }

    cursor = tokenStart;
    const value = readValue(input, cursor);
    cursor = value.next;
    if (value.value.trim()) query.terms.push(value.value.trim().toLowerCase());
    if (value.malformed) query.invalid.push(`"${value.value}`);
  }
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

export function matchesApplicantSearch(applicant: Applicant, query: ApplicantSearchQuery): boolean {
  if (query.invalid.length > 0) return false;
  const name = applicant.name.toLowerCase();
  const gender = normalizeGender(applicant.gender ?? "");
  const grade = normalizeApplicantGrade(applicant.grade);
  if (!query.name.every((value) => name.includes(value))) return false;
  if (!query.age.every((filter) => matchesAge(applicant.age, filter))) return false;
  if (!query.gender.every((value) => gender === value)) return false;
  if (!query.grade.every((value) => grade === value)) return false;
  const text = searchableText(applicant);
  return query.terms.every((term) => text.includes(term));
}