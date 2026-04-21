import {
  useGetCurrentUser,
  useListMyDrafts,
  useSubmitDraft,
  useDeleteDraft,
  getListMyDraftsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Disc3, FileAudio, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { data: user, isLoading } = useGetCurrentUser();
  const isAuthed = !!user?.profile;
  const { data: drafts, isLoading: draftsLoading } = useListMyDrafts({
    query: { enabled: isAuthed },
  });
  const submitDraft = useSubmitDraft();
  const deleteDraft = useDeleteDraft();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

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
  const readyDrafts = (drafts ?? []).filter((d) => d.eligibleRound);
  const waitingDrafts = (drafts ?? []).filter((d) => !d.eligibleRound);

  const onSubmitDraft = (draftId: string, roundId?: string) => {
    submitDraft.mutate(
      { draftId, data: roundId ? { roundId } : {} },
      {
        onSuccess: (commit) => {
          toast({
            title: "Note dropped",
            description: "Your draft has been submitted to the open round.",
          });
          queryClient.invalidateQueries({ queryKey: getListMyDraftsQueryKey() });
          setLocation(`/commits/${commit.id}`);
        },
        onError: (err) => {
          toast({
            title: "Couldn't submit draft",
            description: err.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  const onDeleteDraft = (draftId: string) => {
    if (!confirm("Discard this draft? This can't be undone.")) return;
    deleteDraft.mutate(
      { draftId },
      {
        onSuccess: () => {
          toast({ title: "Draft discarded" });
          queryClient.invalidateQueries({ queryKey: getListMyDraftsQueryKey() });
        },
        onError: (err) => {
          toast({
            title: "Couldn't discard",
            description: err.message,
            variant: "destructive",
          });
        },
      },
    );
  };

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

      {readyDrafts.length > 0 && (
        <div
          data-testid="drafts-ready-banner"
          className="mb-8 border border-primary/40 bg-primary/5 p-4 flex items-start gap-3"
        >
          <Send className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <div className="font-bold text-primary">
              {readyDrafts.length} draft
              {readyDrafts.length === 1 ? " is" : "s are"} ready to submit
            </div>
            <div className="text-muted-foreground">
              A matching round just opened — drop your Note below in one click.
            </div>
          </div>
        </div>
      )}

      <section className="mb-12">
        <h2 className="text-xl font-serif font-bold mb-4">Your drafts</h2>
        {draftsLoading ? (
          <div className="text-sm text-muted-foreground">Loading drafts…</div>
        ) : (drafts ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No drafts yet. When a song has no open round, your Note is saved here
            until you can submit it.
          </div>
        ) : (
          <ul className="space-y-3" data-testid="drafts-list">
            {(drafts ?? []).map((d) => (
              <li
                key={d.id}
                data-testid={`draft-${d.id}`}
                className="border border-border bg-card p-4 flex items-start gap-3"
              >
                <FileAudio className="w-6 h-6 text-muted-foreground flex-shrink-0 mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/songs/${d.song.slug}`}
                      className="font-bold hover:text-primary truncate"
                    >
                      {d.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      on {d.song.title}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {d.instrumentType} · saved{" "}
                    {new Date(d.createdAt).toLocaleDateString()}
                  </div>
                  {d.note && (
                    <div className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {d.note}
                    </div>
                  )}
                  {d.eligibleRound ? (
                    <div className="text-[11px] uppercase tracking-widest text-primary mt-2">
                      Round {d.eligibleRound.roundNumber} open · ready to submit
                    </div>
                  ) : (
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-2">
                      Waiting for a matching round
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    className="rounded-none uppercase tracking-widest text-[10px] h-9"
                    disabled={!d.eligibleRound || submitDraft.isPending}
                    onClick={() =>
                      onSubmitDraft(d.id, d.eligibleRound?.id ?? undefined)
                    }
                    data-testid={`button-submit-draft-${d.id}`}
                  >
                    Submit
                  </Button>
                  <Link href={`/songs/${d.song.slug}/submit?draftId=${d.id}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-none uppercase tracking-widest text-[10px] h-9 w-full"
                      data-testid={`button-edit-draft-${d.id}`}
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-none uppercase tracking-widest text-[10px] h-9"
                    disabled={deleteDraft.isPending}
                    onClick={() => onDeleteDraft(d.id)}
                    data-testid={`button-delete-draft-${d.id}`}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Discard
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {waitingDrafts.length === 0 && readyDrafts.length === 0 ? null : (
          <p className="text-[11px] text-muted-foreground mt-3">
            Drafts wait until curators open a round that matches your chosen
            instrument.
          </p>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Your merged layers appear on the Credits Wall. Visit the Songs page to
        find an open round and submit your next commit.
      </p>
    </div>
  );
}
