import { useGetCurrentUser } from "@workspace/api-client-react";
import { Disc3 } from "lucide-react";

export default function Profile() {
  const { data: user, isLoading } = useGetCurrentUser();

  if (isLoading) {
    return <div className="container mx-auto px-6 py-20 text-muted-foreground">Loading…</div>;
  }
  if (!user?.profile) {
    return (
      <div className="container mx-auto px-6 py-20 text-muted-foreground">
        Sign in to view your profile.
      </div>
    );
  }

  const p = user.profile;
  return (
    <div className="container mx-auto px-6 py-20 max-w-3xl">
      <div className="flex items-center gap-6 mb-12">
        <div className="w-24 h-24 bg-secondary border border-border flex items-center justify-center">
          <Disc3 className="w-10 h-10 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter">
            {p.displayName}
          </h1>
          {p.bio ? (
            <p className="text-muted-foreground mt-2 max-w-xl">{p.bio}</p>
          ) : (
            <p className="text-muted-foreground italic mt-2">No bio yet.</p>
          )}
          {p.isAdmin && (
            <span className="inline-block mt-3 text-xs uppercase tracking-widest border border-primary text-primary px-2 py-0.5">
              Admin
            </span>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Your merged layers appear on the Credits Wall. Visit the Songs page to find an open
        round and submit your next commit.
      </p>
    </div>
  );
}
