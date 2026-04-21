import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { Play, Pause, Volume2, VolumeX, Download } from "lucide-react";
import { useLogDownload } from "@workspace/api-client-react";

export interface AudioPlayerHandle {
  pause: () => void;
}

interface AudioPlayerProps {
  url: string;
  title: string;
  artist?: string;
  fileId?: string;
  songId?: string;
  className?: string;
  /** Compact variant: smaller controls, denser layout. */
  compact?: boolean;
  /** Optional small label rendered above the title (e.g. "Solo"). */
  label?: string;
  /** Hide the download button (e.g. for layered/base players). */
  hideDownload?: boolean;
  /** Hide mute toggle (used in compact mode by default). */
  hideMute?: boolean;
  /** Notified when this player starts playing — used for "only one at a time" coordination. */
  onPlay?: () => void;
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer(
  {
    url,
    title,
    artist,
    fileId,
    songId,
    className = "",
    compact = false,
    label,
    hideDownload = false,
    hideMute = false,
    onPlay,
  },
  ref,
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const logDownload = useLogDownload();

  useImperativeHandle(ref, () => ({
    pause: () => {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    },
  }));

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      onPlay?.();
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTo = parseFloat(e.target.value);
    if (audioRef.current && !isNaN(seekTo)) {
      audioRef.current.currentTime = (seekTo / 100) * audioRef.current.duration;
      setProgress(seekTo);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleDownload = () => {
    if (fileId && songId) {
      logDownload.mutate({ data: { fileId, songId } });
    }
    const a = document.createElement("a");
    a.href = `/api/storage${url}`;
    a.download = title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const src = url.startsWith("/api/storage") ? url : `/api/storage${url}`;

  const buttonSize = compact ? "w-9 h-9" : "w-12 h-12";
  const iconSize = compact ? "w-4 h-4" : "w-5 h-5";
  const padding = compact ? "p-2" : "p-4";
  const titleSize = compact ? "text-sm" : "text-lg";
  const showMute = !hideMute && !compact;

  return (
    <div
      className={`bg-card border border-border rounded-none flex items-center gap-3 ${padding} ${className}`}
    >
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onEnded={() => setIsPlaying(false)}
      />

      <button
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className={`${buttonSize} flex-shrink-0 bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors`}
      >
        {isPlaying ? (
          <Pause className={`${iconSize} fill-current`} />
        ) : (
          <Play className={`${iconSize} fill-current ml-0.5`} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1 gap-2">
          <div className="truncate min-w-0">
            {label && (
              <span className="text-[10px] uppercase tracking-widest text-primary font-bold mr-2">
                {label}
              </span>
            )}
            <span className={`font-serif font-bold ${titleSize} text-foreground mr-2`}>
              {title}
            </span>
            {artist && !compact && (
              <span className="text-sm text-muted-foreground uppercase tracking-wider">
                {artist}
              </span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground font-mono tabular-nums flex-shrink-0">
            {formatTime((progress / 100) * duration)} / {formatTime(duration)}
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={progress || 0}
          onChange={handleSeek}
          className="w-full h-1 bg-secondary appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-primary rounded-none"
        />
      </div>

      {(showMute || !hideDownload) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {showMute && (
            <button
              onClick={toggleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
              className="text-muted-foreground hover:text-foreground transition-colors p-2"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
          {!hideDownload && (
            <button
              onClick={handleDownload}
              aria-label="Download"
              className="text-muted-foreground hover:text-foreground transition-colors p-2 border border-transparent hover:border-border"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
});
