import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import "../src/index.css";
import { CadWorkspacePage } from "../src/pages/CadWorkspacePage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <CadWorkspacePage />
  </QueryClientProvider>,
);
