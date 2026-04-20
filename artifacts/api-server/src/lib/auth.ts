import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, profilesTable, type Profile } from "@workspace/db";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL_ALLOWLIST = (process.env.LAYERSTACK_ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function resolveIsAdmin(
  user: { publicMetadata?: Record<string, unknown>; emailAddresses?: { emailAddress: string }[] },
): boolean {
  const metaAdmin = user.publicMetadata?.["isAdmin"];
  if (metaAdmin === true) return true;
  const role = user.publicMetadata?.["role"];
  if (typeof role === "string" && role.toLowerCase() === "admin") return true;
  if (ADMIN_EMAIL_ALLOWLIST.length > 0) {
    for (const e of user.emailAddresses ?? []) {
      if (ADMIN_EMAIL_ALLOWLIST.includes(e.emailAddress.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

export async function getSessionProfile(req: Request): Promise<Profile | null> {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) return null;

  let clerkUser: Awaited<ReturnType<typeof clerkClient.users.getUser>> | null =
    null;
  try {
    clerkUser = await clerkClient.users.getUser(clerkId);
  } catch {
    // ignore — Clerk fetch may fail in dev
  }

  const isAdmin = clerkUser ? resolveIsAdmin(clerkUser) : false;

  const existing = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId))
    .limit(1);
  if (existing.length > 0) {
    const profile = existing[0]!;
    // Re-sync admin flag so Clerk metadata / email allowlist remain authoritative.
    if (profile.isAdmin !== isAdmin) {
      const [updated] = await db
        .update(profilesTable)
        .set({ isAdmin, updatedAt: new Date() })
        .where(eq(profilesTable.id, profile.id))
        .returning();
      return updated ?? profile;
    }
    return profile;
  }

  let displayName = "Contributor";
  let avatarUrl: string | null = null;
  let username: string | null = null;
  if (clerkUser) {
    displayName =
      [clerkUser.firstName, clerkUser.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      clerkUser.username ||
      clerkUser.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
      "Contributor";
    username = clerkUser.username ?? null;
    avatarUrl = clerkUser.imageUrl ?? null;
  }

  const [created] = await db
    .insert(profilesTable)
    .values({ clerkId, displayName, username, avatarUrl, isAdmin })
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
