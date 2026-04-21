import { spawn } from "child_process";
import { mkdtemp, rm, writeFile, readFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";
import { ObjectStorageService, objectStorageClient } from "./objectStorage";

const objectStorage = new ObjectStorageService();

const FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg";
const DEFAULT_FFMPEG_TIMEOUT_MS = 90_000;
const MAX_INPUTS = 8;

export class AudioMixError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AudioMixError";
    this.cause = cause;
  }
}

async function downloadObjectToFile(
  objectPath: string,
  dest: string,
): Promise<void> {
  const file = await objectStorage.getObjectEntityFile(objectPath);
  const [buf] = await file.download();
  await writeFile(dest, buf);
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderrTail = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new AudioMixError(`ffmpeg timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    proc.stderr.on("data", (chunk: Buffer) => {
      stderrTail += chunk.toString("utf8");
      if (stderrTail.length > 8192) stderrTail = stderrTail.slice(-8192);
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new AudioMixError(`ffmpeg spawn failed: ${err.message}`, err));
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(
          new AudioMixError(
            `ffmpeg exited with code ${code}: ${stderrTail.slice(-500)}`,
          ),
        );
      }
    });
  });
}

/**
 * Layer a base mix together with one or more commit stems into a single
 * stereo mp3. Uses ffmpeg's `amix` filter with `duration=longest` so any
 * stem shorter than the base is simply silent at the tail; `normalize=0`
 * keeps each input at unit gain so the auto-mix sounds the same as a hand
 * stack of the same files in a DAW.
 *
 * Throws AudioMixError on any failure (download, ffmpeg, decode). Callers
 * should treat the error as a soft fall-through to the manual upload path.
 */
export async function mixLayeredAudio(opts: {
  baseObjectPath: string;
  commitObjectPaths: string[];
  /**
   * Per-commit start offset in seconds (same length as commitObjectPaths).
   * When provided and > 0, the matching commit input is delayed by that
   * many seconds before being summed into the mix. Defaults to all zeros
   * (commits start at the same instant as the base).
   */
  commitOffsetsSeconds?: number[];
  /** Override the default ffmpeg watchdog timeout (90s). */
  timeoutMs?: number;
}): Promise<{ buffer: Buffer; mimeType: string; sizeBytes: number }> {
  const { baseObjectPath, commitObjectPaths, commitOffsetsSeconds } = opts;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_FFMPEG_TIMEOUT_MS;
  if (commitObjectPaths.length === 0) {
    throw new AudioMixError("At least one commit is required to mix.");
  }
  if (commitObjectPaths.length + 1 > MAX_INPUTS) {
    throw new AudioMixError(
      `Too many inputs to auto-mix (max ${MAX_INPUTS - 1} commits).`,
    );
  }
  if (
    commitOffsetsSeconds &&
    commitOffsetsSeconds.length !== commitObjectPaths.length
  ) {
    throw new AudioMixError(
      "commitOffsetsSeconds length must match commitObjectPaths length.",
    );
  }

  const work = await mkdtemp(path.join(tmpdir(), "automix-"));
  try {
    const inputPaths: string[] = [];
    const basePath = path.join(work, "base.audio");
    await downloadObjectToFile(baseObjectPath, basePath);
    inputPaths.push(basePath);

    for (let i = 0; i < commitObjectPaths.length; i++) {
      const dest = path.join(work, `commit-${i}.audio`);
      await downloadObjectToFile(commitObjectPaths[i]!, dest);
      inputPaths.push(dest);
    }

    // Build a filter graph that optionally pre-delays each commit input by
    // its overlayOffsetSeconds (using `adelay` with the same delay on both
    // channels) before summing everything with `amix`. The base track is
    // never delayed; index 0 in inputPaths is the base.
    const filterParts: string[] = [];
    const amixLabels: string[] = ["[0:a]"];
    for (let i = 0; i < commitObjectPaths.length; i++) {
      const inputIdx = i + 1;
      const offsetSec = Math.max(0, commitOffsetsSeconds?.[i] ?? 0);
      if (offsetSec > 0) {
        const delayMs = Math.round(offsetSec * 1000);
        const label = `[d${i}]`;
        filterParts.push(`[${inputIdx}:a]adelay=${delayMs}|${delayMs}${label}`);
        amixLabels.push(label);
      } else {
        amixLabels.push(`[${inputIdx}:a]`);
      }
    }
    filterParts.push(
      `${amixLabels.join("")}amix=inputs=${inputPaths.length}:duration=longest:dropout_transition=0:normalize=0`,
    );

    const out = path.join(work, "mix.mp3");
    const args: string[] = ["-hide_banner", "-loglevel", "error"];
    for (const ip of inputPaths) {
      args.push("-i", ip);
    }
    args.push(
      "-filter_complex",
      filterParts.join(";"),
      "-ac",
      "2",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      "-y",
      out,
    );

    await runFfmpeg(args, timeoutMs);

    const buffer = await readFile(out);
    if (buffer.length === 0) {
      throw new AudioMixError("ffmpeg produced an empty mix file");
    }
    return { buffer, mimeType: "audio/mpeg", sizeBytes: buffer.length };
  } finally {
    rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

function parseObjectPath(fullPath: string): {
  bucketName: string;
  objectName: string;
} {
  const trimmed = fullPath.startsWith("/") ? fullPath.slice(1) : fullPath;
  const parts = trimmed.split("/");
  if (parts.length < 2) {
    throw new AudioMixError(`Invalid storage path: ${fullPath}`);
  }
  return { bucketName: parts[0]!, objectName: parts.slice(1).join("/") };
}

/**
 * Persist an auto-mixed buffer under the song's versions namespace and
 * return the canonical `/objects/...` entity path that the publish-version
 * endpoint accepts as `officialMixObjectPath`.
 */
export async function uploadAutoMix(
  songId: string,
  buffer: Buffer,
): Promise<string> {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) {
    throw new AudioMixError(
      "PRIVATE_OBJECT_DIR not set; cannot persist auto-mix.",
    );
  }
  const objectId = `${randomUUID()}-automix.mp3`;
  const fullPath = `${dir.replace(/\/+$/, "")}/songs/${songId}/versions/${objectId}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(buffer, {
    contentType: "audio/mpeg",
    resumable: false,
  });
  return `/objects/songs/${songId}/versions/${objectId}`;
}

/**
 * Persist an auto-mixed buffer for a single commit's "with commit" preview
 * under that commit's namespace. Kept in a separate directory from version
 * auto-mixes so version cleanup never sweeps these away.
 */
export async function uploadCommitPreviewMix(
  songId: string,
  commitId: string,
  buffer: Buffer,
): Promise<string> {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) {
    throw new AudioMixError(
      "PRIVATE_OBJECT_DIR not set; cannot persist commit preview mix.",
    );
  }
  const objectId = `${randomUUID()}-automix.mp3`;
  const fullPath = `${dir.replace(/\/+$/, "")}/songs/${songId}/commits/${commitId}/${objectId}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(buffer, {
    contentType: "audio/mpeg",
    resumable: false,
  });
  return `/objects/songs/${songId}/commits/${commitId}/${objectId}`;
}

/**
 * Delete auto-mix preview objects under the song's versions namespace that
 * are not referenced by any published version's officialMixUrl. Pass
 * `keepEntityPaths` to additionally protect freshly generated previews
 * (e.g. the one we just uploaded for this curator session).
 *
 * Best-effort: storage / list errors are swallowed and a summary is
 * returned so callers can log without failing the parent request.
 */
export async function cleanupOrphanedAutoMixes(opts: {
  songId: string;
  referencedEntityPaths: string[];
  keepEntityPaths?: string[];
}): Promise<{ deleted: number; errors: number }> {
  const { songId, referencedEntityPaths, keepEntityPaths = [] } = opts;
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) {
    return { deleted: 0, errors: 0 };
  }

  const protectedSet = new Set<string>([
    ...referencedEntityPaths,
    ...keepEntityPaths,
  ]);

  const prefixFullPath = `${dir.replace(/\/+$/, "")}/songs/${songId}/versions/`;
  let bucketName: string;
  let prefix: string;
  try {
    ({ bucketName, objectName: prefix } = parseObjectPath(prefixFullPath));
  } catch {
    return { deleted: 0, errors: 0 };
  }

  let files;
  try {
    [files] = await objectStorageClient.bucket(bucketName).getFiles({ prefix });
  } catch {
    return { deleted: 0, errors: 1 };
  }

  let deleted = 0;
  let errors = 0;
  for (const file of files) {
    if (!file.name.endsWith("-automix.mp3")) continue;
    const objectId = file.name.slice(prefix.length);
    if (objectId.includes("/")) continue; // safety: stay one level deep
    const entityPath = `/objects/songs/${songId}/versions/${objectId}`;
    if (protectedSet.has(entityPath)) continue;
    try {
      await file.delete({ ignoreNotFound: true });
      deleted++;
    } catch {
      errors++;
    }
  }
  return { deleted, errors };
}
