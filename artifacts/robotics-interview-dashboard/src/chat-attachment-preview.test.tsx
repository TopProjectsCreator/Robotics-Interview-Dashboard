import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Buffer } from "node:buffer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

import { renderInlineMarkdown } from "./App";
import { TooltipProvider } from "./components/ui/tooltip";

const DOCX_FIXTURE_BASE64 =
  "UEsDBBQAAAAIADoNOF15bjPX6AAAAK0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH1QyU7DMBD9FWuuKHHggBCK0wPLETiUDxjZk8SqN3nc0v49Tlt6QIXjzFv1+tXeO7GjzDYGBbdtB4KCjsaGScHn+rV5AMEFg0EXAyk4EMNq6NeHRCyqNrCCuZT0KCXrmTxyGxOFiowxeyz1zJNMqDc4kbzrunupYygUSlMWDxj6Zxpx64p42df3qUcmxyCeTsQlSwGm5KzGUnG5C+ZXSnNOaKvyyOHZJr6pBJBXExbk74Cz7r0Ok60h8YG5vKGvLPkVs5Em6q2vyvZ/mys94zhaTRf94pZy1MRcF/euvSAebfjpL49zD99QSwMEFAAAAAgAOg04XZv9N+qtAAAAKQEAAAsAAABfcmVscy8ucmVsc43POw7CMAwG4KtE3mlaBoRQ0y4IqSsqB7ASN61oHkrCo7cnAwNFDIy2f3+W6/ZpZnanECdnBVRFCYysdGqyWsClP232wGJCq3B2lgQsFKFt6jPNmPJKHCcfWTZsFDCm5A+cRzmSwVg4TzZPBhcMplwGzT3KK2ri27Lc8fBpwNpknRIQOlUB6xdP/9huGCZJRydvhmz6ceIrkWUMmpKAhwuKq3e7yCzwpuarF5sXUEsDBBQAAAAIADoNOF0t7xcEtgAAAPMAAAARAAAAd29yZC9kb2N1bWVudC54bWxFjsFuwjAMhl8lyn2k4zBNVVsOIK5ME5N2DYmhkRq7sg2Ft6cpBy6f5d/2Jzebex7MDVgSYWs/V5U1gIFiwktr/477j29rRD1GPxBCax8gdtM1Ux0pXDOgmlmAUk+t7VXH2jkJPWQvKxoB59mZOHudW764iTiOTAFEZn8e3Lqqvlz2CW1Rnig+Sh0LuEC7XzqRpiAmoQLfEkxmd9j+m3O665WhcWWpkBcupwJBf9gtwcvp3v92T1BLAQIUAxQAAAAIADoNOF15bjPX6AAAAK0BAAATAAAAAAAAAAAAAACAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQDFAAAAAgAOg04XZv9N+qtAAAAKQEAAAsAAAAAAAAAAAAAAIABGQEAAF9yZWxzLy5yZWxzUEsBAhQDFAAAAAgAOg04XS3vFwS2AAAA8wAAABEAAAAAAAAAAAAAAIAB7wEAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAADAAMAuQAAANQCAAAAAA==";

type Fixture = {
  name: string;
  contentType: string;
  body: Blob;
  assertPreview: (container: HTMLElement) => void;
};

