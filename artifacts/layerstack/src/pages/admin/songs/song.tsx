import { useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetSong, 
  useListSongFiles, 
  useListRoundsForSong,
  useAdminUpdateSong,
  useAdminCreateRound,
  useAdminSetCommitStatus,
  useAdminListCommits
} from "@workspace/api-client-react";
import { getGetSongQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Check, X, FileAudio, Settings2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AudioPlayer } from "@/components/AudioPlayer";

// Note: A full implementation would include forms for editing song details,
// adding files (via ObjectUploader), managing rounds, and reviewing commits.
// This is a simplified scaffold of the admin song management UI.

export default function AdminSongDetail() {
  const params = useParams();
  const songId = params.songId || "";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: song, isLoading } = useGetSong(songId, {
    query: { enabled: !!songId, queryKey: getGetSongQueryKey(songId) }
  });
  
  const { data: rounds } = useListRoundsForSong(songId, {
    query: { enabled: !!songId, queryKey: ["/api/songs", songId, "rounds"] as any }
  });

  const { data: pendingCommits } = useAdminListCommits({ songId, status: "pending" });

  if (isLoading) return <div className="p-12 text-center text-muted-foreground">Loading...</div>;
  if (!song) return <div className="p-12 text-center text-muted-foreground">Song not found</div>;

  return (
    <div className="container mx-auto px-6 py-12 max-w-6xl">
      <div className="mb-8">
        <Link href="/admin/songs" className="text-muted-foreground hover:text-foreground text-sm uppercase tracking-widest mb-4 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Songs
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary mb-2">Song Management</div>
            <h1 className="text-4xl font-serif font-bold tracking-tighter mb-2">{song.title}</h1>
            <p className="text-muted-foreground">Status: <span className="uppercase text-foreground">{song.status}</span> • Slug: {song.slug}</p>
          </div>
          <Link href={`/songs/${song.slug}`}>
            <Button variant="outline" className="rounded-none uppercase tracking-widest text-xs">View Public Page</Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="commits" className="w-full">
        <TabsList className="bg-card border border-border w-full justify-start rounded-none h-14 p-0">
          <TabsTrigger value="commits" className="rounded-none h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase tracking-widest text-xs px-8">
            Review Commits ({pendingCommits?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="rounds" className="rounded-none h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase tracking-widest text-xs px-8">
            Rounds
          </TabsTrigger>
          <TabsTrigger value="files" className="rounded-none h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase tracking-widest text-xs px-8">
            Files & Stems
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-none h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase tracking-widest text-xs px-8">
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commits" className="mt-6 border-none p-0 outline-none">
          <div className="bg-card border border-border p-8">
            <h2 className="text-2xl font-serif font-bold mb-6">Pending Commits to Review</h2>
            {pendingCommits?.length ? (
              <div className="space-y-6">
                {pendingCommits.map(commit => (
                  <CommitReviewCard key={commit.id} commit={commit as any} onReviewed={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/commits"] as any })} />
                ))}
              </div>
            ) : (
              <div className="p-12 text-center border border-dashed border-border text-muted-foreground">
                No pending commits to review.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rounds" className="mt-6 border-none p-0 outline-none">
          <div className="bg-card border border-border p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-serif font-bold">Rounds</h2>
              <Button className="rounded-none uppercase tracking-widest text-xs"><Plus className="w-4 h-4 mr-2" /> New Round</Button>
            </div>
            
            {rounds?.length ? (
              <div className="divide-y divide-border border border-border">
                {rounds.map(round => (
                  <div key={round.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold">Round {round.roundNumber}: {round.title}</div>
                      <div className="text-sm text-muted-foreground">Wanted: {round.allowedInstrumentType} • Status: <span className="uppercase">{round.status}</span></div>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-none text-xs uppercase">Edit</Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-center p-8 border border-dashed border-border">No rounds created yet.</div>
            )}
          </div>
        </TabsContent>
        
        {/* Placeholder tabs for completeness */}
        <TabsContent value="files" className="mt-6">
          <div className="bg-card border border-border p-8 text-center text-muted-foreground">
            File management UI placeholder. Use useAdminAddSongFile and ObjectUploader to implement.
          </div>
        </TabsContent>
        
        <TabsContent value="settings" className="mt-6">
          <div className="bg-card border border-border p-8 text-center text-muted-foreground">
            Settings UI placeholder. Use useAdminUpdateSong to implement.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CommitReviewCard({ commit, onReviewed }: { commit: any, onReviewed: () => void }) {
  const { toast } = useToast();
  const setStatusMutation = useAdminSetCommitStatus();
  
  const handleStatus = (status: "shortlisted" | "rejected") => {
    setStatusMutation.mutate({
      commitId: commit.id,
      data: { status }
    }, {
      onSuccess: () => {
        toast({ title: `Commit ${status}` });
        onReviewed();
      }
    });
  };

  return (
    <div className="border border-border p-6 flex flex-col gap-4 bg-background">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary mb-1">Round {commit.roundNumber} • {commit.instrumentType}</div>
          <h3 className="font-serif font-bold text-xl mb-1">{commit.title}</h3>
          <div className="text-sm text-muted-foreground">By {commit.contributor.displayName}</div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="rounded-none h-10 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground uppercase tracking-widest text-xs"
            onClick={() => handleStatus("rejected")}
            disabled={setStatusMutation.isPending}
          >
            <X className="w-4 h-4 mr-2" /> Reject
          </Button>
          <Button 
            className="rounded-none h-10 uppercase tracking-widest text-xs"
            onClick={() => handleStatus("shortlisted")}
            disabled={setStatusMutation.isPending}
          >
            <Check className="w-4 h-4 mr-2" /> Shortlist
          </Button>
        </div>
      </div>
      
      {commit.note && (
        <div className="p-3 bg-secondary/50 text-sm text-muted-foreground italic border-l-2 border-primary">
          "{commit.note}"
        </div>
      )}
      
      <AudioPlayer url={commit.audioFileUrl} title={commit.title} className="bg-card border-border" />
    </div>
  );
}