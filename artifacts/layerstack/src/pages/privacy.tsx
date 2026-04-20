export default function Privacy() {
  return (
    <div className="container mx-auto px-6 py-20 max-w-3xl">
      <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-8">
        Privacy Policy
      </h1>
      <div className="prose prose-invert max-w-none text-muted-foreground">
        <p>Effective Date: {new Date().toLocaleDateString()}</p>
        <p>This is a placeholder privacy policy for LayerStack. In a production environment, this would detail how we collect, use, and protect your personal information, including email addresses, authentication data, and uploaded audio files.</p>
        <p>We use Clerk for authentication and Google Cloud Storage for audio files. We do not sell your personal data to third parties.</p>
      </div>
    </div>
  );
}