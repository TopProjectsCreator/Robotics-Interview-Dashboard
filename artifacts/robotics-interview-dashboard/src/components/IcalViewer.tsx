/**
 * Read-only preview for iCalendar (.ics) attachments in chat and the CAD
 * workspace. Reuses the same parser as the team calendar's iCal import, so
 * parsed dates, all-day flags and recurrence expansion behave identically.
 */
import { useMemo, useState } from "react";

import { parseIcalText, type ParsedIcalEvent } from "../lib/calendarIcal";

type IcalViewerProps = { name: string; text: string };

function formatEventDate(event: ParsedIcalEvent): string {
  const start = event.startAt;
  const options: Intl.DateTimeFormatOptions = event.allDay
    ? { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }
    : { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  const startText = new Intl.DateTimeFormat(undefined, options).format(start);
  if (event.allDay) return startText;
  return `${startText} – ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(event.endAt)}`;
}

export function IcalViewer({ name, text }: IcalViewerProps) {
  const events = useMemo(() => {
    try { return parseIcalText(text); } catch { return []; }
  }, [text]);
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-[#dce9e8] bg-white" data-testid="ical-viewer">
      <div className="flex items-center justify-between gap-3 border-b border-[#dce9e8] bg-[#edf4f3] px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">
          {name} · {events.length} event{events.length === 1 ? "" : "s"}
        </p>
        <button type="button" onClick={() => setShowRaw((v) => !v)} className="text-[11px] font-semibold text-[#16869a] underline underline-offset-2">
          {showRaw ? "Show events" : "Show source"}
        </button>
      </div>
      {showRaw ? (
        <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap p-3 text-[11px] text-[#52666e]">{text}</pre>
      ) : events.length === 0 ? (
        <p className="p-3 text-xs text-[#7c8c91]">No events were found in this calendar file.</p>
      ) : (
        <ul className="max-h-[360px] divide-y divide-[#eef3f2] overflow-auto">
          {events.slice(0, 250).map((event, index) => (
            <li key={`${event.title}-${event.startAt.toISOString()}-${index}`} className="px-3 py-2">
              <p className="text-xs font-semibold text-[#183a4b]">{event.title || "(untitled event)"}</p>
              <p className="text-[11px] text-[#52666e]">{formatEventDate(event)}</p>
              {event.location && <p className="text-[11px] text-[#7c8c91]">{event.location}</p>}
              {event.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-[#7c8c91]">{event.description}</p>}
            </li>
          ))}
          {events.length > 250 && <li className="px-3 py-2 text-[10px] text-[#7c8c91]">Showing the first 250 of {events.length} events.</li>}
        </ul>
      )}
    </div>
  );
}
