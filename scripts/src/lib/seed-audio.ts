import { Storage } from "@google-cloud/storage";
import {
  DEMO_SONG_CREDITS,
  formatCreditLine,
  type DemoSongCredit,
} from "@workspace/seed-content";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

/**
 * Seed audio for "The Long Room" demo song.
 *
 * All tracks below are sourced from Wikimedia Commons under CC BY 3.0.
 * They stand in for the song's piano / vocal / bass / drum stems and mixes
 * so that the public demo plays back real recorded audio rather than
 * procedurally generated tones. The sound roughly matches the brief; it
 * is not a literal recording of "The Long Room".
 *
 * Attribution is reproduced in scripts/src/lib/seed-audio-credits.md.
 */
export type SeedAudioAsset = DemoSongCredit & {
  /** Public source URL. */
  sourceUrl: string;
  /** Content-Type to set on the uploaded object. */
  contentType: string;
  /** Human-readable attribution line, derived from the shared credit. */
  credit: string;
  /** Approximate uncompressed size for seed metadata. */
  sizeBytes: number;
};

/**
 * Per-asset upload metadata (download URL + expected size). Credits/titles
 * for each key are stored alongside in @workspace/seed-content so the
 * LayerStack frontend can render the same attribution to end users.
 */
const SEED_AUDIO_UPLOAD_META: Record<
  string,
  { sourceUrl: string; contentType: string; sizeBytes: number }
> = {
  "seed/the-long-room-v1.mp3": {
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/f/fd/Evening_Fall_%28Piano%29_%28ISRC_USUAN1100235%29.mp3",
    contentType: "audio/mpeg",
    sizeBytes: 5_397_796,
  },
  "seed/the-long-room-v2.mp3": {
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/a/ae/Crinoline_Dreams_%28ISRC_USUAN1700073%29.mp3",
    contentType: "audio/mpeg",
    sizeBytes: 7_888_307,
  },
  "seed/stem-piano.mp3": {
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/f/fd/Evening_Fall_%28Piano%29_%28ISRC_USUAN1100235%29.mp3",
    contentType: "audio/mpeg",
    sizeBytes: 5_397_796,
  },
  "seed/stem-vocal.mp3": {
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/3/36/Amazing_Grace_2011_%28ISRC_USUAN1100820%29.mp3",
    contentType: "audio/mpeg",
    sizeBytes: 7_572_292,
  },
  "seed/click-72.mp3": {
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/f/f5/Heart_is_metronome_%28Antti_Luode%29.mp3",
    contentType: "audio/mpeg",
    sizeBytes: 3_542_354,
  },
  "seed/commit-jules-bass.mp3": {
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/a/a9/Bassy_Bass_%28Antti_Luode%29.mp3",
    contentType: "audio/mpeg",
    sizeBytes: 3_483_309,
  },
  "seed/commit-kenji-drums.mp3": {
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/8/89/Sleeping_Drum_%28Antti_Luode%29.mp3",
    contentType: "audio/mpeg",
    sizeBytes: 4_913_255,
  },
  "seed/commit-sade-drums.mp3": {
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/0/0c/Bang_A_Drum_%28Antti_Luode%29.mp3",
    contentType: "audio/mpeg",
    sizeBytes: 4_853_171,
  },
  "seed/commit-thiago-drums.mp3": {
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/d/d9/Jamming_with_a_drum_machine_%28Antti_Luode%29.mp3",
    contentType: "audio/mpeg",
    sizeBytes: 4_322_379,
  },
  "seed/commit-ilse-drums.mp3": {
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/9/98/Rock_Drums_%28Antti_Luode%29.mp3",
    contentType: "audio/mpeg",
    sizeBytes: 3_718_411,
  },
  "seed/commit-dmitri-drums.mp3": {
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/a/a6/Soul_Of_A_Drum_Machine_%28Antti_Luode%29.mp3",
    contentType: "audio/mpeg",
    sizeBytes: 4_436_268,
  },
};

export const SEED_AUDIO_ASSETS: SeedAudioAsset[] = DEMO_SONG_CREDITS.map(
  (credit) => {
    const upload = SEED_AUDIO_UPLOAD_META[credit.key];
    if (!upload) {
      throw new Error(
        `No upload metadata configured for seed audio key ${credit.key}`,
      );
    }
    return {
      ...credit,
      ...upload,
      credit: formatCreditLine(credit),
    };
  },
);

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  return { bucketName: parts[1]!, objectName: parts.slice(2).join("/") };
}

async function uploadIfMissing(asset: SeedAudioAsset): Promise<void> {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set");
  const fullPath = `${dir.replace(/\/+$/, "")}/${asset.key}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const file = storage.bucket(bucketName).file(objectName);

  const [exists] = await file.exists();
  if (exists) {
    console.log(`  ✓ exists: ${asset.key}`);
    return;
  }

  const res = await fetch(asset.sourceUrl, {
    headers: {
      // Wikimedia asks that bots/clients identify themselves.
      "User-Agent":
        "LayerStack-Seed/1.0 (+https://layerstack.example) Node fetch",
    },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to download ${asset.sourceUrl}: ${res.status} ${res.statusText}`,
    );
  }
  const body = Buffer.from(await res.arrayBuffer());

  // Sanity-check that the upstream file hasn't drifted (re-encoded, replaced,
  // truncated). The expected sizes are pinned to the original Wikimedia
  // Commons revisions used at seed time. If this ever fails, refresh the
  // sizes in SEED_AUDIO_ASSETS after auditing the new revision.
  if (body.length !== asset.sizeBytes) {
    throw new Error(
      `Source drift for ${asset.key}: expected ${asset.sizeBytes} bytes from ` +
        `${asset.sourceUrl}, got ${body.length}. Refresh sizeBytes in ` +
        `SEED_AUDIO_ASSETS after verifying the new upstream revision.`,
    );
  }

  await file.save(body, { contentType: asset.contentType, resumable: false });
  console.log(`  ↑ uploaded: ${asset.key} (${body.length} bytes)`);
}

export async function uploadSeedAudio(): Promise<void> {
  console.log("Syncing seed audio (CC BY 3.0 sources)...");
  for (const asset of SEED_AUDIO_ASSETS) {
    await uploadIfMissing(asset);
  }
  console.log("✓ Seed audio ready");
  console.log("  Attributions: scripts/src/lib/seed-audio-credits.md");
}
