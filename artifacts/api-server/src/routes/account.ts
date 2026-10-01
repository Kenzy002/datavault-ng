import { Router, type IRouter } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import {
  GetDashboardSummaryResponse,
  GetMyProfileResponse,
  UpdateMyProfileBody,
  UpdateMyProfileResponse,
} from "@workspace/api-zod";
import {
  db,
  transactionsTable,
  usersTable,
  walletsTable,
} from "@workspace/db";
import { getRecentUserTransactions, serializeTransaction } from "../lib/datavault";

const router: IRouter = Router();

router.get("/me", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "Account profile not found." });
    return;
  }

  res.json(
    GetMyProfileResponse.parse({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    }),
  );
});

router.patch("/me", async (req, res): Promise<void> => {
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [user] = await db
    .update(usersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "Account profile not found." });
    return;
  }

  res.json(
    UpdateMyProfileResponse.parse({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    }),
  );
});

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId));

  const startMonth = new Date();
  startMonth.setUTCHours(0, 0, 0, 0);
  startMonth.setUTCDate(1);
  startMonth.setUTCMonth(startMonth.getUTCMonth() - 5);

  const rows = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        gte(transactionsTable.createdAt, startMonth),
      ),
    )
    .orderBy(desc(transactionsTable.createdAt));
  const successfulPurchases = rows.filter(
    (transaction) =>
      transaction.status === "successful" &&
      transaction.category !== "wallet_top_up",
  );
  const currentMonth = new Date();
  const spentThisMonthKobo = successfulPurchases
    .filter(
      (transaction) =>
        transaction.createdAt.getUTCFullYear() === currentMonth.getUTCFullYear() &&
        transaction.createdAt.getUTCMonth() === currentMonth.getUTCMonth(),
    )
    .reduce((total, transaction) => total + transaction.amountKobo, 0);

  const months = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(startMonth);
    month.setUTCMonth(startMonth.getUTCMonth() + index);
    const monthTransactions = successfulPurchases.filter(
      (transaction) =>
        transaction.createdAt.getUTCFullYear() === month.getUTCFullYear() &&
        transaction.createdAt.getUTCMonth() === month.getUTCMonth(),
    );
    return {
      month: new Intl.DateTimeFormat("en", {
        month: "short",
        timeZone: "Africa/Lagos",
      }).format(month),
      amountKobo: monthTransactions.reduce(
        (total, transaction) => total + transaction.amountKobo,
        0,
      ),
    };
  });

  res.json(
    GetDashboardSummaryResponse.parse({
      balanceKobo: wallet?.balanceKobo ?? 0,
      spentThisMonthKobo,
      transactionCount: rows.length,
      monthlySpend: months,
      recentTransactions: rows.slice(0, 6).map(serializeTransaction),
    }),
  );
});

export default router;