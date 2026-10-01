import { pool } from "@workspace/db";
import { isChatAttachmentReferenced } from "./chatAttachmentReferences";

export async function isPrivateObjectReferenced(objectPath: string): Promise<boolean> {
  const robotReferences = await pool.query(
    `select "id" from "parts_robots"
     where "preview_object_path" = $1 limit 1`,
    [objectPath],
  );
  if (robotReferences.rowCount) return true;

  const messages = await pool.query(
    `select "message" from "interview_chat_messages"`,
  );
  return isChatAttachmentReferenced(
    objectPath,
    messages.rows.map(({ message }) => String(message)),
  );
}