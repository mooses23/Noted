import { useMemo } from "react";
import { Link, useSearch } from "wouter";
import { useListSongs } from "@workspace/api-client-react";
import { Clock, X } from "lucide-react";
import { format } from "date-fns";
import { CoverImage } from "@/components/CoverImage";

export default function Songs() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const q = params.get("q")?.trim() || "";
  const genre = params.get("genre")?.trim() || "";

  const listParams = genre ? { status: "active" as const, genre } : { status: "active" as const };
  const { data: songs, isLoading } = useListSongs(listParams);

  const filtered = useMemo(() => {
    if (!songs) return songs;
    if (!q) return songs;
    const needle = q.toLowerCase();
    return songs.filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        s.creatorName.toLowerCase().includes(needle) ||
        s.genre.toLowerCase().includes(needle),
    );
  }, [songs, q]);

  const hasFilter = !!(q || genre);

  return (
    <div className="container mx-auto px-6 py-12 max-w-5xl">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-3">
          Active Seeds
        </h1>
        <p className="text-base text-muted-foreground">
          Browse songs accepting Notes right now. Find a round, grab the stems,
          and record your layer.
        </p>
        {hasFilter && (
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest">
            <span className="text-muted-foreground">Filtering by:</span>
            {q && (
              <span className="inline-flex items-center gap-1 px-2 py-1 border border-primary/60 text-primary bg-primary/5">
                "{q}"
              </span>
            )}
            {genre && (
              <span className="inline-flex items-center gap-1 px-2 py-1 border border-primary/60 text-primary bg-primary/5">
                {genre}
              </span>
            )}
            <Link
              href="/songs"
              className="inline-flex items-center gap-1 px-2 py-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" /> Clear
            </Link>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 bg-card border border-border animate-pulse"
            />
          ))}
        </div>
      ) : filtered?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((song) => (
            <Link key={song.id} href={`/songs/${song.slug}`}>
              <div className="bg-card border border-border flex hover:border-primary/50 transition-colors h-full cursor-pointer group">
                <CoverImage
                  url={song.coverImageUrl}
                  alt={song.title}
                  className="w-32 md:w-40 border-r border-border group-hover:opacity-90 transition-opacity"
                  iconSize="w-8 h-8"
                />

                <div className="p-6 flex flex-col flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-widest text-primary mb-2 truncate">
                    {song.genre} • {song.bpm} BPM
                  </div>
                  <h2 className="text-2xl font-serif font-bold mb-2 truncate group-hover:text-primary transition-colors">
                    {song.title}
                  </h2>
                  <div className="text-sm text-muted-foreground mb-4">
                    Seed by {song.creatorName}
                  </div>

                  <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(song.createdAt), "MMM d")}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center border border-border bg-card">
          <div className="text-muted-foreground">
            {hasFilter ? "No songs match your filter." : "No active seeds found."}
          </div>
        </div>
      )}
    </div>
  );
}
