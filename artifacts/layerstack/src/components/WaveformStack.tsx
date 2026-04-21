import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { Play, Pause } from "lucide-react";

export interface WaveformLayer {
  /** Stable id used for keys + pause coordination. */
  id: string;
  /** Display label (e.g. "Base", "Drums by Kenji"). */
  label: string;
  /** URL or File. URLs go through /api/storage if relative. */
  source: string | File;
  /** Start offset in seconds, relative to the timeline 0. Default 0. */
  offsetSeconds?: number;
  /** Tint for the waveform (CSS color). Defaults to muted/primary. */
  color?: string;
  /** When true, this layer is the base/reference (drawn slightly larger). */
  isBase?: boolean;
}

interface WaveformStackProps {
  layers: WaveformLayer[];
  /** Height of each waveform row in px. Default 56. */
  rowHeight?: number;
  /** Show per-layer label column. Default true. */
  showLabels?: boolean;
  /** Optional callback when user changes the offset of a layer (only fires
   * for layers passed in `editableLayerIds`). */
  onOffsetChange?: (layerId: string, offsetSeconds: number) => void;
  editableLayerIds?: string[];
  className?: string;
}

interface DecodedLayer {
  id: string;
  peaks: Float32Array; // normalized 0..1 peaks
  duration: number; // seconds
}

const PEAK_RESOLUTION = 800;

function resolveStringUrl(source: string): string {
  if (/^(https?:|blob:|data:)/.test(source)) return source;
  return source.startsWith("/api/storage") ? source : `/api/storage${source}`;
}

