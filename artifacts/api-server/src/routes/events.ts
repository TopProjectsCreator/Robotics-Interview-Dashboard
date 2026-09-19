import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/adminAuth";
import { addSseClient } from "../lib/realtime";

const router: IRouter = Router();

// Server-sent events stream for instant live updates. The server relays
// Supabase Realtime hints here; events carry only table names, browsers
// refetch rows through the authenticated JSON API. Coordinator session
// required. EventSource reconnects automatically when dropped.
router.get("/events", requireAdmin, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(`: connected\n\n`);

  const remove = addSseClient(res);
  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      // Client gone; cleanup happens on close.
    }
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    remove();
  });
});

export default router;
