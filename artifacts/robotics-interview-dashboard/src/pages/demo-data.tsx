import { useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getGetChatConversationsQueryKey,
  getGetChatSettingsQueryKey,
  getGetInterviewChatQueryKey,
  getGetPartsCatalogDetailsQueryKey,
  getGetPartsDashboardQueryKey,
  getGetPartsPricingPreferenceQueryKey,
  getGetPartsRobotDetailsQueryKey,
  getGetQueueLabelsQueryKey,
  getGetQueueQueryKey,
  getGetSessionQueryKey,
  getListCodeFilesQueryKey,
  getListCodeProjectsQueryKey,
  getListCodeRevisionsQueryKey,
  getListCadLibraryQueryKey,
  getListChatChannelsQueryKey,
  getListChatCustomEmojisQueryKey,
  getListInterviewWhiteboardsQueryKey,
  getListInterviewersQueryKey,
  getListPartsCatalogQueryKey,
  getListScheduledChatsQueryKey,
  type CadLibrary,
  type PartsCatalogItem,
  type PartsCatalogSearchResult,
  type PartsDashboard,
  type PartsRobotDetails,
  type PartsVendor,
} from "@workspace/api-client-react";

const DEMO_TEAM_ID = "demo-team";
const DEMO_CHAT_PARAMS = {
  limit: 30,
  scope: "shared",
  author: "Maya Chen",
} as const;
const DEMO_TIMESTAMP = "2026-11-08T18:30:00.000Z";
const DEMO_CODE_PROJECT_ID = "demo-code-project";
const DEMO_CHAT_CHANNELS = [
  {
    id: "demo-channel-pit-crew",
    name: "pit-crew",
    emoji: "🔧",
    lastMessage: "The spare wheel set is ready.",
    author: "Leo Park",
    messages: [
      ["Leo Park", "The spare wheel set is ready."],
      ["Maya Chen", "Thanks. I added it to the Rover build list."],
    ],
  },
  {
    id: "demo-channel-build-log",
    name: "build-log",
    emoji: "🛠️",
    lastMessage: "Drivebase test passed at low speed.",
    author: "Avery Kim",
    messages: [
      ["Avery Kim", "Drivebase test passed at low speed."],
      ["Maya Chen", "Next up: check the intake clearance."],
    ],
  },
  {
    id: "demo-channel-strategy",
    name: "strategy",
    emoji: "📋",
    lastMessage: "We have room for one more autonomous test.",
    author: "Noah Patel",
    messages: [
      ["Noah Patel", "We have room for one more autonomous test."],
      ["Maya Chen", "Let's compare the two parking paths."],
    ],
  },
] as const;

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
      fileName: "drivebase-side-plate.stl",
      contentType: "model/stl",
      objectPath: "/demo/drivebase-side-plate.stl",
      sizeBytes: 6_840,
      botId: null,
      folderId: null,
      notes: "Fictional sample model stored with the public demo.",
      uploadedBy: "Maya Chen",
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    },
  ],
};

const demoCodeFiles = [
  {
    id: "demo-code-teleop",
    projectId: DEMO_CODE_PROJECT_ID,
    path: "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/BioBuzzTeleOp.java",
    content: `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.OpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

@TeleOp(name = "BioBuzz TeleOp")
public class BioBuzzTeleOp extends OpMode {
    @Override
    public void init() {
        telemetry.addLine("Demo robot ready");
    }

    @Override
    public void loop() {
        telemetry.addData("Drive", "Ready");
    }
}
`,
    updatedBy: "Maya Chen",
    createdAt: DEMO_TIMESTAMP,
    updatedAt: DEMO_TIMESTAMP,
  },
  {
    id: "demo-code-auto",
    projectId: DEMO_CODE_PROJECT_ID,
    path: "TeamCode/src/main/java/org/firstinspires/ftc/teamcode/AutoPark.java",
    content: `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;

@Autonomous(name = "Demo Park")
public class AutoPark extends LinearOpMode {
    @Override
    public void runOpMode() throws InterruptedException {
        telemetry.addLine("Waiting for start");
        telemetry.update();
        waitForStart();
        telemetry.addLine("Parking path complete");
        telemetry.update();
    }
}
`,
    updatedBy: "Leo Park",
    createdAt: DEMO_TIMESTAMP,
    updatedAt: DEMO_TIMESTAMP,
  },
  {
    id: "demo-code-readme",
    projectId: DEMO_CODE_PROJECT_ID,
    path: "README.md",
    content: "# Demo Robotics code\n\nFictional FTC sample project. The preview is read-only and is not connected to a Git repository or robot hub.\n",
    updatedBy: "Maya Chen",
    createdAt: DEMO_TIMESTAMP,
    updatedAt: DEMO_TIMESTAMP,
  },
].map((file) => ({ ...file, sizeBytes: file.content.length }));

