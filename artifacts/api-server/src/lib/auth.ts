import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, profilesTable, type Profile } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function getSessionProfile(req: Request): Promise<Profile | null> {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) return null;

  const existing = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId))
    .limit(1);
  if (existing.length > 0) return existing[0]!;

  let displayName = "Contributor";
  let avatarUrl: string | null = null;
  let username: string | null = null;
  try {
    const user = await clerkClient.users.getUser(clerkId);
    displayName =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.username ||
      user.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
      "Contributor";
    username = user.username ?? null;
    avatarUrl = user.imageUrl ?? null;
  } catch {
    // ignore — fall back to defaults
  }

  const [created] = await db
    .insert(profilesTable)
    .values({ clerkId, displayName, username, avatarUrl, isAdmin: false })
    .returning();
  return created!;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const profile = await getSessionProfile(req);
  if (!profile) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as Request & { profile: Profile }).profile = profile;
  next();
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const profile = await getSessionProfile(req);
  if (!profile) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!profile.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  (req as Request & { profile: Profile }).profile = profile;
  next();
}
