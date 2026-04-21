import { spawn } from "child_process";
import { mkdtemp, rm, writeFile, readFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";
import { ObjectStorageService, objectStorageClient } from "./objectStorage";

const objectStorage = new ObjectStorageService();

const FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg";
const FFMPEG_TIMEOUT_MS = 90_000;
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

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderrTail = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new AudioMixError(`ffmpeg timed out after ${FFMPEG_TIMEOUT_MS}ms`));
    }, FFMPEG_TIMEOUT_MS);
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
}): Promise<{ buffer: Buffer; mimeType: string; sizeBytes: number }> {
  const { baseObjectPath, commitObjectPaths } = opts;
  if (commitObjectPaths.length === 0) {
    throw new AudioMixError("At least one commit is required to mix.");
  }
  if (commitObjectPaths.length + 1 > MAX_INPUTS) {
    throw new AudioMixError(
      `Too many inputs to auto-mix (max ${MAX_INPUTS - 1} commits).`,
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

    const out = path.join(work, "mix.mp3");
    const args: string[] = ["-hide_banner", "-loglevel", "error"];
    for (const ip of inputPaths) {
      args.push("-i", ip);
    }
    args.push(
      "-filter_complex",
      `amix=inputs=${inputPaths.length}:duration=longest:dropout_transition=0:normalize=0`,
      "-ac",
      "2",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      "-y",
      out,
    );

    await runFfmpeg(args);

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
