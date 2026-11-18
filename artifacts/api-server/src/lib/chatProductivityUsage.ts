import { randomUUID } from "node:crypto";
import { normalizeProviderUsage, type ProviderUsage } from "./assistantProviderUsage";

export type ProductivityReviewSource = "scheduled" | "on_demand";

export type ProductivityUsageEvent = {
  id: string;
  teamId: string;
  source: ProductivityReviewSource;
  modelId: string;
  createdAt: Date;
};

export async function trackProductivityReviewRequest<T>(options: {
  teamId: string;
  modelId: string;
  source: ProductivityReviewSource;
  request: () => Promise<T>;
  startEvent: (event: ProductivityUsageEvent) => Promise<void>;
  finishEvent: (id: string, usage: ProviderUsage | null) => Promise<void>;
  onTrackingError: (stage: "start" | "finish", error: unknown) => void;
}): Promise<T> {
  const event: ProductivityUsageEvent = {
    id: randomUUID(),
    teamId: options.teamId,
    source: options.source,
    modelId: options.modelId,
    createdAt: new Date(),
  };
  let eventStored = false;
  try {
    await options.startEvent(event);
    eventStored = true;
  } catch (error) {
    options.onTrackingError("start", error);
  }

  let response: T;
  try {
    response = await options.request();
  } catch (error) {
    if (eventStored) {
      try {
        await options.finishEvent(event.id, null);
      } catch (trackingError) {
        options.onTrackingError("finish", trackingError);
      }
    }
    throw error;
  }

  if (eventStored) {
    try {
      await options.finishEvent(event.id, normalizeProviderUsage(response));
    } catch (error) {
      options.onTrackingError("finish", error);
    }
  }
  return response;
}
