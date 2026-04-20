import { spawnSync } from "child_process";
import { Storage } from "@google-cloud/storage";

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

const SR = 44100;

type Sample = number;

function makeBuffer(seconds: number): Float32Array {
  return new Float32Array(Math.floor(SR * seconds));
}

function add(buf: Float32Array, startSec: number, samples: Float32Array, gain = 1) {
  const offset = Math.floor(startSec * SR);
  for (let i = 0; i < samples.length; i++) {
    const j = offset + i;
    if (j >= 0 && j < buf.length) buf[j] += samples[i] * gain;
  }
}

function sineNote(freq: number, dur: number, opts: { attack?: number; decay?: number; type?: "sine" | "tri" | "saw" | "square" } = {}): Float32Array {
  const { attack = 0.005, decay = 0.4, type = "sine" } = opts;
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const phase = 2 * Math.PI * freq * t;
    let s: Sample;
    switch (type) {
      case "tri":
        s = (2 / Math.PI) * Math.asin(Math.sin(phase));
        break;
      case "saw":
        s = 2 * (t * freq - Math.floor(0.5 + t * freq));
        break;
      case "square":
        s = Math.sign(Math.sin(phase));
        break;
      default:
        s = Math.sin(phase);
    }
    let env = 1;
    if (t < attack) env = t / attack;
    else env = Math.exp(-(t - attack) / decay);
    out[i] = s * env;
  }
  return out;
}

function noiseBurst(dur: number, decay: number, lowpass = 1): Float32Array {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const white = Math.random() * 2 - 1;
    prev = prev + lowpass * (white - prev);
    out[i] = prev * Math.exp(-t / decay);
  }
  return out;
}

function kick(dur = 0.25): Float32Array {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 120 * Math.exp(-t * 18) + 45;
    out[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.18);
  }
  return out;
}

function snare(dur = 0.2): Float32Array {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t / 0.08);
    const tone = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t / 0.05) * 0.4;
    out[i] = noise * 0.7 + tone;
  }
  return out;
}

function hat(dur = 0.08): Float32Array {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = (Math.random() * 2 - 1) * Math.exp(-t / 0.02);
  }
  return out;
}

function rim(dur = 0.05): Float32Array {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t / 0.01);
  }
  return out;
}

function ride(dur = 0.5): Float32Array {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const noise = (Math.random() * 2 - 1) * 0.4;
    const ping = Math.sin(2 * Math.PI * 4500 * t) * Math.exp(-t / 0.05) * 0.5;
    out[i] = (noise + ping) * Math.exp(-t / 0.3);
  }
  return out;
}

function shaker(dur = 0.12): Float32Array {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const w = Math.random() * 2 - 1;
    prev = prev + 0.3 * (w - prev);
    out[i] = (w - prev) * Math.exp(-Math.pow((t - 0.04) / 0.04, 2));
  }
  return out;
}

function cajon(dur = 0.25): Float32Array {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const tone = Math.sin(2 * Math.PI * 90 * t) * Math.exp(-t / 0.12);
    const slap = (Math.random() * 2 - 1) * Math.exp(-t / 0.025) * 0.5;
    out[i] = tone * 0.8 + slap;
  }
  return out;
}

function tom(freq = 80, dur = 0.4): Float32Array {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = freq + 30 * Math.exp(-t * 20);
    out[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.25);
  }
  return out;
}

// D minor key freqs (Hz)
const D2 = 73.42, A2 = 110.0, D3 = 146.83, F3 = 174.61, A3 = 220.0, C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.0, A4 = 440.0, C5 = 523.25, D5 = 587.33, F5 = 698.46;

const BPM = 72;
const BEAT = 60 / BPM; // 0.833s
const BAR = BEAT * 4;
const DUR = BAR * 4; // 4 bars ≈ 13.3s

function pianoBuf(): Float32Array {
  const buf = makeBuffer(DUR);
  // Two-handed pattern: bass note on 1, chord on 2-4
  const bars: { root: number; chord: number[] }[] = [
    { root: D3, chord: [D4, F4, A4] },
    { root: A2, chord: [C4, E4, A4] },
    { root: F3, chord: [F4, A4, C5] },
    { root: A2, chord: [C4, E4, G4] },
  ];
  for (let b = 0; b < 4; b++) {
    const t0 = b * BAR;
    const { root, chord } = bars[b]!;
    add(buf, t0, sineNote(root / 2, BEAT * 2.5, { type: "tri", decay: 1.2 }), 0.45);
    for (let beat = 1; beat < 4; beat++) {
      for (const f of chord) {
        add(buf, t0 + beat * BEAT, sineNote(f, BEAT * 0.9, { type: "tri", decay: 0.9 }), 0.18);
      }
    }
  }
  return buf;
}

