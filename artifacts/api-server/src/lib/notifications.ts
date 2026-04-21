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

