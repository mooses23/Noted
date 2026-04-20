import { useParams, Link } from "wouter";
import {
  useGetSongBySlug,
  useListVersionsForSong,
  getGetSongBySlugQueryKey,
  getListVersionsForSongQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export default function SongVersions() {
  const { slug } = useParams<{ slug: string }>();
  const { data: song, isLoading: songLoading } = useGetSongBySlug(slug, {
    query: { enabled: !!slug, queryKey: getGetSongBySlugQueryKey(slug) },
  });
  const songId = song?.id ?? "";
  const { data: versions, isLoading: versionsLoading } = useListVersionsForSong(
    songId,
    {
      query: {
        enabled: !!songId,
        queryKey: getListVersionsForSongQueryKey(songId),
      },
    },
  );

  if (songLoading || versionsLoading) {
    return (
      <div className="container mx-auto p-12 text-center text-muted-foreground">
        Loading version history...
      </div>
    );
  }
  if (!song) {
    return (
      <div className="container mx-auto p-12 text-center text-muted-foreground">
        Song not found.
      </div>
    );
  }

  const ordered = [...(versions ?? [])].sort(
    (a, b) => b.versionNumber - a.versionNumber,
  );

  return (
    <div className="container mx-auto px-6 py-16 max-w-4xl">
      <div className="mb-10">
        <Link href={`/songs/${slug}`}>
          <button className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
            ← Back to {song.title}
          </button>
        </Link>
      </div>
      <h1 className="text-4xl md:text-5xl font-serif font-bold mb-3">
        Version History
      </h1>
      <p className="text-muted-foreground mb-12">
        Every official version of <span className="italic">{song.title}</span>,
        newest first.
      </p>

      {ordered.length === 0 ? (
        <div className="border border-dashed border-border p-12 text-center text-muted-foreground">
          No versions published yet.
        </div>
      ) : (
        <ol className="space-y-8">
          {ordered.map((v) => (
            <li
              key={v.id}
              className="border border-border p-6 bg-card"
              data-testid={`version-${v.versionNumber}`}
            >
              <div className="flex items-start justify-between mb-3 gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">
                      v{v.versionNumber}
                    </span>
                    {v.isCurrent ? (
                      <span className="text-xs uppercase tracking-widest px-2 py-0.5 bg-primary text-primary-foreground">
                        Current
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-2xl font-serif font-semibold">
                    {v.title}
                  </h2>
                  <div className="text-xs text-muted-foreground mt-1">
                    Published{" "}
                    {formatDistanceToNow(new Date(v.createdAt), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
                <a
                  href={`/api/storage${v.officialMixUrl}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button
                    variant="outline"
                    className="rounded-none uppercase tracking-widest"
                  >
                    Listen
                  </Button>
                </a>
              </div>
              {v.description ? (
                <p className="text-muted-foreground leading-relaxed">
                  {v.description}
                </p>
              ) : null}
              {v.merges && v.merges.length > 0 ? (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    Merged commits
                  </div>
                  <ul className="space-y-1">
                    {v.merges.map((m) => (
                      <li key={m.commitId} className="text-sm">
                        <Link href={`/commits/${m.commitId}`}>
                          <span className="underline hover:text-foreground">
                            {m.commitTitle}
                          </span>
                        </Link>
                        <span className="text-muted-foreground">
                          {" "}
                          — by {m.contributor.displayName}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
