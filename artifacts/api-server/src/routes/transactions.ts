import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  ListTransactionsQueryParams,
  ListTransactionsResponse,
} from "@workspace/api-zod";
import { db, transactionsTable } from "@workspace/db";
import { serializeTransaction } from "../lib/datavault";

const router: IRouter = Router();

router.get("/transactions", async (req, res): Promise<void> => {
  const parsed = ListTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, res.locals.userId as string))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(parsed.data.limit ?? 30);
  res.json(
    ListTransactionsResponse.parse(transactions.map(serializeTransaction)),
  );
});

export default router;