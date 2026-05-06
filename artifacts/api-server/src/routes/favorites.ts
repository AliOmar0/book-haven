import { Router, type IRouter } from "express";
import { db, favoritesTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { AddFavoriteBody, AddFavoriteResponse, ListFavoritesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/favorites", async (req, res) => {
  const rows = await db
    .select()
    .from(favoritesTable)
    .where(eq(favoritesTable.deviceId, req.deviceId))
    .orderBy(desc(favoritesTable.createdAt));
  res.json(ListFavoritesResponse.parse(rows));
});

router.post("/favorites", async (req, res) => {
  const parsed = AddFavoriteBody.parse(req.body);
  const [row] = await db
    .insert(favoritesTable)
    .values({
      deviceId: req.deviceId,
      workId: parsed.workId,
      title: parsed.title,
      author: parsed.author ?? null,
      coverUrl: parsed.coverUrl ?? null,
    })
    .onConflictDoUpdate({
      target: [favoritesTable.deviceId, favoritesTable.workId],
      set: {
        title: parsed.title,
        author: parsed.author ?? null,
        coverUrl: parsed.coverUrl ?? null,
      },
    })
    .returning();
  res.json(AddFavoriteResponse.parse(row));
});

router.delete("/favorites/:workId", async (req, res) => {
  await db
    .delete(favoritesTable)
    .where(
      and(
        eq(favoritesTable.deviceId, req.deviceId),
        eq(favoritesTable.workId, req.params.workId),
      ),
    );
  res.json({ ok: true });
});

export default router;
