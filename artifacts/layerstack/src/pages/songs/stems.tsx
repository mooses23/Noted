import { useParams, Link } from "wouter";
import {
  useGetSongBySlug,
  useListSongFiles,
  getGetSongBySlugQueryKey,
  getListSongFilesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export default function SongStems() {
  const { slug } = useParams<{ slug: string }>();
  const { data: song, isLoading: songLoading } = useGetSongBySlug(slug, {
    query: { enabled: !!slug, queryKey: getGetSongBySlugQueryKey(slug) },
  });
  const songId = song?.id ?? "";
  const { data: files, isLoading: filesLoading } = useListSongFiles(songId, {
    query: {
      enabled: !!songId,
      queryKey: getListSongFilesQueryKey(songId),
    },
  });

  if (songLoading || filesLoading) {
    return (
      <div className="container mx-auto p-12 text-center text-muted-foreground">
        Loading stems...
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

  const stems = (files ?? []).filter((f) => f.fileType === "stem");

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
        Stems & Downloads
      </h1>
      <p className="text-muted-foreground mb-12 max-w-2xl">
        Download the source stems for{" "}
        <span className="italic">{song.title}</span>. Use them to write your
        layer for the current round. By downloading you agree to the project{" "}
        <Link href="/rules">
          <span className="underline">rules</span>
        </Link>
        .
      </p>

      {stems.length === 0 ? (
        <div className="border border-dashed border-border p-12 text-center text-muted-foreground">
          No stems published yet.
        </div>
      ) : (
        <ul className="divide-y divide-border border border-border">
          {stems.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between p-5 gap-4"
              data-testid={`stem-${f.id}`}
            >
              <div className="min-w-0">
                <div className="text-sm uppercase tracking-widest text-muted-foreground mb-1">
                  Stem
                </div>
                <div className="font-serif text-lg truncate">{f.label}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {f.originalFilename}
                  {f.sizeBytes ? ` · ${formatBytes(f.sizeBytes)}` : ""}
                </div>
              </div>
              <a
                href={`/api/storage${f.fileUrl}`}
                target="_blank"
                rel="noreferrer"
                download
              >
                <Button className="rounded-none uppercase tracking-widest">
                  Download
                </Button>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