function spreadsheetFixture(extension: "xls" | "xlsx"): Blob {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Applicant", "Score"],
    ["Ada Lovelace", "9"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Scores");
  const bytes = XLSX.write(workbook, { type: "array", bookType: extension });
  return new Blob([bytes], { type: extension === "xls" ? "application/vnd.ms-excel" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const fixtures: Fixture[] = [
  {
    name: "scores.csv",
    contentType: "text/csv",
    body: new Blob(["Applicant,Score\nAda Lovelace,9\nGrace Hopper,10\n"], { type: "text/csv" }),
    assertPreview: container => {
      expect(container.querySelector("table")).toBeInTheDocument();
      expect(container).toHaveTextContent("Ada Lovelace");
      expect(container).toHaveTextContent("Grace Hopper");
    },
  },
  {
    name: "scores.tsv",
    contentType: "text/tab-separated-values",
    body: new Blob(["Applicant\tScore\nAda Lovelace\t9\n"], { type: "text/tab-separated-values" }),
    assertPreview: container => {
      expect(container.querySelector("table")).toBeInTheDocument();
      expect(container).toHaveTextContent("Applicant");
      expect(container).toHaveTextContent("9");
    },
  },
  {
    name: "scores.xls",
    contentType: "application/vnd.ms-excel",
    body: spreadsheetFixture("xls"),
    assertPreview: container => {
      expect(container.querySelector("table")).toBeInTheDocument();
      expect(container).toHaveTextContent("Scores");
      expect(container).toHaveTextContent("Ada Lovelace");
    },
  },
  {
    name: "scores.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: spreadsheetFixture("xlsx"),
    assertPreview: container => {
      expect(container.querySelector("table")).toBeInTheDocument();
      expect(container).toHaveTextContent("Scores");
      expect(container).toHaveTextContent("Ada Lovelace");
    },
  },
  {
    name: "candidate.png",
    contentType: "image/png",
    body: new Blob(["png fixture"], { type: "image/png" }),
    assertPreview: container => expect(container.querySelector("img")).toBeInTheDocument(),
  },
  {
    name: "interview.mp3",
    contentType: "audio/mpeg",
    body: new Blob(["audio fixture"], { type: "audio/mpeg" }),
    assertPreview: container => expect(container.querySelector("audio")).toBeInTheDocument(),
  },
  {
    name: "walkthrough.mp4",
    contentType: "video/mp4",
    body: new Blob(["video fixture"], { type: "video/mp4" }),
    assertPreview: container => expect(container.querySelector("video")).toBeInTheDocument(),
  },
  {
    name: "brief.pdf",
    contentType: "application/pdf",
    body: new Blob(["%PDF-1.4\nfixture"], { type: "application/pdf" }),
    assertPreview: container => expect(container.querySelector("iframe")).toBeInTheDocument(),
  },
  {
    name: "notes.txt",
    contentType: "text/plain",
    body: new Blob(["Interview notes: strong systems thinking."], { type: "text/plain" }),
    assertPreview: container => {
      expect(container.querySelector("pre")).toBeInTheDocument();
      expect(container).toHaveTextContent("strong systems thinking");
    },
  },
  {
    name: "interview-notes.docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    body: new Blob([Buffer.from(DOCX_FIXTURE_BASE64, "base64")], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
    assertPreview: container => {
      expect(container).toHaveTextContent("Robotics interview DOCX fixture");
      expect(container).toHaveTextContent("document preview");
    },
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(await (fixtures.find(fixture => fixture.name === "scores.csv")?.body ?? new Blob()).arrayBuffer(), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    ),
  );
});

describe("chat attachment inline previews", () => {
  it.each(fixtures)("$name renders inline without a storage link", async fixture => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(await fixture.body.arrayBuffer(), {
        status: 200,
        headers: { "content-type": fixture.contentType },
      }),
    );

    const { container } = render(
      <div>{renderInlineMarkdown(`[${fixture.name}](/api/storage/objects/fixture-${fixture.name})`)}</div>,
    );

    await waitFor(() => fixture.assertPreview(container));

    expect(container.querySelector("a[href^='/api/storage/']")).not.toBeInTheDocument();
  });
});

describe("chat mention rendering", () => {
  it("highlights a known interviewer and reveals their profile details on focus", async () => {
    const person = {
      token: "Ishaan",
      label: "Ishaan",
      detail: "Interviewer · tryout team",
      initials: "I",
      kind: "interviewer" as const,
    };
    const { container } = render(
      <TooltipProvider>{renderInlineMarkdown("Thanks, @Ishaan!", [person])}</TooltipProvider>,
    );

    const mention = container.querySelector('[data-testid="chat-mention-ishaan"]');
    expect(mention).toHaveTextContent("@Ishaan");
    fireEvent.focus(mention as HTMLElement);
    await waitFor(() => expect(screen.getByText("Interviewer · tryout team")).toBeVisible());
  });

  it("renders an applicant reference with roster context on focus", async () => {
    const applicant = {
      token: "Applicant Casey Nguyen (Grade 6)",
      label: "Casey Nguyen",
      detail: "Applicant · Grade 6 · Queue #4",
      initials: "CN",
      kind: "applicant" as const,
    };
    const { container } = render(
      <TooltipProvider>{renderInlineMarkdown("Please review @Applicant Casey Nguyen (Grade 6).", [applicant])}</TooltipProvider>,
    );

    const mention = container.querySelector(".chat-mention");
    expect(mention).toHaveTextContent("@Applicant Casey Nguyen (Grade 6)");
    fireEvent.focus(mention as HTMLElement);
    await waitFor(() => expect(screen.getByText("Applicant · Grade 6 · Queue #4")).toBeVisible());
  });
});