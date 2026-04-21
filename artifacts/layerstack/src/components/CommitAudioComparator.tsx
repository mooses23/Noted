import { useRef } from "react";
import { AudioPlayer, type AudioPlayerHandle } from "./AudioPlayer";

interface Commit {
  title: string;
  audioFileUrl: string;
  previewMixUrl?: string | null;
  baseAudioUrl?: string | null;
}

interface CommitAudioComparatorProps {
  commit: Commit;
  className?: string;
}

export function CommitAudioComparator({ commit, className = "" }: CommitAudioComparatorProps) {
  const soloRef = useRef<AudioPlayerHandle>(null);
  const layeredRef = useRef<AudioPlayerHandle>(null);
  const baseRef = useRef<AudioPlayerHandle>(null);

  const pauseOthers = (which: "solo" | "layered" | "base") => {
    if (which !== "solo") soloRef.current?.pause();
    if (which !== "layered") layeredRef.current?.pause();
    if (which !== "base") baseRef.current?.pause();
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <AudioPlayer
        ref={soloRef}
        url={commit.audioFileUrl}
        title={commit.title}
        label="Solo"
        compact
        className="bg-background border-border"
        onPlay={() => pauseOthers("solo")}
      />

      {commit.previewMixUrl ? (
        <AudioPlayer
          ref={layeredRef}
          url={commit.previewMixUrl}
          title="Layered with song"
          label="With commit"
          compact
          hideDownload
          className="bg-background border-border"
          onPlay={() => pauseOthers("layered")}
        />
      ) : (
        <UnavailableRow label="With commit" hint="Layered preview unavailable" />
      )}

      {commit.baseAudioUrl ? (
        <AudioPlayer
          ref={baseRef}
          url={commit.baseAudioUrl}
          title="Song without commit"
          label="Original"
          compact
          hideDownload
          className="bg-background border-border"
          onPlay={() => pauseOthers("base")}
        />
      ) : (
        <UnavailableRow label="Original" hint="Base mix unavailable" />
      )}
    </div>
  );
}

function UnavailableRow({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="bg-background border border-dashed border-border rounded-none px-3 py-2 flex items-center gap-3 text-xs">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
        {label}
      </span>
      <span className="text-muted-foreground italic">{hint}</span>
    </div>
  );
}
