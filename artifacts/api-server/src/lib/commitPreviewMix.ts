import { db, commitsTable, roundsTable, versionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  AudioMixError,
  mixLayeredAudio,
  uploadCommitPreviewMix,
} from "./audioMix";
import { logger } from "./logger";

/**
 * Generate a "with commit" layered preview by mixing a commit's stem on top
 * of its round's base version mix, persist the result to object storage,
 * and write the resulting URL onto the commit's `previewMixUrl`.
 *
 * Best-effort: returns the new previewMixUrl on success, or `null` on any
 * failure (no base version, ffmpeg error, storage error). Failures are
 * logged but never thrown — the comparator simply hides the layered row.
 */
export async function generateAndStoreCommitPreviewMix(args: {
  commitId: string;
  songId: string;
  roundId: string;
  audioFileUrl: string;
  overlayOffsetSeconds?: number;
}): Promise<string | null> {
  const { commitId, songId, roundId, audioFileUrl, overlayOffsetSeconds } = args;

  const [round] = await db
    .select({ baseVersionId: roundsTable.baseVersionId })
    .from(roundsTable)
    .where(eq(roundsTable.id, roundId))
    .limit(1);
  if (!round?.baseVersionId) {
    logger.info(
      { commitId, roundId },
      "skipping commit preview mix: round has no baseVersionId",
    );
    return null;
  }

  const [base] = await db
    .select({ officialMixUrl: versionsTable.officialMixUrl })
    .from(versionsTable)
    .where(eq(versionsTable.id, round.baseVersionId))
    .limit(1);
  if (!base?.officialMixUrl) {
    logger.info(
      { commitId, baseVersionId: round.baseVersionId },
      "skipping commit preview mix: base version missing officialMixUrl",
    );
    return null;
  }

  try {
    const { buffer } = await mixLayeredAudio({
      baseObjectPath: base.officialMixUrl,
      commitObjectPaths: [audioFileUrl],
      commitOffsetsSeconds: [overlayOffsetSeconds ?? 0],
    });
    const objectPath = await uploadCommitPreviewMix(songId, commitId, buffer);
    await db
      .update(commitsTable)
      .set({ previewMixUrl: objectPath, updatedAt: new Date() })
      .where(eq(commitsTable.id, commitId));
    return objectPath;
  } catch (err) {
    if (err instanceof AudioMixError) {
      logger.warn(
        { err, commitId, songId },
        "commit preview mix generation failed (ffmpeg/audio)",
      );
    } else {
      logger.error(
        { err, commitId, songId },
        "commit preview mix generation failed (unexpected)",
      );
    }
    return null;
  }
}
