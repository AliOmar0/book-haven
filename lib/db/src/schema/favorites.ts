import { pgTable, text, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const favoritesTable = pgTable(
  "favorites",
  {
    id: serial("id").primaryKey(),
    deviceId: text("device_id").notNull(),
    workId: text("work_id").notNull(),
    title: text("title").notNull(),
    author: text("author"),
    coverUrl: text("cover_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("favorites_device_work_idx").on(t.deviceId, t.workId)],
);

export const insertFavoriteSchema = createInsertSchema(favoritesTable).omit({
  id: true,
  deviceId: true,
  createdAt: true,
});
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favoritesTable.$inferSelect;
