import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  getGetRequiredTeamAssessmentsQueryKey,
  getGetTeamAssessmentQueryKey,
  getGetTeamAssessmentResultsQueryKey,
  getListTeamAssessmentsQueryKey,
  useCreateTeamAssessment,
  useGetRequiredTeamAssessments,
  useGetSession,
  useGetTeamAssessment,
  useGetTeamAssessmentResults,
  useListTeamAssessments,
  usePauseTeamAssessment,
  usePublishTeamAssessment,
  useRequestTeamAssessmentUploadUrl,
  useSubmitTeamAssessment,
  useUpdateTeamAssessment,
  type RequiredTeamAssessmentList,
  type TeamAssessment,
  type TeamAssessmentInput,
  type TeamAssessmentQuestion,
  type TeamAssessmentQuestionType,
  type TeamAssessmentResults,
  type TeamAssessmentStylePreset,
} from "@workspace/api-client-react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ClipboardCheck, Download, Eye, FileUp, LoaderCircle, Pause, Plus, Rocket, Save, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getStoredAuthToken } from "../authSession";
import { useNativeFileDrop } from "../lib/useNativeFileDrop";

const card = "rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] shadow-sm";
const pageSurface = "min-h-[calc(100dvh-7rem)] -m-3 bg-[hsl(var(--background))] p-3 text-[hsl(var(--foreground))] sm:-m-5 sm:p-5 lg:-m-9 lg:p-9";
const field = "w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--foreground))] transition hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50";
const PRESET_OPTIONS: { id: TeamAssessmentStylePreset; name: string; background: string; accent: string }[] = [
  { id: "robotics", name: "Robotics", background: "linear-gradient(135deg,#17374a,#237d88)", accent: "#f5c84b" },
  { id: "ocean", name: "Ocean", background: "linear-gradient(135deg,#123c63,#2383a5)", accent: "#8de1d1" },
  { id: "sunrise", name: "Sunrise", background: "linear-gradient(135deg,#55384a,#c76647)", accent: "#ffd27d" },
  { id: "forest", name: "Forest", background: "linear-gradient(135deg,#1f473d,#4b8060)", accent: "#c6dd8a" },
];
const QUESTION_TYPES: { id: TeamAssessmentQuestionType; label: string }[] = [
  { id: "single_choice", label: "Single choice" },
  { id: "multiple_choice", label: "Multiple choice" },
  { id: "long_answer", label: "Long answer" },
  { id: "likert", label: "Likert scale" },
  { id: "ranking", label: "Drag to rank" },
  { id: "file_upload", label: "File upload" },
  { id: "slider", label: "Slider" },
  { id: "style_picker", label: "Theme style picker" },
];
const CHOICE_TYPES = new Set<TeamAssessmentQuestionType>(["single_choice", "multiple_choice", "likert", "ranking", "style_picker"]);
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
type UploadedAssessmentFile = { objectPath: string; name: string; size: number; contentType: string };
type AssessmentAnswers = Record<string, unknown>;
const EMPTY_ANSWERS: AssessmentAnswers = {};

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `question_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeQuestion(type: TeamAssessmentQuestionType = "single_choice"): TeamAssessmentQuestion {
  const base: TeamAssessmentQuestion = { id: newId(), type, prompt: "New question", required: true };
  if (CHOICE_TYPES.has(type)) {
    const options = type === "style_picker" ? ["robotics", "ocean"] : ["Option 1", "Option 2"];
    base.options = options;
    if (type === "single_choice" || type === "multiple_choice") {
      base.correctAnswers = [options[0] ?? "Option 1"];
    }
  }
  if (type === "slider") {
    base.min = 0;
    base.max = 10;
    base.step = 1;
    base.minLabel = "Not at all";
    base.maxLabel = "Very much";
  }
  if (type === "file_upload") base.fileLimit = 1;
  if (type === "likert") base.options = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
  return base;
}

function styleTitle(style: string): string {
  return PRESET_OPTIONS.find((option) => option.id === style)?.name ?? "Robotics";
}

function getResponseValue(answers: AssessmentAnswers, questionId: string): unknown {
  const answer = answers[questionId];
  if (answer && typeof answer === "object" && !Array.isArray(answer) && "value" in answer) {
    return (answer as { value?: unknown }).value;
  }
  return answer;
}

function getServerError(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") return data.error;
  }
  return error instanceof Error ? error.message : "The request could not be completed. Try again.";
}

function SectionHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) {
  return <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <p className="mono mb-2 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{eyebrow}</p>
      <h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--foreground))] sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{detail}</p>
    </div>
    {action}
  </header>;
}

function StatusLabel({ status }: { status: TeamAssessment["status"] }) {
  const labels = { draft: "Draft", published: "Published · required", paused: "Paused" };
  const classes = {
    draft: "border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
    published: "border-emerald-700/20 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300",
    paused: "border-amber-700/20 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[status]}`}>{labels[status]}</span>;
}

function PresetPicker({ value, onChange, disabled = false }: { value: string; onChange?: (value: string) => void; disabled?: boolean }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {PRESET_OPTIONS.map((preset) => <button
      key={preset.id}
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(preset.id)}
      aria-pressed={value === preset.id}
      data-testid={`button-assessment-preset-${preset.id}`}
      className={`min-h-16 rounded-xl border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-default ${value === preset.id ? "border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--ring))]/30" : "border-[hsl(var(--border))]"}`}
      style={{ background: preset.background, color: "#fff" }}
    >
      <span className="block text-sm font-semibold">{preset.name}</span>
      <span className="mt-2 block h-1.5 w-10 rounded-full" style={{ backgroundColor: preset.accent }} />
    </button>)}
  </div>;
}

