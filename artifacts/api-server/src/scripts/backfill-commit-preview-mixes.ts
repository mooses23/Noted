import { db, commitsTable } from "@workspace/db";
import { generateAndStoreCommitPreviewMix } from "../lib/commitPreviewMix";

/**
 * Backfill `commits.previewMixUrl` for any commit that doesn't already have a
 * generated layered mix. The single predicate is namespace-based: a URL is
 * considered "real" only if it lives under
 * `/objects/songs/{songId}/commits/{commitId}/` (the path
 * `uploadCommitPreviewMix` writes to). Anything else — null, seed-mix
 * placeholders, or a published version mix used as a stand-in — gets
 * regenerated, regardless of commit status.
 *
 * Merged commits are included on purpose: we still want their "with commit"
 * card to play a true single-stem-on-base preview rather than the full
 * published mix (which already contains every other merged stem too).
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
      overlayOffsetSeconds: commitsTable.overlayOffsetSeconds,
    })
    .from(commitsTable);

  const needsBackfill = rows.filter((r) => {
    const url = r.previewMixUrl ?? "";
    return !url.startsWith(`/objects/songs/${r.songId}/commits/${r.id}/`);
  });

  console.log(
    `Found ${needsBackfill.length} commit(s) needing a real layered preview mix.`,
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
