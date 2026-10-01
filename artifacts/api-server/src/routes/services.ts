import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  CreatePurchaseBody,
  CreatePurchaseResponse,
  ListServicesResponse,
} from "@workspace/api-zod";
import {
  db,
  notificationsTable,
  serviceProductsTable,
  transactionsTable,
  walletsTable,
} from "@workspace/db";
import { ensureSampleCatalog, listActiveProducts, serializeProduct } from "../lib/catalog";
import { serializeTransaction } from "../lib/datavault";

const router: IRouter = Router();

router.get("/services", async (_req, res): Promise<void> => {
  const products = await listActiveProducts();
  res.json(ListServicesResponse.parse(products.map(serializeProduct)));
});

router.post("/transactions", async (req, res): Promise<void> => {
  const parsed = CreatePurchaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await ensureSampleCatalog();
  const [product] = await db
    .select()
    .from(serviceProductsTable)
    .where(eq(serviceProductsTable.id, parsed.data.serviceId));

  if (!product?.isActive) {
    res.status(400).json({ error: "This service is unavailable." });
    return;
  }

  const amountKobo = product.priceKobo ?? parsed.data.amountKobo;
  if (!amountKobo) {
    res.status(400).json({ error: "Enter an amount for this service." });
    return;
  }
  if (
    (product.minAmountKobo !== null && amountKobo < product.minAmountKobo) ||
    (product.maxAmountKobo !== null && amountKobo > product.maxAmountKobo)
  ) {
    res.status(400).json({
      error: `Amount must be between ₦${((product.minAmountKobo ?? 0) / 100).toLocaleString()} and ₦${((product.maxAmountKobo ?? 0) / 100).toLocaleString()}.`,
    });
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
    if (wallet.balanceKobo < amountKobo) {
      return { error: "Your wallet balance is too low for this purchase." } as const;
    }

    const [updatedWallet] = await transaction
      .update(walletsTable)
      .set({ balanceKobo: wallet.balanceKobo - amountKobo, updatedAt: new Date() })
      .where(eq(walletsTable.userId, userId))
      .returning();
    const [newTransaction] = await transaction
      .insert(transactionsTable)
      .values({
        userId,
        serviceId: product.id,
        category: product.category,
        provider: product.provider,
        description: product.name,
        accountReference: parsed.data.accountReference,
        amountKobo,
        status: "successful",
        isTest: true,
      })
      .returning();

    await transaction.insert(notificationsTable).values({
      userId,
      title: "Test purchase complete",
      message: `${product.name} for ${parsed.data.accountReference} was simulated. No service provider was contacted.`,
    });

    return { wallet: updatedWallet, transaction: newTransaction } as const;
  });

  if ("error" in result) {
    res.status(402).json({ error: result.error });
    return;
  }

  req.log.info(
    { transactionId: result.transaction.id, category: product.category },
    "Completed test-mode purchase",
  );
  res.status(201).json(
    CreatePurchaseResponse.parse(serializeTransaction(result.transaction)),
  );
});

export default router;