import { describe, expect, it } from "vitest";
import { accountSetupErrorMessage } from "./auth-error-messages";

describe("account setup error messages", () => {
  it("shows useful server validation messages for interviewer registration", () => {
    expect(accountSetupErrorMessage({
      status: 400,
      data: { error: "Names containing “robot” aren't allowed by this team. Choose a different name." },
    }, "Could not add that team member.")).toBe("Names containing “robot” aren't allowed by this team. Choose a different name.");
  });

  it("preserves the team access code and rate-limit messages", () => {
    expect(accountSetupErrorMessage({ status: 401, data: { error: "private detail" } }, "fallback"))
      .toBe("The team access code is incorrect. Check it and try again.");
    expect(accountSetupErrorMessage({ status: 429 }, "fallback"))
      .toBe("Too many account setup attempts. Wait a minute and try again.");
  });

  it("does not expose server error details for unexpected failures", () => {
    expect(accountSetupErrorMessage({ status: 500, data: { error: "internal database detail" } }, "fallback"))
      .toBe("Account setup is temporarily unavailable. Check your connection and try again.");
  });
});
