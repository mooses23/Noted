import { useParams, Link } from "wouter";
import { useGetSongBySlug, useListRoundsForSong, useListVersionsForSong, useListCommitsForRound, useGetPublicStats, getGetSongBySlugQueryKey, getListCommitsForRoundQueryKey, ListCommitsForRoundSort } from "@workspace/api-client-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Button } from "@/components/ui/button";
import { Disc3, Download, Clock, Users, ArrowRight, Play, FileAudio } from "lucide-react";
import { format } from "date-fns";

export default function SongDetail() {
  const params = useParams();
  const slug = params.slug || "";
  
  const { data: song, isLoading: isSongLoading } = useGetSongBySlug(slug, { 
    query: { enabled: !!slug, queryKey: getGetSongBySlugQueryKey(slug) } 
  });


  if (isSongLoading) {
    return <div className="container mx-auto px-6 py-12"><div className="h-96 bg-card border border-border animate-pulse" /></div>;
  }
  
  if (!song) {
    return <div className="container mx-auto px-6 py-12">Song not found</div>;
  }

  return (
    <div className="flex flex-col">
      <section className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-12 md:py-20 flex flex-col md:flex-row gap-8 lg:gap-16">
          {song.coverImageUrl ? (
            <img 
              src={song.coverImageUrl} 
              alt={song.title} 
              className="w-48 h-48 md:w-64 md:h-64 object-cover border border-border shadow-2xl flex-shrink-0"
            />
          ) : (
            <div className="w-48 h-48 md:w-64 md:h-64 bg-secondary flex items-center justify-center border border-border shadow-2xl flex-shrink-0">
              <Disc3 className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
          
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="text-xs uppercase tracking-widest text-primary mb-3">
              {song.genre} • {song.bpm} BPM • {song.musicalKey} • {song.timeSignature || "4/4"}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tighter mb-4 truncate">
              {song.title}
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Seed by {song.creatorName} • Started {format(new Date(song.createdAt), "MMM d, yyyy")}
            </p>
            <p className="max-w-2xl text-foreground mb-8">
              {song.description || "A new seed song looking for contributors."}
            </p>
            
            {song.currentVersion && (
              <div className="mt-auto">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Current Official Mix (v{song.currentVersion.versionNumber})</div>
                <AudioPlayer 
                  url={song.currentVersion.officialMixUrl}
                  title={`${song.title} - v${song.currentVersion.versionNumber}`}
                  artist="LayerStack Community"
                  className="bg-background border border-border"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          {/* Current Round */}
          {song.currentRound ? (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-serif font-bold">Current Round</h2>
                <div className="px-3 py-1 bg-primary/10 text-primary border border-primary/30 text-xs uppercase tracking-widest">
                  Open
                </div>
              </div>
              <div className="bg-card border border-border p-6 md:p-8">
                <h3 className="font-serif text-2xl font-bold mb-2">Round {song.currentRound.roundNumber}: {song.currentRound.title}</h3>
                <p className="text-muted-foreground mb-6">{song.currentRound.description || `We are looking for a ${song.currentRound.allowedInstrumentType} layer.`}</p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-6 border-t border-border">
                  <div className="flex-1">
                    <div className="text-sm font-bold uppercase tracking-widest text-primary mb-1">
                      Wanted: {song.currentRound.allowedInstrumentType}
                    </div>
                    {song.currentRound.closesAt && (
                      <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Closes {format(new Date(song.currentRound.closesAt), "MMM d, yyyy")}
                      </div>
                    )}
                  </div>
                  <Link href={`/songs/${song.slug}/submit`}>
                    <Button className="rounded-none uppercase tracking-widest text-xs px-8 h-12 w-full sm:w-auto">Submit Layer</Button>
                  </Link>
                </div>
              </div>
            </section>
          ) : (
            <section>
              <div className="p-8 border border-border bg-card text-center">
                <h3 className="font-serif text-xl font-bold mb-2">No Active Round</h3>
                <p className="text-muted-foreground">The curators are reviewing commits or preparing the next phase.</p>
              </div>
            </section>
          )}

          {/* Open Commits for Current Round */}
          {song.currentRound && (
            <section>
              <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
                Submissions <span className="text-muted-foreground font-sans text-sm font-normal">({song.currentRound.commitCount || 0})</span>
              </h2>
              <CommitsList roundId={song.currentRound.id} />
            </section>
          )}
        </div>

        <div className="space-y-12">
          {/* Stems */}
          <section>
            <h2 className="text-2xl font-serif font-bold mb-6">Downloads</h2>
            <div className="bg-card border border-border p-6 space-y-4">
              {song.stems.length > 0 ? (
                song.stems.map(stem => (
                  <div key={stem.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileAudio className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="truncate text-sm font-medium">{stem.label}</div>
                    </div>
                    <a href={`/api/storage${stem.fileUrl}`} download className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No stems available.</div>
              )}
            </div>
          </section>

          {/* Stats */}
          <section>
            <h2 className="text-2xl font-serif font-bold mb-6">Track Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border p-4">
                <div className="text-2xl font-serif font-bold text-primary mb-1">{song.totalCommits}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Commits</div>
              </div>
              <div className="bg-card border border-border p-4">
                <div className="text-2xl font-serif font-bold text-foreground mb-1">{song.totalVotes}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Votes</div>
              </div>
              <div className="bg-card border border-border p-4 col-span-2">
                <div className="text-2xl font-serif font-bold text-foreground mb-1">{song.versionCount}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Official Versions</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CommitsList({ roundId }: { roundId: string }) {
  const params = { sort: ListCommitsForRoundSort.top };
  const { data: commits, isLoading } = useListCommitsForRound(roundId, params, {
    query: { enabled: !!roundId, queryKey: getListCommitsForRoundQueryKey(roundId, params) }
  });

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-card border border-border animate-pulse" />)}</div>;
  if (!commits?.length) return <div className="p-8 text-center border border-border bg-card text-muted-foreground">No submissions yet. Be the first!</div>;

  return (
    <div className="space-y-4">
      {commits.map(commit => (
        <div key={commit.id} className="bg-card border border-border p-4 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold font-serif mb-1">
                <Link href={`/commits/${commit.id}`} className="hover:text-primary">{commit.title}</Link>
              </h4>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span>By {commit.contributor.displayName}</span>
              </div>
            </div>
            <div className="text-xs px-2 py-1 bg-secondary text-secondary-foreground font-mono">
              {commit.voteCount} votes
            </div>
          </div>
          <AudioPlayer url={commit.audioFileUrl} title={commit.title} className="bg-background border-border p-2" />
        </div>
      ))}
    </div>
  );
}