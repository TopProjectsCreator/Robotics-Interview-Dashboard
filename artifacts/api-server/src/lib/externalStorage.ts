import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, externalObjectsTable } from "@workspace/db";

// Large CAD models exceed the Supabase plan's 50 MB per-object limit, so
// those specific files are hosted on Catbox (keyless) and streamed back
// through this server. Only CAD model types are ever routed here: applicant
// photos, transcripts and chat images stay in the private Supabase bucket.
//
// Catbox files are public and, for anonymous uploads, cannot be deleted via
// the API. Set CATBOX_USERHASH to enable real deletion from Catbox.
const CATBOX_API = "https://catbox.moe/user/api.php";
export const EXTERNAL_CAD_TYPES = new Set([
  "model/gltf-binary",
  "model/stl",
  "model/x-parasolid",
]);

export function isExternalCadType(contentType: string): boolean {
  return EXTERNAL_CAD_TYPES.has(contentType.trim().toLowerCase());
}

export async function uploadToCatbox(
  data: Buffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  const userhash = process.env.CATBOX_USERHASH?.trim();
  if (userhash) form.append("userhash", userhash);
  form.append(
    "fileToUpload",
    new Blob([new Uint8Array(data)], { type: contentType || "application/octet-stream" }),
    fileName || "model.bin",
  );

  const response = await fetch(CATBOX_API, {
    method: "POST",
    body: form,
    headers: { "User-Agent": "RoboticsInterviewDashboard/1.0 (+team workspace)" },
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!response.ok) {
    throw new Error(`Catbox upload failed (HTTP ${response.status})`);
  }
  const url = (await response.text()).trim();
  if (!/^https:\/\/files\.catbox\.moe\//i.test(url)) {
    throw new Error("Catbox returned an unexpected response");
  }
  return url;
}

export async function recordExternalObject(input: {
  url: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(externalObjectsTable).values({
    id,
    url: input.url,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  });
  return id;
}

export async function getExternalObject(id: string) {
  const [row] = await db.select().from(externalObjectsTable).where(eq(externalObjectsTable.id, id)).limit(1);
  return row ?? null;
}

export async function deleteExternalObject(id: string): Promise<{ remoteDeleted: boolean }> {
  const row = await getExternalObject(id);
  if (!row) return { remoteDeleted: true };
  const userhash = process.env.CATBOX_USERHASH?.trim();
  let remoteDeleted = false;
  if (userhash) {
    try {
      const form = new FormData();
      form.append("reqtype", "deletefiles");
      form.append("userhash", userhash);
      form.append("files", row.url);
      const response = await fetch(CATBOX_API, { method: "POST", body: form });
      remoteDeleted = response.ok;
    } catch {
      remoteDeleted = false;
    }
  }
  await db
    .delete(externalObjectsTable)
    .where(and(eq(externalObjectsTable.id, id)));
  return { remoteDeleted };
}

export async function fetchExternalFile(row: { url: string; fileName: string; contentType: string }) {
  const response = await fetch(row.url, {
    headers: { "User-Agent": "RoboticsInterviewDashboard/1.0 (+team workspace)" },
    redirect: "follow",
  });
  if (!response.ok || !response.body) {
    throw new Error(`Upstream fetch failed (HTTP ${response.status})`);
  }
  return response;
}
