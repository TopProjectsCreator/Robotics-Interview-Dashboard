import type { TeamAssessmentQuestion } from "@workspace/db";

export const TEAM_ASSESSMENT_STYLE_PRESETS = ["robotics", "ocean", "sunrise", "forest"] as const;
export const TEAM_ASSESSMENT_QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "long_answer",
  "likert",
  "ranking",
  "file_upload",
  "slider",
  "style_picker",
] as const;
export const TEAM_ASSESSMENT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const TEAM_ASSESSMENT_MAX_TOTAL_FILE_BYTES = 10 * 1024 * 1024;

export type AssessmentKind = "quiz" | "survey";
export type AssessmentAnswer = { value: unknown; comment?: unknown };

export class TeamAssessmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamAssessmentValidationError";
  }
}

export function hasOutstandingTeamAssessments(requiredIds: string[], submittedIds: Iterable<string>): boolean {
  const submitted = new Set(submittedIds);
  return requiredIds.some((id) => !submitted.has(id));
}

export function isTeamAssessmentFileReferenced(
  submissions: { answers: unknown }[],
  objectPath: string,
): boolean {
  return submissions.some(({ answers }) => {
    const serialized = JSON.stringify(answers);
    return typeof serialized === "string" && serialized.includes(objectPath);
  });
}

const choiceTypes = new Set(["single_choice", "multiple_choice", "likert", "ranking", "style_picker"]);

export function validateTeamAssessmentQuestions(
  questions: TeamAssessmentQuestion[],
  kind: AssessmentKind,
): void {
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 50) {
    throw new TeamAssessmentValidationError("Add between 1 and 50 questions.");
  }
  const ids = new Set<string>();
  for (const [index, question] of questions.entries()) {
    if (!question || typeof question !== "object") {
      throw new TeamAssessmentValidationError(`Question ${index + 1} is invalid.`);
    }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(question.id) || ids.has(question.id)) {
      throw new TeamAssessmentValidationError(`Question ${index + 1} needs a unique, simple ID.`);
    }
    ids.add(question.id);
    if (!TEAM_ASSESSMENT_QUESTION_TYPES.includes(question.type)) {
      throw new TeamAssessmentValidationError(`Question ${index + 1} uses an unsupported type.`);
    }
    if (typeof question.prompt !== "string" || !question.prompt.trim() || question.prompt.length > 500) {
      throw new TeamAssessmentValidationError(`Question ${index + 1} needs a prompt of 1–500 characters.`);
    }
    if (typeof question.required !== "boolean") {
      throw new TeamAssessmentValidationError(`Question ${index + 1} has an invalid required setting.`);
    }

    if (choiceTypes.has(question.type)) {
      const options = question.options;
      if (!Array.isArray(options) || options.length < 2 || options.length > 12 ||
        options.some((option) => typeof option !== "string" || !option.trim() || option.length > 160) ||
        new Set(options).size !== options.length) {
        throw new TeamAssessmentValidationError(`Question “${question.prompt}” needs 2–12 distinct options.`);
      }
      if (question.type === "style_picker" &&
        options.some((option) => !TEAM_ASSESSMENT_STYLE_PRESETS.includes(option as typeof TEAM_ASSESSMENT_STYLE_PRESETS[number]))) {
        throw new TeamAssessmentValidationError("Style questions may use only the built-in theme presets.");
      }
    }

    if (kind === "survey" && question.correctAnswers?.length) {
      throw new TeamAssessmentValidationError("Surveys cannot have correct answers.");
    }
    if (kind === "quiz" && (question.type === "single_choice" || question.type === "multiple_choice")) {
      const correct = question.correctAnswers;
      if (!Array.isArray(correct) ||
        correct.length < 1 ||
        (question.type === "single_choice" && correct.length !== 1) ||
        correct.some((answer) => !question.options?.includes(answer)) ||
        new Set(correct).size !== correct.length) {
        throw new TeamAssessmentValidationError(`Mark valid correct choices for “${question.prompt}”.`);
      }
    } else if (question.correctAnswers?.length) {
      throw new TeamAssessmentValidationError("Only single- and multiple-choice quiz questions can be scored.");
    }

    if (question.type === "slider") {
      if (!Number.isFinite(question.min) || !Number.isFinite(question.max) ||
        (question.min as number) >= (question.max as number) ||
        !Number.isFinite(question.step) || (question.step as number) <= 0 ||
        (question.step as number) > (question.max as number) - (question.min as number)) {
        throw new TeamAssessmentValidationError(`Set a valid minimum, maximum, and step for “${question.prompt}”.`);
      }
    }
    if (question.type === "file_upload" &&
      (!Number.isInteger(question.fileLimit) || (question.fileLimit as number) < 1 || (question.fileLimit as number) > 3)) {
      throw new TeamAssessmentValidationError(`Set a file limit from 1 to 3 for “${question.prompt}”.`);
    }
  }
}

