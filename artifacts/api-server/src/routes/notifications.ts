import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  ListNotificationsResponse,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
} from "@workspace/api-zod";
import { db, notificationsTable } from "@workspace/db";
import { serializeNotification } from "../lib/datavault";

const router: IRouter = Router();

router.get("/notifications", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(100);
  res.json(
    ListNotificationsResponse.parse(notifications.map(serializeNotification)),
  );
});

router.patch("/notifications/read-all", async (_req, res): Promise<void> => {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, res.locals.userId as string));
  res
    .status(204)
    .send(MarkAllNotificationsReadResponse.parse(undefined));
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const parsed = MarkNotificationReadParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const [notification] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.id, parsed.data.id),
      ),
    )
    .returning();

  if (!notification) {
    res.status(404).json({ error: "Notification not found." });
    return;
  }

  res.json(
    MarkNotificationReadResponse.parse(serializeNotification(notification)),
  );
});

export default router;