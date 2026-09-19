// Single skill + gender signals derived from applicant text fields.
// There are no dedicated skill/gender columns, so these are heuristics
// over roboticsExperience, transcript, AI summaries/strengths, and notes.
// Skill is the single best-matching category (most keyword hits; ties go
// to the scarcer skill: CODE, then CAD, then BUILD). Gender is only ever
// reported from real evidence — pronouns in the file, the first name, or
// gendered last-name patterns — and is left blank when nothing matches.

export type ApplicantSkill = "BUILD" | "CODE" | "CAD" | null;
export type ApplicantGender = "M" | "F" | null;

export interface ApplicantSignalInput {
  roboticsExperience?: string | null;
  transcript?: string | null;
  aiSummary?: string | null;
  aiStrengths?: string | null;
  aiConcerns?: string | null;
  notes?: string | null;
  name?: string | null;
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

const MASCULINE_RE = /\b(he|him|his|himself|boy|son|brother)\b/g;
const FEMININE_RE = /\b(she|her|hers|herself|girl|daughter|sister)\b/g;

// Short "I have nothing" style answers carry no signal even if they happen
// to contain a keyword (e.g. "No known experience").
const NEGATION_RE =
  /^\W*(none|n\/?a|unknown|nothing|never|no\s+(known\s+|robotics\s+|prior\s+|previous\s+)?(experience|background|idea)|not\s+(much|any|really)|nope|no\s+idea|didn'?t\s+do|haven'?t\s+done)/;

// First names, grouped by gender across the cultures on a typical roster.
// Only unambiguous names are listed — unisex names are left out entirely.
const MALE_FIRST_NAMES = new Set(
  (
    "liam noah oliver elijah james william benjamin lucas henry alexander mason michael ethan daniel jacob logan jackson levi sebastian mateo jack owen theodore aiden samuel joseph john david wyatt matthew luke asher carter julian gavin leo jayden gabriel isaac ryan nathan caleb christian hunter eli jonathan connor josiah ezra aaron max miles carson easton nolan adam ian austin kyle kevin brian eric justin brandon tyler jordan dylan zachary nicholas anthony christopher joshua andrew jason jeffrey steven sean patrick peter paul mark luke timothy joel seth cole blake chase grant troy brett craig dean marcus derek travis wesley bradley spencer dalton jared shane cliff todd " +
    "aarav arjun vihaan krishna aditya rohan sai aarush vivaan kabir arnav anay ishaan abhi dev yash om pranav atharv ayaan reyansh aryan shaurya rudra ansh vedant shreyas advaith siddharth varun karthik akash manav dhruv lakshya avyaan advaith krish vivaan " +
    "diego santiago miguel jose luis carlos juan pedro jorge rafael andres felipe nicolas emilio pablo marco cesar eduardo fernando ricardo manuel alejandro roberto francisco antonio mario hugo adrian erik ivan victor elias enzo thiago gael luca ezra micah jonah isaiah jeremiah josue jesus angel manuel " +
    "mohammed muhammad ahmed omar ali yusuf ibrahim khalid tariq samir karim rami tamer hisham faisal abdullah hassan mustafa yassin hamza zayn ilyas farhan rehan zayan danish arham " +
    "tao lei jun hao gang qiang feng long dong ming jian chao hao peng cheng kai bo " +
    "minjun seojun jihoon donghyun hajun taeyang jaehyuk " +
    "minh duc hoang nam tuan bao huy khoa dat phuc khang " +
    "alexander dmitri nikolai ivan sergei andrei mikhail vladimir pavel oleg kirill artem maksim egor daniil timofey ilya fyodor grigori leonid boris anatoly vladislav " +
    "noam yonatan omri eitan itay idan nadav oren guy roi alon assaf dor " +
    "jaylen darius deshawn malik jamal tyreek deandre marquis trevon jalen kyrie deshawn keon tayvon jaden braden kayden braxton jax jett ryder bodhi waylon tucker colton walker hayes brooks beckett grayson hudson maverick jace zayne kaison knox paxton rhys ellis rhodes wells barrett sullivan callum finn jude emmett silas jasper felix hugo otis theodore ambrose edmund albert arthur edgar edwin frank george harry ralph roy russell victor vincent walter willie eugene floyd howard norman stanley vernon chester clifford duane glenn lester lloyd marvin melvin morris neal randall roger terry tommy mitchell philip jesse jeremiah byron curtis dennis francis gene gerald gordon harold herbert irving julius kelvin kent kurt lamar lonnie lyle mason maurice merle milton moody murray myron odell ollie orval otto percy quentin raleigh randy rex rick ricky rob robbie rodney roland ronnie rudy sal scott sherman sidney simon stan stewart terrance tommie turner tyre tyson wade warren wendell wilbur willis wilson woodrow yates zach zachariah zane zeke"
  ).split(" "),
);

const FEMALE_FIRST_NAMES = new Set(
  (
    "olivia emma charlotte amelia sophia isabella ava mia evelyn luna harper camila sofia scarlett elizabeth eleanor ella chloe layla riley aria zoey nora lily hannah aubrey addison leah eliana willow bella eva grace violet naomi aurora avery stella mila elena penelope sarah emily madison victoria gabriella natalie lauren allison kimberly sydney paige brooke audrey alice sadie lucy claire ruby nina tara sara hana mina jia eunji yuna seoyeon jiwoo hana soojin chaewon nayeon " +
    "priya ananya diya aadhya navya isha janya saanvi myra anaya aanya dhee aisha anika riya shreya tanvi ishita sneha pooja neha kavya meera lakshmi divya anjali naina zara amara ira tara " +
    "valentina luciana emilia martina catalina antonella ximena regina fernanda daniela gabriela natalia paula lucia elena rosa maria josefina guadalupe alejandra patricia carolina renata bianca alba clara iris elisa marina adriana liliana viviana mariana juliana serena stella gianna ariana carmen rosa mariana " +
    "fatima aisha layla yasmin zara amira leila mariam sara rania dina nadia salma hala lama tala lina mira elissa yasmina hiba dana farah " +
    "mei na yan ting xue ying fang hua lan xia ling meng yao jing hui " +
    "noa maya yael michal shira liat neta hila ella tali " +
    "anastasia daria ekaterina olga natalia irina elena anna polina alina arina milana varvara ksenia tatiana svetlana oksana yulia alexandra veronika diana zlata sonia mila " +
    "imani aaliyah jada brianna jasmine destiny nevaeh janiya kayla aliyah mya paris faith hope ebony ashanti jada tyra keisha latoya monique shanice tamika tanya dominique felicia latoya shanika ebony " +
    "linh ngoc thuy trang mai huong quynh vy my anh " +
    "marie jeanne sophie camille lea jade manon " +
    "gene rose ann mae joy grace faith hope charity mercy patience prudence constance willow juniper hazel ivy fern wren poppy daisy dahlia magnolia maisie elsie edie thea cleo clio daphne phoebe penelope esther ruth miriam deborah rebekah rachel abigail martha priscilla lydia tabitha eunice lois hadassah willa nell hattie winnie faye"
  ).split(" "),
);

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
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      count += 1;
      if (m[0].length === 0) re.lastIndex += 1;
    }
    re.lastIndex = 0;
  }
  return count;
}

