import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import "../src/index.css";
import { CadWorkspacePage } from "../src/pages/CadWorkspacePage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

createRoot(document.getElementById("root")!).render(
  <div className="cad-workspace-shell">
    <header data-testid="workspace-header" className="h-[72px] shrink-0 border-b px-4 py-5">
      CAD browser fixture
    </header>
    <main className="cad-workspace-main mx-auto w-full max-w-[1500px] px-3 py-4 lg:p-9">
      <QueryClientProvider client={queryClient}>
        <CadWorkspacePage />
      </QueryClientProvider>
    </main>
  </div>,
);
