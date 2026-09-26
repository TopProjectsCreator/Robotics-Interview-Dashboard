import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import DOMPurify from "dompurify";
import {
   AlertCircle, ArrowRight, AtSign, Bot, Check, ChevronRight, CircleDot, ClipboardList,
   FileUp, FileSpreadsheet, Filter, Flag, GripVertical, LayoutDashboard, LogOut, Mail, Menu, MessageSquare, Monitor, Moon, PhoneCall, Printer,
   Mic, Pencil, Pin, Plus, RefreshCw, Reply, RotateCcw, Search, Settings, ShieldCheck, Smile, Sparkles, Sun, Trash2, Type, Upload, UsersRound, Volume1, Megaphone, ClipboardCheck, MonitorCheck, Bell, BellOff, Send, X, Maximize2, Minimize2, Paperclip, Globe, SquareTerminal, Image as ImageIcon, Download, History, SmilePlus, FilePenLine, FileText,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  getGetApplicantQueryKey, getGetAssistantConversationMessagesQueryKey, getGetDashboardSummaryQueryKey, getGetDisplayStateQueryKey, getListAssistantModelsQueryKey,
  getListAssistantConversationsQueryKey,
   getGetInterviewChatQueryKey, getGetQueueQueryKey,   getGetSessionQueryKey, getListApplicantsQueryKey, getListImportHistoryQueryKey, getGetAssistantConfigQueryKey, getGetSystemUsageQueryKey,
  getListChatCustomEmojisQueryKey, useListChatCustomEmojis,
   getListInterviewWhiteboardsQueryKey, getGetInterviewWhiteboardByIdQueryKey,
  useAskAssistant, useAdvanceQueue, useCommitImport, useCreateAssistantConversation, useDeleteAssistantConversation, useGetApplicant, useGetAssistantConfig, useGetAssistantConversationMessages, useGetDashboardSummary,
  useListAssistantConversations, useListAssistantModels, useRenameAssistantConversation,
   useGetDisplayState, useGetInterviewChat, useGetQueue, useGetSession, useListApplicants, useListImportHistory,
   useListInterviewWhiteboards, useCreateInterviewWhiteboard, useGetInterviewWhiteboardById, useUpdateInterviewWhiteboard, useCreateBoard,
   useGenerateAssistantImage, useDeleteApplicant, useRegenerateApplicant, useCallbackQueue, useToggleChatReaction, useToggleChatMessagePin, useUpdateChatMessage, useDeleteChatMessage,
  useListDashboardCharts, useCreateDashboardChart, useUpdateDashboardChart, useDeleteDashboardChart, getListDashboardChartsQueryKey,
  useListInterviewers, getListInterviewersQueryKey, useSetupInterviewerPassword, useCreateInterviewer, useUpdateInterviewerPassword, useResetAllInterviewerPasswords,
  useGetPresence, usePostPresenceHeartbeat, getGetPresenceQueryKey,
  useGetBroadcastCommands, getGetBroadcastCommandsQueryKey, usePostBroadcast,
  useGetDisplaySettings, getGetDisplaySettingsQueryKey, useUpdateDisplaySettings,
  useGetSeatingSettings, getGetSeatingSettingsQueryKey, useUpdateSeatingSettings, useAssignSeat,
  useGetMyBroadcasts, useAckBroadcast, getGetMyBroadcastsQueryKey,
  useKickPresence,
  useGetPresenceStats, getGetPresenceStatsQueryKey,
  useListSnapshots, useCreateSnapshot, useRestoreSnapshot, getListSnapshotsQueryKey,
  useLogin, useLogout, usePreviewImport, useReorderQueue, useRequestUploadUrl, useResetQueue, useSendInterviewChat,
  useUpdateQueueSettings,
  useUpdateApplicant,
  useInterpretApplicantSearch,
  useGetSystemUsage,
  useCreateSpreadsheet,
  getInterviewChat,
  getAssistantConversationMessages,
  listApplicants,
  regenerateApplicant,
} from "@workspace/api-client-react";
import { InterviewerChatEmojiPicker } from "./components/InterviewerChatEmojiPicker";
import { AssistantModelPicker } from "./components/AssistantModelPicker";
import { addTeamEmojiMarkdown, getTeamEmojiStorageUrl } from "./lib/chat-custom-emojis";
import type { Applicant, ApplicantUpdate, AssistantActivity, AssistantConversationList, AssistantHistoryItemsItem, DashboardCount, DashboardSummary, DisplayState, ImportPreview, InterviewChatMessage, QueueApplicant } from "@workspace/api-client-react";
import type { LucideIcon } from "lucide-react";
import { clearStoredAuthToken, getStoredAuthToken, storeAuthToken } from "./authSession";
import { getApplicantSignals, type ApplicantSignals } from "./applicantSignals";
import { SettingsProvider, useWorkspaceSettings, avatarInitials, DEFAULT_SETTINGS, REFRESH_OPTIONS } from "./workspaceSettings";
import { useRealtimeSync } from "./useRealtimeSync";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import ErrorPage, { CrashFallback, isErrorPageCode } from "@/pages/error-pages";
import Landing, { officialDisplayImages } from "@/pages/landing";
import "@/index.css";
import { KOKORO_TEST_PHRASE, TTS_ENGINES, clearLocalTtsCaches, getSelectedEngine, setSelectedEngine, speakSystemVoice, speakWithEngine, warmEngine, type TtsEngineId } from "./lib/localTts";
import { WhiteboardEditor } from "./components/WhiteboardEditor";
import { DocumentEditor } from "./components/DocumentEditor";
import { BoardEditor } from "./components/BoardEditor";
import { BoardChatCard } from "./components/BoardChatCard";
import { SpreadsheetChatCard } from "./components/SpreadsheetChatCard";
import { SpreadsheetEditor } from "./components/SpreadsheetEditor";
import { ChatMentionToken } from "./components/ChatMentionToken";
import { buildApplicantMentionPeople, findChatMentions, messageMentionsInterviewer, type ChatMentionPerson } from "./lib/chat-mentions";
import { isDocumentData } from "./components/documentCollaboration";

const queryClient = new QueryClient();
const categories = ["advance", "hold", "decline", "unranked"];
const statuses = ["queued", "in_progress", "completed"];
type BrowserSpeechResult = { 0?: { transcript?: string } };
type BrowserSpeechEvent = { results: ArrayLike<BrowserSpeechResult> };
type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function Logo({ dark = false }: { dark?: boolean }) {
  return <div className="flex items-center gap-2.5" data-testid="brand-robotics">
    <span className={`relative flex h-9 w-9 items-center justify-center rounded-xl ${dark ? "bg-[#f8c84a] text-[#182232]" : "bg-[#163247] text-[#f8c84a]"}`}>
      <CircleDot size={20} strokeWidth={2.4} /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-current" />
    </span>
    <span className={`leading-none ${dark ? "text-white" : "text-[#182232]"}`}><b className="block text-[15px] tracking-[.18em]">ROBOTICS</b><small className="mono text-[9px] uppercase tracking-[.3em] opacity-60">Tryout control</small></span>
  </div>;
}

function IconButton({ label, children, onClick, testId }: { label: string; children: ReactNode; onClick?: () => void; testId: string }) {
  return <button aria-label={label} data-testid={testId} onClick={onClick} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(var(--border))] bg-white text-[#436070] transition hover:border-[#16869a] hover:text-[#16869a]">{children}</button>;
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "teal" | "yellow" | "red" | "blue" }) {
  const colors = { neutral: "bg-[#edf1f3] text-[#4f626b]", teal: "bg-[#dff4f2] text-[#12737d]", yellow: "bg-[#fff3cf] text-[#805c08]", red: "bg-[#fbe4e2] text-[#9f3b33]", blue: "bg-[#e2ebfa] text-[#375e93]" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.08em] ${colors[tone]}`}>{children}</span>;
}
function ChatActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="top" className="border-0 bg-[#183a4b] px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg">{label}</TooltipContent>
  </Tooltip>;
}

function Skeleton({ className = "" }: { className?: string }) { return <div className={`animate-pulse rounded-lg bg-[#dfe7ea] ${className}`} />; }

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const dark = mounted && theme === "dark";
  return <button onClick={() => setTheme(dark ? "light" : "dark")} title={dark ? "Switch to light mode" : "Switch to dark mode"} aria-label="Toggle color theme" data-testid="button-theme-toggle" className="rounded-lg p-2 transition hover:bg-[#e3ebeb]">{mounted && dark ? <Sun size={17} className="text-[#f8c84a]" /> : <Moon size={17} className="text-[#60757c]" />}</button>;
}

function SignalChips({ signals }: { signals: ApplicantSignals }) {
  const chips: ({ label: string; className: string; title: string } | null)[] = [];
  if (signals.skill === "BUILD") chips.push({ label: "Build", className: "bg-[#e7f4ec] text-[#1d7a44]", title: "Strongest signal: hands-on build experience" });
  else if (signals.skill === "CODE") chips.push({ label: "Code", className: "bg-[#efe7fb] text-[#5e35b1]", title: "Strongest signal: coding / software experience" });
  else if (signals.skill === "CAD") chips.push({ label: "CAD", className: "bg-[#e5effc] text-[#1a5fb4]", title: "Strongest signal: CAD / 3D design experience" });
  chips.push(signals.gender === "M"
    ? { label: "M", className: "bg-[#e5effc] text-[#1a5fb4]", title: "Gender" }
    : signals.gender === "F"
      ? { label: "F", className: "bg-[#fbe4ec] text-[#b0144f]", title: "Gender" }
      : null);
  const visible = chips.filter((c): c is { label: string; className: string; title: string } => c !== null);
  return <span className="flex flex-wrap items-center gap-1">{visible.map(c => <span key={c.label} title={c.title} className={`mono rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${c.className}`}>{c.label}</span>)}</span>;
}
function Toggle({ on, onChange, testId, label }: { on: boolean; onChange: (v: boolean) => void; testId: string; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} data-testid={testId} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-[#16869a]" : "bg-[#cbd9da]"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></button>;
}
function Segmented<T extends string | number>({ options, value, onChange, testId }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testId: string }) {
  return <div className="flex rounded-lg border border-[#dce5e5] bg-[#f3f6f5] p-1" data-testid={testId}>{options.map(o => <button key={String(o.value)} onClick={() => onChange(o.value)} className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition ${o.value === value ? "bg-white text-[#183a4b] shadow-sm" : "text-[#7c8c91] hover:text-[#385762]"}`}>{o.label}</button>)}</div>;
}
function SettingRow({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="text-sm font-semibold">{title}</p>{detail && <p className="mt-0.5 text-xs text-[#7c8c91]">{detail}</p>}</div><div className="shrink-0">{children}</div></div>;
}
function AccountMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { settings } = useWorkspaceSettings();
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const [, setLocation] = useLocation();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("pointerdown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open ]);
  const name = session.data?.label || settings.displayName.trim() || "Interviewer";
  return <div ref={ref} className="relative">
    <button onClick={() => setOpen(o => !o)} aria-label="Account menu" aria-haspopup="menu" data-testid="button-account-menu" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#dcecea] text-xs font-bold text-[#176a77] transition hover:brightness-95">{avatarInitials(settings)}</button>
    {open && <div role="menu" data-testid="account-menu" className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-[#dce5e5] bg-white shadow-2xl">
      <div className="border-b border-[#e5ecec] px-4 py-3"><p className="truncate text-sm font-semibold">{name}</p><p className="mono mt-0.5 text-[10px] uppercase tracking-[.14em] text-[#7c8c91]">Interviewer account</p></div>
      <div className="p-2">
        <button role="menuitem" onClick={() => { setOpen(false); onOpenSettings(); }} data-testid="button-open-settings" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#385762] transition hover:bg-[#f1f6f5]"><Settings size={16} /> Settings</button>
        <button role="menuitem" onClick={() => logout.mutate(undefined, { onSuccess: () => { clearStoredAuthToken(); queryClient.clear(); setLocation("/"); } })} data-testid="button-logout-menu" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#a34d46] transition hover:bg-[#f6f9f8]"><LogOut size={16} /> End session</button>
      </div>
    </div>}
  </div>;
}
const SORT_OPTIONS = [{ value: "rank", label: "Rank" }, { value: "queue", label: "Queue order" }, { value: "score", label: "AI score" }, { value: "name", label: "Name" }, { value: "grade", label: "Grade" }, { value: "skill", label: "Skill" }, { value: "gender", label: "Gender" }, { value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }];
function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, update, reset } = useWorkspaceSettings();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [notifyState, setNotifyState] = useState(() => browserNotifyPermission());
  const [refreshed, setRefreshed] = useState(false);
  const [passwordAdminCode, setPasswordAdminCode] = useState("");
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [passwordNotice, setPasswordNotice] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const interviewerAccounts = useListInterviewers({ query: { queryKey: getListInterviewersQueryKey() } });
  const updateInterviewerPassword = useUpdateInterviewerPassword();
  const resetAllInterviewerPasswords = useResetAllInterviewerPasswords();
  const enableNotifications = async () => {
    try { if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission(); } catch { /* ignore */ }
    setNotifyState(browserNotifyPermission());
  };
  const refreshAll = () => { qc.invalidateQueries(); setRefreshed(true); };
  const finishPasswordAction = (message: string, resetSession = false) => {
    setPasswordNotice(message);
    setPasswordError("");
    qc.invalidateQueries({ queryKey: getListInterviewersQueryKey() });
    if (resetSession) {
      clearStoredAuthToken();
      qc.clear();
      onClose();
      setLocation("/");
    }
  };
  const changeInterviewerPassword = (interviewerId: string, password: string | null, confirmLowExposure = false) => {
    setPasswordNotice("");
    setPasswordError("");
    if (!passwordAdminCode.trim()) {
      setPasswordError("Enter the event passcode first.");
      return;
    }
    if (password !== null && !password.trim()) {
      setPasswordError("Enter a new password or use Reset.");
      return;
    }
    updateInterviewerPassword.mutate(
      {
        interviewerId,
        data: {
          eventPassword: passwordAdminCode.trim(),
          password,
          ...(confirmLowExposure ? { confirmLowExposure: true } : {}),
        },
      },
      {
        onSuccess: () => {
          if (password !== null) {
            setPasswordDrafts(current => ({ ...current, [interviewerId]: "" }));
          }
          finishPasswordAction(
            password === null ? "Password removed. That interviewer must set one up at next sign-in." : "Password updated.",
            password === null && session.data?.interviewerId === interviewerId,
          );
        },
        onError: error => {
          const issue = passwordSafetyIssue(error);
          if (issue?.code === "PASSWORD_EXPOSURE_WARNING") {
            if (!confirmLowExposure && issue.count && window.confirm(passwordExposureConfirmation(issue.count))) {
              changeInterviewerPassword(interviewerId, password, true);
              return;
            }
            setPasswordError("Password was not changed. Choose a different password.");
            return;
          }
          setPasswordError(passwordSafetyErrorMessage(issue) ?? "Could not update that password. Check the event passcode and try again.");
        },
      },
    );
  };
  const resetEveryPassword = () => {
    setPasswordNotice("");
    setPasswordError("");
    if (!passwordAdminCode.trim()) {
      setPasswordError("Enter the event passcode first.");
      return;
    }
    if (!window.confirm("Reset every interviewer password? Everyone will need to set up a new password before signing in again.")) return;
    resetAllInterviewerPasswords.mutate(
      { data: { eventPassword: passwordAdminCode.trim() } },
      {
        onSuccess: () => finishPasswordAction("All passwords were reset. Set up a new password to continue.", true),
        onError: () => setPasswordError("Could not reset all passwords. Check the event passcode and try again."),
      },
    );
  };
  const passwordBusy = updateInterviewerPassword.isPending || resetAllInterviewerPasswords.isPending;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#112433]/55 p-4" onClick={onClose} data-testid="settings-modal">
    <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Workspace settings" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#dce5e5] bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[.16em] text-[#16869a]">Workspace settings</p><h2 className="mt-1 text-lg font-semibold tracking-[-.02em]">Tune your station</h2><p className="mt-1 text-xs text-[#7c8c91]">Saved on this device only — your co-coordinator keeps their own.</p></div><button onClick={onClose} aria-label="Close settings" data-testid="button-close-settings" className="rounded-lg p-2 text-[#60757c] transition hover:bg-[#f1f6f5]"><X size={16} /></button></div>
      <div className="mt-4 border-t border-[#e5ecec] pt-2"><p className="mono mt-3 text-[10px] uppercase tracking-[.16em] text-[#7c8c91]">Profile</p>
        <SettingRow title="Display name" detail="Shown in the account menu"><input value={settings.displayName} onChange={e => update({ displayName: e.target.value })} data-testid="input-settings-name" placeholder="Coordinator" className="h-10 w-44 rounded-lg border border-[#dce5e5] bg-white px-3 text-sm outline-none focus:border-[#16869a]" /></SettingRow>
        <SettingRow title="Avatar initials" detail="Defaults to your name initials"><input value={settings.initials} onChange={e => update({ initials: e.target.value.toUpperCase().slice(0, 2) })} data-testid="input-settings-initials" placeholder={avatarInitials({ ...settings, initials: "" })} maxLength={2} className="mono h-10 w-20 rounded-lg border border-[#dce5e5] bg-white px-3 text-center text-sm font-bold uppercase outline-none focus:border-[#16869a]" /></SettingRow>
      </div>
      <div className="mt-2 border-t border-[#e5ecec] pt-2"><p className="mono mt-3 text-[10px] uppercase tracking-[.16em] text-[#7c8c91]">Appearance</p>
        <SettingRow title="Theme" detail="Dark is easier on the eyes at night events"><Segmented options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} value={theme === "dark" ? "dark" : "light"} onChange={(v) => setTheme(v)} testId="segment-settings-theme" /></SettingRow>
        <SettingRow title="Row density" detail="Compact fits more applicants per screen"><Segmented options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} value={settings.density} onChange={(v) => update({ density: v })} testId="segment-settings-density" /></SettingRow>
        <SettingRow title="Applicant photos" detail="Show profile photos in the list"><Toggle on={settings.showPhotos} onChange={(v) => update({ showPhotos: v })} testId="toggle-settings-photos" label="Applicant photos" /></SettingRow>
        <SettingRow title="Reduce motion" detail="Turns off animations and transitions"><Toggle on={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} testId="toggle-settings-motion" label="Reduce motion" /></SettingRow>
      </div>
      <div className="mt-2 border-t border-[#e5ecec] pt-2"><p className="mono mt-3 text-[10px] uppercase tracking-[.16em] text-[#7c8c91]">Applicants list</p>
        <SettingRow title="Default sort" detail="Used when the Applicants page loads"><select value={SORT_OPTIONS.some(o => o.value === settings.defaultSort) ? settings.defaultSort : "rank"} onChange={e => update({ defaultSort: e.target.value })} data-testid="select-settings-sort" className="h-10 rounded-lg border border-[#dce5e5] bg-white px-3 text-sm">{SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></SettingRow>
      </div>
      <div className="mt-2 border-t border-[#e5ecec] pt-2"><p className="mono mt-3 text-[10px] uppercase tracking-[.16em] text-[#7c8c91]">Live updates</p>
        <SettingRow title="Auto-refresh" detail="Keep queue and attendance boards live"><Toggle on={settings.autoRefresh} onChange={(v) => update({ autoRefresh: v })} testId="toggle-settings-refresh" label="Auto-refresh" /></SettingRow>
        <SettingRow title="Instant updates" detail="Pushes changes in about a second via Supabase Realtime. Polling stays on as backup."><Toggle on={settings.realtime} onChange={(v) => update({ realtime: v })} testId="toggle-settings-realtime" label="Instant updates" /></SettingRow>
        <SettingRow title="Refresh interval" detail="How often live boards poll"><Segmented options={REFRESH_OPTIONS} value={REFRESH_OPTIONS.some(o => o.value === settings.refreshMs) ? settings.refreshMs : 3000} onChange={(v) => update({ refreshMs: v })} testId="segment-settings-interval" /></SettingRow>
      </div>
      <div className="mt-2 border-t border-[#e5ecec] pt-2"><p className="mono mt-3 text-[10px] uppercase tracking-[.16em] text-[#7c8c91]">Notifications</p>
       <SettingRow title="Browser notifications" detail={notifyState === "granted" ? "On — broadcasts and chat mentions pop up in another tab" : notifyState === "denied" ? "Blocked — allow them in browser site settings" : "Off — enable to catch broadcasts and chat mentions"}>{notifyState === "granted" ? <span className="flex items-center gap-2 text-xs font-semibold text-[#28a47f]"><Bell size={14} /> On</span> : <button onClick={enableNotifications} data-testid="button-settings-notify" className="rounded-lg bg-[#183a4b] px-4 py-2 text-xs font-semibold text-white">Enable</button>}</SettingRow>
      </div>
      <div className="mt-2 border-t border-[#e5ecec] pt-2"><p className="mono mt-3 text-[10px] uppercase tracking-[.16em] text-[#7c8c91]">Interviewer passwords</p>
        <p className="mt-2 text-xs leading-5 text-[#7c8c91]">Use the event passcode to set or remove a personal password. Removing one sends that interviewer through setup again.</p>
        <label className="mt-3 block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.12em] text-[#63747c]">Event passcode</span><input type="password" autoComplete="current-password" value={passwordAdminCode} onChange={e => setPasswordAdminCode(e.target.value)} data-testid="input-settings-event-passcode" className="h-10 w-full rounded-lg border border-[#dce5e5] bg-white px-3 text-sm outline-none focus:border-[#16869a]" /></label>
        <div className="mt-3 divide-y divide-[#edf1f1] rounded-xl border border-[#e5ecec] bg-[#f8fbfa]">
          {interviewerAccounts.isLoading && <p className="px-3 py-3 text-xs text-[#7c8c91]">Loading interviewer accounts…</p>}
          {interviewerAccounts.data?.items.map(account => <div key={account.id} className="space-y-2 px-3 py-3">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{account.displayName}</p><p className="text-[11px] text-[#7c8c91]">{account.hasPassword ? "Password is set" : "Setup required"}</p></div><Badge tone={account.hasPassword ? "teal" : "yellow"}>{account.hasPassword ? "Ready" : "Needs setup"}</Badge></div>
            <div className="flex flex-wrap gap-2"><input type="password" autoComplete="new-password" value={passwordDrafts[account.id] ?? ""} onChange={e => setPasswordDrafts(current => ({ ...current, [account.id]: e.target.value }))} placeholder="New password" data-testid={`input-settings-password-${account.id}`} className="h-9 min-w-[150px] flex-1 rounded-lg border border-[#dce5e5] bg-white px-3 text-xs outline-none focus:border-[#16869a]" /><button type="button" disabled={passwordBusy} onClick={() => changeInterviewerPassword(account.id, passwordDrafts[account.id] ?? "")} data-testid={`button-settings-set-password-${account.id}`} className="rounded-lg bg-[#16869a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Set</button><button type="button" disabled={passwordBusy} onClick={() => changeInterviewerPassword(account.id, null)} data-testid={`button-settings-reset-password-${account.id}`} className="rounded-lg border border-[#e0b8b4] bg-white px-3 py-2 text-xs font-semibold text-[#a34d46] disabled:opacity-50">Reset</button></div>
          </div>)}
        </div>
        <button type="button" disabled={passwordBusy} onClick={resetEveryPassword} data-testid="button-settings-reset-all-passwords" className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#e0b8b4] bg-white px-3 py-2.5 text-xs font-semibold text-[#a34d46] disabled:opacity-50"><Trash2 size={14} />{resetAllInterviewerPasswords.isPending ? "Resetting all passwords…" : "Reset all interviewer passwords"}</button>
        {passwordNotice && <p className="mt-2 text-xs font-semibold text-[#247d63]" data-testid="settings-password-success">{passwordNotice}</p>}
        {passwordError && <p className="mt-2 text-xs font-semibold text-[#b34a42]" data-testid="settings-password-error">{passwordError}</p>}
      </div>
      <div className="mt-2 border-t border-[#e5ecec] pt-2"><p className="mono mt-3 text-[10px] uppercase tracking-[.16em] text-[#7c8c91]">Data</p>
        <SettingRow title="Refresh all data" detail={refreshed ? "Done — everything reloaded" : "Reload every board from the server"}><button onClick={refreshAll} data-testid="button-settings-refresh-data" className="flex items-center gap-2 rounded-lg border border-[#cbd9da] bg-white px-4 py-2 text-xs font-semibold text-[#385762]"><RefreshCw size={14} /> Reload</button></SettingRow>
        <SettingRow title="Reset all settings" detail="Back to defaults on this device"><button onClick={reset} data-testid="button-settings-reset" className="flex items-center gap-2 rounded-lg border border-[#e0b8b4] bg-white px-4 py-2 text-xs font-semibold text-[#a34d46]"><RotateCcw size={14} /> Reset</button></SettingRow>
      </div>
      <button onClick={onClose} data-testid="button-settings-done" className="mt-5 w-full rounded-xl bg-[#183a4b] py-3 text-sm font-semibold text-white">Done</button>
    </div>
  </div>;
}
function ErrorState({ onRetry, compact = false }: { onRetry?: () => void; compact?: boolean }) {
  return <div className={`flex ${compact ? "min-h-[160px]" : "min-h-[320px]"} flex-col items-center justify-center gap-3 text-center`} data-testid="status-error"><AlertCircle className="text-[#bd5047]" /><p className="font-semibold">Control link unavailable</p><p className="text-sm text-[#63747c]">The live event data could not be reached.</p>{onRetry && <button onClick={onRetry} data-testid="button-retry" className="rounded-lg bg-[#183a4b] px-4 py-2 text-sm font-semibold text-white">Retry connection</button>}</div>;
}

function renderInlineMarkdown(text: string, mentionPeople: readonly ChatMentionPerson[] = []): ReactNode[] {
  const tokenPattern = /(!\[[^\]]*\]\((?:https?:\/\/|\/api\/storage\/)[^)]+\)|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|mailto:|\/api\/storage\/)[^)]+\)|\*[^*]+\*|_[^_]+_)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  const pushText = (segment: string) => {
    const mentions = findChatMentions(segment, mentionPeople);
    if (!mentions.length) {
      nodes.push(segment);
      return;
    }
    let textCursor = 0;
    for (const mention of mentions) {
      if (mention.start > textCursor) nodes.push(segment.slice(textCursor, mention.start));
      nodes.push(<ChatMentionToken key={`mention-${key++}`} mentionText={mention.text} person={mention.person} />);
      textCursor = mention.end;
    }
    if (textCursor < segment.length) nodes.push(segment.slice(textCursor));
  };

  while ((match = tokenPattern.exec(text))) {
    if (match.index > cursor) pushText(text.slice(cursor, match.index));
    const token = match[0];
    const tokenKey = `inline-${key++}`;
    const image = token.match(/^!\[([^\]]*)\]\(((?:https?:\/\/|\/api\/storage\/)[^)]+)\)$/);
    if (image) {
      const customEmoji = image[1].startsWith("emoji:");
      nodes.push(image[2].startsWith("/api/storage/")
        ? <AuthenticatedChatImage key={tokenKey} src={image[2]} alt={customEmoji ? `:${image[1].slice("emoji:".length)}:` : image[1]} inline={customEmoji} />
        : <img key={tokenKey} src={image[2]} alt={image[1]} loading="lazy" className="my-2 block max-w-full rounded-xl border border-[#dce9e8]" />);
      cursor = match.index + token.length;
      continue;
    }
    const link = token.match(/^\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/api\/storage\/)[^)]+)\)$/);
    if (link) {
      nodes.push(link[2].startsWith("/api/storage/")
        ? <AuthenticatedChatAttachment key={tokenKey} src={link[2]} name={link[1]} />
        : <a key={tokenKey} href={link[2]} target="_blank" rel="noreferrer" className="font-medium text-[#16869a] underline decoration-[#9bcfce] underline-offset-2 hover:text-[#106d7a]">{link[1]}</a>);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={tokenKey}>{renderInlineMarkdown(token.slice(2, -2), mentionPeople)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={tokenKey} className="rounded bg-[#edf4f3] px-1 py-0.5 font-mono text-[.9em] text-[#315a61]">{token.slice(1, -1)}</code>);
    } else if (token.startsWith("*") || token.startsWith("_")) {
      nodes.push(<em key={tokenKey}>{renderInlineMarkdown(token.slice(1, -1), mentionPeople)}</em>);
    }
    cursor = match.index + token.length;
  }

  if (cursor < text.length) pushText(text.slice(cursor));
  return nodes.length ? nodes : [text];
}

function appRelativeUrl(path: string): string {
  if (/^https?:\/\//i.test(path) || !path.startsWith("/")) return path;
  const base = String(import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  return `${base}${path}`;
}

function AuthenticatedChatImage({ src, alt, inline = false }: { src: string; alt: string; inline?: boolean }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    const controller = new AbortController();
    const token = getStoredAuthToken();
    void fetch(appRelativeUrl(src), {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(response => {
        if (!response.ok) throw new Error(`Image request failed (${response.status})`);
        return response.blob();
      })
      .then(blob => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src]);

  if (failed) return inline
    ? <span className="inline-block h-5 w-5 align-[-0.25em] rounded bg-[#edf4f3] text-center text-[10px] text-[#8a999d]" role="img" aria-label={`${alt} unavailable`}>?</span>
    : <span className="my-2 block text-xs text-[#8a999d]">Image unavailable.</span>;
  if (!objectUrl) return inline
    ? <span className="inline-block h-5 w-5 animate-pulse align-[-0.25em] rounded bg-[#edf4f3]" role="img" aria-label={`Loading ${alt}`} />
    : <span className="my-2 block h-24 w-36 animate-pulse rounded-xl bg-[#edf4f3]" aria-label="Loading image" />;
  return <img src={objectUrl} alt={alt} loading="lazy" className={inline ? "mx-0.5 inline-block h-5 w-5 align-[-0.25em] rounded object-contain" : "my-2 block max-w-full rounded-xl border border-[#dce9e8]"} />;
}

type ChatAttachmentSheet = { name: string; rows: string[][] };
type ChatAttachmentKind = "audio" | "document" | "image" | "pdf" | "spreadsheet" | "text" | "video";

function attachmentExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function attachmentKind(name: string, contentType: string): ChatAttachmentKind {
  const extension = attachmentExtension(name);
  if (contentType.startsWith("image/") || ["avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"].includes(extension)) return "image";
  if (contentType.startsWith("video/") || ["avi", "m4v", "mkv", "mov", "mp4", "webm"].includes(extension)) return "video";
  if (contentType.startsWith("audio/") || ["aac", "flac", "m4a", "mp3", "oga", "ogg", "wav"].includes(extension)) return "audio";
  if (contentType === "application/pdf" || extension === "pdf") return "pdf";
  if (
    contentType.includes("spreadsheet") ||
    contentType === "application/vnd.ms-excel" ||
    ["csv", "tsv", "xls", "xlsx"].includes(extension)
  ) return ["csv", "tsv"].includes(extension) || contentType.startsWith("text/") ? "text" : "spreadsheet";
  if (contentType.startsWith("text/") || ["log", "md", "rtf", "txt"].includes(extension)) return "text";
  return "document";
}

function parseDelimitedPreview(source: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length && rows.length < 100; index += 1) {
    const character = source[index];
    if (character === "\"") {
      if (quoted && source[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some(value => value.trim())) rows.push(row);
  }
  return rows.map(values => values.slice(0, 18));
}

function ChatAttachmentTable({ rows, label }: { rows: string[][]; label: string }) {
  if (!rows.length) return <p className="rounded-lg bg-[#f7faf9] p-3 text-xs text-[#7c8c91]">This file is empty.</p>;
  const width = Math.max(...rows.map(row => row.length), 1);
  const header = rows[0];
  return <div className="overflow-hidden rounded-xl border border-[#dce9e8] bg-white">
    <div className="border-b border-[#dce9e8] bg-[#edf4f3] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">{label} · {rows.length} rows</div>
    <div className="max-h-[360px] overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead><tr>{Array.from({ length: width }, (_, index) => <th key={`head-${index}`} className="sticky top-0 border-b border-[#dce9e8] bg-[#f7faf9] px-3 py-2 text-left font-semibold text-[#183a4b]">{header[index] || `Column ${index + 1}`}</th>)}</tr></thead>
        <tbody>{rows.slice(1).map((row, rowIndex) => <tr key={`row-${rowIndex}`} className="odd:bg-white even:bg-[#f7faf9]">{Array.from({ length: width }, (_, cellIndex) => <td key={`cell-${rowIndex}-${cellIndex}`} className="max-w-[260px] border-b border-[#eef3f2] px-3 py-2 align-top text-[#52666e]">{row[cellIndex] ?? ""}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </div>;
}

function ChatAttachmentDocument({ name, html, objectUrl }: { name: string; html: string | null; objectUrl: string | null }) {
  if (html) {
    return <div className="rounded-xl border border-[#dce9e8] bg-white p-4"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">{name} · document preview</p><div className="prose prose-sm max-w-none text-[#52666e]" dangerouslySetInnerHTML={{ __html: html }} /></div>;
  }
  if (!objectUrl) return null;
  return <div className="rounded-xl border border-[#dce9e8] bg-white p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">{name} · document preview</p><iframe title={name} src={objectUrl} className="h-[360px] w-full rounded-lg border border-[#eef3f2] bg-[#f7faf9]" /></div>;
}

function AuthenticatedChatAttachment({ src, name }: { src: string; name: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState("");
  const [text, setText] = useState<string | null>(null);
  const [sheets, setSheets] = useState<ChatAttachmentSheet[]>([]);
  const [documentHtml, setDocumentHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const kind = attachmentKind(name, contentType);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    const controller = new AbortController();
    const token = getStoredAuthToken();
    void fetch(appRelativeUrl(src), {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error(`Attachment request failed (${response.status})`);
        const responseType = normalizeChatFileType(response.headers.get("content-type") ?? "");
        const blob = await response.blob();
        const resolvedType = responseType || normalizeChatFileType(blob.type);
        if (!active) return;
        setContentType(resolvedType);
        const resolvedKind = attachmentKind(name, resolvedType);
        if (resolvedKind === "text") {
          const raw = await blob.text();
          if (active) setText(raw.slice(0, 250000));
          return;
        }
        if (resolvedKind === "spreadsheet") {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(await blob.arrayBuffer(), { type: "array", cellDates: true });
          const parsedSheets = workbook.SheetNames.slice(0, 8).map(sheetName => ({
            name: sheetName,
            rows: (XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" }) as unknown[][])
              .slice(0, 100)
              .map(row => row.slice(0, 18).map(cell => String(cell ?? ""))),
          }));
          if (active) setSheets(parsedSheets);
          return;
        }
        if (resolvedKind === "document" && /\.(docx)$/i.test(name)) {
          const mammoth = await import("mammoth");
          const documentBytes = await blob.arrayBuffer();
          // Mammoth's browser build reads `arrayBuffer`; its Node build reads
          // `buffer`. Supplying both keeps the preview testable without
          // changing the browser bundle selected by Vite.
          const converted = await mammoth.convertToHtml({
            arrayBuffer: documentBytes,
            buffer: documentBytes,
          } as unknown as Parameters<typeof mammoth.convertToHtml>[0]);
          const clean = DOMPurify.sanitize(converted.value, { USE_PROFILES: { html: true } });
          if (active) setDocumentHtml(clean);
          return;
        }
        createdUrl = URL.createObjectURL(blob);
        if (active) setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [name, src]);

  if (failed) return <div className="my-2 rounded-xl border border-[#e0b8b4] bg-[#fff8f7] p-3 text-xs text-[#a34d46]">Couldn’t render {name}.</div>;
  if (!objectUrl && text === null && !sheets.length && documentHtml === null) return <div className="my-2 h-24 animate-pulse rounded-xl bg-[#edf4f3]" aria-label={`Loading ${name}`} />;
  if (text !== null) {
    const extension = attachmentExtension(name);
    const delimiter = extension === "tsv" ? "\t" : text.split("\n")[0]?.includes("\t") ? "\t" : ",";
    const isDelimited = ["csv", "tsv"].includes(extension) || contentType === "text/csv" || contentType === "text/tab-separated-values";
    const rows = isDelimited ? parseDelimitedPreview(text, delimiter) : [];
    return <div className="my-2 space-y-2">{rows.length > 0 ? <ChatAttachmentTable rows={rows} label={name} /> : <pre className="max-h-[360px] overflow-auto rounded-xl border border-[#dce9e8] bg-[#f7faf9] p-3 text-xs leading-5 text-[#52666e]">{text}</pre>}</div>;
  }
  if (sheets.length) return <div className="my-2 space-y-3">{sheets.map(sheet => <ChatAttachmentTable key={sheet.name} rows={sheet.rows} label={`${name} · ${sheet.name}`} />)}</div>;
  if (kind === "image" && objectUrl) return <img src={objectUrl} alt={name} loading="lazy" className="my-2 block max-h-[520px] max-w-full rounded-xl border border-[#dce9e8] object-contain" />;
  if (kind === "video" && objectUrl) return <video src={objectUrl} controls preload="metadata" className="my-2 max-h-[520px] max-w-full rounded-xl border border-[#dce9e8] bg-[#183a4b]" />;
  if (kind === "audio" && objectUrl) return <audio src={objectUrl} controls className="my-2 w-full max-w-[440px]" />;
  if (kind === "pdf" && objectUrl) return <iframe title={name} src={objectUrl} className="my-2 h-[520px] w-full rounded-xl border border-[#dce9e8] bg-white" />;
  return <ChatAttachmentDocument name={name} html={documentHtml} objectUrl={objectUrl} />;
}

function sanitizeSvg(raw: string): string | null {
  const svg = raw.trim();
  if (!svg || svg.length > 20000) return null;
  try {
    const clean = DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true },
      FORBID_TAGS: ["foreignObject", "script", "style", "iframe", "embed", "object", "link", "meta", "a"],
      FORBID_ATTR: ["href", "xlink:href", "src", "action", "formaction", "poster", "data"],
    });
    if (!/<svg[\s>]/i.test(clean)) return null;
    return clean;
  } catch {
    return null;
  }
}

const MARKDOWN_MAX_CHARS = 50000;

function stripMarkdownCell(cell: string): string {
  return cell
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(`)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .trim();
}

function MarkdownTableExport({ header, rows, aligns, tableKey, mentionPeople = [] }: {
  header: string[];
  rows: string[][];
  aligns: ("left" | "center" | "right")[];
  tableKey: string;
  mentionPeople?: readonly ChatMentionPerson[];
}) {
  const [busy, setBusy] = useState(false);
  const fileBase = `ai-table-${new Date().toISOString().slice(0, 10)}`;
  const plainHeader = header.map(stripMarkdownCell);
  const plainRows = rows.map((row) => row.map(stripMarkdownCell));
  const downloadDelimited = (delimiter: string, extension: string, mime: string) => {
    const lines = [
      plainHeader.map((cell) => escapeDelimitedCell(cell, delimiter)).join(delimiter),
      ...plainRows.map((row) => row.map((cell) => escapeDelimitedCell(cell, delimiter)).join(delimiter)),
    ];
    downloadBlob(new Blob([lines.join("\n")], { type: `${mime};charset=utf-8` }), `${fileBase}.${extension}`);
  };
  const downloadExcel = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.aoa_to_sheet([plainHeader, ...plainRows]);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Table");
      const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      downloadBlob(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${fileBase}.xlsx`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="chat-markdown-table overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="chat-markdown-table-header">
              {header.map((cell, cellIndex) => (
                <th key={`th-${tableKey}-${cellIndex}`} style={{ textAlign: aligns[cellIndex] ?? "left" }} className="chat-markdown-table-heading border-b px-3 py-2 font-semibold">
                  {renderInlineMarkdown(cell, mentionPeople)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRowsFallback(rows, aligns, tableKey, mentionPeople)}
          </tbody>
        </table>
      </div>
      <div className="chat-markdown-table-export flex flex-wrap items-center gap-1.5 border-t px-3 py-2">
        <span className="chat-markdown-table-export-label mr-1 text-[10px] font-semibold uppercase tracking-[.1em]">Export table</span>
        <button onClick={() => downloadDelimited(",", "csv", "text/csv")} data-testid={`export-table-csv-${tableKey}`} className="chat-markdown-table-export-button rounded-md px-2 py-1 text-[11px] font-semibold">CSV</button>
        <button onClick={() => downloadDelimited(";", "csv", "text/csv")} data-testid={`export-table-semicolon-${tableKey}`} className="chat-markdown-table-export-button rounded-md px-2 py-1 text-[11px] font-semibold">CSV (;)</button>
        <button onClick={() => void downloadExcel()} disabled={busy} data-testid={`export-table-xlsx-${tableKey}`} className="chat-markdown-table-export-button flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50"><Download size={12} />{busy ? "..." : "Excel"}</button>
      </div>
    </div>
  );
}

function bodyRowsFallback(rows: string[][], aligns: ("left" | "center" | "right")[], tableKey: string, mentionPeople: readonly ChatMentionPerson[] = []) {
  return rows.map((row, rowIndex) => (
    <tr key={`tr-${tableKey}-${rowIndex}`} className="chat-markdown-table-row">
      {row.map((cell, cellIndex) => (
        <td key={`td-${tableKey}-${rowIndex}-${cellIndex}`} style={{ textAlign: aligns[cellIndex] ?? "left" }} className="chat-markdown-table-cell border-b px-3 py-2 align-top">
          {renderInlineMarkdown(cell, mentionPeople)}
        </td>
      ))}
    </tr>
  ));
}

function MarkdownContent({
  source,
  className = "",
  mentionPeople = [],
}: {
  source: string;
  className?: string;
  mentionPeople?: readonly ChatMentionPerson[];
}) {
  const capped = source.length > MARKDOWN_MAX_CHARS ? `${source.slice(0, MARKDOWN_MAX_CHARS)}\n\n…(truncated)` : source;
  const blocks: ReactNode[] = [];
  const paragraph: string[] = [];
  const orderedItems: string[] = [];
  const unorderedItems: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={`paragraph-${key++}`}>{renderInlineMarkdown(paragraph.join(" "), mentionPeople)}</p>);
    paragraph.length = 0;
  };
  const flushLists = () => {
    if (orderedItems.length) {
      blocks.push(<ol key={`ordered-${key++}`} className="list-decimal space-y-1 pl-5">{orderedItems.map(item => <li key={`ordered-item-${key++}`}>{renderInlineMarkdown(item, mentionPeople)}</li>)}</ol>);
      orderedItems.length = 0;
    }
    if (unorderedItems.length) {
      blocks.push(<ul key={`unordered-${key++}`} className="list-disc space-y-1 pl-5">{unorderedItems.map(item => <li key={`unordered-item-${key++}`}>{renderInlineMarkdown(item, mentionPeople)}</li>)}</ul>);
      unorderedItems.length = 0;
    }
  };
  const flush = () => {
    flushParagraph();
    flushLists();
  };

  const renderTextSegment = (segment: string) => {
  segment.replace(/\r\n?/g, "\n").split("\n").forEach((line, lineIndex, allLines) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      return;
    }
    if (trimmed.includes("|")) {
      const nextLine = allLines[lineIndex + 1] ?? "";
      const delimiterCells = nextLine.trim().replace(/^\||\|$/g, "").split("|");
      const isTable = delimiterCells.length > 0 && delimiterCells.every(cell => /^:?-{1,}:?$/.test(cell.trim()));
      if (isTable) {
        flush();
        const splitRow = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
        const header = splitRow(trimmed);
        const aligns = delimiterCells.map(cell => {
          const marker = cell.trim();
          if (/^:.+:$/.test(marker)) return "center" as const;
          if (/:$/.test(marker)) return "right" as const;
          return "left" as const;
        });
        const bodyRows: string[][] = [];
        let consumed = 1;
        for (let rowIndex = lineIndex + 2; rowIndex < allLines.length; rowIndex += 1) {
          const rowLine = allLines[rowIndex].trim();
          if (!rowLine || !rowLine.includes("|")) break;
          consumed += 1;
          const rowCells = splitRow(rowLine);
          if (rowCells.length === header.length) bodyRows.push(rowCells);
        }
        const tableKey = `table-${key++}`;
        blocks.push(<MarkdownTableExport key={tableKey} header={header} rows={bodyRows} aligns={aligns} tableKey={tableKey} mentionPeople={mentionPeople} />);
        for (let skip = 1; skip <= consumed; skip += 1) allLines[lineIndex + skip] = "";
        return;
      }
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flush();
      const Heading = `h${Math.min(heading[1].length, 4)}` as "h1" | "h2" | "h3" | "h4";
      blocks.push(<Heading key={`heading-${key++}`} className="font-semibold tracking-[-.02em] text-[#183a4b]">{renderInlineMarkdown(heading[2], mentionPeople)}</Heading>);
      return;
    }
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (unorderedItems.length) flushLists();
      orderedItems.push(ordered[1]);
      return;
    }
    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (orderedItems.length) flushLists();
      unorderedItems.push(unordered[1]);
      return;
    }
    const quote = trimmed.match(/^>\s?(.+)$/);
    if (quote) {
      flush();
      blocks.push(<blockquote key={`quote-${key++}`} className="border-l-2 border-[#8cc5c5] pl-3 italic text-[#63747c]">{renderInlineMarkdown(quote[1], mentionPeople)}</blockquote>);
      return;
    }
    if (/^([-*_])(?:\s*\1){2,}$/.test(trimmed)) {
      flush();
      blocks.push(<hr key={`rule-${key++}`} className="border-[#dce9e8]" />);
      return;
    }
    if (orderedItems.length || unorderedItems.length) flushLists();
    paragraph.push(trimmed);
    });
  };
  const svgPattern = /<svg[\s>][\s\S]*?<\/svg\s*>/gi;
  let svgCursor = 0;
  let svgMatch: RegExpExecArray | null;
  while ((svgMatch = svgPattern.exec(capped))) {
    if (svgMatch.index > svgCursor) renderTextSegment(capped.slice(svgCursor, svgMatch.index));
    flush();
    const cleanSvg = sanitizeSvg(svgMatch[0]);
    if (cleanSvg) {
      blocks.push(<div key={`svg-${key++}`} className="overflow-x-auto rounded-xl border border-[#dce9e8] bg-white p-3 [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: cleanSvg }} />);
    } else {
      blocks.push(<p key={`svg-${key++}`} className="text-xs text-[#8a999d]">(Embedded image omitted.)</p>);
    }
    svgCursor = svgMatch.index + svgMatch[0].length;
  }
  if (svgCursor < capped.length) renderTextSegment(capped.slice(svgCursor));
  flush();

  return <div className={`prose prose-sm max-w-none prose-headings:my-0 prose-p:my-0 prose-ol:my-1 prose-ul:my-1 prose-li:my-0 prose-hr:my-2 dark:prose-invert ${className}`}>{blocks}</div>;
}

type TranscriptTurn = {
  question?: unknown;
  answer?: unknown;
  type?: unknown;
  raw?: string | string[] | Record<string, string> | null;
  options?: unknown;
  items?: unknown;
  categories?: unknown;
  file?: { name?: string; size?: number; contentType?: string; path?: string } | null;
  answered_at?: unknown;
};

const TRANSCRIPT_TYPE_LABELS: Record<string, string> = {
  text: "Written",
  choice: "Single choice",
  multi: "Multiple choice",
  categorize: "Categorize",
  dragdrop: "Ranked order",
  file: "File upload",
};

function formatUploadSize(size: number): string {
  if (size >= 1048576) return `${(size / 1048576).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function TranscriptAnswer({ turn }: { turn: TranscriptTurn }) {
  const type = typeof turn.type === "string" ? turn.type : "";
  const answerText = typeof turn.answer === "string" && turn.answer.trim() ? turn.answer : "";
  if (type === "multi" || type === "choice") {
    const picked = type === "multi"
      ? (Array.isArray(turn.raw) ? turn.raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [])
      : [answerText, typeof turn.raw === "string" ? turn.raw : ""].filter(option => option.trim().length > 0);
    const selected = [...new Set(picked)];
    const options = Array.isArray(turn.options) ? turn.options.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
    const shown = [...new Set(options.length > 0 ? options : selected)];
    if (!shown.length) return <p className="text-sm leading-6 text-[#52666e]">{answerText || "No answer given."}</p>;
    return <div><div className="flex flex-wrap gap-1.5">{shown.map(option => <span key={option} className={`rounded-full px-3 py-1 text-xs font-semibold ${selected.includes(option) ? "bg-[#dff4f2] text-[#12737d]" : "bg-[#eef3f2] text-[#8a999d]"}`}>{option}</span>)}</div><p className="mt-1.5 text-[11px] text-[#8a999d]">{selected.length} of {shown.length} selected</p></div>;
  }
  if (type === "categorize") {
    const buckets = turn.raw && typeof turn.raw === "object" && !Array.isArray(turn.raw) ? turn.raw as Record<string, string> : null;
    if (!buckets) return <p className="text-sm leading-6 text-[#52666e]">{answerText || "No answer given."}</p>;
    const groups = new Map<string, string[]>();
    for (const item of Object.keys(buckets)) {
      const bucket = buckets[item] || "Unsorted";
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket)?.push(item);
    }
    return <div className="space-y-2">{[...groups.entries()].map(([bucket, items]) => <div key={bucket} className="rounded-lg bg-[#f4f8f7] px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">{bucket}</p><div className="mt-1.5 flex flex-wrap gap-1.5">{items.map(item => <span key={item} className="rounded-full bg-white px-2.5 py-1 text-xs text-[#44646d]">{item}</span>)}</div></div>)}</div>;
  }
  if (type === "dragdrop") {
    const order = Array.isArray(turn.raw) ? turn.raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
    if (!order.length) return <p className="text-sm leading-6 text-[#52666e]">{answerText || "No answer given."}</p>;
    return <ol className="space-y-1.5">{order.map((item, rank) => <li key={`${rank}-${item}`} className="flex items-center gap-2.5 rounded-lg bg-[#f4f8f7] px-3 py-2 text-sm text-[#38555e]"><span className="mono flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#16869a] text-[10px] font-bold text-white">{rank + 1}</span>{item}</li>)}</ol>;
  }
  if (type === "file") {
    const name = turn.file?.name || (typeof turn.raw === "string" && turn.raw ? turn.raw.split("/").pop() : "") || answerText || "Uploaded file";
    const size = typeof turn.file?.size === "number" ? ` · ${formatUploadSize(turn.file.size)}` : "";
    return <div><span className="inline-flex items-center gap-2 rounded-lg border border-[#d5e0e0] bg-white px-3 py-2 text-xs font-semibold text-[#38555e]"><Paperclip size={14} className="text-[#16869a]" />{name}{size}</span><p className="mt-1.5 text-[11px] text-[#8a999d]">Stored on the team application site.</p></div>;
  }
  if (Array.isArray(turn.raw)) {
    const chips = turn.raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (chips.length) return <div className="flex flex-wrap gap-1.5">{chips.map(chip => <span key={chip} className="rounded-full bg-[#dff4f2] px-3 py-1 text-xs font-semibold text-[#12737d]">{chip}</span>)}</div>;
  }
  return <p className="whitespace-pre-wrap text-sm leading-6 text-[#52666e]">{answerText || "No answer given."}</p>;
}

function TranscriptView({ transcript }: { transcript: string | null }) {
  if (!transcript || !transcript.trim()) return <p className="text-sm leading-6 text-[#64777d]">No transcript attached.</p>;
  let turns: TranscriptTurn[];
  try {
    const parsed: unknown = JSON.parse(transcript);
    if (!Array.isArray(parsed)) throw new Error("not a turn list");
    turns = parsed as TranscriptTurn[];
  } catch {
    return <p className="whitespace-pre-wrap text-sm leading-6 text-[#64777d]">{transcript}</p>;
  }
  if (!turns.length) return <p className="text-sm leading-6 text-[#64777d]">No transcript attached.</p>;
  return <ol className="space-y-4">{turns.map((turn, index) => {
    const type = typeof turn?.type === "string" ? turn.type : "";
    const question = turn && typeof turn.question === "string" && turn.question.trim() ? turn.question : "Question";
    const answeredAt = turn && typeof turn.answered_at === "string" ? new Date(turn.answered_at) : null;
    const when = answeredAt && !Number.isNaN(answeredAt.getTime()) ? answeredAt.toLocaleString() : "";
    return <li key={index} className="rounded-xl bg-[#f4f8f7] p-4"><p className="mono text-[10px] uppercase tracking-[.16em] text-[#16869a]">Q{index + 1} · {TRANSCRIPT_TYPE_LABELS[type] ?? "Answer"}{when ? ` · ${when}` : ""}</p><p className="mt-1.5 text-sm font-semibold leading-6 text-[#183a4b]">{question}</p><div className="mt-2"><TranscriptAnswer turn={turn ?? {}} /></div></li>;
  })}</ol>;
}

function serverErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
      return (data as { error: string }).error;
    }
  }
  return fallback;
}

const CHAT_PAGE_SIZE = 30;

function mergeChatItems<T extends { id: string; createdAt: string }>(...lists: T[][]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  out.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  return out;
}

function isNearBottom(el: { scrollHeight: number; scrollTop: number; clientHeight: number }, margin = 120): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < margin;
}

function useFullscreen() {
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const [iframeFullscreen, setIframeFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => setBrowserFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (iframeFullscreen) {
      setIframeFullscreen(false);
      return;
    }
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Some host platforms omit allow="fullscreen" on their iframe. The
      // fallback still expands the app to the full iframe viewport.
      setIframeFullscreen(true);
    }
  };

  return { isFullscreen: browserFullscreen || iframeFullscreen, toggleFullscreen };
}

const PRESENCE_PAGE_LABELS: Record<string, string> = {
  "/": "Login",
  "/dashboard": "Overview",
  "/applicants": "Applicants",
  "/queue": "Interview queue",
  "/attendance": "Attendance",
  "/big-screen": "Big screen controls",
  "/assistant": "AI assistant",
  "/display": "Big screen",
};

function presencePageLabel(page: string): string {
  return PRESENCE_PAGE_LABELS[page] ?? (page || "unknown page");
}

function browserNotifyPermission(): string {
  try {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  } catch {
    return "unsupported";
  }
}

function usePresenceHeartbeat(enabled: boolean, page: string) {
  const pageRef = useRef(page);
  pageRef.current = page;
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const beat = () => {
      fetch(`${import.meta.env.BASE_URL}api/presence/heartbeat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pageRef.current, notifyPermission: browserNotifyPermission() }),
      }).catch(() => undefined);
    };
    beat();
    timer = setInterval(() => {
      if (!stopped && document.visibilityState === "visible") beat();
    }, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer !== undefined) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, page]);
}

function timeAgoShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${totalSeconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function PresenceIpModal({ ip, onClose }: { ip: string; onClose: () => void }) {
  const stats = useGetPresenceStats(
    { ip },
    { query: { queryKey: getGetPresenceStatsQueryKey({ ip }), enabled: Boolean(ip) } },
  );
  const maxSeconds = Math.max(...(stats.data?.pages.map((p) => p.seconds) ?? [1]), 1);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#112433]/45 p-4" onClick={onClose} data-testid="presence-stats-modal">
      <div onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Usage for ${ip}`} className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#dce5e5] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.16em] text-[#16869a]">Session history</p>
            <h2 className="mono mt-1 break-all text-lg font-semibold text-[#182232]">{ip}</h2>
          </div>
          <button onClick={onClose} aria-label="Close usage details" className="rounded-lg p-1.5 text-[#718189] hover:bg-[#edf1f1]"><X size={16} /></button>
        </div>
        {stats.isLoading ? (
          <div className="mt-4 space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
        ) : stats.isError || !stats.data ? (
          <p className="mt-4 text-sm text-[#7c8c91]">Stats unavailable. <button onClick={() => stats.refetch()} className="font-semibold text-[#16869a]">Retry</button></p>
        ) : (
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[#f4f8f7] p-3"><p className="mono text-lg font-semibold text-[#183a4b]">{formatDuration(stats.data.totalSeconds)}</p><p className="mt-1 text-[10px] uppercase tracking-[.1em] text-[#7c8c91]">Total time</p></div>
              <div className="rounded-xl bg-[#f4f8f7] p-3"><p className="mono text-lg font-semibold text-[#183a4b]">{stats.data.visitCount}</p><p className="mt-1 text-[10px] uppercase tracking-[.1em] text-[#7c8c91]">Visits</p></div>
              <div className="rounded-xl bg-[#f4f8f7] p-3"><p className="mono text-lg font-semibold text-[#183a4b]">{stats.data.sessionCount}</p><p className="mt-1 text-[10px] uppercase tracking-[.1em] text-[#7c8c91]">Sessions</p></div>
            </div>
            <p className="mt-3 text-[11px] text-[#8a999d]">
              {stats.data.firstSeenAt ? `First seen ${new Date(stats.data.firstSeenAt).toLocaleString()}` : "Never seen"}
              {stats.data.lastSeenAt ? ` · last seen ${new Date(stats.data.lastSeenAt).toLocaleString()}` : ""}
            </p>
            <div className="mt-3 rounded-xl bg-[#f4f8f7] p-3" data-testid="presence-notify-status">
              <p className="mono text-[10px] uppercase tracking-[.1em] text-[#7c8c91]">Browser notifications · online sessions</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="flex items-center gap-1.5 rounded-full bg-[#dff3ec] px-2.5 py-1 text-[#1d7a5f]"><Bell size={12} /> {stats.data.notifyGranted} on</span>
                <span className="flex items-center gap-1.5 rounded-full bg-[#fbe4e1] px-2.5 py-1 text-[#a34d46]"><BellOff size={12} /> {stats.data.notifyDenied} off</span>
                {(stats.data.notifyUnknown ?? 0) > 0 && <span className="rounded-full bg-[#eef3f2] px-2.5 py-1 text-[#63747c]">{stats.data.notifyUnknown} unknown</span>}
              </div>
              {stats.data.notifyGranted === 0 && <p className="mt-2 text-[11px] leading-5 text-[#8a999d]">Nobody on this IP accepted pushes — broadcasts only appear as in-app popups. Ask them to tap the bell in the top bar.</p>}
            </div>
            <p className="mono mt-4 text-[10px] uppercase tracking-[.16em] text-[#16869a]">Pages visited most</p>
            {stats.data.pages.length > 0 ? (
              <div className="mt-2 space-y-3">
                {stats.data.pages.map((page) => (
                  <div key={page.page || "(unknown)"}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#38555e]">{presencePageLabel(page.page) === "unknown page" && page.page ? page.page : presencePageLabel(page.page)}</span>
                      <span className="mono text-[#7b8a8f]">{page.visits} visit{page.visits === 1 ? "" : "s"} · {formatDuration(page.seconds)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#edf1f1]">
                      <div className="h-full rounded-full bg-[#16869a]" style={{ width: `${Math.max(4, (page.seconds / maxSeconds) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#7c8c91]">No page visits recorded yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BroadcastCard() {
  const queryClient = useQueryClient();
  const send = usePostBroadcast();
  const presence = useGetPresence({
    query: { queryKey: getGetPresenceQueryKey() },
  });
  const [message, setMessage] = useState("");
  const [targetIp, setTargetIp] = useState("");
  const [sentNote, setSentNote] = useState("");
  const onlineIps = [...new Set((presence.data?.entries ?? []).map((entry) => entry.ip))].sort();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || send.isPending) return;
    setSentNote("");
    send.mutate({ data: { message: text, targetIp: targetIp || undefined, ttlMinutes: 60 } }, {
      onSuccess: (created) => {
        setMessage("");
        setSentNote(created.targetIp ? `Sent to ${created.targetIp} — pops up there within seconds.` : "Sent to everyone online — pops up within seconds.");
        queryClient.invalidateQueries({ queryKey: getGetMyBroadcastsQueryKey() });
      },
      onError: () => setSentNote("Send failed. Try again."),
    });
  };
  return (
    <Section title="Broadcast" kicker="Message the other coordinator">
      <form onSubmit={submit} className="mt-1 space-y-2">
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={2} maxLength={500} placeholder="Maksim — check the chat…" data-testid="input-broadcast-message" aria-label="Broadcast message" className="w-full resize-y rounded-xl border border-[#d5e0e0] p-3 text-sm outline-none focus:border-[#16869a]" />
        <div className="flex gap-2">
          <select value={targetIp} onChange={(event) => setTargetIp(event.target.value)} data-testid="select-broadcast-target" aria-label="Broadcast target" className="h-10 min-w-0 flex-1 rounded-lg border border-[#d5e0e0] bg-white px-2 text-xs outline-none focus:border-[#16869a]">
            <option value="">Everyone online</option>
            {onlineIps.map((ip) => <option key={ip} value={ip}>{ip}</option>)}
          </select>
          <button disabled={send.isPending || !message.trim()} data-testid="button-broadcast-send" className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#16869a] px-4 text-sm font-semibold text-white disabled:opacity-50"><Send size={15} /> {send.isPending ? "Sending…" : "Send"}</button>
        </div>
      </form>
      {sentNote && <p className="mt-2 text-xs text-[#718189]" data-testid="broadcast-sent-note">{sentNote}</p>}
      <p className="mt-2 text-[11px] leading-5 text-[#7c8c91]">Coordinators with browser notifications on also get a push, even in another tab.</p>
    </Section>
  );
}

function PresencePanel() {
  const { settings } = useWorkspaceSettings();
  const presence = useGetPresence({
    query: { queryKey: getGetPresenceQueryKey(), refetchInterval: settings.autoRefresh ? settings.refreshMs : false },
  });
  const kick = useKickPresence();
  const queryClient = useQueryClient();
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [kickTarget, setKickTarget] = useState<string | null>(null);
  if (presence.isLoading) return <Section title="Live now" kicker="Who is online"><Skeleton className="h-14" /></Section>;
  if (presence.isError || !presence.data) return <Section title="Live now" kicker="Who is online"><p className="text-sm text-[#7c8c91]">Presence unavailable. <button onClick={() => presence.refetch()} className="font-semibold text-[#16869a]">Retry</button></p></Section>;
  const entries = presence.data.entries;
  return (
    <Section title="Live now" kicker="Online coordinators (2-minute window)" >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#28a47f]" />
        <p className="text-sm font-semibold" data-testid="presence-count">
          {presence.data.onlineCount} online now
        </p>
      </div>
      {entries.length > 0 ? (
        <div className="mt-3 space-y-2">
          {entries.map((entry) => (
            <div key={`${entry.ip}-${entry.lastSeenAt}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e3ebeb] bg-white px-3 py-2 text-xs" data-testid="presence-entry">
              <button onClick={() => setSelectedIp(entry.ip)} title={`View usage for ${entry.ip}`} data-testid={`presence-ip-${entry.ip}`} className="mono rounded font-semibold text-[#16869a] underline decoration-[#9bcfce] underline-offset-2 hover:text-[#106d7a]">
                {entry.ip}
              </button>
              <span className="rounded-full bg-[#e3f4f2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#12737d]">
                {presencePageLabel(entry.page)}
              </span>
              <span className="text-[#718189]">
                {[entry.city, entry.region, entry.country].filter(Boolean).join(", ") || "location unknown"}
              </span>
              {entry.notifyPermission === "granted" ? (
                <span title="Browser notifications on — broadcasts push to this session" data-testid={`presence-notify-on-${entry.ip}`} className="flex items-center gap-1 rounded-full bg-[#dff3ec] px-2 py-0.5 text-[10px] font-bold text-[#1d7a5f]">
                  <Bell size={11} /> Push on
                </span>
              ) : entry.notifyPermission === "denied" ? (
                <span title="Browser notifications blocked for this session" data-testid={`presence-notify-off-${entry.ip}`} className="flex items-center gap-1 rounded-full bg-[#fbe4e1] px-2 py-0.5 text-[10px] font-bold text-[#a34d46]">
                  <BellOff size={11} /> Push off
                </span>
              ) : entry.notifyPermission === "default" ? (
                <span title="This session has not enabled browser notifications yet" className="flex items-center gap-1 rounded-full bg-[#eef3f2] px-2 py-0.5 text-[10px] font-bold text-[#63747c]">
                  <Bell size={11} /> Push not enabled
                </span>
              ) : null}
              {entry.isCurrent ? (
                <span className="rounded-full bg-[#e3f4f2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#12737d]">
                  This device
                </span>
              ) : (
                <button onClick={() => setKickTarget(entry.ip)} title={`Kick ${entry.ip}`} data-testid={`button-kick-${entry.ip}`} className="ml-auto rounded-full border border-[#e8c4c0] bg-white px-2.5 py-1 text-[10px] font-bold text-[#b34a42] transition hover:bg-[#fff1ef]">
                  Kick
                </button>
              )}
              <span className="mono text-[#8a999d]">{timeAgoShort(entry.lastSeenAt)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#7c8c91]">No active sessions seen recently.</p>
      )}
      {selectedIp && <PresenceIpModal ip={selectedIp} onClose={() => setSelectedIp(null)} />}
      {kickTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#112433]/45 p-4" onClick={() => setKickTarget(null)} data-testid="kick-confirm">
          <div onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Kick ${kickTarget}`} className="w-full max-w-sm rounded-2xl border border-[#dce5e5] bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold tracking-[-.02em] text-[#182232]">Kick {kickTarget}?</h2>
            <p className="mt-2 text-sm leading-6 text-[#52666e]">They will be logged out and removed from Live now. They must log in again to return.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setKickTarget(null)} className="rounded-xl border border-[#d5e0e0] px-4 py-2.5 text-sm font-semibold text-[#52666e] hover:bg-[#f1f6f5]">Cancel</button>
              <button
                onClick={() => {
                  const ip = kickTarget;
                  setKickTarget(null);
                  kick.mutate(
                    { data: { ip } },
                    {
                      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPresenceQueryKey() }),
                    },
                  );
                }}
                disabled={kick.isPending}
                data-testid="button-confirm-kick"
                className="rounded-xl bg-[#b34a42] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {kick.isPending ? "Kicking..." : "Kick"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function FullscreenButton({ active, onClick, dark = false }: { active: boolean; onClick: () => void; dark?: boolean }) {
  return <button onClick={onClick} aria-label={active ? "Exit fullscreen" : "Enter fullscreen"} aria-pressed={active} data-testid="button-fullscreen" className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${dark ? "border-[#617d86] text-[#c0d0d3] hover:border-[#f8c84a] hover:text-white" : "border-[#d5e0e0] bg-white text-[#52666e] hover:border-[#16869a] hover:text-[#16869a]"}`}>
    {active ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
    <span className="hidden sm:inline">{active ? "Exit fullscreen" : "Fullscreen"}</span>
  </button>;
}

type PasswordSafetyIssue =
  | { code: "PASSWORD_EXPOSURE_WARNING"; count: number }
  | { code: "PASSWORD_EXPOSURE_BLOCKED"; count: number }
  | { code: "PASSWORD_CHECK_UNAVAILABLE" };

function passwordSafetyIssue(error: unknown): PasswordSafetyIssue | null {
  if (typeof error !== "object" || error === null || !("data" in error)) return null;
  const data = (error as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;

  const payload = data as Record<string, unknown>;
  if (payload.code === "PASSWORD_CHECK_UNAVAILABLE") {
    return { code: "PASSWORD_CHECK_UNAVAILABLE" };
  }
  if (
    (payload.code === "PASSWORD_EXPOSURE_WARNING" || payload.code === "PASSWORD_EXPOSURE_BLOCKED") &&
    typeof payload.count === "number" &&
    Number.isInteger(payload.count)
  ) {
    return { code: payload.code, count: payload.count };
  }
  return null;
}

function passwordSafetyErrorMessage(issue: PasswordSafetyIssue | null): string | null {
  if (!issue) return null;
  if (issue.code === "PASSWORD_CHECK_UNAVAILABLE") {
    return "Password safety check is temporarily unavailable. Nothing was saved; try again shortly.";
  }
  if (issue.code === "PASSWORD_EXPOSURE_BLOCKED") {
    return `This password appears in known breach data ${issue.count} times. Choose a different password.`;
  }
  return `This password appears in known breach data ${issue.count} ${issue.count === 1 ? "time" : "times"}.`;
}

function passwordExposureConfirmation(count: number): string {
  return `This password has appeared in known breach data ${count} ${count === 1 ? "time" : "times"}. A unique password is safer. Continue with it anyway?`;
}

function LegacyLogin() {
  const [password, setPassword] = useState("");
  const [eventPassword, setEventPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
  const [location, setLocation] = useLocation();
  const qc = useQueryClient();
  const passwordRef = useRef<HTMLInputElement>(null);
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const interviewers = useListInterviewers({ query: { queryKey: getListInterviewersQueryKey() } });
  const login = useLogin();
  const setup = useSetupInterviewerPassword();
  const create = useCreateInterviewer();
  useEffect(() => { if (session.data?.authenticated && (location === "/" || location === "/auth")) setLocation("/dashboard"); }, [session.data, location, setLocation]);
  useEffect(() => {
    // Browsers may ignore autoFocus in an iframe until the document has
    // mounted, so focus again after the login view is ready.
    const frame = window.requestAnimationFrame(() => passwordRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!selectedId && interviewers.data?.items[0]) setSelectedId(interviewers.data.items[0].id);
  }, [interviewers.data, selectedId]);
  const finishLogin = (response: { token?: string }) => { storeAuthToken(response.token); qc.invalidateQueries({ queryKey: getGetSessionQueryKey() }); setLocation("/dashboard"); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const selected = interviewers.data?.items.find(item => item.id === selectedId);
    if (!selected) return;
    if (!selected.hasPassword) {
      setup.mutate({ data: { interviewerId: selected.id, eventPassword, password } }, {
        onSuccess: () => {
          login.mutate({ data: { interviewerId: selected.id, eventPassword, password } }, { onSuccess: finishLogin });
        },
      });
      return;
    }
    login.mutate({ data: { interviewerId: selected.id, eventPassword, password } }, { onSuccess: finishLogin });
  };
  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({ data: { displayName: newName, eventPassword, password: newPassword } }, {
      onSuccess: account => {
        setCreating(false);
        setPassword(newPassword);
        setNewPassword("");
        setSelectedId(account.id);
        qc.invalidateQueries({ queryKey: getListInterviewersQueryKey() });
        login.mutate({ data: { interviewerId: account.id, eventPassword, password: newPassword } }, { onSuccess: finishLogin });
      },
    });
  };
  const selected = interviewers.data?.items.find(item => item.id === selectedId);
  const busy = login.isPending || setup.isPending || create.isPending;
  const errorMessage = login.isError ? "That password was not recognized." : setup.isError ? "Could not set that password. Check the event passcode." : create.isError ? "Could not create that interviewer. Check the event passcode." : "";
  return <main className="noise relative flex min-h-[100dvh] overflow-hidden bg-[#172a3a] text-white">
    <div className="absolute -right-40 -top-40 h-[680px] w-[680px] rounded-full border border-[#387182]/30" /><div className="absolute -right-20 -top-20 h-[440px] w-[440px] rounded-full border border-[#387182]/30" />
    <div className="relative z-10 grid w-full lg:grid-cols-[1fr_480px]">
      <section className="hidden flex-col justify-between p-12 lg:flex xl:p-20"><Logo dark /><div><p className="mono mb-5 text-xs uppercase tracking-[.28em] text-[#f8c84a]">Wolverines / Team 23442</p><h1 className="max-w-xl text-6xl font-semibold leading-[.95] tracking-[-.05em] xl:text-8xl">Build the<br /><span className="text-[#f8c84a]">next team.</span></h1><p className="mt-8 max-w-md text-lg leading-7 text-[#abc0c7]">A quiet control room for sharp eyes, honest signals, and the people ready to build.</p></div><div className="mono flex flex-wrap gap-3 text-[10px] uppercase tracking-[.2em] text-[#76929c]"><span>All Claws on Deck!</span><span>·</span><span>PLMS · Sammamish, Washington</span><span>·</span><span>Coordinator access</span></div></section>
      <section className="flex flex-col justify-center bg-[#f3f6f5] px-7 py-12 text-[#182232] sm:px-14"><div className="mb-16 lg:hidden"><Logo /></div><div className="mx-auto w-full max-w-[350px]"><Badge tone="teal">Interviewer access</Badge><h2 className="mt-5 text-4xl font-semibold tracking-[-.05em]">{creating ? "Add interviewer." : "Welcome back."}</h2><p className="mt-3 text-sm leading-6 text-[#63747c]">{creating ? "Use the event passcode to add a named interviewer." : "Choose your interviewer and enter their password."}</p>{creating ? <form onSubmit={submitCreate} className="mt-8 space-y-4"><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-[#63747c]">Interviewer name</span><input autoFocus autoComplete="name" value={newName} onChange={e => setNewName(e.target.value)} data-testid="input-new-interviewer-name" className="h-12 w-full rounded-xl border border-[#cbd7da] bg-white px-4 outline-none focus:border-[#16869a]" /></label><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-[#63747c]">Event passcode</span><input type="password" autoComplete="current-password" value={eventPassword} onChange={e => setEventPassword(e.target.value)} data-testid="input-event-password" className="h-12 w-full rounded-xl border border-[#cbd7da] bg-white px-4 outline-none focus:border-[#16869a]" /></label><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-[#63747c]">Personal password</span><input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} data-testid="input-new-interviewer-password" className="h-12 w-full rounded-xl border border-[#cbd7da] bg-white px-4 outline-none focus:border-[#16869a]" /></label><button disabled={busy || !newName || !eventPassword || !newPassword} data-testid="button-create-interviewer" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#16869a] font-semibold text-white disabled:opacity-50">{create.isPending ? "Creating..." : <>Create and enter <ArrowRight size={17} /></>}</button><button type="button" onClick={() => setCreating(false)} className="w-full py-2 text-sm font-semibold text-[#527079]">Back to sign in</button></form> : <form onSubmit={submit} className="mt-8 space-y-5"><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-[#63747c]">Interviewer</span><select value={selectedId} onChange={e => { setSelectedId(e.target.value); setPassword(""); setEventPassword(""); }} data-testid="select-interviewer" className="h-14 w-full rounded-xl border border-[#cbd7da] bg-white px-4 text-base outline-none focus:border-[#16869a]"><option value="" disabled>{interviewers.isLoading ? "Loading interviewers..." : "Select interviewer"}</option>{interviewers.data?.items.map(item => <option key={item.id} value={item.id}>{item.displayName}{item.hasPassword ? "" : " · setup needed"}</option>)}</select></label><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-[#63747c]">{selected?.hasPassword ? "Personal password" : "Event passcode"}</span><input ref={passwordRef} id="interviewer-password" name="password" autoComplete="current-password" type="password" value={selected?.hasPassword ? password : eventPassword} onChange={e => selected?.hasPassword ? setPassword(e.target.value) : setEventPassword(e.target.value)} data-testid="input-password" className="h-14 w-full rounded-xl border border-[#cbd7da] bg-white px-4 text-lg tracking-[.18em] outline-none focus:border-[#16869a] focus:ring-4 focus:ring-[#16869a]/10" placeholder="••••••••" /></label>{!selected?.hasPassword && <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-[#63747c]">Choose personal password</span><input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} data-testid="input-setup-password" className="h-14 w-full rounded-xl border border-[#cbd7da] bg-white px-4 text-lg tracking-[.18em] outline-none focus:border-[#16869a]" /></label>}{errorMessage && <p className="text-sm text-[#b34a42]" data-testid="login-error">{errorMessage}</p>}<button disabled={busy || !selected || (selected.hasPassword ? !password : (!eventPassword || !password))} data-testid="button-login" className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#16869a] font-semibold text-white disabled:opacity-50">{busy ? "Unlocking control room..." : selected?.hasPassword ? <>Enter control room <ArrowRight size={17} /></> : <>Set password and enter <ArrowRight size={17} /></>}</button></form>}<button type="button" onClick={() => { setCreating(v => !v); setEventPassword(""); }} className="mt-6 w-full text-sm font-semibold text-[#16869a]" data-testid="button-new-interviewer">{creating ? "" : "+ New interviewer"}</button><div className="mt-8 flex items-start gap-3 border-t border-[#d7e0e0] pt-5 text-xs leading-5 text-[#728289]"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#16869a]" />Each interviewer has an individual password. Account creation requires the event passcode.</div></div></section>
    </div>
  </main>;
}

function Login() {
  type LoginStep = "event" | "interviewer" | "add" | "password";
  const [step, setStep] = useState<LoginStep>("event");
  const [eventPassword, setEventPassword] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [personalPassword, setPersonalPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [location, setLocation] = useLocation();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const interviewers = useListInterviewers({
    query: { queryKey: getListInterviewersQueryKey(), enabled: step !== "event" },
  });
  const login = useLogin();
  const setup = useSetupInterviewerPassword();
  const create = useCreateInterviewer();
  const selected = interviewers.data?.items.find(item => item.id === selectedId);
  const busy = login.isPending || setup.isPending || create.isPending;

  useEffect(() => {
    if (session.data?.authenticated && (location === "/" || location === "/auth")) setLocation("/dashboard");
  }, [session.data, location, setLocation]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  const finishLogin = (response: { token?: string }) => {
    storeAuthToken(response.token);
    qc.invalidateQueries({ queryKey: getGetSessionQueryKey() });
    setLocation("/dashboard");
  };

  const continueFromEvent = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    const normalizedEventPassword = eventPassword.trim();
    if (!normalizedEventPassword) {
      setError("Enter the event passcode to continue.");
      return;
    }
    setEventPassword(normalizedEventPassword);
    setStep("interviewer");
  };

  const chooseInterviewer = (id: string) => {
    setSelectedId(id);
    setPersonalPassword("");
    setError("");
    setStep("password");
  };

  const setSelectedPassword = (confirmLowExposure = false) => {
    if (!selected) return;
    setup.mutate(
      {
        data: {
          interviewerId: selected.id,
          eventPassword,
          password: personalPassword,
          ...(confirmLowExposure ? { confirmLowExposure: true } : {}),
        },
      },
      {
        onSuccess: () => {
          login.mutate(
            { data: { interviewerId: selected.id, eventPassword, password: personalPassword } },
            { onSuccess: finishLogin, onError: () => setError("Password setup succeeded, but sign-in failed. Try again.") },
          );
        },
        onError: error => {
          const issue = passwordSafetyIssue(error);
          if (issue?.code === "PASSWORD_EXPOSURE_WARNING") {
            if (!confirmLowExposure && window.confirm(passwordExposureConfirmation(issue.count))) {
              setSelectedPassword(true);
              return;
            }
            setError("Password not set. Choose a different password.");
            return;
          }
          setError(passwordSafetyErrorMessage(issue) ?? "The event passcode was rejected. Go back and re-enter it exactly, then continue.");
        },
      },
    );
  };

  const submitPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !personalPassword) return;
    setError("");
    if (!selected.hasPassword) {
      setSelectedPassword();
      return;
    }
    login.mutate(
      { data: { interviewerId: selected.id, eventPassword, password: personalPassword } },
      { onSuccess: finishLogin, onError: () => setError("The event passcode or personal password is incorrect.") },
    );
  };

  const createInterviewerAccount = (confirmLowExposure = false) => {
    create.mutate(
      {
        data: {
          displayName: newName,
          eventPassword,
          password: personalPassword,
          ...(confirmLowExposure ? { confirmLowExposure: true } : {}),
        },
      },
      {
        onSuccess: account => {
          login.mutate(
            { data: { interviewerId: account.id, eventPassword, password: personalPassword } },
            { onSuccess: finishLogin, onError: () => setError("Account created, but sign-in failed. Try again.") },
          );
        },
        onError: error => {
          const issue = passwordSafetyIssue(error);
          if (issue?.code === "PASSWORD_EXPOSURE_WARNING") {
            if (!confirmLowExposure && window.confirm(passwordExposureConfirmation(issue.count))) {
              createInterviewerAccount(true);
              return;
            }
            setError("Password not saved. Choose a different password.");
            return;
          }
          setError(passwordSafetyErrorMessage(issue) ?? "Could not add that interviewer. Check the event passcode or name.");
        },
      },
    );
  };

  const submitNewInterviewer = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) {
      setError("Enter an interviewer name.");
      return;
    }
    setError("");
    setStep("password");
    setSelectedId("");
  };

  const submitNewPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim() || !personalPassword) return;
    setError("");
    createInterviewerAccount();
  };

  const back = () => {
    setError("");
    if (step === "event") return;
    if (step === "interviewer") setStep("event");
    else if (step === "add") setStep("interviewer");
    else if (selectedId) setStep("interviewer");
    else setStep("add");
  };

  const stepLabel = step === "event" ? "Step 1 of 3" : step === "interviewer" ? "Step 2 of 3" : "Step 3 of 3";
  const heading = step === "event" ? "Enter the event passcode." : step === "interviewer" ? "Who are you?" : step === "add" ? "Add an interviewer." : selected ? `Sign in as ${selected.displayName}.` : `Set up ${newName}.`;
  const description = step === "event"
    ? "This passcode opens the interviewer sign-in flow."
    : step === "interviewer"
      ? "Choose your existing interviewer account, or add a new one."
      : step === "add"
        ? "Add the name first. You’ll choose a personal password next."
        : selected?.hasPassword
          ? "Enter your personal password to open the control room."
          : "This interviewer does not have a password yet. Choose one now.";

  return <main className="noise relative flex min-h-[100dvh] overflow-hidden bg-[#172a3a] text-white">
    <div className="absolute -right-40 -top-40 h-[680px] w-[680px] rounded-full border border-[#387182]/30" /><div className="absolute -right-20 -top-20 h-[440px] w-[440px] rounded-full border border-[#387182]/30" />
    <div className="relative z-10 grid w-full lg:grid-cols-[1fr_480px]">
      <section className="hidden flex-col justify-between p-12 lg:flex xl:p-20"><Logo dark /><div><p className="mono mb-5 text-xs uppercase tracking-[.28em] text-[#f8c84a]">Wolverines / Team 23442</p><h1 className="max-w-xl text-6xl font-semibold leading-[.95] tracking-[-.05em] xl:text-8xl">Build the<br /><span className="text-[#f8c84a]">next team.</span></h1><p className="mt-8 max-w-md text-lg leading-7 text-[#abc0c7]">A quiet control room for sharp eyes, honest signals, and the people ready to build.</p></div><div className="mono flex flex-wrap gap-3 text-[10px] uppercase tracking-[.2em] text-[#76929c]"><span>All Claws on Deck!</span><span>·</span><span>PLMS · Sammamish, Washington</span><span>·</span><span>Interviewer access</span></div></section>
      <section className="flex flex-col justify-center bg-[#f3f6f5] px-7 py-12 text-[#182232] sm:px-14"><div className="mb-16 lg:hidden"><Logo /></div><div className="mx-auto w-full max-w-[350px]"><div className="flex items-center justify-between"><Badge tone="teal">Interviewer access</Badge><span className="mono text-[10px] font-semibold uppercase tracking-[.14em] text-[#7c8c91]">{stepLabel}</span></div><h2 className="mt-5 text-4xl font-semibold tracking-[-.05em]">{heading}</h2><p className="mt-3 text-sm leading-6 text-[#63747c]">{description}</p>
        {step === "event" && <form onSubmit={continueFromEvent} className="mt-9 space-y-5"><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-[#63747c]">Event passcode</span><input ref={inputRef} autoFocus type="password" autoComplete="current-password" value={eventPassword} onChange={event => setEventPassword(event.target.value)} data-testid="input-event-passcode" className="h-14 w-full rounded-xl border border-[#cbd7da] bg-white px-4 text-lg tracking-[.25em] outline-none focus:border-[#16869a] focus:ring-4 focus:ring-[#16869a]/10" placeholder="••••••••" /></label>{error && <p className="text-sm text-[#b34a42]" data-testid="login-error">{error}</p>}<button disabled={!eventPassword.trim()} data-testid="button-event-passcode" className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#16869a] font-semibold text-white transition hover:bg-[#106d7a] disabled:cursor-not-allowed disabled:opacity-50">Continue <ArrowRight size={17} /></button></form>}
        {step === "interviewer" && <div className="mt-8 space-y-3">{interviewers.isLoading && <p className="rounded-xl border border-[#d5e0e0] bg-white px-4 py-4 text-sm text-[#63747c]">Loading interviewer accounts…</p>}{interviewers.data?.items.map(item => <button key={item.id} type="button" onClick={() => chooseInterviewer(item.id)} data-testid={`button-choose-interviewer-${item.displayName.toLowerCase().replaceAll(" ", "-")}`} className="flex w-full items-center justify-between rounded-xl border border-[#cbd7da] bg-white px-4 py-4 text-left transition hover:border-[#16869a] hover:bg-[#f3fbfa]"><span><span className="block font-semibold">{item.displayName}</span><span className="mt-1 block text-xs text-[#7c8c91]">{item.hasPassword ? "Personal password ready" : "Password setup required"}</span></span><ChevronRight size={18} className="text-[#16869a]" /></button>)}<button type="button" onClick={() => { setNewName(""); setError(""); setStep("add"); }} data-testid="button-add-interviewer" className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#9bbec0] px-4 py-4 text-sm font-semibold text-[#16869a] transition hover:border-[#16869a] hover:bg-[#f3fbfa]"><Plus size={17} /> Add interviewer</button>{error && <p className="text-sm text-[#b34a42]" data-testid="login-error">{error}</p>}</div>}
        {step === "add" && <form onSubmit={submitNewInterviewer} className="mt-8 space-y-5"><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-[#63747c]">Interviewer name</span><input ref={inputRef} autoFocus autoComplete="name" value={newName} onChange={event => setNewName(event.target.value)} data-testid="input-new-interviewer-name" className="h-14 w-full rounded-xl border border-[#cbd7da] bg-white px-4 outline-none focus:border-[#16869a]" placeholder="e.g. Jordan Lee" /></label>{error && <p className="text-sm text-[#b34a42]" data-testid="login-error">{error}</p>}<button disabled={!newName.trim()} data-testid="button-continue-add-interviewer" className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#16869a] font-semibold text-white disabled:opacity-50">Continue <ArrowRight size={17} /></button></form>}
        {step === "password" && <form onSubmit={selected ? submitPassword : submitNewPassword} className="mt-8 space-y-5"><label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[.14em] text-[#63747c]">Personal password</span><input ref={inputRef} autoFocus type="password" autoComplete={selected?.hasPassword ? "current-password" : "new-password"} value={personalPassword} onChange={event => setPersonalPassword(event.target.value)} data-testid="input-personal-password" className="h-14 w-full rounded-xl border border-[#cbd7da] bg-white px-4 text-lg tracking-[.18em] outline-none focus:border-[#16869a] focus:ring-4 focus:ring-[#16869a]/10" placeholder="••••••••" /></label>{error && <p className="text-sm text-[#b34a42]" data-testid="login-error">{error}</p>}<button disabled={busy || !personalPassword} data-testid="button-personal-password" className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#16869a] font-semibold text-white disabled:opacity-50">{busy ? "Unlocking control room…" : selected?.hasPassword ? <>Enter control room <ArrowRight size={17} /></> : <>Create password and enter <ArrowRight size={17} /></>}</button></form>}
        {step !== "event" && <button type="button" onClick={back} className="mt-5 flex w-full items-center justify-center gap-1 py-2 text-sm font-semibold text-[#527079]"><RotateCcw size={14} /> Back</button>}
        <div className="mt-8 flex items-start gap-3 border-t border-[#d7e0e0] pt-5 text-xs leading-5 text-[#728289]"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#16869a]" />The event passcode is required before interviewer access. Personal passwords are private to each interviewer.</div>
      </div></section>
    </div>
  </main>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings } = useWorkspaceSettings();
  const [displayPromoVisible, setDisplayPromoVisible] = useState(() => {
    try {
      return window.localStorage.getItem("robotics-hide-display-promo") !== "1";
    } catch {
      return true;
    }
  });
  const dismissDisplayPromo = () => {
    setDisplayPromoVisible(false);
    try {
      window.localStorage.setItem("robotics-hide-display-promo", "1");
    } catch {
      // Private browsing etc.
    }
  };
  const fullscreen = useFullscreen();
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const logout = useLogout();
  usePresenceHeartbeat(session.data?.authenticated === true, location);
  useRealtimeSync(session.data?.authenticated === true);
  const qc = useQueryClient();
  const broadcasts = useGetMyBroadcasts({
    query: {
      queryKey: getGetMyBroadcastsQueryKey(),
      refetchInterval: 15000,
      enabled: session.data?.authenticated === true,
    },
  });
  const ackBroadcast = useAckBroadcast();
  const [dismissedBroadcasts, setDismissedBroadcasts] = useState<string[]>([]);
  const pendingBroadcast = (broadcasts.data?.items ?? []).filter((b) => b.kind === "message" && !dismissedBroadcasts.includes(b.id))[0];
  const dismissBroadcast = (id: string) => {
    setDismissedBroadcasts((current) => (current.includes(id) ? current : [...current, id]));
    ackBroadcast.mutate(
      { broadcastId: id },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetMyBroadcastsQueryKey() }) },
    );
  };
  const [notifyState, setNotifyState] = useState<string>(() => browserNotifyPermission());
  const seenBroadcasts = useRef<Set<string> | null>(null);
  useEffect(() => {
    const items = (broadcasts.data?.items ?? []).filter((b) => b.kind === "message");
    if (seenBroadcasts.current === null) {
      // Seed on first load so pending popups don't all push at once.
      seenBroadcasts.current = new Set(items.map((b) => b.id));
      return;
    }
    for (const item of items) {
      if (seenBroadcasts.current.has(item.id)) continue;
      seenBroadcasts.current.add(item.id);
      if (dismissedBroadcasts.includes(item.id)) continue;
      try {
        if (browserNotifyPermission() === "granted") {
          const note = new Notification("Robotics tryouts", { body: item.message });
          note.onclick = () => {
            window.focus();
            note.close();
          };
        }
      } catch {
        // OS notifications unavailable — the in-app popup still shows.
      }
    }
  }, [broadcasts.data, dismissedBroadcasts]);
  if (session.isLoading) return <div className="min-h-[100dvh] bg-[#f3f6f5] p-8"><Skeleton className="h-10 w-44" /><Skeleton className="mt-10 h-40 w-full" /></div>;
  if (!session.data?.authenticated) return <Redirect to="/auth" />;
  const nav = [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }, { href: "/applicants", label: "Applicants", icon: UsersRound }, { href: "/queue", label: "Interview queue", icon: ClipboardList }, { href: "/chat", label: "Chat", icon: MessageSquare }, { href: "/attendance", label: "Attendance", icon: ClipboardCheck }, { href: "/big-screen", label: "Big screen", icon: MonitorCheck }, { href: "/assistant", label: "AI assistant", icon: Bot }];
  return <div className={`${fullscreen.isFullscreen ? "fixed inset-0 z-50 overflow-auto" : ""} min-h-[100dvh] bg-[#f3f6f5] text-[#182232]${settings.reduceMotion ? " reduce-motion" : ""}`}><aside className={`fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col bg-[#172a3a] px-4 py-5 text-[#d4e0e2] transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}><div className="px-3"><Logo dark /></div><div className="mono mb-3 mt-12 px-3 text-[9px] uppercase tracking-[.24em] text-[#78949d]">Event command</div><nav className="space-y-1">{nav.map(({ href, label, icon: I }) => <Link key={href} href={href} data-testid={`link-${label.toLowerCase().replaceAll(" ", "-")}`} onClick={() => setMobileNav(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${location.startsWith(href) ? "bg-[#f8c84a] text-[#1d2c36]" : "text-[#a7bdc3] hover:bg-[#243d4d] hover:text-white"}`}><I size={18} /><span>{label}</span>{href === "/queue" && <span className="ml-auto h-2 w-2 rounded-full bg-[#f8c84a]" />}</Link>)}</nav>{displayPromoVisible && <div className="relative mt-auto rounded-2xl border border-[#365161] bg-[#1d3545] p-4"><button onClick={dismissDisplayPromo} aria-label="Dismiss display promo" title="Dismiss" data-testid="button-dismiss-display-promo" className="absolute right-2 top-2 rounded-md p-1 text-[#617d86] transition hover:bg-[#243d4d] hover:text-white"><X size={13} /></button><div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 animate-pulse rounded-full bg-[#51d2ad]" />Live event link</div><p className="mt-2 text-[11px] leading-5 text-[#87a3ac]">Changes sync to the big screen and interview bay.</p><Link href="/display" target="_blank" data-testid="link-open-display" className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#f8c84a]">Open display <ArrowRight size={13} /></Link></div>}<button onClick={() => logout.mutate(undefined, { onSuccess: () => { clearStoredAuthToken(); queryClient.clear(); setLocation("/"); } })} data-testid="button-logout" className="mt-4 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#a7bdc3] hover:bg-[#243d4d] hover:text-white"><LogOut size={18} />End session</button></aside><div className="lg:pl-[248px]"><header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#dce5e5] bg-[#f3f6f5]/90 px-5 backdrop-blur-md lg:px-9"><button onClick={() => setMobileNav(!mobileNav)} data-testid="button-mobile-menu" className="mr-3 text-[#365965] lg:hidden"><Menu /></button><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[#7c8c91]">Wolverines / Team 23442</p><p className="text-sm font-semibold">Coordinator workspace</p></div><div className="flex items-center gap-2"><button onClick={async () => { try { if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission(); } catch { /* ignore */ } setNotifyState(browserNotifyPermission()); }} title={notifyState === "granted" ? "Browser notifications on — broadcasts will pop up even in another tab" : notifyState === "denied" ? "Browser notifications blocked — allow them in the browser site settings, then click again" : notifyState === "unsupported" ? "This browser does not support notifications" : "Turn on browser notifications for broadcasts"} aria-label="Browser notifications" data-testid="button-notify-permission" className="rounded-lg p-2 transition hover:bg-[#e3ebeb]">{notifyState === "granted" ? <Bell size={17} className="text-[#28a47f]" /> : notifyState === "denied" ? <BellOff size={17} className="text-[#b34a42]" /> : <Bell size={17} className="text-[#60757c]" />}</button><FullscreenButton active={fullscreen.isFullscreen} onClick={fullscreen.toggleFullscreen} /><ThemeToggle /><div className="hidden items-center gap-2 text-xs text-[#60757c] sm:flex"><span className="h-2 w-2 rounded-full bg-[#28a47f]" /> Synced moments ago</div><AccountMenu onOpenSettings={() => setSettingsOpen(true)} /></div></header><main className="mx-auto max-w-[1500px] p-5 lg:p-9">{settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}{children}</main>{pendingBroadcast && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#112433]/55 p-4" data-testid="broadcast-popup"><div role="dialog" aria-modal="true" aria-label="Coordinator message" className="w-full max-w-sm rounded-2xl border border-[#dce5e5] bg-white p-6 text-center shadow-2xl"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#e3f4f2] text-[#16869a]"><Mail size={20} /></span><p className="mt-4 text-lg font-semibold leading-7 text-[#182232]">{pendingBroadcast.message}</p><button onClick={() => dismissBroadcast(pendingBroadcast.id)} disabled={ackBroadcast.isPending} data-testid="button-broadcast-ack" className="mt-5 h-11 w-full rounded-xl bg-[#16869a] text-sm font-semibold text-white disabled:opacity-50">Got it</button></div></div>}</div></div>;
}

function PageHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="mono mb-2 text-[10px] font-medium uppercase tracking-[.22em] text-[#16869a]">{eyebrow}</p><h1 className="text-3xl font-semibold tracking-[-.045em] md:text-4xl">{title}</h1>{detail && <p className="mt-2 max-w-2xl text-sm text-[#718189]">{detail}</p>}</div>{action}</div>;
}
function StatCard({ label, value, suffix, tone = "teal", note }: { label: string; value: ReactNode; suffix?: string; tone?: "teal" | "yellow" | "navy" | "red"; note?: string }) {
  const c = { teal: "border-t-[#16869a]", yellow: "border-t-[#f0b82e]", navy: "border-t-[#263e60]", red: "border-t-[#bd5047]" };
  return <div className={`rounded-2xl border border-[#dce5e5] border-t-4 bg-white p-5 shadow-[0_3px_12px_rgba(26,49,60,.04)] ${c[tone]}`} data-testid={`stat-${label.toLowerCase().replaceAll(" ", "-")}`}><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#72838a]">{label}</p><div className="mt-3 flex items-baseline gap-1"><strong className="text-3xl tracking-[-.05em]">{value}</strong>{suffix && <span className="text-sm text-[#718189]">{suffix}</span>}</div>{note && <p className="mt-2 text-xs text-[#718189]">{note}</p>}</div>;
}
function Section({ title, kicker, children, className = "" }: { title: string; kicker?: string; children: ReactNode; className?: string }) { return <section className={`rounded-2xl border border-[#dce5e5] bg-white p-5 shadow-[0_3px_12px_rgba(26,49,60,.035)] ${className}`}><div className="mb-5 flex items-start justify-between"><div><h2 className="font-semibold">{title}</h2>{kicker && <p className="mt-1 text-xs text-[#7c8c91]">{kicker}</p>}</div></div>{children}</section>; }

type CustomChartType = "bars" | "pie" | "line";
type CustomChartXAxis = "gender" | "grade" | "score" | "name" | "category" | "status" | "recommendation" | "skill" | "commitment";
type CustomChartYAxis = "count" | "averageScore" | "averageAge";
type CustomChartConfig = { id: string; source?: string; xAxis: CustomChartXAxis; yAxis: CustomChartYAxis; chart: CustomChartType };

const CUSTOM_CHART_X_AXES: { value: CustomChartXAxis; label: string }[] = [
  { value: "gender", label: "Gender" },
  { value: "grade", label: "Grade" },
  { value: "score", label: "AI score range" },
  { value: "name", label: "Applicant name" },
  { value: "category", label: "Decision lane" },
  { value: "status", label: "Interview status" },
  { value: "recommendation", label: "Recommendation" },
  { value: "skill", label: "Strongest skill" },
  { value: "commitment", label: "Commitment" },
];
const CUSTOM_CHART_Y_AXES: { value: CustomChartYAxis; label: string }[] = [
  { value: "count", label: "Applicant count" },
  { value: "averageScore", label: "Average AI score" },
  { value: "averageAge", label: "Average age" },
];
const CUSTOM_CHART_TYPES: { value: CustomChartType; label: string }[] = [
  { value: "bars", label: "Bars" },
  { value: "pie", label: "Pie" },
  { value: "line", label: "Line" },
];
const CHART_PALETTE = ["#16869a", "#edb52c", "#466896", "#3aa582", "#bd5047", "#7c6fae", "#e07b39", "#5b8c5a"];
const CUSTOM_CHART_BAR_COLORS = ["teal", "yellow", "blue", "green"] as const;
const CUSTOM_CHARTS_KEY = "robotics-custom-charts-v1";

function legacyChartXAxis(source: string): CustomChartXAxis {
  if (source === "score") return "score";
  if (source === "topscores") return "name";
  if (source === "recommendations") return "recommendation";
  if (source === "grades") return "grade";
  if (source === "commitments") return "commitment";
  if (source === "categories") return "category";
  if (source === "statuses") return "status";
  return "grade";
}

function loadCustomCharts(): CustomChartConfig[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_CHARTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const raw = item as Partial<CustomChartConfig>;
      if (typeof raw.id !== "string" || typeof raw.chart !== "string" || !CUSTOM_CHART_TYPES.some(entry => entry.value === raw.chart)) return [];
      const xAxis = typeof raw.xAxis === "string" && CUSTOM_CHART_X_AXES.some(entry => entry.value === raw.xAxis) ? raw.xAxis as CustomChartXAxis : legacyChartXAxis(String(raw.source ?? ""));
      const yAxis = typeof raw.yAxis === "string" && CUSTOM_CHART_Y_AXES.some(entry => entry.value === raw.yAxis) ? raw.yAxis as CustomChartYAxis : "count";
      return [{ id: raw.id, source: typeof raw.source === "string" ? raw.source : undefined, xAxis, yAxis, chart: raw.chart as CustomChartType }];
    });
  } catch {
    return [];
  }
}

function CustomChartView({ data, chart, colorIndex, xAxisLabel, yAxisLabel }: { data: DashboardCount[]; chart: CustomChartType; colorIndex: number; xAxisLabel: string; yAxisLabel: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!data.length || total <= 0) return <p className="text-sm text-[#7c8c91]">No signal yet.</p>;
  if (chart === "pie") return <div><div className="mb-2 flex justify-between text-[10px] font-semibold uppercase tracking-[.1em] text-[#7c8c91]"><span>Measure · {yAxisLabel}</span><span>Grouped by · {xAxisLabel}</span></div><div className="h-[220px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2} strokeWidth={0}>{data.map((entry, index) => <Cell key={`${entry.label}-${index}`} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />)}</Pie><RechartsTooltip /></PieChart></ResponsiveContainer></div><div className="mt-3 space-y-1.5">{data.map((entry, index) => <div key={`${entry.label}-${index}`} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_PALETTE[index % CHART_PALETTE.length] }} /><span className="min-w-0 flex-1 truncate font-medium text-[#52666e]">{entry.label}</span><span className="mono text-[#7b8a8f]">{entry.value}</span></div>)}</div></div>;
  if (chart === "line") return <div><div className="mb-2 flex justify-between text-[10px] font-semibold uppercase tracking-[.1em] text-[#7c8c91]"><span>Y · {yAxisLabel}</span><span>X · {xAxisLabel}</span></div><div className="h-[220px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 5, right: 10, bottom: 28, left: -14 }}><CartesianGrid strokeDasharray="3 3" stroke="#e4eceb" /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "#7b8a8f" }} interval="preserveStart" angle={-25} dy={10} label={{ value: xAxisLabel, position: "insideBottom", offset: -18, fontSize: 10, fill: "#7b8a8f" }} /><YAxis allowDecimals={yAxisLabel !== "Applicant count"} tick={{ fontSize: 10, fill: "#7b8a8f" }} label={{ value: yAxisLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "#7b8a8f" }} /><RechartsTooltip /><Line type="monotone" dataKey="value" stroke="#16869a" strokeWidth={2} dot={{ r: 3, fill: "#16869a" }} /></LineChart></ResponsiveContainer></div></div>;
  return <Bars data={data} max={Math.max(...data.map(item => item.value), 1)} color={CUSTOM_CHART_BAR_COLORS[colorIndex % CUSTOM_CHART_BAR_COLORS.length]} xAxisLabel={xAxisLabel} yAxisLabel={yAxisLabel} />;
}

function CustomCharts() {
  const [xAxis, setXAxis] = useState<CustomChartXAxis>("grade");
  const [yAxis, setYAxis] = useState<CustomChartYAxis>("count");
  const [chart, setChart] = useState<CustomChartType>("pie");
  const queryClient = useQueryClient();
  const chartsQuery = useListDashboardCharts({ query: { queryKey: getListDashboardChartsQueryKey() } });
  const createChart = useCreateDashboardChart();
  const updateChart = useUpdateDashboardChart();
  const deleteChart = useDeleteDashboardChart();
  const list = useListApplicants({ sort: "rank" }, { query: { queryKey: getListApplicantsQueryKey({ sort: "rank" }) } });
  const importedRef = useRef(false);
  useEffect(() => {
    if (importedRef.current || chartsQuery.isLoading || !chartsQuery.data) return;
    if (chartsQuery.data.items.length > 0) return;
    const legacy = loadCustomCharts();
    if (!legacy.length) return;
    importedRef.current = true;
    void (async () => {
      for (const item of legacy) {
        try {
          await createChart.mutateAsync({ data: { xAxis: item.xAxis, yAxis: item.yAxis, chart: item.chart } });
        } catch {
          // Keep going; failures surface on the next load.
        }
      }
      try {
        window.localStorage.removeItem(CUSTOM_CHARTS_KEY);
      } catch {
        // Ignore storage errors.
      }
      queryClient.invalidateQueries({ queryKey: getListDashboardChartsQueryKey() });
    })();
  }, [chartsQuery.data, chartsQuery.isLoading, createChart, queryClient]);
  const applicants = list.data?.items ?? [];
  const charts = chartsQuery.data?.items ?? [];
  const xAxisOf = (value: string): CustomChartXAxis => CUSTOM_CHART_X_AXES.some(entry => entry.value === value) ? value as CustomChartXAxis : legacyChartXAxis(value);
  const yAxisOf = (value: string): CustomChartYAxis => CUSTOM_CHART_Y_AXES.some(entry => entry.value === value) ? value as CustomChartYAxis : "count";
  const axisLabel = (value: CustomChartXAxis | CustomChartYAxis) => [...CUSTOM_CHART_X_AXES, ...CUSTOM_CHART_Y_AXES].find(entry => entry.value === value)?.label ?? value;
  const xValueFor = (applicant: Applicant, axis: CustomChartXAxis): string => {
    const signals = getApplicantSignals(applicant);
    if (axis === "gender") return signals.gender === "M" ? "Male" : signals.gender === "F" ? "Female" : "Unknown";
    if (axis === "grade") return applicant.grade || "Unknown";
    if (axis === "score") return applicant.aiScore < 0 ? "Invalid" : applicant.aiScore < 25 ? "0–24" : applicant.aiScore < 50 ? "25–49" : applicant.aiScore < 75 ? "50–74" : "75–100";
    if (axis === "name") return applicant.name || "Unknown";
    if (axis === "category") return applicant.category || "Unranked";
    if (axis === "status") return applicant.interviewStatus === "in_progress" ? "In progress" : (applicant.interviewStatus || "Unknown");
    if (axis === "recommendation") return applicant.aiRecommendation || "Unknown";
    if (axis === "skill") return signals.skill || "Unknown";
    return applicant.commit10Hours || "Unknown";
  };
  const dataFor = (config: { xAxis: string; yAxis: string }): DashboardCount[] => {
    const x = xAxisOf(config.xAxis);
    const y = yAxisOf(config.yAxis);
    const groups = new Map<string, { sum: number; count: number }>();
    for (const applicant of applicants) {
      const label = xValueFor(applicant, x);
      const existing = groups.get(label) ?? { sum: 0, count: 0 };
      if (y === "count") {
        existing.sum += 1;
        existing.count += 1;
      } else if (y === "averageScore" && applicant.aiScore >= 0) {
        existing.sum += applicant.aiScore;
        existing.count += 1;
      } else if (y === "averageAge" && applicant.age !== null && applicant.age !== undefined) {
        existing.sum += applicant.age;
        existing.count += 1;
      }
      groups.set(label, existing);
    }
    return [...groups.entries()].map(([label, group]) => ({ label, value: group.count ? Math.round((group.sum / group.count) * 10) / 10 : 0 })).filter(item => item.value > 0);
  };
  const chartTypeOf = (value: string): CustomChartType => value === "pie" || value === "line" ? value : "bars";
  const addChart = () => {
    if (createChart.isPending) return;
    createChart.mutate({ data: { xAxis, yAxis, chart } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListDashboardChartsQueryKey() }),
    });
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListDashboardChartsQueryKey() });
  return <Section title="Custom charts" kicker="Choose axes for bars and lines, or a group and measure for pie charts. Shared with your co-coordinator."><div className="flex flex-wrap items-end gap-2"><label className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#7c8c91]">{chart === "pie" ? "Group by" : "X axis"}<select value={xAxis} onChange={event => setXAxis(event.target.value as CustomChartXAxis)} data-testid="select-chart-x-axis" className="mt-1 block h-10 rounded-lg border border-[#d5e0e0] bg-white px-2 text-xs normal-case tracking-normal outline-none focus:border-[#16869a]">{CUSTOM_CHART_X_AXES.map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label><label className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#7c8c91]">{chart === "pie" ? "Measure" : "Y axis"}<select value={yAxis} onChange={event => setYAxis(event.target.value as CustomChartYAxis)} data-testid="select-chart-y-axis" className="mt-1 block h-10 rounded-lg border border-[#d5e0e0] bg-white px-2 text-xs normal-case tracking-normal outline-none focus:border-[#16869a]">{CUSTOM_CHART_Y_AXES.map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label><label className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#7c8c91]">Diagram<select value={chart} onChange={event => setChart(event.target.value as CustomChartType)} data-testid="select-chart-type" className="mt-1 block h-10 rounded-lg border border-[#d5e0e0] bg-white px-2 text-xs normal-case tracking-normal outline-none focus:border-[#16869a]">{CUSTOM_CHART_TYPES.map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label><button onClick={addChart} disabled={createChart.isPending} data-testid="button-add-chart" className="flex h-10 items-center gap-1.5 rounded-xl bg-[#16869a] px-4 text-sm font-semibold text-white disabled:opacity-50"><Plus size={15} /> Add chart</button></div>{chartsQuery.isLoading ? <div className="mt-5 grid gap-5 md:grid-cols-2">{[1, 2].map(i => <Skeleton key={i} className="h-56" />)}</div> : chartsQuery.isError ? <p className="mt-4 text-sm text-[#b34a42]">Custom charts could not load. <button onClick={() => chartsQuery.refetch()} className="font-semibold text-[#16869a]">Retry</button></p> : charts.length > 0 ? <div className="mt-5 grid gap-5 md:grid-cols-2">{charts.map((config, index) => { const currentXAxis = xAxisOf(config.xAxis); const currentYAxis = yAxisOf(config.yAxis); const currentChart = chartTypeOf(config.chart); const title = currentChart === "pie" ? `${axisLabel(currentXAxis)} distribution` : `${axisLabel(currentXAxis)} × ${axisLabel(currentYAxis)}`; return <div key={config.id} className="rounded-2xl border border-[#e3ebeb] p-4" data-testid={`custom-chart-${config.id}`}><div className="mb-3 flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{title}</p><p className="mt-1 text-[11px] text-[#7c8c91]">{currentChart === "pie" ? `Grouped by ${axisLabel(currentXAxis)} · measured as ${axisLabel(currentYAxis)}` : `X: ${axisLabel(currentXAxis)} · Y: ${axisLabel(currentYAxis)}`}</p></div><div className="flex shrink-0 items-center gap-1">{CUSTOM_CHART_TYPES.map(entry => <button key={entry.value} onClick={() => updateChart.mutate({ chartId: config.id, data: { chart: entry.value } }, { onSuccess: refresh })} data-testid={`button-chart-type-${config.id}-${entry.value}`} className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${config.chart === entry.value ? "bg-[#16869a] text-white" : "bg-[#eef3f2] text-[#63747c] hover:bg-[#dce9e8]"}`}>{entry.label}</button>)}<button onClick={() => deleteChart.mutate({ chartId: config.id }, { onSuccess: refresh })} aria-label={`Remove ${title} chart`} data-testid={`button-remove-chart-${config.id}`} className="rounded-md p-1.5 text-[#a34d46] transition hover:bg-[#fff1ef]"><X size={14} /></button></div></div><div className="mb-3 flex flex-wrap gap-2"><select value={currentXAxis} onChange={event => updateChart.mutate({ chartId: config.id, data: { xAxis: event.target.value } }, { onSuccess: refresh })} aria-label={`${currentChart === "pie" ? "Group by" : "X axis"} for ${title}`} data-testid={`select-chart-x-axis-${config.id}`} className="h-8 rounded-lg border border-[#d5e0e0] bg-white px-2 text-xs"><option value={currentXAxis}>{axisLabel(currentXAxis)}</option>{CUSTOM_CHART_X_AXES.filter(entry => entry.value !== currentXAxis).map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select><select value={currentYAxis} onChange={event => updateChart.mutate({ chartId: config.id, data: { yAxis: event.target.value } }, { onSuccess: refresh })} aria-label={`${currentChart === "pie" ? "Measure" : "Y axis"} for ${title}`} data-testid={`select-chart-y-axis-${config.id}`} className="h-8 rounded-lg border border-[#d5e0e0] bg-white px-2 text-xs"><option value={currentYAxis}>{axisLabel(currentYAxis)}</option>{CUSTOM_CHART_Y_AXES.filter(entry => entry.value !== currentYAxis).map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></div><CustomChartView data={dataFor({ xAxis: currentXAxis, yAxis: currentYAxis })} chart={currentChart} colorIndex={index} xAxisLabel={axisLabel(currentXAxis)} yAxisLabel={axisLabel(currentYAxis)} /></div>; })}</div> : <p className="mt-4 text-sm text-[#7c8c91]">No custom charts yet. Choose a group and measure for pie, or X and Y for bars and lines.</p>}</Section>;
}

function Dashboard() {
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const roster = useListApplicants({ sort: "rank" }, { query: { queryKey: getListApplicantsQueryKey({ sort: "rank" }) } });
  const usage = useGetSystemUsage({ query: { queryKey: getGetSystemUsageQueryKey() } });
  const usageBars = useMemo(() => {
    const u = usage.data;
    if (!u) return [];
    const mb = (bytes: number) => bytes / (1024 * 1024);
    const fmtMb = (bytes: number) => `${mb(bytes) >= 100 ? Math.round(mb(bytes)) : mb(bytes).toFixed(1)} MB`;
    const rows: { label: string; value: number }[] = [
      { label: `Database · ${fmtMb(u.databaseBytes)} of ${fmtMb(u.databaseQuotaBytes)}`, value: Math.min(100, Math.round((u.databaseBytes / Math.max(1, u.databaseQuotaBytes)) * 100)) },
    ];
    if (u.storageBytes !== null && u.storageBytes !== undefined) rows.push({ label: `Uploads · ${fmtMb(u.storageBytes)} of ${fmtMb(u.storageQuotaBytes)}`, value: Math.min(100, Math.round((u.storageBytes / Math.max(1, u.storageQuotaBytes)) * 100)) });
    if (u.authUsers !== null && u.authUsers !== undefined) rows.push({ label: `Auth users · ${u.authUsers} of ${u.authUsersQuota ?? 50000}`, value: Math.min(100, Math.round((u.authUsers / Math.max(1, u.authUsersQuota ?? 50000)) * 100)) });
    return rows;
  }, [usage.data]);
  const mix = useMemo(() => {
    const genders = new Map<string, number>();
    const skills = new Map<string, number>();
    for (const a of roster.data?.items ?? []) {
      const s = getApplicantSignals(a);
      const g = s.gender ?? "Unknown";
      const k = s.skill ?? "Unknown";
      genders.set(g, (genders.get(g) ?? 0) + 1);
      skills.set(k, (skills.get(k) ?? 0) + 1);
    }
    const genderMix = ["M", "F", "Unknown"].filter(l => (genders.get(l) ?? 0) > 0).map(l => ({ label: l === "M" ? "Male" : l === "F" ? "Female" : "Unknown", value: genders.get(l) ?? 0 }));
    const skillMix = (["BUILD", "CAD", "CODE", "Unknown"] as const).filter(l => (skills.get(l) ?? 0) > 0).map(l => ({ label: l === "Unknown" ? "Unknown" : l[0] + l.slice(1).toLowerCase(), value: skills.get(l) ?? 0 }));
    return { genderMix, skillMix };
  }, [roster.data]);
  if (summary.isLoading) return <><PageHeading eyebrow="Live overview" title="Good morning, coordinators." /><div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div></>;
  if (summary.isError || !summary.data) return <ErrorState onRetry={() => summary.refetch()} />;
  const d = summary.data;
  return <div className="fade-up"><PageHeading eyebrow="Live overview / 08:42 local" title="Good morning, coordinators." detail="The room is calm. Here is the signal across the applicant field." action={<Link href="/display" target="_blank" data-testid="link-launch-display" className="flex items-center gap-2 rounded-xl bg-[#183a4b] px-4 py-3 text-sm font-semibold text-white shadow-sm"><Monitor size={16} /> Launch big screen</Link>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total applicants" value={d.total} tone="navy" note={`${d.reviewed} reviewed so far`} /><StatCard label="Average AI score" value={d.averageScore.toFixed(1)} suffix="/ 100" tone="yellow" note="Across valid applications" /><StatCard label="Interview complete" value={d.interviewProgress.completed} suffix={` / ${d.interviewProgress.completed + d.interviewProgress.remaining}`} tone="teal" note={`${d.interviewProgress.remaining} still in the queue`} /><StatCard label="Needs attention" value={d.invalid} tone="red" note="Invalid or incomplete records" /></div><div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Section title="Score distribution" kicker="AI signal across the current intake"><Bars data={d.scoreBuckets} max={Math.max(...d.scoreBuckets.map(x => x.value), 1)} color="teal" xAxisLabel="Score range" yAxisLabel="Applicants" /></Section><Section title="Recommendation signal" kicker="Review the edges first"><Bars data={d.recommendations} max={Math.max(...d.recommendations.map(x => x.value), 1)} color="yellow" xAxisLabel="Recommendation" yAxisLabel="Applicants" /></Section></div><div className="mt-5 grid gap-5 lg:grid-cols-3"><Section title="Grade mix"><Bars data={d.grades} max={Math.max(...d.grades.map(x => x.value), 1)} color="blue" xAxisLabel="Grade" yAxisLabel="Applicants" /></Section><Section title="Commitment signal"><Bars data={d.commitments} max={Math.max(...d.commitments.map(x => x.value), 1)} color="green" xAxisLabel="Commitment" yAxisLabel="Applicants" /></Section><Section title="Queue pulse" kicker="Individual applicant progression"><div className="flex items-end justify-between"><div><p className="mono text-5xl font-medium tracking-[-.08em] text-[#16869a]">{d.interviewProgress.completed}</p><p className="mt-2 text-sm text-[#718189]">applicants cleared</p></div><div className="h-24 w-24 rounded-full p-2" style={{ background: `conic-gradient(#16869a ${Math.round((d.interviewProgress.completed / Math.max(d.interviewProgress.completed + d.interviewProgress.remaining, 1)) * 100)}%, #e4eceb 0)` }}><div className="flex h-full w-full items-center justify-center rounded-full bg-white text-xs font-semibold">{Math.round((d.interviewProgress.completed / Math.max(d.interviewProgress.completed + d.interviewProgress.remaining, 1)) * 100)}%</div></div></div><Link href="/queue" data-testid="link-view-queue" className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#16869a]">Open interview queue <ChevronRight size={15} /></Link></Section></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><Section title="Gender mix" kicker="M / F across the current intake"><Bars data={mix.genderMix} max={Math.max(...mix.genderMix.map(x => x.value), 1)} color="blue" xAxisLabel="Gender" yAxisLabel="Applicants" /></Section><Section title="Skill mix" kicker="Strongest Build / Code / CAD signal per applicant"><Bars data={mix.skillMix} max={Math.max(...mix.skillMix.map(x => x.value), 1)} color="green" xAxisLabel="Skill" yAxisLabel="Applicants" /></Section></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><Section title="Supabase usage" kicker="Measured live from the database"><Bars data={usageBars} max={100} color="teal" xAxisLabel="Resource" yAxisLabel="Usage %" /><p className="mt-3 text-xs text-[#7c8c91]">{usage.data ? `${usage.data.applicantCount} applicant rows` : "Loading usage…"}</p></Section><Section title="Plan quotas" kicker="Free-tier defaults, override with env"><div className="space-y-2 text-xs leading-5 text-[#52666e]"><p>Database <strong>500 MB</strong> · Uploads <strong>1 GB</strong> · Auth users <strong>50,000</strong> — override with <span className="mono">SUPABASE_DB_QUOTA_MB</span>, <span className="mono">SUPABASE_STORAGE_QUOTA_MB</span>, <span className="mono">SUPABASE_MAU_QUOTA</span>.</p><p>API requests and egress need a Supabase access token, so they are not shown here.</p></div></Section></div><div className="mt-5 grid gap-5 lg:grid-cols-3"><div className="lg:col-span-2"><CustomCharts /></div><div className="space-y-5"><PresencePanel /><BroadcastCard /></div></div></div>;
}
function Bars({ data, max, color, xAxisLabel, yAxisLabel }: { data: DashboardCount[]; max: number; color: "teal" | "yellow" | "blue" | "green"; xAxisLabel?: string; yAxisLabel?: string }) { const c = { teal: "bg-[#16869a]", yellow: "bg-[#edb52c]", blue: "bg-[#466896]", green: "bg-[#3aa582]" }; return <div>{(xAxisLabel || yAxisLabel) && <div className="mb-3 flex justify-between text-[10px] font-semibold uppercase tracking-[.1em] text-[#7c8c91]"><span>Y · {yAxisLabel ?? "Value"}</span><span>X · {xAxisLabel ?? "Category"}</span></div>}<div className="space-y-4">{data.length ? data.map((item, i) => <div key={`${item.label}-${i}`} data-testid={`bar-${item.label}`}><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-[#52666e]">{item.label}</span><span className="mono text-[#7b8a8f]">{item.value}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf1f1]"><div className={`h-full rounded-full ${c[color]} transition-all`} style={{ width: `${Math.max(5, (item.value / max) * 100)}%` }} /></div></div>) : <p className="text-sm text-[#7c8c91]">No signal yet.</p>}</div></div>; }

function VersionHistoryPanel({ onClose }: { onClose: () => void }) {
  const snapshots = useListSnapshots({ query: { queryKey: getListSnapshotsQueryKey() } });
  const create = useCreateSnapshot();
  const restore = useRestoreSnapshot();
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [target, setTarget] = useState<{ id: string; label: string } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [preview, setPreview] = useState<{ added: number; removed: number; changed: number; unchanged: number; addedNames: string[]; removedNames: string[]; labelsChanged?: boolean; labelsBefore?: string[]; labelsNow?: string[]; chartsChanged?: boolean; chartsBefore?: number; chartsNow?: number } | null>(null);
  const refreshBoards = () => {
    queryClient.invalidateQueries({ queryKey: getListSnapshotsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListDashboardChartsQueryKey() });
  };
  const saveNow = () => {
    setError("");
    create.mutate({ data: label.trim() ? { label: label.trim() } : {} }, {
      onSuccess: () => { setLabel(""); refreshBoards(); },
      onError: () => setError("Could not save a version. Try again."),
    });
  };
  const openRestore = (id: string, versionLabel: string) => {
    setTarget({ id, label: versionLabel });
    setConfirm("");
    setPreview(null);
    setError("");
    restore.mutate({ snapshotId: id, data: { dryRun: true } }, {
      onSuccess: response => setPreview(response.preview as { added: number; removed: number; changed: number; unchanged: number; addedNames: string[]; removedNames: string[] }),
      onError: () => setError("Could not preview that version. Try again."),
    });
  };
  const confirmRestore = () => {
    if (!target || confirm !== RESET_CONFIRM_PHRASE || restore.isPending) return;
    restore.mutate({ snapshotId: target.id }, {
      onSuccess: () => { setTarget(null); setConfirm(""); refreshBoards(); },
      onError: () => setError("Restore failed. Nothing was changed."),
    });
  };
  return <div className="mb-5 rounded-2xl border border-[#b9d9d7] bg-[#eaf7f5] p-5" data-testid="version-history-panel">
    <div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[.16em] text-[#16869a]">Version history</p><h2 className="mt-1 font-semibold">Restore any point in time</h2><p className="mt-1 text-xs text-[#587278]">Every restore saves the present first, so you can always go back and forth. Imports save a version automatically.</p></div><IconButton label="Close version history" testId="button-close-history" onClick={onClose}><X size={16} /></IconButton></div>
    <div className="mt-4 flex flex-wrap items-center gap-2"><input value={label} onChange={event => setLabel(event.target.value)} placeholder="Label for this version (optional)" data-testid="input-snapshot-label" className="h-10 min-w-[220px] flex-1 rounded-lg border border-[#c4dcda] bg-white px-3 text-sm outline-none focus:border-[#16869a]" /><button onClick={saveNow} disabled={create.isPending} data-testid="button-save-version" className="rounded-lg bg-[#16869a] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{create.isPending ? "Saving..." : "Save version now"}</button></div>
    <div className="mt-4 space-y-2">{snapshots.isLoading ? [1, 2].map(i => <Skeleton key={i} className="h-14" />) : snapshots.data && snapshots.data.items.length > 0 ? snapshots.data.items.map(item => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e3ebeb] bg-white p-3" data-testid={`snapshot-${item.id}`}><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.label}</p><p className="mt-0.5 text-[11px] text-[#718189]">{item.applicantCount} applicants · by {item.createdBy} · {new Date(item.createdAt).toLocaleString()}</p></div><button onClick={() => openRestore(item.id, item.label)} data-testid={`button-restore-${item.id}`} className="rounded-lg border border-[#c4dcda] px-3 py-2 text-xs font-semibold text-[#385762] hover:border-[#16869a] hover:text-[#16869a]">Restore</button></div>) : <p className="text-sm text-[#7c8c91]">No versions yet. Save one before your next big change.</p>}</div>
    {error && <p className="mt-3 text-xs text-[#ad4b43]" data-testid="history-error">{error}</p>}
    {target && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#112433]/45 p-4" onClick={() => setTarget(null)} data-testid="restore-dialog"><div onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Confirm restore version" className="w-full max-w-md rounded-2xl border border-[#dce5e5] bg-white p-6 shadow-2xl"><h2 className="text-lg font-semibold tracking-[-.02em] text-[#182232]">Restore “{target.label}”?</h2><p className="mt-2 text-sm leading-6 text-[#52666e]">The current data is saved as a new version first, so you can undo this restore afterward.</p>{preview ? <div className="mt-3 rounded-xl bg-[#f4f8f7] p-3 text-sm text-[#38555e]"><p><strong>+{preview.added}</strong> would return{preview.addedNames.length > 0 ? ` (${preview.addedNames.join(", ")})` : ""}</p><p className="mt-1"><strong>-{preview.removed}</strong> would leave{preview.removedNames.length > 0 ? ` (${preview.removedNames.join(", ")})` : ""}</p><p className="mt-1"><strong>{preview.changed}</strong> would change, <strong>{preview.unchanged}</strong> stay the same</p>{preview.labelsChanged && <p className="mt-1">Interviewer labels: <strong>{(preview.labelsNow ?? []).join(", ")}</strong> → <strong>{(preview.labelsBefore ?? []).join(", ")}</strong></p>}{preview.chartsChanged && <p className="mt-1">Custom charts: <strong>{preview.chartsNow}</strong> now vs <strong>{preview.chartsBefore}</strong> in version</p>}</div> : <p className="mt-3 text-sm text-[#7c8c91]">Loading preview…</p>}<label className="mt-4 block text-xs font-semibold text-[#63747c]">Type <code className="rounded bg-[#edf4f3] px-1.5 py-0.5 font-mono text-[11px] text-[#315a61]">{RESET_CONFIRM_PHRASE}</code> to confirm<input value={confirm} onChange={event => setConfirm(event.target.value)} autoFocus data-testid="input-restore-confirm" placeholder={RESET_CONFIRM_PHRASE} className="mt-1.5 h-11 w-full rounded-xl border border-[#d5e0e0] px-3 text-sm outline-none focus:border-[#b34a42]" /></label><div className="mt-5 flex justify-end gap-2"><button onClick={() => setTarget(null)} className="rounded-xl border border-[#d5e0e0] px-4 py-2.5 text-sm font-semibold text-[#52666e] hover:bg-[#f1f6f5]">Cancel</button><button onClick={confirmRestore} disabled={confirm !== RESET_CONFIRM_PHRASE || restore.isPending} data-testid="button-confirm-restore" className="rounded-xl bg-[#b34a42] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{restore.isPending ? "Restoring..." : "Restore version"}</button></div></div></div>}
  </div>;
}

function Applicants() {
  const { settings } = useWorkspaceSettings();
  const [search, setSearch] = useState("");
  const [aiSearchOpen, setAiSearchOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSearchNote, setAiSearchNote] = useState<{ search: string; explanation: string } | null>(null);
  const [category, setCategory] = useState("");
  const [grade, setGrade] = useState("");
  const [sort, setSort] = useState(settings.defaultSort);
  const [selected, setSelected] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [regenAll, setRegenAll] = useState<{ running: boolean; done: number; total: number; current: string; failed: string[]; finished: boolean; cancelled: boolean; error: string }>({ running: false, done: 0, total: 0, current: "", failed: [], finished: false, cancelled: false, error: "" });
  const regenAllCancel = useRef(false);
  const params = useMemo(() => ({ search: search || undefined, category: category || undefined, grade: grade || undefined, sort: sort === "skill" || sort === "gender" ? "rank" : sort }), [search, category, grade, sort]);
  const list = useListApplicants(params, { query: { queryKey: getListApplicantsQueryKey(params) } });
  const skillRank = (s: ApplicantSignals) => s.skill === "BUILD" ? 0 : s.skill === "CAD" ? 1 : s.skill === "CODE" ? 2 : 3;
  const genderRank = (s: ApplicantSignals) => s.gender === "M" ? 0 : s.gender === "F" ? 1 : 2;
  const items = useMemo(() => {
    const rows = list.data?.items ?? [];
    if (sort !== "skill" && sort !== "gender") return rows;
    const sig = new Map(rows.map(a => [a.id, getApplicantSignals(a)] as const));
    const bySkill = (a: Applicant, b: Applicant) => skillRank(sig.get(a.id)!) - skillRank(sig.get(b.id)!) || a.name.localeCompare(b.name);
    const byGender = (a: Applicant, b: Applicant) => genderRank(sig.get(a.id)!) - genderRank(sig.get(b.id)!) || a.name.localeCompare(b.name);
    return [...rows].sort(sort === "skill" ? bySkill : byGender);
  }, [list.data, sort]);
  const update = useUpdateApplicant();
  const interpretSearch = useInterpretApplicantSearch();
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const onDrop = (cat: string) => {
    if (dragId) {
      update.mutate({ id: dragId, data: { category: cat } }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          qc.invalidateQueries({ queryKey: getGetQueueQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() });
          setDragId(null);
        },
        onError: () => setDragId(null),
      });
    }
  };
  const regenerateAllScores = async () => {
    if (regenAll.running) return;
    let roster: Applicant[];
    try {
      const full = await listApplicants({ sort: "rank" });
      roster = full.items;
    } catch {
      setRegenAll(prev => ({ ...prev, finished: true, cancelled: false, error: "Could not load the roster. Try again." }));
      return;
    }
    if (!roster.length) return;
    if (!window.confirm(`Regenerate AI scores for all ${roster.length} applicants? This overwrites every score, recommendation, and summary from transcripts, and can take several minutes. Keep this tab open.`)) return;
    regenAllCancel.current = false;
    setRegenAll({ running: true, done: 0, total: roster.length, current: roster[0].name, failed: [], finished: false, cancelled: false, error: "" });
    const failed: string[] = [];
    for (let i = 0; i < roster.length; i += 1) {
      if (regenAllCancel.current) break;
      const applicant = roster[i];
      setRegenAll(prev => ({ ...prev, current: applicant.name }));
      try {
        await regenerateApplicant(applicant.id);
      } catch {
        failed.push(applicant.name);
      }
      setRegenAll(prev => ({ ...prev, done: i + 1 }));
      if (i < roster.length - 1 && !regenAllCancel.current) await new Promise(resolve => setTimeout(resolve, 750));
    }
    const cancelled = regenAllCancel.current;
    qc.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetQueueQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() });
    setRegenAll(prev => ({ ...prev, running: false, failed, finished: true, cancelled }));
  };
  return <div className="fade-up">
    <PageHeading eyebrow="Applicant review / triage" title="The applicant field." detail="Rank with your co-coordinator. Drag a candidate into a decision lane when the signal is clear." action={<div className="flex flex-wrap gap-2">
      <button onClick={() => setPrintOpen(true)} data-testid="button-print-roster" className="flex items-center gap-2 rounded-xl border border-[#cbd9da] bg-white px-4 py-3 text-sm font-semibold text-[#385762]"><Printer size={16} /> Print roster</button>
      <button onClick={() => setImportOpen(!importOpen)} data-testid="button-import" className="flex items-center gap-2 rounded-xl border border-[#cbd9da] bg-white px-4 py-3 text-sm font-semibold text-[#385762]"><FileUp size={16} /> Import roster</button>
      <button onClick={() => setExportOpen(!exportOpen)} data-testid="button-export" className="flex items-center gap-2 rounded-xl border border-[#cbd9da] bg-white px-4 py-3 text-sm font-semibold text-[#385762]"><Download size={16} /> Export roster</button>
      <button onClick={() => setHistoryOpen(!historyOpen)} data-testid="button-version-history" className="flex items-center gap-2 rounded-xl border border-[#cbd9da] bg-white px-4 py-3 text-sm font-semibold text-[#385762]"><History size={16} /> Version history</button>
      <button onClick={() => void regenerateAllScores()} disabled={regenAll.running} data-testid="button-regenerate-all-scores" title="Regenerate every AI score from transcripts" className="flex items-center gap-2 rounded-xl border border-[#a9d3ce] bg-[#eff8f6] px-4 py-3 text-sm font-semibold text-[#12737d] disabled:opacity-50"><RefreshCw size={16} className={regenAll.running ? "animate-spin" : ""} /> {regenAll.running ? `Regenerating ${regenAll.done}/${regenAll.total}` : "Regenerate all scores"}</button>
    </div>} />
    {importOpen && <ImportPanel onClose={() => setImportOpen(false)} />}
    {exportOpen && <ExportPanel applicants={list.data?.items ?? []} onClose={() => setExportOpen(false)} />}
    {historyOpen && <VersionHistoryPanel onClose={() => setHistoryOpen(false)} />}
    {(regenAll.running || regenAll.finished) && <div className="mb-5 rounded-2xl border border-[#a9d3ce] bg-[#eff8f6] p-5" data-testid="regen-all-panel">
      <div className="flex items-start justify-between gap-3"><div>
        <p className="mono text-[10px] uppercase tracking-[.16em] text-[#16869a]">Bulk AI scoring</p>
        {regenAll.error ? <h2 className="mt-1 font-semibold">{regenAll.error}</h2> : regenAll.running
          ? <h2 className="mt-1 font-semibold">Regenerating {regenAll.done} of {regenAll.total} — {regenAll.current}…</h2>
          : <h2 className="mt-1 font-semibold">{regenAll.cancelled ? `Stopped after ${regenAll.done} of ${regenAll.total}` : `Finished ${regenAll.done} of ${regenAll.total}`}{regenAll.failed.length > 0 ? ` · ${regenAll.failed.length} failed` : regenAll.done > 0 ? " · all saved" : ""}</h2>}
        {!regenAll.error && <p className="mt-1 text-xs text-[#587278]">{regenAll.running ? "Scores regenerate one by one to stay under the free AI tier limit. Keep this tab open." : regenAll.failed.length > 0 ? `Failed: ${regenAll.failed.join(", ")}. Re-run to retry them.` : "Every applicant now has a fresh evaluation from their transcript."}</p>}
      </div>{regenAll.running
        ? <button onClick={() => { regenAllCancel.current = true; }} data-testid="button-cancel-regen-all" className="shrink-0 rounded-lg border border-[#e0b8b4] bg-white px-4 py-2.5 text-sm font-semibold text-[#a34d46]">Cancel</button>
        : <button onClick={() => setRegenAll(prev => ({ ...prev, finished: false, error: "" }))} data-testid="button-dismiss-regen-all" className="shrink-0 rounded-lg border border-[#cbd9da] bg-white px-4 py-2.5 text-sm font-semibold text-[#385762]">Dismiss</button>}</div>
      {!regenAll.error && <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#d7e8e5]"><div className="h-full rounded-full bg-[#16869a] transition-all" style={{ width: `${regenAll.total ? Math.round((regenAll.done / regenAll.total) * 100) : 0}%` }} /></div>}
    </div>}
    {list.isLoading ? <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}</div> : list.isError ? <ErrorState compact onRetry={() => list.refetch()} /> : <>
      <div className="mb-5 rounded-2xl border border-[#dce5e5] bg-white p-3">
        <div className="flex flex-wrap gap-2">
         <div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute left-3 top-3 text-[#819198]" /><input value={search} onChange={e => { setSearch(e.target.value); setAiSearchNote(null); }} data-testid="input-search-applicants" aria-label="Search applicants with text or qualifiers" placeholder="Search applicants or try name:maya age:>=14..." className="h-10 w-full rounded-lg border border-[#dce5e5] pl-9 pr-10 text-sm outline-none focus:border-[#16869a]" /><button type="button" onClick={() => setAiSearchOpen(open => !open)} title="Ask AI to build this search" aria-label="Ask AI to build this search" data-testid="button-ai-search" className={`absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md transition ${aiSearchOpen ? "bg-[#dff2ee] text-[#12737d]" : "text-[#16869a] hover:bg-[#edf7f5]"}`}><Sparkles size={14} /></button></div>
        <select value={category} onChange={e => setCategory(e.target.value)} data-testid="select-category-filter" className="h-10 rounded-lg border border-[#dce5e5] bg-white px-3 text-sm"><option value="">All categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select value={grade} onChange={e => setGrade(e.target.value)} data-testid="select-grade-filter" className="h-10 rounded-lg border border-[#dce5e5] bg-white px-3 text-sm"><option value="">All grades</option>{["6th","7th","8th"].map(g => <option key={g} value={g}>{g}</option>)}</select>
        <select value={sort} onChange={e => setSort(e.target.value)} data-testid="select-sort" className="h-10 rounded-lg border border-[#dce5e5] bg-white px-3 text-sm" title="Sort applicants"><option value="rank">Sort: Rank</option><option value="queue">Sort: Queue order</option><option value="score">Sort: AI score</option><option value="name">Sort: Name</option><option value="grade">Sort: Grade</option><option value="skill">Sort: Skill</option><option value="gender">Sort: Gender</option><option value="newest">Sort: Newest first</option><option value="oldest">Sort: Oldest first</option></select>
        <button onClick={() => { setSearch(""); setCategory(""); setGrade(""); setSort("rank"); }} data-testid="button-reset-filters" className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-[#60757c] hover:bg-[#edf2f2]"><RefreshCw size={14} /> Reset</button>
         </div>
          {aiSearchOpen && <form onSubmit={event => { event.preventDefault(); const prompt = aiPrompt.trim(); if (!prompt || interpretSearch.isPending) return; interpretSearch.mutate({ data: { prompt } }, { onSuccess: result => { setSearch(result.search); setAiSearchNote(result); }, }); }} className="ai-search-panel mt-2 rounded-xl border border-[#b9d9d7] bg-[#f2faf8] p-2.5" data-testid="ai-search-panel"><div className="flex flex-wrap gap-2"><input value={aiPrompt} onChange={event => setAiPrompt(event.target.value)} autoFocus placeholder="Try “female applicants who code, but not CAD”" aria-label="Describe the applicant search" data-testid="input-ai-search" className="ai-search-input h-9 min-w-[220px] flex-1 rounded-lg border border-[#c9e0dd] bg-white px-3 text-sm outline-none focus:border-[#16869a]" /><button type="submit" disabled={interpretSearch.isPending || !aiPrompt.trim()} data-testid="button-run-ai-search" className="ai-search-submit flex h-9 items-center gap-1.5 rounded-lg bg-[#16869a] px-3 text-xs font-semibold text-white disabled:opacity-50"><Sparkles size={13} /> {interpretSearch.isPending ? "Building…" : "Build search"}</button></div>{interpretSearch.isError && <p className="ai-search-error mt-2 text-xs text-[#ad4b43]">{serverErrorMessage(interpretSearch.error, "The assistant could not build that search. Try again.")}</p>}{aiSearchNote && <p className="ai-search-result mt-2 text-xs leading-5 text-[#48656b]">Using <code className="ai-search-query rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-[#315a61]">{aiSearchNote.search}</code> · {aiSearchNote.explanation}</p>}</form>}
         <p className="mt-2 text-[11px] leading-5 text-[#7c8c91]" data-testid="applicant-search-help">Qualifiers: <code className="font-mono text-[#526d75]">name:</code>, <code className="font-mono text-[#526d75]">age:</code>, <code className="font-mono text-[#526d75]">gender:</code>, <code className="font-mono text-[#526d75]">grade:</code>, <code className="font-mono text-[#526d75]">skill:</code>, <code className="font-mono text-[#526d75]">recommendation:</code>, <code className="font-mono text-[#526d75]">category:</code>, <code className="font-mono text-[#526d75]">status:</code>, <code className="font-mono text-[#526d75]">invalid:true</code>. Combine with <code className="font-mono text-[#526d75]">AND</code>, <code className="font-mono text-[#526d75]">OR</code>, <code className="font-mono text-[#526d75]">NOT</code>, parentheses, or <code className="font-mono text-[#526d75]">IF … THEN …</code>. Quote values with spaces.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
        <div className="overflow-hidden rounded-2xl border border-[#dce5e5] bg-white">
          <div className="flex items-center justify-between border-b border-[#e5ecec] px-5 py-4"><div><h2 className="font-semibold">Review queue <span className="mono ml-2 text-xs text-[#16869a]">{list.data?.total ?? 0}</span></h2></div><span className="flex items-center gap-2 text-xs text-[#7c8c91]"><Filter size={14} /> filtered view</span></div>
          {!items.length ? <div className="p-12 text-center"><UsersRound className="mx-auto text-[#b8c6c9]" /><p className="mt-3 font-semibold">No applicants match these filters.</p>{search.trim() && <p className="mt-1 break-words text-sm text-[#526d75]">Active search: <code className="font-mono">{search.trim()}</code></p>}<p className="mt-1 text-sm text-[#7c8c91]">Try widening the search or reset the filters.</p></div> : <div className="divide-y divide-[#edf1f1]">{items.map((a, i) => <ApplicantRow key={a.id} applicant={a} index={i} onSelect={() => setSelected(a.id)} onDragStart={() => setDragId(a.id)} onDragEnd={() => setDragId(null)} />)}</div>}
        </div>
        <div className="space-y-3">{categories.slice(0,3).map(cat => <DropLane key={cat} category={cat} applicants={items.filter(a => a.category === cat) ?? []} onDrop={() => onDrop(cat)} onSelect={setSelected} onDragStart={setDragId} onDragEnd={() => setDragId(null)} />)}</div>
      </div>
    </>}
    {selected && <ApplicantDetail id={selected} onClose={() => setSelected(null)} />}
    {printOpen && <PrintRoster applicants={list.data?.items ?? []} onClose={() => setPrintOpen(false)} />}
  </div>;
}
function ApplicantRow({ applicant: a, index, onSelect, onDragStart, onDragEnd }: { applicant: Applicant; index: number; onSelect: () => void; onDragStart: () => void; onDragEnd?: () => void }) { const tone = a.aiRecommendation.toLowerCase().includes("advance") ? "teal" : a.aiRecommendation.toLowerCase().includes("decline") ? "red" : "yellow"; const signals = getApplicantSignals(a); const { settings } = useWorkspaceSettings(); const compact = settings.density === "compact"; const flagUpdate = useUpdateApplicant(); const rowQc = useQueryClient(); const toggleFlag = () => flagUpdate.mutate({ id: a.id, data: { flagged: !a.flagged } }, { onSuccess: () => { rowQc.invalidateQueries({ queryKey: getListApplicantsQueryKey() }); rowQc.invalidateQueries({ queryKey: getGetQueueQueryKey() }); rowQc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); rowQc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() }); } }); return <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} data-testid={`row-applicant-${a.id}`} className={`group flex cursor-grab items-center gap-3 px-5 transition hover:bg-[#f6f9f8] ${compact ? "py-2" : "py-4"}`}><GripVertical size={15} className="shrink-0 text-[#b4c1c4]" />{settings.showPhotos && (a.photoUrl ? <img src={a.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl border border-[#dcecea] object-cover" /> : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#dcecea] text-sm font-bold text-[#176a77]">{a.name.split(" ").map(x => x[0]).join("").slice(0,2)}</div>)}<button onClick={onSelect} data-testid={`button-open-applicant-${a.id}`} className="min-w-0 flex-1 text-left"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold">{a.name}</p><Badge tone={tone}>{a.aiRecommendation}</Badge><SignalChips signals={signals} /></div><p className="mt-1 truncate text-xs text-[#7a8b90]">Grade {a.grade} · {a.roboticsExperience || "No robotics experience noted"}</p></button><button onClick={toggleFlag} title={a.flagged ? "Remove flag" : "Flag for follow-up"} aria-label={a.flagged ? "Remove flag" : "Flag for follow-up"} data-testid={`button-flag-${a.id}`} className={`shrink-0 rounded-lg p-2 transition ${a.flagged ? "text-[#b34a42]" : "text-[#b4c1c4] hover:text-[#b34a42]"}`}><Flag size={15} className={a.flagged ? "fill-current" : ""} /></button><div className="hidden text-right sm:block"><p className="mono text-lg font-medium text-[#183a4b]">{a.aiScore.toFixed(1)}</p><p className="text-[10px] uppercase tracking-[.1em] text-[#9aa7aa]">AI score</p></div><ChevronRight size={16} className="text-[#b4c1c4]" /></div>; }
function DropLane({ category, applicants, onDrop, onSelect, onDragStart, onDragEnd }: { category: string; applicants: Applicant[]; onDrop: () => void; onSelect: (id: string) => void; onDragStart: (id: string) => void; onDragEnd?: () => void }) { const labels: Record<string,string> = { advance: "Advance", hold: "Hold & discuss", decline: "Decline" }; return <div onDragOver={e => e.preventDefault()} onDrop={onDrop} data-testid={`drop-lane-${category}`} className="rounded-2xl border border-dashed border-[#c5d5d7] bg-[#eef4f3] p-3"><div className="flex items-center justify-between px-2 py-1"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#4f6870]">{labels[category]}</p><span className="mono text-xs text-[#809196]">{applicants.length}</span></div><p className="px-2 pb-2 pt-1 text-[11px] text-[#819196]">Drop candidates here{applicants.length > 4 ? ` · showing 4 of ${applicants.length}` : ""}</p>{applicants.slice(0,4).map(a => <button key={a.id} draggable onDragStart={e => { e.stopPropagation(); onDragStart(a.id); }} onDragEnd={onDragEnd} onClick={() => onSelect(a.id)} data-testid={`lane-applicant-${a.id}`} className="mb-2 flex w-full cursor-grab items-center justify-between rounded-xl border border-[#d7e4e3] bg-white px-3 py-3 text-left shadow-sm active:cursor-grabbing"><span className="truncate text-xs font-semibold">{a.name}</span><span className="mono text-xs text-[#16869a]">{a.aiScore.toFixed(1)}</span></button>)}</div>; }
type ExportFormat = "csv" | "semicolon" | "tsv" | "xlsx";

const EXPORT_FORMATS: { value: ExportFormat; label: string; extension: string; mime: string }[] = [
  { value: "csv", label: "CSV (comma)", extension: "csv", mime: "text/csv" },
  { value: "semicolon", label: "CSV (semicolon)", extension: "csv", mime: "text/csv" },
  { value: "tsv", label: "TSV (tab)", extension: "tsv", mime: "text/tab-separated-values" },
  { value: "xlsx", label: "Excel (.xlsx)", extension: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
];

const EXPORT_HEADERS = ["id", "name", "grade", "age", "gender", "email", "ai_score", "ai_recommendation", "ai_summary", "ai_strengths", "ai_concerns", "robotics_experience", "commit_10_hours", "parent_volunteer", "category", "attendance", "late_arrival_time", "makeup_date", "attendance_excused", "seat", "interview_status", "interviewer", "interview_decision", "notes"];

function applicantToExportRow(a: Applicant): (string | number)[] {
  return [a.id, a.name, a.grade, a.age ?? "", a.gender ?? "", a.email ?? "", a.aiScore, a.aiRecommendation, a.aiSummary, a.aiStrengths, a.aiConcerns, a.roboticsExperience, a.commit10Hours, a.parentVolunteer, a.category, a.attendance ?? "unmarked", a.lateArrivalTime ?? "", a.makeupDate ?? "", a.attendanceExcused == null ? "" : a.attendanceExcused ? "excused" : "unexcused", a.seatRow != null && a.seatCol != null ? `R${a.seatRow + 1}C${a.seatCol + 1}` : "", a.interviewStatus ?? "", a.interviewer ?? "", a.interviewDecision ?? "", a.notes ?? ""];
}

function escapeDelimitedCell(value: string | number, delimiter: string): string {
  const text = String(value ?? "");
  if (text.includes('"') || text.includes("\n") || text.includes("\r") || text.includes(delimiter)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildDelimitedExport(applicants: Applicant[], delimiter: string): string {
  const lines = [EXPORT_HEADERS.map(header => escapeDelimitedCell(header, delimiter)).join(delimiter)];
  for (const applicant of applicants) {
    lines.push(applicantToExportRow(applicant).map(cell => escapeDelimitedCell(cell, delimiter)).join(delimiter));
  }
  return lines.join("\n");
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function ExportPanel({ applicants, onClose }: { applicants: Applicant[]; onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = EXPORT_FORMATS.find(entry => entry.value === format) ?? EXPORT_FORMATS[0];
  const fileName = `roster-${new Date().toISOString().slice(0, 10)}.${selected.extension}`;
  const download = async () => {
    if (!applicants.length || busy) return;
    setBusy(true);
    setError("");
    try {
      if (format === "xlsx") {
        const XLSX = await import("xlsx");
        const sheet = XLSX.utils.json_to_sheet(applicants.map(a => Object.fromEntries(EXPORT_HEADERS.map((header, index) => [header, applicantToExportRow(a)[index]]))));
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, sheet, "Roster");
        const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
        downloadBlob(new Blob([bytes], { type: selected.mime }), fileName);
      } else {
        const delimiter = format === "tsv" ? "\t" : format === "semicolon" ? ";" : ",";
        downloadBlob(new Blob([buildDelimitedExport(applicants, delimiter)], { type: `${selected.mime};charset=utf-8` }), fileName);
      }
    } catch {
      setError("The export could not be generated. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return <div className="mb-5 rounded-2xl border border-[#b9d9d7] bg-[#eaf7f5] p-5" data-testid="export-panel">
    <div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[.16em] text-[#16869a]">Roster export</p><h2 className="mt-1 font-semibold">Download {applicants.length} applicant{applicants.length === 1 ? "" : "s"}</h2><p className="mt-1 text-xs text-[#587278]">Exports the current filtered view with headers the importer understands, so files round-trip.</p></div><IconButton label="Close export" testId="button-close-export" onClick={onClose}><X size={16} /></IconButton></div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><select value={format} onChange={event => setFormat(event.target.value as ExportFormat)} data-testid="select-export-format" className="h-10 rounded-lg border border-[#c4dcda] bg-white px-3 text-sm outline-none focus:border-[#16869a]">{EXPORT_FORMATS.map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select><button disabled={!applicants.length || busy} onClick={download} data-testid="button-download-export" className="flex items-center gap-2 rounded-lg bg-[#16869a] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Download size={15} /> {busy ? "Preparing..." : `Download ${fileName}`}</button></div>
    {error && <p className="mt-3 text-xs text-[#ad4b43]" data-testid="export-error">{error}</p>}
  </div>;
}

function ImportPanel({ onClose }: { onClose: () => void }) {
  const upload = useRequestUploadUrl();
  const commit = useCommitImport();
  const preview = usePreviewImport();
  const history = useListImportHistory({ query: { queryKey: getListImportHistoryQueryKey() } });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [previews, setPreviews] = useState<{ file: File; objectPath: string; preview: ImportPreview }[]>([]);
  const submit = async () => {
    if (!files.length) return;
    setError("");
    try {
      const next: { file: File; objectPath: string; preview: ImportPreview }[] = [];
      for (const file of files) {
        const isExcel = /\.xlsx?$/i.test(file.name);
        const contentType = file.type || (isExcel ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv");
        const requested = await upload.mutateAsync({ data: { name: file.name, size: file.size, contentType } });
        const sameOriginUpload = (() => { try { return new URL(requested.uploadURL, window.location.href).origin === window.location.origin; } catch { return false; } })();
        const response = await fetch(requested.uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: file, ...(sameOriginUpload ? { credentials: "include" as const } : {}) });
        if (!response.ok) throw new Error("Upload failed");
        const rowCount = isExcel ? 0 : Math.max(0, (await file.text()).split(/\r?\n/).filter(Boolean).length - 1);
        const filePreview = await preview.mutateAsync({ data: { objectPath: requested.objectPath, fileName: file.name, rowCount } });
        next.push({ file, objectPath: requested.objectPath, preview: filePreview });
        setPreviews([...next]);
      }
    } catch {
      setError("The roster could not be uploaded. Check the file and try again.");
    }
  };
  const confirmImport = async () => {
    if (!previews.length) return;
    try {
      for (const item of previews) {
        await commit.mutateAsync({ data: { objectPath: item.objectPath, fileName: item.file.name, rowCount: item.preview.rowCount } });
      }
      setFiles([]);
      setPreviews([]);
      await history.refetch();
      queryClient.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() });
    } catch {
      setError("The roster previewed successfully, but the commit failed.");
    }
  };
  const pending = upload.isPending || preview.isPending || commit.isPending;
  const totals = previews.reduce((total, item) => ({
    added: total.added + item.preview.diff.added,
    updated: total.updated + item.preview.diff.updated,
    unchanged: total.unchanged + item.preview.diff.unchanged,
    missing: total.missing + item.preview.diff.missingFromUpload,
  }), { added: 0, updated: 0, unchanged: 0, missing: 0 });
  return <div className="mb-5 rounded-2xl border border-[#b9d9d7] bg-[#eaf7f5] p-5">
    <div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[.16em] text-[#16869a]">Roster ingestion</p><h2 className="mt-1 font-semibold">Import one or more roster files</h2><p className="mt-1 text-xs text-[#587278]">CSV, TSV, Excel (.xlsx/.xls), comma, semicolon, quoted, and mixed-delimiter rows are recovered before commit. First Excel sheet is used; headers like “AI Score” map automatically.</p></div><IconButton label="Close import" testId="button-close-import" onClick={onClose}><X size={16} /></IconButton></div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><input type="file" multiple accept=".csv,.tsv,.xlsx,.xls,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={e => { setFiles(Array.from(e.target.files ?? [])); setPreviews([]); setError(""); }} data-testid="input-import-file" className="max-w-full rounded-lg border border-[#c4dcda] bg-white px-3 py-2 text-sm" /><button disabled={!files.length || pending} onClick={submit} data-testid="button-preview-import" className="rounded-lg bg-[#16869a] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Reading files..." : `Preview ${files.length || ""} file${files.length === 1 ? "" : "s"}`}</button></div>
    {files.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{files.map(file => <span key={`${file.name}-${file.lastModified}`} className="rounded-full bg-white px-3 py-1 text-xs text-[#587278]">{file.name} · {Math.ceil(file.size / 1024)} KB</span>)}</div>}
    {previews.length > 0 && <div className="mt-4 rounded-xl border border-[#b9d9d7] bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">{previews.length} preview{previews.length === 1 ? "" : "s"} ready</p><p className="mt-1 text-xs text-[#718189]">Review each file’s detected format and diff, then commit them together.</p></div><button disabled={commit.isPending || previews.length !== files.length} onClick={confirmImport} data-testid="button-commit-import" className="rounded-lg bg-[#183a4b] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{commit.isPending ? "Committing..." : `Commit ${previews.length} file${previews.length === 1 ? "" : "s"}`}</button></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Added", totals.added, "text-[#168069]"], ["Updated", totals.updated, "text-[#466896]"], ["Unchanged", totals.unchanged, "text-[#718189]"], ["Missing from files", totals.missing, "text-[#bd5047]"]].map(([label, value, tone]) => <div key={String(label)} className="rounded-lg bg-[#f4f8f7] p-3"><p className="text-[10px] uppercase tracking-[.1em] text-[#7c8c91]">{label}</p><p className={`mono mt-1 text-xl ${tone}`}>{value}</p></div>)}</div><div className="mt-4 space-y-2">{previews.map(item => <div key={item.objectPath} className="rounded-lg border border-[#e3ebeb] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold">{item.file.name}</span><span className="text-[11px] text-[#7c8c91]">{item.preview.rowCount} valid rows · delimiter: {item.preview.delimiter === "tab" ? "TAB" : item.preview.delimiter}</span></div>{item.preview.warnings.length > 0 && <p className="mt-2 text-xs text-[#805c08]">{item.preview.warnings.join(" ")}</p>}</div>)}</div></div>}
    {commit.isSuccess && <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#168069]"><Check size={14} /> Import committed successfully and saved to history.</p>}
    {history.data?.items.length ? <div className="mt-5 border-t border-[#c9e0de] pt-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#587278]">Saved import history</p><div className="mt-2 space-y-2">{history.data.items.slice(0, 4).map(item => <div key={item.importId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs"><span className="font-semibold">{item.fileName}</span><span className="text-[#718189]">{item.imported} rows · {item.diff.added} added · {item.diff.updated} updated · {new Date(item.createdAt).toLocaleDateString()}</span></div>)}</div></div> : null}
    {error && <p className="mt-3 text-xs text-[#ad4b43]" data-testid="import-error">{error}</p>}
  </div>;
}

type PrintField = "name" | "grade" | "score" | "recommendation" | "category" | "status" | "email" | "notes";
const printFieldOptions: { key: PrintField; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "grade", label: "Grade" },
  { key: "score", label: "AI score" },
  { key: "recommendation", label: "Recommendation" },
  { key: "category", label: "Category" },
  { key: "status", label: "Interview status" },
  { key: "email", label: "Email" },
  { key: "notes", label: "Coordinator notes" },
];

function PrintRoster({ applicants, onClose }: { applicants: Applicant[]; onClose: () => void }) {
  const [fields, setFields] = useState<Record<PrintField, boolean>>({
    name: true, grade: true, score: true, recommendation: true,
    category: false, status: false, email: false, notes: false,
  });
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    const timer = window.setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [printing]);
  const selectedFields = printFieldOptions.filter(({ key }) => fields[key]);
  const valueFor = (applicant: Applicant, key: PrintField) => ({
    name: applicant.name,
    grade: applicant.grade,
    score: applicant.aiScore < 0 ? "Invalid" : applicant.aiScore.toFixed(1),
    recommendation: applicant.aiRecommendation,
    category: applicant.category || "Unranked",
    status: applicant.interviewStatus,
    email: applicant.email || "—",
    notes: applicant.notes || "—",
  }[key]);
  return <div className="print-modal fixed inset-0 z-50 flex items-center justify-center bg-[#112433]/45 p-5" onClick={onClose}>
    <section onClick={e => e.stopPropagation()} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[#16869a]">Output / roster</p><h2 className="mt-2 text-2xl font-semibold">Choose what to print</h2><p className="mt-1 text-sm text-[#718189]">This prints the current filtered applicant list, not the entire private file by default.</p></div><IconButton label="Close print options" testId="button-close-print" onClick={onClose}><X size={16} /></IconButton></div>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">{printFieldOptions.map(({ key, label }) => <label key={key} className="flex items-center gap-2 rounded-lg border border-[#e1e9e8] px-3 py-2 text-xs font-medium"><input type="checkbox" checked={fields[key]} onChange={e => setFields(current => ({ ...current, [key]: e.target.checked }))} className="h-4 w-4 accent-[#16869a]" />{label}</label>)}</div>
      <div className="mt-6 overflow-hidden rounded-xl border border-[#dce5e5]"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-[#f3f7f6]"><tr>{selectedFields.map(field => <th key={field.key} className="whitespace-nowrap px-3 py-3 font-semibold text-[#52666e]">{field.label}</th>)}</tr></thead><tbody className="divide-y divide-[#edf1f1]">{applicants.slice(0, 12).map(applicant => <tr key={applicant.id}>{selectedFields.map(field => <td key={field.key} className="max-w-[220px] truncate px-3 py-3 text-[#52666e]">{valueFor(applicant, field.key)}</td>)}</tr>)}</tbody></table></div>{applicants.length > 12 && <p className="border-t border-[#edf1f1] px-3 py-2 text-[11px] text-[#7c8c91]">Preview shows 12 rows. Printing includes all {applicants.length} filtered applicants.</p>}</div>
      <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-[#60757c]">Cancel</button><button disabled={!selectedFields.length || !applicants.length || printing} onClick={() => setPrinting(true)} data-testid="button-print-selected-roster" className="flex items-center gap-2 rounded-lg bg-[#183a4b] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Printer size={15} /> Print selected fields</button></div>
    </section>
    <div className="print-only">
      <h1>Robotics tryout applicant roster</h1>
      <p>Generated {new Date().toLocaleString()} · {applicants.length} applicants</p>
      <table><thead><tr>{selectedFields.map(field => <th key={field.key}>{field.label}</th>)}</tr></thead><tbody>{applicants.map(applicant => <tr key={applicant.id}>{selectedFields.map(field => <td key={field.key}>{valueFor(applicant, field.key)}</td>)}</tr>)}</tbody></table>
    </div>
  </div>;
}

function ApplicantDetail({ id, onClose }: { id: string; onClose: () => void }) { const detail = useGetApplicant(id, { query: { enabled: Boolean(id), queryKey: getGetApplicantQueryKey(id) } }); const update = useUpdateApplicant(); const remove = useDeleteApplicant(); const regen = useRegenerateApplicant(); const photoUpload = useRequestUploadUrl(); const [photoError, setPhotoError] = useState(""); const [notes, setNotes] = useState(""); const [editName, setEditName] = useState(""); const [editGrade, setEditGrade] = useState(""); const [editEmail, setEditEmail] = useState(""); const [editScore, setEditScore] = useState(""); const [editRec, setEditRec] = useState(""); useEffect(() => { if (detail.data) { setNotes(detail.data.notes); setEditName(detail.data.name); setEditGrade(detail.data.grade); setEditEmail(detail.data.email ?? ""); setEditScore(String(detail.data.aiScore)); setEditRec(detail.data.aiRecommendation); } }, [detail.data]); if (detail.isLoading) return <div className="fixed inset-y-0 right-0 z-40 w-full max-w-[500px] bg-white p-6 shadow-2xl"><Skeleton className="h-8 w-40" /><Skeleton className="mt-8 h-28 w-full" /></div>; if (!detail.data) return null; const a = detail.data; const save = (data: ApplicantUpdate) => update.mutate({ id: a.id, data }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetApplicantQueryKey(a.id) }); queryClient.invalidateQueries({ queryKey: getListApplicantsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() }); } }); const saveInfo = () => { const parsedScore = Number(editScore); return save({ name: editName.trim() || a.name, grade: editGrade.trim() || a.grade, email: editEmail.trim(), aiScore: Number.isFinite(parsedScore) ? Math.round(parsedScore) : a.aiScore, aiRecommendation: editRec.trim() || a.aiRecommendation }); }; const regenerate = () => { if (regen.isPending) return; regen.mutate({ id: a.id }, { onSuccess: fresh => { setEditScore(String(fresh.aiScore)); setEditRec(fresh.aiRecommendation); queryClient.invalidateQueries({ queryKey: getGetApplicantQueryKey(a.id) }); queryClient.invalidateQueries({ queryKey: getListApplicantsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); } }); }; const uploadPhoto = async (file: File) => {
    setPhotoError("");
    if (!file.type.startsWith("image/")) { setPhotoError("Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoError("Images must be under 5 MB."); return; }
    try {
      const requested = await photoUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type } });
      const putUrl = requested.uploadURL;
      const sameOrigin = (() => { try { return new URL(putUrl, window.location.href).origin === window.location.origin; } catch { return false; } })();
      const response = await fetch(putUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file, ...(sameOrigin ? { credentials: "include" as const } : {}) });
      if (!response.ok) throw new Error("Upload failed");
      const photoUrl = `/api/storage/objects/${requested.objectPath.replace(/^\/objects\//, "")}`;
      save({ photoUrl });
    } catch {
      setPhotoError("Photo upload failed. Try again.");
    }
  };
  const destroy = () => { if (remove.isPending || !window.confirm(`Delete ${a.name} permanently? This cannot be undone.`)) return; remove.mutate({ id: a.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListApplicantsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() }); onClose(); } }); }; return <div className="fixed inset-0 z-40 bg-[#112433]/25" onClick={onClose}><aside onClick={e => e.stopPropagation()} className="absolute inset-y-0 right-0 w-full max-w-[520px] overflow-y-auto bg-[#f8faf9] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[#16869a]">Applicant file / {a.id.slice(0,8)}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.05em]">{a.name}</h2><p className="mt-1 text-sm text-[#718189]">Grade {a.grade} · {a.email || "No email provided"}</p></div><div className="flex items-center gap-2"><button onClick={() => save({ flagged: !a.flagged })} title={a.flagged ? "Remove flag" : "Flag for follow-up"} aria-label={a.flagged ? "Remove flag" : "Flag for follow-up"} data-testid={`button-flag-detail-${a.id}`} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${a.flagged ? "border-[#f8c84a] bg-[#fff3cf] text-[#805c08]" : "border-[#cbd9da] text-[#60757c]"}`}><Flag size={14} className={a.flagged ? "fill-current" : ""} />{a.flagged ? "Flagged" : "Flag"}</button><IconButton label="Close applicant detail" testId="button-close-detail" onClick={onClose}><X size={17} /></IconButton></div></div><div className="mt-5 rounded-2xl border border-[#dce5e5] bg-white p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">Applicant info</h3>{update.isSuccess && <span className="text-xs font-semibold text-[#168069]">Saved</span>}</div><div className="mt-4 grid gap-3"><label className="text-xs font-semibold text-[#63747c]">Name<input value={editName} onChange={e => setEditName(e.target.value)} data-testid="input-detail-name" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-3 text-sm font-normal text-[#182232] outline-none focus:border-[#16869a]" /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-[#63747c]">Grade<input value={editGrade} onChange={e => setEditGrade(e.target.value)} data-testid="input-detail-grade" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-3 text-sm font-normal text-[#182232] outline-none focus:border-[#16869a]" /></label><label className="text-xs font-semibold text-[#63747c]">Email<input value={editEmail} onChange={e => setEditEmail(e.target.value)} data-testid="input-detail-email" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-3 text-sm font-normal text-[#182232] outline-none focus:border-[#16869a]" /></label></div><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-[#63747c]">AI score (whole number)<input value={editScore} onChange={e => setEditScore(e.target.value)} inputMode="numeric" data-testid="input-detail-score" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-3 text-sm font-normal text-[#182232] outline-none focus:border-[#16869a]" /></label><label className="text-xs font-semibold text-[#63747c]">Recommendation<input value={editRec} onChange={e => setEditRec(e.target.value)} data-testid="input-detail-recommendation" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-3 text-sm font-normal text-[#182232] outline-none focus:border-[#16869a]" /></label></div>{a.aiScore === -1 && <p className="text-xs text-[#805c08]">Score is invalid (-1). Enter the corrected score, or fix the file and re-import.</p>}</div><button onClick={saveInfo} data-testid="button-save-info" className="mt-3 flex items-center gap-2 rounded-lg bg-[#183a4b] px-4 py-2.5 text-sm font-semibold text-white"><Check size={15} /> Save details</button></div><div className="mt-5 rounded-2xl border border-[#dce5e5] bg-white p-5"><h3 className="font-semibold">Profile photo</h3><div className="mt-3 flex items-center gap-4">{a.photoUrl ? <img src={a.photoUrl} alt={`${a.name} profile photo`} className="h-24 w-24 rounded-2xl border border-[#dce5e5] object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[#dcecea] text-2xl font-bold text-[#176a77]">{a.name.split(" ").map(x => x[0]).join("").slice(0, 2)}</div>}<div className="space-y-2"><label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#183a4b] px-4 py-2.5 text-sm font-semibold text-white"><FileUp size={15} /> {a.photoUrl ? "Replace photo" : "Upload photo"}<input type="file" accept="image/*" className="sr-only" data-testid="input-photo-upload" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadPhoto(file); }} /></label>{a.photoUrl && <button onClick={() => save({ photoUrl: null })} data-testid="button-remove-photo" className="flex items-center gap-2 rounded-lg border border-[#e0b8b4] px-4 py-2.5 text-sm font-semibold text-[#a34d46] hover:bg-[#fff7f6]"><Trash2 size={15} /> Remove</button>}</div></div>{photoUpload.isPending && <p className="mt-2 text-xs text-[#718189]">Uploading photo...</p>}{photoError && <p className="mt-2 text-xs text-[#ad4b43]" data-testid="photo-error">{photoError}</p>}</div><div className="mt-7 grid grid-cols-2 gap-3"><StatCard label="AI score" value={a.aiScore.toFixed(1)} suffix="/ 10" tone="yellow" /><div className="rounded-2xl border border-[#dce5e5] bg-white p-4"><p className="text-xs uppercase tracking-[.12em] text-[#72838a]">Recommendation</p><div className="mt-3"><Badge tone={a.aiRecommendation.toLowerCase().includes("advance") ? "teal" : "yellow"}>{a.aiRecommendation}</Badge></div></div></div><button onClick={regenerate} disabled={regen.isPending} data-testid="button-regenerate-evaluation" className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#a9d3ce] bg-[#eff8f6] px-4 py-2.5 text-sm font-semibold text-[#12737d] disabled:opacity-50"><RefreshCw size={15} className={regen.isPending ? "animate-spin" : ""} /> {regen.isPending ? "Regenerating from transcript..." : a.aiScore === -1 ? "Score invalid — regenerate from transcript" : "Regenerate AI evaluation"}</button>{regen.isError && <p className="mt-2 text-xs text-[#ad4b43]" data-testid="regenerate-error">{serverErrorMessage(regen.error, "Regeneration failed. Try again.")}</p>}{regen.isSuccess && <p className="mt-2 text-xs font-semibold text-[#168069]">Evaluation regenerated and saved.</p>}<div className="mt-5 rounded-2xl border border-[#dce5e5] bg-white p-5"><h3 className="font-semibold">AI readout</h3><p className="mt-3 text-sm leading-6 text-[#52666e]">{a.aiSummary || "No summary available."}</p><div className="mt-4 grid gap-3 text-xs"><div><p className="font-bold uppercase tracking-[.1em] text-[#16869a]">Strengths</p><p className="mt-1 text-[#64777d]">{a.aiStrengths || "Not listed"}</p></div><div><p className="font-bold uppercase tracking-[.1em] text-[#bd5047]">Concerns</p><p className="mt-1 text-[#64777d]">{a.aiConcerns || "Not listed"}</p></div></div></div><div className="mt-5 rounded-2xl border border-[#dce5e5] bg-white p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">Coordinator decision</h3>{update.isSuccess && <span className="text-xs font-semibold text-[#168069]">Saved</span>}</div><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-[#63747c]">Category<select defaultValue={a.category} onChange={e => save({ category: e.target.value })} data-testid="select-detail-category" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-2 text-sm text-[#182232]"><option value="">Unranked</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></label><label className="text-xs font-semibold text-[#63747c]">Interview status<select defaultValue={a.interviewStatus} onChange={e => save({ interviewStatus: e.target.value })} data-testid="select-detail-status" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-2 text-sm text-[#182232]">{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select></label></div><label className="mt-4 block text-xs font-semibold text-[#63747c]">Attendance<select value={a.attendance ?? "unmarked"} onChange={e => { const v = e.target.value; save(v === "late" ? { attendance: v, makeupDate: null, attendanceExcused: null } : v === "absent" ? { attendance: v, lateArrivalTime: null, attendanceExcused: null } : { attendance: v, lateArrivalTime: null, makeupDate: null, attendanceExcused: null }); }} data-testid="select-detail-attendance" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-2 text-sm text-[#182232]">{ATTENDANCE_OPTIONS.map(o => <option key={o} value={o}>{attendanceLabel(o)}</option>)}</select></label>{a.attendance === "late" && <label className="mt-4 block text-xs font-semibold text-[#63747c]">Arrival time<input type="time" key={`late-${a.id}-${a.lateArrivalTime ?? "empty"}`} defaultValue={a.lateArrivalTime ?? ""} onChange={e => save({ lateArrivalTime: e.target.value || null })} data-testid="input-detail-late-time" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-2 text-sm text-[#182232]" />{a.lateArrivalTime && <span className="mono mt-1 block text-[11px] font-normal text-[#8a6d1c]">Arrived {formatArrivalTime(a.lateArrivalTime)}</span>}</label>}{a.attendance === "absent" && <label className="mt-4 block text-xs font-semibold text-[#63747c]">Makeup date (optional)<input type="date" key={`makeup-${a.id}-${a.makeupDate ?? "empty"}`} defaultValue={a.makeupDate ?? ""} onChange={e => save({ makeupDate: e.target.value || null })} data-testid="input-detail-makeup-date" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-2 text-sm text-[#182232]" />{a.makeupDate && <span className="mono mt-1 block text-[11px] font-normal text-[#a34d46]">Makeup {formatMakeupDate(a.makeupDate)}</span>}</label>}{(a.attendance === "late" || a.attendance === "absent") && <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#63747c]"><input type="checkbox" checked={a.attendanceExcused ?? false} onChange={e => save({ attendanceExcused: e.target.checked })} data-testid="input-detail-excused" className="h-4 w-4 accent-[#16869a]" /> Excused {a.attendance === "late" ? "late arrival" : "absence"}</label>}<label className="mt-4 block text-xs font-semibold text-[#63747c]">Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} data-testid="textarea-applicant-notes" className="mt-1 min-h-[110px] w-full resize-y rounded-lg border border-[#d5e0e0] bg-white p-3 text-sm font-normal text-[#182232] outline-none focus:border-[#16869a]" placeholder="Capture the human signal..." /></label><button onClick={() => save({ notes })} data-testid="button-save-notes" className="mt-3 flex items-center gap-2 rounded-lg bg-[#183a4b] px-4 py-2.5 text-sm font-semibold text-white"><Check size={15} /> Save notes</button></div><div className="mt-5 rounded-2xl border border-[#dce5e5] bg-white p-5"><h3 className="font-semibold">Application evidence</h3><div className="mt-3"><TranscriptView transcript={a.transcript ?? null} /></div></div><div className="mt-5 rounded-2xl border border-[#f0d4d1] bg-[#fff7f6] p-5"><h3 className="font-semibold text-[#9f3b33]">Danger zone</h3><p className="mt-1 text-xs text-[#8a6a67]">Removes this applicant from the roster, queue, and display permanently.</p><button onClick={destroy} disabled={remove.isPending} data-testid="button-delete-applicant" className="mt-3 flex items-center gap-2 rounded-lg bg-[#b34a42] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Trash2 size={15} /> {remove.isPending ? "Deleting..." : "Delete applicant"}</button>{remove.isError && <p className="mt-2 text-xs text-[#ad4b43]">Delete failed. Try again.</p>}</div></aside></div>; }

const RESET_CONFIRM_PHRASE = "I understand";

const ATTENDANCE_OPTIONS = ["here", "late", "absent", "unmarked"] as const;

function attendanceLabel(value: string | null | undefined): string {
  if (value === "here") return "Here";
  if (value === "late") return "Late";
  if (value === "absent") return "Absent";
  return "Unmarked";
}

function formatArrivalTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return hhmm;
  let h = parseInt(m[1], 10);
  if (!Number.isFinite(h) || h < 0 || h > 23) return hhmm;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}

function formatMakeupDate(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim());
  if (!m) return ymd;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mi = parseInt(m[2], 10);
  if (!mi || mi < 1 || mi > 12) return ymd;
  return `${months[mi - 1]} ${parseInt(m[3], 10)}`;
}

function localYMD(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localHHMM(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type AttendancePatch = { attendance: string; lateArrivalTime?: string | null; makeupDate?: string | null; attendanceExcused?: boolean | null };

function DisplayTextCard() {
  const qc = useQueryClient();
  const settings = useGetDisplaySettings({ query: { queryKey: getGetDisplaySettingsQueryKey(), refetchInterval: 5000 } });
  const live = useGetDisplayState({ query: { queryKey: getGetDisplayStateQueryKey(), refetchInterval: 5000 } });
  const update = useUpdateDisplaySettings();
  // Draft-first: edits live here only. Nothing reaches the big screen until
  // "Push to big screen" — the preview below shows exactly what push will do.
  const [headline, setHeadline] = useState("");
  const [subheading, setSubheading] = useState("");
  const [showNames, setShowNames] = useState(true);
  const [announce, setAnnounce] = useState(true);
  const [synced, setSynced] = useState(false);
  const saved = settings.data;
  useEffect(() => {
    if (saved && !synced) {
      setHeadline(saved.headline ?? "");
      setSubheading(saved.subheadline ?? "");
      setShowNames(saved.showNames ?? true);
      setAnnounce(saved.announce ?? true);
      setSynced(true);
    }
  }, [saved, synced]);
  const applySaved = (fresh: { headline: string | null; subheadline: string | null; showNames: boolean; announce: boolean }) => {
    setHeadline(fresh.headline ?? "");
    setSubheading(fresh.subheadline ?? "");
    setShowNames(fresh.showNames);
    setAnnounce(fresh.announce);
    setSynced(true);
  };
  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetDisplaySettingsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() });
  };
  const push = () => {
    update.mutate({ data: { headline: headline.trim() || null, subheadline: subheading.trim() || null, showNames, announce } }, {
      onSuccess: (fresh) => {
        applySaved(fresh);
        refresh();
      },
    });
  };
  const discard = () => {
    if (saved) applySaved(saved);
  };
  const clearDraft = () => {
    setHeadline("");
    setSubheading("");
  };
  const liveAnnouncement = (live.data as DisplayState | undefined)?.announcement ?? "";
  const liveHeadline = (live.data as DisplayState | undefined)?.headline ?? "";
  const liveSubheadline = (live.data as DisplayState | undefined)?.subheadline ?? "";
  const draftCustom = Boolean(headline.trim() || subheading.trim());
  const dirty = headline !== (saved?.headline ?? "") || subheading !== (saved?.subheadline ?? "") || showNames !== (saved?.showNames ?? true) || announce !== (saved?.announce ?? true);
  // The preview IS the big-screen page in an iframe (same component, same
  // CSS → pixel-identical), with the draft passed as query overrides.
  // Debounced so typing does not reload it on every keystroke.
  const [previewSrc, setPreviewSrc] = useState(`${import.meta.env.BASE_URL}display`);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!dirty) {
        setPreviewSrc(`${import.meta.env.BASE_URL}display`);
        return;
      }
      const params = new URLSearchParams({ preview: "1" });
      if (headline.trim()) params.set("headline", headline.trim());
      if (subheading.trim()) params.set("subheadline", subheading.trim());
      params.set("showNames", showNames ? "1" : "0");
      setPreviewSrc(`${import.meta.env.BASE_URL}display?${params.toString()}`);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [headline, subheading, showNames, dirty]);
  const hasCustom = Boolean(saved?.headline ?? saved?.subheadline);
  const statusBits = [
    hasCustom ? "custom text" : "automatic text",
    `pills ${saved?.showNames === false ? "hidden" : "shown"}`,
    `announcements ${saved?.announce === false ? "muted" : "on"}`,
  ];
  // Spoken line mirrors server logic: custom text wins when set, otherwise
  // the live announcement.
  const previewSpoken = !announce ? "" : draftCustom ? `${headline.trim() || liveHeadline}. ${subheading.trim() || liveSubheadline}.` : liveAnnouncement;
  return <section className="mb-5 rounded-2xl border border-[#dce5e5] bg-white p-4" data-testid="display-text-card">
    <div><p className="text-sm font-semibold">Big-screen text</p><p className="mt-1 text-xs text-[#7c8c91]">Edits stay here as a draft — the big screen does not change until you push. Check the preview, then push when it looks right. The announce switch mutes spoken announcements (manual tests still speak).</p></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <label className="text-xs font-semibold text-[#63747c]">Heading<input value={headline} onChange={e => setHeadline(e.target.value)} maxLength={200} disabled={settings.isLoading} data-testid="input-display-headline" placeholder="Automatic heading" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-3 text-sm font-normal text-[#182232] outline-none focus:border-[#16869a]" /></label>
      <label className="text-xs font-semibold text-[#63747c]">Subheading<input value={subheading} onChange={e => setSubheading(e.target.value)} maxLength={200} disabled={settings.isLoading} data-testid="input-display-subheading" placeholder="Automatic subheading" className="mt-1 h-10 w-full rounded-lg border border-[#d5e0e0] bg-white px-3 text-sm font-normal text-[#182232] outline-none focus:border-[#16869a]" /></label>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button onClick={push} disabled={update.isPending || settings.isLoading || !dirty} data-testid="button-display-text-save" title="Publish this draft to the big screen" className="flex h-10 items-center gap-2 rounded-xl bg-[#183a4b] px-4 text-xs font-semibold text-white disabled:opacity-50"><Check size={15} /> {update.isPending ? "Pushing…" : "Push to big screen"}</button>
      <button onClick={discard} disabled={update.isPending || !dirty} data-testid="button-display-discard" title="Throw away the draft and go back to what is live now" className="flex h-10 items-center gap-2 rounded-xl border border-[#d5e0e0] px-4 text-xs font-semibold text-[#63747c] hover:bg-[#eef3f2] disabled:opacity-50"><X size={15} /> Discard draft</button>
      <button onClick={clearDraft} disabled={update.isPending || settings.isLoading || (!headline && !subheading)} data-testid="button-display-text-clear" title="Empty the draft (push to return the big screen to automatic)" className="flex h-10 items-center gap-2 rounded-xl border border-[#d5e0e0] px-4 text-xs font-semibold text-[#63747c] hover:bg-[#eef3f2] disabled:opacity-50"><Trash2 size={15} /> Clear custom text</button>
      <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#d5e0e0] px-4 text-xs font-semibold text-[#63747c]"><input type="checkbox" checked={showNames} disabled={update.isPending || settings.isLoading} onChange={e => setShowNames(e.target.checked)} data-testid="input-display-show-names" className="h-4 w-4 accent-[#16869a]" /> Show name pills</label>
      <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#d5e0e0] px-4 text-xs font-semibold text-[#63747c]"><input type="checkbox" checked={announce} disabled={update.isPending || settings.isLoading} onChange={e => setAnnounce(e.target.checked)} data-testid="input-display-announce" className="h-4 w-4 accent-[#16869a]" /> Announce</label>
    </div>
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#0d1b28]" data-testid="display-preview">
      <div className="flex items-center justify-between gap-2 bg-[#0d1b28] px-4 py-2">
        <p className="mono text-[10px] uppercase tracking-[.25em] text-[#f8c84a]">Preview — {dirty ? "draft (not live yet)" : "matches the big screen"}</p>
        <a href={previewSrc} target="_blank" rel="noreferrer" data-testid="link-display-preview-full" className="mono shrink-0 text-[10px] font-semibold text-[#9db6bd] hover:text-white">Open full size</a>
      </div>
      <iframe key={previewSrc} src={previewSrc} title="Big-screen preview" className="aspect-video w-full border-0 bg-[#0d1b28]" />
      <p className="mono break-words bg-[#0d1b28] px-4 pb-3 text-[11px] leading-5 text-[#7fa3ac]" data-testid="display-preview-spoken">{previewSpoken ? `Will announce: “${previewSpoken}”` : "Announcements muted — the big screen stays silent."}</p>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#7c8c91]">
      {settings.isLoading && <span>Loading display settings…</span>}
      {settings.isError && <span className="font-semibold text-[#ad4b43]">Could not load display settings.</span>}
      {update.isError && <span className="font-semibold text-[#ad4b43]">Push failed. Try again.</span>}
      {dirty && <span className="font-semibold text-[#a4680a]" data-testid="display-draft-badge">Unpublished changes — push to update the big screen.</span>}
      {saved && !dirty && <span data-testid="display-text-status">Now showing: {statusBits.join(" · ")}</span>}
    </div>
  </section>;
}

function AudioCard() {
  const [engine, setEngine] = useState<TtsEngineId>(() => getSelectedEngine());
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [sayText, setSayText] = useState("");
  const [saying, setSaying] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const sendCommand = usePostBroadcast();
  // Local-only preview: hear the selected voice on THIS machine before
  // pushing anything to the room. Nothing is sent to the big screen.
  const previewHere = async () => {
    if (previewing || sending || saying || clearing) return;
    setPreviewing(true);
    setNote("");
    try {
      await speakWithEngine(engine, KOKORO_TEST_PHRASE);
      setNote("That played on this machine only — the big screen heard nothing.");
    } catch {
      setNote("Local preview failed on this machine — the big-screen test below still works.");
    }
    setPreviewing(false);
  };
  // Everything here is remote: the buttons sit on the interviewers' screen,
  // the sound comes out of the big screen. The display polls for commands
  // every few seconds, speaks (or switches voice), and never shows a popup.
  const pick = (id: TtsEngineId) => {
    setEngine(id);
    setSelectedEngine(id);
    setNote("");
    if (id !== "system") setNote("Voice updated — the big screen switches to it for the next announcement.");
    sendCommand.mutate({ data: { message: id, kind: "audio-engine", ttlMinutes: 60 } }, {
      onError: () => setNote("Could not reach the big screen. It keeps its current voice."),
    });
  };
  const test = () => {
    if (sending || clearing) return;
    setSending(true);
    setNote("");
    sendCommand.mutate({ data: { message: engine, kind: "audio-test", ttlMinutes: 5 } }, {
      onSuccess: () => setNote("Sent — the big screen speaks within a few seconds. First use downloads the voice there, so allow a one-time wait."),
      onError: () => setNote("Could not reach the big screen. Check that the display is open and online."),
      onSettled: () => setSending(false),
    });
  };
  const sayIt = () => {
    const text = sayText.trim().slice(0, 500);
    if (!text || saying || sending || clearing) return;
    setSaying(true);
    setNote("");
    sendCommand.mutate({ data: { message: text, kind: "audio-say", ttlMinutes: 5 } }, {
      onSuccess: () => {
        setNote("Sent — the big screen says it within a few seconds. Display text is untouched.");
        setSayText("");
      },
      onError: () => setNote("Could not reach the big screen. Check that the display is open and online."),
      onSettled: () => setSaying(false),
    });
  };
  const redownload = async () => {
    if (!window.confirm("Reset voices on this machine AND the big screen? Downloaded voice files are deleted everywhere; both pages reload fresh. Use this when speech sounds garbled.")) return;
    setClearing(true);
    try {
      await clearLocalTtsCaches();
    } catch {
      // The reload below drops in-memory copies regardless.
    }
    sendCommand.mutate({ data: { message: engine, kind: "audio-reset", ttlMinutes: 5 } });
    window.location.reload();
  };
  const detail = TTS_ENGINES.find(option => option.id === engine)?.detail ?? "";
  return <section className="mb-5 rounded-2xl border border-[#dce5e5] bg-white p-4" data-testid="audio-card">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-semibold">Big-screen audio</p><p className="mt-1 text-xs text-[#7c8c91]">These buttons live here, the sound comes out of the big screen. {detail}.</p></div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select value={engine} onChange={e => pick(e.target.value as TtsEngineId)} data-testid="select-tts-engine" aria-label="Announcement voice" className="h-10 rounded-lg border border-[#d5e0e0] bg-white px-2 text-xs font-semibold text-[#182232] outline-none focus:border-[#16869a]">
        {TTS_ENGINES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
      <button onClick={() => void previewHere()} disabled={previewing || sending || clearing || saying} data-testid="button-audio-preview-here" title="Hear the selected voice on this machine only — nothing plays on the big screen" className="flex h-10 items-center gap-2 rounded-xl border border-[#16869a] px-4 text-xs font-semibold text-[#12737d] hover:bg-[#e3f4f2] disabled:opacity-50"><Volume1 size={15} /> {previewing ? "Playing here…" : "Preview voice here"}</button>
      <button onClick={test} disabled={sending || clearing || saying || previewing} data-testid="button-audio-test" className="flex h-10 items-center gap-2 rounded-xl bg-[#183a4b] px-4 text-xs font-semibold text-white disabled:opacity-50"><Volume1 size={15} /> {sending ? "Sending…" : "Test big-screen audio"}</button>
      {engine !== "system" && <button onClick={() => void redownload()} disabled={clearing || sending || saying} data-testid="button-audio-redownload" title="Delete downloaded voice files here and on the big screen, then reload (fixes garbled speech from a bad download)" className="flex h-10 items-center gap-2 rounded-xl border border-[#d5e0e0] px-4 text-xs font-semibold text-[#63747c] hover:bg-[#eef3f2] disabled:opacity-50"><RefreshCw size={15} className={clearing ? "animate-spin" : ""} /> {clearing ? "Clearing…" : "Redownload voices"}</button>}
    </div>
    <div className="mt-3 flex flex-wrap items-stretch gap-2">
      <textarea value={sayText} onChange={e => setSayText(e.target.value)} maxLength={500} rows={2} disabled={saying || sending || clearing} data-testid="input-audio-say" placeholder="Type a custom announcement — spoken only, display text stays as-is…" className="min-h-[68px] min-w-0 flex-1 resize-y rounded-xl border border-[#d5e0e0] bg-white p-3 text-sm text-[#182232] outline-none focus:border-[#16869a]" />
      <button onClick={sayIt} disabled={!sayText.trim() || saying || sending || clearing} data-testid="button-audio-say" title="Speak this text on the big screen without changing its text" className="flex items-center gap-2 rounded-xl bg-[#16869a] px-4 text-xs font-semibold text-white disabled:opacity-50"><Megaphone size={15} /> {saying ? "Sending…" : "Announce it"}</button>
    </div>
    {note && <p className="mt-2 text-xs text-[#7c8c91]" data-testid="audio-note">{note}</p>}
  </section>;
}

function AttendancePanel({ applicants, pending, onMark, onMarkAll }: {
  applicants: Applicant[];
  pending: boolean;
  onMark: (id: string, patch: AttendancePatch) => void;
  onMarkAll: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [excusedDraft, setExcusedDraft] = useState(false);
  const openEditor = (a: Applicant, kind: "late" | "absent") => {
    setEditing(`${a.id}:${kind}`);
    setDraft(kind === "late" ? (a.lateArrivalTime || localHHMM()) : (a.makeupDate || ""));
    setExcusedDraft(a.attendanceExcused ?? false);
  };
  const saveEditor = (a: Applicant, kind: "late" | "absent") => {
    if (kind === "late") {
      if (!draft) return;
      onMark(a.id, { attendance: "late", lateArrivalTime: draft, makeupDate: null, attendanceExcused: excusedDraft });
    } else {
      onMark(a.id, { attendance: "absent", makeupDate: draft || null, lateArrivalTime: null, attendanceExcused: excusedDraft });
    }
    setEditing(null);
  };
  const clearEditor = (a: Applicant) => {
    onMark(a.id, { attendance: "unmarked", lateArrivalTime: null, makeupDate: null, attendanceExcused: null });
    setEditing(null);
  };
  const excusedToggle = (id: string) => <div className="flex shrink-0 overflow-hidden rounded-lg border border-[#d5e0e0]" role="group" aria-label="Excused status">
    <button onClick={() => setExcusedDraft(true)} data-testid={`button-excused-${id}`} title="Mark excused" className={`px-2.5 py-1.5 text-[11px] font-bold transition ${excusedDraft ? "bg-[#28a47f] text-white" : "bg-white text-[#63747c] hover:bg-[#eef3f2]"}`}>Excused</button>
    <button onClick={() => setExcusedDraft(false)} data-testid={`button-unexcused-${id}`} title="Mark unexcused" className={`px-2.5 py-1.5 text-[11px] font-bold transition ${excusedDraft ? "bg-white text-[#63747c] hover:bg-[#eef3f2]" : "bg-[#3d4b54] text-white"}`}>Unexcused</button>
  </div>;
  const rowTone = (a: Applicant) => a.attendance === "absent" ? "border-[#e5c4c0] bg-[#fff7f6]" : a.attendance === "late" ? "border-[#e8d9b0] bg-[#fffdf4]" : a.attendance === "here" ? "border-[#bfe3d8] bg-[#f4fbf8]" : "border-[#e1e9e8] bg-white";
  const avatarTone = (a: Applicant) => a.attendance === "here" ? "bg-[#28a47f] text-white" : a.attendance === "late" ? "bg-[#c99a1f] text-white" : a.attendance === "absent" ? "bg-[#b34a42] text-white" : "bg-[#dcecea] text-[#176a77]";
  const pillTone = (a: Applicant) => a.attendance === "here" ? "bg-[#dff3ec] text-[#1d7a5f]" : a.attendance === "late" ? "bg-[#fdf3d7] text-[#8a6d1c]" : a.attendance === "absent" ? "bg-[#fbe4e1] text-[#a34d46]" : "bg-[#eef3f2] text-[#63747c]";
  const initials = (name: string) => name.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase() || "?";
  return <section className="mb-5 rounded-2xl border border-[#dce5e5] bg-white p-4" data-testid="attendance-panel">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-semibold">Check-in list <span className="mono ml-2 text-xs text-[#16869a]">{applicants.length} shown</span></p><p className="mt-1 text-xs text-[#7c8c91]">Tap Here, or open Late / Absent for arrival time, makeup date, and excused status.</p></div>
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {applicants.map(a => {
        const lateOpen = editing === `${a.id}:late`;
        const absentOpen = editing === `${a.id}:absent`;
        const arrival = formatArrivalTime(a.lateArrivalTime);
        const makeup = formatMakeupDate(a.makeupDate);
        return <div key={a.id} className={`rounded-xl border p-2.5 ${rowTone(a)}`} data-testid={`attendance-row-${a.id}`}>
          <div className="flex items-center gap-2.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarTone(a)}`}>{initials(a.name)}</span>
            <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><span className="block min-w-0 flex-1 truncate text-xs font-semibold">{a.name}</span>{seatLabel(a.seatRow, a.seatCol) && <span className="mono shrink-0 rounded bg-[#eef3f2] px-1.5 py-0.5 text-[10px] font-bold text-[#527079]" data-testid={`attendance-seat-${a.id}`}>{seatLabel(a.seatRow, a.seatCol)}</span>}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pillTone(a)}`}>{a.attendance === "here" ? "Here" : a.attendance === "late" ? `Late${arrival ? ` · ${arrival}` : ""}` : a.attendance === "absent" ? "Absent" : "Unmarked"}</span>
                {a.attendance === "absent" && makeup && <span className="mono rounded-full bg-[#fbe4e1] px-2 py-0.5 text-[10px] font-semibold text-[#a34d46]">Makeup {makeup}</span>}
                {(a.attendance === "late" || a.attendance === "absent") && a.attendanceExcused === true && <span className="mono rounded-full bg-[#dff3ec] px-2 py-0.5 text-[10px] font-semibold text-[#1d7a5f]">Excused</span>}
                {(a.attendance === "late" || a.attendance === "absent") && a.attendanceExcused === false && <span className="mono rounded-full bg-[#fbe4e1] px-2 py-0.5 text-[10px] font-semibold text-[#a34d46]">Unexcused</span>}
              </span>
            </span>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => { setEditing(null); onMark(a.id, { attendance: a.attendance === "here" ? "unmarked" : "here", lateArrivalTime: null, makeupDate: null, attendanceExcused: null }); }} disabled={pending} data-testid={`button-attendance-here-${a.id}`} title="Mark here" className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${a.attendance === "here" ? "bg-[#28a47f] text-white" : "bg-[#eef3f2] text-[#63747c] hover:bg-[#dce9e8]"}`}>Here</button>
              <button onClick={() => { if (lateOpen) setEditing(null); else openEditor(a, "late"); }} disabled={pending} data-testid={`button-attendance-late-${a.id}`} title="Mark late" className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${a.attendance === "late" ? "bg-[#c99a1f] text-white" : "bg-[#eef3f2] text-[#63747c] hover:bg-[#dce9e8]"}`}>Late</button>
              <button onClick={() => { if (absentOpen) setEditing(null); else openEditor(a, "absent"); }} disabled={pending} data-testid={`button-attendance-absent-${a.id}`} title="Mark absent" className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${a.attendance === "absent" ? "bg-[#b34a42] text-white" : "bg-[#eef3f2] text-[#63747c] hover:bg-[#dce9e8]"}`}>Absent</button>
            </div>
          </div>
          {lateOpen && <div className="mt-2 flex flex-wrap items-center gap-2">
            <input type="time" value={draft} onChange={e => setDraft(e.target.value)} data-testid={`input-late-time-${a.id}`} aria-label={`Arrival time for ${a.name}`} className="h-9 min-w-0 flex-1 rounded-lg border border-[#d5e0e0] bg-white px-2 text-xs text-[#182232] outline-none focus:border-[#16869a]" />
            {excusedToggle(a.id)}
            <button onClick={() => saveEditor(a, "late")} disabled={pending || !draft} data-testid={`button-late-save-${a.id}`} className="rounded-lg bg-[#183a4b] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">Save</button>
            <button onClick={() => clearEditor(a)} disabled={pending} data-testid={`button-late-clear-${a.id}`} title="Clear late mark" className="rounded-lg bg-[#eef3f2] px-3 py-1.5 text-[11px] font-bold text-[#63747c]">Clear</button>
            <button onClick={() => setEditing(null)} data-testid={`button-late-cancel-${a.id}`} className="rounded-lg bg-[#eef3f2] px-3 py-1.5 text-[11px] font-bold text-[#63747c]">Cancel</button>
          </div>}
          {absentOpen && <div className="mt-2 flex flex-wrap items-center gap-2">
            <input type="date" value={draft} min={localYMD()} onChange={e => setDraft(e.target.value)} data-testid={`input-makeup-date-${a.id}`} aria-label={`Makeup date for ${a.name}`} className="h-9 min-w-0 flex-1 rounded-lg border border-[#d5e0e0] bg-white px-2 text-xs text-[#182232] outline-none focus:border-[#16869a]" />
            {excusedToggle(a.id)}
            <button onClick={() => saveEditor(a, "absent")} disabled={pending} data-testid={`button-absent-save-${a.id}`} title={draft ? "Save with makeup date" : "Save absent without makeup date"} className="rounded-lg bg-[#183a4b] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">Save</button>
            <button onClick={() => clearEditor(a)} disabled={pending} data-testid={`button-absent-clear-${a.id}`} title="Clear absent mark" className="rounded-lg bg-[#eef3f2] px-3 py-1.5 text-[11px] font-bold text-[#63747c]">Clear</button>
            <button onClick={() => setEditing(null)} data-testid={`button-absent-cancel-${a.id}`} className="rounded-lg bg-[#eef3f2] px-3 py-1.5 text-[11px] font-bold text-[#63747c]">Cancel</button>
          </div>}
        </div>;
      })}
    </div>
    {!applicants.length && <p className="mt-3 text-sm text-[#7c8c91]">Nobody left in the queue.</p>}
  </section>;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, stage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout:${stage}`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
let diagCount = 0;
function reportDiag(message: string, context: string) {
  if (diagCount >= 10) return;
  diagCount += 1;
  try {
    fetch(`${import.meta.env.BASE_URL}api/diagnostics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message: message.slice(0, 500), context: context.slice(0, 500) }),
    }).catch(() => undefined);
  } catch { /* diagnostics must never break the app */ }
}
const CHAT_MAX_FILE_BYTES = 100 * 1024 * 1024;
const CHAT_FILE_ACCEPT = [
  "image/*",
  "video/*",
  "audio/*",
  "application/pdf",
  "application/msword",
  "application/rtf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "text/csv",
  "text/tab-separated-values",
  "text/plain",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".mkv",
  ".avi",
  ".flac",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".csv",
  ".tsv",
].join(",");
const CHAT_EXTENSION_TYPES: Record<string, string> = {
  aac: "audio/aac",
  avi: "video/x-msvideo",
  avif: "image/avif",
  bmp: "image/bmp",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  flac: "audio/flac",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  m4a: "audio/mp4",
  m4v: "video/mp4",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  ts: "text/tab-separated-values",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  wav: "audio/wav",
  webm: "video/webm",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const CHAT_INLINE_IMAGE_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);
type ChatFileKind = "image" | "video" | "audio" | "file";
type PreparedChatFile = { blob: Blob; name: string; type: string; inlineImage: boolean };
function normalizeChatFileType(type: string): string {
  return type.split(";")[0]?.trim().toLowerCase() ?? "";
}
function chatFileType(file: File): string {
  const declared = normalizeChatFileType(file.type);
  if (declared.startsWith("image/") || declared.startsWith("video/") || declared.startsWith("audio/")) return declared;
  if ([
    "application/pdf",
    "application/msword",
    "application/rtf",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/vnd.oasis.opendocument.presentation",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/csv",
    "text/plain",
    "text/tab-separated-values",
  ].includes(declared)) return declared;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return CHAT_EXTENSION_TYPES[extension ?? ""] ?? "";
}
function chatFileKind(type: string): ChatFileKind {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "file";
}
function ChatAttachmentPreview({ file }: { file: { name: string; previewUrl: string; kind: ChatFileKind; inlineImage: boolean } }) {
  if (file.kind === "image" && file.inlineImage) {
    return <img src={file.previewUrl} alt={file.name} className="h-14 w-14 shrink-0 rounded-lg border border-[#dce9e8] object-cover" />;
  }
  if (file.kind === "video") {
    return <video src={file.previewUrl} controls preload="metadata" className="h-14 w-20 shrink-0 rounded-lg border border-[#dce9e8] bg-[#183a4b] object-cover" />;
  }
  if (file.kind === "audio") {
    return <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg border border-[#dce9e8] bg-[#edf4f3]"><Paperclip size={18} className="text-[#16869a]" /></div>;
  }
  return <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#dce9e8] bg-[#edf4f3]"><Paperclip size={18} className="text-[#16869a]" /></div>;
}
function isHeicFile(file: File): boolean {
  const type = chatFileType(file);
  return type === "image/heic" || type === "image/heif" || /\.hei[cf]$/i.test(file.name);
}
async function convertHeicFile(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
  const blob = (Array.isArray(converted) ? converted[0] : converted) as Blob;
  const base = file.name.replace(/\.[a-z0-9]+$/i, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}
async function prepareChatFile(file: File): Promise<PreparedChatFile> {
  let source = file;
  let outName = file.name;
  let sourceType = chatFileType(source);
  if (isHeicFile(file)) {
    try {
      const converted = await withTimeout(convertHeicFile(file), 30000, "convert");
      source = converted;
      outName = converted.name;
      sourceType = "image/jpeg";
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("timeout:")) throw new Error("timeout");
      throw new Error("unreadable-heic");
    }
  }
  return {
    blob: source,
    name: outName,
    type: sourceType,
    inlineImage: sourceType.startsWith("image/") && CHAT_INLINE_IMAGE_TYPES.has(sourceType),
  };
}
function parseWhiteboardChatMessage(message: string): { id: string; title: string } | null {
  const match = message.match(/^\[\[whiteboard:([a-f0-9-]+)\]\]\s*(.*)$/i);
  if (!match) return null;
  return { id: match[1], title: match[2]?.trim() || "Shared whiteboard" };
}
function parseDocumentChatMessage(message: string): { id: string; title: string } | null {
  const match = message.match(/^\[\[document:([a-f0-9-]+)\]\]\s*(.*)$/i);
  if (!match) return null;
  return { id: match[1], title: match[2]?.trim() || "Untitled document" };
}
function parseBoardChatMessage(message: string): { id: string; title: string } | null {
  const match = message.match(/^\[\[board:([a-f0-9-]+)\]\]\s*(.*)$/i);
  if (!match) return null;
  return { id: match[1], title: match[2]?.trim() || "Interview coordination board" };
}
function parseSpreadsheetChatMessage(message: string): { id: string; title: string } | null {
  const match = message.match(/^\[\[spreadsheet:([a-f0-9-]+)\]\]\s*(.*)$/i);
  if (!match) return null;
  return { id: match[1], title: match[2]?.trim() || "Shared spreadsheet" };
}

function InterviewChatPanel({ applicantIds, tall = false }: { applicantIds: string[]; tall?: boolean }) {
  const { theme } = useTheme();
  const { settings } = useWorkspaceSettings();
  const [location, setLocation] = useLocation();
  const refreshMs = settings.autoRefresh ? settings.refreshMs : false;
  const queue = useGetQueue({ query: { queryKey: getGetQueueQueryKey() } });
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const customEmojisQuery = useListChatCustomEmojis({
    query: {
      queryKey: getListChatCustomEmojisQueryKey(),
      staleTime: 15_000,
      refetchInterval: 30_000,
    },
  });
  const customEmojiItems = useMemo(() => customEmojisQuery.data?.items ?? [], [customEmojisQuery.data?.items]);
  const customEmojiPaths = useMemo(
    () => new Map(customEmojiItems.map(emoji => [emoji.name, emoji.imagePath])),
    [customEmojiItems],
  );
  const interviewerLabels = queue.data?.interviewerLabels ?? [];
  const [conversationPeer, setConversationPeer] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("peer")?.trim() || null;
  });
  const activeInterviewer = session.data?.label ?? "Interviewer";
  const mentionLabels = useMemo(() => {
    const unique = new Map<string, string>();
    for (const label of [...interviewerLabels, activeInterviewer]) {
      const normalized = label.trim().replace(/\s+/g, " ");
      if (normalized && !unique.has(normalized.toLowerCase())) unique.set(normalized.toLowerCase(), normalized);
    }
    return [...unique.values()];
  }, [activeInterviewer, interviewerLabels]);
  const conversationScope = conversationPeer ? "direct" : "shared";
  const conversationId = `${conversationScope}:${activeInterviewer}:${conversationPeer ?? ""}`;
  const chatParams = useMemo(() => ({
    limit: CHAT_PAGE_SIZE,
    scope: conversationScope as "shared" | "direct",
    author: activeInterviewer,
    ...(conversationPeer ? { peer: conversationPeer } : {}),
  }), [activeInterviewer, conversationPeer, conversationScope]);
  const chat = useGetInterviewChat(chatParams, { query: { queryKey: getGetInterviewChatQueryKey(chatParams), refetchInterval: refreshMs } });
  const [olderChat, setOlderChat] = useState<InterviewChatMessage[]>([]);
  const [olderChatConversationId, setOlderChatConversationId] = useState(conversationId);
  const [chatHasMore, setChatHasMore] = useState(true);
  const [chatLoadingMore, setChatLoadingMore] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatMessageInputRef = useRef<HTMLTextAreaElement>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const dictationRef = useRef<BrowserSpeechRecognition | null>(null);
  const dictationBaseRef = useRef("");
  const chatStickRef = useRef(true);
  const chatLoadGuardRef = useRef(false);
  const chatAnchorRef = useRef<{ prevH: number; prevTop: number } | null>(null);
  const scopedChatItems = chat.data?.scope === conversationScope && chat.data.peer === (conversationPeer ?? null)
    ? chat.data.items
    : [];
  const visibleOlderChat = olderChatConversationId === conversationId ? olderChat : [];
  const chatItems = useMemo(() => mergeChatItems(visibleOlderChat, scopedChatItems), [scopedChatItems, visibleOlderChat]);
  const replyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of chatItems) {
      if (item.parentMessageId) counts.set(item.parentMessageId, (counts.get(item.parentMessageId) ?? 0) + 1);
    }
    return counts;
  }, [chatItems]);
  const chatItemsRef = useRef<InterviewChatMessage[]>([]);
  chatItemsRef.current = chatItems;
  const sendChat = useSendInterviewChat();
  const ask = useAskAssistant();
  const toggleReaction = useToggleChatReaction();
  const togglePin = useToggleChatMessagePin();
  const updateChatMessage = useUpdateChatMessage();
  const deleteChatMessage = useDeleteChatMessage();
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<InterviewChatMessage | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [mentionAttention, setMentionAttention] = useState<InterviewChatMessage | null>(null);
  const seenChatMessagesRef = useRef<{ conversationId: string; ids: Set<string>; latestAt: number } | null>(null);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [activeWhiteboardId, setActiveWhiteboardId] = useState<string | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [whiteboardError, setWhiteboardError] = useState("");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const whiteboards = useListInterviewWhiteboards(chatParams, {
    query: {
      queryKey: getListInterviewWhiteboardsQueryKey(chatParams),
      refetchInterval: refreshMs,
    },
  });
  const createWhiteboard = useCreateInterviewWhiteboard();
  const createBoardMutation = useCreateBoard();
  const createSpreadsheetMutation = useCreateSpreadsheet();
  const getWhiteboard = useGetInterviewWhiteboardById(
    activeWhiteboardId ?? "",
    chatParams,
    {
      query: {
        queryKey: getGetInterviewWhiteboardByIdQueryKey(activeWhiteboardId ?? "", chatParams),
        enabled: Boolean(activeWhiteboardId),
      },
    },
  );
  const updateWhiteboard = useUpdateInterviewWhiteboard();
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportDiag(`window.onerror: ${event.message}`, `${event.filename}:${event.lineno}`);
    };
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, []);
  const qc = useQueryClient();
  const [chatFiles, setChatFiles] = useState<{ id: string; file: File; previewUrl: string; name: string; size: number; type: string; kind: ChatFileKind; inlineImage: boolean }[]>([]);
  const [fileStatus, setFileStatus] = useState<Record<string, string>>({});
  const chatFilesRef = useRef(chatFiles);
  chatFilesRef.current = chatFiles;
  useEffect(() => () => { for (const f of chatFilesRef.current) URL.revokeObjectURL(f.previewUrl); }, []);
  const [chatImageError, setChatImageError] = useState("");
  const [chatUploading, setChatUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [chatError, setChatError] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const applicantMentionsQuery = useListApplicants(
    { sort: "rank" },
    {
      query: {
        queryKey: getListApplicantsQueryKey({ sort: "rank" }),
        enabled: mentionOpen,
        refetchInterval: mentionOpen ? refreshMs : false,
      },
    },
  );
  const [formattingOpen, setFormattingOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const applicantMentionPeople = useMemo(
    () => buildApplicantMentionPeople(applicantMentionsQuery.data?.items ?? [], mentionLabels),
    [applicantMentionsQuery.data?.items, mentionLabels],
  );
  const mentionPeople = useMemo<ChatMentionPerson[]>(() => [
    { token: "all", label: "All interviewers", detail: "Everyone in this space", initials: "∗", kind: "group" as const },
    ...mentionLabels.map(label => ({
      token: label,
      label,
      detail: "Interviewer · tryout team",
      initials: label.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "?",
      kind: "interviewer" as const,
    })),
    { token: "ai", label: "AI assistant", detail: "Ask about active applicants", initials: "AI", kind: "assistant" as const },
    ...applicantMentionPeople,
  ].filter((person, index, list) => list.findIndex(candidate => candidate.token.toLowerCase() === person.token.toLowerCase()) === index), [applicantMentionPeople, mentionLabels]);
  const filteredMentionPeople = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    const matches = mentionPeople.filter(person =>
      !query || `${person.label} ${person.token} ${person.detail}`.toLowerCase().includes(query),
    );
    return [
      ...matches.filter(person => person.kind !== "applicant").slice(0, 6),
      ...matches.filter(person => person.kind === "applicant").slice(0, 8),
    ];
  }, [mentionPeople, mentionQuery]);
  const selectedMentionIndex = Math.min(mentionActiveIndex, Math.max(0, filteredMentionPeople.length - 1));
  const activeWhiteboard = activeWhiteboardId
    ? getWhiteboard.data ?? whiteboards.data?.items.find(item => item.id === activeWhiteboardId) ?? null
    : null;
  const openWhiteboard = (id?: string) => {
    setWhiteboardError("");
    setActiveWhiteboardId(id ?? null);
    setWhiteboardOpen(true);
    setComposerMenuOpen(false);
    setCreateMenuOpen(false);
  };
  const openBoard = (id: string) => {
    setActiveBoardId(id);
    setBoardOpen(true);
    setComposerMenuOpen(false);
    setCreateMenuOpen(false);
  };
  const openSpreadsheet = (id: string) => {
    setComposerMenuOpen(false);
    setCreateMenuOpen(false);
    const currentPath = location.split("?")[0];
    const returnPath = currentPath === "/queue" || currentPath === "/chat" ? currentPath : "/chat";
    const returnTo = conversationPeer ? `${returnPath}?peer=${encodeURIComponent(conversationPeer)}` : returnPath;
    setLocation(`/spreadsheets/${id}?returnTo=${encodeURIComponent(returnTo)}`);
  };
  const createSharedDocument = async () => {
    setWhiteboardError("");
    setChatError("");
    setComposerMenuOpen(false);
    setCreateMenuOpen(false);
    try {
      const saved = await createWhiteboard.mutateAsync({
        data: {
          title: "Untitled document",
          data: JSON.stringify({ kind: "document", elements: [], yState: "" }),
          scope: conversationScope,
          ...(conversationPeer ? { recipient: conversationPeer } : {}),
        },
      });
      setActiveWhiteboardId(saved.id);
      setWhiteboardOpen(true);
      await qc.invalidateQueries({ queryKey: getListInterviewWhiteboardsQueryKey(chatParams) });
      await sendChat.mutateAsync({
        data: {
          author: activeInterviewer,
          message: `[[document:${saved.id}]] ${saved.title}`,
          scope: conversationScope,
          ...(conversationPeer ? { recipient: conversationPeer } : {}),
        },
      });
      await qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey(chatParams) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't create the document. Try again.";
      setWhiteboardError(message);
      setChatError(message);
    }
  };
  const createSharedBoard = async () => {
    setChatError("");
    setComposerMenuOpen(false);
    setCreateMenuOpen(false);
    try {
      const saved = await createBoardMutation.mutateAsync({
        data: {
          title: "Interview coordination board",
          scope: conversationScope,
          ...(conversationPeer ? { recipient: conversationPeer } : {}),
        },
      });
      setActiveBoardId(saved.id);
      setBoardOpen(true);
      await sendChat.mutateAsync({
        data: {
          author: activeInterviewer,
          message: `[[board:${saved.id}]] ${saved.title}`,
          scope: conversationScope,
          ...(conversationPeer ? { recipient: conversationPeer } : {}),
        },
      });
      await qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey(chatParams) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't create the board. Try again.";
      setChatError(message);
    }
  };
  const createSharedSpreadsheet = async () => {
    setChatError("");
    setComposerMenuOpen(false);
    setCreateMenuOpen(false);
    try {
      const saved = await createSpreadsheetMutation.mutateAsync({
        data: {
          title: "Tryout worksheet",
          scope: conversationScope,
          ...(conversationPeer ? { recipient: conversationPeer } : {}),
        },
      });
      await sendChat.mutateAsync({
        data: {
          author: activeInterviewer,
          message: `[[spreadsheet:${saved.id}]] ${saved.title}`,
          scope: conversationScope,
          ...(conversationPeer ? { recipient: conversationPeer } : {}),
        },
      });
      await qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey(chatParams) });
      openSpreadsheet(saved.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't create the spreadsheet. Try again.";
      setChatError(message);
    }
  };
  const saveWhiteboard = async (title: string, data: string, share: boolean) => {
    setWhiteboardError("");
    try {
      const saved = activeWhiteboardId
        ? await updateWhiteboard.mutateAsync({ whiteboardId: activeWhiteboardId, data: { title, data } })
        : await createWhiteboard.mutateAsync({
            data: {
              title,
              data,
              scope: conversationScope,
              ...(conversationPeer ? { recipient: conversationPeer } : {}),
            },
          });
      setActiveWhiteboardId(saved.id);
      await qc.invalidateQueries({ queryKey: getListInterviewWhiteboardsQueryKey(chatParams) });
      if (share) {
        await sendChat.mutateAsync({
          data: {
            author: activeInterviewer,
            message: `[[whiteboard:${saved.id}]] ${saved.title}`,
            scope: conversationScope,
            ...(conversationPeer ? { recipient: conversationPeer } : {}),
          },
        });
        await qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey(chatParams) });
        setWhiteboardOpen(false);
      }
    } catch (error) {
      setWhiteboardError(error instanceof Error ? error.message : "Couldn't save the whiteboard. Try again.");
    }
  };
  const attachChatFiles = (files: FileList | File[]) => {
    try {
      setChatImageError("");
      const picked = Array.from(files);
      if (!picked.length) return;
      reportDiag("attach picked", picked.map(f => `${f.name}|${f.type || "notype"}|${Math.round(f.size / 1024)}kb`).join(";"));
      if (chatFiles.length + picked.length > 3) { setChatImageError("Up to 3 attachments per message."); return; }
      const next: { id: string; file: File; previewUrl: string; name: string; size: number; type: string; kind: ChatFileKind; inlineImage: boolean }[] = [];
      for (const file of picked) {
        const type = chatFileType(file);
        if (!type) { setChatImageError(`"${file.name}" is not a supported attachment.`); return; }
        if (file.size > CHAT_MAX_FILE_BYTES) { setChatImageError(`"${file.name}" is too big (max 100 MB).`); return; }
        let id: string;
        try {
          id = crypto.randomUUID();
        } catch {
          id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        }
        next.push({
          id,
          file,
          previewUrl: URL.createObjectURL(file),
          name: file.name,
          size: file.size,
          type,
          kind: chatFileKind(type),
          inlineImage: type.startsWith("image/") && CHAT_INLINE_IMAGE_TYPES.has(type),
        });
      }
      setChatFiles(current => [...current, ...next].slice(0, 3));
    } catch (error) {
      reportDiag("attach threw", error instanceof Error ? error.message : String(error));
      setChatImageError("Couldn't read the selected files. Try again.");
    }
  };
  const removeChatFile = (id: string) => {    setFileStatus(current => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setChatFiles(current => {
      const target = current.find(f => f.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter(f => f.id !== id);
    });
  };
  const updateMentionState = (value: string) => {
    setMessage(value);
    const match = value.match(/(?:^|\s)@([^\s@]*)$/);
    setMentionOpen(Boolean(match));
    setMentionQuery(match?.[1] ?? "");
    setMentionActiveIndex(0);
    setEmojiOpen(false);
    setComposerMenuOpen(false);
    setVoiceMenuOpen(false);
  };
  const insertAtCursor = (value: string) => {
    const input = chatMessageInputRef.current;
    if (!input) {
      setMessage(current => `${current}${value}`);
      return;
    }
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const next = `${message.slice(0, start)}${value}${message.slice(end)}`;
    setMessage(next);
    setMentionOpen(false);
    requestAnimationFrame(() => {
      input.focus();
      const cursor = start + value.length;
      input.setSelectionRange(cursor, cursor);
    });
  };
  const selectMention = (person: ChatMentionPerson) => {
    const match = message.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match || match.index === undefined) return;
    const start = match.index + (match[0].startsWith(" ") ? 1 : 0);
    const next = `${message.slice(0, start)}@${person.token} ${message.slice(message.length)}`;
    setMessage(next);
    setMentionOpen(false);
    setMentionQuery("");
    requestAnimationFrame(() => {
      const input = chatMessageInputRef.current;
      input?.focus();
      input?.setSelectionRange(next.length, next.length);
    });
  };
  const handleChatInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      setMentionOpen(false);
      setEmojiOpen(false);
      setComposerMenuOpen(false);
      return;
    }
    if (mentionOpen && filteredMentionPeople.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionActiveIndex(index => (Math.min(index, filteredMentionPeople.length - 1) + 1) % filteredMentionPeople.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionActiveIndex(index => (Math.min(index, filteredMentionPeople.length - 1) - 1 + filteredMentionPeople.length) % filteredMentionPeople.length);
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey) {
        event.preventDefault();
        selectMention(filteredMentionPeople[selectedMentionIndex] ?? filteredMentionPeople[0]);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey && !mentionOpen) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };
  const applyFormatting = (before: string, after = before) => {
    const input = chatMessageInputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = message.slice(start, end);
    const content = selected || "text";
    const next = `${message.slice(0, start)}${before}${content}${after}${message.slice(end)}`;
    setMessage(next);
    requestAnimationFrame(() => {
      input.focus();
      const cursor = selected ? start + before.length + selected.length + after.length : start + before.length;
      input.setSelectionRange(cursor, cursor);
    });
  };
  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setChatError("Voice messages are not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      voiceStreamRef.current = stream;
      voiceRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) voiceChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: mimeType });
        if (blob.size) attachChatFiles([new File([blob], `voice-message-${Date.now()}.webm`, { type: mimeType })]);
        stream.getTracks().forEach(track => track.stop());
        voiceStreamRef.current = null;
        voiceRecorderRef.current = null;
        voiceChunksRef.current = [];
        setIsRecording(false);
      };
      recorder.start();
      setChatError("");
      setIsRecording(true);
    } catch {
      setChatError("Microphone access was blocked. Allow microphone access and try again.");
    }
  };
  const stopVoiceRecording = () => {
    voiceRecorderRef.current?.stop();
  };
  const startDictation = () => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setChatError("Dictation is not supported in this browser. Try Chrome or Edge, or use Record audio.");
      setVoiceMenuOpen(false);
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      dictationBaseRef.current = message;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";
      recognition.onresult = event => {
        let transcript = "";
        for (let index = 0; index < event.results.length; index += 1) {
          transcript += event.results[index]?.[0]?.transcript ?? "";
        }
        const base = dictationBaseRef.current;
        setMessage(`${base}${base && transcript ? " " : ""}${transcript}`);
        setMentionOpen(false);
      };
      recognition.onerror = event => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setChatError("Microphone access was blocked. Allow microphone access and try dictation again.");
        } else if (event.error) {
          setChatError(`Dictation stopped: ${event.error}.`);
        }
        setIsDictating(false);
        dictationRef.current = null;
      };
      recognition.onend = () => {
        setIsDictating(false);
        dictationRef.current = null;
      };
      dictationRef.current = recognition;
      recognition.start();
      setChatError("");
      setVoiceMenuOpen(false);
      setIsDictating(true);
      requestAnimationFrame(() => chatMessageInputRef.current?.focus());
    } catch {
      setChatError("Dictation could not start. Check microphone permissions and try again.");
      setIsDictating(false);
      dictationRef.current = null;
    }
  };
  const stopDictation = () => {
    dictationRef.current?.stop();
  };
  useEffect(() => () => {
    dictationRef.current?.stop();
    voiceRecorderRef.current?.stop();
    voiceStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);
  useEffect(() => {
    if (conversationPeer && !interviewerLabels.some(label => label.toLowerCase() === conversationPeer.toLowerCase() && label.toLowerCase() !== activeInterviewer.toLowerCase())) {
      setConversationPeer(null);
    }
  }, [activeInterviewer, conversationPeer, interviewerLabels]);
  useEffect(() => {
    setOlderChatConversationId(conversationId);
    setOlderChat([]);
    setChatHasMore(true);
    setChatLoadingMore(false);
    setMentionAttention(null);
    seenChatMessagesRef.current = null;
    setReplyingTo(null);
    setEditingMessageId(null);
    setEditDraft("");
    setPickerFor(null);
    chatLoadGuardRef.current = false;
    chatAnchorRef.current = null;
    chatOldestRef.current = "";
    chatPrevLenRef.current = 0;
    chatStickRef.current = true;
    setWhiteboardOpen(false);
    setActiveWhiteboardId(null);
    setWhiteboardError("");
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = 0;
  }, [conversationId]);
  const loadOlderChat = useCallback(async () => {
    if (chatLoadGuardRef.current) return;
    const items = chatItemsRef.current;
    if (!items.length) return;
    chatLoadGuardRef.current = true;
    setChatLoadingMore(true);
    try {
      const page = await getInterviewChat({ ...chatParams, before: items[0].createdAt });
      const el = chatScrollRef.current;
      if (el) chatAnchorRef.current = { prevH: el.scrollHeight, prevTop: el.scrollTop };
      setOlderChat(current => {
        const ids = new Set(current.map(m => m.id));
        return [...page.items.filter(m => !ids.has(m.id)), ...current];
      });
      if (page.items.length < CHAT_PAGE_SIZE) setChatHasMore(false);
    } catch {
      // Keep hasMore true so scrolling up retries.
    } finally {
      chatLoadGuardRef.current = false;
      setChatLoadingMore(false);
    }
  }, [chatParams]);
  useLayoutEffect(() => {
    const anchor = chatAnchorRef.current;
    const el = chatScrollRef.current;
    if (anchor && el) {
      el.scrollTop = anchor.prevTop + (el.scrollHeight - anchor.prevH);
      chatAnchorRef.current = null;
    }
  }, [olderChat]);
  const chatPrevLenRef = useRef(0);
  const chatOldestRef = useRef("");
  useEffect(() => {
    const el = chatScrollRef.current;
    const n = chatItems.length;
    if (!el || n === 0) { chatPrevLenRef.current = n; return; }
    const oldest = chatItems[0].id;
    if (chatOldestRef.current && chatOldestRef.current !== oldest) {
      chatOldestRef.current = oldest;
      chatPrevLenRef.current = n;
      return;
    }
    chatOldestRef.current = oldest;
    if (chatPrevLenRef.current === 0 || (n > chatPrevLenRef.current && chatStickRef.current)) {
      el.scrollTop = el.scrollHeight;
    }
    chatPrevLenRef.current = n;
  }, [chatItems]);
  useEffect(() => {
    if (chat.data?.scope !== conversationScope || chat.data.peer !== (conversationPeer ?? null)) return;

    const latestAt = chatItems.reduce((latest, item) => {
      const timestamp = Date.parse(item.createdAt);
      return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
    }, 0);
    const currentIds = new Set(chatItems.map(item => item.id));
    const previous = seenChatMessagesRef.current;
    if (!previous || previous.conversationId !== conversationId) {
      seenChatMessagesRef.current = { conversationId, ids: currentIds, latestAt };
      return;
    }

    const newlyReceived = chatItems.filter(item => {
      const timestamp = Date.parse(item.createdAt);
      return !previous.ids.has(item.id) && Number.isFinite(timestamp) && timestamp >= previous.latestAt;
    });
    const newMentions = newlyReceived.filter(item =>
      item.author.toLowerCase() !== activeInterviewer.toLowerCase() &&
        messageMentionsInterviewer(item.message, activeInterviewer, mentionPeople),
    );
    if (newMentions.length > 0) {
      const latestMention = newMentions.reduce((latest, item) =>
        Date.parse(item.createdAt) >= Date.parse(latest.createdAt) ? item : latest,
      );
      if (!chatStickRef.current) setMentionAttention(latestMention);

      if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
        const conversationName = conversationScope === "direct" ? "a direct message" : "team chat";
        const body = newMentions.length > 1
          ? `${newMentions.length} new messages in ${conversationName} mention you.`
          : `${latestMention.author} mentioned you in ${conversationName}.`;
        try {
          const notification = new Notification(newMentions.length > 1 ? "New chat mentions" : "You were mentioned", {
            body,
            tag: `chat-mention-${conversationId}`,
          });
          notification.onclick = () => window.focus();
        } catch {
          // The in-chat highlight remains available if browser notifications are blocked.
        }
      }
    }

    seenChatMessagesRef.current = {
      conversationId,
      ids: new Set([...previous.ids, ...currentIds]),
      latestAt: Math.max(previous.latestAt, latestAt),
    };
  }, [activeInterviewer, chat.data?.peer, chat.data?.scope, chatItems, conversationId, conversationPeer, conversationScope, mentionPeople]);
  useEffect(() => {
    if (scopedChatItems.length < CHAT_PAGE_SIZE && olderChat.length === 0) setChatHasMore(false);
  }, [olderChat.length, scopedChatItems.length]);
  const react = (messageId: string, emoji: string) => {
    const author = activeInterviewer;
    setPickerFor(null);
    toggleReaction.mutate({ messageId, data: { emoji, author } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey(chatParams) }); },
    });
  };
  const beginEdit = (item: InterviewChatMessage) => {
    setPickerFor(null);
    setReplyingTo(null);
    setEditingMessageId(item.id);
    setEditDraft(item.message);
  };
  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditDraft("");
  };
  const saveEdit = (item: InterviewChatMessage) => {
    const nextMessage = editDraft.trim();
    if (!nextMessage) {
      setChatError("A message cannot be empty.");
      return;
    }
    if (nextMessage.length > 1000) {
      setChatError("Message is too long — shorten the text.");
      return;
    }
    setChatError("");
    updateChatMessage.mutate(
      { messageId: item.id, data: { message: nextMessage } },
      {
        onSuccess: () => {
          cancelEdit();
          void qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey(chatParams) });
        },
        onError: error => setChatError(error instanceof Error ? error.message : "Couldn't edit that message."),
      },
    );
  };
  const removeChatMessage = (item: InterviewChatMessage) => {
    if (deleteChatMessage.isPending || !window.confirm("Delete this message? This cannot be undone.")) return;
    setChatError("");
    deleteChatMessage.mutate(
      { messageId: item.id },
      {
        onSuccess: () => {
          if (editingMessageId === item.id) cancelEdit();
          if (replyingTo?.id === item.id) setReplyingTo(null);
          void qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey(chatParams) });
        },
        onError: error => setChatError(error instanceof Error ? error.message : "Couldn't delete that message."),
      },
    );
  };
  const submitChat = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() && !chatFiles.length) return;
    if (message.trim().length > 900) { setChatError("Message is too long — shorten the text."); return; }
    const draft = message.trim();
    setChatError("");
    chatStickRef.current = true;
    const author = activeInterviewer;
    const uploadedIds: string[] = [];
    let userPosted = false;
    let stage = "start";
    const fileInfo = chatFiles.map(f => `${f.name}|${f.file.type || "notype"}|${Math.round(f.size / 1024)}kb`).join(";");
    const diagContext = () => `files:[${fileInfo}] ua:${navigator.userAgent.slice(0, 160)}`;
    const fail = (userMessage: string): never => { throw new Error(`USER:${userMessage}`); };
    const prepareOrFail = async (file: File, displayName: string): Promise<PreparedChatFile> => {
      try {
        return await prepareChatFile(file);
      } catch (error) {
        throw new Error(
          "USER:" +
            (error instanceof Error && error.message === "unreadable"
              ? `"${displayName}" can't be read in this browser.`
              : error instanceof Error && error.message === "unreadable-heic"
                ? `Couldn't convert "${displayName}" (iPhone photo).`
                : error instanceof Error && error.message.startsWith("timeout:")
                  ? `Timed out (${error.message.slice(8)}) on "${displayName}". Try a smaller image or faster connection.`
                  : "Couldn't prepare attachments. Try again."),
        );
      }
    };
    setChatUploading(true);
    try {
      const embeds: string[] = [];
      for (const f of chatFiles) {
        stage = `prepare:${f.name}`;
        setFileStatus(current => ({ ...current, [f.id]: "Preparing…" }));
        const prepared = await prepareOrFail(f.file, f.name);
        stage = `upload:${f.name}`;
        setFileStatus(current => ({ ...current, [f.id]: "Uploading…" }));
        let objectId = "";
        try {
          const controller = new AbortController();
          const abortTimer = setTimeout(() => controller.abort(), 45000);
          let response: Response;
          try {
            response = await fetch(`${import.meta.env.BASE_URL}api/storage/uploads`, {
              method: "POST",
              headers: { "Content-Type": prepared.type },
              body: prepared.blob,
              credentials: "include",
              signal: controller.signal,
            });
          } catch (error) {
            if (error instanceof Error && error.name === "AbortError") fail("Upload timed out after 45 seconds. Try again on a faster connection.");
            throw error;
          } finally {
            clearTimeout(abortTimer);
          }
          if (!response.ok) {
            let detail = "";
            try {
              const parsed = await response.json() as { error?: unknown };
              if (typeof parsed?.error === "string" && parsed.error) detail = `: ${parsed.error}`;
            } catch { /* ignore parse errors */ }
            fail(`Upload failed (HTTP ${response.status})${detail}. Try again.`);
          }
          const parsed = await response.json() as { objectPath?: unknown };
          objectId = typeof parsed?.objectPath === "string" ? parsed.objectPath.replace(/^\/objects\//, "") : "";
          if (!objectId || objectId.includes("/")) fail("Upload failed (bad response). Try again.");
        } catch (error) {
          if (error instanceof Error && error.message.startsWith("USER:")) throw error;
          fail("Upload failed (network). Try again.");
        }
        uploadedIds.push(objectId);
        const safeName = prepared.name.replace(/[\[\]\r\n]/g, "_");
        embeds.push(prepared.inlineImage
          ? `![${safeName}](/api/storage/objects/${objectId})`
          : `[${safeName}](/api/storage/objects/${objectId})`);
      }
      const submitted = [draft, embeds.join("\n")].filter(Boolean).join("\n");
      stage = "send";
      await withTimeout(sendChat.mutateAsync({
        data: {
          author,
          message: submitted,
          scope: conversationScope,
          ...(conversationPeer ? { recipient: conversationPeer } : {}),
          ...(replyingTo?.id ? { parentMessageId: replyingTo.id } : {}),
        },
      }), 30000, "send");
      userPosted = true;
      if (/@ai\b/i.test(submitted)) {
        stage = "ai";
        const question = submitted.replace(/@ai\b/ig, "").trim() || "Give me a quick read on the active applicants.";
         const chatContext = [...chatItems, { author, message: submitted }].slice(-12).map(item => ({ author: item.author, message: item.message }));
        const response = await withTimeout(ask.mutateAsync({ data: { question, applicantIds, chatContext } }), 120000, "ai");
        await withTimeout(sendChat.mutateAsync({
          data: {
            author: "AI assistant",
            ...(conversationPeer ? { conversationAuthor: activeInterviewer } : {}),
            message: response.answer,
            scope: conversationScope,
            ...(conversationPeer ? { recipient: conversationPeer } : {}),
            activities: response.activities ?? [],
          },
        }), 30000, "send-ai");
      }
      await qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey(chatParams) });
      for (const f of chatFiles) URL.revokeObjectURL(f.previewUrl);
      setChatFiles([]);
      setFileStatus({});
      setMessage("");
      setMentionOpen(false);
      setMentionQuery("");
      setEmojiOpen(false);
      setComposerMenuOpen(false);
      setVoiceMenuOpen(false);
      setReplyingTo(null);
      setChatError("");
    } catch (error) {
      reportDiag(`chat-send failed at ${stage}`, diagContext());
      if (!userPosted) {
        for (const id of uploadedIds) {
          try { await fetch(`${import.meta.env.BASE_URL}api/storage/objects/${id}`, { method: "DELETE", credentials: "include" }); } catch { /* best-effort cleanup */ }
        }
      }
      const message = !userPosted && error instanceof Error && error.message.startsWith("USER:")
        ? error.message.slice(5)
        : error instanceof Error && error.message.startsWith("timeout:")
          ? `Timed out (${error.message.slice(8)}). Try again.`
          : userPosted
            ? "The AI answer failed. Your message was saved — try again."
            : "Couldn't send — nothing was posted. Try again.";
      setChatError(message);
    } finally {
      setChatUploading(false);
    }
  };
  const renderChatMessage = (item: InterviewChatMessage) => {
    const parent = item.parentMessageId ? chatItems.find(candidate => candidate.id === item.parentMessageId) : undefined;
    const replyCount = replyCounts.get(item.id) ?? 0;
    const parentPreview = parent?.message.replace(/\s+/g, " ").trim().slice(0, 110);
    const canManage = item.author.toLowerCase() === activeInterviewer.toLowerCase() && item.author !== "AI assistant";
    const editing = editingMessageId === item.id;
    const mentionedYou = messageMentionsInterviewer(item.message, activeInterviewer, mentionPeople);
    return <div key={item.id} id={`chat-message-${item.id}`} data-mentioned-you={mentionedYou || undefined} className={`chat-message-card group relative rounded-xl border border-[#e1e9e8] bg-white p-3 transition-colors hover:border-[#c7dddd] ${mentionedYou ? "chat-message-mentioned" : ""} ${item.parentMessageId ? "ml-6 border-l-2 border-l-[#9bcfce]" : ""}`}>
      <div className="pointer-events-none absolute right-2 top-0 z-10 flex -translate-y-1/2 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="flex items-center gap-0.5 rounded-lg border border-[#dce5e5] bg-white p-1 shadow-[0_3px_12px_rgba(24,58,75,0.14)]">
          {["👍", "😂", "🙏"].map(emoji => <ChatActionTooltip key={emoji} label={`React ${emoji}`}><button type="button" onClick={() => react(item.id, emoji)} aria-label={`React with ${emoji}`} className="flex h-7 w-7 items-center justify-center rounded-md text-base transition hover:bg-[#edf4f3]">{emoji}</button></ChatActionTooltip>)}
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-[#dce5e5] bg-white p-1 shadow-[0_3px_12px_rgba(24,58,75,0.14)]">
          <ChatActionTooltip label="Add reaction"><button type="button" onClick={() => { setPickerFor(pickerFor === item.id ? null : item.id); setEmojiOpen(false); }} aria-label="Add reaction" aria-expanded={pickerFor === item.id} data-testid={`button-reaction-add-${item.id}`} className="flex h-7 w-7 items-center justify-center rounded-md text-[#52666e] transition hover:bg-[#edf4f3] hover:text-[#16869a]"><SmilePlus size={16} /></button></ChatActionTooltip>
          <ChatActionTooltip label={replyingTo?.id === item.id ? "Cancel reply" : "Reply"}><button type="button" onClick={() => { setPickerFor(null); setReplyingTo(replyingTo?.id === item.id ? null : item); }} aria-label={`Reply to ${item.author}`} data-testid={`button-reply-${item.id}`} className={`flex h-7 w-7 items-center justify-center rounded-md transition ${replyingTo?.id === item.id ? "bg-[#e3f4f2] text-[#106d7a]" : "text-[#52666e] hover:bg-[#edf4f3] hover:text-[#16869a]"}`}><Reply size={16} /></button></ChatActionTooltip>
          <ChatActionTooltip label={item.pinnedAt ? "Unpin message" : "Pin message"}><button type="button" onClick={() => togglePin.mutate({ messageId: item.id }, { onSuccess: () => { void qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey(chatParams) }); } })} disabled={togglePin.isPending} aria-label={item.pinnedAt ? "Unpin message" : "Pin message"} data-testid={`button-pin-${item.id}`} className={`flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-50 ${item.pinnedAt ? "bg-[#fff3cf] text-[#8a6508]" : "text-[#52666e] hover:bg-[#edf4f3] hover:text-[#16869a]"}`}><Pin size={15} className={item.pinnedAt ? "fill-current" : ""} /></button></ChatActionTooltip>
           {canManage && <><ChatActionTooltip label="Edit message"><button type="button" onClick={() => beginEdit(item)} disabled={updateChatMessage.isPending || deleteChatMessage.isPending} aria-label="Edit message" data-testid={`button-edit-${item.id}`} className="flex h-7 w-7 items-center justify-center rounded-md text-[#52666e] transition hover:bg-[#edf4f3] hover:text-[#16869a] disabled:opacity-50"><Pencil size={15} /></button></ChatActionTooltip><ChatActionTooltip label="Delete message"><button type="button" onClick={() => removeChatMessage(item)} disabled={updateChatMessage.isPending || deleteChatMessage.isPending} aria-label="Delete message" data-testid={`button-delete-chat-message-${item.id}`} className="flex h-7 w-7 items-center justify-center rounded-md text-[#a34d46] transition hover:bg-[#fff1ef] disabled:opacity-50"><Trash2 size={15} /></button></ChatActionTooltip></>}
        </div>
      </div>
      {item.parentMessageId && <div className="mb-2 flex items-center gap-1.5 text-[11px] text-[#7c8c91]"><Reply size={12} className="text-[#16869a]" /><span>Replying to <strong className="text-[#52666e]">{parent?.author ?? "another message"}</strong>{parentPreview ? ` — ${parentPreview}${parentPreview.length >= 110 ? "…" : ""}` : ""}</span></div>}
      <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="text-xs font-semibold text-[#183a4b]">{item.author}</span>{item.pinnedAt && <span className="inline-flex items-center gap-1 rounded-full bg-[#fff3cf] px-2 py-0.5 text-[10px] font-semibold text-[#8a6508]"><Pin size={10} className="fill-current" /> Pinned</span>}{mentionedYou && <span className="chat-mentioned-you-badge" data-testid={`chat-mentioned-you-${item.id}`}><AtSign size={11} strokeWidth={3} /> Mentioned you</span>}</div><span className="text-[10px] text-[#8a999d]">{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
        {editing ? <div className="mt-2 rounded-xl border border-[#b9dddd] bg-[#f7faf9] p-2.5" data-testid={`chat-edit-${item.id}`}><textarea autoFocus value={editDraft} onChange={event => setEditDraft(event.target.value)} maxLength={1000} rows={3} aria-label="Edit message" className="w-full resize-y rounded-lg border border-[#d5e0e0] bg-white p-2.5 text-sm text-[#183a4b] outline-none focus:border-[#16869a]" /><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={cancelEdit} disabled={updateChatMessage.isPending} className="rounded-lg border border-[#d5e0e0] bg-white px-3 py-1.5 text-xs font-semibold text-[#52666e]">Cancel</button><button type="button" onClick={() => saveEdit(item)} disabled={updateChatMessage.isPending || !editDraft.trim()} data-testid={`button-save-chat-edit-${item.id}`} className="rounded-lg bg-[#16869a] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{updateChatMessage.isPending ? "Saving…" : "Save"}</button></div></div> : (() => {
          const sharedDocument = parseDocumentChatMessage(item.message);
          const sharedWhiteboard = parseWhiteboardChatMessage(item.message);
           const sharedBoard = parseBoardChatMessage(item.message);
          const sharedSpreadsheet = parseSpreadsheetChatMessage(item.message);
          return sharedDocument
             ? <button type="button" onClick={() => openWhiteboard(sharedDocument.id)} className="shared-document-card mt-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition" data-testid={`button-open-document-${sharedDocument.id}`}><span className="shared-document-card-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm"><FileText size={18} /></span><span className="min-w-0"><span className="shared-document-card-label block text-[10px] font-bold uppercase tracking-[.12em]">Shared document</span><span className="shared-document-card-title mt-0.5 block truncate text-sm font-semibold">{sharedDocument.title}</span><span className="shared-document-card-description mt-0.5 block text-[11px]">Open collaborative editor</span></span><ChevronRight size={16} className="shared-document-card-chevron ml-auto shrink-0" /></button>
            : sharedWhiteboard
              ? <button type="button" onClick={() => openWhiteboard(sharedWhiteboard.id)} className="mt-2 flex w-full items-center gap-3 rounded-xl border border-[#b9dddd] bg-[#eef8f7] p-3 text-left transition hover:border-[#16869a] hover:bg-[#e3f4f2]" data-testid={`button-open-whiteboard-${sharedWhiteboard.id}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#16869a] shadow-sm"><FilePenLine size={18} /></span><span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">Shared whiteboard</span><span className="mt-0.5 block truncate text-sm font-semibold text-[#183a4b]">{sharedWhiteboard.title}</span><span className="mt-0.5 block text-[11px] text-[#527079]">Open in Excalidraw</span></span><ChevronRight size={16} className="ml-auto shrink-0 text-[#16869a]" /></button>
              : sharedBoard
                 ? <BoardChatCard boardId={sharedBoard.id} fallbackTitle={sharedBoard.title} onOpen={() => openBoard(sharedBoard.id)} />
                 : sharedSpreadsheet
                   ? <SpreadsheetChatCard spreadsheetId={sharedSpreadsheet.id} fallbackTitle={sharedSpreadsheet.title} onOpen={() => openSpreadsheet(sharedSpreadsheet.id)} />
                 : <MarkdownContent source={addTeamEmojiMarkdown(item.message, customEmojiPaths)} mentionPeople={mentionPeople} className="mt-1 text-[#52666e]" />;
        })()}
      <ActivityPills activities={item.activities ?? []} />
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {(item.reactions ?? []).map(r => {
           const mine = r.authors.includes(activeInterviewer);
          const customEmojiUrl = getTeamEmojiStorageUrl(r.emoji, customEmojiPaths);
          return <button key={r.emoji} onClick={() => react(item.id, r.emoji)} title={r.authors.join(", ") || r.emoji} data-testid={`button-reaction-${item.id}`} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${mine ? "border-[#16869a] bg-[#e3f4f2] font-bold" : "border-[#dce9e8] bg-white hover:border-[#16869a]"}`}><span>{customEmojiUrl ? <AuthenticatedChatImage src={customEmojiUrl} alt={r.emoji} inline /> : r.emoji}</span><span className="mono">{r.count}</span></button>;
        })}
        {replyCount > 0 && <span className="ml-1 inline-flex items-center rounded-full bg-[#edf4f3] px-2 py-1 text-[11px] font-semibold text-[#527079]">{replyCount} {replyCount === 1 ? "reply" : "replies"}</span>}
      </div>
      {pickerFor === item.id && <div data-testid={`reaction-picker-${item.id}`}><InterviewerChatEmojiPicker
        dark={theme === "dark"}
        customEmojis={customEmojiItems}
        customEmojiLoadFailed={customEmojisQuery.isError}
        onRetryCustomEmojis={() => { void customEmojisQuery.refetch(); }}
        onSelect={value => react(item.id, value)}
      /></div>}
    </div>;
  };
   const directTargets = interviewerLabels.filter(label => label.toLowerCase() !== activeInterviewer.toLowerCase());
   return <section className="rounded-3xl border border-[#dce5e5] bg-white p-5">
      <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">{conversationPeer ? `Direct message · ${conversationPeer}` : "Interviewer chat"}</h2><p className="mt-1 text-xs text-[#7c8c91]">Type <strong>@ai</strong> for an applicant-aware response.</p></div><Bot size={20} className="text-[#16869a]" /></div>
      {mentionAttention && <button
        type="button"
        onClick={() => {
          document.getElementById(`chat-message-${mentionAttention.id}`)?.scrollIntoView({
            behavior: settings.reduceMotion ? "auto" : "smooth",
            block: "center",
          });
          setMentionAttention(null);
        }}
        className="chat-mention-alert mt-3 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition"
        data-testid="chat-mention-attention"
        aria-live="polite"
      >
        <AtSign size={17} className="shrink-0" />
        <span className="min-w-0 flex-1"><span className="block text-xs font-bold">{mentionAttention.author} mentioned you</span><span className="block truncate text-[11px]">{mentionAttention.message.replace(/\s+/g, " ").trim()}</span></span>
        <ArrowRight size={15} className="shrink-0" />
      </button>}
     <div className="mt-4 rounded-2xl border border-[#dce9e8] bg-[#f7faf9] p-3">
       <div className="flex flex-wrap items-center gap-2">
         <span className="rounded-lg border border-[#16869a] bg-[#e3f4f2] px-2.5 py-1.5 text-xs font-semibold text-[#12737d]">Signed in as {activeInterviewer}</span>
       </div>
       <div className="mt-3 flex flex-wrap items-center gap-2">
         <span className="mr-1 text-[11px] font-semibold uppercase tracking-[.1em] text-[#7c8c91]">Conversation</span>
         <button type="button" onClick={() => setConversationPeer(null)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${!conversationPeer ? "border-[#183a4b] bg-[#183a4b] text-white" : "border-[#d5e0e0] bg-white text-[#52666e] hover:border-[#183a4b]"}`} data-testid="button-chat-team">Team</button>
         {directTargets.map(label => <button key={`direct-${label}`} type="button" onClick={() => setConversationPeer(label)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${conversationPeer?.toLowerCase() === label.toLowerCase() ? "border-[#16869a] bg-[#e3f4f2] text-[#12737d]" : "border-[#d5e0e0] bg-white text-[#52666e] hover:border-[#16869a]"}`} data-testid={`button-chat-direct-${label.toLowerCase().replaceAll(" ", "-")}`}>To {label}</button>)}
       </div>
       <p className="mt-2 text-[11px] leading-4 text-[#8a999d]">Your identity comes from your signed interviewer session. Direct messages are visible only to the two participants.</p>
     </div>
     <div ref={chatScrollRef} onScroll={event => { const el = event.currentTarget; chatStickRef.current = isNearBottom(el); if (el.scrollTop < 80) void loadOlderChat(); }} className={`mt-4 space-y-3 overflow-y-auto rounded-xl bg-[#f5f8f7] p-3 ${tall ? "h-[calc(100dvh-340px)] min-h-[420px]" : "h-[330px]"}`}>{chatHasMore && chatItems.length > 0 && <button onClick={() => void loadOlderChat()} disabled={chatLoadingMore} data-testid="button-load-older-chat" className="mx-auto block rounded-full border border-[#dce9e8] bg-white px-4 py-1.5 text-xs font-semibold text-[#527079] transition hover:border-[#16869a] hover:text-[#16869a] disabled:opacity-50">{chatLoadingMore ? "Loading older messages..." : "Load older messages"}</button>}{!chatHasMore && chatItems.length > 0 && <p className="text-center text-[11px] text-[#8a999d]">Start of conversation</p>}{chatItems.length ? chatItems.map(renderChatMessage) : <p className="py-24 text-center text-sm text-[#7c8c91]">No messages yet. Leave a note for the other interviewer.</p>}</div>
      <form onSubmit={submitChat} className="mt-3 space-y-2">
       {replyingTo && <div className="chat-reply-preview flex items-start gap-2 rounded-xl border px-3 py-2" data-testid="chat-reply-preview"><Reply size={15} className="chat-reply-icon mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><p className="chat-reply-label text-[11px] font-semibold uppercase tracking-[.08em]">Replying to {replyingTo.author}</p><p className="chat-reply-body truncate text-xs">{replyingTo.message.replace(/\s+/g, " ").trim()}</p></div><button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply" data-testid="button-cancel-reply" className="chat-reply-close flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition"><X size={13} /></button></div>}
       {chatFiles.length > 0 && <div className="space-y-2">{chatFiles.map(f => <div key={f.id} className="flex items-center gap-3 rounded-xl border border-[#dce9e8] bg-[#f7faf9] p-2" data-testid={`chat-file-${f.id}`}><ChatAttachmentPreview file={f} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{f.name}</p><p className="text-[11px] text-[#7c8c91]">{fileStatus[f.id] ?? (isHeicFile(f.file) ? "iPhone photo · converts on send" : `${formatUploadSize(f.size)} · will upload on send`)}</p></div><button type="button" onClick={() => removeChatFile(f.id)} aria-label={`Remove ${f.name}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#183a4b] text-white hover:bg-[#b34a42]"><X size={13} /></button></div>)}</div>}
       <div className="relative">
           {mentionOpen && <div id="chat-mention-listbox" role="listbox" aria-label="Mention suggestions" className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-full max-w-[360px] overflow-hidden rounded-2xl border border-[#d5e0e0] bg-white shadow-[0_12px_32px_rgba(24,58,75,0.2)]" data-testid="mention-menu">
            <div className="border-b border-[#edf1f1] px-4 py-2.5"><p className="text-xs font-semibold text-[#52666e]">People and applicants</p><p className="mt-0.5 text-[11px] text-[#8a999d]">Applicant mentions are chat references; applicants aren’t notified.</p></div>
            <div className="max-h-64 overflow-y-auto p-1.5">
               {filteredMentionPeople.map((person, index) => <button
                  key={person.token}
                  id={`chat-mention-option-${index}`}
                  role="option"
                  aria-selected={index === selectedMentionIndex}
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onMouseEnter={() => setMentionActiveIndex(index)}
                  onClick={() => selectMention(person)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${index === selectedMentionIndex ? "bg-[#edf4f3]" : "hover:bg-[#edf4f3]"}`}
                  data-testid={`mention-option-${person.token.toLowerCase().replaceAll(" ", "-")}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dff4f2] text-[11px] font-bold text-[#12737d]">{person.initials}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#183a4b]">{person.label}</span><span className="block truncate text-[11px] text-[#7c8c91]">{person.detail}</span></span>
                 </button>)}
               {applicantMentionsQuery.isFetching && <p className="px-3 py-3 text-center text-xs text-[#7c8c91]">Loading applicant suggestions…</p>}
               {applicantMentionsQuery.isError && <p className="px-3 py-3 text-center text-xs text-[#a34d46]">Applicants couldn’t be loaded. Interviewer mentions still work.</p>}
               {filteredMentionPeople.length === 0 && !applicantMentionsQuery.isFetching && !applicantMentionsQuery.isError && <p className="px-3 py-4 text-center text-xs text-[#7c8c91]">No matching people or applicants.</p>}
            </div>
         </div>}
          {composerMenuOpen && <div className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-64 rounded-2xl border border-border bg-card p-1.5 text-card-foreground shadow-xl" data-testid="composer-menu"><button type="button" onClick={() => { setComposerMenuOpen(false); chatFileInputRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-muted" data-testid="button-upload-files"><Upload size={16} className="text-primary" /><span><span className="block">Upload files</span><span className="block text-[11px] font-normal text-muted-foreground">Images, documents, or audio</span></span></button><button type="button" onClick={() => { setComposerMenuOpen(false); setCreateMenuOpen(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-muted" data-testid="button-open-create-menu"><Plus size={16} className="text-primary" /><span><span className="block">Create</span><span className="block text-[11px] font-normal text-muted-foreground">Choose a shared workspace item</span></span></button></div>}
            {createMenuOpen && <div className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-72 rounded-2xl border border-border bg-card p-2 text-card-foreground shadow-xl" data-testid="create-type-menu"><div className="flex items-center justify-between px-2 pb-1.5 pt-1"><p className="text-xs font-bold text-card-foreground">What would you like to create?</p><button type="button" onClick={() => setCreateMenuOpen(false)} aria-label="Close create menu" data-testid="button-close-create-menu" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted"><X size={15} /></button></div><button type="button" onClick={() => void createSharedDocument()} disabled={createWhiteboard.isPending || sendChat.isPending || createSpreadsheetMutation.isPending} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50" data-testid="button-create-document"><FileText size={17} className="text-primary" /><span><span className="block">Document</span><span className="block text-[11px] font-normal text-muted-foreground">Collaborative notes and plans</span></span></button><button type="button" onClick={() => openWhiteboard()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-muted" data-testid="button-create-whiteboard"><FilePenLine size={17} className="text-primary" /><span><span className="block">Whiteboard</span><span className="block text-[11px] font-normal text-muted-foreground">Sketch ideas together</span></span></button><button type="button" onClick={() => void createSharedBoard()} disabled={createBoardMutation.isPending || sendChat.isPending || createSpreadsheetMutation.isPending} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50" data-testid="button-create-board"><ClipboardList size={17} className="text-primary" /><span><span className="block">Board</span><span className="block text-[11px] font-normal text-muted-foreground">Track tasks, handoffs, and dates</span></span></button><button type="button" onClick={() => void createSharedSpreadsheet()} disabled={createSpreadsheetMutation.isPending || sendChat.isPending} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50" data-testid="button-create-spreadsheet"><FileSpreadsheet size={17} className="text-primary" /><span><span className="block">Spreadsheet</span><span className="block text-[11px] font-normal text-muted-foreground">A shared worksheet for tryout notes</span></span></button></div>}
         {emojiOpen && <InterviewerChatEmojiPicker
           dark={theme === "dark"}
           customEmojis={customEmojiItems}
           customEmojiLoadFailed={customEmojisQuery.isError}
           onRetryCustomEmojis={() => { void customEmojisQuery.refetch(); }}
           onSelect={value => { insertAtCursor(value); setEmojiOpen(false); }}
         />}
           {voiceMenuOpen && !isRecording && !isDictating && <div className="absolute bottom-[calc(100%+10px)] right-8 z-30 w-60 rounded-2xl border border-border bg-card p-1.5 text-card-foreground shadow-xl" data-testid="voice-mode-menu"><button type="button" onClick={startDictation} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-muted" data-testid="button-start-dictation"><Type size={16} className="text-primary" /><span><span className="block">Dictate text</span><span className="block text-[11px] font-normal text-muted-foreground">Speak into the message box</span></span></button><button type="button" onClick={() => { setVoiceMenuOpen(false); void startVoiceRecording(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-muted" data-testid="button-start-audio-recording"><Mic size={16} className="text-primary" /><span><span className="block">Record audio</span><span className="block text-[11px] font-normal text-muted-foreground">Send your voice as an audio file</span></span></button></div>}
          <div className="chat-composer-shell rounded-[22px] border border-[#cadbdf] bg-[#eef5ff] px-2 py-2 shadow-sm transition focus-within:border-[#8bbfc5] focus-within:shadow-[0_0_0_3px_rgba(22,134,154,0.1)]">
           <div className="flex items-end gap-1.5">
              <button type="button" onClick={() => { setComposerMenuOpen(open => !open); setCreateMenuOpen(false); setEmojiOpen(false); setMentionOpen(false); }} aria-label="More message options" aria-expanded={composerMenuOpen || createMenuOpen} data-testid="button-chat-more" className="chat-composer-control flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#52666e] transition hover:bg-white hover:text-[#16869a]"><Plus size={20} /></button>
             <div className="min-w-0 flex-1">
                 <textarea
                   ref={chatMessageInputRef}
                   value={message}
                   onChange={event => updateMentionState(event.target.value)}
                   onKeyDown={handleChatInputKeyDown}
                   aria-autocomplete="list"
                   aria-controls={mentionOpen ? "chat-mention-listbox" : undefined}
                   aria-expanded={mentionOpen}
                   aria-activedescendant={mentionOpen && filteredMentionPeople.length ? `chat-mention-option-${selectedMentionIndex}` : undefined}
                   data-testid="input-interviewer-chat"
                   rows={1}
                   className="max-h-28 min-h-9 w-full resize-y bg-transparent px-2 py-2 text-sm text-[#183a4b] outline-none placeholder:text-[#809196]"
                   placeholder={replyingTo ? "Write a reply..." : conversationPeer ? `Message ${conversationPeer} or type @ to mention` : "Message the team or type @ to mention"}
                 />
                {formattingOpen && <div className="chat-composer-formatting flex items-center gap-1 border-t border-[#d6e4ed] px-1 pt-1.5"><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => applyFormatting("**")} aria-label="Bold" className="chat-composer-control h-7 w-7 rounded-md text-sm font-bold text-[#52666e] hover:bg-white">B</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => applyFormatting("_")} aria-label="Italic" className="chat-composer-control h-7 w-7 rounded-md text-sm italic text-[#52666e] hover:bg-white">I</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => applyFormatting("`")} aria-label="Code" className="chat-composer-control h-7 w-7 rounded-md font-mono text-xs text-[#52666e] hover:bg-white">&lt;/&gt;</button><span className="ml-1 text-[11px] text-[#819196]">Markdown formatting is supported</span></div>}
             </div>
             <div className="flex shrink-0 items-center gap-0.5 pb-0.5">
                <button type="button" onClick={() => { setFormattingOpen(open => !open); setEmojiOpen(false); setComposerMenuOpen(false); }} aria-label="Formatting options" aria-expanded={formattingOpen} data-testid="button-chat-formatting" className={`chat-composer-control flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold transition hover:bg-white ${formattingOpen ? "is-active bg-white text-[#16869a]" : "text-[#52666e]"}`}>A</button>
                <button type="button" onClick={() => { setEmojiOpen(open => !open); setPickerFor(null); setFormattingOpen(false); setComposerMenuOpen(false); }} aria-label="Insert emoji" aria-expanded={emojiOpen} data-testid="button-chat-emoji" className={`chat-composer-control flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-white ${emojiOpen ? "is-active bg-white text-[#16869a]" : "text-[#52666e]"}`}><Smile size={18} /></button>
                <button type="button" onClick={() => chatFileInputRef.current?.click()} title="Attach files" aria-label="Attach files" data-testid="button-attach-chat" className="chat-composer-control flex h-8 w-8 items-center justify-center rounded-md text-[#52666e] transition hover:bg-white hover:text-[#16869a]"><Paperclip size={17} /></button>
               <button type="button" onClick={() => { if (isRecording) stopVoiceRecording(); else if (isDictating) stopDictation(); else { setVoiceMenuOpen(open => !open); setEmojiOpen(false); setFormattingOpen(false); setComposerMenuOpen(false); } }} aria-label={isRecording ? "Stop recording" : isDictating ? "Stop dictation" : "Choose voice input mode"} aria-expanded={voiceMenuOpen} data-testid="button-chat-mic" className={`chat-composer-control flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-white ${isRecording || isDictating ? "text-[#b34a42]" : "text-[#52666e] hover:text-[#16869a]"}`}><Mic size={17} /></button>
             </div>
              <button disabled={(!message.trim() && !chatFiles.length) || sendChat.isPending || ask.isPending || chatUploading || isRecording || isDictating} type="submit" aria-label="Send message" data-testid="button-send-interviewer-chat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#16869a] text-white transition hover:bg-[#106d7a] disabled:opacity-40">{chatUploading ? <span className="text-[10px]">…</span> : <Send size={16} />}</button>
           </div>
         </div>
       </div>
       <input ref={chatFileInputRef} type="file" accept={CHAT_FILE_ACCEPT} multiple className="sr-only" data-testid="input-chat-image" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) void attachChatFiles(files); }} />
       {chatImageError && <p className="text-xs text-[#ad4b43]" data-testid="chat-image-error">{chatImageError}</p>}
        {chatError && <p className="text-xs text-[#ad4b43]" data-testid="chat-error">{chatError}</p>}
     </form>
      {whiteboardOpen && (activeWhiteboardId && !activeWhiteboard
        ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#183a4b]/40 p-4" role="status" data-testid="status-loading-collaboration"><div className="rounded-2xl bg-white px-6 py-5 text-sm font-semibold text-[#385762] shadow-2xl">Loading shared workspace…</div></div>
        : activeWhiteboard && isDocumentData(activeWhiteboard.data)
          ? <DocumentEditor document={activeWhiteboard} activeInterviewer={activeInterviewer} saving={false} error={whiteboardError} onClose={() => { setWhiteboardOpen(false); setActiveWhiteboardId(null); }} onTitleSave={() => { void qc.invalidateQueries({ queryKey: getListInterviewWhiteboardsQueryKey(chatParams) }); }} />
           : <WhiteboardEditor whiteboard={activeWhiteboard} saving={createWhiteboard.isPending || updateWhiteboard.isPending || sendChat.isPending} error={whiteboardError} onClose={() => { setWhiteboardOpen(false); setActiveWhiteboardId(null); }} onSave={(title, data, share) => { void saveWhiteboard(title, data, share); }} />)}
       {boardOpen && activeBoardId && <BoardEditor boardId={activeBoardId} assignees={mentionLabels} onClose={() => { setBoardOpen(false); setActiveBoardId(null); }} />}
  </section>;
}
function Queue() {
  const { settings } = useWorkspaceSettings();
  const refreshMs = settings.autoRefresh ? settings.refreshMs : false;
  const queue = useGetQueue({ query: { queryKey: getGetQueueQueryKey(), refetchInterval: refreshMs } });
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const advance = useAdvanceQueue();
  const callback = useCallbackQueue();
  const finishedParams = useMemo(() => ({ interviewStatus: "completed", sort: "rank" }), []);
  const finished = useListApplicants(finishedParams, { query: { queryKey: getListApplicantsQueryKey(finishedParams) } });
  const reorder = useReorderQueue();
  const updateApplicant = useUpdateApplicant();
  const updateSettings = useUpdateQueueSettings();
  const resetQueue = useResetQueue();
  const qc = useQueryClient();
  const [board, setBoard] = useState<Applicant[]>([]);
  const [drag, setDrag] = useState<string | null>(null);
  const boardParams = useMemo(() => ({ sort: "queue" }), []);
  const remaining = useListApplicants(boardParams, { query: { queryKey: getListApplicantsQueryKey(boardParams), refetchInterval: refreshMs } });
  const [labels, setLabels] = useState<string[]>([]);
  const labelsDirty = useRef(false);
  const boardDirty = useRef(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  useEffect(() => {
    if (!resetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setResetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetOpen]);
  useEffect(() => {
    if (!queue.data) return;
    if (!labelsDirty.current) setLabels(queue.data.interviewerLabels);
  }, [queue.data]);
  useEffect(() => {
    if (!remaining.data || boardDirty.current) return;
    setBoard(remaining.data.items.filter(applicant => applicant.interviewStatus !== "completed"));
  }, [remaining.data]);
  if (queue.isLoading) return <><PageHeading eyebrow="Interview bay / live" title="Queue control" /><Skeleton className="h-64" /></>;
  if (queue.isError || !queue.data) return <ErrorState onRetry={() => queue.refetch()} />;
  const q = queue.data;
  const visibleApplicants = session.data?.label
    ? q.currentApplicants.filter(applicant => applicant.interviewer === session.data?.label)
    : [];
  const unassignedApplicant = q.currentApplicants.find(applicant => !applicant.interviewer);
  const boardColumns = [...q.interviewerLabels.map(label => ({ key: label, label, members: board.filter(applicant => (applicant.interviewer ?? "") === label) })), { key: "__unassigned", label: "", members: board.filter(applicant => !q.interviewerLabels.includes(applicant.interviewer ?? "")) }];
  const boardIndex = new Map(board.map((applicant, index) => [applicant.id, index] as const));
  const saveNote = (id: string, note: string, original: string) => {
    if (note !== original) updateApplicant.mutate({ id, data: { notes: note } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }); qc.invalidateQueries({ queryKey: getListApplicantsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() }); } });
  };
  const assignInterviewer = (id: string, interviewer: string) => {
    updateApplicant.mutate({ id, data: { interviewer } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }); qc.invalidateQueries({ queryKey: getListApplicantsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() }); } });
  };
  const finishApplicant = (id: string) => {
    advance.mutate({ data: { applicantId: id } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }); qc.invalidateQueries({ queryKey: getListApplicantsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() }); } });
  };
  const recallApplicant = (id: string, name: string) => {
    if (callback.isPending || !window.confirm(`Call ${name} back? They return to the front of the queue and the big screen will announce it.`)) return;
    callback.mutate({ data: { applicantId: id } }, { onSuccess: () => { { qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }); qc.invalidateQueries({ queryKey: getListApplicantsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() }); } finished.refetch(); } });
  };
  const sendBoardOrder = (list: Applicant[]) => {
    reorder.mutate({ data: { applicantIds: list.map(item => item.id) } }, {
      onSuccess: () => { boardDirty.current = false; qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }); qc.invalidateQueries({ queryKey: getListApplicantsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() }); },
      onError: () => { boardDirty.current = false; },
    });
  };
  const finishBoardDrop = (next: Applicant[], dragged: Applicant, newInterviewer: string) => {
    setBoard(next);
    setDrag(null);
    boardDirty.current = true;
    if ((dragged.interviewer || "") !== (newInterviewer || "")) {
      updateApplicant.mutate({ id: dragged.id, data: { interviewer: newInterviewer } }, {
        onSuccess: () => sendBoardOrder(next),
        onError: () => { boardDirty.current = false; },
      });
    } else {
      sendBoardOrder(next);
    }
  };
  const dropOnCard = (targetId: string, targetLabel: string) => {
    if (!drag || drag === targetId) return;
    const dragged = board.find(item => item.id === drag);
    if (!dragged) { setDrag(null); return; }
    const next = board.filter(item => item.id !== drag);
    const at = next.findIndex(item => item.id === targetId);
    next.splice(at < 0 ? next.length : at, 0, dragged);
    finishBoardDrop(next, dragged, targetLabel);
  };
  const dropOnColumn = (targetLabel: string) => {
    if (!drag) return;
    const dragged = board.find(item => item.id === drag);
    if (!dragged) { setDrag(null); return; }
    const next = board.filter(item => item.id !== drag);
    let at = next.length;
    for (let i = next.length - 1; i >= 0; i--) {
      const member = next[i];
      if (!member) continue;
      const same = targetLabel ? (member.interviewer ?? "") === targetLabel : !q.interviewerLabels.includes(member.interviewer ?? "");
      if (same) { at = i + 1; break; }
    }
    next.splice(at, 0, dragged);
    finishBoardDrop(next, dragged, targetLabel);
  };
  const moveInBoard = (id: string, direction: -1 | 1) => {
    const index = board.findIndex(item => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= board.length) return;
    const next = [...board];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setBoard(next);
    boardDirty.current = true;
    sendBoardOrder(next);
  };
  const saveLabels = () => {
    const clean = [...new Set(labels.map(label => label.trim()).filter(Boolean))];
    if (clean.length) updateSettings.mutate({ data: { interviewerLabels: clean } }, {
      onSuccess: response => {
        labelsDirty.current = false;
        setLabels(response.interviewerLabels);
        qc.invalidateQueries({ queryKey: getGetQueueQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() });
      },
    });
  };
  const resetInterviewProgress = () => {
    setResetConfirm("");
    setResetOpen(true);
  };
  const confirmResetProgress = () => {
    if (resetConfirm !== RESET_CONFIRM_PHRASE || resetQueue.isPending) return;
    setResetOpen(false);
    resetQueue.mutate(undefined, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }); qc.invalidateQueries({ queryKey: getListApplicantsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() }); } });
  };
  return <div className="fade-up">
    <PageHeading eyebrow="Interview bay / live queue" title="Interview workspace" detail={`Showing applicants assigned to ${session.data?.label ?? "your interviewer account"}.`} action={<div className="flex flex-wrap items-center gap-3 text-xs text-[#60757c]"><span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-[#28a47f]" />Live sync every 3 seconds</span><button onClick={resetInterviewProgress} disabled={resetQueue.isPending} data-testid="button-reset-interview-progress" className="flex items-center gap-1.5 rounded-lg border border-[#d7b0ad] px-3 py-2 font-semibold text-[#a14b43] hover:bg-[#fff2f0] disabled:opacity-50"><RefreshCw size={13} />{resetQueue.isPending ? "Resetting..." : "Reset progress"}</button></div>} />
    <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#dce5e5] bg-white p-4">
      <div className="flex items-center gap-2 rounded-xl border border-[#dce9e8] bg-[#f7faf9] px-3 py-2 text-xs text-[#527079]"><ShieldCheck size={15} className="text-[#16869a]" />Signed in as <strong>{session.data?.label ?? "interviewer"}</strong></div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <section className="relative overflow-hidden rounded-3xl bg-[#172a3a] p-7 text-white">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full border border-[#f8c84a]/20" />
        <div className="relative">
          <div className="flex items-center justify-between"><Badge tone="yellow">Interviewing now</Badge><span className="mono text-xs text-[#89a4ab]">{visibleApplicants.length} assigned to you / {q.currentApplicants.length} active</span></div>
          <div className={`mt-8 grid gap-4 ${visibleApplicants.length > 1 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
            {visibleApplicants.length ? visibleApplicants.map((applicant, index) => <InterviewApplicantCard key={applicant.id} applicant={applicant} index={index} interviewerLabels={q.interviewerLabels} onAssign={assignInterviewer} onSaveNote={saveNote} onFinish={finishApplicant} onUpdate={data => updateApplicant.mutate({ id: applicant.id, data }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetQueueQueryKey() }); qc.invalidateQueries({ queryKey: getListApplicantsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() }); } })} />) : <div className="py-10 text-[#acc2c7]"><p>No applicant is assigned to your interviewer account right now.</p>{session.data?.label && unassignedApplicant && <button onClick={() => assignInterviewer(unassignedApplicant.id, session.data?.label ?? "")} disabled={updateApplicant.isPending} data-testid="button-claim-next-applicant" className="mt-4 rounded-lg bg-[#f8c84a] px-4 py-2.5 text-xs font-bold text-[#182232] disabled:opacity-50">Claim next available applicant</button>}</div>}
          </div>
        </div>
      </section>
      <InterviewChatPanel applicantIds={visibleApplicants.map(applicant => applicant.id)} />
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      <Section title="Queue progress" kicker="Applicants advance independently">
        <div className="flex items-end justify-between"><div><p className="mono text-5xl text-[#183a4b]">{q.remainingCount}</p><p className="mt-1 text-sm text-[#718189]">remaining applicants</p></div><div className="text-right"><p className="mono text-2xl text-[#16869a]">{q.completedCount}</p><p className="text-xs text-[#718189]">completed</p></div></div>
        <div className="mt-6 h-3 overflow-hidden rounded-full bg-[#e8eeee]"><div className="h-full rounded-full bg-[#16869a]" style={{ width: `${(q.completedCount / Math.max(q.completedCount + q.remainingCount, 1)) * 100}%` }} /></div>
        <div className="mt-6 border-t border-[#edf1f1] pt-5"><p className="mono text-[10px] uppercase tracking-[.18em] text-[#16869a]">Up next</p>{q.nextApplicants.length ? q.nextApplicants.map(applicant => <div key={applicant.id} className="mt-3 flex items-center gap-3" data-testid={`next-applicant-${applicant.id}`}><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e5f3f1] text-xs font-bold text-[#16869a]">{applicant.name.slice(0, 1)}</div><div><p className="text-sm font-semibold">{applicant.name}</p><p className="text-xs text-[#7c8c91]">Grade {applicant.grade} · score {applicant.aiScore < 0 ? "invalid" : applicant.aiScore.toFixed(1)}</p></div></div>) : <p className="mt-3 text-sm text-[#7c8c91]">Queue is empty.</p>}</div>
      </Section>
      <Section title="Corresponding interviewers" kicker="Add as many interviewers as you need; these labels also appear on the public display.">
        <div id="interviewer-settings" />
        <div className="space-y-2">
          {labels.map((label, index) => <div key={`label-row-${index}`} className="flex items-center gap-2"><span className="mono w-6 text-xs text-[#16869a]">{String(index + 1).padStart(2, "0")}</span><input value={label} onChange={event => { labelsDirty.current = true; setLabels(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item)); }} className="h-10 min-w-0 flex-1 rounded-lg border border-[#d5e0e0] px-3 text-sm outline-none focus:border-[#16869a]" /><button disabled={labels.length <= 1} onClick={() => { labelsDirty.current = true; setLabels(current => current.filter((_, itemIndex) => itemIndex !== index)); }} className="rounded-lg px-2 text-xs text-[#bd5047] disabled:opacity-30">Remove</button></div>)}
          <div className="flex flex-wrap gap-2 pt-2"><button onClick={() => { labelsDirty.current = true; setLabels(current => [...current, `Interviewer ${current.length + 1}`]); }} className="rounded-lg border border-[#cbd9da] px-3 py-2 text-xs font-semibold text-[#385762]">+ Add interviewer</button><button onClick={saveLabels} disabled={updateSettings.isPending} data-testid="button-save-interviewer-labels" className="rounded-lg bg-[#16869a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{updateSettings.isPending ? "Saving..." : "Save labels"}</button></div>
        </div>
      </Section>
    </div>
    <section className="mt-5 rounded-2xl border border-[#dce5e5] bg-white p-5" data-testid="group-board"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Interview groups</h2><p className="mt-1 text-xs text-[#7c8c91]">Drag applicants between interviewers to assign them. Drag within or across columns, or use ↑↓, to set the overall interview order. Numbers show queue position.</p></div><UsersRound size={20} className="text-[#16869a]" /></div>{remaining.isLoading ? <div className="mt-4 space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16" />)}</div> : remaining.isError ? <ErrorState compact onRetry={() => remaining.refetch()} /> : <div className="mt-4 grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">{boardColumns.map(column => <div key={column.key} onDragOver={event => event.preventDefault()} onDrop={() => dropOnColumn(column.label)} data-testid={`group-column-${column.label.toLowerCase().replaceAll(" ", "-") || "unassigned"}`} className="min-h-[140px] rounded-xl border border-[#dce5e5] bg-[#f7faf9] p-2"><div className="flex items-center justify-between px-2 py-1"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#4f6870]">{column.label || "Unassigned"}</p><span className="mono text-xs text-[#809196]">{column.members.length}</span></div>{column.members.length ? column.members.map(applicant => { const position = (boardIndex.get(applicant.id) ?? 0) + 1; return <div key={applicant.id} draggable onDragStart={() => setDrag(applicant.id)} onDragOver={event => event.preventDefault()} onDrop={() => dropOnCard(applicant.id, column.label)} data-testid={`group-card-${applicant.id}`} className="mb-2 flex cursor-grab items-center gap-2 rounded-xl border border-[#d7e4e3] bg-white px-3 py-2.5 text-left shadow-sm"><GripVertical size={14} className="shrink-0 text-[#b4c1c4]" /><span className="mono w-6 shrink-0 text-xs text-[#16869a]">{String(position).padStart(2, "0")}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{applicant.name}</span><span className="block text-[10px] text-[#819196]">Grade {applicant.grade}{position <= q.interviewerLabels.length ? " · up now" : ""}</span></span><button onClick={() => moveInBoard(applicant.id, -1)} aria-label={`Move ${applicant.name} earlier`} data-testid={`button-group-up-${applicant.id}`} className="shrink-0 text-[#779096] hover:text-[#16869a]">↑</button><button onClick={() => moveInBoard(applicant.id, 1)} aria-label={`Move ${applicant.name} later`} data-testid={`button-group-down-${applicant.id}`} className="shrink-0 text-[#779096] hover:text-[#16869a]">↓</button></div>; }) : <p className="px-2 py-6 text-center text-xs text-[#819196]">Drop applicants here</p>}</div>)}</div>}</section>
    <section className="mt-5 rounded-2xl border border-[#dce5e5] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Finished — call back</h2><p className="mt-1 text-xs text-[#7c8c91]">Finished someone by accident? Send them back to the front. The big screen and audio will announce that they aren&apos;t done yet.</p></div><PhoneCall size={20} className="text-[#16869a]" /></div>{finished.isLoading ? <div className="mt-4 space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div> : finished.data && finished.data.total > 0 ? <div className="mt-4 grid gap-2 md:grid-cols-2">{finished.data.items.map(applicant => <div key={applicant.id} className="flex items-center gap-3 rounded-xl border border-[#e1e9e8] p-3" data-testid={`finished-applicant-${applicant.id}`}><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e5f3f1] text-xs font-bold text-[#16869a]">{applicant.name.slice(0, 1)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{applicant.name}</p><p className="text-xs text-[#7c8c91]">Grade {applicant.grade}</p></div><button onClick={() => recallApplicant(applicant.id, applicant.name)} disabled={callback.isPending} data-testid={`button-recall-${applicant.id}`} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#f8c84a] px-3 py-2 text-xs font-bold text-[#182232] disabled:opacity-50"><PhoneCall size={13} /> Call back</button></div>)}</div> : <p className="mt-4 text-sm text-[#7c8c91]">Nobody finished yet.</p>}{callback.isError && <p className="mt-2 text-xs text-[#ad4b43]">Callback failed. Try again.</p>}</section>
    {resetOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#112433]/45 p-4" onClick={() => setResetOpen(false)} data-testid="reset-dialog"><div onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Confirm reset interview progress" className="w-full max-w-md rounded-2xl border border-[#dce5e5] bg-white p-6 shadow-2xl"><h2 className="text-lg font-semibold tracking-[-.02em] text-[#182232]">Reset interview progress?</h2><p className="mt-2 text-sm leading-6 text-[#52666e]">This takes every applicant back to the start of the queue. Here is exactly what happens:</p><ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[#52666e]"><li>All <strong>completed</strong> interviews move back to <strong>queued</strong> (completed count returns to 0).</li><li>Queue order is rebuilt and active recall flags are cleared.</li><li>The big screen switches back to calling the front of the queue.</li></ul><p className="mt-3 text-sm leading-6 text-[#52666e]">Preserved: applicant data, files, notes, decisions, and lanes.</p><label className="mt-4 block text-xs font-semibold text-[#63747c]">Type <code className="rounded bg-[#edf4f3] px-1.5 py-0.5 font-mono text-[11px] text-[#315a61]">{RESET_CONFIRM_PHRASE}</code> to confirm<input value={resetConfirm} onChange={event => setResetConfirm(event.target.value)} autoFocus data-testid="input-reset-confirm" placeholder={RESET_CONFIRM_PHRASE} className="mt-1.5 h-11 w-full rounded-xl border border-[#d5e0e0] px-3 text-sm outline-none focus:border-[#b34a42]" /></label><div className="mt-5 flex justify-end gap-2"><button onClick={() => setResetOpen(false)} className="rounded-xl border border-[#d5e0e0] px-4 py-2.5 text-sm font-semibold text-[#52666e] hover:bg-[#f1f6f5]">Cancel</button><button onClick={confirmResetProgress} disabled={resetConfirm !== RESET_CONFIRM_PHRASE || resetQueue.isPending} data-testid="button-confirm-reset" className="rounded-xl bg-[#b34a42] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{resetQueue.isPending ? "Resetting..." : "Reset progress"}</button></div></div></div>}
  </div>;
}

const interviewDecisions = ["Undecided", "Strong Yes", "Yes", "Maybe", "No", "Strong No"];

function readableTranscript(raw: string | null | undefined): Array<{ question: string; type: string; typeLabel: string; answer: string; options: string[]; selected: string[] }> {
  if (!raw?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.map((entry, index) => {
      if (!entry || typeof entry !== "object") return { question: `Response ${index + 1}`, type: "unknown", typeLabel: "Response", answer: String(entry), options: [], selected: [String(entry)] };
      const record = entry as Record<string, unknown>;
      const answer = record.answer ?? record.response ?? record.value ?? record.text ?? "";
      const type = String(record.type ?? "text").toLowerCase();
      const typeLabel = type === "multi" ? "Choose all that apply" : type === "choice" ? "Choose one" : type === "text" ? "Written response" : type;
      const options = Array.isArray(record.options) ? record.options.map(String) : [];
      const rawAnswer = record.raw ?? answer;
      return {
        question: String(record.question ?? record.prompt ?? record.label ?? `Response ${index + 1}`),
        type,
        typeLabel,
        answer: typeof answer === "string" ? answer : JSON.stringify(answer, null, 2),
        options,
        selected: Array.isArray(rawAnswer) ? rawAnswer.map(String) : [String(rawAnswer)],
      };
    });
  } catch {
    return [{ question: "Submitted responses", type: "unknown", typeLabel: "Response", answer: raw, options: [], selected: [raw] }];
  }
}

function InterviewApplicantCard({ applicant, index, interviewerLabels, onAssign, onSaveNote, onFinish, onUpdate }: {
  applicant: QueueApplicant;
  index: number;
  interviewerLabels: string[];
  onAssign: (id: string, interviewer: string) => void;
  onSaveNote: (id: string, note: string, original: string) => void;
  onFinish: (id: string) => void;
  onUpdate: (data: ApplicantUpdate) => void;
}) {
  const detail = useGetApplicant(applicant.id, { query: { queryKey: getGetApplicantQueryKey(applicant.id), refetchInterval: 5000 } });
  const [notes, setNotes] = useState(applicant.notes);
  const notesEditing = useRef(false);
  useEffect(() => { if (!notesEditing.current) setNotes(detail.data?.notes ?? applicant.notes); }, [detail.data?.notes, applicant.notes]);
  const a = detail.data;
  const transcript = readableTranscript(a?.transcript);
  const looksMalformed = Boolean(a && (/https?:\/\//i.test(a.name) || /@/.test(a.name) || a.name.length > 60));
  const displayName = looksMalformed ? "Record needs review" : a?.name ?? applicant.name;
  return <article className="rounded-2xl border border-[#365968] bg-[#1d3545] p-5" data-testid={`current-applicant-${applicant.id}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="mono text-[10px] uppercase tracking-[.2em] text-[#7f9da6]">Applicant {index + 1}</p><h2 className="mt-2 break-words text-2xl font-semibold tracking-[-.05em]">{displayName}</h2><p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#acc2c7]"><span>Grade {a?.grade ?? applicant.grade}</span><span>·</span><span>{applicant.aiScore < 0 ? "invalid score" : `${applicant.aiScore.toFixed(1)} AI score`}</span></p>{looksMalformed && <p className="mt-2 break-all text-xs text-[#d2e1e3]">Imported name: {a?.name}</p>}{looksMalformed && <p className="mt-2 text-xs font-semibold text-[#f8c84a]">This applicant record looks malformed. Verify it before making a decision.</p>}</div>
      <div className="flex shrink-0 gap-2"><button onClick={() => onUpdate({ callbackRequested: !applicant.callbackRequested })} data-testid={`button-callback-${applicant.id}`} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${applicant.callbackRequested ? "border-[#f8c84a] bg-[#fff3cf] text-[#805c08]" : "border-[#668795] text-[#d2e1e3]"}`}><PhoneCall size={13} />{applicant.callbackRequested ? "Callback requested" : "Request callback"}</button><button onClick={() => onFinish(applicant.id)} disabled={detail.isLoading} data-testid={`button-finish-applicant-${applicant.id}`} className="rounded-lg bg-[#f8c84a] px-3 py-2 text-xs font-bold text-[#182232] disabled:opacity-50">Finish</button></div>
    </div>
    {detail.isLoading ? <div className="mt-5 space-y-2"><Skeleton className="h-10" /><Skeleton className="h-24" /></div> : a && <details open className="mt-5 rounded-xl border border-[#486b77] bg-[#162d3d] p-4"><summary className="cursor-pointer text-xs font-semibold uppercase tracking-[.12em] text-[#d2e1e3]">Full applicant file</summary>
      <div className="mt-4 grid gap-4 text-sm text-[#d2e1e3]">
        <div className="grid gap-2 sm:grid-cols-2"><p className="flex min-w-0 items-start gap-2 break-all"><Mail size={14} className="mt-0.5 shrink-0 text-[#f8c84a]" />{a.email || "No email provided"}</p><p className="text-[#acc2c7]">Interview status: <strong className="text-white">{a.interviewStatus}</strong></p></div>
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#f8c84a]">Application responses</p><div className="grid gap-2 sm:grid-cols-3"><div className="rounded-lg bg-[#1d3545] p-3"><p className="text-[10px] uppercase text-[#7f9da6]">Robotics experience</p><p className="mt-1">{a.roboticsExperience || "Not provided"}</p></div><div className="rounded-lg bg-[#1d3545] p-3"><p className="text-[10px] uppercase text-[#7f9da6]">10-hour commitment</p><p className="mt-1">{a.commit10Hours || "Not provided"}</p></div><div className="rounded-lg bg-[#1d3545] p-3"><p className="text-[10px] uppercase text-[#7f9da6]">Parent volunteer</p><p className="mt-1">{a.parentVolunteer || "Not provided"}</p></div></div></div>
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#f8c84a]">Questions, types, choices, and submitted answers</p>{transcript.length ? <div className="space-y-3">{transcript.map((item, responseIndex) => <div key={`${item.question}-${responseIndex}`} className="rounded-lg bg-[#1d3545] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><p className="min-w-0 flex-1 break-words text-sm font-semibold text-white">{item.question}</p><span className="shrink-0 rounded-full border border-[#5d8790] px-2 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#a8c8cb]">{item.typeLabel}</span></div>{item.options.length > 0 && <div className="mt-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#7f9da6]">Choices</p><div className="mt-2 flex flex-wrap gap-2">{item.options.map(option => <span key={option} className={`rounded-md border px-2 py-1 text-xs ${item.selected.includes(option) ? "border-[#51d2ad] bg-[#204f50] text-[#d8fff0]" : "border-[#486b77] text-[#a9c0c4]"}`}>{item.selected.includes(option) ? "✓ " : ""}{option}</span>)}</div></div>}<p className="mt-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#7f9da6]">Submitted answer</p><p className="mt-1 whitespace-pre-wrap break-words leading-6 text-[#d2e1e3]">{item.answer || "No answer provided."}</p></div>)}</div> : <p className="leading-6 text-[#d2e1e3]">No transcript or additional responses were provided.</p>}</div>
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#f8c84a]">AI readout</p><p className="leading-6">{a.aiSummary || "No AI summary available."}</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><p><strong className="text-[#51d2ad]">Strengths:</strong> {a.aiStrengths || "Not listed"}</p><p><strong className="text-[#ff9b8f]">Concerns:</strong> {a.aiConcerns || "Not listed"}</p></div></div>
      </div>
    </details>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-xs font-semibold text-[#b6cbd0]">Corresponding interviewer<select value={applicant.interviewer} onChange={event => onAssign(applicant.id, event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#486b77] bg-[#162d3d] px-3 text-sm text-white"><option value="">Unassigned</option>{interviewerLabels.map(label => <option key={label} value={label}>{label}</option>)}</select></label><label className="block text-xs font-semibold text-[#b6cbd0]">Interview decision<select value={applicant.interviewDecision} onChange={event => onUpdate({ interviewDecision: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#486b77] bg-[#162d3d] px-3 text-sm font-semibold text-white">{interviewDecisions.map(decision => <option key={decision} value={decision}>{decision}</option>)}</select></label></div>
    <label className="mt-4 block text-xs font-semibold text-[#b6cbd0]">Private interviewer notes<textarea value={notes} onChange={event => setNotes(event.target.value)} onFocus={() => { notesEditing.current = true; }} onBlur={() => { notesEditing.current = false; onSaveNote(applicant.id, notes, detail.data?.notes ?? applicant.notes); }} placeholder="Capture interview signal..." className="mt-1 min-h-[82px] w-full resize-y rounded-lg border border-[#486b77] bg-[#162d3d] p-3 text-sm font-normal text-white outline-none placeholder:text-[#74919a] focus:border-[#f8c84a]" /></label>
  </article>;
}

function DisplayGallery() {
  return <div className="mx-auto mt-6 grid max-h-[24vh] max-w-6xl grid-cols-2 gap-3 overflow-hidden text-left md:grid-cols-6">
    {officialDisplayImages.slice(1).map((src, index) => <img key={src} src={src} alt={`Official Wolverines team and portfolio image ${index + 1}`} className={`${index === 0 ? "col-span-2 row-span-2 aspect-[4/3] md:col-span-2 md:row-span-2" : "aspect-[4/3]"} w-full rounded-2xl border border-[#39616d] object-cover opacity-80 transition-opacity hover:opacity-100`} />)}
  </div>;
}

function Display() {
  const display = useGetDisplayState({ query: { queryKey: getGetDisplayStateQueryKey(), refetchInterval: 3000 } }); const lastUpdate = useRef(""); const audioRef = useRef<HTMLAudioElement>(null);
  const fullscreen = useFullscreen();
  // ?preview=1 turns this page into the big-screen tab's preview: query
  // params override the live text through the exact same render path (so the
  // preview is pixel-identical), and every audio/command behavior is disabled
  // so the preview never speaks, warms voices, or reboots.
  const previewParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const isPreview = previewParams.get("preview") === "1";
  // The big screen has no audio buttons (they live on the interviewers'
  // Queue screen). It warms the selected on-device voice silently and speaks
  // every queue change: server voice first, then the selected engine, then
  // the browser voice.
  useEffect(() => {
    if (isPreview) return;
    void warmEngine(getSelectedEngine()).catch(() => { /* announcements fall back on demand */ });
  }, [isPreview]);
  const commands = useGetBroadcastCommands({ query: { queryKey: getGetBroadcastCommandsQueryKey(), refetchInterval: 3000, enabled: !isPreview } });
  useEffect(() => {
    if (isPreview) return;
    const items = commands.data?.items ?? [];
    if (!items.length) return;
    // Silent remote control from the interviewers' Queue screen: speak the
    // test phrase, switch the voice, or wipe cached voices and reboot.
    // Executed ids persist in localStorage so a command never replays.
    void (async () => {
      let done: unknown;
      try {
        done = JSON.parse(window.localStorage.getItem("display-commands-done") ?? "[]");
      } catch {
        done = [];
      }
      const seen = new Set(Array.isArray(done) ? done.filter((id): id is string => typeof id === "string") : []);
      const remember = () => {
        try {
          window.localStorage.setItem("display-commands-done", JSON.stringify([...seen].slice(-50)));
        } catch {
          // Ephemeral session — commands may replay after a reload.
        }
      };
      for (const cmd of items) {
        if (seen.has(cmd.id)) continue;
        seen.add(cmd.id);
        remember();
        if (cmd.kind === "audio-say") {
          // Custom audio-only announcement: spoken as-is, display text untouched.
          const said = cmd.message.trim().slice(0, 500);
          if (said) {
            const engine = getSelectedEngine();
            try {
              await speakWithEngine(engine, said);
            } catch {
              speakSystemVoice(said);
            }
          }
        } else if (cmd.kind === "audio-engine" || cmd.kind === "audio-test") {
          const engine = (["kokoro", "kitten", "system"] as const).find((id) => id === cmd.message) ?? getSelectedEngine();
          setSelectedEngine(engine);
          if (cmd.kind === "audio-test") {
            try {
              await speakWithEngine(engine, KOKORO_TEST_PHRASE);
            } catch {
              speakSystemVoice(KOKORO_TEST_PHRASE);
            }
          } else {
            void warmEngine(engine).catch(() => { /* announcements fall back on demand */ });
          }
        } else if (cmd.kind === "audio-reset") {
          try {
            await clearLocalTtsCaches();
          } catch {
            // The reload below drops in-memory copies regardless.
          }
          window.location.reload();
          return;
        }
      }
    })();
  }, [commands.data, isPreview]);
  useEffect(() => {
    if (isPreview) return;
    if (display.data && display.data.updatedAt !== lastUpdate.current) {
      if (lastUpdate.current) {
        const d = display.data as DisplayState;
        const spoken = (d.announcement ?? "").trim() || `${d.headline ?? ""}. ${d.subheadline ?? ""}`.trim();
        const audio = audioRef.current;
        // The announce switch mutes auto-announcements (manual tests always speak).
        if (audio && spoken && d.announce !== false) {
          let spoke = false;
          const speakOnce = () => {
            if (!spoke) {
              spoke = true;
              const engine = getSelectedEngine();
              void speakWithEngine(engine, spoken).catch(() => speakSystemVoice(spoken));
            }
          };
          audio.onerror = () => speakOnce();
          // Cache-buster: without it, repeat finishes reuse the same URL and
          // the browser never refetches, so nothing speaks a second time.
          audio.src = `${import.meta.env.BASE_URL}api/display/announcement?t=${Date.now()}`;
          audio.play().catch(() => speakOnce());
        }
      }
      lastUpdate.current = display.data.updatedAt;
    }
  }, [display.data, isPreview]);
  if (display.isLoading) return <div className="min-h-[100dvh] bg-[#0d1b28] p-12 text-white"><Skeleton className="h-10 w-48" /></div>; if (display.isError || !display.data) return <div className="flex min-h-[100dvh] items-center justify-center bg-[#0d1b28] text-white"><ErrorState compact onRetry={() => display.refetch()} /></div>;
  const liveDisplay = display.data as DisplayState; const previewHeadline = isPreview ? (previewParams.get("headline") || "") : ""; const previewSubheadline = isPreview ? (previewParams.get("subheadline") || "") : ""; const d = isPreview ? { ...liveDisplay, headline: previewHeadline || liveDisplay.headline, subheadline: previewSubheadline || liveDisplay.subheadline } : liveDisplay; const applicants = ((isPreview && previewParams.get("showNames") === "0" ? [] : liveDisplay.currentApplicants) ?? []); const displayGridCols = applicants.length <= 1 ? "" : applicants.length === 2 ? "sm:grid-cols-2" : applicants.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"; const displayGridWidth = applicants.length >= 4 ? "max-w-6xl" : "max-w-4xl";
  return <main className={`${fullscreen.isFullscreen ? "fixed inset-0 z-50 w-screen" : ""} display-grid noise relative flex h-[100dvh] flex-col overflow-hidden bg-[#0d1b28] text-white`} data-testid="display-screen"><div className="scanline absolute left-0 top-[31%] h-px w-full opacity-50" /><header className="relative flex shrink-0 items-center justify-between p-5 md:p-7"><Logo dark /><div className="flex items-center gap-2"><div className="hidden h-10 w-28 overflow-hidden rounded-xl border border-[#39616d] opacity-80 sm:block"><img src={officialDisplayImages[0]} alt="Wolverines team" className="h-full w-full object-cover" /></div><FullscreenButton active={fullscreen.isFullscreen} onClick={fullscreen.toggleFullscreen} dark /><span className="hidden h-2 w-2 animate-pulse rounded-full bg-[#51d2ad] sm:block" /></div></header><section className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-7 py-4 text-center md:px-16"><p className="mono text-xs uppercase tracking-[.32em] text-[#f8c84a]">{d.mode || "Live interview queue"}</p><h1 className="mt-4 text-[clamp(2.4rem,6.5vw,6.8rem)] font-semibold leading-[.9] tracking-[-.07em]">{d.headline || "Please come to your corresponding interviewer"}</h1><p className="mx-auto mt-3 max-w-2xl text-[clamp(1rem,2vw,1.45rem)] text-[#9db6bd]">{d.subheadline || "Your Wolverines interview team is ready for you."}</p>{applicants.length > 0 && <div className={`mx-auto mt-8 grid max-h-[45vh] w-full ${displayGridWidth} gap-5 overflow-hidden ${displayGridCols}`}>{applicants.map((applicant) => <div key={applicant.id} className="relative overflow-hidden rounded-3xl border border-[#39616d] bg-[#142c3b]/80 px-6 py-7 text-left backdrop-blur-sm" data-testid={`display-applicant-${applicant.id}`}><span className="mono text-[10px] uppercase tracking-[.25em] text-[#6f9ba2]">Corresponding interviewer</span><p className={`mt-4 break-words font-semibold tracking-[-.04em] ${applicants.length >= 4 ? "text-2xl md:text-3xl" : "text-3xl md:text-5xl"}`}>{applicant.name}</p><p className="mt-2 text-sm text-[#9db6bd]">Grade {applicant.grade} <span className="mx-2 text-[#4a7180]">/</span> {applicant.lane}</p><div className="absolute bottom-0 left-0 h-1 w-full bg-[#f8c84a]" /></div>)}</div>}{!applicants.length && <DisplayGallery />}</section><footer className="flex shrink-0 items-end justify-between p-5 md:p-7"><span className="mono text-[10px] uppercase tracking-[.2em] text-[#66848d]">Wolverines / Team 23442 · All Claws on Deck! · PLMS · Sammamish, Washington · Spencer & Tesla leagues</span><span className="mono text-[10px] text-[#66848d]">{new Date(d.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></footer>{!isPreview && <audio ref={audioRef} preload="none" data-testid="display-announcement-audio" />}</main>;
}

function ImageStudio() {
  const generate = useGenerateAssistantImage();
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [image, setImage] = useState<{ imageUrl: string; prompt: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || generate.isPending) return;
    setLoaded(false);
    generate.mutate({ data: { prompt: value, size } }, {
      onSuccess: response => setImage({ imageUrl: response.imageUrl, prompt: response.prompt }),
    });
  };
  return <Section title="Image studio" kicker="Keyless AI images for posters and the big screen" className="order-4"><form onSubmit={submit} className="space-y-2"><textarea value={prompt} onChange={event => setPrompt(event.target.value)} rows={3} maxLength={500} placeholder="A Wolverines robotics team poster, navy and gold..." data-testid="input-image-prompt" className="w-full resize-y rounded-xl border border-[#d5e0e0] p-3 text-sm outline-none focus:border-[#16869a]" /><div className="flex items-center gap-2"><select value={size} onChange={event => setSize(event.target.value)} data-testid="select-image-size" className="h-10 rounded-lg border border-[#d5e0e0] bg-white px-2 text-xs outline-none focus:border-[#16869a]"><option value="1024x1024">Large 1024</option><option value="512x512">Fast 512</option></select><button disabled={generate.isPending || !prompt.trim()} data-testid="button-generate-image" className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#16869a] px-4 text-sm font-semibold text-white disabled:opacity-50">{generate.isPending ? "Creating..." : "Generate image"}</button></div></form>{generate.isError && <p className="mt-2 text-xs text-[#ad4b43]" data-testid="image-error">The image could not be created. Try again.</p>}{image && <div className="mt-3 overflow-hidden rounded-xl border border-[#e3ebeb]">{!loaded && <Skeleton className="aspect-square w-full" />}<img src={image.imageUrl} alt={image.prompt} onLoad={() => setLoaded(true)} className={loaded ? "block w-full" : "hidden"} data-testid="generated-image" /><div className="flex items-center justify-between gap-2 p-2"><p className="min-w-0 flex-1 truncate text-[11px] text-[#718189]">{image.prompt}</p><a href={image.imageUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[11px] font-semibold text-[#16869a]">Full size</a></div></div>}<p className="mt-2 text-[11px] leading-5 text-[#7c8c91]">Free keyless rendering. Only your prompt is sent — no applicant data. First view develops in ~30s.</p></Section>;
}

const ACTIVE_CONVERSATION_KEY = "robotics-active-conversation";

function readStoredConversationId(): string {
  try {
    return window.localStorage.getItem(ACTIVE_CONVERSATION_KEY) ?? "";
  } catch {
    return "";
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function activityMeta(tool: string): { label: string; Icon: LucideIcon } {
  if (tool === "web_search") return { label: "Searched the web", Icon: Search };
  if (tool === "python_exec" || tool === "python") return { label: "Ran Python", Icon: SquareTerminal };
  if (tool === "generate_image") return { label: "Generated image", Icon: ImageIcon };
  if (tool === "web_fetch" || tool === "fetch_url") return { label: "Fetched page", Icon: Globe };
  if (tool === "rename_conversation" || tool === "rename") return { label: "Renamed chat", Icon: Pencil };
  if (tool === "transfer_interviewer") return { label: "Transferred interviewer", Icon: UsersRound };
  if (tool === "search_applicants") return { label: "Searched applicants", Icon: Search };
  if (tool === "get_applicant") return { label: "Viewed applicant", Icon: UsersRound };
  if (tool === "create_applicant") return { label: "Added applicant", Icon: Plus };
  if (tool === "update_applicant") return { label: "Updated applicant", Icon: Pencil };
  if (tool === "delete_applicant") return { label: "Removed applicant", Icon: Trash2 };
  if (tool === "reorder_queue") return { label: "Reordered queue", Icon: ClipboardList };
  if (tool === "move_applicant_in_queue") return { label: "Moved in queue", Icon: ClipboardList };
  if (tool === "list_interviewers") return { label: "Listed interviewers", Icon: UsersRound };
  if (tool === "assign_interviewers") return { label: "Assigned interviewers", Icon: UsersRound };
  if (tool === "list_uploads") return { label: "Listed uploads", Icon: FileUp };
  if (tool === "preview_import") return { label: "Previewed import", Icon: Search };
  if (tool === "commit_import") return { label: "Committed import", Icon: Check };
  if (tool === "list_snapshots") return { label: "Listed versions", Icon: History };
  if (tool === "create_snapshot") return { label: "Saved version", Icon: Check };
  if (tool === "restore_snapshot") return { label: "Restored version", Icon: RefreshCw };
  if (tool === "list_conversations") return { label: "Listed previous chats", Icon: History };
  if (tool === "read_conversation") return { label: "Read previous chat", Icon: History };
  if (tool === "kick_presence") return { label: "Kicked IP", Icon: LogOut };
  if (tool === "presence_stats") return { label: "Checked IP stats", Icon: UsersRound };
  if (tool === "list_presence") return { label: "Checked who is online", Icon: UsersRound };
  if (tool === "list_collaboration_artifacts") return { label: "Listed shared artifacts", Icon: Search };
  if (tool === "read_collaboration_artifact") return { label: "Read artifact", Icon: Search };
  if (tool === "edit_whiteboard") return { label: "Edited whiteboard", Icon: Pencil };
  if (tool === "edit_board") return { label: "Edited board", Icon: ClipboardList };
  if (tool === "edit_document") return { label: "Edited document", Icon: Pencil };
  if (tool === "edit_spreadsheet") return { label: "Edited spreadsheet", Icon: ClipboardList };
  return { label: tool, Icon: Sparkles };
}

function ActivityPills({ activities }: { activities: AssistantActivity[] }) {
  if (!activities.length) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[#dce9e8] bg-[#f8faf9]" data-testid="assistant-activities">
      <div className="flex items-center gap-1.5 bg-[#edf4f3] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3d6b72]">
        <Sparkles size={12} className="text-[#16869a]" />
        {activities.length} tool call{activities.length > 1 ? "s" : ""}
      </div>
      <div className="divide-y divide-[#edf1f1]">
        {activities.map((activity, index) => {
          const { label, Icon } = activityMeta(activity.tool);
          return (
            <div key={`${activity.tool}-${index}`} className="flex items-start gap-2.5 px-3 py-2">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#dce9e8] bg-white text-[#16869a]">
                <Icon size={12} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-none text-[#38555e]">{label}</p>
                <p className="mt-1 truncate text-xs leading-none text-[#7c8c91]" title={activity.detail}>
                  {activity.detail || "—"}
                </p>
              </div>
              <Check size={12} className="mt-1 shrink-0 text-[#3aa582]" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConversationAssistant() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<{ q: string; a: string; activities: AssistantActivity[] }[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>(() => readStoredConversationId());
  const [renamingId, setRenamingId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      return window.localStorage.getItem("robotics-assistant-model") ?? "";
    } catch {
      return "";
    }
  });
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [liveActivities, setLiveActivities] = useState<AssistantActivity[]>([]);
  const liveActivitiesRef = useRef<AssistantActivity[]>([]);
  const [attachments, setAttachments] = useState<{ fileName: string; objectPath: string; added: number; updated: number }[]>([]);
  const [attachError, setAttachError] = useState("");
  const [attaching, setAttaching] = useState(false);
  const attachmentUpload = useRequestUploadUrl();
  const attachmentPreview = usePreviewImport();
  const streamAbort = useRef<AbortController | null>(null);
  useEffect(() => () => streamAbort.current?.abort(), []);
  const ask = useAskAssistant();
  const assistantConfig = useGetAssistantConfig({ query: { queryKey: getGetAssistantConfigQueryKey() } });
  const assistantModels = useListAssistantModels({
    query: { queryKey: getListAssistantModelsQueryKey(), staleTime: 5 * 60 * 1000 },
  });
  const modelOptions = assistantModels.data?.items ?? [];
  const availableModel = modelOptions.find((item) => item.id === selectedModel)?.id
    ?? modelOptions.find((item) => item.id === assistantConfig.data?.textModel)?.id
    ?? modelOptions[0]?.id
    ?? "";
  useEffect(() => {
    if (!modelOptions.length) return;
    const nextModel = modelOptions.some((item) => item.id === selectedModel)
      ? selectedModel
      : modelOptions.find((item) => item.id === assistantConfig.data?.textModel)?.id
        ?? modelOptions[0].id;
    if (nextModel !== selectedModel) setSelectedModel(nextModel);
    try {
      window.localStorage.setItem("robotics-assistant-model", nextModel);
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }, [assistantConfig.data?.textModel, modelOptions, selectedModel]);
  const conversations = useListAssistantConversations({ query: { queryKey: getListAssistantConversationsQueryKey(), refetchInterval: 3000 } });
  const activeMessages = useGetAssistantConversationMessages(activeConversationId, undefined, {
    query: {
      queryKey: getGetAssistantConversationMessagesQueryKey(activeConversationId),
      enabled: Boolean(activeConversationId),
      refetchInterval: 3000,
    },
  });
  const createConversation = useCreateAssistantConversation();
  const renameConversation = useRenameAssistantConversation();
  const deleteConversation = useDeleteAssistantConversation();
  const list = useListApplicants({ sort: "rank" }, { query: { queryKey: getListApplicantsQueryKey({ sort: "rank" }) } });
  const prompts = ["Who are the strongest builders with 10+ hours?", "Compare the top two unranked applicants.", "Which concerns need a human follow-up?"];

  useEffect(() => {
    // Only ever fill a missing/invalid selection — never override the user's
    // current chat (the stored id is already the initial state on reload).
    const items = conversations.data?.items ?? [];
    if (!items.length) return;
    if (!activeConversationId || !items.some(item => item.id === activeConversationId)) {
      setActiveConversationId(items[0].id);
    }
  }, [conversations.data, activeConversationId]);

  useEffect(() => {
    try {
      if (activeConversationId) window.localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConversationId);
      else window.localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
    } catch {
      // Private browsing etc.
    }
  }, [activeConversationId]);

  const creatingRef = useRef(false);
  useEffect(() => {
    const existing = conversations.data?.items ?? [];
    if (existing.length > 0) {
      creatingRef.current = false;
      return;
    }
    if (creatingRef.current || conversations.isLoading || createConversation.isPending || activeConversationId) return;
    creatingRef.current = true;
    createConversation.mutate({ data: {} }, {
      onSuccess: conversation => {
        setActiveConversationId(conversation.id);
        setHistory([]);
        queryClient.invalidateQueries({ queryKey: getListAssistantConversationsQueryKey() });
      },
      onError: () => {
        creatingRef.current = false;
      },
    });
  }, [conversations.data, conversations.isLoading, activeConversationId, createConversation]);

  useEffect(() => {
    if (isStreaming || ask.isPending) return;
    setHistory(activeMessages.data?.items.map(item => ({ q: item.question, a: item.answer, activities: item.activities ?? [] })) ?? []);
  }, [activeConversationId, activeMessages.data, isStreaming, ask.isPending]);

  const attachFile = async (file: File) => {
    setAttachError("");
    const isExcel = /\.xlsx?$/i.test(file.name);
    if (!/\.(csv|tsv|xlsx|xls)$/i.test(file.name)) { setAttachError("Attach a roster file: CSV, TSV, or Excel."); return; }
    if (file.size > 15 * 1024 * 1024) { setAttachError("Files must be under 15 MB."); return; }
    setAttaching(true);
    try {
      const contentType = file.type || (isExcel ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv");
      const requested = await attachmentUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType } });
      const sameOrigin = (() => { try { return new URL(requested.uploadURL, window.location.href).origin === window.location.origin; } catch { return false; } })();
      const response = await fetch(requested.uploadURL, { method: "PUT", headers: { "Content-Type": contentType }, body: file, ...(sameOrigin ? { credentials: "include" as const } : {}) });
      if (!response.ok) throw new Error("Upload failed");
      const rowCount = isExcel ? 0 : Math.max(0, (await file.text()).split(/\r?\n/).filter(Boolean).length - 1);
      const filePreview = await attachmentPreview.mutateAsync({ data: { objectPath: requested.objectPath, fileName: file.name, rowCount } });
      setAttachments(current => [...current, { fileName: file.name, objectPath: requested.objectPath, added: filePreview.diff.added, updated: filePreview.diff.updated }]);
    } catch {
      setAttachError("The file could not be attached. Try again.");
    } finally {
      setAttaching(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim() || !activeConversationId || isStreaming) return;
    const q = question.trim();
    setQuestion("");
    setStreamError("");
    setStreamingText("");
    setLiveActivities([]);
    liveActivitiesRef.current = [];
    streamAbort.current?.abort();
    const controller = new AbortController();
    streamAbort.current = controller;
    setIsStreaming(true);
    const attachedFiles = attachments.map(a => ({ fileName: a.fileName, objectPath: a.objectPath }));
    const payload = { question: q, model: availableModel || undefined, conversationId: activeConversationId, applicantIds: selected.length ? selected : undefined, ...(attachedFiles.length ? { attachments: attachedFiles } : {}) };
    const authToken = getStoredAuthToken();
    void (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}api/assistant/ask/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
          body: JSON.stringify(payload),
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`Stream failed with status ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalAnswer = "";
        let serverError = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find(entry => entry.startsWith("data:"));
            if (!line) continue;
            let message: { delta?: string; done?: boolean; answer?: string; activities?: AssistantActivity[]; activity?: AssistantActivity; error?: string } | null = null;
            try {
              message = JSON.parse(line.slice(5).trim()) as { delta?: string; done?: boolean; answer?: string; activities?: AssistantActivity[]; activity?: AssistantActivity; error?: string };
            } catch {
              continue;
            }
            if (!message) continue;
            if (typeof message.delta === "string" && message.delta) {
              finalAnswer += message.delta;
              setStreamingText(current => current + (message.delta as string));
            } else if (message.error) {
              serverError = message.error;
            } else if (message.activity) {
              const activity = message.activity;
              liveActivitiesRef.current = [...liveActivitiesRef.current, activity];
              setLiveActivities(liveActivitiesRef.current);
            } else if (message.done) {
              if (typeof message.answer === "string" && message.answer) finalAnswer = message.answer;
              if (Array.isArray(message.activities)) {
                liveActivitiesRef.current = message.activities;
                setLiveActivities(message.activities);
              }
            }
          }
        }
        if (serverError) throw new Error(serverError);
        setHistory(current => [...current, { q, a: finalAnswer.trim() || "I could not produce an answer for that question.", activities: liveActivitiesRef.current }]);
        setAttachments([]);
        queryClient.invalidateQueries({ queryKey: getGetAssistantConversationMessagesQueryKey(activeConversationId) });
        queryClient.invalidateQueries({ queryKey: getListAssistantConversationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Streaming failed mid-flight; fall back to the classic request.
        ask.mutate({ data: payload }, {
          onSuccess: response => {
            setHistory(current => [...current, { q, a: response.answer, activities: response.activities ?? [] }]);
            setAttachments([]);
            queryClient.invalidateQueries({ queryKey: getGetAssistantConversationMessagesQueryKey(activeConversationId) });
            queryClient.invalidateQueries({ queryKey: getListAssistantConversationsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetQueueQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() });
          },
          onError: fallback => setStreamError(serverErrorMessage(fallback, "The assistant could not answer that just now. Try again.")),
        });
      } finally {
        setIsStreaming(false);
        setStreamingText("");
      }
    })();
  };

  const newConversation = () => {
    if (createConversation.isPending) return;
    createConversation.mutate({ data: {} }, {
      onSuccess: conversation => {
        setActiveConversationId(conversation.id);
        setHistory([]);
        // Put the new chat in the list immediately so the auto-select logic
        // never snaps back to an old chat while the refetch is in flight.
        queryClient.setQueryData<AssistantConversationList>(getListAssistantConversationsQueryKey(), old => ({
          items: [{ ...conversation, messageCount: 0 }, ...((old?.items ?? []).filter(item => item.id !== conversation.id))],
        }));
        queryClient.invalidateQueries({ queryKey: getListAssistantConversationsQueryKey() });
      },
    });
  };

  const saveRename = (event: React.FormEvent, id: string) => {
    event.preventDefault();
    const title = renameValue.trim();
    if (!title || renameConversation.isPending) return;
    renameConversation.mutate({ conversationId: id, data: { title } }, {
      onSuccess: () => {
        setRenamingId("");
        queryClient.invalidateQueries({ queryKey: getListAssistantConversationsQueryKey() });
      },
    });
  };

  const deleteConversationById = (id: string, title: string) => {
    if (deleteConversation.isPending || !window.confirm(`Delete "${title}" and its messages?`)) return;
    deleteConversation.mutate({ conversationId: id }, {
      onSuccess: () => {
        if (activeConversationId === id) {
          const remaining = (conversations.data?.items ?? []).filter(item => item.id !== id);
          setHistory([]);
          if (remaining.length === 0) newConversation();
          else setActiveConversationId(remaining[0].id);
        }
        queryClient.invalidateQueries({ queryKey: getListAssistantConversationsQueryKey() });
      },
    });
  };
  const activeConversation = conversations.data?.items.find(item => item.id === activeConversationId);

  return <div className="fade-up">
    <PageHeading eyebrow="Decision support / AI workspace" title="Ask the room." detail="A focused control-room assistant with saved conversations for each decision thread." action={<div className="flex flex-wrap items-center gap-2"><Badge tone="blue"><Sparkles size={12} className="mr-1" /> Context: {selected.length ? `${selected.length} selected` : "all applicants"}</Badge><AssistantModelPicker model={availableModel} models={modelOptions} loading={assistantModels.isLoading} error={assistantModels.isError} onChange={(model) => { setSelectedModel(model); try { window.localStorage.setItem("robotics-assistant-model", model); } catch { /* Storage can be unavailable in private browsing. */ } }} /></div>} />
    <div className="grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)_330px]">
      <aside className="order-2 min-h-0 rounded-2xl border border-[#dce5e5] bg-white p-4 shadow-[0_3px_12px_rgba(26,49,60,.035)] xl:order-1" data-testid="assistant-history-sidebar">
        <button onClick={newConversation} disabled={createConversation.isPending} data-testid="button-new-chat" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#183a4b] text-sm font-semibold text-white disabled:opacity-50"><Plus size={16} /> New chat</button>
        <p className="mono mt-5 text-[10px] uppercase tracking-[.16em] text-[#16869a]">Previous chats</p>
        <div className="mt-2 max-h-[52vh] space-y-1 overflow-y-auto xl:max-h-[62vh]">
          {conversations.isLoading && [1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
          {conversations.data?.items.map(conversation => <div key={conversation.id} className={`rounded-xl border p-2 transition ${conversation.id === activeConversationId ? "border-[#a9d3ce] bg-[#eff8f6]" : "border-transparent hover:border-[#dce5e5] hover:bg-[#f7faf9]"}`}>{renamingId === conversation.id ? <form onSubmit={event => saveRename(event, conversation.id)} className="flex items-center gap-1"><input autoFocus value={renameValue} onChange={event => setRenameValue(event.target.value)} data-testid="input-rename-conversation" className="min-w-0 flex-1 rounded-md border border-[#b7d5d1] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#16869a]" /><button type="submit" aria-label="Save conversation name" className="rounded-md p-1 text-[#16869a] hover:bg-[#dff2ee]"><Check size={14} /></button><button type="button" onClick={() => setRenamingId("")} aria-label="Cancel rename" className="rounded-md p-1 text-[#718189] hover:bg-[#edf1f1]"><X size={14} /></button></form> : <div className="flex items-center gap-1"><button onClick={() => { setActiveConversationId(conversation.id); setHistory([]); }} className="min-w-0 flex-1 text-left" data-testid={`button-assistant-conversation-${conversation.id}`}><p className="truncate text-xs font-semibold text-[#38555e]">{conversation.title}</p><p className="mt-1 text-[10px] text-[#819197]">{timeAgo(conversation.updatedAt)}{conversation.messageCount > 0 ? ` · ${conversation.messageCount} ${conversation.messageCount === 1 ? "exchange" : "exchanges"}` : ""}</p></button><button onClick={() => { setRenamingId(conversation.id); setRenameValue(conversation.title); }} aria-label={`Rename ${conversation.title}`} title="Rename conversation" data-testid={`button-rename-assistant-conversation-${conversation.id}`} className="rounded-md p-1 text-[#7d9398] hover:bg-[#dff2ee] hover:text-[#16869a]"><Pencil size={13} /></button><button onClick={() => deleteConversationById(conversation.id, conversation.title)} aria-label={`Delete ${conversation.title}`} title="Delete conversation" data-testid={`button-delete-assistant-conversation-${conversation.id}`} className="rounded-md p-1 text-[#a34d46] hover:bg-[#fff1ef]"><Trash2 size={13} /></button></div>}</div>)}
          {!conversations.isLoading && !conversations.data?.items.length && <p className="px-1 py-4 text-xs leading-5 text-[#7c8c91]">No saved conversations yet. Start a new chat above.</p>}
        </div>
      </aside>
      <section className="relative order-1 min-h-[560px] rounded-2xl border border-[#dce5e5] bg-white p-5 shadow-[0_3px_12px_rgba(26,49,60,.035)] xl:order-2">
        <div className="flex items-center gap-3 border-b border-[#edf1f1] pb-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f4f2] text-[#16869a]"><Bot size={21} /></div><div className="min-w-0"><h2 className="truncate font-semibold">{activeConversation?.title || "New conversation"}</h2><p className="text-xs text-[#7c8c91]">This conversation is shared with the coordinator team.</p></div><div className="ml-auto flex items-center gap-1"><span className="mr-2 hidden text-[10px] font-semibold uppercase tracking-[.14em] text-[#819197] sm:block">Synced</span><button onClick={newConversation} disabled={createConversation.isPending} aria-label="New conversation" title="New conversation" data-testid="button-new-assistant-conversation" className="rounded-lg p-2 text-[#718189] transition hover:bg-[#f1f6f5] hover:text-[#16869a] disabled:opacity-50"><Plus size={17} /></button><button onClick={() => activeConversation && deleteConversationById(activeConversation.id, activeConversation.title)} disabled={!activeConversation || deleteConversation.isPending} aria-label="Delete current conversation" title="Delete current conversation" data-testid="button-delete-current-assistant-conversation" className="rounded-lg p-2 text-[#a34d46] transition hover:bg-[#fff1ef] disabled:cursor-not-allowed disabled:opacity-30"><Trash2 size={17} /></button></div></div>
        
        <div className="space-y-5 py-6">
          {activeMessages.isLoading && <><Skeleton className="ml-auto h-12 w-3/4" /><Skeleton className="h-20 w-4/5" /></>}
          {!activeMessages.isLoading && !history.length && !ask.isPending && <div className="py-12 text-center"><p className="text-lg font-semibold">What should we look at?</p><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#7c8c91]">Ask for a shortlist, a comparison, or a question to use in this conversation.</p><div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">{prompts.map((prompt, i) => <button key={prompt} onClick={() => setQuestion(prompt)} data-testid={`button-prompt-${i}`} className="rounded-full border border-[#cfe1e1] px-3 py-2 text-xs text-[#44646d] transition hover:border-[#16869a] hover:text-[#16869a]">{prompt}</button>)}</div></div>}
          {history.map((item, i) => <div key={`${item.q}-${i}`} className="space-y-3"><div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#edf4f3] px-4 py-3 text-sm text-[#38555e]" data-testid={`assistant-question-${i}`}>{item.q}</div><div className="flex max-w-[90%] gap-3 rounded-2xl rounded-bl-sm border border-[#e3ebeb] px-4 py-4 text-sm leading-6 text-[#52666e]" data-testid={`assistant-answer-${i}`}><Bot size={17} className="mt-1 shrink-0 text-[#16869a]" /><div className="min-w-0 flex-1"><MarkdownContent source={item.a} className="text-[#52666e]" /><ActivityPills activities={item.activities} /></div></div></div>)}
          {ask.isPending && <div className="flex items-center gap-3 text-sm text-[#7c8c91]" data-testid="assistant-loading"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#16869a]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#16869a] [animation-delay:100ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#16869a] [animation-delay:200ms]" /></span>Reading the field...</div>}
          {isStreaming && <div className="flex max-w-[90%] gap-3 rounded-2xl rounded-bl-sm border border-[#e3ebeb] px-4 py-4 text-sm leading-6 text-[#52666e]" data-testid="assistant-streaming"><Bot size={17} className="mt-1 shrink-0 text-[#16869a]" /><div className="min-w-0 flex-1">{streamingText.replace(/<(?:tool_call|dots_function_call)>[\s\S]*?(<\/tool_call>|$)/g, "").trim() ? <p className="whitespace-pre-wrap">{streamingText.replace(/<(?:tool_call|dots_function_call)>[\s\S]*?(<\/tool_call>|$)/g, "").trim()}</p> : <span className="flex items-center gap-3 text-[#7c8c91]"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#16869a]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#16869a] [animation-delay:100ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#16869a] [animation-delay:200ms]" /></span>Reading the field...</span>}<ActivityPills activities={liveActivities} /></div></div>}
          {ask.isError && <p className="text-sm text-[#b34a42]" data-testid="assistant-error">{serverErrorMessage(ask.error, "The assistant could not answer that just now. Try again.")}</p>}
          {streamError && <p className="text-sm text-[#b34a42]" data-testid="assistant-stream-error">{streamError}</p>}
        </div>
        {attachments.length > 0 && <div className="flex flex-wrap gap-2 border-t border-[#edf1f1] pt-4">{attachments.map(a => <span key={a.objectPath} className="inline-flex items-center gap-2 rounded-full bg-[#eaf7f5] px-3 py-1.5 text-xs font-semibold text-[#38555e]" data-testid={`assistant-attachment-${a.objectPath}`}><FileUp size={13} className="text-[#16869a]" />{a.fileName} · +{a.added} new{a.updated > 0 ? `, ~{a.updated} update` : ""}<button onClick={() => setAttachments(current => current.filter(x => x.objectPath !== a.objectPath))} aria-label={`Remove ${a.fileName}`} className="rounded-full p-0.5 text-[#718189] hover:text-[#b34a42]"><X size={13} /></button></span>)}</div>}
        {attachError && <p className="pt-2 text-xs text-[#ad4b43]" data-testid="assistant-attach-error">{attachError}</p>}
        <form onSubmit={submit} className="flex gap-2 border-t border-[#edf1f1] pt-4"><label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#d5e0e0] text-[#63747c] transition hover:border-[#16869a] hover:text-[#16869a]" title="Attach roster file (CSV, TSV, Excel)"><FileUp size={17} /><input type="file" accept=".csv,.tsv,.xlsx,.xls" className="sr-only" data-testid="input-assistant-attachment" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void attachFile(file); }} /></label><input value={question} onChange={event => setQuestion(event.target.value)} data-testid="input-assistant-question" placeholder="Ask about the applicants..." className="h-12 flex-1 rounded-xl border border-[#d5e0e0] px-4 text-sm outline-none focus:border-[#16869a]" /><button disabled={ask.isPending || isStreaming || !question.trim() || !activeConversationId} data-testid="button-ask-assistant" className="flex h-12 items-center gap-2 rounded-xl bg-[#183a4b] px-5 text-sm font-semibold text-white disabled:opacity-45"><ArrowRight size={16} /> Ask</button></form>
        {!activeConversationId && !conversations.isLoading && <p className="pt-3 text-center text-xs text-[#7c8c91]">Starting your first chat…</p>}
      </section>
      <Section title="Focus the context" kicker="Optional: select applicants for a sharper answer" className="order-3"><div className="space-y-2">{list.data && list.data.total > 8 && <p className="px-2 text-[11px] text-[#8a999d]">Showing first 8 of {list.data.total} — search on the Applicants page for the rest.</p>}{list.isLoading ? [1,2,3].map(i => <Skeleton key={i} className="h-12" />) : list.data?.items.slice(0,8).map(applicant => <label key={applicant.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-[#f1f6f5]"><input type="checkbox" checked={selected.includes(applicant.id)} onChange={event => setSelected(current => event.target.checked ? [...current, applicant.id] : current.filter(id => id !== applicant.id))} data-testid={`checkbox-assistant-${applicant.id}`} className="h-4 w-4 accent-[#16869a]" /><span className="min-w-0 flex-1 truncate text-xs font-medium">{applicant.name}</span><span className="mono text-[10px] text-[#16869a]">{applicant.aiScore.toFixed(1)}</span></label>)}</div>{selected.length > 0 && <button onClick={() => setSelected([])} data-testid="button-clear-assistant-selection" className="mt-4 text-xs font-semibold text-[#16869a]">Clear selection</button>}</Section><ImageStudio />
    </div>
  </div>;
}
function seatLabel(row: number | null | undefined, col: number | null | undefined): string {
  return row == null || col == null ? "" : `R${row + 1}·C${col + 1}`;
}

function seatDot(attendance: string | null | undefined): string {
  if (attendance === "here") return "bg-[#28a47f]";
  if (attendance === "late") return "bg-[#c99a1f]";
  if (attendance === "absent") return "bg-[#b34a42]";
  return "bg-[#b4c1c4]";
}

function SeatingChart({ applicants }: { applicants: Applicant[] }) {
  const qc = useQueryClient();
  const settings = useGetSeatingSettings({ query: { queryKey: getGetSeatingSettingsQueryKey(), refetchInterval: 5000 } });
  const updateSettings = useUpdateSeatingSettings();
  const assign = useAssignSeat();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const busy = assign.isPending || updateSettings.isPending;
  const rows = settings.data?.rows ?? 4;
  const cols = settings.data?.cols ?? 6;
  const bySeat = new Map<string, Applicant>();
  for (const a of applicants) {
    if (a.seatRow != null && a.seatCol != null) bySeat.set(`${a.seatRow}:${a.seatCol}`, a);
  }
  const unseated = applicants.filter(a => a.seatRow == null || a.seatCol == null);
  const selected = applicants.find(a => a.id === selectedId) ?? null;
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetQueueQueryKey() });
    qc.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
  };
  const place = (applicantId: string, row: number, col: number) => {
    assign.mutate({ data: { applicantId, row, col } }, {
      onSuccess: () => { setSelectedId(null); invalidate(); },
    });
  };
  const tapSeat = (row: number, col: number) => {
    if (busy) return;
    const occupant = bySeat.get(`${row}:${col}`);
    if (selectedId) {
      // Tapping the selected student's own seat again unseats them.
      if (occupant?.id === selectedId) place(selectedId, -1, -1);
      else place(selectedId, row, col);
    } else if (occupant) {
      setSelectedId(occupant.id);
    }
  };
  const resize = (nextRows: number, nextCols: number) => {
    updateSettings.mutate({ data: { rows: nextRows, cols: nextCols } }, { onSuccess: invalidate });
  };
  const unseatAll = () => {
    if (!window.confirm("Remove everyone from their seats?")) return;
    const seated = applicants.filter(a => a.seatRow != null && a.seatCol != null);
    seated.forEach(a => assign.mutate({ data: { applicantId: a.id, row: -1, col: -1 } }, { onSuccess: invalidate }));
  };
  return <section className="mb-5 rounded-2xl border border-[#dce5e5] bg-white p-4" data-testid="seating-chart">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-semibold">Seating chart <span className="mono ml-2 text-xs text-[#16869a]">{bySeat.size} seated · {unseated.length} unseated · {rows}×{cols}</span></p><p className="mt-1 text-xs text-[#7c8c91]">Tap a student below, then tap their seat. Tap a seated student, then another seat to move them — or their own seat again to unseat.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-xs font-semibold text-[#63747c]"><span>Rows</span><button onClick={() => resize(rows - 1, cols)} disabled={busy || rows <= 1} data-testid="button-seats-rows-minus" className="rounded-lg border border-[#d5e0e0] px-2 py-1 disabled:opacity-30">−</button><span className="mono w-5 text-center">{rows}</span><button onClick={() => resize(rows + 1, cols)} disabled={busy || rows >= 10} data-testid="button-seats-rows-plus" className="rounded-lg border border-[#d5e0e0] px-2 py-1 disabled:opacity-30">+</button></div>
        <div className="flex items-center gap-1 text-xs font-semibold text-[#63747c]"><span>Cols</span><button onClick={() => resize(rows, cols - 1)} disabled={busy || cols <= 1} data-testid="button-seats-cols-minus" className="rounded-lg border border-[#d5e0e0] px-2 py-1 disabled:opacity-30">−</button><span className="mono w-5 text-center">{cols}</span><button onClick={() => resize(rows, cols + 1)} disabled={busy || cols >= 10} data-testid="button-seats-cols-plus" className="rounded-lg border border-[#d5e0e0] px-2 py-1 disabled:opacity-30">+</button></div>
        {bySeat.size > 0 && <button onClick={unseatAll} disabled={busy} data-testid="button-seats-clear" className="rounded-lg border border-[#d5e0e0] px-3 py-1.5 text-xs font-semibold text-[#63747c] hover:bg-[#eef3f2] disabled:opacity-50">Unseat all</button>}
      </div>
    </div>
    {settings.isError && <p className="mt-2 text-xs font-semibold text-[#ad4b43]">Could not load the seating chart.</p>}
    <div className="mt-3 rounded-xl bg-[#172a3a] px-3 py-2 text-center"><span className="mono text-[10px] uppercase tracking-[.25em] text-[#f8c84a]">Front of room</span></div>
    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-[#7c8c91]">
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#28a47f]" />Here</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#c99a1f]" />Late</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#b34a42]" />Absent</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#b4c1c4]" />Unmarked</span>
    </div>
    <div className="mt-2 overflow-x-auto">
      <div className="grid min-w-[520px] gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows * cols }, (_, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          const occupant = bySeat.get(`${row}:${col}`);
          const isSelected = occupant && occupant.id === selectedId;
          return <button key={`${row}:${col}`} onClick={() => tapSeat(row, col)} disabled={busy} data-testid={`seat-${row}-${col}`} title={occupant ? `${occupant.name} (${seatLabel(row, col)})` : `Empty seat ${seatLabel(row, col)}`} className={`flex min-h-[52px] flex-col justify-center rounded-xl border px-2 py-1.5 text-left transition disabled:opacity-60 ${occupant ? (isSelected ? "border-[#16869a] bg-[#e3f4f2]" : "border-[#d7e4e3] bg-[#f7faf9] hover:border-[#16869a]") : selected ? "border-dashed border-[#b8cbcc] bg-white hover:border-[#16869a] hover:bg-[#eef7f6]" : "border-[#edf1f1] bg-white hover:border-[#b8cbcc]"}`}>
            {occupant ? <><span className="flex items-center gap-1.5"><span className={`h-2 w-2 shrink-0 rounded-full ${seatDot(occupant.attendance)}`} /><span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#182232]">{occupant.name}</span></span><span className="mono mt-0.5 text-[10px] text-[#809196]">{seatLabel(row, col)}</span></> : <span className="mono text-[10px] text-[#b4c1c4]">{selected ? `Seat ${selected.name.split(" ")[0]} here` : seatLabel(row, col)}</span>}
          </button>;
        })}
      </div>
    </div>
    <div className="mt-3">
      <p className="text-xs font-semibold text-[#63747c]">Students {selected ? <span className="text-[#12737d]">— placing {selected.name}, tap a seat</span> : "— tap one, then tap their seat"}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {unseated.length ? unseated.map(a => <button key={a.id} onClick={() => setSelectedId(current => current === a.id ? null : a.id)} disabled={busy} data-testid={`unseated-${a.id}`} title={`Seat ${a.name}`} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-50 ${selectedId === a.id ? "border-[#16869a] bg-[#e3f4f2] text-[#12737d]" : "border-[#d5e0e0] bg-white text-[#52666e] hover:border-[#16869a]"}`}><span className={`h-2 w-2 rounded-full ${seatDot(a.attendance)}`} />{a.name}</button>) : <p className="text-xs text-[#7c8c91]">Everyone has a seat.</p>}
      </div>
      {selected && <button onClick={() => place(selected.id, -1, -1)} disabled={busy} data-testid="button-unseat-selected" className="mt-2 rounded-lg border border-[#d5e0e0] px-3 py-1.5 text-[11px] font-semibold text-[#63747c] hover:bg-[#eef3f2] disabled:opacity-50">Unseat {selected.name}</button>}
    </div>
  </section>;
}

function AttendancePage() {
  const qc = useQueryClient();
  const { settings } = useWorkspaceSettings();
  const refreshMs = settings.autoRefresh ? settings.refreshMs : false;
  const boardParams = useMemo(() => ({ sort: "queue" }), []);
  const remaining = useListApplicants(boardParams, { query: { queryKey: getListApplicantsQueryKey(boardParams), refetchInterval: refreshMs } });
  const updateApplicant = useUpdateApplicant();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetQueueQueryKey() });
    qc.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() });
  };
  const markAttendance = (id: string, patch: AttendancePatch) => {
    updateApplicant.mutate({ id, data: patch }, { onSuccess: invalidate });
  };
  const markAllHere = () => {
    const todo = (remaining.data?.items ?? []).filter(a => a.interviewStatus !== "completed" && a.attendance !== "here");
    todo.forEach(a => updateApplicant.mutate({ id: a.id, data: { attendance: "here", lateArrivalTime: null, makeupDate: null, attendanceExcused: null } }, { onSuccess: invalidate }));
  };
  const [statusFilter, setStatusFilter] = useState<"all" | "remaining" | "completed">("all");
  const [attFilter, setAttFilter] = useState<"all" | "here" | "late" | "absent" | "unmarked" | "excused">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "seat" | "status">("name");
  const [copied, setCopied] = useState(false);
  const all = remaining.data?.items ?? [];
  const eligible = all.filter(a => a.interviewStatus !== "completed");
  const here = eligible.filter(a => a.attendance === "here").length;
  const late = eligible.filter(a => a.attendance === "late").length;
  const absent = eligible.filter(a => a.attendance === "absent").length;
  const unmarked = eligible.length - here - late - absent;
  const excused = eligible.filter(a => (a.attendance === "late" || a.attendance === "absent") && a.attendanceExcused === true).length;
  const seated = all.filter(a => a.seatRow != null && a.seatCol != null).length;
  const checkedIn = here + late;
  const pct = eligible.length ? Math.round((checkedIn / eligible.length) * 100) : 0;
  const lateList = eligible.filter(a => a.attendance === "late").sort((x, y) => x.name.localeCompare(y.name));
  const absentList = eligible.filter(a => a.attendance === "absent").sort((x, y) => x.name.localeCompare(y.name));
  const query = search.trim().toLowerCase();
  const statusRank = (a: Applicant) => a.attendance === "unmarked" ? 0 : a.attendance === "late" ? 1 : a.attendance === "absent" ? 2 : a.attendance === "here" ? 3 : 4;
  const visible = all
    .filter(a =>
      (statusFilter === "all" || (statusFilter === "remaining" ? a.interviewStatus !== "completed" : a.interviewStatus === "completed")) &&
      (attFilter === "all" || (attFilter === "excused" ? (a.attendance === "late" || a.attendance === "absent") && a.attendanceExcused === true : a.attendance === attFilter)) &&
      (!query || a.name.toLowerCase().includes(query)),
    )
    .sort((x, y) => sort === "seat" ? ((x.seatRow ?? 999) * 100 + (x.seatCol ?? 999) - ((y.seatRow ?? 999) * 100 + (y.seatCol ?? 999)) || x.name.localeCompare(y.name)) : sort === "status" ? (statusRank(x) - statusRank(y) || x.name.localeCompare(y.name)) : x.name.localeCompare(y.name));
  const filterButton = (value: "all" | "remaining" | "completed", label: string, count: number) => <button key={value} onClick={() => setStatusFilter(value)} data-testid={`button-attendance-filter-${value}`} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${statusFilter === value ? "bg-[#183a4b] text-white" : "bg-[#eef3f2] text-[#63747c] hover:bg-[#dce9e8]"}`}>{label} · {count}</button>;
  const toggleAtt = (value: "here" | "late" | "absent" | "unmarked" | "excused") => setAttFilter(current => current === value ? "all" : value);
  const clearMarks = () => {
    if (!window.confirm("Clear all attendance marks? Everyone goes back to unmarked (times, makeup dates, and excused flags are removed). Seats are kept.")) return;
    const todo = eligible.filter(a => a.attendance !== "unmarked" || a.lateArrivalTime || a.makeupDate || a.attendanceExcused != null);
    todo.forEach(a => updateApplicant.mutate({ id: a.id, data: { attendance: "unmarked", lateArrivalTime: null, makeupDate: null, attendanceExcused: null } }, { onSuccess: invalidate }));
  };
  const copySummary = async () => {
    const lines = [
      `Attendance — ${new Date().toLocaleDateString([], { month: "short", day: "numeric" })} (${checkedIn}/${eligible.length} checked in)`,
      `Here ${here} · Late ${late} · Absent ${absent} · Unmarked ${unmarked} · Excused ${excused} · Seated ${seated}/${all.length}`,
      lateList.length ? `Late: ${lateList.map(a => `${a.name} (${formatArrivalTime(a.lateArrivalTime) || "no time"}${a.attendanceExcused === true ? ", excused" : a.attendanceExcused === false ? ", unexcused" : ""})`).join("; ")}` : "Late: none",
      absentList.length ? `Absent: ${absentList.map(a => `${a.name} (${a.makeupDate ? `makeup ${formatMakeupDate(a.makeupDate)}` : "no makeup date"}${a.attendanceExcused === true ? ", excused" : a.attendanceExcused === false ? ", unexcused" : ""})`).join("; ")}` : "Absent: none",
    ];
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // Clipboard unavailable — the summary stays on screen instead.
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  const ringR = 40;
  const ringC = 2 * Math.PI * ringR;
  const tile = (value: "here" | "late" | "absent" | "unmarked" | "excused", label: string, count: number, numClass: string) => <button key={value} onClick={() => toggleAtt(value)} data-testid={`button-attendance-tile-${value}`} title={attFilter === value ? "Show all" : `Show only ${label.toLowerCase()}`} className={`min-w-[86px] flex-1 rounded-2xl border px-3 py-3 text-left transition ${attFilter === value ? "border-[#f8c84a] bg-[#f8c84a]/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}><p className={`mono text-2xl font-bold ${numClass}`}>{count}</p><p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[.12em] text-[#9db6bd]">{label}</p></button>;
  return <div className="fade-up">
    <PageHeading eyebrow="Interview bay / check-in" title="Attendance" detail="Mark who showed up before interviews start. Late arrivals record a time, absent applicants can get a makeup date, and both can be excused." />
    {remaining.isLoading ? <Skeleton className="h-64" /> : remaining.isError || !remaining.data ? <ErrorState onRetry={() => remaining.refetch()} /> : <>
      <section className="relative mb-5 overflow-hidden rounded-3xl bg-[#172a3a] p-6 text-white" data-testid="attendance-hero">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full border border-[#f8c84a]/20" />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`${pct}% checked in`}>
              <circle cx="52" cy="52" r={ringR} fill="none" stroke="#2a4356" strokeWidth="10" />
              <circle cx="52" cy="52" r={ringR} fill="none" stroke="#51d2ad" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(pct / 100) * ringC} ${ringC}`} transform="rotate(-90 52 52)" />
              <text x="52" y="50" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700">{pct}%</text>
              <text x="52" y="68" textAnchor="middle" fill="#89a4ab" fontSize="11">{checkedIn}/{eligible.length}</text>
            </svg>
            <div><p className="font-semibold">Checked in</p><p className="mt-1 max-w-[180px] text-xs leading-5 text-[#9db6bd]">{eligible.length ? `${checkedIn} of ${eligible.length} expected students are here or late.` : "Nobody left to check in."} Finished students excluded.</p></div>
          </div>
          <div className="flex min-w-[280px] flex-1 flex-wrap gap-2">
            {tile("here", "Here", here, "text-[#51d2ad]")}
            {tile("late", "Late", late, "text-[#f8c84a]")}
            {tile("absent", "Absent", absent, "text-[#ff9b8f]")}
            {tile("unmarked", "Unmarked", unmarked, "text-[#a7bdc3]")}
            {tile("excused", "Excused", excused, "text-[#7fe3c0]")}
            <div className="min-w-[86px] flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-3"><p className="mono text-2xl font-bold text-[#9dc3e8]">{seated}<span className="text-sm text-[#66848d]">/{all.length}</span></p><p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[.12em] text-[#9db6bd]">Seated</p></div>
          </div>
        </div>
        {attFilter !== "all" && <p className="relative mt-3 text-xs text-[#f8c84a]">Filtering by {attFilter} — tap the tile again to show everyone.</p>}
      </section>
      <SeatingChart applicants={all} />
      {(lateList.length > 0 || absentList.length > 0) && <section className="mb-5 rounded-2xl border border-[#e8d9b0] bg-[#fffdf4] p-4" data-testid="attendance-followup">
        <p className="text-sm font-semibold">Needs follow-up <span className="mono ml-2 text-xs text-[#8a6d1c]">{lateList.length} late · {absentList.length} absent</span></p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div><p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8a6d1c]">Late arrivals</p>{lateList.length ? lateList.map(a => <div key={a.id} className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl border border-[#e8d9b0] bg-white px-3 py-2 text-xs"><span className="font-semibold">{a.name}</span>{seatLabel(a.seatRow, a.seatCol) && <span className="mono rounded bg-[#eef3f2] px-1.5 py-0.5 text-[10px] font-bold text-[#527079]">{seatLabel(a.seatRow, a.seatCol)}</span>}<span className="mono text-[#8a6d1c]">{formatArrivalTime(a.lateArrivalTime) || "no time recorded"}</span>{a.attendanceExcused != null && <span className={`mono rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.attendanceExcused ? "bg-[#dff3ec] text-[#1d7a5f]" : "bg-[#fbe4e1] text-[#a34d46]"}`}>{a.attendanceExcused ? "Excused" : "Unexcused"}</span>}</div>) : <p className="mt-1.5 text-xs text-[#7c8c91]">Nobody late.</p>}</div>
          <div><p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#a34d46]">Absent</p>{absentList.length ? absentList.map(a => <div key={a.id} className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl border border-[#e5c4c0] bg-white px-3 py-2 text-xs"><span className="font-semibold">{a.name}</span>{seatLabel(a.seatRow, a.seatCol) && <span className="mono rounded bg-[#eef3f2] px-1.5 py-0.5 text-[10px] font-bold text-[#527079]">{seatLabel(a.seatRow, a.seatCol)}</span>}<span className="mono text-[#a34d46]">{a.makeupDate ? `Makeup ${formatMakeupDate(a.makeupDate)}` : "no makeup date"}</span>{a.attendanceExcused != null && <span className={`mono rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.attendanceExcused ? "bg-[#dff3ec] text-[#1d7a5f]" : "bg-[#fbe4e1] text-[#a34d46]"}`}>{a.attendanceExcused ? "Excused" : "Unexcused"}</span>}</div>) : <p className="mt-1.5 text-xs text-[#7c8c91]">Nobody absent.</p>}</div>
        </div>
      </section>}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {filterButton("all", "All students", all.length)}
        {filterButton("remaining", "To check in", eligible.length)}
        {filterButton("completed", "Finished", all.filter(a => a.interviewStatus === "completed").length)}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" data-testid="input-attendance-search" aria-label="Search students" className="h-9 min-w-[180px] flex-1 rounded-lg border border-[#d5e0e0] bg-white px-3 text-sm text-[#182232] outline-none focus:border-[#16869a] sm:max-w-xs" />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={sort} onChange={e => setSort(e.target.value as "name" | "seat" | "status")} data-testid="select-attendance-sort" aria-label="Sort check-in list" className="h-9 rounded-lg border border-[#d5e0e0] bg-white px-2 text-xs font-semibold text-[#182232] outline-none focus:border-[#16869a]">
          <option value="name">Sort: Name</option>
          <option value="seat">Sort: Seat</option>
          <option value="status">Sort: Needs attention</option>
        </select>
        <button onClick={markAllHere} disabled={updateApplicant.isPending || !eligible.length} data-testid="button-attendance-all-here" className="rounded-xl bg-[#16869a] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Mark all here</button>
        <button onClick={clearMarks} disabled={updateApplicant.isPending} data-testid="button-attendance-clear" title="Reset everyone to unmarked (seats are kept)" className="rounded-xl border border-[#d5e0e0] px-4 py-2 text-xs font-semibold text-[#63747c] hover:bg-[#eef3f2] disabled:opacity-50">Clear marks</button>
        <button onClick={() => void copySummary()} data-testid="button-attendance-copy" className="rounded-xl border border-[#d5e0e0] px-4 py-2 text-xs font-semibold text-[#63747c] hover:bg-[#eef3f2]">{copied ? "Copied!" : "Copy summary"}</button>
      </div>
      {visible.length ? <AttendancePanel applicants={visible} pending={updateApplicant.isPending} onMark={markAttendance} onMarkAll={markAllHere} /> : <p className="rounded-2xl border border-[#dce5e5] bg-white p-6 text-center text-sm text-[#7c8c91]">No students match this filter.</p>}
    </>}
  </div>;
}

function BigScreenPage() {
  return <div className="fade-up">
    <PageHeading eyebrow="Event command / big screen" title="Big screen" detail="Control what the big screen shows and says. Buttons live here — the sound comes out of the big screen." action={<Link href="/display" target="_blank" data-testid="link-open-big-screen" className="flex items-center gap-2 rounded-xl bg-[#183a4b] px-4 py-3 text-sm font-semibold text-white shadow-sm"><Monitor size={16} /> Open display</Link>} />
    <DisplayTextCard />
    <AudioCard />
  </div>;
}

function ErrorCodeRoute({ params }: { params: { code?: string } }) {
  const code = Number(params.code);
  if (!Number.isInteger(code) || !isErrorPageCode(code)) {
    return <NotFound />;
  }
  return <ErrorPage code={code} target={`/${code}`} />;
}

function ChatPage() {
  const list = useListApplicants({ sort: "queue" }, { query: { queryKey: getListApplicantsQueryKey({ sort: "queue" }) } });
  const applicantIds = useMemo(() => (list.data?.items ?? []).map(a => a.id), [list.data]);
  return <div className="fade-up"><PageHeading eyebrow="Interviewer channel / full page" title="Team chat." detail="The same shared interviewer channel from the queue, full height. Type @ai for an applicant-aware response." /><InterviewChatPanel applicantIds={applicantIds} tall /></div>;
}
function Router() { return <ErrorBoundary FallbackComponent={CrashFallback}><Switch><Route path="/" component={Landing} /><Route path="/auth" component={Login} /><Route path="/dashboard"><Shell><Dashboard /></Shell></Route><Route path="/applicants"><Shell><Applicants /></Shell></Route><Route path="/queue"><Shell><Queue /></Shell></Route><Route path="/chat"><Shell><ChatPage /></Shell></Route><Route path="/spreadsheets/:id">{({ id }) => <Shell><SpreadsheetEditor spreadsheetId={id} /></Shell>}</Route><Route path="/attendance"><Shell><AttendancePage /></Shell></Route><Route path="/big-screen"><Shell><BigScreenPage /></Shell></Route><Route path="/display" component={Display} /><Route path="/assistant"><Shell><ConversationAssistant /></Shell></Route><Route path="/error/:code">{({ code }) => <ErrorCodeRoute params={{ code }} />}</Route><Route component={NotFound} /></Switch></ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><SettingsProvider><Router /></SettingsProvider></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export { MarkdownContent, renderInlineMarkdown };
export default App;
