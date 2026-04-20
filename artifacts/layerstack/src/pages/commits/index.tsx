import { Link } from "wouter";
import { useListCommits } from "@workspace/api-client-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Disc3 } from "lucide-react";

export default function Commits() {
  const { data: commits, isLoading } = useListCommits({ sort: "top", limit: 50 });

  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-4">
          Recent & Top Commits
        </h1>
        <p className="text-lg text-muted-foreground">
          Listen to the latest layers submitted by the community across all seeds.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-32 bg-card border border-border animate-pulse" />)}
        </div>
      ) : commits?.length ? (
        <div className="space-y-6">
          {commits.map(commit => (
            <div key={commit.id} className="bg-card border border-border p-6 hover:border-primary/50 transition-colors">
              <div className="flex flex-col md:flex-row gap-6 md:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    <Disc3 className="w-3 h-3" />
                    <Link href={`/songs/${commit.songSlug}`} className="hover:text-primary transition-colors truncate">
                      {commit.songTitle}
                    </Link>
                    <span>•</span>
                    <span>Round {commit.roundNumber}</span>
                  </div>
                  
                  <h2 className="text-2xl font-serif font-bold mb-1 truncate">
                    <Link href={`/commits/${commit.id}`} className="hover:text-primary transition-colors">
                      {commit.title}
                    </Link>
                  </h2>
                  <div className="text-sm text-muted-foreground mb-4">
                    {commit.instrumentType} by <span className="text-foreground">{commit.contributor.displayName}</span>
                  </div>
                </div>
                
                <div className="w-full md:w-1/2 flex-shrink-0 flex flex-col gap-3">
                  <AudioPlayer 
                    url={commit.audioFileUrl} 
                    title={commit.title}
                    className="bg-background border-border p-2"
                  />
                  <div className="flex justify-between items-center px-1">
                    <div className="text-xs uppercase tracking-widest text-primary font-bold">
                      {commit.status}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {commit.voteCount} votes
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center border border-border bg-card">
          <div className="text-muted-foreground">No commits found.</div>
        </div>
      )}
    </div>
  );
}