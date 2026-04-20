export default function Rights() {
  return (
    <div className="container mx-auto px-6 py-20 max-w-3xl">
      <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-8">
        Rights & Licensing
      </h1>
      
      <div className="prose prose-invert max-w-none">
        <p className="text-lg text-muted-foreground mb-12">
          Plain English explanation of how rights work on LayerStack.
        </p>

        <div className="p-6 bg-card border border-border mb-12">
          <h3 className="font-serif font-bold text-xl mb-2">TL;DR</h3>
          <p className="mb-0">
            When you submit a layer, you grant the song owner a royalty-free license to use it in that specific song. You still own your performance. They own the combined master.
          </p>
        </div>

        <h2 className="font-serif text-2xl mt-8 mb-4">For Contributors (Committers)</h2>
        <p>By submitting audio to a round:</p>
        <ul>
          <li>You guarantee that the audio is 100% original and human-made by you, or utilizes cleared/royalty-free samples.</li>
          <li>You grant the Seed Song Creator a non-exclusive, perpetual, worldwide, royalty-free license to use, modify, and distribute your audio as part of the specific song it was submitted to.</li>
          <li>You retain the underlying rights to your individual performance/recording outside the context of this song.</li>
          <li>You will be credited as a contributor on LayerStack if your commit is merged into an official version.</li>
          <li>You understand there is no financial compensation for submitting or having a layer merged, unless explicitly arranged privately with the song creator.</li>
        </ul>

        <h2 className="font-serif text-2xl mt-12 mb-4">For Song Creators (Seed Posters)</h2>
        <p>By posting a seed song:</p>
        <ul>
          <li>You retain ownership of the master recording of the official versions you compile.</li>
          <li>You grant LayerStack users a limited license to download your stems strictly for the purpose of creating submissions for the song.</li>
          <li>You agree to properly credit merged contributors within the LayerStack platform.</li>
          <li>If you choose to commercialize the final song (e.g., Spotify, Apple Music), you are responsible for any off-platform crediting or royalty splits as required by standard industry practices, though LayerStack's license is inherently royalty-free for the master use.</li>
        </ul>
      </div>
    </div>
  );
}