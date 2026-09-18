// Heuristic skill/gender signals derived from applicant text fields.
// There are no dedicated build/CAD/coach/gender columns, so these scan
// roboticsExperience, transcript, AI summaries/strengths, and notes for
// evidence. All matches are keyword heuristics, not verified facts.

export type ApplicantGender = "M" | "F" | null;

export interface ApplicantSignalInput {
  roboticsExperience?: string | null;
  transcript?: string | null;
  aiSummary?: string | null;
  aiStrengths?: string | null;
  aiConcerns?: string | null;
  notes?: string | null;
}

export interface ApplicantSignals {
  build: boolean;
  cad: boolean;
  coach: boolean;
  gender: ApplicantGender;
}

const BUILD_RE =
  /\b(build|built|building|builder|builds|assembl\w*|chassis|drivetrain|gearbox|vex(\s+iq)?|fll\b|first\s+lego\s+league|lego\s+league|ftc\b|frc\b|first\s+(robotics|tech\s+challenge)|mindstorms|spike(\s+prime)?|ev3|nxt|tetrix|rev\s+robotics|andymark|gobilda|mechanic\w*|fabricat\w*|construct\w*|wiring|wired|solder\w*|power\s?tools?|drill\w*|dremel|bandsaw|lego\s+technic|robot\s+build|mbot|elegoo|actobotics)\b/;

const CAD_RE =
  /\b(\bcad\b|onshape|fusion\s?360|tinkercad|solidworks|autodesk(\s+inventor)?|inventor|freecad|sketchup|3d\s+(model\w*|design\w*|print\w*|cad)|designed?\s+(a\s+|the\s+)?(robot|chassis|part|bracket|mount|intake|arm|claw))\b/;

const COACH_RE =
  /\b(coach\w*|mentor\w*|captain|team\s+(lead\w*|captain)|led\s+the\s+team|taught|teach\w*|tutor\w*|referee|leadership|volunteer\w*|outreach|president|officer|organiz\w*\s+(the\s+|an?\s+)?(event|workshop|team|club|fundraiser)|judge\w*\s+(at|for))\b/;

const MASCULINE_RE = /\b(he|him|his|himself|boy|son|brother)\b/g;
const FEMININE_RE = /\b(she|her|hers|herself|girl|daughter|sister)\b/g;

// Short "I have nothing" style answers carry no signal even if they happen
// to contain a keyword (e.g. "No known experience").
const NEGATION_RE =
  /^\W*(none|n\/?a|unknown|nothing|never|no\s+(known\s+|robotics\s+|prior\s+|previous\s+)?(experience|background|idea)|not\s+(much|any|really)|nope|no\s+idea|didn'?t\s+do|haven'?t\s+done)/;

function informative(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length < 120 && NEGATION_RE.test(trimmed.toLowerCase())) return null;
  return trimmed;
}

function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let count = 0;
  while (re.exec(text)) count += 1;
  re.lastIndex = 0;
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

  let build = false;
  let cad = false;
  let coach = false;
  let masculine = 0;
  let feminine = 0;

  for (const field of fields) {
    const lower = field.toLowerCase();
    if (!build && BUILD_RE.test(lower)) build = true;
    if (!cad && CAD_RE.test(lower)) cad = true;
    if (!coach && COACH_RE.test(lower)) coach = true;
    masculine += countMatches(lower, MASCULINE_RE);
    feminine += countMatches(lower, FEMININE_RE);
  }

  // Only report gender when the pronouns point clearly one way.
  const gender: ApplicantGender =
    masculine > 0 && feminine === 0 ? "M" : feminine > 0 && masculine === 0 ? "F" : null;

  return { build, cad, coach, gender };
}