function countGlobal(text: string, re: RegExp): number {
  re.lastIndex = 0;
  let count = 0;
  while (re.exec(text)) count += 1;
  re.lastIndex = 0;
  return count;
}

// Gendered last-name patterns: Sikh (Singh/Kaur) and Slavic morphologies
// (-ov/-ev/-ski male, -ova/-eva/-ska female). Checked after first names.
// Returns null unless the name itself carries gender evidence — never a guess.
const MALE_LAST_NAME_RE = /(singh|[ae]ov|ev|skiy|ski|vich)$/;
const FEMALE_LAST_NAME_RE = /(kaur|[ae]ova|eva|skaya|ska)$/;

function genderFromName(name: string | null | undefined): ApplicantGender {
  const parts = (name ?? "").trim().split(/\s+/).map((p) => p.toLowerCase().replace(/[^a-z]/g, "")).filter(Boolean);
  if (!parts.length) return null;
  const first = parts[0];
  if (MALE_FIRST_NAMES.has(first)) return "M";
  if (FEMALE_FIRST_NAMES.has(first)) return "F";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  if (last) {
    if (FEMALE_LAST_NAME_RE.test(last)) return "F";
    if (MALE_LAST_NAME_RE.test(last)) return "M";
  }
  return null;
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
  let masculine = 0;
  let feminine = 0;

  for (const field of fields) {
    build += countMatches(field, BUILD_RES);
    code += countMatches(field, CODE_RES);
    cad += countMatches(field, CAD_RES);
    masculine += countGlobal(field, MASCULINE_RE);
    feminine += countGlobal(field, FEMININE_RE);
  }

  // Exactly one skill: most evidence wins; ties prefer scarcer skills.
  let skill: ApplicantSkill = null;
  const best = Math.max(build, code, cad);
  if (best > 0) {
    skill = code === best ? "CODE" : cad === best ? "CAD" : "BUILD";
  }

  // Gender only from evidence: pronouns first, then the name itself.
  let gender: ApplicantGender = null;
  if (masculine > 0 && feminine === 0) gender = "M";
  else if (feminine > 0 && masculine === 0) gender = "F";
  else gender = genderFromName(input.name);

  return { skill, gender };
}