function AssessmentQuestionInput({
  question,
  value,
  onChange,
  disabled = false,
  preview = false,
  assessmentId,
  onError,
}: {
  question: TeamAssessmentQuestion;
  value: unknown;
  onChange?: (value: unknown) => void;
  disabled?: boolean;
  preview?: boolean;
  assessmentId?: string;
  onError?: (message: string) => void;
}) {
  const [dragged, setDragged] = useState<string | null>(null);
  const uploadUrl = useRequestTeamAssessmentUploadUrl();
  const [uploading, setUploading] = useState(false);
  const values = Array.isArray(value) ? value : [];
  const fileValues = values.filter((item): item is UploadedAssessmentFile =>
    Boolean(item && typeof item === "object" && "objectPath" in item && "name" in item),
  );
  const setValue = (next: unknown) => onChange?.(next);

  const addFiles = async (files: FileList | File[] | null) => {
    if (!files?.length || !assessmentId) return;
    setUploading(true);
    onError?.("");
    const uploads: UploadedAssessmentFile[] = [];
    try {
      const incoming = Array.from(files);
      if (incoming.length + fileValues.length > (question.fileLimit ?? 1)) {
        throw new Error(`Choose no more than ${question.fileLimit ?? 1} file(s) for this question.`);
      }
      const total = incoming.reduce((sum, file) => sum + file.size, fileValues.reduce((sum, file) => sum + file.size, 0));
      if (total > 10 * 1024 * 1024) throw new Error("Response files together must be 10 MB or smaller.");
      for (const file of incoming) {
        const contentType = file.type || "application/octet-stream";
        if (file.size < 1 || file.size > MAX_FILE_BYTES || !ALLOWED_FILE_TYPES.has(contentType)) {
          throw new Error(`${file.name} is not an allowed file type or is larger than 5 MB.`);
        }
        const signed = await uploadUrl.mutateAsync({
          assessmentId,
          data: { name: file.name, size: file.size, contentType },
        });
        const response = await fetch(signed.uploadURL, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!response.ok) throw new Error(`Could not upload ${file.name}. Try selecting it again.`);
        uploads.push({ objectPath: signed.objectPath, name: file.name, size: file.size, contentType });
      }
      setValue([...fileValues, ...uploads]);
    } catch (error) {
      // Remove any files uploaded before a later file in this selection failed.
      // The storage endpoint checks team and owner before deleting.
      const token = getStoredAuthToken();
      for (const file of uploads) {
        await fetch(`/api/storage${file.objectPath}`, {
          method: "DELETE",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }).catch(() => undefined);
      }
      onError?.(error instanceof Error ? error.message : "Could not upload the selected file.");
    } finally {
      setUploading(false);
    }
  };
  const assessmentFileDrop = useNativeFileDrop(files => { void addFiles(files); }, {
    disabled: disabled || preview || uploading,
  });

  const removeFile = async (target: UploadedAssessmentFile) => {
    const token = getStoredAuthToken();
    try {
      await fetch(`/api/storage${target.objectPath}`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch {
      // The answer no longer references this upload; server-side cleanup can safely retry later.
    }
    setValue(fileValues.filter((file) => file.objectPath !== target.objectPath));
  };

  return <fieldset className="min-w-0 space-y-2.5" data-testid={`fieldset-assessment-question-${question.id}`}>
    <legend className="mb-2 block text-sm font-semibold leading-6 text-[hsl(var(--foreground))]">
      {question.prompt || "Untitled question"}{question.required && <span className="ml-1 text-[hsl(var(--destructive))]" aria-label="required">Required</span>}
    </legend>
    {question.type === "single_choice" && <div className="grid gap-2 sm:grid-cols-2">
      {(question.options ?? []).map((option) => <label key={option} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm">
        <input type="radio" name={question.id} disabled={disabled} checked={value === option} onChange={() => setValue(option)} />
        <span className="break-words">{option}</span>
      </label>)}
    </div>}
    {(question.type === "multiple_choice" || question.type === "likert") && <div className="grid gap-2 sm:grid-cols-2">
      {(question.options ?? []).map((option) => {
        const selected = question.type === "likert" ? value === option : values.includes(option);
        return <label key={option} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm">
          <input
            type={question.type === "likert" ? "radio" : "checkbox"}
            name={question.type === "likert" ? question.id : undefined}
            disabled={disabled}
            checked={selected}
            onChange={(event) => setValue(question.type === "likert"
              ? option
              : event.target.checked ? [...values, option] : values.filter((item) => item !== option))}
          />
          <span className="break-words">{option}</span>
        </label>;
      })}
    </div>}
    {question.type === "long_answer" && <textarea
      disabled={disabled}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => setValue(event.target.value)}
      maxLength={5000}
      rows={4}
      aria-label={question.prompt || "Long answer"}
      data-testid={`input-assessment-answer-${question.id}`}
      className={field}
      placeholder="Write your response"
    />}
    {question.type === "ranking" && <div className="space-y-2">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">Drag to reorder, or use the move controls. First is the highest priority.</p>
      <ol className="space-y-2">
        {(Array.isArray(value) ? value : question.options ?? []).map((option, index, ordered) => {
          const move = (from: number, to: number) => {
            if (to < 0 || to >= ordered.length) return;
            const next = [...ordered];
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item);
            setValue(next);
          };
          return <li
            key={String(option)}
            draggable={!disabled}
            onDragStart={() => setDragged(String(option))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const from = ordered.indexOf(dragged ?? "");
              if (from >= 0) move(from, index);
              setDragged(null);
            }}
            onDragEnd={() => setDragged(null)}
            className="flex min-w-0 items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2.5 text-sm"
          >
            <span className="min-w-0 flex-1 break-words">{index + 1}. {String(option)}</span>
            <button type="button" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} aria-label={`Move ${String(option)} up`} className="grid h-9 w-9 place-items-center rounded-lg border border-[hsl(var(--border))] disabled:opacity-40" data-testid={`button-rank-up-${question.id}-${index}`}><ArrowUp size={15} /></button>
            <button type="button" disabled={disabled || index === ordered.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move ${String(option)} down`} className="grid h-9 w-9 place-items-center rounded-lg border border-[hsl(var(--border))] disabled:opacity-40" data-testid={`button-rank-down-${question.id}-${index}`}><ArrowDown size={15} /></button>
          </li>;
        })}
      </ol>
      {!disabled && <button type="button" className={secondaryButton} onClick={() => setValue(Array.isArray(value) ? value : [...(question.options ?? [])])}>Confirm this order</button>}
    </div>}
    {question.type === "file_upload" && <div className="space-y-3">
      <label {...assessmentFileDrop.fileDropProps} data-drop-active={assessmentFileDrop.isDraggingFiles || undefined} className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm font-medium text-[hsl(var(--foreground))] focus-within:ring-2 focus-within:ring-[hsl(var(--ring))] ${assessmentFileDrop.isDraggingFiles ? "ring-2 ring-[hsl(var(--ring))] bg-[hsl(var(--accent))]" : ""}`}>
        {uploading ? <LoaderCircle size={16} className="animate-spin" /> : <FileUp size={16} />}
        {uploading ? "Uploading privately…" : `Choose up to ${question.fileLimit ?? 1} file(s)`}
        <input
          type="file"
          disabled={disabled || preview || uploading}
          multiple={(question.fileLimit ?? 1) > 1}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.webp"
          onChange={(event) => { void addFiles(event.target.files); event.currentTarget.value = ""; }}
          className="sr-only"
          data-testid={`input-assessment-file-${question.id}`}
        />
      </label>
      {fileValues.length > 0 && <ul className="space-y-2">{fileValues.map((file) => <li key={file.objectPath} className="flex min-w-0 items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs">
        <FileUp size={15} className="shrink-0 text-[hsl(var(--primary))]" />
        <span className="min-w-0 flex-1 truncate">{file.name} · {Math.ceil(file.size / 1024)} KB</span>
        {!disabled && <button type="button" onClick={() => void removeFile(file)} className="min-h-9 rounded px-2 font-semibold text-[hsl(var(--destructive))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]" data-testid={`button-remove-assessment-file-${question.id}`}>Remove</button>}
      </li>)}</ul>}
      <p className="text-xs text-[hsl(var(--muted-foreground))]">Private files are limited to 5 MB each and 10 MB for this response.</p>
    </div>}
    {question.type === "slider" && <div className="space-y-2">
      <div className="flex justify-between gap-3 text-xs text-[hsl(var(--muted-foreground))]"><span>{question.minLabel || question.min}</span><span>{question.maxLabel || question.max}</span></div>
      <input
        type="range"
        min={question.min ?? 0}
        max={question.max ?? 10}
        step={question.step ?? 1}
        disabled={disabled}
        value={typeof value === "number" ? value : question.min ?? 0}
        onChange={(event) => setValue(Number(event.target.value))}
        aria-label={`${question.prompt}. ${question.minLabel || question.min} to ${question.maxLabel || question.max}`}
        className="w-full accent-[hsl(var(--primary))]"
        data-testid={`input-assessment-slider-${question.id}`}
      />
      <p className="text-center text-sm font-semibold tabular-nums" aria-live="polite">{typeof value === "number" ? value : "Choose a value"}</p>
    </div>}
    {question.type === "style_picker" && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {(question.options ?? []).map((option) => {
        const preset = PRESET_OPTIONS.find((item) => item.id === option);
        if (!preset) return null;
        return <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => setValue(option)}
          aria-pressed={value === option}
          className={`min-h-16 rounded-xl border p-2 text-left text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-default ${value === option ? "border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--ring))]/30" : "border-[hsl(var(--border))]"}`}
          style={{ background: preset.background }}
          data-testid={`button-style-answer-${question.id}-${option}`}
        >
          {preset.name}
          <span className="mt-2 block h-1.5 w-9 rounded-full" style={{ backgroundColor: preset.accent }} />
        </button>;
      })}
    </div>}
  </fieldset>;
}

