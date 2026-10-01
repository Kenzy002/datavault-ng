import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/require-auth";
import accountRouter from "./account";
import adminRouter from "./admin";
import healthRouter from "./health";
import notificationsRouter from "./notifications";
import servicesRouter from "./services";
import transactionsRouter from "./transactions";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth);
router.use(accountRouter);
router.use(servicesRouter);
router.use(walletRouter);
router.use(transactionsRouter);
router.use(notificationsRouter);
router.use(adminRouter);

export default router;