async function loadPeaks(
  source: string | File,
  ctx: AudioContext,
): Promise<{ peaks: Float32Array; duration: number; buffer: AudioBuffer }> {
  let arrayBuffer: ArrayBuffer;
  if (typeof source === "string") {
    const res = await fetch(resolveStringUrl(source));
    if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`);
    arrayBuffer = await res.arrayBuffer();
  } else {
    arrayBuffer = await source.arrayBuffer();
  }
  const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const channel = buffer.getChannelData(0);
  const samplesPerPeak = Math.max(1, Math.floor(channel.length / PEAK_RESOLUTION));
  const peaks = new Float32Array(PEAK_RESOLUTION);
  for (let i = 0; i < PEAK_RESOLUTION; i++) {
    let max = 0;
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, channel.length);
    for (let j = start; j < end; j++) {
      const v = Math.abs(channel[j] || 0);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  return { peaks, duration: buffer.duration, buffer };
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: Float32Array,
  color: string,
  progress01: number,
  totalDuration: number,
  layerStart: number,
  layerDuration: number,
) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (canvas.width !== cssW * dpr) canvas.width = Math.max(1, Math.floor(cssW * dpr));
  if (canvas.height !== cssH * dpr) canvas.height = Math.max(1, Math.floor(cssH * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const total = totalDuration || layerDuration || 1;
  const startX = (layerStart / total) * cssW;
  const widthPx = (layerDuration / total) * cssW;
  const mid = cssH / 2;

  const playhead = progress01 * cssW;

  for (let i = 0; i < peaks.length; i++) {
    const x = startX + (i / peaks.length) * widthPx;
    if (x < -1 || x > cssW + 1) continue;
    const v = peaks[i] || 0;
    const h = v * (cssH * 0.85);
    const played = x <= playhead;
    ctx.fillStyle = played ? color : `${color}66`;
    ctx.fillRect(x, mid - h / 2, Math.max(1, widthPx / peaks.length - 0.5), h);
  }

  // Playhead line
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(playhead, 0);
  ctx.lineTo(playhead, cssH);
  ctx.stroke();
}

export function WaveformStack({
  layers,
  rowHeight = 56,
  showLabels = true,
  onOffsetChange,
  editableLayerIds,
  className = "",
}: WaveformStackProps) {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement | null>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  const [decoded, setDecoded] = useState<Map<string, DecodedLayer>>(new Map());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [decodingError, setDecodingError] = useState<string | null>(null);

  // Stable per-layer audio src URLs. For File sources, create a blob URL once
  // per file identity and revoke it when the file changes or on unmount.
  const blobUrlMapRef = useRef<Map<string, { file: File; url: string }>>(
    new Map(),
  );
  const audioSrcs = useMemo(() => {
    const map = new Map<string, string>();
    const keepIds = new Set(layers.map((l) => l.id));
    // Revoke any layers no longer present
    for (const [id, entry] of blobUrlMapRef.current) {
      if (!keepIds.has(id)) {
        URL.revokeObjectURL(entry.url);
        blobUrlMapRef.current.delete(id);
      }
    }
    for (const l of layers) {
      if (typeof l.source === "string") {
        const existing = blobUrlMapRef.current.get(l.id);
        if (existing) {
          URL.revokeObjectURL(existing.url);
          blobUrlMapRef.current.delete(l.id);
        }
        map.set(l.id, resolveStringUrl(l.source));
      } else {
        const existing = blobUrlMapRef.current.get(l.id);
        if (existing && existing.file === l.source) {
          map.set(l.id, existing.url);
        } else {
          if (existing) URL.revokeObjectURL(existing.url);
          const url = URL.createObjectURL(l.source);
          blobUrlMapRef.current.set(l.id, { file: l.source, url });
          map.set(l.id, url);
        }
      }
    }
    return map;
  }, [layers]);

  useEffect(() => {
    return () => {
      for (const entry of blobUrlMapRef.current.values()) {
        URL.revokeObjectURL(entry.url);
      }
      blobUrlMapRef.current.clear();
    };
  }, []);

  // Decode peaks for all layers
  useEffect(() => {
    let cancelled = false;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    setDecodingError(null);

    Promise.all(
      layers.map(async (l) => {
        try {
          const r = await loadPeaks(l.source, ctx);
          return { id: l.id, peaks: r.peaks, duration: r.duration };
        } catch (e) {
          return { id: l.id, peaks: new Float32Array(PEAK_RESOLUTION), duration: 0, error: e };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const map = new Map<string, DecodedLayer>();
      let anyError = false;
      for (const r of results) {
        map.set(r.id, { id: r.id, peaks: r.peaks, duration: r.duration });
        if ("error" in r && r.error) anyError = true;
      }
      setDecoded(map);
      if (anyError) setDecodingError("Some layers couldn't be decoded for preview.");
    });

    return () => {
      cancelled = true;
      ctx.close().catch(() => {});
    };
    // Only re-decode when source identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.map((l) => (typeof l.source === "string" ? l.source : l.source.name + l.source.size)).join("|")]);

  // Compute end time across all layers
  const totalDuration = useMemo(() => {
    let max = 0;
    for (const l of layers) {
      const d = decoded.get(l.id)?.duration ?? 0;
      const end = (l.offsetSeconds ?? 0) + d;
      if (end > max) max = end;
    }
    return max;
  }, [layers, decoded]);

  // Render loop
  const renderFrame = useCallback(() => {
    for (const l of layers) {
      const dec = decoded.get(l.id);
      if (!dec) continue;
      const canvas = canvasRefs.current.get(l.id);
      if (!canvas) continue;
      const layerStart = l.offsetSeconds ?? 0;
      drawWaveform(
        canvas,
        dec.peaks,
        l.color || (l.isBase ? "hsl(40 10% 75%)" : "hsl(15 80% 55%)"),
        totalDuration > 0 ? currentTime / totalDuration : 0,
        totalDuration,
        layerStart,
        dec.duration,
      );
    }
  }, [layers, decoded, totalDuration, currentTime]);

  useEffect(() => {
    renderFrame();
  }, [renderFrame]);

  // Tick when playing
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    let start = performance.now();
    const startTime = currentTime;
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      const t = startTime + elapsed;
      if (t >= totalDuration) {
        setCurrentTime(totalDuration);
        setIsPlaying(false);
        return;
      }
      // Manage layer audio elements: play/pause based on whether they should be active
      for (const l of layers) {
        const dec = decoded.get(l.id);
        if (!dec) continue;
        const layerStart = l.offsetSeconds ?? 0;
        const audio = audioRefs.current.get(l.id);
        if (!audio) continue;
        const localT = t - layerStart;
        if (localT >= 0 && localT < dec.duration) {
          if (audio.paused) {
            audio.currentTime = localT;
            audio.play().catch(() => {});
          }
        } else if (!audio.paused) {
          audio.pause();
        }
      }
      setCurrentTime(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      audioRefs.current.forEach((a) => a.pause());
      return;
    }
    if (currentTime >= totalDuration) setCurrentTime(0);
    setIsPlaying(true);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    audioRefs.current.forEach((a) => a.pause());
    if (isPlaying) {
      // Will resume in tick effect on next render — easiest: stop & restart
      setIsPlaying(false);
      requestAnimationFrame(() => setIsPlaying(true));
    }
  };

  const formatTime = (t: number) => {
    if (!Number.isFinite(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`bg-background border border-border ${className}`}>
      <div className="flex items-center gap-3 p-3 border-b border-border">
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="w-10 h-10 flex-shrink-0 bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>
        <input
          type="range"
          min={0}
          max={totalDuration || 1}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          className="flex-1 h-1 bg-secondary appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary"
        />
        <div className="text-[10px] font-mono tabular-nums text-muted-foreground flex-shrink-0">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </div>
      </div>

      {decodingError && (
        <div className="px-3 py-1 text-[10px] uppercase tracking-widest text-destructive bg-destructive/10 border-b border-border">
          {decodingError}
        </div>
      )}

      <div className="divide-y divide-border">
        {layers.map((l) => {
          const dec = decoded.get(l.id);
          const editable = editableLayerIds?.includes(l.id) && !l.isBase;
          return (
            <div key={l.id} className="flex items-stretch">
              {showLabels && (
                <div className="w-32 flex-shrink-0 px-3 py-2 border-r border-border flex flex-col justify-center bg-card">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold truncate">
                    {l.isBase ? "Base" : "Note"}
                  </div>
                  <div className="text-xs font-bold truncate" title={l.label}>
                    {l.label}
                  </div>
                  {editable && dec && (
                    <div className="mt-1">
                      <label className="text-[9px] uppercase tracking-widest text-muted-foreground block">
                        Start +{(l.offsetSeconds ?? 0).toFixed(2)}s
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, totalDuration - dec.duration + 5)}
                        step={0.05}
                        value={l.offsetSeconds ?? 0}
                        onChange={(e) =>
                          onOffsetChange?.(l.id, parseFloat(e.target.value))
                        }
                        className="w-full h-1 bg-secondary appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-primary"
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1 relative bg-background" style={{ height: rowHeight }}>
                <canvas
                  ref={(el) => {
                    canvasRefs.current.set(l.id, el);
                  }}
                  className="absolute inset-0 w-full h-full"
                />
                <audio
                  ref={(el) => {
                    if (el) audioRefs.current.set(l.id, el);
                    else audioRefs.current.delete(l.id);
                  }}
                  src={audioSrcs.get(l.id)}
                  preload="auto"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
