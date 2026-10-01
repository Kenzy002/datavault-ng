import { getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureDatavaultUser } from "../lib/datavault";

declare global {
  namespace Express {
    interface Locals {
      userId: string;
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  try {
    const [storedUser] = await db
      .select({ id: usersTable.id, isActive: usersTable.isActive })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!storedUser) {
      await ensureDatavaultUser(userId);
    } else if (!storedUser.isActive) {
      res.status(403).json({ error: "This DataVault account is disabled." });
      return;
    }

    res.locals.userId = userId;
    next();
  } catch (error) {
    req.log.error({ err: error }, "Could not initialize authenticated DataVault account");
    res.status(500).json({ error: "Could not load your account." });
  }
};

export const requireAdmin: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const [user] = await db
      .select({ role: usersTable.role, isActive: usersTable.isActive })
      .from(usersTable)
      .where(eq(usersTable.id, res.locals.userId));

    if (!user?.isActive || user.role !== "admin") {
      res.status(403).json({ error: "Administrator access required." });
      return;
    }

    next();
  } catch (error) {
    req.log.error({ err: error }, "Could not verify DataVault administrator role");
    res.status(500).json({ error: "Could not verify administrator access." });
  }
};