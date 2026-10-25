export type AssistantTaskRecurrence = {
  frequency: "daily" | "weekly";
  hour: number;
  minute: number;
  daysOfWeek: number[];
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    weekday: weekdays[values.weekday] ?? 0,
  };
}

function wallClockToUtc(parts: Omit<ZonedParts, "weekday">, timeZone: string): Date | null {
  const targetLocalMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const matches = (localMs: number): Date[] => {
    const target = new Date(localMs);
    const offsets = new Set<number>();
    for (let hours = -36; hours <= 36; hours += 6) {
      const sample = new Date(localMs + hours * 60 * 60 * 1000);
      const local = zonedParts(sample, timeZone);
      const representedAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
      offsets.add(representedAsUtc - Math.floor(sample.getTime() / 60_000) * 60_000);
    }
    return [...offsets]
      .map((offset) => new Date(localMs - offset))
      .filter((candidate) => {
        const actual = zonedParts(candidate, timeZone);
        return actual.year === target.getUTCFullYear() &&
          actual.month === target.getUTCMonth() + 1 &&
          actual.day === target.getUTCDate() &&
          actual.hour === target.getUTCHours() &&
          actual.minute === target.getUTCMinutes();
      })
      .sort((a, b) => a.getTime() - b.getTime());
  };

  // For a repeated wall time at fall-back, choose its first occurrence. For a
  // skipped wall time at spring-forward, move to the first valid minute after it.
  for (let minuteOffset = 0; minuteOffset <= 180; minuteOffset += 1) {
    const found = matches(targetLocalMs + minuteOffset * 60_000);
    if (found.length) return found[0];
  }
  return null;
}

export function shouldRetryAssistantTaskRun(attempt: number, sideEffectsStarted: boolean, status: number): boolean {
  return attempt < 2 && !sideEffectsStarted && (status === 429 || status === 503);
}

export function assistantTaskRunIdempotencyKey(taskId: string, scheduledFor: Date): string {
  return `${taskId}:${scheduledFor.toISOString()}`;
}

export function validateAssistantTaskSchedule(
  recurrence: AssistantTaskRecurrence,
  timeZone: string,
): string | null {
  if (!timeZone || timeZone.length > 100) return "A valid IANA timezone is required.";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    return "Choose a valid IANA timezone.";
  }
  if (
    !recurrence ||
    !["daily", "weekly"].includes(recurrence.frequency) ||
    !Number.isInteger(recurrence.hour) || recurrence.hour < 0 || recurrence.hour > 23 ||
    !Number.isInteger(recurrence.minute) || recurrence.minute < 0 || recurrence.minute > 59
  ) return "Choose a daily or weekly cadence and a valid local time.";
  const days = recurrence.daysOfWeek;
  if (
    !Array.isArray(days) ||
    (recurrence.frequency === "weekly" && (days.length < 1 || days.length > 7)) ||
    days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
    new Set(days).size !== days.length ||
    (recurrence.frequency === "daily" && days.length !== 0)
  ) return "Weekly schedules need one or more weekdays; daily schedules do not use weekdays.";
  return null;
}

export function nextAssistantTaskOccurrence(
  recurrence: AssistantTaskRecurrence,
  timeZone: string,
  after: Date,
): Date {
  const localNow = zonedParts(after, timeZone);
  const localToday = Date.UTC(localNow.year, localNow.month - 1, localNow.day);
  for (let offset = 0; offset <= 14; offset += 1) {
    const date = new Date(localToday + offset * 86_400_000);
    const weekday = date.getUTCDay();
    if (recurrence.frequency === "weekly" && !recurrence.daysOfWeek.includes(weekday)) continue;
    const candidate = wallClockToUtc({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: recurrence.hour,
      minute: recurrence.minute,
    }, timeZone);
    if (candidate && candidate.getTime() > after.getTime()) return candidate;
  }
  throw new Error("Could not calculate the next scheduled occurrence.");
}
