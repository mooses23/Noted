import { useParams, Link } from "wouter";
import { useGetCommit, useVoteOnCommit, useUnvoteCommit } from "@workspace/api-client-react";
import { getGetCommitQueryKey } from "@workspace/api-client-react";
import type { CommitDetail } from "@workspace/api-client-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Disc3, Calendar, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function CommitDetail() {
  const params = useParams();
  const commitId = params.commitId || "";
  const queryClient = useQueryClient();
  
  const { data: commit, isLoading } = useGetCommit(commitId, {
    query: { enabled: !!commitId, queryKey: getGetCommitQueryKey(commitId) }
  });

  const voteMutation = useVoteOnCommit();
  const unvoteMutation = useUnvoteCommit();

  const handleVoteToggle = () => {
    if (!commit) return;
    
    if (commit.hasVoted) {
      unvoteMutation.mutate({ commitId }, {
        onSuccess: (res) => {
          queryClient.setQueryData<CommitDetail>(
            getGetCommitQueryKey(commitId),
            (old) => (old ? { ...old, hasVoted: false, voteCount: res.voteCount } : old),
          );
        }
      });
    } else {
      voteMutation.mutate({ commitId }, {
        onSuccess: (res) => {
          queryClient.setQueryData<CommitDetail>(
            getGetCommitQueryKey(commitId),
            (old) => (old ? { ...old, hasVoted: true, voteCount: res.voteCount } : old),
          );
        }
      });
    }
  };

  if (isLoading) {
    return <div className="container mx-auto px-6 py-12"><div className="h-64 bg-card border border-border animate-pulse" /></div>;
  }
  
  if (!commit) {
    return <div className="container mx-auto px-6 py-12">Commit not found</div>;
  }

  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <div className="mb-6 flex items-center gap-2 text-sm uppercase tracking-widest text-muted-foreground">
        <Link href={`/songs/${commit.songSlug}`} className="hover:text-foreground transition-colors flex items-center gap-1">
          <Disc3 className="w-4 h-4" /> {commit.songTitle}
        </Link>
        <span>/</span>
        <span className="text-foreground">Round {commit.roundNumber}</span>
      </div>

      <div className="bg-card border border-border overflow-hidden">
        <div className="p-8 md:p-12 border-b border-border">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary text-secondary-foreground text-xs uppercase tracking-widest mb-4">
                {commit.instrumentType}
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-4">
                {commit.title}
              </h1>
              <div className="flex items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-2">
                  {commit.contributor.avatarUrl ? (
                    <img src={commit.contributor.avatarUrl} alt={commit.contributor.displayName} className="w-6 h-6 object-cover border border-border" />
                  ) : (
                    <div className="w-6 h-6 bg-secondary flex items-center justify-center border border-border text-xs font-serif text-foreground">
                      {commit.contributor.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-foreground font-medium">{commit.contributor.displayName}</span>
                </div>
                <span className="flex items-center gap-1 text-sm">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(commit.createdAt), "MMM d, yyyy")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button 
                variant={commit.hasVoted ? "default" : "outline"} 
                className="h-12 px-6 rounded-none flex items-center gap-2 uppercase tracking-widest"
                onClick={handleVoteToggle}
                disabled={voteMutation.isPending || unvoteMutation.isPending}
              >
                <ThumbsUp className={`w-4 h-4 ${commit.hasVoted ? "fill-current" : ""}`} />
                <span>Vote</span>
                <span className="bg-background/20 px-2 py-0.5 ml-2 font-mono text-xs">{commit.voteCount}</span>
              </Button>
            </div>
          </div>

          <div className="mb-8">
            <AudioPlayer 
              url={commit.audioFileUrl} 
              title={commit.title}
              artist={commit.contributor.displayName}
              className="bg-background border-border p-4"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Creator's Note</div>
              <div className="p-4 bg-background border border-border text-foreground whitespace-pre-wrap">
                {commit.note || "No note provided."}
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Status</div>
                <div className={`inline-flex items-center gap-1 font-bold uppercase tracking-widest ${
                  commit.status === 'merged' ? 'text-primary' : 
                  commit.status === 'shortlisted' ? 'text-blue-500' : 'text-foreground'
                }`}>
                  {commit.status}
                </div>
              </div>
              
              <div className="flex items-start gap-2 pt-4 border-t border-border">
                <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-foreground mb-1">Human-Made Verified</div>
                  <div className="text-muted-foreground text-xs">This contributor has attested that no generative AI was used in the creation of this layer.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}