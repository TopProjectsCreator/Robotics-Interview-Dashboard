import test from "node:test";
import assert from "node:assert/strict";
import {
  hasOutstandingTeamAssessments,
  isTeamAssessmentFileReferenced,
  TeamAssessmentValidationError,
  validateTeamAssessmentAnswers,
  validateTeamAssessmentQuestions,
} from "./teamAssessmentRules.ts";

const assessmentIds = {
  teamId: "team-1",
  interviewerId: "member-1",
  assessmentId: "assessment-1",
};

const fullQuiz = [
  { id: "single", type: "single_choice", prompt: "Pick one", required: true, options: ["A", "B"], correctAnswers: ["B"] },
  { id: "multiple", type: "multiple_choice", prompt: "Pick two", required: true, options: ["A", "B", "C"], correctAnswers: ["A", "C"] },
  { id: "text", type: "long_answer", prompt: "Explain", required: true },
  { id: "likert", type: "likert", prompt: "Rate it", required: true, options: ["Low", "Medium", "High"] },
  { id: "ranking", type: "ranking", prompt: "Rank these", required: true, options: ["First", "Second", "Third"] },
  { id: "upload", type: "file_upload", prompt: "Attach a file", required: true, fileLimit: 2 },
  { id: "slider", type: "slider", prompt: "Set a value", required: true, min: 0, max: 10, step: 2 },
  { id: "theme", type: "style_picker", prompt: "Choose a theme", required: true, options: ["robotics", "ocean"] },
];

const validAnswers = {
  single: { value: "B" },
  multiple: { value: ["A", "C"] },
  text: { value: "A written response" },
  likert: { value: "High" },
  ranking: { value: ["First", "Second", "Third"] },
  upload: { value: [{
    objectPath: "/objects/team-assessments/team-1/member-1/assessment-1/123e4567-e89b-12d3-a456-426614174000",
    name: "notes.pdf",
    size: 128,
    contentType: "application/pdf",
  }] },
  slider: { value: 8 },
  theme: { value: "ocean" },
};

test("validates all supported question types and scores only graded choices", () => {
  validateTeamAssessmentQuestions(fullQuiz, "quiz");
  const result = validateTeamAssessmentAnswers({
    questions: fullQuiz,
    answers: validAnswers,
    kind: "quiz",
    ...assessmentIds,
  });
  assert.deepEqual(result, {
    score: 2,
    maxScore: 2,
    files: [{
      objectPath: validAnswers.upload.value[0].objectPath,
      size: 128,
      contentType: "application/pdf",
    }],
  });
});

test("surveys cannot contain answer keys and never receive a score", () => {
  const questions = [{ ...fullQuiz[0], correctAnswers: undefined }];
  validateTeamAssessmentQuestions(questions, "survey");
  assert.deepEqual(validateTeamAssessmentAnswers({
    questions,
    answers: { single: { value: "A" } },
    kind: "survey",
    ...assessmentIds,
  }), { score: null, maxScore: null, files: [] });
  assert.throws(
    () => validateTeamAssessmentQuestions([{ ...questions[0], correctAnswers: ["A"] }], "survey"),
    TeamAssessmentValidationError,
  );
});

test("quiz maximum points include unanswered optional choice questions", () => {
  const questions = [
    { ...fullQuiz[0], required: false },
    { ...fullQuiz[1], required: false },
  ];
  assert.deepEqual(validateTeamAssessmentAnswers({
    questions,
    answers: { single: { value: "B" } },
    kind: "quiz",
    ...assessmentIds,
  }), { score: 1, maxScore: 2, files: [] });
});

test("rejects invalid question definitions and unsafe theme values", () => {
  assert.throws(() => validateTeamAssessmentQuestions([], "quiz"), /between 1 and 50/);
  assert.throws(() => validateTeamAssessmentQuestions([
    { ...fullQuiz[0], id: "bad id" },
  ], "quiz"), /unique, simple ID/);
  assert.throws(() => validateTeamAssessmentQuestions([
    { id: "bad-theme", type: "style_picker", prompt: "Theme", required: true, options: ["robotics", "body{color:red}"] },
  ], "survey"), /built-in theme presets/);
  assert.throws(() => validateTeamAssessmentQuestions([
    { ...fullQuiz[0], correctAnswers: ["not-an-option"] },
  ], "quiz"), /Mark valid correct choices/);
  assert.throws(() => validateTeamAssessmentQuestions([
    { id: "bad-slider", type: "slider", prompt: "Value", required: true, min: 2, max: 2, step: 1 },
  ], "survey"), /valid minimum/);
});

test("rejects malformed and cross-team answers and file references", () => {
  assert.throws(() => validateTeamAssessmentAnswers({
    questions: [fullQuiz[0]],
    answers: { single: { value: ["A"] } },
    kind: "quiz",
    ...assessmentIds,
  }), /Choose a listed option/);
  assert.throws(() => validateTeamAssessmentAnswers({
    questions: [fullQuiz[0]],
    answers: { single: { value: "A" }, extra: { value: "B" } },
    kind: "quiz",
    ...assessmentIds,
  }), /not in this assessment/);
  assert.throws(() => validateTeamAssessmentAnswers({
    questions: [fullQuiz[5]],
    answers: { upload: { value: [{ ...validAnswers.upload.value[0], objectPath: "/objects/team-assessments/other-team/member-1/assessment-1/123e4567-e89b-12d3-a456-426614174000" }] } },
    kind: "survey",
    ...assessmentIds,
  }), /file reference.*invalid/);
  assert.throws(() => validateTeamAssessmentAnswers({
    questions: [fullQuiz[5]],
    answers: { upload: { value: [{ ...validAnswers.upload.value[0], size: 6 * 1024 * 1024 }] } },
    kind: "survey",
    ...assessmentIds,
  }), /file reference.*invalid/);
});

test("requires a full valid ranking and honors required answers", () => {
  assert.throws(() => validateTeamAssessmentAnswers({
    questions: [fullQuiz[4]],
    answers: { ranking: { value: ["First", "First", "Third"] } },
    kind: "survey",
    ...assessmentIds,
  }), /Rank every option exactly once/);
  assert.throws(() => validateTeamAssessmentAnswers({
    questions: [fullQuiz[2]],
    answers: {},
    kind: "survey",
    ...assessmentIds,
  }), /Answer.*before submitting/);
});

test("keeps access blocked only while a required assessment is missing and protects submitted files", () => {
  assert.equal(hasOutstandingTeamAssessments(["quiz-a", "survey-b"], ["quiz-a"]), true);
  assert.equal(hasOutstandingTeamAssessments(["quiz-a", "survey-b"], ["quiz-a", "survey-b"]), false);
  assert.equal(hasOutstandingTeamAssessments([], []), false);

  const objectPath = "/objects/team-assessments/team-1/member-1/assessment-1/123e4567-e89b-12d3-a456-426614174000";
  assert.equal(isTeamAssessmentFileReferenced([{ answers: { upload: { value: [{ objectPath }] } } }], objectPath), true);
  assert.equal(isTeamAssessmentFileReferenced([{ answers: { upload: { value: [] } } }], objectPath), false);
});