function isEmpty(value: unknown): boolean {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

function matchesStep(value: number, min: number, step: number): boolean {
  const units = (value - min) / step;
  return Math.abs(units - Math.round(units)) < 1e-7;
}

function assessmentUploadPath(
  objectPath: string,
  teamId: string,
  interviewerId: string,
  assessmentId: string,
): boolean {
  const path = objectPath.replace(/^\/objects\//, "");
  const segments = path.replace(/^secondary\//, "").split("/");
  return segments.length === 5 &&
    segments[0] === "team-assessments" &&
    segments[1] === teamId &&
    segments[2] === interviewerId &&
    segments[3] === assessmentId &&
    /^[a-f0-9-]{36}$/i.test(segments[4]);
}

export function validateTeamAssessmentAnswers(options: {
  questions: TeamAssessmentQuestion[];
  answers: Record<string, AssessmentAnswer>;
  kind: AssessmentKind;
  teamId: string;
  interviewerId: string;
  assessmentId: string;
}): { score: number | null; maxScore: number | null; files: { objectPath: string; size: number; contentType: string }[] } {
  const { questions, answers, kind, teamId, interviewerId, assessmentId } = options;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    throw new TeamAssessmentValidationError("Answers must be an object.");
  }
  const questionIds = new Set(questions.map((question) => question.id));
  if (Object.keys(answers).some((id) => !questionIds.has(id))) {
    throw new TeamAssessmentValidationError("Answers include a question that is not in this assessment.");
  }

  let score = 0;
  let maxScore = 0;
  let totalFileBytes = 0;
  const files: { objectPath: string; size: number; contentType: string }[] = [];

  for (const question of questions) {
    const answer = answers[question.id];
    const value = answer && typeof answer === "object" && !Array.isArray(answer) ? answer.value : undefined;
    const scoredQuestion = kind === "quiz" &&
      (question.type === "single_choice" || question.type === "multiple_choice");
    if (question.required && isEmpty(value)) {
      throw new TeamAssessmentValidationError(`Answer “${question.prompt}” before submitting.`);
    }
    if (scoredQuestion) maxScore += 1;
    if (isEmpty(value)) continue;

    if (question.type === "single_choice" || question.type === "likert" || question.type === "style_picker") {
      if (typeof value !== "string" || !question.options?.includes(value)) {
        throw new TeamAssessmentValidationError(`Choose a listed option for “${question.prompt}”.`);
      }
    } else if (question.type === "multiple_choice") {
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !question.options?.includes(item)) ||
        new Set(value).size !== value.length) {
        throw new TeamAssessmentValidationError(`Choose valid, distinct options for “${question.prompt}”.`);
      }
    } else if (question.type === "long_answer") {
      if (typeof value !== "string" || value.length > 5000) {
        throw new TeamAssessmentValidationError(`Answer “${question.prompt}” must be 5,000 characters or fewer.`);
      }
    } else if (question.type === "ranking") {
      if (!Array.isArray(value) || value.length !== question.options?.length ||
        value.some((item) => typeof item !== "string" || !question.options?.includes(item)) ||
        new Set(value).size !== question.options?.length) {
        throw new TeamAssessmentValidationError(`Rank every option exactly once for “${question.prompt}”.`);
      }
    } else if (question.type === "slider") {
      const min = question.min as number;
      const max = question.max as number;
      const step = question.step as number;
      if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || !matchesStep(value, min, step)) {
        throw new TeamAssessmentValidationError(`Choose a valid value for “${question.prompt}”.`);
      }
    } else if (question.type === "file_upload") {
      if (!Array.isArray(value) || value.length > (question.fileLimit ?? 1)) {
        throw new TeamAssessmentValidationError(`Choose no more than ${question.fileLimit ?? 1} file(s) for “${question.prompt}”.`);
      }
      for (const rawFile of value) {
        if (!rawFile || typeof rawFile !== "object" || Array.isArray(rawFile)) {
          throw new TeamAssessmentValidationError(`A file reference for “${question.prompt}” is invalid.`);
        }
        const file = rawFile as Record<string, unknown>;
        if (typeof file.objectPath !== "string" ||
          !assessmentUploadPath(file.objectPath, teamId, interviewerId, assessmentId) ||
          typeof file.name !== "string" || !file.name.trim() || file.name.length > 255 ||
          typeof file.size !== "number" || !Number.isInteger(file.size) || file.size < 1 ||
          file.size > TEAM_ASSESSMENT_MAX_FILE_BYTES ||
          typeof file.contentType !== "string" || file.contentType.length > 120) {
          throw new TeamAssessmentValidationError(`A file reference for “${question.prompt}” is invalid.`);
        }
        totalFileBytes += file.size;
        if (totalFileBytes > TEAM_ASSESSMENT_MAX_TOTAL_FILE_BYTES) {
          throw new TeamAssessmentValidationError("Response files together must be 10 MB or smaller.");
        }
        files.push({ objectPath: file.objectPath, size: file.size, contentType: file.contentType });
      }
    }

    if (scoredQuestion) {
      const selected = Array.isArray(value) ? value : [value];
      if (selected.length === question.correctAnswers?.length &&
        selected.every((item) => question.correctAnswers?.includes(String(item)))) {
        score += 1;
      }
    }
  }
  return {
    score: kind === "quiz" ? score : null,
    maxScore: kind === "quiz" ? maxScore : null,
    files,
  };
}
