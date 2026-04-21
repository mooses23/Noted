import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import {
  useGetSongBySlug,
  useListCommitsForRound,
  getGetSongBySlugQueryKey,
  getListCommitsForRoundQueryKey,
  ListCommitsForRoundSort,
  useVoteOnCommit,
  useUnvoteCommit,
  useGetCurrentUser,
  useListCredits,
  getListCreditsQueryKey,
  useListSongComments,
  usePostSongComment,
  useDeleteComment,
  useReportComment,
  getListSongCommentsQueryKey,
  type CommitSummary,
  type Comment,
} from "@workspace/api-client-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { WaveformStack, type WaveformLayer } from "@/components/WaveformStack";
import { Button } from "@/components/ui/button";
import {
  Download,
  Clock,
  ChevronUp,
  FileAudio,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CoverImage } from "@/components/CoverImage";
import { storageUrl } from "@/lib/utils";

const PAGE_SIZE = 5;

export default function SongDetail() {
  const params = useParams();
  const slug = params.slug || "";

  const { data: song, isLoading: isSongLoading } = useGetSongBySlug(slug, {
    query: { enabled: !!slug, queryKey: getGetSongBySlugQueryKey(slug) },
  });

  if (isSongLoading) {
    return (
      <div className="container mx-auto px-6 py-12">
        <div className="h-96 bg-card border border-border animate-pulse" />
      </div>
    );
  }

  if (!song) {
    return <div className="container mx-auto px-6 py-12">Song not found</div>;
  }

  return (
    <div className="flex flex-col">
      <section className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-12 md:py-16 flex flex-col md:flex-row gap-8 lg:gap-12">
          <CoverImage
            url={song.coverImageUrl}
            alt={song.title}
            className="w-44 h-44 md:w-56 md:h-56 border border-border shadow-2xl flex-shrink-0"
            iconSize="w-14 h-14"
          />

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="text-[10px] uppercase tracking-widest text-primary mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                {song.genre} · {song.bpm} BPM · {song.musicalKey} ·{" "}
                {song.timeSignature || "4/4"}
              </span>
              <span
                className={`px-2 py-0.5 border text-[9px] ${
                  song.phase === "accents"
                    ? "border-primary/60 text-primary bg-primary/5"
                    : "border-foreground/40 text-foreground/80 bg-foreground/5"
                }`}
              >
                Phase: {song.phase === "accents" ? "Accents" : "Structure"}
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tighter mb-3 truncate">
              {song.title}
            </h1>
            <p className="text-base text-muted-foreground mb-5">
              Seed by{" "}
              <span className="text-foreground">{song.creatorName}</span> ·
              Started {format(new Date(song.createdAt), "MMM d, yyyy")}
            </p>
            <p className="max-w-2xl text-sm text-foreground/90 mb-6">
              {song.description || "A new seed song looking for contributors."}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {song.currentRound ? (
                <Link href={`/songs/${song.slug}/submit`}>
                  <Button className="rounded-none uppercase tracking-widest text-xs h-11 px-6">
                    Drop a Note
                  </Button>
                </Link>
              ) : (
                <span className="inline-flex items-center px-4 h-11 border border-border text-xs uppercase tracking-widest text-muted-foreground">
                  No open round — check back soon
                </span>
              )}
              {song.currentRound?.closesAt && (
                <span className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Closes{" "}
                  {format(new Date(song.currentRound.closesAt), "MMM d, yyyy")}
                </span>
              )}
            </div>

            {song.currentVersion && (
              <div className="mt-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Current mix · v{song.currentVersion.versionNumber}
                </div>
                <AudioPlayer
                  url={song.currentVersion.officialMixUrl}
                  title={`${song.title} — v${song.currentVersion.versionNumber}`}
                  artist="Noted Community"
                  className="bg-background border border-border"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          {/* Notes (was: Commits for current round) */}
          {song.currentRound ? (
            <section>
              <div className="flex items-end justify-between mb-5">
                <div>
                  <h2 className="text-2xl md:text-3xl font-serif font-bold">
                    Notes for this round
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Round {song.currentRound.roundNumber} · wanted{" "}
                    <span className="text-foreground">
                      {song.currentRound.allowedInstrumentType}
                    </span>{" "}
                    {song.currentRound.kind === "accent" && "(accent)"}
                  </p>
                </div>
                <Link href={`/songs/${song.slug}/submit`}>
                  <Button
                    variant="outline"
                    className="rounded-none uppercase tracking-widest text-xs h-9 px-4"
                  >
                    + Drop a Note
                  </Button>
                </Link>
              </div>
              <NotesList
                roundId={song.currentRound.id}
                baseUrl={song.currentVersion?.officialMixUrl || null}
                baseLabel={
                  song.currentVersion
                    ? `${song.title} v${song.currentVersion.versionNumber}`
                    : null
                }
              />
            </section>
          ) : (
            <section>
              <div className="p-8 border border-border bg-card text-center">
                <h3 className="font-serif text-xl font-bold mb-2">
                  No active round
                </h3>
                <p className="text-muted-foreground">
                  {song.phase === "accents"
                    ? "The structure is locked. Curators are preparing the next accent round."
                    : "Curators are reviewing Notes or preparing the next structure round."}
                </p>
              </div>
            </section>
          )}

          <CommentsSection songId={song.id} />

          <section>
            <div className="flex items-center justify-between p-5 bg-card border border-border">
              <div>
                <h2 className="font-serif text-xl font-bold">Version story</h2>
                <p className="text-sm text-muted-foreground">
                  See every merged Note and how this song grew.
                </p>
              </div>
              <Link
                href={`/songs/${song.slug}/versions`}
                className="text-[10px] uppercase tracking-widest text-primary hover:underline"
              >
                View all versions →
              </Link>
            </div>
          </section>
        </div>

        <div className="space-y-10">
          <ArtistCredit
            songId={song.id}
            creatorName={song.creatorName}
          />

          {/* Stems */}
          <section>
            <h2 className="text-xl font-serif font-bold mb-4">Downloads</h2>
            <div className="bg-card border border-border p-5 space-y-3">
              {song.stems.length > 0 ? (
                song.stems.map((stem) => (
                  <div
                    key={stem.id}
                    className="flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileAudio className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="truncate text-sm font-medium">
                        {stem.label}
                      </div>
                    </div>
                    <a
                      href={`/api/storage${stem.fileUrl}`}
                      download
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">
                  No stems available.
                </div>
              )}
            </div>
          </section>

          {song.thirdPartyCredits.length > 0 && (
            <section>
              <h2 className="text-xl font-serif font-bold mb-4">
                Music credits
              </h2>
              <div className="bg-card border border-border p-5 space-y-3 text-sm">
                <ul className="space-y-2">
                  {song.thirdPartyCredits.map((c) => (
                    <li key={c.id} className="leading-snug">
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:text-primary underline-offset-2 hover:underline"
                      >
                        &ldquo;{c.title}&rdquo;
                      </a>{" "}
                      <span className="text-muted-foreground">
                        — {c.author}
                      </span>{" "}
                      <a
                        href={c.licenseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] uppercase tracking-widest text-primary hover:underline"
                      >
                        {c.licenseName}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Stats */}
          <section>
            <h2 className="text-xl font-serif font-bold mb-4">Track stats</h2>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Notes" value={song.totalCommits} highlight />
              <Stat label="Votes" value={song.totalVotes} />
              <Stat label="Versions" value={song.versionCount} />
              <Stat
                label="Structure · Accent"
                value={`${song.structureRoundsCompleted} · ${song.accentRoundsCompleted}`}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-card border border-border p-4">
      <div
        className={`text-2xl font-serif font-bold mb-1 ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function ArtistCredit({
  songId,
  creatorName,
}: {
  songId: string;
  creatorName: string;
}) {
  const { data: credits } = useListCredits(songId, {
    query: { enabled: !!songId, queryKey: getListCreditsQueryKey(songId) },
  });

  const unique = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        avatar: string | null;
        roles: Set<string>;
      }
    >();
    credits?.forEach((c) => {
      const id = c.contributor.id;
      const entry = map.get(id) || {
        id,
        name: c.contributor.displayName,
        avatar: c.contributor.avatarUrl ?? null,
        roles: new Set<string>(),
      };
      entry.roles.add(c.instrumentType);
      map.set(id, entry);
    });
    return Array.from(map.values());
  }, [credits]);

  return (
    <section>
      <h2 className="text-xl font-serif font-bold mb-4">Artist credits</h2>
      <div className="bg-card border border-border p-5">
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border">
          <div className="w-9 h-9 bg-secondary border border-border flex items-center justify-center text-xs font-serif font-bold">
            {creatorName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-bold truncate">{creatorName}</div>
            <div className="text-[10px] uppercase tracking-widest text-primary">
              Seed creator
            </div>
          </div>
        </div>
        {unique.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No merged Notes yet. Be the first credit on this song.
          </p>
        ) : (
          <ul className="space-y-3">
            {unique.map((u) => (
              <li key={u.id} className="flex items-center gap-3">
                {u.avatar ? (
                  <img
                    src={storageUrl(u.avatar)}
                    alt={u.name}
                    className="w-8 h-8 object-cover border border-border"
                  />
                ) : (
                  <div className="w-8 h-8 bg-secondary border border-border flex items-center justify-center text-[10px] font-serif font-bold">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{u.name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                    {Array.from(u.roles).join(" · ")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function NotesList({
  roundId,
  baseUrl,
  baseLabel,
}: {
  roundId: string;
  baseUrl: string | null;
  baseLabel: string | null;
}) {
  const [sort, setSort] = useState<ListCommitsForRoundSort>(
    ListCommitsForRoundSort.top,
  );
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<string | null>(null);

  const params = { sort };
  const queryKey = getListCommitsForRoundQueryKey(roundId, params);
  const { data: commits, isLoading } = useListCommitsForRound(roundId, params, {
    query: { enabled: !!roundId, queryKey },
  });
  const { data: user } = useGetCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const voteMutation = useVoteOnCommit();
  const unvoteMutation = useUnvoteCommit();

  const toggleVote = (commitId: string, hasVoted: boolean) => {
    if (!user?.authenticated) {
      toast({
        title: "Sign in required",
        description: "Sign in to vote on a Note.",
        variant: "destructive",
      });
      return;
    }
    const mutation = hasVoted ? unvoteMutation : voteMutation;
    mutation.mutate(
      { commitId },
      {
        onSuccess: (res) => {
          queryClient.setQueryData<typeof commits>(queryKey, (old) =>
            old?.map((c) =>
              c.id === commitId
                ? { ...c, hasVoted: !hasVoted, voteCount: res.voteCount }
                : c,
            ),
          );
        },
        onError: (err) => {
          toast({
            title: "Vote failed",
            description: err.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 bg-card border border-border animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!commits?.length) {
    return (
      <div className="p-8 text-center border border-dashed border-border bg-card text-muted-foreground">
        No Notes have been dropped yet. Be the first.
      </div>
    );
  }

  const visible = commits.slice(0, pageSize);
  const hasMore = commits.length > pageSize;

  return (
    <div className="space-y-3">
      {/* Sort tabs */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 border border-border bg-background">
          {(
            [
              { v: ListCommitsForRoundSort.top, label: "Top" },
              { v: ListCommitsForRoundSort.newest, label: "Newest" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setSort(opt.v)}
              className={`px-3 py-1.5 text-[10px] uppercase tracking-widest transition-colors ${
                sort === opt.v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {commits.length} Note{commits.length === 1 ? "" : "s"}
        </div>
      </div>

      {visible.map((commit) => (
        <NoteRow
          key={commit.id}
          commit={commit}
          baseUrl={baseUrl}
          baseLabel={baseLabel}
          isOwner={!!user?.profile?.id && user.profile.id === commit.contributorId}
          isExpanded={expanded === commit.id}
          onToggleExpand={() =>
            setExpanded((e) => (e === commit.id ? null : commit.id))
          }
          onVote={() => toggleVote(commit.id, !!commit.hasVoted)}
          isPending={
            (voteMutation.isPending || unvoteMutation.isPending) &&
            (voteMutation.variables?.commitId === commit.id ||
              unvoteMutation.variables?.commitId === commit.id)
          }
        />
      ))}

      {hasMore && (
        <div className="pt-3 text-center">
          <Button
            variant="outline"
            onClick={() => setPageSize((s) => s + PAGE_SIZE)}
            className="rounded-none uppercase tracking-widest text-xs h-10 px-6"
          >
            Load more Notes
          </Button>
        </div>
      )}
    </div>
  );
}

function NoteRow({
  commit,
  baseUrl,
  baseLabel,
  isOwner,
  isExpanded,
  onToggleExpand,
  onVote,
  isPending,
}: {
  commit: CommitSummary;
  baseUrl: string | null;
  baseLabel: string | null;
  isOwner: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onVote: () => void;
  isPending: boolean;
}) {
  const layers = useMemo<WaveformLayer[]>(() => {
    const out: WaveformLayer[] = [];
    if (baseUrl) {
      out.push({
        id: `${commit.id}-base`,
        label: baseLabel || "Base",
        source: baseUrl,
        isBase: true,
      });
    }
    out.push({
      id: `${commit.id}-overlay`,
      label: commit.title,
      source: commit.audioFileUrl,
      offsetSeconds: commit.overlayOffsetSeconds ?? 0,
    });
    return out;
  }, [commit.id, commit.audioFileUrl, commit.title, commit.overlayOffsetSeconds, baseUrl, baseLabel]);

  return (
    <div className="bg-card border border-border">
      <div className="flex items-stretch">
        {/* Vote column */}
        <button
          onClick={onVote}
          disabled={isOwner || isPending}
          title={isOwner ? "You can't vote on your own Note" : ""}
          className={`flex flex-col items-center justify-center px-3 py-3 border-r border-border w-16 flex-shrink-0 transition-colors ${
            commit.hasVoted
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-background"
          } disabled:opacity-50 disabled:hover:bg-transparent`}
        >
          <ChevronUp
            className={`w-5 h-5 ${commit.hasVoted ? "fill-current" : ""}`}
          />
          <span className="text-base font-mono font-bold tabular-nums leading-none mt-0.5">
            {commit.voteCount}
          </span>
          <span className="text-[8px] uppercase tracking-widest mt-1">
            {commit.hasVoted ? "Voted" : "Vote"}
          </span>
        </button>

        {/* Body */}
        <button
          onClick={onToggleExpand}
          className="flex-1 min-w-0 px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-background transition-colors"
        >
          <div className="min-w-0">
            <div className="font-serif font-bold truncate">{commit.title}</div>
            <div className="text-xs text-muted-foreground truncate">
              {commit.instrumentType} · by{" "}
              <span className="text-foreground">
                {commit.contributor.displayName}
              </span>
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex-shrink-0">
            {isExpanded ? "Hide" : "Listen"}
          </div>
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-border p-3 bg-background">
          <WaveformStack layers={layers} rowHeight={48} />
          <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-widest">
            <Link
              href={`/commits/${commit.id}`}
              className="text-primary hover:underline"
            >
              Open Note details →
            </Link>
            <span className="text-muted-foreground">
              {format(new Date(commit.createdAt), "MMM d, yyyy")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentsSection({ songId }: { songId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const [body, setBody] = useState("");

  const commentsQueryKey = getListSongCommentsQueryKey(songId);
  const { data: comments, isLoading } = useListSongComments(songId, {
    query: { queryKey: commentsQueryKey },
  });

  const postMutation = usePostSongComment();
  const deleteMutation = useDeleteComment();
  const reportMutation = useReportComment();

  const isAdmin = !!user?.profile?.isAdmin;
  const myId = user?.profile?.id ?? null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    postMutation.mutate(
      { songId, data: { body: trimmed } },
      {
        onSuccess: () => {
          setBody("");
          queryClient.invalidateQueries({ queryKey: commentsQueryKey });
        },
        onError: (err) => {
          toast({
            title: "Couldn't post comment",
            description: err.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleReport = (commentId: string) => {
    const reason = window.prompt(
      "Why are you reporting this comment? (spam, abuse, off-topic, etc.)",
    );
    if (reason === null) return;
    const trimmed = reason.trim();
    if (!trimmed) return;
    reportMutation.mutate(
      { commentId, data: { reason: trimmed.slice(0, 500) } },
      {
        onSuccess: () =>
          toast({
            title: "Thanks — sent to moderators",
            description: "We'll review this shortly.",
          }),
        onError: (err) =>
          toast({
            title: "Couldn't report comment",
            description: err.message,
            variant: "destructive",
          }),
      },
    );
  };

  const handleDelete = (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    deleteMutation.mutate(
      { commentId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: commentsQueryKey });
        },
        onError: (err) => {
          toast({
            title: "Couldn't delete comment",
            description: err.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  const list = comments ?? [];

  return (
    <section>
      <h2 className="text-2xl font-serif font-bold mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5" /> Comments
        <span className="text-sm font-sans font-normal text-muted-foreground">
          ({list.length})
        </span>
      </h2>

      {user ? (
        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border p-4 mb-4"
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your take on this song…"
            maxLength={2000}
            rows={3}
            className="w-full bg-background border border-border p-3 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={postMutation.isPending}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {body.length}/2000
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={!body.trim() || postMutation.isPending}
            >
              {postMutation.isPending ? "Posting…" : "Post comment"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="bg-card border border-dashed border-border p-4 mb-4 text-sm text-muted-foreground">
          <Link href="/sign-in" className="text-primary hover:underline">
            Sign in
          </Link>{" "}
          to join the conversation.
        </div>
      )}

      {isLoading ? (
        <div className="bg-card border border-border p-6 text-sm text-muted-foreground">
          Loading comments…
        </div>
      ) : list.length === 0 ? (
        <div className="bg-card border border-dashed border-border p-6 text-sm text-muted-foreground">
          No comments yet. Be the first to share what you hear.
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((c: Comment) => {
            const canDelete = isAdmin || (myId !== null && c.authorId === myId);
            return (
              <li
                key={c.id}
                className="bg-card border border-border p-4"
              >
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-bold text-sm truncate">
                      {c.author.displayName}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {format(new Date(c.createdAt), "MMM d, yyyy · h:mm a")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {user && myId !== c.authorId && (
                      <button
                        onClick={() => handleReport(c.id)}
                        disabled={reportMutation.isPending}
                        className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive disabled:opacity-50"
                        title="Report this comment to moderators"
                      >
                        Report
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deleteMutation.isPending}
                        className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {c.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
