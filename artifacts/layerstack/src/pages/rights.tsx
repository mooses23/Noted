export default function Rights() {
  return (
    <div className="container mx-auto px-6 py-20 max-w-3xl">
      <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tighter mb-12">
        Rights & Licensing
      </h1>
      <div className="prose prose-invert prose-lg max-w-none">
        <h2 className="font-serif text-3xl mt-12 mb-6">Ownership</h2>
        <p>
          You keep ownership of your original performance and recording. When you submit a commit, you grant LayerStack and the song's seed artist a perpetual, worldwide, royalty-free license to use your layer as part of the collaborative song, including in all current and future official mixes.
        </p>
        <h2 className="font-serif text-3xl mt-12 mb-6">Credit</h2>
        <p>
          Every merged layer earns permanent credit on the song page, the Credits Wall, and any platform where we distribute the final mix.
        </p>
        <h2 className="font-serif text-3xl mt-12 mb-6">Revenue</h2>
        <p>
          If a song is commercially released, net revenue is split transparently among every credited contributor according to the credit weights recorded at publish time. Details for each release are posted publicly before distribution.
        </p>
        <h2 className="font-serif text-3xl mt-12 mb-6">Takedowns</h2>
        <p>
          If a layer of yours ends up in a song you no longer wish to be associated with, contact an admin. We will remove your credit and, where technically possible, the layer itself from future versions.
        </p>
      </div>
    </div>
  );
}
