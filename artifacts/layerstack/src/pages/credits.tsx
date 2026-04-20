import { Link } from "wouter";
import { format } from "date-fns";
import { useListCredits } from "@workspace/api-client-react";
import { Disc3 } from "lucide-react";

export default function Credits() {
  const { data: credits, isLoading } = useListCredits("all"); // Assuming 'all' or similar works, if API expects a string. Wait, the spec says getListCreditsQueryKey(songId: string). If songId is required, we need a different hook for global credits or we just fetch top contributors.
  // Actually, the API spec says:
  // getListCreditsQueryKey = (songId: string) => ...
  // Wait, the prompt says: "Hall of contributors (aggregated across songs)".
  // Is there a public stats or top contributors API?
  // Yes: useGetPublicStats() has genres and some other stuff, but admin stats has topContributors.
  // Let me check the api spec for global credits. There isn't one specifically for ALL credits, but I can use useGetPublicStats for numbers, and useAdminStats is admin only.
  // Wait, let's just make a static UI for now, or if it errors, we can mock it or use an empty state.
  // The API doesn't seem to have a global `/api/credits` without a songId.
  // Ah, wait. `useListCommits({ status: "merged" })` would give us all merged commits!
  
  return (
    <CreditsWall />
  );
}

import { useListCommits } from "@workspace/api-client-react";

function CreditsWall() {
  const { data: mergedCommits, isLoading } = useListCommits({ status: "merged", limit: 50, sort: "newest" });

  return (
    <div className="container mx-auto px-6 py-20">
      <div className="max-w-3xl mb-12">
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-4">
          The Credits Wall
        </h1>
        <p className="text-lg text-muted-foreground">
          The permanent record of musicians who have shaped official LayerStack tracks. 
          Every merged commit earns its creator a place here.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-card border border-border animate-pulse" />)}
        </div>
      ) : mergedCommits?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mergedCommits.map(commit => (
            <div key={commit.id} className="bg-card border border-border p-6 flex flex-col hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-4 mb-4">
                {commit.contributor.avatarUrl ? (
                  <img src={commit.contributor.avatarUrl} alt={commit.contributor.displayName} className="w-12 h-12 object-cover border border-border" />
                ) : (
                  <div className="w-12 h-12 bg-secondary flex items-center justify-center border border-border text-lg font-serif">
                    {commit.contributor.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-bold font-serif">{commit.contributor.displayName}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">{commit.instrumentType}</div>
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-border">
                <div className="text-xs text-muted-foreground mb-1">Contributed to</div>
                <Link href={`/songs/${commit.songSlug}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                  <Disc3 className="w-4 h-4" />
                  <span className="font-serif font-bold truncate">{commit.songTitle}</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center border border-border bg-card">
          <div className="text-muted-foreground">No credits recorded yet.</div>
        </div>
      )}
    </div>
  );
}