export const DEMO_PARTS_SEARCH_RESULTS: PartsCatalogSearchResult[] = [
  {
    vendorKey: "gobilda",
    vendorName: "goBILDA",
    title: "Strafer Chassis 96mm Wheel",
    url: "https://www.gobilda.com/",
    description: "Fictional supplier-search sample for the public demo.",
    sku: "3610-0002-0001",
    imageUrl: null,
    price: "24.99",
    ftcTeamPrice: "19.99",
    currency: "USD",
    priceIsStartingAt: false,
    inStock: true,
  },
  {
    vendorKey: "rev",
    vendorName: "REV Robotics",
    title: "JST-PH 3-pin Cable",
    url: "https://www.revrobotics.com/",
    description: "Fictional sensor cable result for the public demo.",
    sku: "REV-31-1410",
    imageUrl: null,
    price: "3.49",
    ftcTeamPrice: null,
    currency: "USD",
    priceIsStartingAt: false,
    inStock: true,
  },
  {
    vendorKey: "rev",
    vendorName: "REV Robotics",
    title: "Demo Servo Bracket",
    url: "https://www.revrobotics.com/",
    description: "Fictional aluminum bracket result for the public demo.",
    sku: "DEMO-SERVO-01",
    imageUrl: null,
    price: "8.25",
    ftcTeamPrice: null,
    currency: "USD",
    priceIsStartingAt: false,
    inStock: true,
  },
];

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
    channels: DEMO_CHAT_CHANNELS.map((channel) => ({
      channelId: channel.id,
      channelName: channel.name,
      channelEmoji: channel.emoji,
      lastMessageAt: DEMO_TIMESTAMP,
      lastMessageAuthor: channel.author,
      lastMessage: channel.lastMessage,
      isUnread: false,
    })),
  });
  seed(getListChatChannelsQueryKey(), {
    items: DEMO_CHAT_CHANNELS.map((channel) => ({
      id: channel.id,
      name: channel.name,
      emoji: channel.emoji,
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
      lastMessageAuthor: channel.author,
      lastMessage: channel.lastMessage,
    })),
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
  for (const channel of DEMO_CHAT_CHANNELS) {
    const params = {
      limit: 30,
      scope: "channel",
      author: "Maya Chen",
      channelId: channel.id,
    } as const;
    seed(getGetInterviewChatQueryKey(params), {
      items: channel.messages.map(([author, message], index) => ({
        id: `${channel.id}-message-${index + 1}`,
        author,
        message,
        scope: "channel",
        peer: channel.id,
        channelId: channel.id,
        parentMessageId: null,
        pinnedAt: null,
        editedAt: null,
        deletedAt: null,
        activities: [],
        reactions: [],
        poll: null,
        readBy: [],
        createdAt: `2026-11-08T18:${String(10 + index * 5).padStart(2, "0")}:00.000Z`,
      })),
      scope: "channel",
      peer: channel.id,
      channel: { id: channel.id, name: channel.name },
    });
    seed(getListInterviewWhiteboardsQueryKey(params), { items: [] });
  }
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
  for (const [index, item] of demoParts.entries()) {
    seed(getGetPartsCatalogDetailsQueryKey(item.id), {
      item,
      priceSnapshots: [{
        id: `demo-price-${index + 1}`,
        partId: item.id,
        vendorKey: item.vendorKey,
        vendorName: item.vendorName,
        sourceUrl: item.productUrl ?? "https://example.invalid/demo",
        unitPrice: item.supplierPrice ?? 0,
        currency: item.supplierPriceCurrency ?? "USD",
        capturedAt: DEMO_TIMESTAMP,
        isStartingAt: false,
        isStale: false,
      }],
      locations: item.storageLocation ? [item.storageLocation] : [],
    });
  }
  const demoRobotDetails: PartsRobotDetails = {
    robot: demoPartsDashboard.robots[0],
    parts: [{
      partId: demoParts[0].id,
      name: demoParts[0].name,
      vendorKey: demoParts[0].vendorKey,
      vendorName: demoParts[0].vendorName,
      sku: demoParts[0].sku,
      productUrl: demoParts[0].productUrl,
      quantity: 4,
      unitCost: demoParts[0].unitCost ?? null,
      costCurrency: demoParts[0].costCurrency ?? null,
      lineTotal: (demoParts[0].unitCost ?? 0) * 4,
      priceSnapshots: [],
    }],
    subtotalsByCurrency: [{ currency: "USD", amount: (demoParts[0].unitCost ?? 0) * 4 }],
    unpricedPartCount: 0,
  };
  seed(getGetPartsRobotDetailsQueryKey("demo-robot"), demoRobotDetails);
  seed(getListCadLibraryQueryKey(), demoCadLibrary);
  seed(["/api/storage/cad-status"], {
    usingBackupStorage: false,
    lastFailoverAt: null,
    lastRecoveryAt: null,
  });
  seed(getListCodeProjectsQueryKey(), {
    projects: [{
      id: DEMO_CODE_PROJECT_ID,
      name: "BioBuzz FTC",
      sdkVersion: "12.0",
      gitConfig: {},
      fileCount: demoCodeFiles.length,
      createdAt: DEMO_TIMESTAMP,
      updatedAt: DEMO_TIMESTAMP,
    }],
  });
  seed(getListCodeFilesQueryKey(DEMO_CODE_PROJECT_ID), { files: demoCodeFiles });
  seed(getListCodeRevisionsQueryKey(DEMO_CODE_PROJECT_ID), {
    revisions: [{
      id: "demo-code-revision-1",
      projectId: DEMO_CODE_PROJECT_ID,
      message: "Add sample TeleOp and autonomous routines",
      author: "Maya Chen",
      createdAt: DEMO_TIMESTAMP,
    }],
  });

  return client;
}

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const client = useMemo(createDemoQueryClient, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
