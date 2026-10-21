import { pool } from "@workspace/db";
import { isChatAttachmentReferenced } from "./chatAttachmentReferences";

/**
 * Escape the LIKE wildcards in a literal so an object id containing `_` or
 * `%` cannot widen the search.
 */
function likePattern(literal: string): string {
  return `%${literal.replace(/([\\%_])/g, "\\$1")}%`;
}

/**
 * Is this stored object still in use?
 *
 * CAD models, robot previews, and chat messages can all point at a private
 * object. The chat lookup used to read every message body in the database on
 * every delete, which on a busy team meant pulling the whole conversation
 * history into memory per request. Only messages that could contain this
 * path are read now.
 */
export async function isPrivateObjectReferenced(objectPath: string): Promise<boolean> {
  const cadReferences = await pool.query(
    `select "id" from "cad_models"
     where "object_path" = $1 limit 1`,
    [objectPath],
  );
  if (cadReferences.rowCount) return true;

  const robotReferences = await pool.query(
    `select "id" from "parts_robots"
     where "preview_object_path" = $1 limit 1`,
    [objectPath],
  );
  if (robotReferences.rowCount) return true;

  // Chat messages store the public URL (/api/storage/objects/<path>), which
  // always contains the object path, so a LIKE on the path is enough.
  const messages = await pool.query(
    `select "message" from "interview_chat_messages"
     where "message" like $1 escape '\\'`,
    [likePattern(objectPath)],
  );
  return isChatAttachmentReferenced(
    objectPath,
    messages.rows.map(({ message }) => String(message)),
  );
}
