import {
  db,
  notificationsTable,
  versionMergesTable,
  commitsTable,
  songsTable,
  type InsertNotification,
} from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Recipients for a new comment on a song:
 *   - everyone with a merged commit on the song
 *   - everyone with any commit on the song (covers shortlisted/pending
 *     contributors who are still emotionally invested)
 * minus the comment author themselves. Deduped.
 */
export async function recipientsForSongComment(
  songId: string,
  authorId: string,
): Promise<string[]> {
  const merged = await db
    .selectDistinct({ id: versionMergesTable.contributorId })
    .from(versionMergesTable)
    .innerJoin(commitsTable, eq(versionMergesTable.commitId, commitsTable.id))
    .where(eq(commitsTable.songId, songId));
  const contributors = await db
    .selectDistinct({ id: commitsTable.contributorId })
    .from(commitsTable)
    .where(eq(commitsTable.songId, songId));
  const set = new Set<string>();
  for (const r of [...merged, ...contributors]) {
    if (r.id && r.id !== authorId) set.add(r.id);
  }
  return Array.from(set);
}

export async function notifyNewComment(args: {
  songId: string;
  songSlug: string;
  songTitle: string;
  commentId: string;
  commentBody: string;
  authorId: string;
  authorDisplayName: string;
}): Promise<number> {
  const recipients = await recipientsForSongComment(args.songId, args.authorId);
  if (recipients.length === 0) return 0;

  const snippet =
    args.commentBody.length > 140
      ? `${args.commentBody.slice(0, 137).trimEnd()}…`
      : args.commentBody;

  const rows: InsertNotification[] = recipients.map((userId) => ({
    userId,
    type: "comment",
    title: `${args.authorDisplayName} commented on “${args.songTitle}”`,
    body: snippet,
    linkPath: `/songs/${args.songSlug}#comments`,
    actorId: args.authorId,
    songId: args.songId,
    commentId: args.commentId,
  }));
  await db.insert(notificationsTable).values(rows);
  return rows.length;
}

const STATUS_COPY: Record<
  "shortlisted" | "rejected" | "pending",
  { verb: string; type: string }
> = {
  shortlisted: { verb: "shortlisted", type: "commit_shortlisted" },
  rejected: { verb: "passed on", type: "commit_rejected" },
  pending: { verb: "moved back to pending on", type: "commit_unflagged" },
};

/**
 * Notify a commit's contributor that an admin moved their Note into a new
 * status (shortlisted / rejected / pending). The "merged" status is handled
 * separately by notifyCommitsMerged because it fans out as part of the
 * publish-version flow.
 */
export async function notifyCommitStatusChanged(args: {
  commitId: string;
  contributorId: string;
  commitTitle: string;
  songSlug: string;
  songTitle: string;
  status: "shortlisted" | "rejected" | "pending";
  actorId: string;
  actorDisplayName: string;
  songId?: string | null;
}): Promise<number> {
  if (args.contributorId === args.actorId) return 0;
  const copy = STATUS_COPY[args.status];
  await db.insert(notificationsTable).values({
    userId: args.contributorId,
    type: copy.type,
    title: `${args.actorDisplayName} ${copy.verb} your Note “${args.commitTitle}”`,
    body: `On “${args.songTitle}”.`,
    linkPath: `/commits/${args.commitId}`,
    actorId: args.actorId,
    songId: args.songId ?? null,
    commentId: null,
  } satisfies InsertNotification);
  return 1;
}

/**
 * Notify each merged commit's contributor that their Note is now part of a
 * published version. One notification per commit. Skips notifications where
 * the contributor is also the actor (e.g. an admin merging their own Note).
 */
export async function notifyCommitsMerged(args: {
  songId: string;
  songSlug: string;
  songTitle: string;
  versionId: string;
  versionNumber: number;
  versionTitle: string;
  actorId: string;
  actorDisplayName: string;
  commits: Array<{
    commitId: string;
    contributorId: string;
    commitTitle: string;
  }>;
}): Promise<number> {
  const rows: InsertNotification[] = [];
  for (const c of args.commits) {
    if (c.contributorId === args.actorId) continue;
    rows.push({
      userId: c.contributorId,
      type: "commit_merged",
      title: `Your Note “${c.commitTitle}” was merged into v${args.versionNumber}`,
      body: `“${args.versionTitle}” on ${args.songTitle}.`,
      linkPath: `/songs/${args.songSlug}/versions`,
      actorId: args.actorId,
      songId: args.songId,
      commentId: null,
    });
  }
  if (rows.length === 0) return 0;
  await db.insert(notificationsTable).values(rows);
  return rows.length;
}

