import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentEditor } from "./DocumentEditor";
import type { DocumentCollaborationSession } from "./documentCollaboration";

const { createDocumentCollaborationMock } = vi.hoisted(() => ({
  createDocumentCollaborationMock: vi.fn(),
}));

vi.mock("./documentCollaboration", () => ({
  createDocumentCollaboration: createDocumentCollaborationMock,
}));

vi.mock("@tiptap/react", () => ({
  EditorContent: () => null,
  useEditor: () => null,
}));

describe("DocumentEditor collaboration lifecycle", () => {
  it("destroys the active collaboration session when the editor unmounts", () => {
    const doc = new Y.Doc();
    const session: DocumentCollaborationSession = {
      doc,
      provider: { awareness: new Awareness(doc), setTitle: vi.fn() },
      subscribeStatus: (callback) => {
        callback("connecting");
        return () => {};
      },
      subscribeSaveStatus: (callback) => {
        callback("saved");
        return () => {};
      },
      subscribeTitle: () => () => {},
      destroy: vi.fn(),
    };
    createDocumentCollaborationMock.mockReturnValue(session);

    const editor = render(
      <DocumentEditor
        document={{
          id: "document-1",
          title: "Interview plan",
          data: JSON.stringify({ kind: "document" }),
          createdBy: "interviewer",
          updatedAt: "",
        }}
        activeInterviewer="Interviewer"
        saving={false}
        error=""
        onClose={() => {}}
        onTitleSave={() => {}}
      />,
    );

    editor.unmount();

    expect(session.destroy).toHaveBeenCalledOnce();
    session.destroy();
    session.provider.awareness.destroy();
    doc.destroy();
  });
});