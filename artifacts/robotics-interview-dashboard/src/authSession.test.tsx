import { afterEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  getGetSessionQueryKey,
  getListInterviewersQueryKey,
} from "@workspace/api-client-react";
import { clearUserScopedRecords } from "./authSession";

describe("clearUserScopedRecords", () => {
  let queryClient: QueryClient;

  afterEach(() => {
    queryClient?.clear();
  });

  it("preserves the public interviewer list and clears private records", () => {
    queryClient = new QueryClient();
    const interviewers = {
      items: [{ id: "interviewer-1", displayName: "Team member", hasPassword: true }],
    };

    queryClient.setQueryData(getGetSessionQueryKey(), { authenticated: true });
    queryClient.setQueryData(getListInterviewersQueryKey(), interviewers);
    queryClient.setQueryData(["/api/parts/dashboard"], { privateCount: 4 });

    clearUserScopedRecords(queryClient);

    expect(queryClient.getQueryData(getGetSessionQueryKey())).toEqual({
      authenticated: false,
    });
    expect(queryClient.getQueryData(getListInterviewersQueryKey())).toEqual(interviewers);
    expect(queryClient.getQueryData(["/api/parts/dashboard"])).toBeUndefined();
  });

  it("does not cancel an in-flight public interviewer list request", async () => {
    queryClient = new QueryClient();
    const interviewerList = { items: [] };
    let resolveRequest!: (value: typeof interviewerList) => void;
    let markStarted!: () => void;
    let wasAborted = false;
    const requestStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const request = queryClient.fetchQuery({
      queryKey: getListInterviewersQueryKey(),
      queryFn: ({ signal }) => {
        signal.addEventListener("abort", () => {
          wasAborted = true;
        });
        markStarted();
        return new Promise<typeof interviewerList>((resolve) => {
          resolveRequest = resolve;
        });
      },
    });

    await requestStarted;
    clearUserScopedRecords(queryClient);
    resolveRequest(interviewerList);

    await expect(request).resolves.toEqual(interviewerList);
    expect(wasAborted).toBe(false);
  });
});