import { Router, type IRouter, type Request, type Response } from "express";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSessionProfile, requireAuth } from "../lib/auth";
import { toProfile } from "../lib/shapes";
import { runDigestJob } from "../lib/digest";
import { logger } from "../lib/logger";
import { timingSafeEqual } from "node:crypto";

const router: IRouter = Router();

router.get("/me", async (req: Request, res: Response) => {
  const profile = await getSessionProfile(req);
  if (!profile) {
    res.json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, profile: toProfile(profile) });
});

const UpdateMeBody = z.object({
  unreadDigestOptOut: z.boolean().optional(),
});

router.patch(
  "/me",
  requireAuth,
  async (req: Request, res: Response) => {
    const profile = (req as Request & { profile: { id: string } }).profile;
    const parsed = UpdateMeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
      return;
    }
    const updates: Record<string, unknown> = {};
    if (parsed.data.unreadDigestOptOut !== undefined) {
      updates.unreadDigestOptOut = parsed.data.unreadDigestOptOut;
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No updatable fields provided" });
      return;
    }
    updates.updatedAt = new Date();
    const [updated] = await db
      .update(profilesTable)
      .set(updates)
      .where(eq(profilesTable.id, profile.id))
      .returning();
    res.json(toProfile(updated!));
  },
);

/**
 * Internal cron entry-point. Trigger this via a scheduled task
 * (Vercel cron, GitHub Action, etc.) with the CRON_SECRET header.
 */
router.post("/internal/digest/run", async (req: Request, res: Response) => {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    res.status(503).json({ error: "CRON_SECRET not configured" });
    return;
  }
  const provided = req.header("x-cron-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await runDigestJob();
    res.json(result);
  } catch (err) {
    logger.error({ err }, "digest: run failed");
    res.status(500).json({ error: "Digest run failed" });
  }
});

export default router;
