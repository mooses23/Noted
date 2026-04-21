import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function backfillRoundBaseVersions() {
  try {
    const result = await db.execute(sql`
      UPDATE rounds r
      SET base_version_id = s.current_version_id
      FROM songs s
      WHERE r.song_id = s.id
        AND r.base_version_id IS NULL
        AND s.current_version_id IS NOT NULL
    `);
    const count = (result as { rowCount?: number | null }).rowCount ?? 0;
    if (count > 0) {
      logger.info({ count }, "Backfilled rounds.base_version_id");
    }
  } catch (err) {
    logger.error({ err }, "Failed to backfill rounds.base_version_id");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void backfillRoundBaseVersions();
});
