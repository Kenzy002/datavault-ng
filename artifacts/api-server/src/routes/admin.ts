import { Router, type IRouter } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  GetAdminOverviewResponse,
  ListAdminTransactionsQueryParams,
  ListAdminTransactionsResponse,
  ListAdminUsersResponse,
  UpdateAdminUserBody,
  UpdateAdminUserParams,
  UpdateAdminUserResponse,
} from "@workspace/api-zod";
import {
  db,
  transactionsTable,
  usersTable,
  walletsTable,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/require-auth";
import { serializeTransaction } from "../lib/datavault";

const router: IRouter = Router();
router.use(requireAdmin);

async function getLatestAdminTransactions(limit: number) {
  const rows = await db
    .select({
      transaction: transactionsTable,
      user: usersTable,
    })
    .from(transactionsTable)
    .innerJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit);

  return rows.map(({ transaction, user }) => ({
    ...serializeTransaction(transaction),
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
  }));
}

router.get("/admin/overview", async (_req, res): Promise<void> => {
  const [userCounts] = await db
    .select({
      totalUsers: sql<number>`count(*)::int`,
      activeUsers: sql<number>`count(*) filter (where ${usersTable.isActive})::int`,
    })
    .from(usersTable);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [transactionCounts] = await db
    .select({
      transactionsToday: sql<number>`count(*)::int`,
      volumeTodayKobo: sql<number>`coalesce(sum(${transactionsTable.amountKobo}), 0)::int`,
      pendingTransactions: sql<number>`count(*) filter (where ${transactionsTable.status} = 'pending')::int`,
    })
    .from(transactionsTable)
    .where(gte(transactionsTable.createdAt, today));

  const payload = {
    totalUsers: userCounts?.totalUsers ?? 0,
    activeUsers: userCounts?.activeUsers ?? 0,
    transactionsToday: transactionCounts?.transactionsToday ?? 0,
    volumeTodayKobo: transactionCounts?.volumeTodayKobo ?? 0,
    pendingTransactions: transactionCounts?.pendingTransactions ?? 0,
    recentTransactions: await getLatestAdminTransactions(8),
  };
  res.json(GetAdminOverviewResponse.parse(payload));
});

router.get("/admin/users", async (_req, res): Promise<void> => {
  const users = await db
    .select({
      user: usersTable,
      wallet: walletsTable,
    })
    .from(usersTable)
    .leftJoin(walletsTable, eq(usersTable.id, walletsTable.userId))
    .orderBy(desc(usersTable.createdAt))
    .limit(500);

  res.json(
    ListAdminUsersResponse.parse(
      users.map(({ user, wallet }) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        balanceKobo: wallet?.balanceKobo ?? 0,
        createdAt: user.createdAt.toISOString(),
      })),
    ),
  );
});

router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const params = UpdateAdminUserParams.safeParse(req.params);
  const body = UpdateAdminUserBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Choose an account field to update." });
    return;
  }

  const id = params.data.id;
  const currentAdminId = res.locals.userId as string;
  if (
    id === currentAdminId &&
    (body.data.isActive === false || body.data.role === "customer")
  ) {
    res.status(400).json({ error: "You cannot disable or demote your own admin account." });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning();
  if (!user) {
    res.status(404).json({ error: "Customer not found." });
    return;
  }

  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, id));

  res.json(
    UpdateAdminUserResponse.parse({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      balanceKobo: wallet?.balanceKobo ?? 0,
      createdAt: user.createdAt.toISOString(),
    }),
  );
});

router.get("/admin/transactions", async (req, res): Promise<void> => {
  const parsed = ListAdminTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rows = await getLatestAdminTransactions(parsed.data.limit ?? 50);
  res.json(ListAdminTransactionsResponse.parse(rows));
});

export default router;