function vocalBuf(): Float32Array {
  const buf = makeBuffer(DUR);
  // Slow melody, vibrato
  const melody: [number, number, number][] = [
    // [startBeat, freq, beats]
    [0, A4, 2], [2, F4, 1], [3, E4, 1],
    [4, D4, 3], [7, F4, 1],
    [8, A4, 2], [10, G4, 1.5], [11.5, F4, 0.5],
    [12, E4, 2], [14, D4, 2],
  ];
  for (const [bt, f, beats] of melody) {
    const dur = beats * BEAT;
    const n = Math.floor(SR * dur);
    const seg = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const vib = 1 + 0.012 * Math.sin(2 * Math.PI * 5.5 * t);
      const env = Math.min(1, t / 0.08) * Math.min(1, (dur - t) / 0.12);
      seg[i] = Math.sin(2 * Math.PI * f * vib * t) * env * 0.5
        + Math.sin(2 * Math.PI * 2 * f * vib * t) * env * 0.08;
    }
    add(buf, bt * BEAT, seg, 0.55);
  }
  return buf;
}

function bassBuf(): Float32Array {
  const buf = makeBuffer(DUR);
  // Walking upright
  const notes: [number, number][] = [
    [D2, 0], [A2, 1], [D3, 2], [F3, 3],
    [A2, 4], [E4 / 4, 5], [A3, 6], [C4, 7],
    [F3, 8], [A3, 9], [C4, 10], [F3, 11],
    [A2, 12], [C4, 13], [E4 / 2, 14], [D3, 15],
  ];
  for (const [f, beat] of notes) {
    add(buf, beat * BEAT, sineNote(f, BEAT * 0.95, { type: "tri", decay: 0.55 }), 0.5);
  }
  return buf;
}

function clickBuf(seconds = 8): Float32Array {
  const buf = makeBuffer(seconds);
  const n = Math.ceil(seconds / BEAT);
  for (let i = 0; i < n; i++) {
    const t = i * BEAT;
    const accent = i % 4 === 0;
    const seg = new Float32Array(Math.floor(SR * 0.05));
    for (let j = 0; j < seg.length; j++) {
      const tt = j / SR;
      seg[j] = Math.sin(2 * Math.PI * (accent ? 1500 : 1000) * tt) * Math.exp(-tt / 0.01);
    }
    add(buf, t, seg, accent ? 0.7 : 0.45);
  }
  return buf;
}

// Drum pattern factories
type Hit = { sound: Float32Array; beat: number; gain?: number };
function drumPattern(hits: Hit[], dur = DUR): Float32Array {
  const buf = makeBuffer(dur);
  for (const h of hits) add(buf, h.beat * BEAT, h.sound, h.gain ?? 0.7);
  return buf;
}

function kenjiBrushes(): Float32Array {
  const hits: Hit[] = [];
  for (let b = 0; b < 16; b++) {
    hits.push({ sound: shaker(0.2), beat: b, gain: 0.5 });
    hits.push({ sound: shaker(0.15), beat: b + 0.5, gain: 0.3 });
  }
  for (let b = 0; b < 16; b += 2) hits.push({ sound: snare(0.18), beat: b + 1, gain: 0.25 });
  return drumPattern(hits);
}

function sadeMallets(): Float32Array {
  const hits: Hit[] = [];
  for (let b = 0; b < 16; b += 2) hits.push({ sound: tom(70, 0.6), beat: b, gain: 0.7 });
  for (let b = 1; b < 16; b += 2) hits.push({ sound: tom(95, 0.45), beat: b, gain: 0.5 });
  return drumPattern(hits);
}

function thiagoCajon(): Float32Array {
  const hits: Hit[] = [];
  for (let b = 0; b < 16; b++) {
    if (b % 2 === 0) hits.push({ sound: cajon(0.25), beat: b, gain: 0.7 });
    else hits.push({ sound: cajon(0.18), beat: b, gain: 0.4 });
    hits.push({ sound: shaker(0.12), beat: b + 0.5, gain: 0.4 });
  }
  return drumPattern(hits);
}

function ilseRide(): Float32Array {
  const hits: Hit[] = [];
  for (let b = 0; b < 16; b++) {
    hits.push({ sound: ride(0.5), beat: b, gain: 0.45 });
    if (b % 4 === 1 || b % 4 === 3) hits.push({ sound: snare(0.18), beat: b, gain: 0.4 });
  }
  return drumPattern(hits);
}

