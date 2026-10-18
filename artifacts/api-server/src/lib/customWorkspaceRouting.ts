export function shouldForceCustomWorkspaceTool(question: string): boolean {
  const trimmed = question.trim();
  if (/^(?:how|what|why|when|where)\b/i.test(trimmed)) return false;
  return /\b(?:build|create|make|generate|set\s+up)\b[\s\S]{0,120}\b(?:(?:a|an|the|new|custom|team)\s+)*(?:workspace|application|app|tool|portal)\b/i.test(trimmed);
}
