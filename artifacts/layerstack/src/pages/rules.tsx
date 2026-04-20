export default function Rules() {
  return (
    <div className="container mx-auto px-6 py-20 max-w-3xl">
      <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-8">
        Submission Rules
      </h1>
      
      <div className="prose prose-invert max-w-none">
        <p className="text-lg text-muted-foreground mb-12">
          Read these carefully before submitting a commit. Violations will result in immediate rejection and potential account bans.
        </p>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-serif font-bold text-primary mb-4">01. No AI Generation</h2>
            <p>
              This is a zero-tolerance policy. If you use generative AI tools (Suno, Udio, AI voice cloning, etc.) to create your stem, your account will be permanently banned. Tools for mixing/mastering (like AI EQs or noise reduction) are acceptable, but the musical performance/composition MUST be human.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-primary mb-4">02. Stay in the Round</h2>
            <p>
              If a round asks for "Bass", do not submit a guitar solo. If a round asks for "Percussion", do not submit a synth pad. Stick to the requested instrument type.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-primary mb-4">03. Clean Stems Only</h2>
            <p>
              Submit only your isolated layer. Do not submit a full mix including the other stems. Ensure your stem is time-aligned to the start of the project (bounce from bar 1).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-primary mb-4">04. Clear Rights</h2>
            <p>
              Do not use uncleared samples. Everything you submit must be 100% owned by you or royalty-free. By submitting, you grant the song creator the right to use your layer in the official mix. See our Rights & Licensing page for full details.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif font-bold text-primary mb-4">05. Format Requirements</h2>
            <p>
              Submissions must be high-quality audio formats (WAV, FLAC, AIFF, or high-bitrate MP3/M4A). Maximum file size is 50MB. Ensure your stems are not clipping.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}