import { Router, type IRouter } from "express";
import { db, reviewsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { AddReviewBody, AddReviewResponse, ListReviewsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/reviews/:workId", async (req, res) => {
  const rows = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.workId, req.params.workId))
    .orderBy(desc(reviewsTable.createdAt));
  res.json(ListReviewsResponse.parse(rows));
});

router.post("/reviews/:workId", async (req, res) => {
  const parsed = AddReviewBody.parse(req.body);
  const [row] = await db
    .insert(reviewsTable)
    .values({
      deviceId: req.deviceId,
      workId: req.params.workId,
      stars: parsed.stars,
      name: parsed.name,
      text: parsed.text,
    })
    .returning();
  res.json(AddReviewResponse.parse(row));
});

export default router;
