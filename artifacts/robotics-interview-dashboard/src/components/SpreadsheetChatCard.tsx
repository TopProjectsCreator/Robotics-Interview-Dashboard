import { ChevronRight, FileSpreadsheet } from "lucide-react";

type SpreadsheetChatCardProps = {
  spreadsheetId: string;
  fallbackTitle: string;
  onOpen: () => void;
};

export function SpreadsheetChatCard({ spreadsheetId, fallbackTitle, onOpen }: SpreadsheetChatCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={`button-open-spreadsheet-${spreadsheetId}`}
      className="mt-2 flex w-full items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-left transition hover:border-primary/60 hover:bg-primary/10"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
        <FileSpreadsheet size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-primary">Shared spreadsheet</span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-card-foreground" data-testid={`text-spreadsheet-title-${spreadsheetId}`}>
          {fallbackTitle}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">Open the team worksheet</span>
      </span>
      <ChevronRight size={16} className="ml-auto shrink-0 text-primary" />
    </button>
  );
}