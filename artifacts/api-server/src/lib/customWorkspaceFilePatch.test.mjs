import assert from "node:assert/strict";
import test from "node:test";

const {
  applySearchReplace,
  countOccurrences,
  diffSnippet,
  extractInlineScripts,
  paginateContent,
  validateSourceFile,
} = await import("./customWorkspaceFilePatch.ts");

test("applySearchReplace replaces a unique anchor", () => {
  const result = applySearchReplace("<h1>Hello</h1>", "<h1>Hello</h1>", "<h1>Hi</h1>");
  assert.equal(result.ok, true);
  assert.equal(result.content, "<h1>Hi</h1>");
});

test("applySearchReplace rejects missing and ambiguous anchors", () => {
  assert.equal(applySearchReplace("abc", "z", "q").ok, false);
  const ambiguous = applySearchReplace("a b a b", "b", "c");
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.occurrences, 2);
  assert.match(ambiguous.error, /unique/);
});

test("countOccurrences counts overlapping-free matches", () => {
  assert.equal(countOccurrences("aaaa", "aa"), 2);
  assert.equal(countOccurrences("abc", ""), 0);
});

test("diffSnippet shows the changed region with context", () => {
  const before = "one\ntwo\nthree\nfour\nfive";
  const after = "one\ntwo\nTHREE\nfour\nfive";
  const snippet = diffSnippet(before, after);
  assert.match(snippet, /- 3: three/);
  assert.match(snippet, /\+ 3: THREE/);
});

test("paginateContent windows large files", () => {
  const content = "x".repeat(100);
  const first = paginateContent(content, 0, 30);
  assert.equal(first.truncated, true);
  assert.equal(first.totalChars, 100);
  assert.equal(first.content.length, 30);
  const second = paginateContent(content, 90, 30);
  assert.equal(second.truncated, false);
  assert.equal(second.content.length, 10);
  const pastEnd = paginateContent(content, 500, 30);
  assert.equal(pastEnd.content, "");
});

test("validateSourceFile catches JavaScript syntax errors pre-save", () => {
  assert.deepEqual(validateSourceFile("app.js", "const x = 1;"), []);
  assert.match(validateSourceFile("app.js", "const x = ;")[0], /JavaScript syntax error/);
  const html = '<script>function broken( {</script>';
  assert.match(validateSourceFile("index.html", html)[0], /inline script 1/);
  assert.deepEqual(validateSourceFile("index.html", "<script>const x = 1;</script>"), []);
  assert.deepEqual(validateSourceFile("styles.css", "body { color: red;"), []);
});

test("extractInlineScripts skips external scripts", () => {
  const html = '<script src="app.js"></script><script>const a = 1;</script>';
  assert.deepEqual(extractInlineScripts(html), ["const a = 1;"]);
});
