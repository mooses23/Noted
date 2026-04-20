import { Link } from "wouter";
import { ArrowRight, Disc3, Users, PlayCircle, GitBranch, ShieldCheck } from "lucide-react";
import { useGetFeaturedSong, useListRisingCommits, useGetPublicStats } from "@workspace/api-client-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/CoverImage";

export default function Home() {
  const { data: featured, isLoading: isFeaturedLoading } = useGetFeaturedSong();
  const { data: risingCommits, isLoading: isRisingLoading } = useListRisingCommits({ limit: 4 });
  const { data: stats } = useGetPublicStats();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center border-b border-border overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/hero-studio.png" 
            alt="Studio Background" 
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        </div>

        <div className="container relative z-10 mx-auto px-6 py-20 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary/30 bg-primary/10 text-primary text-xs uppercase tracking-widest mb-8">
            <ShieldCheck className="w-3 h-3" />
            Strictly Human-Made
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold tracking-tighter max-w-4xl leading-none mb-6">
            The listeners <br/><span className="text-muted-foreground italic">become the band.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-12 font-sans">
            LayerStack is where the community builds songs together, one instrument layer at a time. No AI allowed. Real hands on real instruments.
          </p>

          {isFeaturedLoading ? (
            <div className="w-full max-w-3xl h-48 bg-card border border-border animate-pulse" />
          ) : featured?.song ? (
            <div className="w-full max-w-3xl bg-card border border-border p-6 md:p-8 text-left">
              <div className="flex flex-col md:flex-row gap-8">
                <CoverImage
                  url={featured.song.coverImageUrl}
                  alt={featured.song.title}
                  className="w-32 h-32 md:w-48 md:h-48 border border-border flex-shrink-0 shadow-2xl"
                  iconSize="w-12 h-12"
                />
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary mb-2">
                    <Disc3 className="w-4 h-4" />
                    <span>Featured Track</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-serif font-bold mb-2 truncate">
                    {featured.song.title}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    Seed by {featured.song.creatorName} • {featured.song.genre} • {featured.song.bpm} BPM
                  </p>
                  
                  {featured.song.currentRound ? (
                    <div className="mb-6 p-4 border border-border bg-background">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Current Round</div>
                      <div className="font-bold text-lg mb-2">Wanted: {featured.song.currentRound.allowedInstrumentType}</div>
                      <div className="flex items-center gap-4">
                        <Link href={`/songs/${featured.song.slug}/submit`}>
                          <Button className="rounded-none uppercase tracking-widest text-xs px-8">Submit Layer</Button>
                        </Link>
                        <Link href={`/songs/${featured.song.slug}`} className="text-sm hover:text-primary transition-colors flex items-center gap-1">
                          View details <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6">
                      <Link href={`/songs/${featured.song.slug}`}>
                        <Button variant="outline" className="rounded-none uppercase tracking-widest text-xs">View Track</Button>
                      </Link>
                    </div>
                  )}

                  {featured.song.currentVersion && (
                    <AudioPlayer 
                      url={featured.song.currentVersion.officialMixUrl}
                      title="Current Mix"
                      className="mt-auto border-none bg-background p-0"
                    />
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Rising Commits Section */}
      <section className="py-20 px-6 border-b border-border bg-card/50">
        <div className="container mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-2">Rising Commits</h2>
              <p className="text-muted-foreground">The community's latest favored layers.</p>
            </div>
            <Link href="/commits" className="text-primary hover:text-primary/80 uppercase tracking-widest text-xs flex items-center gap-2 pb-2">
              Browse all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {isRisingLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-card border border-border animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {risingCommits?.map(commit => (
                <div key={commit.id} className="bg-card border border-border p-4 hover:border-primary/50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg font-serif">
                        <Link href={`/commits/${commit.id}`} className="hover:text-primary">{commit.title}</Link>
                      </h3>
                      <div className="text-sm text-muted-foreground">
                        {commit.instrumentType} by {commit.contributor.displayName}
                      </div>
                    </div>
                    <div className="text-xs px-2 py-1 bg-secondary text-secondary-foreground border border-border">
                      {commit.voteCount} votes
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-4 uppercase tracking-wider">
                    For <Link href={`/songs/${commit.songSlug}`} className="hover:text-foreground underline decoration-border">{commit.songTitle}</Link>
                  </div>
                  <AudioPlayer 
                    url={commit.audioFileUrl} 
                    title="Preview" 
                    className="bg-background border-border p-2"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Stats & Manifesto Teaser */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <h2 className="text-4xl font-serif font-bold mb-6">The Manifesto</h2>
              <div className="prose prose-invert max-w-none text-muted-foreground mb-8">
                <p className="text-xl leading-relaxed">
                  We are drowning in algorithmic slop. LayerStack is a response. A sanctuary for real musicians.
                </p>
                <p>
                  Every layer on this platform was played by human hands, sung by human voices, programmed by human minds. We believe music is a conversation, not a prompt. When you listen to a LayerStack track, you are hearing the collective effort of real people across the globe.
                </p>
              </div>
              <Link href="/manifesto">
                <Button className="rounded-none uppercase tracking-widest px-8">Read the full manifesto</Button>
              </Link>
            </div>
            
            <div className="bg-card border border-border p-8 md:p-12 flex flex-col justify-center">
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-8">Platform Activity</h3>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="text-4xl md:text-5xl font-serif font-bold text-primary mb-2">
                    {stats?.totalSongs || 0}
                  </div>
                  <div className="text-sm uppercase tracking-widest text-muted-foreground">Active Seeds</div>
                </div>
                <div>
                  <div className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-2">
                    {stats?.totalCommits || 0}
                  </div>
                  <div className="text-sm uppercase tracking-widest text-muted-foreground">Human Commits</div>
                </div>
                <div>
                  <div className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-2">
                    {stats?.totalVotes || 0}
                  </div>
                  <div className="text-sm uppercase tracking-widest text-muted-foreground">Votes Cast</div>
                </div>
                <div>
                  <div className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-2">
                    {stats?.totalMergedContributors || 0}
                  </div>
                  <div className="text-sm uppercase tracking-widest text-muted-foreground">Credited Artists</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}