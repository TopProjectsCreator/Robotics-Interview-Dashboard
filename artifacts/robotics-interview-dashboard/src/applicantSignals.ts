// Skill signals may be derived from application text. Gender is only read from
// the explicit roster field; it is never inferred from names or free text.

export type ApplicantSkill = "BUILD" | "CODE" | "CAD" | null;
export type ApplicantGender = "M" | "F" | null;

export interface ApplicantSignalInput {
  roboticsExperience?: string | null;
  transcript?: string | null;
  aiSummary?: string | null;
  aiStrengths?: string | null;
  aiConcerns?: string | null;
  notes?: string | null;
  gender?: string | null;
}

export interface ApplicantSignals {
  skill: ApplicantSkill;
  gender: ApplicantGender;
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

function informative(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length < 120 && NEGATION_RE.test(trimmed.toLowerCase())) return null;
  return trimmed.toLowerCase();
}

function countMatches(text: string, res: RegExp[]): number {
  let count = 0;
  for (const re of res) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      count += 1;
      if (match[0].length === 0) re.lastIndex += 1;
    }
    re.lastIndex = 0;
  }
  return count;
}

export function getApplicantSignals(input: ApplicantSignalInput): ApplicantSignals {
  const fields = [
    input.roboticsExperience,
    input.transcript,
    input.aiSummary,
    input.aiStrengths,
    input.aiConcerns,
    input.notes,
  ]
    .map(informative)
    .filter((text): text is string => text !== null);

  let build = 0;
  let code = 0;
  let cad = 0;
  for (const field of fields) {
    build += countMatches(field, BUILD_RES);
    code += countMatches(field, CODE_RES);
    cad += countMatches(field, CAD_RES);
  }

  let skill: ApplicantSkill = null;
  const best = Math.max(build, code, cad);
  if (best > 0) {
    skill = code === best ? "CODE" : cad === best ? "CAD" : "BUILD";
  }

  const storedGender = (input.gender ?? "").trim().toLowerCase();
  const gender: ApplicantGender = storedGender === "m" || storedGender === "male"
    ? "M"
    : storedGender === "f" || storedGender === "female"
      ? "F"
      : null;

  return { skill, gender };
}