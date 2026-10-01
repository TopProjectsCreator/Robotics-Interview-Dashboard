import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { Router as WouterRouter } from "wouter";

import { InterviewChatPanel } from "./App";
import { TooltipProvider } from "./components/ui/tooltip";
import { SettingsProvider } from "./workspaceSettings";

const root = document.getElementById("root");
if (!root) throw new Error("Browser test root is missing");

window.localStorage.setItem("robotics-workspace-settings", JSON.stringify({ autoRefresh: false }));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SettingsProvider>
        <WouterRouter>
          <InterviewChatPanel applicantIds={[]} />
        </WouterRouter>
      </SettingsProvider>
    </TooltipProvider>
  </QueryClientProvider>,
);