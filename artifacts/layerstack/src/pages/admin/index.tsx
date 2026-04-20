import { Link } from "wouter";
import { useGetAdminStats } from "@workspace/api-client-react";
import { Disc3, Users, Activity, CheckCircle, Clock } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetAdminStats();

  return (
    <div className="container mx-auto px-6 py-12 max-w-6xl">
      <div className="mb-12 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-serif font-bold tracking-tighter mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform overview and pending moderation tasks.</p>
        </div>
        <Link href="/admin/songs" className="text-sm font-medium uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
          Manage Songs &rarr;
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-card border border-border animate-pulse" />)}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <div className="bg-card border border-border p-6 flex flex-col">
              <div className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-widest mb-4">
                <Clock className="w-4 h-4" /> Pending Commits
              </div>
              <div className="text-4xl font-serif font-bold text-primary mt-auto">{stats.pendingCommits}</div>
            </div>
            
            <div className="bg-card border border-border p-6 flex flex-col">
              <div className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-widest mb-4">
                <Activity className="w-4 h-4" /> Active Rounds
              </div>
              <div className="text-4xl font-serif font-bold text-foreground mt-auto">{stats.activeRounds}</div>
            </div>
            
            <div className="bg-card border border-border p-6 flex flex-col">
              <div className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-widest mb-4">
                <CheckCircle className="w-4 h-4" /> Total Submissions
              </div>
              <div className="text-4xl font-serif font-bold text-foreground mt-auto">{stats.totalSubmissions}</div>
            </div>
            
            <div className="bg-card border border-border p-6 flex flex-col">
              <div className="text-muted-foreground flex items-center gap-2 text-xs uppercase tracking-widest mb-4">
                <Users className="w-4 h-4" /> Total Votes
              </div>
              <div className="text-4xl font-serif font-bold text-foreground mt-auto">{stats.totalVotes}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <section>
              <h2 className="text-2xl font-serif font-bold mb-6">Top Contributors</h2>
              <div className="bg-card border border-border">
                {stats.topContributors.length > 0 ? (
                  <div className="divide-y divide-border">
                    {stats.topContributors.map((c, idx) => (
                      <div key={c.contributor.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-muted-foreground font-mono w-4">{idx + 1}.</div>
                          <div className="font-bold">{c.contributor.displayName}</div>
                        </div>
                        <div className="flex gap-6 text-sm text-muted-foreground text-right">
                          <div><span className="text-foreground">{c.mergedCount}</span> merged</div>
                          <div className="w-16"><span className="text-foreground">{c.totalVotes}</span> votes</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">No contributors yet.</div>
                )}
              </div>
            </section>
            
            <section>
              <h2 className="text-2xl font-serif font-bold mb-6">Quick Actions</h2>
              <div className="grid grid-cols-1 gap-4">
                <Link href="/admin/songs" className="bg-card border border-border p-6 hover:border-primary/50 transition-colors flex items-center justify-between group">
                  <div>
                    <h3 className="font-bold font-serif text-lg mb-1">Manage Seed Songs</h3>
                    <p className="text-sm text-muted-foreground">Create new songs, open rounds, and publish versions.</p>
                  </div>
                  <Disc3 className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}