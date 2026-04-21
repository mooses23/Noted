import { THIRD_PARTY_ASSETS, type ThirdPartyAsset } from "@workspace/seed-content";
import { ExternalLink } from "lucide-react";

function groupByCategory(assets: ThirdPartyAsset[]): Array<[string, ThirdPartyAsset[]]> {
  const groups = new Map<string, ThirdPartyAsset[]>();
  for (const asset of assets) {
    const list = groups.get(asset.category) ?? [];
    list.push(asset);
    groups.set(asset.category, list);
  }
  return Array.from(groups.entries());
}

export default function Licenses() {
  const grouped = groupByCategory(THIRD_PARTY_ASSETS);

  return (
    <div className="container mx-auto px-6 py-20">
      <div className="max-w-3xl mb-12">
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-4">
          Third-Party Licenses
        </h1>
        <p className="text-lg text-muted-foreground">
          LayerStack stands on the shoulders of generous creators. Every third-party
          asset bundled with the site is listed below, along with its author, source,
          and license.
        </p>
      </div>

      <div className="space-y-12">
        {grouped.map(([category, assets]) => (
          <section key={category}>
            <h2 className="text-2xl font-serif font-bold mb-6">{category}</h2>
            <div className="bg-card border border-border divide-y divide-border">
              {assets.map((asset) => (
                <article key={asset.id} className="p-6 flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-serif text-lg font-bold">
                      <a
                        href={asset.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary inline-flex items-center gap-1.5"
                      >
                        {asset.title}
                        <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                      </a>
                    </h3>
                    <a
                      href={asset.license.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs uppercase tracking-widest text-primary hover:underline"
                    >
                      {asset.license.name}
                    </a>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    by <span className="text-foreground">{asset.author}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug">
                    {asset.usage}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
