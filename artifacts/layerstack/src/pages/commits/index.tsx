import { Link } from "wouter";
import { useListCommits } from "@workspace/api-client-react";
import { Disc3, ChevronUp } from "lucide-react";

export default function Commits() {
  const { data: commits, isLoading } = useListCommits({ sort: "top", limit: 50 });

  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-3">
          Top Notes
        </h1>
        <p className="text-base text-muted-foreground">
          Layers the community is rallying behind across every song.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-20 bg-card border border-border animate-pulse"
            />
          ))}
        </div>
      ) : commits?.length ? (
        <div className="space-y-3">
          {commits.map((commit) => (
            <Link
              key={commit.id}
              href={`/commits/${commit.id}`}
              className="group bg-card border border-border flex items-stretch hover:border-primary/60 transition-colors"
            >
              <div
                className={`flex flex-col items-center justify-center px-3 py-3 border-r border-border w-16 flex-shrink-0 ${
                  commit.hasVoted
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <ChevronUp
                  className={`w-5 h-5 ${commit.hasVoted ? "fill-current" : ""}`}
                />
                <span className="text-base font-mono font-bold tabular-nums leading-none mt-0.5">
                  {commit.voteCount}
                </span>
                <span className="text-[8px] uppercase tracking-widest mt-1">
                  votes
                </span>
              </div>
              <div className="flex-1 min-w-0 px-4 py-3 flex flex-col justify-center">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5 flex items-center gap-2">
                  <Disc3 className="w-3 h-3" />
                  <span className="truncate">
                    {commit.songTitle} · Round {commit.roundNumber}
                  </span>
                </div>
                <div className="font-serif font-bold text-lg truncate group-hover:text-primary">
                  {commit.title}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {commit.instrumentType} by{" "}
                  <span className="text-foreground">
                    {commit.contributor.displayName}
                  </span>
                </div>
              </div>
              <div className="hidden sm:flex items-center px-4 text-[10px] uppercase tracking-widest text-muted-foreground border-l border-border flex-shrink-0">
                {commit.status}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center border border-dashed border-border bg-card">
          <div className="text-muted-foreground">No Notes yet.</div>
        </div>
      )}
    </div>
  );
}
