import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Search, ShieldCheck } from "lucide-react";
import {
  useListRisingCommits,
  useGetPublicStats,
  useListSongs,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CoverImage } from "@/components/CoverImage";

export default function Home() {
  const { data: rising, isLoading: isRisingLoading } = useListRisingCommits({
    limit: 6,
  });
  const { data: stats } = useGetPublicStats();
  const { data: songs } = useListSongs();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  const genres = useMemo(() => {
    if (stats?.genres?.length) {
      return stats.genres
        .filter((g) => g.songCount > 0)
        .sort((a, b) => b.songCount - a.songCount)
        .map((g) => g.genre);
    }
    const set = new Set<string>();
    songs?.forEach((s) => s.genre && set.add(s.genre));
    return Array.from(set);
  }, [stats, songs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (activeGenre) params.set("genre", activeGenre);
    setLocation(`/songs${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <div className="flex flex-col">
      {/* Hero — minimal, focused on action */}
      <section className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="/images/hero-studio.png"
            alt=""
            className="w-full h-full object-cover opacity-15"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/85 to-background" />
        </div>
        <div className="container relative z-10 mx-auto px-6 py-16 md:py-24 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary/30 bg-primary/10 text-primary text-[10px] uppercase tracking-widest mb-6">
            <ShieldCheck className="w-3 h-3" />
            Strictly human-made
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold tracking-tighter max-w-3xl leading-[1.05] mb-5">
            Songs grow when you drop a&nbsp;<span className="text-primary italic">Note</span>.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mb-8 leading-relaxed">
            Find a song-in-progress. Layer your sound. Get credited. No AI — real
            humans, real instruments, one Note at a&nbsp;time.
          </p>

          {/* Search */}
          <form
            onSubmit={handleSearch}
            className="w-full max-w-xl flex items-stretch gap-0 mb-6"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search songs, genres, artists…"
                className="h-12 rounded-none bg-card border-border pl-9 focus-visible:ring-primary"
              />
            </div>
            <Button
              type="submit"
              className="h-12 rounded-none uppercase tracking-widest text-xs px-6"
            >
              Browse
            </Button>
          </form>

          {/* Genre chips */}
          {genres.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
              <button
                onClick={() => setActiveGenre(null)}
                className={`px-3 py-1 text-[10px] uppercase tracking-widest border transition-colors ${
                  activeGenre === null
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                }`}
              >
                All
              </button>
              {genres.slice(0, 12).map((g) => (
                <button
                  key={g}
                  onClick={() =>
                    setActiveGenre((curr) => (curr === g ? null : g))
                  }
                  className={`px-3 py-1 text-[10px] uppercase tracking-widest border transition-colors ${
                    activeGenre === g
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recent Hits */}
      <section className="py-16 md:py-20 px-6 border-b border-border">
        <div className="container mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-1">Recent hits</h2>
              <p className="text-muted-foreground text-sm">
                Notes the community is rallying behind right now.
              </p>
            </div>
            <Link
              href="/commits"
              className="text-primary hover:text-primary/80 uppercase tracking-widest text-xs flex items-center gap-2"
            >
              All Notes <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {isRisingLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-44 bg-card border border-border animate-pulse"
                />
              ))}
            </div>
          ) : rising && rising.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rising.map((c) => (
                <Link
                  key={c.id}
                  href={`/commits/${c.id}`}
                  className="group bg-card border border-border p-5 flex flex-col gap-3 hover:border-primary/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                        {c.instrumentType} · {c.songGenre || "Music"}
                      </div>
                      <div className="font-serif text-xl font-bold leading-tight truncate group-hover:text-primary">
                        {c.title}
                      </div>
                    </div>
                    <div className="flex flex-col items-center text-center px-2 py-1 border border-border bg-background flex-shrink-0">
                      <span className="text-base font-mono font-bold tabular-nums leading-none">
                        {c.voteCount}
                      </span>
                      <span className="text-[8px] uppercase tracking-widest text-muted-foreground mt-0.5">
                        votes
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    by{" "}
                    <span className="text-foreground">
                      {c.contributor.displayName}
                    </span>
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-auto truncate">
                    For {c.songTitle}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
              No Notes have been dropped yet — be the first.
            </div>
          )}
        </div>
      </section>

      {/* About + Stats */}
      <section className="py-16 md:py-20 px-6">
        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-primary mb-3">
              About Noted
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-5 leading-tight">
              The listeners become the band.
            </h2>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Noted is a place where songs grow in two phases. First the{" "}
                <strong className="text-foreground">structure</strong> — drums,
                bass, harmony, one round at a time. Then the{" "}
                <strong className="text-foreground">accents</strong> — the small
                signature moments that make a song feel inevitable.
              </p>
              <p>
                Every Note is a layer played by a real human. We do not allow
                generative AI in submissions. We credit every contributor. You
                always own your performance.
              </p>
            </div>
            <div className="mt-8 flex gap-3">
              <Link href="/manifesto">
                <Button className="rounded-none uppercase tracking-widest text-xs px-6">
                  Read the manifesto
                </Button>
              </Link>
              <Link href="/songs">
                <Button
                  variant="outline"
                  className="rounded-none uppercase tracking-widest text-xs px-6"
                >
                  Drop a Note
                </Button>
              </Link>
            </div>
          </div>

          <div className="bg-card border border-border p-8 md:p-10 flex flex-col justify-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-6">
              Platform activity
            </div>
            <div className="grid grid-cols-2 gap-8">
              <Stat label="Active songs" value={stats?.totalSongs ?? 0} highlight />
              <Stat label="Notes dropped" value={stats?.totalCommits ?? 0} />
              <Stat label="Votes cast" value={stats?.totalVotes ?? 0} />
              <Stat
                label="Credited artists"
                value={stats?.totalMergedContributors ?? 0}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <div
        className={`text-4xl md:text-5xl font-serif font-bold tabular-nums mb-1 ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

// Used in song search-by-genre filter (kept for completeness if revisited).
export function _CoverPreview() {
  return <CoverImage url={null} alt="" className="w-12 h-12" />;
}
