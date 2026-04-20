import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Download } from "lucide-react";
import { useLogDownload } from "@workspace/api-client-react";

interface AudioPlayerProps {
  url: string;
  title: string;
  artist?: string;
  fileId?: string;
  songId?: string;
  className?: string;
}

export function AudioPlayer({ url, title, artist, fileId, songId, className = "" }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const logDownload = useLogDownload();

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
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
    const a = document.createElement('a');
    a.href = `/api/storage${url}`;
    a.download = title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Add the storage path prefix if not already present
  const src = url.startsWith('/api/storage') ? url : `/api/storage${url}`;

  return (
    <div className={`bg-card border border-border p-4 rounded-none flex items-center gap-4 ${className}`}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      
      <button 
        onClick={togglePlay}
        className="w-12 h-12 flex-shrink-0 bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <div className="truncate">
            <span className="font-serif font-bold text-lg text-foreground mr-2">{title}</span>
            {artist && <span className="text-sm text-muted-foreground uppercase tracking-wider">{artist}</span>}
          </div>
          <div className="text-xs text-muted-foreground font-mono tabular-nums flex-shrink-0">
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
      
      <div className="flex items-center gap-2">
        <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground transition-colors p-2">
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button onClick={handleDownload} className="text-muted-foreground hover:text-foreground transition-colors p-2 border border-transparent hover:border-border">
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}