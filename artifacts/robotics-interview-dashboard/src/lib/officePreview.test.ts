import officeParserBrowserBundle from "@jose.espana/docstream/dist/officeparser.browser.js?raw";
import { describe, expect, it } from "vitest";

import { parseOfficePreview } from "./officePreview";
import { officeAttachmentFixtures } from "../test-fixtures/officeAttachments";

describe("browser Office parser", () => {
  it.each(officeAttachmentFixtures.filter(({ name }) => /\.(?:doc|ppt|pptx|odt|ods|odp)$/i.test(name) || name === "slides-without-extension"))(
    "extracts readable content from a valid $name fixture",
    async fixture => {
      window.eval(officeParserBrowserBundle);
      const preview = await parseOfficePreview(fixture.body, fixture.name);
      expect(preview).toContain(fixture.expectedText);
    },
  );
});
