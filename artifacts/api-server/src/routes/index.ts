import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import meRouter from "./me";
import songsRouter from "./songs";
import roundsRouter from "./rounds";
import commitsRouter from "./commits";
import votesRouter from "./votes";
import versionsRouter from "./versions";
import creditsRouter from "./credits";
import commentsRouter from "./comments";
import statsRouter from "./stats";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(meRouter);
router.use(songsRouter);
router.use(roundsRouter);
router.use(commitsRouter);
router.use(votesRouter);
router.use(versionsRouter);
router.use(creditsRouter);
router.use(commentsRouter);
router.use(statsRouter);
router.use("/admin", adminRouter);

export default router;
