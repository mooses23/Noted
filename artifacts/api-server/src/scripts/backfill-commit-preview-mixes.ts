import { db, commitsTable } from "@workspace/db";
import { ne } from "drizzle-orm";
import { generateAndStoreCommitPreviewMix } from "../lib/commitPreviewMix";

/**
 * Backfill `commits.previewMixUrl` for any commit that doesn't already have a
 * generated layered mix. Detects placeholders by checking whether the URL
 * lives under `/objects/songs/{songId}/commits/...` (the namespace
 * `uploadCommitPreviewMix` writes to). Anything else — null, seed mix
 * placeholders, or version mixes used as a stand-in — gets re-generated.
 *
 * Skips merged commits: their previewMixUrl points at the real published
 * version mix and re-mixing would duplicate the already-merged layer.
 *
 * Idempotent and resumable — safe to re-run.
 */
async function main() {
  const rows = await db
    .select({
      id: commitsTable.id,
      songId: commitsTable.songId,
      roundId: commitsTable.roundId,
      audioFileUrl: commitsTable.audioFileUrl,
      previewMixUrl: commitsTable.previewMixUrl,
      status: commitsTable.status,
      overlayOffsetSeconds: commitsTable.overlayOffsetSeconds,
    })
    .from(commitsTable)
    .where(ne(commitsTable.status, "merged"));

  const needsBackfill = rows.filter((r) => {
    const url = r.previewMixUrl ?? "";
    return !url.startsWith(`/objects/songs/${r.songId}/commits/`);
  });

  console.log(
    `Found ${needsBackfill.length} non-merged commit(s) needing a real layered preview mix.`,
  );

  let ok = 0;
  let failed = 0;
  for (const c of needsBackfill) {
    process.stdout.write(`  - ${c.id} ... `);
    const result = await generateAndStoreCommitPreviewMix({
      commitId: c.id,
      songId: c.songId,
      roundId: c.roundId,
      audioFileUrl: c.audioFileUrl,
      overlayOffsetSeconds: c.overlayOffsetSeconds,
    });
    if (result) {
      ok++;
      console.log("ok");
    } else {
      failed++;
      console.log("skipped/failed");
    }
  }

  console.log(`\nDone. ${ok} mixed, ${failed} skipped/failed.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
