export default function Rules() {
  return (
    <div className="container mx-auto px-6 py-20 max-w-3xl">
      <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tighter mb-12">
        Community Rules
      </h1>
      <div className="prose prose-invert prose-lg max-w-none">
        <h2 className="font-serif text-3xl mt-12 mb-6">1. Humans Only</h2>
        <p>
          Every commit must be performed, sequenced, or created by a human. Generative AI audio, prompt-to-audio tools, and algorithmic style transfer are not allowed. Sampling (with permission) and traditional DAW effects are fine.
        </p>
        <h2 className="font-serif text-3xl mt-12 mb-6">2. One Commit Per Round</h2>
        <p>
          Each contributor may submit one commit per open round. If you want to revise, contact an admin to have your commit withdrawn before submitting a new one.
        </p>
        <h2 className="font-serif text-3xl mt-12 mb-6">3. Stay On Layer</h2>
        <p>
          If the round calls for drums, submit drums. Off-instrument submissions will be rejected without a vote.
        </p>
        <h2 className="font-serif text-3xl mt-12 mb-6">4. Own Your Rights</h2>
        <p>
          By submitting, you affirm that the recording is yours, or that you have explicit permission from every performer and rights holder, and that no sample is used without clearance.
        </p>
        <h2 className="font-serif text-3xl mt-12 mb-6">5. Respect Each Other</h2>
        <p>
          Critique layers, not people. Harassment, hate speech, or targeted attacks will result in removal from the platform.
        </p>
      </div>
    </div>
  );
}
