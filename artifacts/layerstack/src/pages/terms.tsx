export default function Terms() {
  return (
    <div className="container mx-auto px-6 py-20 max-w-3xl">
      <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-8">
        Terms of Service
      </h1>
      <div className="prose prose-invert max-w-none text-muted-foreground">
        <p>Effective Date: {new Date().toLocaleDateString()}</p>
        <p>This is a placeholder terms of service for LayerStack. By using this service, you agree to our strictly human-made audio policy and our rights and licensing framework for submitted commits.</p>
        <p>Violation of the AI-generation ban will result in immediate account termination.</p>
      </div>
    </div>
  );
}