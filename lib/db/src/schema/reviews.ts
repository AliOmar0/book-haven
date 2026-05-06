import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reviewsTable = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    deviceId: text("device_id").notNull(),
    workId: text("work_id").notNull(),
    stars: integer("stars").notNull(),
    name: text("name").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reviews_work_idx").on(t.workId)],
);

export const insertReviewSchema = createInsertSchema(reviewsTable)
  .omit({ id: true, deviceId: true, createdAt: true })
  .extend({
    stars: z.number().int().min(1).max(5),
    name: z.string().min(1).max(80),
    text: z.string().min(1).max(4000),
  });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;
