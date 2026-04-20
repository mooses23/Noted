import {
  db,
  commitsTable,
  profilesTable,
  songsTable,
  roundsTable,
  votesTable,
  versionMergesTable,
  versionsTable,
  type Profile,
  type Song,
  type Round,
  type Commit,
} from "@workspace/db";
import { and, desc, eq, inArray, sql, SQL } from "drizzle-orm";

export type CommitRow = {
  commit: Commit;
  contributor: Profile;
  song: Song;
  round: Round;
  voteCount: number;
  hasVoted: boolean;
};

export async function fetchCommitRows(
  where: SQL | undefined,
  opts: {
    voterId?: string;
    sort?: "top" | "newest";
    limit?: number;
  } = {},
): Promise<CommitRow[]> {
  const voterId = opts.voterId ?? null;

  const rows = await db
    .select({
      commit: commitsTable,
      contributor: profilesTable,
      song: songsTable,
      round: roundsTable,
      voteCount: sql<number>`(
        select count(*)::int from ${votesTable}
        where ${votesTable.commitId} = ${commitsTable.id}
      )`,
      hasVoted: voterId
        ? sql<boolean>`exists (
            select 1 from ${votesTable}
            where ${votesTable.commitId} = ${commitsTable.id}
              and ${votesTable.voterId} = ${voterId}
          )`
        : sql<boolean>`false`,
    })
    .from(commitsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, commitsTable.contributorId))
    .innerJoin(songsTable, eq(songsTable.id, commitsTable.songId))
    .innerJoin(roundsTable, eq(roundsTable.id, commitsTable.roundId))
    .where(where)
    .orderBy(
      opts.sort === "top"
        ? desc(sql`(
            select count(*) from ${votesTable}
            where ${votesTable.commitId} = ${commitsTable.id}
          )`)
        : desc(commitsTable.createdAt),
    )
    .limit(opts.limit ?? 500);

  return rows as CommitRow[];
}

export async function fetchCommitById(
  id: string,
  voterId?: string,
): Promise<CommitRow | null> {
  const rows = await fetchCommitRows(eq(commitsTable.id, id), { voterId, limit: 1 });
  return rows[0] ?? null;
}

export async function fetchMergedVersionForCommit(commitId: string) {
  const rows = await db
    .select({ version: versionsTable })
    .from(versionMergesTable)
    .innerJoin(versionsTable, eq(versionsTable.id, versionMergesTable.versionId))
    .where(eq(versionMergesTable.commitId, commitId))
    .limit(1);
  return rows[0]?.version ?? null;
}

export { inArray };
