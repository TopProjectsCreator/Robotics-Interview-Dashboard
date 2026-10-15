import { cadFormatHint, cadFormatLabel, cadRenderFormat, isCadRenderFormat } from "../lib/cadFormats";
import { ChatGlbViewer } from "./ChatGlbViewer";
import { ChatParasolidViewer } from "./ChatParasolidViewer";
import { ChatStlViewer } from "./ChatStlViewer";
import { ChatStepViewer } from "./ChatStepViewer";
import { CadThreeMfViewer } from "./CadThreeMfViewer";
import { CadMeshViewer } from "./CadMeshViewer";
import { WorkspaceFileViewer } from "./WorkspaceFileViewer";

type CadModelViewerProps = {
  /** Original file name, which selects the renderer. */
  name: string;
  src: string;
  contentType?: string | null;
  height?: number;
};

/**
 * Renders any workspace file inline. CAD files go to the 3D viewers;
 * images, videos, documents, presentations, and spreadsheets render exactly
 * like chat attachments via WorkspaceFileViewer, so robot designs stored in
 * any format preview perfectly.
 */
export function CadModelViewer({ name, src, contentType, height }: CadModelViewerProps) {
  const format = cadRenderFormat(name, contentType);

  if (format === "glb") return <ChatGlbViewer name={name} src={src} />;
  if (format === "stl") return <ChatStlViewer name={name} src={src} />;
  if (format === "obj" || format === "ply") {
    return <CadMeshViewer name={name} src={src} height={height} />;
  }
  if (format === "three-mf") return <CadThreeMfViewer name={name} src={src} height={height} />;
  if (format === "parasolid") return <ChatParasolidViewer name={name} src={src} />;
  if (format === "step" || format === "iges" || format === "brep") {
    return <ChatStepViewer name={name} src={src} />;
  }
  if (format && !isCadRenderFormat(format)) {
    return <WorkspaceFileViewer name={name} src={src} />;
  }

  return (
    <div
      className="rounded-xl border border-[#dce5e5] bg-[#f7faf9] p-4 text-sm text-[#718189] dark:border-[#2a3f52] dark:bg-[#10232d] dark:text-[#a8bac8]"
      role="alert"
      data-testid="cad-model-unsupported"
    >
      <p>There is no inline preview for {name}.</p>
      <a href={src} download={name} className="font-semibold underline underline-offset-2">
        Download the file
      </a>
    </div>
  );
}

/** Header text describing what the viewer will do with this file. */
export function describeCadModel(name: string, contentType?: string | null): {
  format: string;
  hint: string;
} {
  const renderFormat = cadRenderFormat(name, contentType);
  if (!renderFormat) return { format: "File", hint: "No inline preview available" };
  return { format: cadFormatLabel(renderFormat), hint: cadFormatHint(renderFormat) };
}
