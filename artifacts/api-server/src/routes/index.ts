import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import roboticsRouter from "./robotics";
import storageRouter from "./storage";
import presenceRouter from "./presence";
import broadcastsRouter from "./broadcasts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(roboticsRouter);
router.use(storageRouter);
router.use(presenceRouter);
router.use(broadcastsRouter);

export default router;
