import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import roboticsRouter from "./robotics";
import storageRouter from "./storage";
import presenceRouter from "./presence";
import broadcastsRouter from "./broadcasts";
import eventsRouter from "./events";
import systemRouter from "./system";
import partsRouter from "./parts";
import cadRouter from "./cad";
import codeRouter from "./code";
import featureRequestsRouter from "./featureRequests";
import sitemapRouter, { setApiRouter } from "./sitemap";

const router: IRouter = Router();

router.use(sitemapRouter);

router.use(healthRouter);
router.use(authRouter);
router.use(roboticsRouter);
router.use(storageRouter);
router.use(presenceRouter);
router.use(broadcastsRouter);
router.use(eventsRouter);
router.use(systemRouter);
router.use(partsRouter);
router.use(cadRouter);
router.use(codeRouter);
router.use(featureRequestsRouter);

setApiRouter(router);

export default router;
