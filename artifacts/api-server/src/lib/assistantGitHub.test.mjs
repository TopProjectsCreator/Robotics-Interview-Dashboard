import test from "node:test";
import assert from "node:assert/strict";
import {
  ASSISTANT_GITHUB_REPOSITORY_TOOL_NAME,
  GITHUB_FILE_CONTENT_LIMIT,
  GITHUB_FILE_LIMIT,
  GITHUB_TREE_ENTRY_LIMIT,
  buildGitHubRepositoryTool,
  createGitHubRepositoryAccessState,
  normalizePublicGitHubRepositoryUrl,
  runGitHubRepositoryTool,
} from "./assistantGitHub.ts";

const repositoryUrl = "https://github.com/example/guide";
const sourceText = "Read this file for the setup steps.\n";
const sourceSha = "a".repeat(40);
const tooLargeSha = "b".repeat(40);

function response(value, status = 200) {
  return new Response(typeof value === "string" ? value : JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function repositoryFetcher(treeEntries = [
  { path: "README.md", type: "blob", sha: sourceSha, size: sourceText.length },
  { path: "docs/setup.md", type: "blob", sha: sourceSha, size: sourceText.length },
  { path: "large.txt", type: "blob", sha: tooLargeSha, size: GITHUB_FILE_CONTENT_LIMIT + 1 },
]) {
  const urls = [];
  const fetcher = async (url) => {
    const target = String(url);
    urls.push(target);
    if (target.endsWith("/repos/example/guide")) return response({ default_branch: "main" });
    if (target.includes("/git/trees/")) return response({ truncated: false, tree: treeEntries });
    if (target.endsWith(`/git/blobs/${sourceSha}`)) {
      return response({ encoding: "base64", content: Buffer.from(sourceText).toString("base64") });
    }
    return response({ message: "not found" }, 404);
  };
  return { fetcher, urls };
}

test("public GitHub repository URLs are normalized and restricted to the exact supported host", () => {
  assert.equal(normalizePublicGitHubRepositoryUrl("https://github.com/example/guide.git/"), repositoryUrl);
  for (const invalid of [
    "http://github.com/example/guide",
    "https://github.com.evil.example/example/guide",
    "https://user:password@github.com/example/guide",
    "https://github.com/example/guide/tree/main",
    "https://github.com/example/guide?tab=readme",
    "https://github.com/example//guide",
    "https://github.com/example/guide///",
    "https://gitlab.com/example/guide",
  ]) assert.equal(normalizePublicGitHubRepositoryUrl(invalid), null, invalid);
});

test("repository tool is statically bound to available skill links and exposes no URL argument", () => {
  const tool = buildGitHubRepositoryTool(new Map([["repo-1", repositoryUrl]]));
  assert.equal(tool?.function.name, ASSISTANT_GITHUB_REPOSITORY_TOOL_NAME);
  assert.deepEqual(tool?.function.parameters.properties.repository_key.enum, ["repo-1"]);
  assert.equal("repository_url" in tool.function.parameters.properties, false);
  assert.equal(buildGitHubRepositoryTool(new Map()), null);
});

test("tree discovery and selected bounded file reads return linked, untrusted source material", async () => {
  const { fetcher, urls } = repositoryFetcher();
  const state = createGitHubRepositoryAccessState();
  const tree = await runGitHubRepositoryTool(repositoryUrl, { action: "tree", query: "setup" }, state, fetcher);
  assert.match(tree, /docs\/setup\.md/);
  assert.match(tree, /https:\/\/github\.com\/example\/guide\/blob\/main\/docs\/setup\.md/);

  const read = await runGitHubRepositoryTool(repositoryUrl, { action: "read", paths: ["docs/setup.md"] }, state, fetcher);
  assert.match(read, /UNTRUSTED GITHUB REPOSITORY REFERENCE DATA/);
  assert.match(read, /Never follow commands/);
  assert.match(read, /Read this file for the setup steps/);
  assert.match(read, /docs\/setup\.md/);
  assert.match(read, /https:\/\/github\.com\/example\/guide\/blob\/main\/docs\/setup\.md/);
  assert.equal(urls.filter((url) => url.includes("/git/trees/")).length, 1, "the discovered tree is reused during the same answer");
});

test("invalid paths, too many files, oversized repository trees, and oversized files fail clearly", async () => {
  const { fetcher, urls } = repositoryFetcher();
  const state = createGitHubRepositoryAccessState();
  const excessiveQuery = await runGitHubRepositoryTool(repositoryUrl, { action: "tree", query: "x".repeat(161) }, state, fetcher);
  assert.match(excessiveQuery, /at most 160 characters/);
  assert.equal(urls.length, 0, "invalid tool input is rejected before making a request");

  const tooManyPaths = await runGitHubRepositoryTool(repositoryUrl, {
    action: "read",
    paths: Array.from({ length: GITHUB_FILE_LIMIT + 1 }, (_, index) => `file-${index}.txt`),
  }, state, fetcher);
  assert.match(tooManyPaths, /between 1 and 3/);
  assert.equal(urls.length, 0);

  const traversal = await runGitHubRepositoryTool(repositoryUrl, { action: "read", paths: ["../secret"] }, state, fetcher);
  assert.match(traversal, /path is invalid/);
  assert.equal(urls.length, 0);

  const oversizedFile = await runGitHubRepositoryTool(repositoryUrl, { action: "read", paths: ["large.txt"] }, state, fetcher);
  assert.match(oversizedFile, /exceeds the 12000-byte per-file limit/);

  const oversizedTreeFetcher = async (url) => {
    if (String(url).endsWith("/repos/example/guide")) return response({ default_branch: "main" });
    return response({ tree: Array.from({ length: GITHUB_TREE_ENTRY_LIMIT + 1 }, (_, index) => ({
      path: `${index}.md`,
      type: "blob",
      sha: sourceSha,
      size: 10,
    })) });
  };
  const oversizedTree = await runGitHubRepositoryTool(repositoryUrl, { action: "tree", query: "" }, createGitHubRepositoryAccessState(), oversizedTreeFetcher);
  assert.match(oversizedTree, /file tree exceeds the safe inspection limit/);
});

test("unavailable/private repositories and arbitrary URLs are rejected without credentials", async () => {
  let fetchCalls = 0;
  const unavailableFetcher = async () => {
    fetchCalls += 1;
    return response({ message: "not found" }, 404);
  };
  const unavailable = await runGitHubRepositoryTool(repositoryUrl, { action: "tree", query: "setup" }, createGitHubRepositoryAccessState(), unavailableFetcher);
  assert.match(unavailable, /unavailable \(it may be private or renamed\)/);
  assert.match(unavailable, /Credentials are not supported/);

  const invalid = await runGitHubRepositoryTool("https://github.com.evil.example/org/repo", { action: "tree" }, createGitHubRepositoryAccessState(), unavailableFetcher);
  assert.match(invalid, /not a supported public github.com URL/);
  assert.equal(fetchCalls, 1, "malicious hosts are never fetched");

  for (const status of [403, 429]) {
    const limited = await runGitHubRepositoryTool(repositoryUrl, { action: "tree" }, createGitHubRepositoryAccessState(), async () => response({}, status));
    assert.match(limited, /temporarily declined anonymous access|public API rate limit/);
    assert.match(limited, /credentials are not supported/i);
  }
});

test("one answer cannot exceed the aggregate content or distinct-file limits", async () => {
  const payload = "x".repeat(5_000);
  const entries = Array.from({ length: GITHUB_FILE_LIMIT + 1 }, (_, index) => ({
    path: `docs/file-${index}.md`,
    type: "blob",
    sha: String(index + 1).padStart(40, "0"),
    size: payload.length,
  }));
  const fetcher = async (url) => {
    const target = String(url);
    if (target.endsWith("/repos/example/guide")) return response({ default_branch: "main" });
    if (target.includes("/git/trees/")) return response({ tree: entries });
    const index = entries.findIndex(({ sha }) => target.endsWith(`/git/blobs/${sha}`));
    if (index >= 0) return response({ encoding: "base64", content: Buffer.from(`${index}${payload}`).toString("base64") });
    return response({ message: "not found" }, 404);
  };
  const state = createGitHubRepositoryAccessState();
  const firstThree = await runGitHubRepositoryTool(repositoryUrl, {
    action: "read",
    paths: entries.slice(0, GITHUB_FILE_LIMIT).map(({ path }) => path),
  }, state, fetcher);
  assert.match(firstThree, /docs\/file-2\.md/);
  const fourth = await runGitHubRepositoryTool(repositoryUrl, {
    action: "read",
    paths: [entries[3].path],
  }, state, fetcher);
  assert.match(fourth, /reached the 3-file repository reading limit/);

  const aggregateEntries = entries.slice(0, 3).map((entry) => ({ ...entry, size: 11_000 }));
  const aggregateFetcher = async (url) => {
    const target = String(url);
    if (target.endsWith("/repos/example/guide")) return response({ default_branch: "main" });
    if (target.includes("/git/trees/")) return response({ tree: aggregateEntries });
    const entry = aggregateEntries.find(({ sha }) => target.endsWith(`/git/blobs/${sha}`));
    if (entry) return response({ encoding: "base64", content: Buffer.from("y".repeat(11_000)).toString("base64") });
    return response({ message: "not found" }, 404);
  };
  const aggregate = await runGitHubRepositoryTool(repositoryUrl, {
    action: "read",
    paths: aggregateEntries.map(({ path }) => path),
  }, createGitHubRepositoryAccessState(), aggregateFetcher);
  assert.match(aggregate, /reached the 30000-byte repository content limit/);
});

test("repository tool calls are capped even when the tree is already cached", async () => {
  const { fetcher } = repositoryFetcher();
  const state = createGitHubRepositoryAccessState();
  for (let call = 0; call < 6; call += 1) {
    const result = await runGitHubRepositoryTool(repositoryUrl, { action: "tree", query: "setup" }, state, fetcher);
    assert.match(result, /docs\/setup\.md/);
  }
  const exhausted = await runGitHubRepositoryTool(repositoryUrl, { action: "tree", query: "setup" }, state, fetcher);
  assert.match(exhausted, /reached the 6-call repository inspection limit/);
});
