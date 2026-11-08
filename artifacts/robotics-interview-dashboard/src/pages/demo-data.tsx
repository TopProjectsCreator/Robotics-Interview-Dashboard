import { useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getGetChatConversationsQueryKey,
  getGetChatSettingsQueryKey,
  getGetInterviewChatQueryKey,
  getGetPartsDashboardQueryKey,
  getGetPartsPricingPreferenceQueryKey,
  getGetQueueLabelsQueryKey,
  getGetQueueQueryKey,
  getGetSessionQueryKey,
  getListCadLibraryQueryKey,
  getListChatChannelsQueryKey,
  getListChatCustomEmojisQueryKey,
  getListInterviewWhiteboardsQueryKey,
  getListInterviewersQueryKey,
  getListPartsCatalogQueryKey,
  getListScheduledChatsQueryKey,
  type CadLibrary,
  type PartsCatalogItem,
  type PartsDashboard,
  type PartsVendor,
} from "@workspace/api-client-react";

const DEMO_TEAM_ID = "demo-team";
const DEMO_CHAT_PARAMS = {
  limit: 30,
  scope: "shared",
  author: "Maya Chen",
} as const;
const DEMO_TIMESTAMP = "2026-11-08T18:30:00.000Z";

const demoParts: PartsCatalogItem[] = [
  {
    id: "demo-part-hex-hub",
    vendorKey: "gobilda",
    vendorName: "goBILDA",
    name: "Strafer Chassis 96mm Wheel",
    sku: "3610-0002-0001",
    category: "Motion",
    description: "Sample mecanum wheel for the demo robot.",
    productUrl: null,
    imageUrl: null,
    supplierPrice: 24.99,
    ftcTeamPrice: 19.99,
    supplierPriceCurrency: "USD",
    storageLocation: "Drawer A3",
    inventoryNotes: "Fictional demo inventory",
    unitCost: 19.99,
    costCurrency: "USD",
    quantityOwned: 8,
    quantityAssigned: 4,
    quantityAvailable: 4,
    allocations: [],
    createdAt: DEMO_TIMESTAMP,
    updatedAt: DEMO_TIMESTAMP,
  },
  {
    id: "demo-part-control-hub",
    vendorKey: "rev",
    vendorName: "REV Robotics",
    name: "JST-PH 3-pin Cable",
    sku: "REV-31-1410",
    category: "Electronics",
    description: "Sample sensor cable for the demo robot.",
    productUrl: null,
    imageUrl: null,
    supplierPrice: 3.49,
    ftcTeamPrice: null,
    supplierPriceCurrency: "USD",
    storageLocation: "Bin E2",
    inventoryNotes: "Fictional demo inventory",
    unitCost: 3.49,
    costCurrency: "USD",
    quantityOwned: 12,
    quantityAssigned: 5,
    quantityAvailable: 7,
    allocations: [],
    createdAt: DEMO_TIMESTAMP,
    updatedAt: DEMO_TIMESTAMP,
  },
];

const demoVendors: PartsVendor[] = [
  {
    key: "gobilda",
    name: "goBILDA",
    group: "General Parts",
    website: "https://www.gobilda.com/",
    catalogMode: "products",
    catalogSourceUrl: "https://www.gobilda.com/",
    coverageState: "discovery_only",
    publicProductFeedUrl: null,
    lastSync: null,
    blocked: false,
  },
  {
    key: "rev",
    name: "REV Robotics",
    group: "General Parts",
    website: "https://www.revrobotics.com/",
    catalogMode: "products",
    catalogSourceUrl: "https://www.revrobotics.com/",
    coverageState: "discovery_only",
    publicProductFeedUrl: null,
    lastSync: null,
    blocked: false,
  },
];

const demoPartsDashboard: PartsDashboard = {
  vendors: demoVendors,
  robots: [
    {
      id: "demo-robot",
      name: "Rover 2026",
      preview: null,
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    },
  ],
  summary: {
    vendorCount: demoVendors.length,
    catalogItems: demoParts.length,
    ownedUnits: 20,
    assignedUnits: 9,
    availableUnits: 11,
  },
};

const demoCadLibrary: CadLibrary = {
  bots: [
    {
      id: "demo-cad-robot",
      name: "Rover 2026",
      notes: "Fictional robot for the public demo.",
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    },
  ],
  folders: [
    {
      id: "demo-cad-folder",
      botId: "demo-cad-robot",
      parentId: null,
      name: "Drivebase",
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    },
  ],
  models: [
    {
      id: "demo-cad-model",
      name: "Drivebase side plate",
      fileName: "drivebase-side-plate.step",
      contentType: "application/step",
      objectPath: "/objects/demo-cad-side-plate",
      sizeBytes: 284_000,
      botId: null,
      folderId: null,
      notes: "Fictional sample model. No file is stored or downloaded.",
      uploadedBy: "Maya Chen",
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    },
  ],
};

function createDemoQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        enabled: false,
        staleTime: Infinity,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  });
  const seed = (key: readonly unknown[], data: unknown) => {
    client.setQueryData(key, data);
  };

  seed(getGetSessionQueryKey(), {
    authenticated: false,
    label: "Maya Chen",
    interviewerId: "demo-maya",
    role: "interviewer",
    teamId: DEMO_TEAM_ID,
    teamName: "Demo Robotics",
  });
  seed(getGetQueueQueryKey(), {
    currentApplicants: [],
    nextApplicants: [],
    interviewerLabels: ["Maya Chen", "Leo Park"],
    completedCount: 0,
    remainingCount: 0,
    updatedAt: DEMO_TIMESTAMP,
  });
  seed(getGetQueueLabelsQueryKey(), {
    interviewerLabels: ["Maya Chen", "Leo Park"],
  });
  seed(getListChatCustomEmojisQueryKey(), { items: [] });
  seed(getGetChatConversationsQueryKey(), {
    items: [],
    shared: null,
    channels: [],
  });
  seed(getListChatChannelsQueryKey(), {
    items: [
      {
        id: "demo-channel-pit-crew",
        name: "pit-crew",
        emoji: "🔧",
        createdBy: "Maya Chen",
        createdAt: DEMO_TIMESTAMP,
        updatedAt: DEMO_TIMESTAMP,
        members: [
          { id: "demo-maya", displayName: "Maya Chen", role: "interviewer" },
          { id: "demo-leo", displayName: "Leo Park", role: "interviewer" },
        ],
        youAreMember: true,
        canManage: false,
        lastMessageAt: DEMO_TIMESTAMP,
        lastMessageAuthor: "Leo Park",
        lastMessage: "The spare wheel set is ready.",
      },
    ],
  });
  seed(getListInterviewersQueryKey(), {
    items: [
      { id: "demo-maya", displayName: "Maya Chen", hasPassword: true, role: "interviewer" },
      { id: "demo-leo", displayName: "Leo Park", hasPassword: true, role: "interviewer" },
    ],
  });
  seed(getGetInterviewChatQueryKey(DEMO_CHAT_PARAMS), {
    items: [
      {
        id: "demo-message-1",
        author: "Leo Park",
        message: "The new intake bracket clears the front crossbar.",
        scope: "shared",
        peer: null,
        channelId: null,
        parentMessageId: null,
        pinnedAt: null,
        editedAt: null,
        deletedAt: null,
        activities: [],
        reactions: [],
        poll: null,
        readBy: [],
        createdAt: "2026-11-08T18:24:00.000Z",
      },
      {
        id: "demo-message-2",
        author: "Maya Chen",
        message: "Great. I added the updated side plate to the CAD library.",
        scope: "shared",
        peer: null,
        channelId: null,
        parentMessageId: null,
        pinnedAt: null,
        editedAt: null,
        deletedAt: null,
        activities: [],
        reactions: [],
        poll: null,
        readBy: [],
        createdAt: "2026-11-08T18:29:00.000Z",
      },
    ],
    scope: "shared",
    peer: null,
  });
  seed(getListInterviewWhiteboardsQueryKey(DEMO_CHAT_PARAMS), { items: [] });
  seed(getGetChatSettingsQueryKey(), { slowmodeSeconds: 0 });
  seed(getListScheduledChatsQueryKey(), { items: [] });
  seed(getGetPartsDashboardQueryKey(), demoPartsDashboard);
  seed(
    [...getGetPartsPricingPreferenceQueryKey(), DEMO_TEAM_ID],
    { useFtcPricing: true },
  );
  const inventoryParams = {
    search: undefined,
    vendorKey: undefined,
    inventoryOnly: true,
    limit: 100,
    offset: 0,
  };
  seed(getListPartsCatalogQueryKey(inventoryParams), {
    items: demoParts,
    total: demoParts.length,
  });
  seed(getListCadLibraryQueryKey(), demoCadLibrary);
  seed(["/api/storage/cad-status"], {
    usingBackupStorage: false,
    lastFailoverAt: null,
    lastRecoveryAt: null,
  });

  return client;
}

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const client = useMemo(createDemoQueryClient, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
