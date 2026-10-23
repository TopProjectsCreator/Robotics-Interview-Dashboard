import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PartsVendor } from "@workspace/api-client-react";

import { PartsImageIdentifyDialog } from "../src/components/PartsImageIdentifyDialog";
import "../src/index.css";

declare global {
  interface Window {
    partsCameraTest: {
      getSaved: () => unknown[];
      reopen: () => void;
    };
  }
}

const vendors = [{
  key: "andymark",
  name: "AndyMark",
  group: "General Parts",
  website: "https://www.andymark.com",
  catalogMode: "products",
  catalogSourceUrl: "https://www.andymark.com",
  coverageState: "discovery_only",
  lastSync: null,
}] satisfies PartsVendor[];

function PartsCameraFixture() {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState<unknown[]>([]);

  Object.assign(window, {
    partsCameraTest: {
      getSaved: () => saved,
      reopen: () => setOpen(true),
    },
  });

  return (
    <>
      {!open && <button onClick={() => setOpen(true)}>Open scanner</button>}
      <PartsImageIdentifyDialog
        open={open}
        onOpenChange={setOpen}
        vendors={vendors}
        saving={false}
        onSave={async (part) => setSaved((previous) => [...previous, part])}
      />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })}>
    <PartsCameraFixture />
  </QueryClientProvider>,
);
