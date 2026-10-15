import { useSyncExternalStore } from "react";

// Whether any realtime stream is currently healthy. Polling queries read
// this and pause their intervals while the stream is live (hints already
// deliver updates faster than any poll tick); the moment every stream drops,
// intervals resume automatically. Same freshness contract, ~zero idle bytes.
let healthyStreams = 0;
const listeners = new Set<() => void>();

function publish(): void {
  for (const listener of listeners) listener();
}

function currentHealth(): boolean {
  return healthyStreams > 0;
}

/**
 * One handle per stream instance. up()/down() are idempotent, so message
 * traffic and reconnect races can never inflate or drain the count.
 */
export function trackRealtimeStream(): { up: () => void; down: () => void } {
  let isUp = false;
  return {
    up: () => {
      if (isUp) return;
      isUp = true;
      healthyStreams += 1;
      publish();
    },
    down: () => {
      if (!isUp) return;
      isUp = false;
      healthyStreams = Math.max(0, healthyStreams - 1);
      publish();
    },
  };
}

export function useRealtimeHealthy(): boolean {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    currentHealth,
    currentHealth,
  );
}
