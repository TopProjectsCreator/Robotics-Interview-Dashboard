import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "wouter";
import type { AccessibleCustomWorkspace } from "../lib/customWorkspaces";

export function CustomWorkspaceOverviewCard({
  workspace,
  number,
}: {
  workspace: AccessibleCustomWorkspace;
  number: number;
}) {
  const href = `/custom-workspaces/${encodeURIComponent(workspace.id)}`;
  const isDraft = workspace.status === "draft";
  return (
    <Link
      href={href}
      data-testid={`card-custom-workspace-${workspace.id}`}
      className="group relative isolate flex min-h-[350px] flex-col overflow-hidden rounded-[28px] border border-[#b8d8d3] bg-gradient-to-br from-[#e8f5f0] via-[#e1f2ed] to-[#d3e9e5] p-6 text-[#183a4b] shadow-[0_20px_45px_rgba(26,73,73,.10)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_55px_rgba(26,73,73,.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16869a] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f1f5f4] dark:border-[#35616a] dark:bg-gradient-to-br dark:from-[#173542] dark:via-[#1a3d49] dark:to-[#214c55] dark:text-[#e8eff2] dark:focus-visible:ring-offset-[#101b23] sm:min-h-[370px] sm:p-7"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 -z-10 h-64 w-64 rounded-full border border-[#16869a]/15 dark:border-[#a3e0d8]/10" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-8 -z-10 h-52 w-52 rounded-full bg-[#16869a]/[.08] blur-3xl dark:bg-[#7ed0c4]/[.07]" />
      <span className="relative z-10 flex items-center justify-between gap-3">
        <span className="mono inline-flex items-center gap-2 rounded-full border border-[#16869a]/15 bg-white/55 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[.16em] text-[#46646b] dark:border-white/15 dark:bg-white/[.06] dark:text-[#c3d7da]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#16869a] dark:bg-[#7ed0c4]" />
          Workspace {String(number).padStart(2, "0")}
        </span>
        <span className="mono text-[10px] uppercase tracking-[.12em] text-[#55747a] dark:text-[#bed4d8]" data-testid={`status-custom-workspace-card-${workspace.id}`}>
          {isDraft ? "Draft" : "Custom app"}
        </span>
      </span>
      <span className="relative z-10 flex flex-1 items-center justify-end py-5">
        <span aria-hidden="true" className="relative mr-2 flex h-[142px] w-[172px] items-center justify-center sm:mr-7 sm:h-[160px] sm:w-[190px]">
          <span className="absolute right-4 top-2 h-32 w-32 rotate-12 rounded-[28px] border border-[#16869a]/20 bg-white/35 shadow-[0_18px_35px_rgba(26,73,73,.08)] dark:border-white/10 dark:bg-white/[.04]" />
          <span className="relative flex h-24 w-24 rotate-[-7deg] items-center justify-center rounded-[26px] border border-[#16869a]/20 bg-[#f8fcfa] text-[#16869a] shadow-[0_18px_32px_rgba(26,73,73,.14)] dark:border-white/15 dark:bg-[#254c57] dark:text-[#82d1c6]">
            <Sparkles size={42} strokeWidth={1.5} />
          </span>
          <span className="absolute bottom-1 left-1 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-[#f8c84a] text-[#182232] shadow-lg transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[-6deg]">
            <ArrowRight size={19} />
          </span>
        </span>
      </span>
      <span className="relative z-10">
        <h2 className="line-clamp-2 text-[2rem] font-semibold leading-none tracking-[-.055em] sm:text-[2.35rem]" data-testid={`text-custom-workspace-title-${workspace.id}`}>
          {workspace.title}
        </h2>
        <span className="mt-2 line-clamp-2 block max-w-[300px] text-sm leading-6 text-[#46646b] dark:text-[#d0e0e3]">
          {workspace.description || "A custom workspace built for your team."}
        </span>
      </span>
      <span className="relative z-10 mt-5 flex items-center justify-between border-t border-[#183a4b]/15 pt-4 text-sm font-semibold dark:border-white/15">
        <span>Open custom app</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#16869a] text-white transition-transform group-hover:translate-x-1 dark:bg-[#48b8ab] dark:text-[#10252d]">
          <ArrowRight size={17} />
        </span>
      </span>
    </Link>
  );
}

export function CustomWorkspaceSidebarLinks({
  workspaces,
  currentPath,
  onNavigate,
}: {
  workspaces: AccessibleCustomWorkspace[];
  currentPath: string;
  onNavigate: () => void;
}) {
  if (workspaces.length === 0) return null;
  return (
    <>
      <div className="mono mb-1 mt-5 px-4 text-[9px] uppercase tracking-[.2em] text-[#78949d]" data-testid="label-custom-apps">
        Custom apps
      </div>
      {workspaces.map((workspace) => {
        const href = `/custom-workspaces/${encodeURIComponent(workspace.id)}`;
        const active = currentPath === href;
        return (
          <Link
            key={workspace.id}
            href={href}
            title={workspace.title}
            data-testid={`link-custom-workspace-${workspace.id}`}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-[#243d4d] text-white" : "text-[#a7bdc3] hover:bg-[#243d4d] hover:text-white"
            }`}
          >
            <Sparkles size={18} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{workspace.title}</span>
            {workspace.status === "draft" && <span className="mono text-[9px] uppercase tracking-wide text-[#f8c84a]" data-testid={`status-custom-workspace-nav-${workspace.id}`}>Draft</span>}
          </Link>
        );
      })}
    </>
  );
}
