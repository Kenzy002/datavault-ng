import { clerkClient } from "@clerk/express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  notificationsTable,
  transactionsTable,
  usersTable,
  walletsTable,
} from "@workspace/db";

export async function ensureDatavaultUser(userId: string) {
  const clerkUser = await clerkClient.users.getUser(userId);
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error("The signed-in account does not have a verified email address.");
  }

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    email.split("@")[0] ||
    "DataVault customer";
  const bootstrapAdminEmails = new Set(
    (process.env.DATAVAULT_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  const shouldBootstrapAdmin = bootstrapAdminEmails.has(email.toLowerCase());

  await db.transaction(async (transaction) => {
    const [existing] = await transaction
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!existing) {
      await transaction
        .insert(usersTable)
        .values({
          id: userId,
          email,
          name,
          role: shouldBootstrapAdmin ? "admin" : "customer",
        })
        .onConflictDoNothing();
      await transaction
        .insert(walletsTable)
        .values({ userId, balanceKobo: 0, currency: "NGN" })
        .onConflictDoNothing();
      await transaction.insert(notificationsTable).values({
        userId,
        title: "Welcome to DataVault",
        message: "Your account is ready. Add test funds to explore bill payments.",
      });
      return;
    }

    if (
      existing.email !== email ||
      existing.name !== name ||
      (shouldBootstrapAdmin && existing.role !== "admin")
    ) {
      await transaction
        .update(usersTable)
        .set({
          email,
          name,
          ...(shouldBootstrapAdmin ? { role: "admin" as const } : {}),
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));
    }
    await transaction
      .insert(walletsTable)
      .values({ userId, balanceKobo: 0, currency: "NGN" })
      .onConflictDoNothing();
  });

  const [currentUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!currentUser) {
    throw new Error("Could not load the local user profile.");
  }
  if (!currentUser.isActive) {
    throw new Error("This DataVault account has been disabled.");
  }
  return currentUser;
}

export function serializeTransaction(
  transaction: typeof import("@workspace/db").transactionsTable.$inferSelect,
) {
  return {
    id: transaction.id,
    category: transaction.category,
    provider: transaction.provider,
    description: transaction.description,
    accountReference: transaction.accountReference,
    amountKobo: transaction.amountKobo,
    status: transaction.status,
    isTest: transaction.isTest,
    createdAt: transaction.createdAt.toISOString(),
  };
}

export function serializeWallet(wallet: typeof walletsTable.$inferSelect) {
  return {
    id: wallet.id,
    balanceKobo: wallet.balanceKobo,
    currency: "NGN" as const,
    updatedAt: wallet.updatedAt.toISOString(),
  };
}

export function serializeNotification(
  notification: typeof notificationsTable.$inferSelect,
) {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function getUserWallet(userId: string) {
  const [wallet] = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.userId, userId));
  return wallet;
}

export async function getRecentUserTransactions(userId: string, limit: number) {
  return db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit);
}