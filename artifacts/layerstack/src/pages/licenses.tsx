import { Link } from "wouter";
import { useListAllCredits } from "@workspace/api-client-react";
import {
  THIRD_PARTY_ASSETS,
  type ThirdPartyAsset,
} from "@workspace/seed-content";
import { ExternalLink } from "lucide-react";

type CreditEntry = ThirdPartyAsset & {
  song?: { slug: string; title: string };
};

type CategoryGroup = {
  /** Stable, unique grouping key — song slug for song credits, category label otherwise. */
  key: string;
  /** Heading shown to the user. */
  heading: string;
  /** Optional song this group is tied to (used for the section-level link). */
  song?: { slug: string; title: string };
  entries: CreditEntry[];
};

function groupEntries(entries: CreditEntry[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const entry of entries) {
    const key = entry.song ? `song:${entry.song.slug}` : `cat:${entry.category}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        heading: entry.category,
        song: entry.song,
        entries: [],
      };
      groups.set(key, group);
    }
    group.entries.push(entry);
  }
  return Array.from(groups.values());
}

export default function Licenses() {
  const { data: songCredits, isLoading, error } = useListAllCredits();

  const songEntries: CreditEntry[] = (songCredits ?? []).map((c) => ({
    id: `song-credit:${c.id}`,
    category: `${c.song.title} — Music Credits`,
    title: c.title,
    author: c.author,
    usage: c.role
      ? `Used as ${c.role} in "${c.song.title}".`
      : `Used in "${c.song.title}".`,
    sourceUrl: c.sourceUrl,
    license: { name: c.licenseName, url: c.licenseUrl },
    song: { slug: c.song.slug, title: c.song.title },
  }));

  const grouped = groupEntries([...songEntries, ...THIRD_PARTY_ASSETS]);

  return (
    <div className="container mx-auto px-6 py-20">
      <div className="max-w-3xl mb-12">
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-4">
          Third-Party Licenses
        </h1>
        <p className="text-lg text-muted-foreground">
          Noted stands on the shoulders of generous creators. Every third-party
          asset bundled with the site — including audio used in each song — is
          listed below, along with its author, source, and license.
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading song credits…</p>
      )}
      {error && (
        <p className="text-sm text-destructive">
          Could not load song credits. Showing site-wide credits only.
        </p>
      )}

      <div className="space-y-12">
        {grouped.map((group) => (
          <section key={group.key}>
            <div className="flex items-baseline justify-between gap-4 mb-6">
              <h2 className="text-2xl font-serif font-bold">{group.heading}</h2>
              {group.song && (
                <Link
                  href={`/songs/${group.song.slug}`}
                  className="text-xs uppercase tracking-widest text-primary hover:underline"
                >
                  View {group.song.title} →
                </Link>
              )}
            </div>
            <div className="bg-card border border-border divide-y divide-border">
              {group.entries.map((entry) => (
                <article key={entry.id} className="p-6 flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-serif text-lg font-bold">
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary inline-flex items-center gap-1.5"
                      >
                        {entry.title}
                        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                      </a>
                    </h3>
                    <a
                      href={entry.license.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs uppercase tracking-widest text-primary hover:underline"
                    >
                      {entry.license.name}
                    </a>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    by <span className="text-foreground">{entry.author}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug">
                    {entry.usage}
                  </p>
                  {entry.song && (
                    <div className="text-xs text-muted-foreground pt-1">
                      Heard on{" "}
                      <Link
                        href={`/songs/${entry.song.slug}`}
                        className="text-primary hover:underline"
                      >
                        {entry.song.title}
                      </Link>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
