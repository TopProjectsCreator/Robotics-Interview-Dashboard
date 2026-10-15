import LightningFS from "@isomorphic-git/lightning-fs";
import git from "isomorphic-git";

// isomorphic-git exports the runtime function but not this type in current releases.
type StatusRow = [path: string, head: number, workdir: number, stage: number];
import http from "isomorphic-git/http/web";

export type GitFileState = {
  path: string;
  status: "unmodified" | "modified" | "added" | "removed" | "untracked";
};

export type GitLogEntry = {
  oid: string;
  message: string;
  author: string;
  date: number;
};

const fsInstances = new Map<string, LightningFS>();

export function fsFor(scope: string): LightningFS {
  const existing = fsInstances.get(scope);
  if (existing) return existing;
  const created = new LightningFS(scope) as unknown as LightningFS;
  fsInstances.set(scope, created);
  return created;
}

export const DEFAULT_CORS_PROXY = "https://cors.isomorphic-git.org";

function pfs(fs: LightningFS) {
  return (fs as unknown as { promises: Record<string, (...args: any[]) => Promise<unknown>> }).promises;
}

async function exists(fs: LightningFS, path: string): Promise<boolean> {
  try {
    await pfs(fs).stat(path);
    return true;
  } catch {
    return false;
  }
}

async function writeTree(fs: LightningFS, dir: string, files: { path: string; content: string }[]): Promise<void> {
  const promises = pfs(fs) as {
    mkdir: (p: string) => Promise<void>;
    writeFile: (p: string, d: string) => Promise<void>;
  };
  for (const file of files) {
    const full = `${dir}/${file.path}`;
    const parts = full.split("/").slice(0, -1);
    let cursor = "";
    for (const part of parts) {
      cursor += (cursor ? "/" : "") + part;
      if (!(await exists(fs, cursor))) {
        try {
          await promises.mkdir(cursor);
        } catch {
          // Racing creates are fine.
        }
      }
    }
    await promises.writeFile(full, file.content);
  }
}

async function readTree(fs: LightningFS, dir: string): Promise<{ path: string; content: string }[]> {
  const promises = pfs(fs) as {
    readdir: (p: string) => Promise<string[]>;
    readFile: (p: string, o: string) => Promise<Uint8Array | string>;
    stat: (p: string) => Promise<{ type: "file" | "dir" }>;
  };
  const out: { path: string; content: string }[] = [];
  const walk = async (parts: string[]): Promise<void> => {
    const full = [dir, ...parts].join("/");
    let entries: string[];
    try {
      entries = await promises.readdir(full);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === ".git") continue;
      const rel = [...parts, entry];
      const stat = await promises.stat([dir, ...rel].join("/"));
      if (stat.type === "dir") await walk(rel);
      else {
        const raw = await promises.readFile([dir, ...rel].join("/"), "utf8");
        out.push({ path: rel.join("/"), content: String(raw) });
      }
    }
  };
  await walk([]);
  return out;
}

export async function cloneEndpoint(options: {
  scope: string;
  url: string;
  ref?: string;
  corsProxy?: string;
  token?: string;
  depth?: number;
  onProgress?: (phase: string, loaded: number, total?: number) => void;
}): Promise<{ dir: string; defaultBranch: string }> {
  const fs = fsFor(options.scope);
  const dir = "/repo";
  // Start from a clean checkout so re-clones never fail on a dirty tree.
  await wipeDir(fs, dir);
  const onAuth = () => (options.token ? { username: options.token } : undefined);
  await git.clone({
    fs: fs as never,
    http,
    dir,
    url: options.url,
    ref: options.ref || undefined,
    singleBranch: true,
    depth: options.depth ?? 50,
    corsProxy: options.corsProxy || DEFAULT_CORS_PROXY,
    onAuth,
    onProgress: options.onProgress
      ? (event) => options.onProgress?.(event.phase, event.loaded, event.total)
      : undefined,
  });
  let branch = options.ref ?? "main";
  try {
    const current = await git.currentBranch({ fs: fs as never, dir });
    if (current) branch = current;
  } catch {
    // Fall back to the requested ref.
  }
  return { dir, defaultBranch: branch };
}

