import { Router, type IRouter } from "express";
import healthRouter from "./health";
import favoritesRouter from "./favorites";
import reviewsRouter from "./reviews";
import proxyRouter from "./proxy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(favoritesRouter);
router.use(reviewsRouter);
router.use(proxyRouter);

export default router;