function dmitriMinimal(): Float32Array {
  const hits: Hit[] = [];
  for (let b = 0; b < 16; b += 4) hits.push({ sound: kick(), beat: b, gain: 0.85 });
  for (let b = 0; b < 16; b += 2) hits.push({ sound: hat(), beat: b + 1, gain: 0.5 });
  for (let b = 0; b < 16; b += 4) hits.push({ sound: rim(), beat: b + 2.5, gain: 0.6 });
  return drumPattern(hits);
}

function normalize(buf: Float32Array, peak = 0.85): Float32Array {
  let max = 0;
  for (let i = 0; i < buf.length; i++) if (Math.abs(buf[i]) > max) max = Math.abs(buf[i]);
  if (max === 0) return buf;
  const g = peak / max;
  const out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] * g;
  return out;
}

function mix(...bufs: Array<{ buf: Float32Array; gain: number }>): Float32Array {
  let len = 0;
  for (const b of bufs) if (b.buf.length > len) len = b.buf.length;
  const out = makeBuffer(len / SR);
  for (const b of bufs) for (let i = 0; i < b.buf.length; i++) out[i] += b.buf[i] * b.gain;
  return normalize(out, 0.9);
}

function encodeWav(samples: Float32Array): Buffer {
  const numChannels = 1;
  const bitDepth = 16;
  const byteRate = SR * numChannels * (bitDepth / 8);
  const blockAlign = numChannels * (bitDepth / 8);
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitDepth, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    buf.writeInt16LE(Math.round(s), offset);
    offset += 2;
  }
  return buf;
}

function wavToMp3(wav: Buffer): Buffer {
  const r = spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-f", "wav", "-i", "pipe:0", "-codec:a", "libmp3lame", "-b:a", "128k", "-f", "mp3", "pipe:1"],
    { input: wav, maxBuffer: 64 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    throw new Error(`ffmpeg failed: ${r.stderr.toString()}`);
  }
  return r.stdout;
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const parts = path.split("/");
  return { bucketName: parts[1]!, objectName: parts.slice(2).join("/") };
}

async function uploadIfMissing(seedKey: string, body: Buffer, contentType: string): Promise<void> {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set");
  const fullPath = `${dir.replace(/\/+$/, "")}/${seedKey}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const file = storage.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (exists) {
    console.log(`  ✓ exists: ${seedKey}`);
    return;
  }
  await file.save(body, { contentType, resumable: false });
  console.log(`  ↑ uploaded: ${seedKey} (${body.length} bytes)`);
}

export async function uploadSeedAudio(): Promise<void> {
  console.log("Generating + uploading seed audio...");

  const piano = pianoBuf();
  const vocal = vocalBuf();
  const bass = bassBuf();
  const click = clickBuf(8);

  const v1Mix = mix({ buf: piano, gain: 0.9 }, { buf: vocal, gain: 0.8 });
  const v2Mix = mix({ buf: piano, gain: 0.85 }, { buf: vocal, gain: 0.75 }, { buf: bass, gain: 0.8 });

  const julesBass = bass;
  const drumKenji = kenjiBrushes();
  const drumSade = sadeMallets();
  const drumThiago = thiagoCajon();
  const drumIlse = ilseRide();
  const drumDmitri = dmitriMinimal();

  const wavCT = "audio/wav";
  const mp3CT = "audio/mpeg";

  await uploadIfMissing("seed/the-long-room-v1.mp3", wavToMp3(encodeWav(normalize(v1Mix))), mp3CT);
  await uploadIfMissing("seed/the-long-room-v2.mp3", wavToMp3(encodeWav(normalize(v2Mix))), mp3CT);
  await uploadIfMissing("seed/stem-piano.wav", encodeWav(normalize(piano)), wavCT);
  await uploadIfMissing("seed/stem-vocal.wav", encodeWav(normalize(vocal)), wavCT);
  await uploadIfMissing("seed/click-72.wav", encodeWav(normalize(click)), wavCT);
  await uploadIfMissing("seed/commit-jules-bass.wav", encodeWav(normalize(julesBass)), wavCT);
  await uploadIfMissing("seed/commit-kenji-drums.wav", encodeWav(normalize(drumKenji)), wavCT);
  await uploadIfMissing("seed/commit-sade-drums.wav", encodeWav(normalize(drumSade)), wavCT);
  await uploadIfMissing("seed/commit-thiago-drums.wav", encodeWav(normalize(drumThiago)), wavCT);
  await uploadIfMissing("seed/commit-ilse-drums.wav", encodeWav(normalize(drumIlse)), wavCT);
  await uploadIfMissing("seed/commit-dmitri-drums.wav", encodeWav(normalize(drumDmitri)), wavCT);

  console.log("✓ Seed audio ready");
}
