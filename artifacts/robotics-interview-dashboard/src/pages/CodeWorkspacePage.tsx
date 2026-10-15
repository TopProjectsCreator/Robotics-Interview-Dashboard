import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Files,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  SquareTerminal,
  Trash2,
  Upload,
  Usb,
  Users,
  X,
} from "lucide-react";
import {
  createCodeFile,
  createCodeProject,
  createCodeRevision,
  deleteCodeFile,
  deleteCodeProject,
  deployCodeProject,
  getListCodeFilesQueryKey,
  getListCodePresenceQueryKey,
  getListCodeProjectsQueryKey,
  getListCodeRevisionsQueryKey,
  listCodeFiles,
  listCodePresence,
  listCodeRevisions,
  updateCodeFile,
  updateCodePresence,
  updateCodeProject,
  useAskAssistant,
  useGetSession,
  getGetSessionQueryKey,
  type CodeFile,
  type CodeProject,
  useListCodeProjects,
  useListCodeFiles,
  useListCodeRevisions,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BIOBUZZ_SDK_VERSION,
  defaultSeedFiles,
  highlightJavaLine,
  hubPathFor,
  lintJava,
  templateForKind,
  type JavaProblem,
} from "@/lib/codeWorkspace";
import {
  DEFAULT_CORS_PROXY,
  cloneEndpoint,
  gitCommitAll,
  gitLog,
  gitPull,
  gitPush,
  gitStatus,
  readWorkingTree,
  writeWorkingTree,
  type GitFileState,
  type GitLogEntry,
} from "@/lib/codeGit";
import { colorForName, createCodeCollab, type CodeCollabSession, type CodeCollabStatus } from "@/lib/codeCollab";
import {
  buildTeamCodeZip,
  browserDirectUpload,
  downloadBlob,
  onBotExport,
  openSerialConsole,
  supportsWebSerial,
  type SerialConsole,
} from "@/lib/revDeploy";
import {
  connectHubUsb,
  isUsbAdbSupported,
  uploadAndBuildViaUsb,
  type HubAdbConnection,
} from "@/lib/hubAdb";
import { askValue, confirmAction } from "@/lib/dialogs";

import { useRealtimeHealthy } from "../realtimeHealth";
type SideTab = "explorer" | "git" | "ai" | "deploy";
type BottomTab = "problems" | "terminal";

const EDITOR_FONT = "font-mono text-[13px] leading-[24px]";

function fileNameOf(path: string): string {
  return path.split("/").pop() ?? path;
}