function AssessmentForm({
  assessment,
  initialAnswers = EMPTY_ANSWERS,
  preview = false,
  onSubmitted,
}: {
  assessment: TeamAssessment;
  initialAnswers?: AssessmentAnswers;
  preview?: boolean;
  onSubmitted?: () => void;
}) {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<AssessmentAnswers>(initialAnswers);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const submit = useSubmitTeamAssessment();
  const attemptedSubmit = useRef(false);
  const submitted = useRef(false);
  const latestAnswers = useRef(answers);
  useEffect(() => {
    if (!attemptedSubmit.current) setAnswers(initialAnswers);
  }, [assessment.id, initialAnswers]);
  useEffect(() => {
    latestAnswers.current = answers;
  }, [answers]);
  useEffect(() => () => {
    if (submitted.current) return;
    const fileReferences = Object.values(latestAnswers.current).flatMap((raw) => {
      const value = raw && typeof raw === "object" && !Array.isArray(raw) && "value" in raw
        ? (raw as { value?: unknown }).value
        : undefined;
      return Array.isArray(value) ? value.filter((file): file is UploadedAssessmentFile =>
        Boolean(file && typeof file === "object" && "objectPath" in file && "name" in file),
      ) : [];
    });
    const token = getStoredAuthToken();
    for (const file of fileReferences) {
      void fetch(`/api/storage${file.objectPath}`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }).catch(() => undefined);
    }
  }, []);

  const updateAnswer = (questionId: string, value: unknown) => {
    attemptedSubmit.current = true;
    setAnswers((previous) => ({ ...previous, [questionId]: { value } }));
    setError("");
  };
  const submitAnswers = () => {
    setError("");
    for (const question of assessment.questions) {
      const value = getResponseValue(answers, question.id);
      if (question.required && (value == null || value === "" || (Array.isArray(value) && value.length === 0))) {
        setError(`Answer “${question.prompt}” before submitting.`);
        document.getElementById(`fieldset-assessment-question-${question.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    submit.mutate({ assessmentId: assessment.id, data: { answers } }, {
      onSuccess: () => {
        submitted.current = true;
        void queryClient.invalidateQueries({ queryKey: getGetRequiredTeamAssessmentsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListTeamAssessmentsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetTeamAssessmentResultsQueryKey(assessment.id) });
        onSubmitted?.();
      },
      onError: (mutationError) => setError(getServerError(mutationError)),
    });
  };

  return <form onSubmit={(event) => { event.preventDefault(); if (!preview) submitAnswers(); }} className="space-y-5" data-testid={preview ? "assessment-preview-form" : `assessment-response-form-${assessment.id}`}>
    {assessment.questions.map((question, index) => <section key={question.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 sm:p-5">
      <p className="mono mb-3 text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Question {index + 1} of {assessment.questions.length}</p>
      <AssessmentQuestionInput
        question={question}
        value={getResponseValue(answers, question.id)}
        onChange={(value) => updateAnswer(question.id, value)}
        disabled={false}
        preview={preview}
        assessmentId={assessment.id}
        onError={(message) => setUploadError(message)}
      />
    </section>)}
    {!preview && uploadError && <p role="alert" className="rounded-lg border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-3 text-sm text-[hsl(var(--destructive))]" data-testid="assessment-upload-error">{uploadError}</p>}
    {!preview && error && <p role="alert" className="rounded-lg border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-3 text-sm text-[hsl(var(--destructive))]" data-testid="assessment-submit-error">{error}</p>}
    {!preview && <div className="flex flex-col gap-3 border-t border-[hsl(var(--border))] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">Your answers are saved when you submit this assessment.</p>
      <button type="submit" disabled={submit.isPending} className={primaryButton} data-testid={`button-submit-assessment-${assessment.id}`}>
        {submit.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
        {submit.isPending ? "Submitting…" : "Submit assessment"}
      </button>
    </div>}
  </form>;
}

export function RequiredAssessmentFlow({ items }: { items: RequiredTeamAssessmentList["items"] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const [returnPath, setReturnPath] = useState("/dashboard");
  const [, setLocation] = useLocation();
  const required = useGetRequiredTeamAssessments({
    query: { queryKey: getGetRequiredTeamAssessmentsQueryKey(), refetchInterval: 15_000 },
  });
  const activeItems = required.data?.items ?? items;
  useEffect(() => {
    if (activeItems.length && !activeItems.some((item) => item.id === selectedId)) setSelectedId(activeItems[0].id);
  }, [activeItems, selectedId]);
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem("team-assessment-return-path");
      if (saved) setReturnPath(saved);
      else {
        const current = window.location.pathname + window.location.search;
        window.sessionStorage.setItem("team-assessment-return-path", current);
        setReturnPath(current);
      }
    } catch {
      // A dashboard fallback is still safe when session storage is unavailable.
    }
  }, []);
  const selected = activeItems.find((item) => item.id === selectedId) ?? activeItems[0];
  const finish = () => {
    try {
      window.sessionStorage.removeItem("team-assessment-return-path");
    } catch {
      // Navigation still works without session storage.
    }
    setLocation(returnPath || "/dashboard");
  };
  return <main className="min-h-[100dvh] bg-[hsl(var(--background))] px-4 py-8 text-[hsl(var(--foreground))] sm:px-8">
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"><ClipboardCheck size={22} /></span>
        <div><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Team readiness</p><p className="font-semibold">Required team assessments</p></div>
      </div>
      {activeItems.length === 0 ? <section className={`${card} p-6 sm:p-8`} data-testid="assessment-gate-complete">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><Check size={24} /></div>
        <h1 className="text-2xl font-semibold">You’re all caught up</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">All required assessments have been submitted. Your responses are saved to your account.</p>
        <button type="button" onClick={finish} className={`${primaryButton} mt-6`} data-testid="button-return-to-workspace">Return to workspace <ArrowRight size={16} /></button>
      </section> : <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className={`${card} p-4 sm:p-5`} aria-label="Required assessment list">
          <p className="mono mb-3 text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{activeItems.length} remaining</p>
          <ul className="space-y-2">{activeItems.map((item, index) => <li key={item.id}>
            <button type="button" onClick={() => setSelectedId(item.id)} aria-current={selected?.id === item.id ? "step" : undefined} className={`w-full rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] ${selected?.id === item.id ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5" : "border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"}`} data-testid={`button-required-assessment-${item.id}`}>
              <span className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Required {index + 1}</span><span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300">Not submitted</span></span>
              <span className="mt-1 block text-sm font-semibold text-[hsl(var(--foreground))]">{item.title}</span>
              <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{item.questions.length} questions · {item.kind === "quiz" ? "Quiz" : "Survey"}</span>
            </button>
          </li>)}</ul>
        </section>
        {selected && <section className={`${card} min-w-0 p-4 sm:p-6`} data-testid={`required-assessment-panel-${selected.id}`}>
          <div className="mb-5 rounded-xl p-5 text-white" style={{ background: PRESET_OPTIONS.find((item) => item.id === selected.stylePreset)?.background }}>
            <p className="mono text-[10px] uppercase tracking-[.16em] opacity-85">{selected.kind === "quiz" ? "Required team quiz" : "Required team survey"}</p>
            <h1 className="mt-2 break-words text-2xl font-semibold">{selected.title}</h1>
            {selected.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 opacity-90">{selected.description}</p>}
            <p className="mt-3 text-xs opacity-85">Complete and submit this assessment to unlock your regular workspace.</p>
          </div>
          <AssessmentForm key={selected.id} assessment={selected} />
        </section>}
      </div>}
    </div>
  </main>;
}

export function TeamAssessmentsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const session = useGetSession();
  const isAdmin = session.data?.role === "coordinator" || session.data?.role === "admin";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [embeddedView, setEmbeddedView] = useState<{ mode: "edit" | "results"; assessmentId: string } | null>(null);
  const assessments = useListTeamAssessments({
    query: { queryKey: getListTeamAssessmentsQueryKey(), enabled: isAdmin },
  });
  const required = useGetRequiredTeamAssessments({
    query: { queryKey: getGetRequiredTeamAssessmentsQueryKey(), enabled: !isAdmin && session.data?.authenticated === true },
  });
  const create = useCreateTeamAssessment();
  const pause = usePauseTeamAssessment();
  const publish = usePublishTeamAssessment();
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const createDraft = () => {
    setError("");
    create.mutate({
      data: {
        title: "New team assessment",
        description: "",
        kind: "quiz",
        required: true,
        stylePreset: "robotics",
        questions: [makeQuestion("single_choice")],
      },
    }, {
      onSuccess: (assessment) => {
        void queryClient.invalidateQueries({ queryKey: getListTeamAssessmentsQueryKey() });
        if (embedded) setEmbeddedView({ mode: "edit", assessmentId: assessment.id });
        else setLocation(`/team-assessments/${assessment.id}/edit`);
      },
      onError: (mutationError) => setError(getServerError(mutationError)),
    });
  };
  const runLifecycle = (id: string, action: "publish" | "pause") => {
    const message = action === "publish"
      ? "Publishing makes this assessment required for every member of your team. Continue?"
      : "Pausing stops this assessment from blocking members. Existing responses will remain available. Continue?";
    if (!window.confirm(message)) return;
    setBusyId(id);
    const mutation = action === "publish" ? publish : pause;
    mutation.mutate({ assessmentId: id }, {
      onSuccess: () => {
        setBusyId("");
        void queryClient.invalidateQueries({ queryKey: getListTeamAssessmentsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetRequiredTeamAssessmentsQueryKey() });
      },
      onError: (mutationError) => {
        setBusyId("");
        setError(getServerError(mutationError));
      },
    });
  };

  if (!isAdmin) return <RequiredAssessmentFlow items={required.data?.items ?? []} />;
  if (embeddedView?.mode === "edit") {
    return <TeamAssessmentEditorPage
      assessmentId={embeddedView.assessmentId}
      embedded
      onBack={() => setEmbeddedView(null)}
    />;
  }
  if (embeddedView?.mode === "results") {
    return <TeamAssessmentResultsPage
      assessmentId={embeddedView.assessmentId}
      embedded
      onBack={() => setEmbeddedView(null)}
    />;
  }
  const list = assessments.data?.items ?? [];
  const openEdit = (assessmentId: string) => {
    if (embedded) setEmbeddedView({ mode: "edit", assessmentId });
    else setLocation(`/team-assessments/${assessmentId}/edit`);
  };
  const openResults = (assessmentId: string) => {
    if (embedded) setEmbeddedView({ mode: "results", assessmentId });
    else setLocation(`/team-assessments/${assessmentId}/results`);
  };
  return <div className={`${embedded ? "" : pageSurface} fade-up`} data-testid={embedded ? "team-assessments-settings-content" : undefined}>
    <div className={`mx-auto max-w-6xl ${embedded ? "" : "pb-10"}`}>
    <SectionHeading
      eyebrow="Interview workspace / team readiness"
      title="Team assessments"
      detail="Create required quizzes and surveys, assign them to your team, and review responses."
      action={<button type="button" onClick={createDraft} disabled={create.isPending} className={primaryButton} data-testid="button-create-assessment">
        {create.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />} Create assessment
      </button>}
    />
    {error && <p role="alert" className="mb-4 rounded-lg border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-3 text-sm text-[hsl(var(--destructive))]" data-testid="assessment-action-error">{error}</p>}
    {assessments.isLoading ? <div className={`${card} p-6`} role="status">Loading team assessments…</div>
      : assessments.isError ? <div className={`${card} p-6`} role="alert">
        <p className="font-semibold">Assessments could not be loaded.</p>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{getServerError(assessments.error)}</p>
        <button type="button" onClick={() => void assessments.refetch()} className={`${secondaryButton} mt-4`} data-testid="button-retry-assessments">Try again</button>
      </div>
        : list.length === 0 ? <div className={`${card} p-8 text-center`} data-testid="assessment-list-empty">
          <ClipboardCheck size={25} className="mx-auto text-[hsl(var(--primary))]" />
          <h2 className="mt-3 text-lg font-semibold">No assessments yet</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Create a quiz or survey draft. It will not reach the team until you publish it.</p>
        </div> : <div className="space-y-3" data-testid="assessment-list">
          {list.map((assessment) => {
            const percent = assessment.assignedCount ? Math.round(assessment.responseCount / assessment.assignedCount * 100) : 0;
            return <article key={assessment.id} className={`${card} flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5`} data-testid={`card-team-assessment-${assessment.id}`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-base font-semibold">{assessment.title}</h2>
                  <StatusLabel status={assessment.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">{assessment.description || (assessment.kind === "quiz" ? "Team quiz" : "Team survey")} · {assessment.questions.length} questions</p>
                {assessment.status !== "draft" && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]" data-testid={`text-assessment-completion-${assessment.id}`}>
                  {assessment.responseCount} of {assessment.assignedCount} submitted · {percent}% complete
                </p>}
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                {(assessment.status === "draft" || (assessment.status === "paused" && assessment.responseCount === 0)) && <button type="button" onClick={() => openEdit(assessment.id)} className={secondaryButton} data-testid={`button-edit-assessment-${assessment.id}`}>Edit draft</button>}
                {assessment.status === "published"
                  ? <button type="button" onClick={() => runLifecycle(assessment.id, "pause")} disabled={busyId === assessment.id || pause.isPending} className={secondaryButton} data-testid={`button-pause-assessment-${assessment.id}`}><Pause size={15} />Pause</button>
                  : <button type="button" onClick={() => runLifecycle(assessment.id, "publish")} disabled={busyId === assessment.id || publish.isPending} className={primaryButton} data-testid={`button-publish-assessment-${assessment.id}`}><Rocket size={15} />Publish</button>}
                <button type="button" onClick={() => openResults(assessment.id)} className={secondaryButton} data-testid={`button-results-assessment-${assessment.id}`}>Results <ArrowRight size={15} /></button>
              </div>
            </article>;
          })}
        </div>}
    </div>
  </div>;
}

export function TeamAssessmentEditorPage({
  assessmentId,
  embedded = false,
  onBack,
}: {
  assessmentId: string;
  embedded?: boolean;
  onBack?: () => void;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const detail = useGetTeamAssessment(assessmentId, {
    query: { queryKey: getGetTeamAssessmentQueryKey(assessmentId), enabled: assessmentId !== "new" },
  });
  const pausedResults = useGetTeamAssessmentResults(assessmentId, {
    query: {
      queryKey: getGetTeamAssessmentResultsQueryKey(assessmentId),
      enabled: detail.data?.status === "paused",
    },
  });
  const save = useUpdateTeamAssessment();
  const publish = usePublishTeamAssessment();
  const pause = usePauseTeamAssessment();
  const [draft, setDraft] = useState<TeamAssessment | null>(null);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (detail.data) setDraft(detail.data);
  }, [detail.data]);
  const canEdit = draft !== null && draft.status !== "published" &&
    (draft.status !== "paused" || (pausedResults.data !== undefined && pausedResults.data.responseCount === 0));

  const updateAssessment = (patch: Partial<TeamAssessment>) => {
    setNotice("");
    setDraft((current) => current ? { ...current, ...patch } : current);
  };
  const updateQuestion = (questionId: string, patch: Partial<TeamAssessmentQuestion>) => {
    updateAssessment({ questions: (draft?.questions ?? []).map((question) => question.id === questionId ? { ...question, ...patch } : question) });
  };
  const persist = (afterSave?: (assessment: TeamAssessment) => void) => {
    if (!draft || !canEdit) return;
    setError("");
    const input: TeamAssessmentInput = {
      title: draft.title.trim(),
      description: draft.description,
      kind: draft.kind,
      required: true,
      stylePreset: draft.stylePreset,
      questions: draft.questions,
    };
    const mutation = draft.status === "draft" ? null : save;
    if (draft.status === "draft") {
      save.mutate({ assessmentId: assessmentId, data: input }, {
        onSuccess: (saved) => {
          setDraft(saved);
          setNotice("Draft saved.");
          void queryClient.invalidateQueries({ queryKey: getListTeamAssessmentsQueryKey() });
          afterSave?.(saved);
        },
        onError: (mutationError) => setError(getServerError(mutationError)),
      });
    } else if (mutation) {
      save.mutate({ assessmentId, data: input }, {
        onSuccess: (saved) => {
          setDraft(saved);
          setNotice("Draft saved.");
          void queryClient.invalidateQueries({ queryKey: getListTeamAssessmentsQueryKey() });
          afterSave?.(saved);
        },
        onError: (mutationError) => setError(getServerError(mutationError)),
      });
    }
  };
  const runPublish = () => {
    if (!draft) return;
    const publishNow = () => {
      if (!window.confirm("Publishing makes this assessment required for every member of your team. Continue?")) return;
      publish.mutate({ assessmentId }, {
        onSuccess: (assessment) => {
          setDraft(assessment);
          setNotice("Published and assigned to your team.");
          void queryClient.invalidateQueries({ queryKey: getListTeamAssessmentsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetRequiredTeamAssessmentsQueryKey() });
        },
        onError: (mutationError) => setError(getServerError(mutationError)),
      });
    };
    if (canEdit) persist(publishNow);
    else publishNow();
  };
  const runPause = () => {
    if (!window.confirm("Pausing stops this assessment from blocking members. Existing responses will remain available.")) return;
    pause.mutate({ assessmentId }, {
      onSuccess: (assessment) => {
        setDraft(assessment);
        void queryClient.invalidateQueries({ queryKey: getListTeamAssessmentsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetRequiredTeamAssessmentsQueryKey() });
      },
      onError: (mutationError) => setError(getServerError(mutationError)),
    });
  };
  const addQuestion = () => updateAssessment({ questions: [...(draft?.questions ?? []), makeQuestion()] });
  const moveQuestion = (index: number, delta: number) => {
    if (!draft) return;
    const target = index + delta;
    if (target < 0 || target >= draft.questions.length) return;
    const questions = [...draft.questions];
    const [moved] = questions.splice(index, 1);
    questions.splice(target, 0, moved);
    updateAssessment({ questions });
  };
  const surfaceClass = embedded ? "" : pageSurface;

  if (detail.isLoading) return <div className={surfaceClass}><div className={`${card} p-6`} role="status">Loading assessment editor…</div></div>;
  if (detail.isError || !draft) return <div className={surfaceClass}><div className={`${card} p-6`}>
    <p className="font-semibold">This assessment could not be loaded.</p>
    <button type="button" onClick={() => void detail.refetch()} className={`${secondaryButton} mt-4`}>Try again</button>
  </div></div>;
  const savedCount = draft.questions.length;
  return <div className={`${surfaceClass} fade-up`}>
    <div className={`mx-auto max-w-6xl ${embedded ? "" : "pb-10"}`}>
    <button type="button" onClick={() => onBack ? onBack() : setLocation("/team-assessments")} className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="button-back-assessments"><ArrowLeft size={16} /> All assessments</button>
    <SectionHeading
      eyebrow="Team readiness / editor"
      title={draft.status === "draft" ? "Assessment draft" : "Published assessment"}
      detail="Edit the questions, preview the member experience, and publish only when the assessment is ready."
      action={<div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPreview((current) => !current)} className={secondaryButton} data-testid="button-toggle-assessment-preview"><Eye size={16} />{preview ? "Edit questions" : "Preview"}</button>
        {canEdit && <button type="button" onClick={() => persist()} disabled={save.isPending} className={secondaryButton} data-testid="button-save-assessment"><Save size={16} />{save.isPending ? "Saving…" : "Save draft"}</button>}
        {draft.status === "published" ? <button type="button" onClick={runPause} disabled={pause.isPending} className={secondaryButton} data-testid="button-pause-assessment-editor"><Pause size={16} />Pause</button>
          : <button type="button" onClick={runPublish} disabled={save.isPending || publish.isPending} className={primaryButton} data-testid="button-publish-assessment-editor"><Rocket size={16} />Publish as required</button>}
      </div>}
    />
    <div className="mb-5 flex flex-wrap items-center gap-3"><StatusLabel status={draft.status} /><span className="text-xs text-[hsl(var(--muted-foreground))]">{savedCount} question{savedCount === 1 ? "" : "s"}</span>{notice && <p role="status" className="text-xs text-emerald-800 dark:text-emerald-300" data-testid="assessment-editor-notice">{notice}</p>}</div>
    {error && <p role="alert" className="mb-4 rounded-lg border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 p-3 text-sm text-[hsl(var(--destructive))]" data-testid="assessment-editor-error">{error}</p>}
    {preview ? <section className={`${card} mx-auto max-w-3xl p-4 sm:p-7`} data-testid="assessment-preview">
      <div className="mb-5 rounded-xl p-5 text-white" style={{ background: PRESET_OPTIONS.find((item) => item.id === draft.stylePreset)?.background }}>
        <p className="mono text-[10px] uppercase tracking-[.16em] opacity-80">{draft.kind === "quiz" ? "Team quiz preview" : "Team survey preview"}</p>
        <h2 className="mt-2 text-2xl font-semibold">{draft.title || "Untitled assessment"}</h2>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 opacity-90">{draft.description}</p>
      </div>
      <AssessmentForm assessment={draft} preview />
    </section> : <div className="space-y-5">
      <section className={`${card} grid gap-4 p-4 sm:grid-cols-2 sm:p-5`}>
        <label className="grid gap-1.5 text-sm font-semibold">Assessment title
          <input className={field} maxLength={120} value={draft.title} onChange={(event) => updateAssessment({ title: event.target.value })} disabled={!canEdit} data-testid="input-assessment-title" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">Assessment type
          <select className={field} value={draft.kind} disabled={!canEdit} onChange={(event) => updateAssessment({
            kind: event.target.value as TeamAssessment["kind"],
            questions: draft.questions.map((question) => event.target.value === "survey"
              ? (({ correctAnswers: _correctAnswers, ...rest }) => rest)(question)
              : question),
          })} data-testid="select-assessment-kind">
            <option value="quiz">Quiz · scores choice questions</option>
            <option value="survey">Survey · ungraded</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Instructions <span className="font-normal text-[hsl(var(--muted-foreground))]">Optional</span>
          <textarea className={field} rows={3} maxLength={1000} value={draft.description} onChange={(event) => updateAssessment({ description: event.target.value })} disabled={!canEdit} data-testid="textarea-assessment-description" />
        </label>
        <div className="grid gap-2 sm:col-span-2"><p className="text-sm font-semibold">Member theme</p><p className="text-xs text-[hsl(var(--muted-foreground))]">Choose from these fixed presets. Respondents cannot enter CSS or markup.</p>
          <PresetPicker value={draft.stylePreset} disabled={!canEdit} onChange={(style) => updateAssessment({ stylePreset: style as TeamAssessmentStylePreset })} />
        </div>
      </section>
      {draft.questions.map((question, index) => <section key={question.id} className={`${card} min-w-0 p-4 sm:p-5`} data-testid={`editor-question-${question.id}`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Question {index + 1}</h2>
          <div className="flex items-center gap-1">
            <button type="button" disabled={!canEdit || index === 0} onClick={() => moveQuestion(index, -1)} aria-label={`Move question ${index + 1} up`} className="grid h-10 w-10 place-items-center rounded-lg border border-[hsl(var(--border))] disabled:opacity-40" data-testid={`button-move-question-up-${question.id}`}><ArrowUp size={15} /></button>
            <button type="button" disabled={!canEdit || index === draft.questions.length - 1} onClick={() => moveQuestion(index, 1)} aria-label={`Move question ${index + 1} down`} className="grid h-10 w-10 place-items-center rounded-lg border border-[hsl(var(--border))] disabled:opacity-40" data-testid={`button-move-question-down-${question.id}`}><ArrowDown size={15} /></button>
            <button type="button" disabled={!canEdit || draft.questions.length <= 1} onClick={() => updateAssessment({ questions: draft.questions.filter((item) => item.id !== question.id) })} aria-label={`Delete question ${index + 1}`} className="grid h-10 w-10 place-items-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--destructive))] disabled:opacity-40" data-testid={`button-delete-question-${question.id}`}><Trash2 size={15} /></button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">Question text
            <textarea className={field} rows={2} maxLength={500} value={question.prompt} onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })} disabled={!canEdit} data-testid={`input-question-prompt-${question.id}`} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">Response type
            <select className={field} value={question.type} disabled={!canEdit} onChange={(event) => {
              const next = makeQuestion(event.target.value as TeamAssessmentQuestionType);
              updateQuestion(question.id, { ...next, id: question.id, prompt: question.prompt, required: question.required });
            }} data-testid={`select-question-type-${question.id}`}>
              {QUESTION_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
            </select>
          </label>
        </div>
        <label className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={question.required} disabled={!canEdit} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} data-testid={`checkbox-question-required-${question.id}`} />
          Response is required
        </label>
        {CHOICE_TYPES.has(question.type) && <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="grid gap-1.5 text-sm font-semibold">Options <span className="font-normal text-[hsl(var(--muted-foreground))]">One per line, 2–12 options</span>
            {question.type === "style_picker" ? <div className="grid gap-2 sm:grid-cols-2">{PRESET_OPTIONS.map((preset) => <label key={preset.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-[hsl(var(--border))] p-2 text-sm font-normal">
              <input type="checkbox" checked={(question.options ?? []).includes(preset.id)} disabled={!canEdit} onChange={(event) => updateQuestion(question.id, {
                options: event.target.checked ? [...(question.options ?? []), preset.id] : (question.options ?? []).filter((item) => item !== preset.id),
              })} data-testid={`checkbox-question-style-${question.id}-${preset.id}`} />
              <span>{preset.name}</span>
            </label>)}</div> : <textarea
              className={field}
              rows={4}
              value={(question.options ?? []).join("\n")}
              disabled={!canEdit}
              onChange={(event) => updateQuestion(question.id, { options: event.target.value.split("\n").map((option) => option.trim()).filter(Boolean) })}
              data-testid={`textarea-question-options-${question.id}`}
            />}
          </label>
          {draft.kind === "quiz" && (question.type === "single_choice" || question.type === "multiple_choice") && <fieldset className="grid content-start gap-2">
            <legend className="text-sm font-semibold">Correct {question.type === "single_choice" ? "choice" : "choices"}</legend>
            {(question.options ?? []).map((option) => <label key={option} className="flex min-h-10 items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 text-sm">
              <input type={question.type === "single_choice" ? "radio" : "checkbox"} name={`correct-${question.id}`} checked={(question.correctAnswers ?? []).includes(option)} disabled={!canEdit} onChange={(event) => {
                const correctAnswers = question.type === "single_choice"
                  ? event.target.checked ? [option] : []
                  : event.target.checked ? [...(question.correctAnswers ?? []), option] : (question.correctAnswers ?? []).filter((item) => item !== option);
                updateQuestion(question.id, { correctAnswers });
              }} data-testid={`input-correct-answer-${question.id}-${option}`} />
              {option}
            </label>)}
          </fieldset>}
          {question.type === "style_picker" && <p className="self-start text-xs text-[hsl(var(--muted-foreground))]">This question uses only the four built-in visual presets.</p>}
        </div>}
        {question.type === "slider" && <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(["min", "max", "step"] as const).map((key) => <label key={key} className="grid gap-1.5 text-sm font-semibold">{key === "min" ? "Minimum" : key === "max" ? "Maximum" : "Step"}
            <input type="number" className={field} value={question[key] ?? ""} disabled={!canEdit} onChange={(event) => updateQuestion(question.id, { [key]: event.target.value === "" ? undefined : Number(event.target.value) })} data-testid={`input-question-${key}-${question.id}`} />
          </label>)}
          <label className="grid gap-1.5 text-sm font-semibold">Minimum label
            <input className={field} maxLength={80} value={question.minLabel ?? ""} disabled={!canEdit} onChange={(event) => updateQuestion(question.id, { minLabel: event.target.value })} data-testid={`input-question-min-label-${question.id}`} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">Maximum label
            <input className={field} maxLength={80} value={question.maxLabel ?? ""} disabled={!canEdit} onChange={(event) => updateQuestion(question.id, { maxLabel: event.target.value })} data-testid={`input-question-max-label-${question.id}`} />
          </label>
        </div>}
        {question.type === "file_upload" && <label className="mt-4 grid max-w-xs gap-1.5 text-sm font-semibold">Maximum files for this question
          <input type="number" className={field} min={1} max={3} value={question.fileLimit ?? 1} disabled={!canEdit} onChange={(event) => updateQuestion(question.id, { fileLimit: Math.max(1, Math.min(3, Number(event.target.value) || 1)) })} data-testid={`input-question-file-limit-${question.id}`} />
        </label>}
        {draft.kind === "quiz" && question.type !== "single_choice" && question.type !== "multiple_choice" && <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">This question does not affect the quiz score.</p>}
      </section>)}
      {canEdit && <button type="button" onClick={addQuestion} disabled={draft.questions.length >= 50} className={`${secondaryButton} w-full`} data-testid="button-add-assessment-question"><Plus size={16} />Add question</button>}
      <p className="text-xs text-[hsl(var(--muted-foreground))]">Questions: {draft.questions.length} / 50. Publishing assigns the assessment to every current team account and makes it required.</p>
    </div>}
    {draft.status === "published" && <p className="mt-5 rounded-xl border border-amber-700/20 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">This assessment is published and required. Pause it before editing; submitted responses are preserved.</p>}
    {draft.status === "paused" && pausedResults.data && pausedResults.data.responseCount > 0 && <p className="mt-5 rounded-xl border border-amber-700/20 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">This paused assessment has responses and is read-only. You can republish it without changing the questions.</p>}
    </div>
  </div>;
}

