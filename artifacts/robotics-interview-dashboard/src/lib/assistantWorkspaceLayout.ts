export function assistantWorkspaceGridClass(hasPartsToolsPane: boolean): string {
  return `grid gap-5 ${hasPartsToolsPane
    ? "xl:grid-cols-[270px_minmax(0,1fr)_330px]"
    : "xl:grid-cols-[270px_minmax(0,1fr)]"}`;
}
