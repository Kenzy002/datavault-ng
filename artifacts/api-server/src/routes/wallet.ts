import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  CreateWalletTopUpBody,
  CreateWalletTopUpResponse,
  GetWalletResponse,
} from "@workspace/api-zod";
import {
  db,
  notificationsTable,
  transactionsTable,
  walletsTable,
} from "@workspace/db";
import { getUserWallet, serializeTransaction, serializeWallet } from "../lib/datavault";

const router: IRouter = Router();

router.get("/wallet", async (_req, res): Promise<void> => {
  const wallet = await getUserWallet(res.locals.userId as string);
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found." });
    return;
  }
  res.json(GetWalletResponse.parse(serializeWallet(wallet)));
});

router.post("/wallet/top-ups", async (req, res): Promise<void> => {
  const parsed = CreateWalletTopUpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const result = await db.transaction(async (transaction) => {
    const [wallet] = await transaction
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId))
      .for("update");

    if (!wallet) {
      return { error: "Wallet not found." } as const;
    }

    const [updatedWallet] = await transaction
      .update(walletsTable)
      .set({
        balanceKobo: wallet.balanceKobo + parsed.data.amountKobo,
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.userId, userId))
      .returning();

    const [newTransaction] = await transaction
      .insert(transactionsTable)
      .values({
        userId,
        category: "wallet_top_up",
        provider: "DataVault test wallet",
        description: "Test wallet top-up",
        accountReference: "Test funding",
        amountKobo: parsed.data.amountKobo,
        status: "successful",
        isTest: true,
      })
      .returning();

    await transaction.insert(notificationsTable).values({
      userId,
      title: "Test funds added",
      message: "Mock wallet funds were added. No payment was collected.",
    });

    return { wallet: updatedWallet, transaction: newTransaction } as const;
  });

  if ("error" in result) {
    res.status(404).json({ error: result.error });
    return;
  }

  res.status(201).json(
    CreateWalletTopUpResponse.parse({
      wallet: serializeWallet(result.wallet),
      transaction: serializeTransaction(result.transaction),
    }),
  );
});

export default router;