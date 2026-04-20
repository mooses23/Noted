export default function Privacy() {
  return (
    <div className="container mx-auto px-6 py-20 max-w-3xl">
      <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tighter mb-12">Privacy</h1>
      <div className="prose prose-invert prose-lg max-w-none">
        <p>We collect the minimum data needed to run LayerStack: your account details from the sign-in provider, your display name and bio if you fill them in, the audio and images you upload, and records of your commits and votes. We do not sell your data.</p>
        <h2 className="font-serif text-3xl mt-12 mb-6">Cookies</h2>
        <p>We use session cookies to keep you signed in. We do not run third-party advertising trackers.</p>
        <h2 className="font-serif text-3xl mt-12 mb-6">Your Data</h2>
        <p>You can request a copy of your data or deletion of your account at any time by contacting an admin. Deletion removes personal info and withdraws unpublished commits; merged credits remain so that the songs stay attributable.</p>
      </div>
    </div>
  );
}
