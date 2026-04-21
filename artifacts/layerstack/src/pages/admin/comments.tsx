import { Link } from "wouter";
import { format } from "date-fns";
import {
  useAdminListCommentReports,
  useDeleteComment,
  getAdminListCommentReportsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function AdminCommentsModeration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = getAdminListCommentReportsQueryKey();
  const { data: reported, isLoading } = useAdminListCommentReports({
    query: { queryKey },
  });
  const deleteMutation = useDeleteComment();

  const handleDelete = (commentId: string) => {
    if (!confirm("Delete this comment? This action is logged.")) return;
    deleteMutation.mutate(
      { commentId },
      {
        onSuccess: () => {
          toast({ title: "Comment deleted" });
          queryClient.invalidateQueries({ queryKey });
        },
        onError: (err) =>
          toast({
            title: "Couldn't delete comment",
            description: err.message,
            variant: "destructive",
          }),
      },
    );
  };

  const list = reported ?? [];

  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground text-sm uppercase tracking-widest mb-4 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-4xl font-serif font-bold tracking-tighter mb-2 flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-primary" /> Reported Comments
        </h1>
        <p className="text-muted-foreground">
          Comments flagged by the community. Deletes are logged to the admin
          audit trail.
        </p>
      </div>

      {isLoading ? (
        <div className="bg-card border border-border p-8 text-center text-muted-foreground">
          Loading…
        </div>
      ) : list.length === 0 ? (
        <div className="bg-card border border-dashed border-border p-12 text-center text-muted-foreground">
          Nothing in the queue. Quiet day.
        </div>
      ) : (
        <ul className="space-y-4">
          {list.map((entry) => (
            <li key={entry.comment.id} className="bg-card border border-border p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="text-xs uppercase tracking-widest text-primary mb-1">
                    {entry.reportCount} report
                    {entry.reportCount === 1 ? "" : "s"}
                  </div>
                  <div className="font-bold">
                    {entry.comment.author.displayName}
                    <span className="ml-2 text-xs uppercase tracking-widest text-muted-foreground">
                      {format(
                        new Date(entry.comment.createdAt),
                        "MMM d, yyyy · h:mm a",
                      )}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground uppercase tracking-widest text-xs"
                  onClick={() => handleDelete(entry.comment.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3 h-3 mr-2" /> Delete
                </Button>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words border-l-2 border-border pl-4 mb-4">
                {entry.comment.body}
              </p>
              <div className="border-t border-border pt-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Reasons
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {entry.reports.map((r) => (
                    <li key={r.id}>
                      <span className="text-[10px] uppercase tracking-widest mr-2">
                        {format(new Date(r.createdAt), "MMM d, h:mm a")}
                      </span>
                      {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