async function wipeDir(fs: LightningFS, path: string): Promise<void> {
  const promises = pfs(fs) as {
    readdir: (p: string) => Promise<string[]>;
    unlink: (p: string) => Promise<void>;
    rmdir: (p: string) => Promise<void>;
    stat: (p: string) => Promise<{ type: "file" | "dir" }>;
  };
  let entries: string[];
  try {
    entries = await promises.readdir(path);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = `${path}/${entry}`;
    try {
      const stat = await promises.stat(full);
      if (stat.type === "dir") {
        await wipeDir(fs, full);
        await promises.rmdir(full);
      } else {
        await promises.unlink(full);
      }
    } catch {
      // Best-effort cleanup; clone recreates what it needs.
    }
  }
}

export async function readWorkingTree(scope: string): Promise<{ path: string; content: string }[]> {
  return readTree(fsFor(scope), "/repo");
}

export async function writeWorkingTree(
  scope: string,
  files: { path: string; content: string }[],
): Promise<void> {
  await writeTree(fsFor(scope), "/repo", files);
}

export async function gitStatus(scope: string): Promise<GitFileState[]> {
  const fs = fsFor(scope);
  let matrix: StatusRow[];
  try {
    matrix = await git.statusMatrix({ fs: fs as never, dir: "/repo" });
  } catch {
    return [];
  }
  return matrix.map(([filepath, head, workdir, stage]) => {
    let status: GitFileState["status"] = "unmodified";
    if (head === 0 && workdir === 2 && stage === 0) status = "added";
    else if (head === 0 && workdir === 2) status = "untracked";
    else if (workdir === 0 && head === 1) status = "removed";
    else if (workdir === 2 || stage !== head) status = "modified";
    return { path: filepath, status };
  });
}

export async function gitLog(scope: string, depth = 25): Promise<GitLogEntry[]> {
  const fs = fsFor(scope);
  try {
    const commits = await git.log({ fs: fs as never, dir: "/repo", depth });
    return commits.map((commit) => ({
      oid: commit.oid.slice(0, 8),
      message: commit.commit.message.trim().split("\n")[0] ?? "",
      author: commit.commit.author.name,
      date: commit.commit.author.timestamp * 1000,
    }));
  } catch {
    return [];
  }
}

export async function gitCommitAll(
  scope: string,
  message: string,
  author: { name: string; email?: string },
): Promise<string> {
  const fs = fsFor(scope);
  try {
    await git.resolveRef({ fs: fs as never, dir: "/repo", ref: "HEAD" });
  } catch {
    await git.init({ fs: fs as never, dir: "/repo", defaultBranch: "main" });
  }
  const matrix = await git.statusMatrix({ fs: fs as never, dir: "/repo" });
  for (const [filepath, , workdir] of matrix) {
    if (workdir === 0) await git.remove({ fs: fs as never, dir: "/repo", filepath });
    else if (workdir === 2) await git.add({ fs: fs as never, dir: "/repo", filepath });
  }
  return git.commit({
    fs: fs as never,
    dir: "/repo",
    message,
    author: { name: author.name, email: author.email ?? `${author.name}@team` },
  });
}

export async function gitPush(options: {
  scope: string;
  url?: string;
  ref?: string;
  token?: string;
  corsProxy?: string;
}): Promise<void> {
  const fs = fsFor(options.scope);
  const branch = options.ref ?? (await git.currentBranch({ fs: fs as never, dir: "/repo" })) ?? "main";
  await git.push({
    fs: fs as never,
    http,
    dir: "/repo",
    remote: "origin",
    ref: branch,
    url: options.url,
    corsProxy: options.corsProxy || DEFAULT_CORS_PROXY,
    onAuth: () => (options.token ? { username: options.token } : undefined),
  });
}

export async function gitPull(options: {
  scope: string;
  ref?: string;
  token?: string;
  corsProxy?: string;
  authorName?: string;
}): Promise<void> {
  const fs = fsFor(options.scope);
  const branch = options.ref ?? (await git.currentBranch({ fs: fs as never, dir: "/repo" })) ?? "main";
  await git.pull({
    fs: fs as never,
    http,
    dir: "/repo",
    ref: branch,
    singleBranch: true,
    corsProxy: options.corsProxy || DEFAULT_CORS_PROXY,
    author: { name: options.authorName ?? "Teammate" },
    onAuth: () => (options.token ? { username: options.token } : undefined),
  });
}
