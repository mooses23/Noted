export default function Manifesto() {
  return (
    <div className="container mx-auto px-6 py-20 max-w-3xl">
      <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tighter mb-12">
        The LayerStack Manifesto
      </h1>
      
      <div className="prose prose-invert prose-lg max-w-none">
        <p className="lead text-2xl text-muted-foreground border-l-4 border-primary pl-6 py-2 font-serif italic mb-12">
          Music is a conversation between human beings. We are here to keep it that way.
        </p>

        <h2 className="font-serif text-3xl mt-12 mb-6">1. Strictly Human-Made</h2>
        <p>
          Every bassline, every vocal take, every drum groove on LayerStack must be performed, sequenced, or created by a human. No generative AI. No prompt-to-audio. No algorithmic replacements for human expression. When you listen to a track built here, you are hearing the collective effort of real musicians.
        </p>

        <h2 className="font-serif text-3xl mt-12 mb-6">2. The Seed is Just the Beginning</h2>
        <p>
          A seed song is an invitation. It is not a finished product. When an artist posts a seed, they are opening their creative process to the world. They are asking: "What do you hear?"
        </p>

        <h2 className="font-serif text-3xl mt-12 mb-6">3. The Listeners Become the Band</h2>
        <p>
          The barrier between creator and consumer is obsolete. If you can hear what a song needs, you can provide it. The community decides what stays by voting. The admins curate the final mix. Everyone who contributes a merged layer gets permanent credit.
        </p>

        <h2 className="font-serif text-3xl mt-12 mb-6">4. Editorial, Not Algorithmic</h2>
        <p>
          We do not rely on black-box algorithms to tell you what is good. We rely on the taste of the community and the editorial judgment of the song's curators. Quality over quantity. Intentionality over engagement metrics.
        </p>

        <h2 className="font-serif text-3xl mt-12 mb-6">5. Zero Ego</h2>
        <p>
          You submit a layer because it serves the song. If it gets rejected, you try again on the next round. If it gets merged, you celebrate with the band. The song is the only thing that matters.
        </p>
      </div>
    </div>
  );
}