function escapeCsv(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadResults(results: TeamAssessmentResults) {
  const headers = ["Member", "Status", "Score", "Submitted at", ...results.assessment.questions.map((question) => question.prompt)];
  const rows = results.completions.map((completion) => [
    completion.memberName,
    completion.status,
    completion.score == null ? "" : `${completion.score}/${completion.maxScore ?? 0}`,
    completion.submittedAt ?? "",
    ...results.assessment.questions.map((question) => {
      const answer = completion.answers?.[question.id];
      if (!answer || typeof answer !== "object" || !("value" in answer)) return "";
      return (answer as { value?: unknown }).value;
    }),
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${results.assessment.title.trim().replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "assessment"}-results.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function TeamAssessmentResultsPage({
  assessmentId,
  embedded = false,
  onBack,
}: {
  assessmentId: string;
  embedded?: boolean;
  onBack?: () => void;
}) {
  const [, setLocation] = useLocation();
  const resultsQuery = useGetTeamAssessmentResults(assessmentId, {
    query: { queryKey: getGetTeamAssessmentResultsQueryKey(assessmentId) },
  });
  const [selectedMember, setSelectedMember] = useState("");
  const results = resultsQuery.data;
  const selected = useMemo(
    () => results?.completions.find((completion) => completion.interviewerId === selectedMember),
    [results, selectedMember],
  );
  const surfaceClass = embedded ? "" : pageSurface;
  if (resultsQuery.isLoading) return <div className={surfaceClass}><div className={`${card} p-6`} role="status">Loading assessment results…</div></div>;
  if (resultsQuery.isError || !results) return <div className={surfaceClass}><div className={`${card} p-6`}>
    <p className="font-semibold">Results could not be loaded.</p>
    <button type="button" onClick={() => void resultsQuery.refetch()} className={`${secondaryButton} mt-4`}>Try again</button>
  </div></div>;
  const percent = results.assignedCount ? Math.round(results.responseCount / results.assignedCount * 100) : 0;
  return <div className={`${surfaceClass} fade-up`}>
    <div className={`mx-auto max-w-6xl ${embedded ? "" : "pb-10"}`}>
    <SectionHeading
      eyebrow="Team readiness / results"
      title={results.assessment.title}
      detail={`${results.assessment.kind === "quiz" ? "Quiz" : "Survey"} · ${results.assessment.questions.length} questions · ${styleTitle(results.assessment.stylePreset)} theme`}
      action={<button type="button" onClick={() => downloadResults(results)} className={secondaryButton} data-testid="button-export-assessment-results"><Download size={16} />Export CSV</button>}
    />
    <div className="mb-5 flex flex-wrap items-center gap-2"><StatusLabel status={results.assessment.status} />
      <button type="button" onClick={() => onBack ? onBack() : setLocation("/team-assessments")} className={`${secondaryButton} ml-auto`} data-testid="button-results-back"><ArrowLeft size={15} />Back</button>
    </div>
    <section className={`${card} mb-5 grid gap-3 p-4 sm:grid-cols-3 sm:p-5`} aria-label="Completion summary">
      <div><p className="mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Completed</p><p className="mt-1 text-2xl font-semibold">{results.responseCount}<span className="ml-1 text-sm font-normal text-[hsl(var(--muted-foreground))]">/ {results.assignedCount}</span></p></div>
      <div><p className="mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Completion rate</p><p className="mt-1 text-2xl font-semibold">{percent}%</p></div>
      <div><p className="mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Responses</p><p className="mt-1 text-2xl font-semibold">{results.responseCount}</p></div>
    </section>
    <section className="mb-5">
      <h2 className="mb-3 text-lg font-semibold">Question summaries</h2>
      {results.responseCount === 0 ? <div className={`${card} p-5 text-sm text-[hsl(var(--muted-foreground))]`} data-testid="assessment-results-empty">No responses have been submitted yet.</div>
        : <div className="space-y-3">{results.assessment.questions.map((question, index) => {
          const summary = results.summaries.find((item) => item.questionId === question.id);
          return <article key={question.id} className={`${card} p-4`} data-testid={`assessment-question-summary-${question.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold">{index + 1}. {question.prompt}</h3>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{summary?.answeredCount ?? 0} answered</span>
            </div>
            {results.assessment.kind === "quiz" && (question.type === "single_choice" || question.type === "multiple_choice") && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Correct: {(question.correctAnswers ?? []).join(", ") || "Not marked"}</p>}
            {summary?.distribution.length ? <ul className="mt-3 space-y-2">{summary.distribution.map((entry) => <li key={entry.value} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
              <span className="min-w-0 break-words">{entry.value}</span><span className="font-semibold tabular-nums">{entry.count}</span>
            </li>)}</ul> : <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">No answers yet.</p>}
          </article>;
        })}</div>}
    </section>
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Individual responses</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Only team administrators can review individual answers.</p></div></div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className={`${card} max-h-[560px] overflow-y-auto p-3`} aria-label="Member completion status">
          {results.completions.length ? <ul className="space-y-2">{results.completions.map((completion) => <li key={completion.interviewerId}>
            <button type="button" onClick={() => setSelectedMember(completion.interviewerId)} aria-pressed={selectedMember === completion.interviewerId} className={`w-full rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] ${selectedMember === completion.interviewerId ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5" : "border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"}`} data-testid={`button-response-member-${completion.interviewerId}`}>
              <span className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{completion.memberName}</span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${completion.status === "submitted" ? "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300" : "bg-amber-500/10 text-amber-800 dark:text-amber-300"}`}>{completion.status === "submitted" ? "Submitted" : "Pending"}</span></span>
              {completion.status === "submitted" && <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{completion.score == null ? "Survey response" : `Score ${completion.score}/${completion.maxScore}`} · {completion.submittedAt ? new Date(completion.submittedAt).toLocaleString() : "Submitted"}</span>}
            </button>
          </li>)}</ul> : <p className="p-3 text-sm text-[hsl(var(--muted-foreground))]">No team accounts are assigned yet.</p>}
        </div>
        <div className={`${card} min-w-0 p-4 sm:p-5`} data-testid="assessment-individual-response">
          {!selected ? <p className="text-sm text-[hsl(var(--muted-foreground))]">Choose a team member to review their answers.</p>
            : selected.status === "pending" ? <div><h3 className="font-semibold">{selected.memberName}</h3><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">This member has not submitted the assessment.</p></div>
              : <div>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div><h3 className="font-semibold">{selected.memberName}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Submitted {selected.submittedAt ? new Date(selected.submittedAt).toLocaleString() : ""}</p></div>
                  {selected.score != null && <span className="rounded-xl bg-[hsl(var(--primary))]/10 px-3 py-2 text-sm font-bold">{selected.score} / {selected.maxScore}</span>}
                </div>
                <ol className="space-y-4">{results.assessment.questions.map((question, index) => {
                  const answer = selected.answers?.[question.id];
                  const raw = answer && typeof answer === "object" && "value" in answer ? (answer as { value?: unknown }).value : undefined;
                  return <li key={question.id} className="border-t border-[hsl(var(--border))] pt-3">
                    <p className="text-sm font-semibold">{index + 1}. {question.prompt}</p>
                    {Array.isArray(raw) && question.type === "file_upload" ? <ul className="mt-2 space-y-1">{raw.map((file, fileIndex) => {
                      const uploaded = file as UploadedAssessmentFile;
                      return <li key={`${uploaded.objectPath}-${fileIndex}`}><a className="break-all text-sm text-[hsl(var(--primary))] underline" href={`/api/storage${uploaded.objectPath}`} target="_blank" rel="noreferrer">{uploaded.name}</a></li>;
                    })}</ul>
                      : <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[hsl(var(--muted-foreground))]">{raw == null ? "No answer" : Array.isArray(raw) ? raw.join(", ") : String(raw)}</p>}
                  </li>;
                })}</ol>
              </div>}
        </div>
      </div>
    </section>
    </div>
  </div>;
}