function dirOf(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function languageOf(path: string): string {
  if (path.endsWith(".java")) return "java";
  if (path.endsWith(".xml") || path.endsWith(".gradle")) return "xml";
  if (path.endsWith(".md")) return "markdown";
  return "text";
}

function extractCodeBlocks(answer: string): { lang: string; code: string }[] {
  const blocks: { lang: string; code: string }[] = [];
  const pattern = /```(\w*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(answer))) {
    blocks.push({ lang: match[1].toLowerCase(), code: match[2].replace(/\n$/, "") });
  }
  return blocks;
}

/** Prefix/suffix diff so local keystrokes merge cleanly with remote Yjs edits. */
function applyLocalEdit(session: CodeCollabSession, prev: string, next: string): void {
  const { text, doc } = session;
  let start = 0;
  while (start < prev.length && start < next.length && prev[start] === next[start]) start += 1;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev -= 1;
    endNext -= 1;
  }
  if (endPrev === start && endNext === start) return;
  doc.transact(() => {
    if (endPrev > start) text.delete(start, endPrev - start);
    if (endNext > start) text.insert(start, next.slice(start, endNext));
  });
}

function JavaEditor({
  session,
  filePath,
  onDirty,
}: {
  session: CodeCollabSession;
  filePath: string;
  onDirty: () => void;
}) {
  const [value, setValue] = useState(() => session.text.toString());
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    setValue(session.text.toString());
  }, [session]);

  useEffect(() => {
    const observer = () => {
      const next = session.text.toString();
      if (next === valueRef.current) return;
      const area = areaRef.current;
      const selStart = area?.selectionStart ?? 0;
      const selEnd = area?.selectionEnd ?? 0;
      const delta = next.length - valueRef.current.length;
      setValue(next);
      onDirty();
      requestAnimationFrame(() => {
        if (area && document.activeElement === area) {
          const clamp = (n: number) => Math.max(0, Math.min(next.length, n + (delta > 0 && selStart >= valueRef.current.length ? 0 : 0)));
          try {
            area.setSelectionRange(clamp(selStart), clamp(selEnd));
          } catch {
            // Selection restore is best-effort during remote edits.
          }
        }
      });
    };
    session.text.observe(observer);
    return () => session.text.unobserve(observer);
  }, [session, onDirty]);

  const lines = useMemo(() => value.split("\n"), [value]);
  const lang = languageOf(filePath);

  const handleChange = (next: string) => {
    const area = areaRef.current;
    setValue(next);
    onDirty();
    applyLocalEdit(session, valueRef.current, next);
    if (area) {
      const pos = area.selectionStart ?? 0;
      const upto = next.slice(0, pos).split("\n");
      setCursor({ line: upto.length, col: (upto[upto.length - 1] ?? "").length + 1 });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const area = event.currentTarget;
      const start = area.selectionStart ?? 0;
      const end = area.selectionEnd ?? 0;
      const next = `${value.slice(0, start)}    ${value.slice(end)}`;
      setValue(next);
      onDirty();
      applyLocalEdit(session, valueRef.current, next);
      requestAnimationFrame(() => {
        try {
          area.setSelectionRange(start + 4, start + 4);
        } catch {
          // Ignore selection races.
        }
      });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-auto bg-[#1e1e1e]" data-testid="code-editor">
      <div className={`select-none px-3 py-4 text-right text-[#858585] ${EDITOR_FONT}`} aria-hidden="true">
        {lines.map((_, index) => (
          <div key={index}>{index + 1}</div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <pre className={`whitespace-pre px-4 py-4 text-[#d4d4d4] ${EDITOR_FONT}`} aria-hidden="true">
          {lines.map((line, index) => (
            <div key={index} className="min-h-[24px]">
              {lang === "java" ? (
                highlightJavaLine(line).map((token, tokenIndex) => (
                  <span
                    key={tokenIndex}
                    className={
                      token.kind === "keyword"
                        ? "text-[#569cd6]"
                        : token.kind === "string"
                          ? "text-[#ce9178]"
                          : token.kind === "comment"
                            ? "text-[#6a9955]"
                            : token.kind === "annotation"
                              ? "text-[#4ec9b0]"
                              : token.kind === "number"
                                ? "text-[#b5cea8]"
                                : token.kind === "type"
                                  ? "text-[#4ec9b0]"
                                  : undefined
                    }
                  >
                    {token.text || " "}
                  </span>
                ))
              ) : (
                <span>{line || " "}</span>
              )}
            </div>
          ))}
        </pre>
        <textarea
          ref={areaRef}
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onSelect={(event) => {
            const area = event.currentTarget;
            const pos = area.selectionStart ?? 0;
            const upto = area.value.slice(0, pos).split("\n");
            setCursor({ line: upto.length, col: (upto[upto.length - 1] ?? "").length + 1 });
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={`Edit ${filePath}. Line ${cursor.line}, column ${cursor.col}.`}
          data-testid="code-textarea"
          data-cursor={`${cursor.line}:${cursor.col}`}
          className={`absolute inset-0 resize-none bg-transparent px-4 py-4 text-transparent caret-white selection:bg-[#264f78] focus:outline-none ${EDITOR_FONT}`}
          style={{ tabSize: 4 }}
        />
      </div>
    </div>
  );
}

export function CodeWorkspacePage() { const streamHealthy = useRealtimeHealthy();
  const queryClient = useQueryClient();
  const session = useGetSession({ query: { queryKey: getGetSessionQueryKey() } });
  const displayName = session.data?.label?.trim() || "Teammate";
  const myColor = useMemo(() => colorForName(displayName), [displayName]);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<SideTab>("explorer");
  const [bottomTab, setBottomTab] = useState<BottomTab>("problems");
  const [bottomOpen, setBottomOpen] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsedDirs, setCollapsedDirs] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  // Collab session for the active file.
  const [collab, setCollab] = useState<CodeCollabSession | null>(null);
  const [collabStatus, setCollabStatus] = useState<CodeCollabStatus>("connecting");
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">("saved");
  const [peers, setPeers] = useState<{ name: string; color: string }[]>([]);
  const dirtyRef = useRef(false);

  // AI pane.
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiIncludeFile, setAiIncludeFile] = useState(true);
  const [lineFrom, setLineFrom] = useState("1");
  const [lineTo, setLineTo] = useState("10");
  const ask = useAskAssistant();

  // Git pane.
  const [remoteUrl, setRemoteUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [corsProxy, setCorsProxy] = useState(DEFAULT_CORS_PROXY);
  const [gitToken, setGitToken] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [gitBusy, setGitBusy] = useState(false);
  const [gitProgress, setGitProgress] = useState<string | null>(null);
  const [gitFiles, setGitFiles] = useState<GitFileState[]>([]);
  const [gitLogEntries, setGitLogEntries] = useState<GitLogEntry[]>([]);

  // Deploy pane.
  const [serialLog, setSerialLog] = useState<string[]>([]);
  const [serialOpen, setSerialOpen] = useState(false);
  const [serialInput, setSerialInput] = useState("");
  const serialRef = useRef<SerialConsole | null>(null);
  const [usbAdb, setUsbAdb] = useState<HubAdbConnection | null>(null);
  const usbAdbRef = useRef<HubAdbConnection | null>(null);
  usbAdbRef.current = usbAdb;
  const [deployBusy, setDeployBusy] = useState(false);
  const [hubUrl, setHubUrl] = useState("http://192.168.43.1:8080");
  const [deployResult, setDeployResult] = useState<string | null>(null);
  const [deployProblems, setDeployProblems] = useState<JavaProblem[]>([]);

  const projectsQuery = { queryKey: getListCodeProjectsQueryKey() };
  const projects = useListCodeProjects({ query: projectsQuery } as never) as unknown as {
    data?: { projects: CodeProject[] };
    isLoading: boolean;
  };
  const projectList = projects.data?.projects ?? [];
  const project = projectList.find((item) => item.id === projectId) ?? null;

  const filesQuery = { queryKey: projectId ? getListCodeFilesQueryKey(projectId) : ["code-files"], enabled: Boolean(projectId) };
  const files = useListCodeFiles(projectId ?? "", { query: filesQuery } as never) as unknown as {
    data?: { files: CodeFile[] };
    isLoading: boolean;
  };
  const fileList = useMemo(
    () => [...(files.data?.files ?? [])].sort((a, b) => a.path.localeCompare(b.path)),
    [files.data],
  );
  const activeFile = fileList.find((file) => file.id === activeId) ?? null;

  const refreshFiles = useCallback(() => {
    if (projectId) void queryClient.invalidateQueries({ queryKey: getListCodeFilesQueryKey(projectId) });
  }, [projectId, queryClient]);

  // Pick the first project once loaded.
  useEffect(() => {
    if (!projectId && projectList.length > 0) setProjectId(projectList[0].id);
  }, [projectId, projectList]);

  // Load saved git endpoint config.
  useEffect(() => {
    if (!project) return;
    const git = (project.gitConfig ?? {}) as Record<string, unknown>;
    if (typeof git.remoteUrl === "string") setRemoteUrl(git.remoteUrl);
    if (typeof git.branch === "string" && git.branch) setBranch(git.branch);
    if (typeof git.corsProxy === "string" && git.corsProxy) setCorsProxy(git.corsProxy);
    if (typeof git.hubUrl === "string" && git.hubUrl) setHubUrl(git.hubUrl);
    else {
      try {
        const saved = window.localStorage.getItem("code-hub-url");
        if (saved) setHubUrl(saved);
      } catch {
        // Hub URL storage is best-effort.
      }
    }
    try {
      const token = window.localStorage.getItem(`code-git-token:${project.id}`) ?? "";
      setGitToken(token);
    } catch {
      setGitToken("");
    }
    setOpenIds([]);
    setActiveId(null);
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collab session lifecycle for the active file.
  useEffect(() => {
    setCollab((current) => {
      current?.destroy();
      return null;
    });
    if (!activeFile) return;
    const created = createCodeCollab(activeFile.id, activeFile.content, { name: displayName, color: myColor });
    setCollab(created);
    const offStatus = created.subscribeStatus(setCollabStatus);
    const offSave = created.subscribeSaveStatus(setSaveStatus);
    const offPeers = created.subscribePeers(setPeers);
    dirtyRef.current = false;
    return () => {
      offStatus();
      offSave();
      offPeers();
      created.destroy();
    };
  }, [activeFile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Presence heartbeat + roster.
  const [roster, setRoster] = useState<{ displayName: string; fileId: string | null; color: string }[]>([]);
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    const beat = () => {
      void updateCodePresence(projectId, { fileId: activeId ?? null, color: myColor }).catch(() => undefined);
      void listCodePresence(projectId)
        .then((result) => {
          if (alive) setRoster(result.presence.map((item) => ({ ...item, fileId: item.fileId ?? null })));
        })
        .catch(() => undefined);
    };
    beat();
    const timer = setInterval(beat, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [projectId, activeId, myColor]);

  const flushActiveFile = useCallback(async () => {
    if (!collab || !activeFile) return;
    const content = collab.text.toString();
    if (content === activeFile.content) return;
    await updateCodeFile(activeFile.id, { content });
    refreshFiles();
  }, [collab, activeFile, refreshFiles]);

  const openFile = (id: string) => {
    setOpenIds((current) => (current.includes(id) ? current : [...current, id]));
    setActiveId(id);
  };

  const closeFile = (id: string) => {
    setOpenIds((current) => current.filter((entry) => entry !== id));
    if (activeId === id) {
      const remaining = openIds.filter((entry) => entry !== id);
      setActiveId(remaining[remaining.length - 1] ?? null);
    }
  };

  const createProject = async () => {
    const name = await askValue({ title: "New FTC project", label: "Project name", placeholder: "BioBuzz Bot" });
    if (!name) return;
    setError(null);
    try {
      const result = await createCodeProject({ name, sdkVersion: BIOBUZZ_SDK_VERSION });
      await queryClient.invalidateQueries({ queryKey: getListCodeProjectsQueryKey() });
      setProjectId(result.project.id);
      setNotice(`Created ${result.project.name}. Seed the BIOBUZZ starter to begin.`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not create this project.");
    }
  };

  const seedProject = async () => {
    if (!project) return;
    setError(null);
    try {
      for (const seed of defaultSeedFiles(project.name)) {
        await createCodeFile({ projectId: project.id, path: seed.path, content: seed.content });
      }
      refreshFiles();
      setNotice("Seeded the BIOBUZZ starter (TeleOp, Auto with cluster handling, README).");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not seed this project.");
    }
  };

  const createFile = async () => {
    if (!project) return;
    const path = await askValue({
      title: "New file",
      label: "Path",
      placeholder: "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/MyOpMode.java",
    });
    if (!path) return;
    setError(null);
    try {
      const isJava = path.trim().endsWith(".java");
      const result = await createCodeFile({
        projectId: project.id,
        path: path.trim(),
        content: isJava ? templateForKind("teleop", project.name) : "",
      });
      refreshFiles();
      openFile(result.file.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not create this file.");
    }
  };

  const deleteProject = async () => {
    if (!project) return;
    if (!(await confirmAction({ title: `Delete "${project.name}" and all of its files?`, danger: true, confirmLabel: "Delete" }))) return;
    try {
      await deleteCodeProject(project.id);
      setProjectId(null);
      await queryClient.invalidateQueries({ queryKey: getListCodeProjectsQueryKey() });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not delete this project.");
    }
  };

  const deleteFile = async (file: CodeFile) => {
    if (!(await confirmAction({ title: `Delete "${file.path}"?`, danger: true, confirmLabel: "Delete" }))) return;
    try {
      await deleteCodeFile(file.id);
      closeFile(file.id);
      refreshFiles();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not delete this file.");
    }
  };

  const activeContent = collab ? collab.text.toString() : (activeFile?.content ?? "");
  const problems: JavaProblem[] = useMemo(
    () => (activeFile && activeFile.path.endsWith(".java") ? lintJava(activeContent, activeFile.path) : []),
    [activeContent, activeFile],
  );
  const errorCount =
    problems.filter((item) => item.severity === "error").length +
    deployProblems.filter((item) => item.severity === "error").length;

  // --- AI assistant ---------------------------------------------------------
  const runAi = () => {
    if (!aiPrompt.trim() || !project) return;
    setError(null);
    const context = [
      `Project: ${project.name} (FTC SDK ${BIOBUZZ_SDK_VERSION}, JDK 21 toolchain, Java 8 source level).`,
      aiIncludeFile && activeFile
        ? `Open file ${activeFile.path}:\n\`\`\`java\n${activeContent.slice(0, 12000)}\n\`\`\`\nProject files:\n${fileList.map((file) => ` - ${file.path}`).join("\n")}`
        : `Project files:\n${fileList.map((file) => ` - ${file.path}`).join("\n")}`,
    ].join("\n\n");
    ask.mutate(
      { data: { question: `${aiPrompt.trim()}\n\n${context}` } },
      {
        onSuccess: (result) => setAiAnswer(result.answer),
        onError: (askError) => setError(askError instanceof Error ? askError.message : "The assistant could not answer."),
      },
    );
  };

  const applyAiBlock = (code: string, mode: "replace" | "insert" | "lines") => {
    if (!collab || !activeFile) {
      setError("Open a file before applying an AI edit.");
      return;
    }
    dirtyRef.current = true;
    if (mode === "insert") {
      const current = collab.text.toString();
      collab.text.insert(current.length ? current.length : 0, `\n${code}\n`);
    } else if (mode === "lines") {
      const from = Math.max(1, Number.parseInt(lineFrom, 10) || 1);
      const to = Math.max(from, Number.parseInt(lineTo, 10) || from);
      const lines = collab.text.toString().split("\n");
      const start = lines.slice(0, from - 1).join("\n").length + (from > 1 ? 1 : 0);
      const end = lines.slice(0, to).join("\n").length;
      collab.doc.transact(() => {
        collab.text.delete(start, Math.max(0, end - start));
        collab.text.insert(start, code);
      });
      setNotice(`Replaced lines ${from}–${to} in ${fileNameOf(activeFile.path)}. Press Save to persist.`);
    } else {
      const current = collab.text.toString();
      collab.doc.transact(() => {
        collab.text.delete(0, current.length);
        collab.text.insert(0, code);
      });
      setNotice(`Replaced ${fileNameOf(activeFile.path)} with the AI suggestion. Press Save to persist.`);
    }
  };

  // --- Git ------------------------------------------------------------------
  const gitScope = project ? `code-${project.id}` : "code";
  const persistGitConfig = async () => {
    if (!project) return;
    try {
      window.localStorage.setItem(`code-git-token:${project.id}`, gitToken);
    } catch {
      // Token storage is best-effort; the token never leaves the browser otherwise.
    }
    await updateCodeProject(project.id, { gitConfig: { remoteUrl, branch, corsProxy, hubUrl } as unknown as Record<string, never> });
    await queryClient.invalidateQueries({ queryKey: getListCodeProjectsQueryKey() });
  };

  const withGit = async (label: string, action: () => Promise<void>) => {
    setGitBusy(true);
    setGitProgress(label);
    setError(null);
    try {
      await action();
      setGitProgress(null);
    } catch (actionError) {
      setGitProgress(null);
      setError(actionError instanceof Error ? actionError.message : "The git operation failed.");
    } finally {
      setGitBusy(false);
    }
  };

  const gitClone = () =>
    withGit("Cloning…", async () => {
      if (!remoteUrl.trim()) throw new Error("Enter a git endpoint URL first.");
      await cloneEndpoint({
        scope: gitScope,
        url: remoteUrl.trim(),
        ref: branch.trim() || "main",
        corsProxy: corsProxy.trim() || DEFAULT_CORS_PROXY,
        token: gitToken.trim() || undefined,
        onProgress: (phase, loaded, total) =>
          setGitProgress(`Cloning ${phase} ${loaded}${total ? `/${total}` : ""}…`),
      });
      const tree = await readWorkingTree(gitScope);
      if (!project) return;
      for (const entry of tree) {
        if (entry.path === ".git") continue;
        await createCodeFile({ projectId: project.id, path: entry.path, content: entry.content.slice(0, 500_000) });
      }
      refreshFiles();
      setGitFiles(await gitStatus(gitScope));
      setGitLogEntries(await gitLog(gitScope));
      setNotice(`Cloned ${tree.length} files from the endpoint.`);
    });

  const gitRefresh = async () => {
    setGitFiles(await gitStatus(gitScope).catch(() => []));
    setGitLogEntries(await gitLog(gitScope).catch(() => []));
  };

  const gitCommitPush = () =>
    withGit("Pushing…", async () => {
      if (!project) return;
      if (!remoteUrl.trim()) throw new Error("Enter a git endpoint URL first.");
      await writeWorkingTree(
        gitScope,
        fileList.map((file) => ({
          path: file.path,
          content: file.id === activeId && collab ? collab.text.toString() : file.content,
        })),
      );
      await gitCommitAll(gitScope, commitMessage.trim() || "Checkpoint from Code workspace", { name: displayName });
      await createCodeRevision(project.id, { message: commitMessage.trim() || "Checkpoint from Code workspace" });
      await queryClient.invalidateQueries({ queryKey: getListCodeRevisionsQueryKey(project.id) });
      await gitPush({
        scope: gitScope,
        url: remoteUrl.trim(),
        ref: branch.trim() || "main",
        token: gitToken.trim() || undefined,
        corsProxy: corsProxy.trim() || DEFAULT_CORS_PROXY,
      });
      setCommitMessage("");
      await gitRefresh();
      setNotice("Committed locally and pushed to the endpoint.");
    });

  const gitPullInto = () =>
    withGit("Pulling…", async () => {
      if (!project) return;
      await gitPull({
        scope: gitScope,
        ref: branch.trim() || "main",
        token: gitToken.trim() || undefined,
        corsProxy: corsProxy.trim() || DEFAULT_CORS_PROXY,
        authorName: displayName,
      });
      const tree = await readWorkingTree(gitScope);
      for (const entry of tree) {
        await createCodeFile({ projectId: project.id, path: entry.path, content: entry.content.slice(0, 500_000) });
      }
      refreshFiles();
      await gitRefresh();
      setNotice(`Pulled and imported ${tree.length} files.`);
    });

  // --- Deploy ---------------------------------------------------------------
  const deployLog = (line: string) =>
    setSerialLog((current) => [...current.slice(-299), line]);

  const downloadZip = () => {
    if (!project) return;
    setDeployBusy(true);
    try {
      const zip = buildTeamCodeZip(
        project.name,
        fileList.map((file) => ({
          path: file.path,
          content: file.id === activeId && collab ? collab.text.toString() : file.content,
        })),
      );
      downloadBlob(`${project.name.replace(/\s+/g, "-")}-TeamCode.zip`, zip, "application/zip");
      deployLog(`Built ${project.name}-TeamCode.zip (${fileList.length} files).`);
    } finally {
      setDeployBusy(false);
    }
  };

  const downloadOnBot = () => {
    if (!activeFile) return;
    const content = collab ? collab.text.toString() : activeFile.content;
    downloadBlob(fileNameOf(activeFile.path), content, "text/x-java-source");
    deployLog(`Exported ${fileNameOf(activeFile.path)} for OnBotJava upload.`);
  };

  const currentFiles = () =>
    fileList.map((file) => ({
      path: file.path,
      content: file.id === activeId && collab ? collab.text.toString() : file.content,
    }));

  /** Pull hub compiler errors out of the javac log into the Problems panel. */
  const parseHubLog = (log: string): JavaProblem[] => {
    const found: JavaProblem[] = [];
    const pattern = /(\S+\.java):(\d+):(\d+):\s*(warning:)?\s*([^\n]{1,300})/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(log)) && found.length < 50) {
      found.push({
        line: Number(match[2]),
        column: Number(match[3]),
        severity: match[4] ? "warning" : "error",
        message: `Hub build — ${match[1].split("/").pop()}: ${match[5].trim()}`,
      });
    }
    return found;
  };

  const uploadAndBuild = async () => {
    if (!project || deployBusy) return;
    if (!/^https?:\/\//i.test(hubUrl.trim())) {
      setError("Enter the hub address, e.g. http://192.168.43.1:8080. It stays an address — nothing opens.");
      return;
    }
    setDeployBusy(true);
    setError(null);
    setDeployResult(null);
    setDeployProblems([]);
    try {
      window.localStorage.setItem("code-hub-url", hubUrl.trim());
    } catch {
      // Best-effort.
    }
    setBottomTab("terminal");
    setBottomOpen(true);
    const files = currentFiles();
    deployLog(`Uploading ${files.length} project files to ${hubUrl.trim()} from this dashboard…`);
    try {
      const result = await deployCodeProject(project.id, {
        hubBaseUrl: hubUrl.trim(),
        files,
      });
      for (const skipped of result.skipped) deployLog(`Skipped ${skipped.path} (${skipped.reason}).`);
      deployLog(`Saved ${result.pushed.length} files on the hub. Build ${result.buildStarted ? "started" : "did not start"}…`);
      if (result.buildSuccessful === true) {
        setDeployResult(`Build succeeded on the hub — ${result.pushed.length} files live. Check the Driver Station OpMode list.`);
        deployLog("Build succeeded on the hub.");
        setNotice(`Uploaded ${result.pushed.length} files and the hub build succeeded.`);
      } else {
        const hubErrors = parseHubLog(result.log ?? "");
        setDeployProblems(hubErrors);
        setDeployResult(
          result.buildSuccessful === false
            ? `Hub build failed with ${hubErrors.length || "compiler"} error(s) — see Problems and the terminal log.`
            : "Upload finished but the build status is unknown — check the terminal log.",
        );
        for (const line of (result.log ?? "").split("\n").slice(-30)) {
          if (line.trim()) deployLog(`[hub] ${line.trim()}`);
        }
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The hub upload failed.");
      deployLog("Upload failed. Is this dashboard server on the same network as the hub?");
    } finally {
      setDeployBusy(false);
    }
  };

  const uploadFromBrowser = async () => {
    if (!project || deployBusy) return;
    if (!/^https?:\/\//i.test(hubUrl.trim())) {
      setError("Enter the hub address first, e.g. http://192.168.43.1:8080.");
      return;
    }
    setDeployBusy(true);
    setError(null);
    setBottomTab("terminal");
    setBottomOpen(true);
    try {
      const sent = await browserDirectUpload(hubUrl.trim(), currentFiles(), deployLog);
      setDeployResult(
        sent > 0
          ? `Sent ${sent} files from this browser and triggered the hub build. Confirm on the Driver Station list.`
          : "Nothing to send — the project has no Java files.",
      );
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The browser upload failed.");
    } finally {
      setDeployBusy(false);
    }
  };

  const toggleSerial = async () => {
    if (serialRef.current) {
      await serialRef.current.close();
      serialRef.current = null;
      setSerialOpen(false);
      deployLog("Serial console closed.");
      return;
    }
    if (!supportsWebSerial()) {
      setError("WebSerial is not available. Use Chrome or Edge on desktop.");
      return;
    }
    try {
      const console_ = await openSerialConsole({
        onLine: (line) => deployLog(`[hub] ${line}`),
        onError: (message) => deployLog(`[serial error] ${message}`),
      });
      serialRef.current = console_;
      setSerialOpen(true);
      setBottomTab("terminal");
      setBottomOpen(true);
      deployLog("Serial console open at 115200 8N1. Expansion Hub FTDI debugging ready.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not open the serial port.");
    }
  };

  const sendSerial = async () => {
    if (!serialRef.current || !serialInput.trim()) return;
    try {
      await serialRef.current.send(serialInput.trim());
      deployLog(`[you] ${serialInput.trim()}`);
      setSerialInput("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not write to the serial port.");
    }
  };

  const connectUsbAdb = async () => {
    if (usbAdbRef.current) {
      await usbAdbRef.current.close().catch(() => undefined);
      setUsbAdb(null);
      deployLog("USB ADB connection closed.");
      return;
    }
    if (!isUsbAdbSupported()) {
      setError("WebUSB is not available. Use Chrome or Edge on desktop over HTTPS.");
      return;
    }
    setError(null);
    try {
      const connection = await connectHubUsb((line) => deployLog(line));
      setUsbAdb(connection);
      setBottomTab("terminal");
      setBottomOpen(true);
    } catch (actionError) {
      if (actionError instanceof Error && actionError.name === "NotFoundError") return;
      setError(actionError instanceof Error ? actionError.message : "Could not open the hub over USB.");
    }
  };

  const uploadViaUsb = async () => {
    if (!project || deployBusy) return;
    if (!usbAdbRef.current) {
      setError("Connect the hub over USB first, then upload.");
      return;
    }
    setDeployBusy(true);
    setError(null);
    setDeployResult(null);
    setDeployProblems([]);
    setBottomTab("terminal");
    setBottomOpen(true);
    try {
      const result = await uploadAndBuildViaUsb(usbAdbRef.current, currentFiles(), (line) => deployLog(line));
      for (const skipped of result.skipped) deployLog(`Skipped ${skipped.path} (${skipped.reason}).`);
      if (result.buildSuccessful === true) {
        setDeployResult(`Hub build succeeded over USB — ${result.pushed.length} files live. Check the Driver Station OpMode list.`);
        setNotice(`Uploaded ${result.pushed.length} files over USB and the hub build succeeded.`);
      } else {
        const hubErrors = parseHubLog(result.log);
        setDeployProblems(hubErrors);
        setDeployResult(
          result.buildSuccessful === false
            ? `Hub build failed with ${hubErrors.length || "compiler"} error(s) — see Problems and the terminal log.`
            : "Upload finished but the build status is unknown — check the terminal log.",
        );
        for (const line of result.log.split("\n").slice(-30)) {
          if (line.trim()) deployLog(`[hub] ${line.trim()}`);
        }
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The USB upload failed.");
    } finally {
      setDeployBusy(false);
    }
  };

  useEffect(
    () => () => {
      void serialRef.current?.close().catch(() => undefined);
      void usbAdbRef.current?.close().catch(() => undefined);
    },
    [],
  );

  // --- File tree ------------------------------------------------------------
  const needle = search.trim().toLowerCase();
  const visibleFiles = needle
    ? fileList.filter((file) => file.path.toLowerCase().includes(needle))
    : fileList;
  const tree = useMemo(() => {
    const dirs = new Map<string, CodeFile[]>();
    const roots: CodeFile[] = [];
    for (const file of visibleFiles) {
      const dir = dirOf(file.path);
      if (!dir) roots.push(file);
      else {
        const list = dirs.get(dir) ?? [];
        list.push(file);
        dirs.set(dir, list);
      }
    }
    return { dirs: [...dirs.entries()].sort(([a], [b]) => a.localeCompare(b)), roots };
  }, [visibleFiles]);

  const revisions = useListCodeRevisions(projectId ?? "", {
    query: projectId
      ? { queryKey: getListCodeRevisionsQueryKey(projectId), refetchInterval: streamHealthy ? false : (10000 )}
      : { queryKey: ["code-revisions"], enabled: false },
  } as never) as unknown as { data?: { revisions: { id: string; message: string; author: string | null; createdAt: string }[] } };

  return (
    <div className="space-y-4" data-testid="code-workspace">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mono mb-2 text-[10px] font-medium uppercase tracking-[.22em] text-primary">Code workspace</p>
          <h1 className="text-3xl font-semibold tracking-[-.045em] md:text-4xl">Robot code</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            FTC Java for BIOBUZZ (SDK {BIOBUZZ_SDK_VERSION}) — JDK 21 toolchain, Java 8 source level. Edit together live,
            commit to any git endpoint, and deploy over USB.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={projectId ?? ""}
            onChange={(event) => setProjectId(event.target.value || null)}
            aria-label="Code project"
            data-testid="code-project-select"
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
          >
            {projectList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={createProject} data-testid="code-new-project">
            <Plus size={14} aria-hidden="true" /> Project
          </Button>
          {project && (
            <Button type="button" variant="ghost" size="sm" onClick={deleteProject} data-testid="code-delete-project">
              <Trash2 size={14} aria-hidden="true" />
            </Button>
          )}
          <div className="flex -space-x-1.5" title="Collaborators here now">
            {roster.slice(0, 6).map((person) => (
              <span
                key={person.displayName}
                title={person.displayName}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-[10px] font-bold text-[#1d2c36]"
                style={{ backgroundColor: person.color }}
              >
                {person.displayName.slice(0, 2).toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </header>

      {(notice || error) && (
        <div
          role="status"
          data-testid="code-notice"
          className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-card"}`}
        >
          {error ?? notice}
        </div>
      )}

      {!project ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Files size={28} className="text-muted-foreground" aria-hidden="true" />
          <p className="font-semibold">No code project yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Create a project to start editing FTC Java together.</p>
          <Button type="button" onClick={createProject} data-testid="code-new-project-empty">
            <Plus size={15} aria-hidden="true" /> New project
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-[#1e1e1e] text-[#d4d4d4]">
          {/* IDE toolbar */}
          <div className="flex items-center gap-2 border-b border-white/10 bg-[#252526] px-3 py-2">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </span>
            <span className="mono ml-2 truncate text-[11px] text-[#9d9d9d]" data-testid="code-project-name">
              {project.name} · SDK {project.sdkVersion}
            </span>
            <span className="ml-auto flex items-center gap-2 text-[11px] text-[#9d9d9d]">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                  collabStatus === "connected" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                }`}
                data-testid="code-collab-status"
              >
                <Users size={11} aria-hidden="true" />
                {collabStatus === "connected" ? `Live${peers.length ? ` · ${peers.length}` : ""}` : collabStatus}
              </span>
              <span data-testid="code-save-status" className="inline-flex items-center gap-1">
                {saveStatus === "saving" ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                {saveStatus}
              </span>
            </span>
          </div>

          <div className="flex min-h-[540px]">
            {/* Activity bar */}
            <div className="flex w-12 flex-col items-center gap-1 border-r border-white/10 bg-[#252526] py-2" role="tablist" aria-label="IDE side panels">
              {(
                [
                  { key: "explorer", icon: Files, label: "Explorer" },
                  { key: "git", icon: GitBranch, label: "Git" },
                  { key: "ai", icon: Bot, label: "AI assistant" },
                  { key: "deploy", icon: Usb, label: "Deploy" },
                ] as const
              ).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={sideTab === key}
                  title={label}
                  aria-label={label}
                  data-testid={`code-side-${key}`}
                  onClick={() => setSideTab(key)}
                  className={`rounded-lg p-2.5 transition ${sideTab === key ? "bg-white/10 text-white" : "text-[#858585] hover:text-white"}`}
                >
                  <Icon size={19} aria-hidden="true" />
                </button>
              ))}
            </div>

            {/* Side panel */}
            <div className="hidden w-[280px] shrink-0 flex-col border-r border-white/10 bg-[#252526] sm:flex" data-testid="code-side-panel">
              {sideTab === "explorer" && (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#9d9d9d]">
                    <span>Explorer</span>
                    <span className="flex gap-1">
                      <button type="button" title="New file" aria-label="New file" data-testid="code-new-file" onClick={createFile} className="rounded p-1 hover:bg-white/10 hover:text-white">
                        <FileText size={14} aria-hidden="true" />
                      </button>
                      <button type="button" title="Seed BIOBUZZ starter" aria-label="Seed BIOBUZZ starter" data-testid="code-seed" onClick={seedProject} className="rounded p-1 hover:bg-white/10 hover:text-white">
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                  <div className="px-3 pb-2">
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter files" aria-label="Filter files" data-testid="code-search" className="h-8 border-white/10 bg-[#1e1e1e] text-sm text-white placeholder:text-[#6a6a6a]" />
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto px-1 pb-3">
                    {fileList.length === 0 && (
                      <button type="button" onClick={seedProject} data-testid="code-seed-empty" className="mx-2 mt-2 rounded-lg border border-dashed border-white/20 p-3 text-left text-xs text-[#9d9d9d] hover:border-white/40 hover:text-white">
                        Empty project — seed the BIOBUZZ starter (TeleOp + Auto + README).
                      </button>
                    )}
                    {tree.roots.map((file) => (
                      <FileRow key={file.id} file={file} active={file.id === activeId} onOpen={() => openFile(file.id)} onDelete={() => deleteFile(file)} />
                    ))}
                    {tree.dirs.map(([dir, dirFiles]) => {
                      const collapsed = collapsedDirs[dir] ?? false;
                      return (
                        <div key={dir}>
                          <button
                            type="button"
                            onClick={() => setCollapsedDirs((current) => ({ ...current, [dir]: !collapsed }))}
                            className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[12px] font-semibold text-[#c5c5c5] hover:bg-white/5"
                          >
                            {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                            {collapsed ? <Folder size={13} /> : <FolderOpen size={13} />}
                            <span className="truncate">{dir}</span>
                          </button>
                          {!collapsed &&
                            dirFiles.map((file) => (
                              <div key={file.id} className="pl-4">
                                <FileRow file={file} active={file.id === activeId} onOpen={() => openFile(file.id)} onDelete={() => deleteFile(file)} />
                              </div>
                            ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sideTab === "git" && (
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 text-[12px]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9d9d9d]">Git endpoint</p>
                  <label className="block">
                    <span className="mb-1 block text-[#9d9d9d]">Repository URL (any HTTPS git host)</span>
                    <Input value={remoteUrl} onChange={(event) => setRemoteUrl(event.target.value)} placeholder="https://github.com/team/robot-code.git" data-testid="code-git-url" className="h-8 border-white/10 bg-[#1e1e1e] text-white placeholder:text-[#6a6a6a]" />
                  </label>
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <span className="mb-1 block text-[#9d9d9d]">Branch</span>
                      <Input value={branch} onChange={(event) => setBranch(event.target.value)} data-testid="code-git-branch" className="h-8 border-white/10 bg-[#1e1e1e] text-white" />
                    </label>
                    <label className="flex-1">
                      <span className="mb-1 block text-[#9d9d9d]">Token</span>
                      <Input type="password" value={gitToken} onChange={(event) => setGitToken(event.target.value)} placeholder="PAT (browser only)" data-testid="code-git-token" className="h-8 border-white/10 bg-[#1e1e1e] text-white placeholder:text-[#6a6a6a]" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[#9d9d9d]">CORS proxy</span>
                    <Input value={corsProxy} onChange={(event) => setCorsProxy(event.target.value)} data-testid="code-git-proxy" className="h-8 border-white/10 bg-[#1e1e1e] text-white" />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <Button type="button" size="sm" variant="outline" disabled={gitBusy} onClick={gitClone} data-testid="code-git-clone" className="border-white/15 bg-transparent text-white hover:bg-white/10">
                      {gitBusy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Clone
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={gitBusy} onClick={gitPullInto} data-testid="code-git-pull" className="border-white/15 bg-transparent text-white hover:bg-white/10">
                      <RefreshCw size={13} /> Pull
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={gitBusy} onClick={() => { void persistGitConfig(); setNotice("Git endpoint saved on the project. The token stays in this browser."); }} data-testid="code-git-save" className="border-white/15 bg-transparent text-white hover:bg-white/10">
                      <Save size={13} /> Save
                    </Button>
                  </div>
                  {gitProgress && <p className="text-[#9d9d9d]" role="status">{gitProgress}</p>}
                  <label className="block">
                    <span className="mb-1 block text-[#9d9d9d]">Commit message</span>
                    <Input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Tune auto shooter speeds" data-testid="code-git-message" className="h-8 border-white/10 bg-[#1e1e1e] text-white placeholder:text-[#6a6a6a]" />
                  </label>
                  <Button type="button" size="sm" disabled={gitBusy} onClick={gitCommitPush} data-testid="code-git-commit-push" className="bg-[#0e639c] text-white hover:bg-[#1177bb]">
                    Commit + push
                  </Button>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#9d9d9d]">Changes</p>
                    {gitFiles.length === 0 && <p className="text-[#6a6a6a]">No local git checkout yet — clone first.</p>}
                    {gitFiles.filter((entry) => entry.status !== "unmodified").slice(0, 30).map((entry) => (
                      <div key={entry.path} className="flex items-center gap-2 truncate py-0.5" data-testid={`code-git-file-${entry.path}`}>
                        <span className={`mono w-4 font-bold ${entry.status === "added" ? "text-emerald-400" : entry.status === "removed" ? "text-red-400" : "text-amber-300"}`}>
                          {entry.status === "added" ? "A" : entry.status === "removed" ? "D" : "M"}
                        </span>
                        <span className="truncate">{entry.path}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#9d9d9d]">History</p>
                    {(revisions.data?.revisions ?? []).slice(0, 10).map((rev) => (
                      <div key={rev.id} className="py-0.5" data-testid={`code-revision-${rev.id}`}>
                        <p className="truncate text-white">{rev.message}</p>
                        <p className="text-[#6a6a6a]">{rev.author ?? "Teammate"} · {new Date(rev.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                    {gitLogEntries.slice(0, 5).map((entry) => (
                      <div key={entry.oid} className="py-0.5">
                        <p className="truncate text-white">{entry.message}</p>
                        <p className="text-[#6a6a6a]">{entry.oid} · {entry.author}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sideTab === "ai" && (
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3 text-[12px]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9d9d9d]">AI assistant</p>
                  <label className="flex items-center gap-2 text-[#c5c5c5]">
                    <input type="checkbox" checked={aiIncludeFile} onChange={(event) => setAiIncludeFile(event.target.checked)} data-testid="code-ai-include" />
                    Include open file as context
                  </label>
                  <textarea
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder="Add a slow-mode toggle on gamepad1.a…"
                    aria-label="Ask the coding assistant"
                    data-testid="code-ai-prompt"
                    rows={4}
                    className="resize-none rounded-lg border border-white/10 bg-[#1e1e1e] p-2 text-white placeholder:text-[#6a6a6a] focus:outline-none focus:ring-1 focus:ring-[#0e639c]"
                  />
                  <Button type="button" size="sm" disabled={ask.isPending || !aiPrompt.trim()} onClick={runAi} data-testid="code-ai-ask" className="bg-[#0e639c] text-white hover:bg-[#1177bb]">
                    {ask.isPending ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />} Ask
                  </Button>
                  {aiAnswer && (
                    <div className="rounded-lg border border-white/10 bg-[#1e1e1e] p-2" data-testid="code-ai-answer">
                      <p className="whitespace-pre-wrap text-[#d4d4d4]">{aiAnswer.slice(0, 4000)}</p>
                      {extractCodeBlocks(aiAnswer).map((block, index) => (
                        <div key={index} className="mt-2 rounded border border-white/10 p-2">
                          <p className="mb-1 text-[#9d9d9d]">Suggestion {index + 1}{block.lang ? ` · ${block.lang}` : ""}</p>
                          <div className="flex flex-wrap gap-1.5">
                            <Button type="button" size="sm" variant="outline" onClick={() => applyAiBlock(block.code, "replace")} data-testid={`code-ai-apply-${index}`} className="border-white/15 bg-transparent text-white hover:bg-white/10">Replace file</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => applyAiBlock(block.code, "insert")} data-testid={`code-ai-insert-${index}`} className="border-white/15 bg-transparent text-white hover:bg-white/10">Insert</Button>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5">
                            <Input value={lineFrom} onChange={(event) => setLineFrom(event.target.value)} aria-label="From line" className="h-7 w-14 border-white/10 bg-[#252526] text-white" />
                            <span className="text-[#6a6a6a]">–</span>
                            <Input value={lineTo} onChange={(event) => setLineTo(event.target.value)} aria-label="To line" className="h-7 w-14 border-white/10 bg-[#252526] text-white" />
                            <Button type="button" size="sm" variant="outline" onClick={() => applyAiBlock(block.code, "lines")} data-testid={`code-ai-lines-${index}`} className="border-white/15 bg-transparent text-white hover:bg-white/10">Replace lines</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {sideTab === "deploy" && (
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 text-[12px]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9d9d9d]">Deploy · upload from this dashboard</p>
                  <div className="rounded-lg border border-white/10 p-2">
                    <p className="mb-1.5 font-semibold text-white">
                      Hub over USB {usbAdb && <span className="text-emerald-300">· {usbAdb.label} connected</span>}
                    </p>
                    {!usbAdb ? (
                      <p className="mb-1.5 text-[#6a6a6a]">Plug the hub in over USB-C. Works from anywhere — even with the dashboard hosted in the cloud.</p>
                    ) : (
                      <p className="mono mb-1.5 text-[11px] text-[#9d9d9d]" data-testid="code-usb-summary">ADB serial {usbAdb.serial}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <Button type="button" size="sm" variant="outline" onClick={connectUsbAdb} data-testid="code-usb-connect" className="border-white/15 bg-transparent text-white hover:bg-white/10">
                        <Usb size={13} /> {usbAdb ? "Disconnect" : "Connect hub over USB"}
                      </Button>
                      <Button type="button" size="sm" disabled={deployBusy || !usbAdb || fileList.length === 0} onClick={uploadViaUsb} data-testid="code-deploy-usb" className="bg-[#0e639c] text-white hover:bg-[#1177bb]">
                        {deployBusy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload + Build via USB
                      </Button>
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[#9d9d9d]">Hub address (just an address — nothing opens)</span>
                    <Input value={hubUrl} onChange={(event) => setHubUrl(event.target.value)} placeholder="http://192.168.43.1:8080" data-testid="code-hub-url" className="h-8 border-white/10 bg-[#1e1e1e] text-white placeholder:text-[#6a6a6a]" />
                  </label>
                  <Button type="button" size="sm" disabled={deployBusy || fileList.length === 0} onClick={uploadAndBuild} data-testid="code-deploy-upload" className="justify-start bg-[#0e639c] text-white hover:bg-[#1177bb]">
                    {deployBusy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload + Build on Hub
                  </Button>
                  {deployResult && (
                    <p role="status" data-testid="code-deploy-result" className="rounded-lg border border-white/10 bg-[#1e1e1e] p-2 text-[#d4d4d4]">
                      {deployResult}
                    </p>
                  )}
                  <Button type="button" size="sm" variant="outline" disabled={deployBusy || fileList.length === 0} onClick={uploadFromBrowser} data-testid="code-deploy-browser" className="justify-start border-white/15 bg-transparent text-white hover:bg-white/10">
                    <Upload size={13} /> Upload from this browser instead
                  </Button>
                  <p className="-mt-1 text-[#6a6a6a]">Fallback when the dashboard server cannot see the hub. Sends files straight from this tab; build errors will not come back here.</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9d9d9d]">Other routes</p>
                  <Button type="button" size="sm" variant="outline" disabled={deployBusy} onClick={downloadZip} data-testid="code-deploy-zip" className="justify-start border-white/15 bg-transparent text-white hover:bg-white/10">
                    <Download size={13} /> Download TeamCode ZIP
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={!activeFile} onClick={downloadOnBot} data-testid="code-deploy-onbot" className="justify-start border-white/15 bg-transparent text-white hover:bg-white/10">
                    <FileText size={13} /> Export open file for OnBotJava
                  </Button>
                  <div className="rounded-lg border border-white/10 p-2">
                    <p className="mb-1 font-semibold text-white">Serial console {serialOpen && <span className="text-emerald-300">· open</span>}</p>
                    <p className="mb-1.5 text-[#6a6a6a]">115200 8N1 — Expansion Hub FTDI debugging.</p>
                    <Button type="button" size="sm" variant="outline" onClick={toggleSerial} data-testid="code-serial-toggle" className="border-white/15 bg-transparent text-white hover:bg-white/10">
                      <SquareTerminal size={13} /> {serialOpen ? "Close console" : "Open console"}
                    </Button>
                  </div>
                  <ol className="list-decimal space-y-1 pl-4 text-[#9d9d9d]">
                    <li>Save + fix every red problem below.</li>
                    <li>Press Upload + Build on Hub — files go straight from this dashboard.</li>
                    <li>Pick the new OpMode on the Driver Station list.</li>
                  </ol>
                </div>
              )}
            </div>
          </div>

          {/* Editor column */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-white/10 bg-[#252526] px-2" role="tablist" aria-label="Open files">
              {openIds.map((id) => {
                const file = fileList.find((entry) => entry.id === id);
                if (!file) return null;
                const active = id === activeId;
                return (
                  <div
                    key={id}
                    role="tab"
                    aria-selected={active}
                    data-testid={`code-tab-${file.path}`}
                    className={`flex shrink-0 items-center gap-1.5 border-t-2 px-3 py-2 text-[12px] ${active ? "border-[#0e639c] bg-[#1e1e1e] text-white" : "border-transparent text-[#9d9d9d] hover:text-white"}`}
                  >
                    <button type="button" onClick={() => setActiveId(id)} className="truncate">
                      {fileNameOf(file.path)}
                    </button>
                    <button type="button" aria-label={`Close ${file.path}`} onClick={() => closeFile(id)} className="rounded p-0.5 hover:bg-white/10">
                      <X size={12} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
              <div className="ml-auto flex items-center gap-2 py-1 pr-1">
                {peers.filter((peer) => peer.name !== displayName).slice(0, 4).map((peer) => (
                  <span key={peer.name} title={`${peer.name} is editing here`} className="h-5 w-5 rounded-full text-center text-[9px] font-bold leading-5 text-[#1d2c36]" style={{ backgroundColor: peer.color }}>
                    {peer.name.slice(0, 1).toUpperCase()}
                  </span>
                ))}
                <Button
                  type="button"
                  size="sm"
                  disabled={!collab || !activeFile}
                  onClick={() => {
                    void flushActiveFile().then(() => setNotice("Saved."));
                  }}
                  data-testid="code-save"
                  className="h-7 bg-[#0e639c] text-white hover:bg-[#1177bb]"
                >
                  <Save size={13} /> Save
                </Button>
              </div>
            </div>

            {/* Editor */}
            <div className="flex min-h-[380px] flex-1 flex-col">
              {!activeFile || !collab ? (
                <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-[#858585]">
                  {fileList.length === 0 ? "Seed the BIOBUZZ starter from the Explorer to begin." : "Pick a file from the Explorer to start editing together."}
                </div>
              ) : (
                <JavaEditor
                  key={activeFile.id}
                  session={collab}
                  filePath={activeFile.path}
                  onDirty={() => {
                    dirtyRef.current = true;
                  }}
                />
              )}
            </div>

            {/* Bottom panel */}
            <div className="border-t border-white/10 bg-[#252526]">
              <div className="flex items-center gap-1 px-2">
                <button
                  type="button"
                  role="tab"
                  aria-selected={bottomTab === "problems" && bottomOpen}
                  onClick={() => {
                    setBottomTab("problems");
                    setBottomOpen(true);
                  }}
                  data-testid="code-bottom-problems"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] ${bottomTab === "problems" && bottomOpen ? "text-white" : "text-[#9d9d9d] hover:text-white"}`}
                >
                  <AlertCircle size={13} aria-hidden="true" />
                  Problems {errorCount > 0 && <span className="rounded-full bg-red-500/20 px-1.5 text-red-300">{errorCount}</span>}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={bottomTab === "terminal" && bottomOpen}
                  onClick={() => {
                    setBottomTab("terminal");
                    setBottomOpen(true);
                  }}
                  data-testid="code-bottom-terminal"
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] ${bottomTab === "terminal" && bottomOpen ? "text-white" : "text-[#9d9d9d] hover:text-white"}`}
                >
                  <SquareTerminal size={13} aria-hidden="true" /> Terminal
                </button>
                <button type="button" aria-label={bottomOpen ? "Collapse panel" : "Expand panel"} onClick={() => setBottomOpen((open) => !open)} className="ml-auto rounded p-1.5 text-[#9d9d9d] hover:text-white">
                  {bottomOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              </div>
              {bottomOpen && (
                <div className="max-h-44 min-h-[104px] overflow-auto border-t border-white/10 px-3 py-2 text-[12px]" data-testid="code-bottom-panel">
                  {bottomTab === "problems" ? (
                    problems.length === 0 && deployProblems.length === 0 ? (
                      <p className="flex items-center gap-1.5 text-[#6a6a6a]">
                        <Check size={13} className="text-emerald-400" /> No problems — JDK 21 toolchain, Java 8 source level, SDK {BIOBUZZ_SDK_VERSION}.
                      </p>
                    ) : (
                      <>
                        {deployProblems.length > 0 && (
                          <p className="mono mb-1 text-[10px] uppercase tracking-[.14em] text-[#9d9d9d]">
                            From the last hub build
                          </p>
                        )}
                        {deployProblems.map((problem, index) => (
                          <div key={`hub-${index}`} className="flex items-start gap-2 py-0.5" data-testid={`code-hub-problem-${index}`}>
                            <span className={problem.severity === "error" ? "text-red-400" : "text-amber-300"}>{problem.severity === "error" ? "error" : "warning"}</span>
                            <span className="mono text-[#9d9d9d]">Ln {problem.line}, Col {problem.column}</span>
                            <span className="text-[#d4d4d4]">{problem.message}</span>
                          </div>
                        ))}
                        {problems.map((problem, index) => (
                          <div key={index} className="flex items-start gap-2 py-0.5" data-testid={`code-problem-${index}`}>
                            <span className={problem.severity === "error" ? "text-red-400" : "text-amber-300"}>{problem.severity === "error" ? "error" : "warning"}</span>
                            <span className="mono text-[#9d9d9d]">Ln {problem.line}, Col {problem.column}</span>
                            <span className="text-[#d4d4d4]">{problem.message}</span>
                          </div>
                        ))}
                      </>
                    )
                  ) : (
                    <div>
                      {serialLog.length === 0 && <p className="text-[#6a6a6a]">Deploy log is empty. Connect USB or serial from the Deploy tab.</p>}
                      {serialLog.map((line, index) => (
                        <p key={index} className="whitespace-pre-wrap text-[#c5c5c5]">{line}</p>
                      ))}
                      {serialOpen && (
                        <form
                          className="mt-1 flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void sendSerial();
                          }}
                        >
                          <Input value={serialInput} onChange={(event) => setSerialInput(event.target.value)} placeholder="Send a serial line…" aria-label="Send a serial line" data-testid="code-serial-input" className="h-7 border-white/10 bg-[#1e1e1e] text-white placeholder:text-[#6a6a6a]" />
                          <Button type="submit" size="sm" data-testid="code-serial-send" className="h-7 bg-[#0e639c] text-white hover:bg-[#1177bb]">Send</Button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status bar */}
            <div className="mono flex items-center gap-4 overflow-x-auto bg-[#0e639c] px-3 py-1 text-[11px] text-white" data-testid="code-statusbar">
              <span>SDK {BIOBUZZ_SDK_VERSION}</span>
              <span>JDK 21 · Java 8</span>
              <span className="truncate">{activeFile ? activeFile.path : "no file open"}</span>
              <span className="ml-auto shrink-0">{branch}</span>
              <span className="shrink-0">{roster.length > 0 ? `${roster.length} here` : "solo"}</span>
            </div>
          </div>
        </div>
      )}

      {/* OnBot quick export strip */}
      {project && fileList.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">OnBotJava drop files</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Single-file OpModes flattened to hub paths — matches exactly what Upload sends.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {onBotExport(fileList.map((file) => ({ path: file.path, content: file.content }))).map((entry) => (
              <button
                key={entry.name}
                type="button"
                onClick={() => downloadBlob(entry.name.split("/").pop() ?? entry.name, entry.content, "text/x-java-source")}
                data-testid={`code-onbot-${entry.name}`}
                className="mono rounded-lg border border-border px-2.5 py-1.5 text-[11px] hover:border-primary"
              >
                {entry.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FileRow({ file, active, onOpen, onDelete }: { file: CodeFile; active: boolean; onOpen: () => void; onDelete: () => void }) {
  return (
    <div
      className={`group flex items-center gap-1 rounded px-2 py-1 text-[12.5px] ${active ? "bg-[#094771] text-white" : "text-[#c5c5c5] hover:bg-white/5 hover:text-white"}`}
      data-testid={`code-file-${file.path}`}
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        <FileText size={13} className="shrink-0 text-[#9d9d9d]" aria-hidden="true" />
        <span className="truncate">{fileNameOf(file.path)}</span>
      </button>
      <button type="button" title={`Delete ${file.path}`} aria-label={`Delete ${file.path}`} onClick={onDelete} className="rounded p-0.5 text-[#858585] opacity-0 hover:bg-white/10 hover:text-red-300 focus:opacity-100 group-hover:opacity-100">
        <Trash2 size={12} aria-hidden="true" />
      </button>
    </div>
  );
}
