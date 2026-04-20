import { Link } from "wouter";
import { useListSongs } from "@workspace/api-client-react";
import { Disc3, Clock } from "lucide-react";
import { format } from "date-fns";

export default function Songs() {
  const { data: songs, isLoading } = useListSongs({ status: "active" });

  return (
    <div className="container mx-auto px-6 py-12 max-w-5xl">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-4">
          Active Seeds
        </h1>
        <p className="text-lg text-muted-foreground">
          Browse tracks currently accepting contributions. Find a round, download the stems, and record your layer.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-card border border-border animate-pulse" />)}
        </div>
      ) : songs?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {songs.map((song) => (
            <Link key={song.id} href={`/songs/${song.slug}`}>
              <div className="bg-card border border-border flex hover:border-primary/50 transition-colors h-full cursor-pointer group">
                {song.coverImageUrl ? (
                  <img 
                    src={song.coverImageUrl} 
                    alt={song.title} 
                    className="w-32 md:w-40 object-cover border-r border-border group-hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <div className="w-32 md:w-40 bg-secondary flex items-center justify-center border-r border-border group-hover:bg-secondary/80 transition-colors">
                    <Disc3 className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                
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
          <div className="text-muted-foreground">No active seeds found.</div>
        </div>
      )}
    </div>
  );
}