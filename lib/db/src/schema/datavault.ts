import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceCategoryEnum = pgEnum("datavault_service_category", [
  "airtime",
  "mobile_data",
  "electricity",
  "cable_tv",
  "digital_subscription",
]);

export const transactionCategoryEnum = pgEnum("datavault_transaction_category", [
  "airtime",
  "mobile_data",
  "electricity",
  "cable_tv",
  "digital_subscription",
  "wallet_top_up",
]);

export const transactionStatusEnum = pgEnum("datavault_transaction_status", [
  "successful",
  "pending",
  "failed",
]);

export const userRoleEnum = pgEnum("datavault_user_role", ["customer", "admin"]);

export const usersTable = pgTable("datavault_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: userRoleEnum("role").notNull().default("customer"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const walletsTable = pgTable("datavault_wallets", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  balanceKobo: integer("balance_kobo").notNull().default(0),
  currency: text("currency").notNull().default("NGN"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const serviceProductsTable = pgTable("datavault_service_products", {
  id: text("id").primaryKey(),
  category: serviceCategoryEnum("category").notNull(),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  priceKobo: integer("price_kobo"),
  minAmountKobo: integer("min_amount_kobo"),
  maxAmountKobo: integer("max_amount_kobo"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transactionsTable = pgTable("datavault_transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  serviceId: text("service_id").references(() => serviceProductsTable.id, {
    onDelete: "set null",
  }),
  category: transactionCategoryEnum("category").notNull(),
  provider: text("provider").notNull(),
  description: text("description").notNull(),
  accountReference: text("account_reference").notNull(),
  amountKobo: integer("amount_kobo").notNull(),
  status: transactionStatusEnum("status").notNull().default("successful"),
  isTest: boolean("is_test").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsTable = pgTable("datavault_notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertWalletSchema = createInsertSchema(walletsTable).omit({
  id: true,
  updatedAt: true,
});
export const insertServiceProductSchema = createInsertSchema(serviceProductsTable).omit({
  createdAt: true,
});
export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({
  id: true,
  createdAt: true,
});
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type Wallet = typeof walletsTable.$inferSelect;
export type ServiceProduct = typeof serviceProductsTable.$inferSelect;
export type Transaction = typeof transactionsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;