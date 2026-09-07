import { Router, type IRouter } from "express";
import {
  GetSessionResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
} from "@workspace/api-zod";
import {
  clearAdminCookie,
  createAdminSession,
  isValidAdminSession,
  setAdminCookie,
} from "../middlewares/adminAuth";

const router: IRouter = Router();

router.post("/auth/login", (req, res): void => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Password is required" });
    return;
  }
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || parsed.data.password !== expected) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  setAdminCookie(res, createAdminSession());
  res.json(LoginResponse.parse({ authenticated: true, label: "Coordinator" }));
});

router.get("/auth/session", (req, res): void => {
  const authenticated = isValidAdminSession(req.cookies?.robotics_admin_session);
  res.json(GetSessionResponse.parse({ authenticated, label: authenticated ? "Coordinator" : undefined }));
});

router.post("/auth/logout", (_req, res): void => {
  clearAdminCookie(res);
  res.json(LogoutResponse.parse({ message: "Logged out" }));
});

export default router;