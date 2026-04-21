import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetSong,
  useListSongFiles,
  useListRoundsForSong,
  useAdminUpdateSong,
  useAdminCreateRound,
  useAdminUpdateRound,
  useAdminAdvanceSongPhase,
  useAdminAddSongFile,
  useAdminSetCommitStatus,
  useAdminListCommits,
  useAdminCreateVersion,
  useAdminCreateSongCredit,
  useAdminUpdateSongCredit,
  useAdminDeleteSongCredit,
  useAdminReorderSongCredits,
  useGetSongBySlug,
  getGetSongQueryKey,
  getGetSongBySlugQueryKey,
  getListSongFilesQueryKey,
  getListRoundsForSongQueryKey,
  getAdminListCommitsQueryKey,
  AdminAddSongFileBodyFileType,
  UpdateSongBodyStatus,
  UpdateRoundBodyStatus,
  AdminListCommitsStatus,
  AdvancePhaseBodyPhase,
  CreateRoundBodyKind,
  CreateRoundBodyMergeBehavior,
} from "@workspace/api-client-react";
import type {
  CommitSummary,
  Round,
  SongCredit,
  SongFile,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ArrowLeft, Check, X, Upload, FileAudio, Save, Trash2, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CommitAudioComparator } from "@/components/CommitAudioComparator";

const INSTRUMENT_OPTIONS = [
  "drums",
  "bass",
  "guitar",
  "keys",
  "strings",
  "brass",
  "woodwind",
  "percussion",
  "vocals_lead",
  "vocals_harmony",
  "synth",
  "other",
];

export default function AdminSongDetail() {
  const params = useParams();
  const songId = params.songId || "";
  const queryClient = useQueryClient();

  const { data: song, isLoading } = useGetSong(songId, {
    query: { enabled: !!songId, queryKey: getGetSongQueryKey(songId) },
  });

  const { data: rounds } = useListRoundsForSong(songId, {
    query: {
      enabled: !!songId,
      queryKey: getListRoundsForSongQueryKey(songId),
    },
  });

  const pendingParams = { songId, status: AdminListCommitsStatus.pending };
  const { data: pendingCommits } = useAdminListCommits(pendingParams, {
    query: {
      enabled: !!songId,
      queryKey: getAdminListCommitsQueryKey(pendingParams),
    },
  });

  const shortlistedParams = {
    songId,
    status: AdminListCommitsStatus.shortlisted,
  };
  const { data: shortlistedCommits } = useAdminListCommits(shortlistedParams, {
    query: {
      enabled: !!songId,
      queryKey: getAdminListCommitsQueryKey(shortlistedParams),
    },
  });

  const { data: files } = useListSongFiles(songId, {
    query: {
      enabled: !!songId,
      queryKey: getListSongFilesQueryKey(songId),
    },
  });

  const [kindFilter, setKindFilter] = useState<"all" | "structure" | "accent">("all");
  const filteredPending = (pendingCommits ?? []).filter((c) =>
    kindFilter === "all" ? true : c.kind === kindFilter,
  );

  const invalidateCommits = () => {
    queryClient.invalidateQueries({
      queryKey: getAdminListCommitsQueryKey(pendingParams),
    });
    queryClient.invalidateQueries({
      queryKey: getAdminListCommitsQueryKey(shortlistedParams),
    });
  };

  if (isLoading)
    return (
      <div className="p-12 text-center text-muted-foreground">Loading...</div>
    );
  if (!song)
    return (
      <div className="p-12 text-center text-muted-foreground">
        Song not found
      </div>
    );

  return (
    <div className="container mx-auto px-6 py-12 max-w-6xl">
      <div className="mb-8">
        <Link
          href="/admin/songs"
          className="text-muted-foreground hover:text-foreground text-sm uppercase tracking-widest mb-4 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Songs
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-primary mb-2">
              Song Management
            </div>
            <h1 className="text-4xl font-serif font-bold tracking-tighter mb-2">
              {song.title}
            </h1>
            <p className="text-muted-foreground">
              Status:{" "}
              <span className="uppercase text-foreground">{song.status}</span>{" "}
              • Slug: {song.slug}
            </p>
          </div>
          <Link href={`/songs/${song.slug}`}>
            <Button
              variant="outline"
              className="rounded-none uppercase tracking-widest text-xs"
            >
              View Public Page
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="commits" className="w-full">
        <TabsList className="bg-card border border-border w-full justify-start rounded-none h-14 p-0 overflow-x-auto">
          <TabsTrigger
            value="commits"
            className="rounded-none h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase tracking-widest text-xs px-6"
          >
            Review ({filteredPending.length}{kindFilter !== "all" ? `/${pendingCommits?.length || 0}` : ""})
          </TabsTrigger>
          <TabsTrigger
            value="publish"
            className="rounded-none h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase tracking-widest text-xs px-6"
          >
            Publish Version
          </TabsTrigger>
          <TabsTrigger
            value="rounds"
            className="rounded-none h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase tracking-widest text-xs px-6"
          >
            Rounds
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="rounded-none h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase tracking-widest text-xs px-6"
          >
            Files & Stems
          </TabsTrigger>
          <TabsTrigger
            value="credits"
            className="rounded-none h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase tracking-widest text-xs px-6"
          >
            Music Credits
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="rounded-none h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground uppercase tracking-widest text-xs px-6"
          >
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commits" className="mt-6 border-none p-0 outline-none">
          <div className="bg-card border border-border p-8">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <h2 className="text-2xl font-serif font-bold">
                Pending Commits to Review
              </h2>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
                <span className="text-muted-foreground">Filter:</span>
                {(["all", "structure", "accent"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setKindFilter(k)}
                    className={`px-3 py-1 border ${
                      kindFilter === k
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
            {filteredPending.length ? (
              <div className="space-y-6">
                {filteredPending.map((commit) => (
                  <CommitReviewCard
                    key={commit.id}
                    commit={commit}
                    onReviewed={invalidateCommits}
                  />
                ))}
              </div>
            ) : (
              <div className="p-12 text-center border border-dashed border-border text-muted-foreground">
                No pending commits to review.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="publish" className="mt-6 border-none p-0 outline-none">
          <PublishVersionPanel
            songId={songId}
            shortlistedCommits={shortlistedCommits ?? []}
            rounds={rounds ?? []}
          />
        </TabsContent>

        <TabsContent value="rounds" className="mt-6 border-none p-0 outline-none">
          <RoundsPanel songId={songId} rounds={rounds ?? []} songPhase={song.phase} />
        </TabsContent>

        <TabsContent value="files" className="mt-6 border-none p-0 outline-none">
          <FilesPanel songId={songId} files={files ?? []} />
        </TabsContent>

        <TabsContent value="credits" className="mt-6 border-none p-0 outline-none">
          <CreditsPanel songId={songId} songSlug={song.slug} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6 border-none p-0 outline-none">
          <SettingsPanel song={song} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CommitReviewCard({
  commit,
  onReviewed,
}: {
  commit: CommitSummary;
  onReviewed: () => void;
}) {
  const { toast } = useToast();
  const setStatusMutation = useAdminSetCommitStatus();

  const handleStatus = (status: "shortlisted" | "rejected") => {
    setStatusMutation.mutate(
      { commitId: commit.id, data: { status } },
      {
        onSuccess: () => {
          toast({ title: `Commit ${status}` });
          onReviewed();
        },
        onError: (err) =>
          toast({
            title: "Failed",
            description: String(err),
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="border border-border p-6 flex flex-col gap-4 bg-background">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary mb-1">
            Round {commit.roundNumber} • {commit.instrumentType}
          </div>
          <h3 className="font-serif font-bold text-xl mb-1">{commit.title}</h3>
          <div className="text-sm text-muted-foreground">
            By {commit.contributor.displayName}
          </div>
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

      <CommitAudioComparator commit={commit} />
    </div>
  );
}

function PublishVersionPanel({
  songId,
  shortlistedCommits,
  rounds,
}: {
  songId: string;
  shortlistedCommits: CommitSummary[];
  rounds: Round[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [mergeNote, setMergeNote] = useState("");
  const [officialMixPath, setOfficialMixPath] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const onToggleSelect = (commit: CommitSummary, checked: boolean) => {
    setSelected((s) => {
      const next = { ...s, [commit.id]: checked };
      if (checked) {
        const round = roundById.get(commit.roundId);
        if (round?.mergeBehavior === "single") {
          for (const other of shortlistedCommits) {
            if (
              other.id !== commit.id &&
              other.roundId === commit.roundId &&
              next[other.id]
            ) {
              next[other.id] = false;
            }
          }
        }
      }
      return next;
    });
  };
  const publish = useAdminCreateVersion();
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (r) => {
      setOfficialMixPath(r.objectPath);
      toast({ title: "Official mix uploaded" });
    },
    onError: (err) =>
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      }),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file, { purpose: "official-mix", songId });
  };

  const submit = () => {
    const mergedCommitIds = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!title || !officialMixPath || mergedCommitIds.length === 0) {
      toast({
        title: "Missing info",
        description:
          "Title, uploaded official mix, and at least one commit are required.",
        variant: "destructive",
      });
      return;
    }
    // Pre-submit merge-behavior validation matches server enforcement.
    const counts = new Map<string, number>();
    for (const id of mergedCommitIds) {
      const c = shortlistedCommits.find((s) => s.id === id);
      if (!c) continue;
      counts.set(c.roundId, (counts.get(c.roundId) ?? 0) + 1);
    }
    for (const [rid, count] of counts) {
      const r = roundById.get(rid);
      if (r?.mergeBehavior === "single" && count > 1) {
        toast({
          title: "Single-winner round",
          description: `Round "${r.title}" only allows one merged commit. Pick exactly one.`,
          variant: "destructive",
        });
        return;
      }
    }
    publish.mutate(
      {
        data: {
          songId,
          title,
          mergeNote: mergeNote || undefined,
          officialMixObjectPath: officialMixPath,
          mergedCommitIds,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Version published" });
          setTitle("");
          setMergeNote("");
          setOfficialMixPath("");
          setSelected({});
          queryClient.invalidateQueries({
            queryKey: getGetSongQueryKey(songId),
          });
          queryClient.invalidateQueries({
            queryKey: getListRoundsForSongQueryKey(songId),
          });
          queryClient.invalidateQueries({
            queryKey: getAdminListCommitsQueryKey({
              songId,
              status: AdminListCommitsStatus.shortlisted,
            }),
          });
        },
        onError: (err) =>
          toast({
            title: "Publish failed",
            description: String(err),
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <div className="bg-card border border-border p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold mb-2">
          Publish New Version
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick which shortlisted commits to merge into the next official mix,
          upload the mastered mix file, and publish.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Version Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Long Room — v3"
            className="rounded-none"
          />
        </div>
        <div>
          <Label>Merge Note</Label>
          <Input
            value={mergeNote}
            onChange={(e) => setMergeNote(e.target.value)}
            placeholder="What changed"
            className="rounded-none"
          />
        </div>
      </div>

      <div>
        <Label>Official Mix (audio)</Label>
        <div className="flex items-center gap-3 mt-2">
          <Input
            type="file"
            accept="audio/*"
            onChange={handleFile}
            className="rounded-none"
          />
          <span className="text-xs text-muted-foreground">
            {isUploading
              ? `Uploading ${progress}%`
              : officialMixPath
                ? "Uploaded ✓"
                : ""}
          </span>
        </div>
      </div>

      <div>
        <Label>Merge these shortlisted commits</Label>
        {shortlistedCommits.length === 0 ? (
          <div className="mt-2 p-6 text-center border border-dashed border-border text-muted-foreground text-sm">
            No shortlisted commits yet. Shortlist commits from the Review tab
            first.
          </div>
        ) : (
          <div className="mt-2 border border-border divide-y divide-border">
            {shortlistedCommits.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-3 p-3 hover:bg-secondary/30 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!!selected[c.id]}
                  onChange={(e) => onToggleSelect(c, e.target.checked)}
                />
                <div className="flex-1">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Round {c.roundNumber} · {c.instrumentType} ·{" "}
                    {roundById.get(c.roundId)?.mergeBehavior === "single"
                      ? "single-winner"
                      : "multi-merge"}{" "}
                    · by {c.contributor.displayName} · {c.voteCount} votes
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <Button
        onClick={submit}
        disabled={publish.isPending || isUploading}
        className="rounded-none uppercase tracking-widest text-xs"
      >
        <Check className="w-4 h-4 mr-2" />
        {publish.isPending ? "Publishing…" : "Publish Version"}
      </Button>
    </div>
  );
}

function RoundsPanel({
  songId,
  rounds,
  songPhase,
}: {
  songId: string;
  rounds: Round[];
  songPhase?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [instrument, setInstrument] = useState(INSTRUMENT_OPTIONS[0]);
  const defaultKind: CreateRoundBodyKind =
    songPhase === "accents"
      ? CreateRoundBodyKind.accent
      : CreateRoundBodyKind.structure;
  const defaultMerge: CreateRoundBodyMergeBehavior =
    songPhase === "accents"
      ? CreateRoundBodyMergeBehavior.multi
      : CreateRoundBodyMergeBehavior.single;
  const [kind, setKind] = useState<CreateRoundBodyKind>(defaultKind);
  const [mergeBehavior, setMergeBehavior] =
    useState<CreateRoundBodyMergeBehavior>(defaultMerge);
  // If the song's phase changes (after Advance/Revert) auto-realign defaults.
  useEffect(() => {
    setKind(defaultKind);
    setMergeBehavior(defaultMerge);
  }, [songPhase]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = useAdminCreateRound();
  const update = useAdminUpdateRound();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListRoundsForSongQueryKey(songId),
    });

  const onKindChange = (k: CreateRoundBodyKind) => {
    setKind(k);
    setMergeBehavior(
      k === CreateRoundBodyKind.accent
        ? CreateRoundBodyMergeBehavior.multi
        : CreateRoundBodyMergeBehavior.single,
    );
  };

  const submit = () => {
    if (!title) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    create.mutate(
      {
        data: {
          songId,
          title,
          allowedInstrumentType: instrument,
          kind,
          mergeBehavior,
          status: "open",
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Round created" });
          setTitle("");
          invalidate();
        },
      },
    );
  };

  const setStatus = (id: string, status: "open" | "closed") => {
    update.mutate(
      { roundId: id, data: { status: status as UpdateRoundBodyStatus } },
      {
        onSuccess: () => {
          toast({ title: `Round ${status}` });
          invalidate();
        },
      },
    );
  };

  return (
    <div className="bg-card border border-border p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold mb-4">Create Round</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <Input
            placeholder="Round title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-none md:col-span-2"
          />
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Instrument</Label>
            <Select value={instrument} onValueChange={setInstrument}>
              <SelectTrigger className="rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTRUMENT_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Round kind</Label>
            <Select value={kind} onValueChange={(v) => onKindChange(v as CreateRoundBodyKind)}>
              <SelectTrigger className="rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CreateRoundBodyKind.structure}>structure (foundation layer)</SelectItem>
                <SelectItem value={CreateRoundBodyKind.accent}>accent (signature moment)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Merge behavior</Label>
            <Select
              value={mergeBehavior}
              onValueChange={(v) =>
                setMergeBehavior(v as CreateRoundBodyMergeBehavior)
              }
            >
              <SelectTrigger className="rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CreateRoundBodyMergeBehavior.single}>single (pick one)</SelectItem>
                <SelectItem value={CreateRoundBodyMergeBehavior.multi}>multi (stack many)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={submit}
            disabled={create.isPending}
            className="rounded-none uppercase tracking-widest text-xs md:col-span-2"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Round
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-serif font-bold mb-2">Existing Rounds</h3>
        {rounds.length ? (
          <div className="divide-y divide-border border border-border">
            {rounds.map((round) => (
              <div
                key={round.id}
                className="p-4 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold">
                    Round {round.roundNumber}: {round.title}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {round.kind === "accent" ? "Accent" : "Structure"} •{" "}
                    {round.mergeBehavior === "multi" ? "stackable" : "pick one"}{" "}
                    • Wanted: {round.allowedInstrumentType} • Status:{" "}
                    <span className="uppercase">{round.status}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {round.status !== "open" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none text-xs uppercase"
                      onClick={() => setStatus(round.id, "open")}
                      disabled={update.isPending}
                    >
                      Open
                    </Button>
                  )}
                  {round.status === "open" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-none text-xs uppercase"
                      onClick={() => setStatus(round.id, "closed")}
                      disabled={update.isPending}
                    >
                      Close
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground text-center p-8 border border-dashed border-border">
            No rounds created yet.
          </div>
        )}
      </div>
    </div>
  );
}

function FilesPanel({ songId, files }: { songId: string; files: SongFile[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [fileType, setFileType] = useState<AdminAddSongFileBodyFileType>(
    AdminAddSongFileBodyFileType.stem,
  );
  const [objectPath, setObjectPath] = useState("");
  const [filename, setFilename] = useState("");
  const [size, setSize] = useState<number | undefined>(undefined);
  const add = useAdminAddSongFile();
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (r) => {
      setObjectPath(r.objectPath);
      toast({ title: "Upload complete" });
    },
    onError: (e) =>
      toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    setSize(f.size);
    const purpose =
      fileType === AdminAddSongFileBodyFileType.cover
        ? "cover"
        : fileType === AdminAddSongFileBodyFileType.stem
          ? "stem"
          : "official-mix";
    uploadFile(f, { purpose, songId });
  };

  const submit = () => {
    if (!label || !objectPath || !filename) {
      toast({ title: "Missing info", variant: "destructive" });
      return;
    }
    add.mutate(
      {
        songId,
        data: {
          fileType,
          label,
          fileObjectPath: objectPath,
          originalFilename: filename,
          sizeBytes: size,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "File added" });
          setLabel("");
          setObjectPath("");
          setFilename("");
          setSize(undefined);
          queryClient.invalidateQueries({
            queryKey: getListSongFilesQueryKey(songId),
          });
        },
      },
    );
  };

  return (
    <div className="bg-card border border-border p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold mb-4">Add File</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Piano stem (L/R)"
              className="rounded-none"
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select
              value={fileType}
              onValueChange={(v) =>
                setFileType(v as AdminAddSongFileBodyFileType)
              }
            >
              <SelectTrigger className="rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(AdminAddSongFileBodyFileType).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>File</Label>
            <div className="flex items-center gap-3 mt-2">
              <Input
                type="file"
                onChange={handleFile}
                className="rounded-none"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {isUploading
                  ? `Uploading ${progress}%`
                  : objectPath
                    ? `Uploaded ✓ (${filename})`
                    : ""}
              </span>
            </div>
          </div>
        </div>
        <Button
          className="mt-4 rounded-none uppercase tracking-widest text-xs"
          onClick={submit}
          disabled={add.isPending || isUploading}
        >
          <Upload className="w-4 h-4 mr-2" /> Attach to Song
        </Button>
      </div>

      <div>
        <h3 className="text-lg font-serif font-bold mb-2">Attached Files</h3>
        {files.length ? (
          <div className="divide-y divide-border border border-border">
            {files.map((f) => (
              <div
                key={f.id}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <FileAudio className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{f.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.fileType} · {f.originalFilename}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground text-center p-8 border border-dashed border-border">
            No files attached yet.
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsPanel({
  song,
}: {
  song: {
    id: string;
    title: string;
    description?: string | null;
    creatorName: string;
    genre?: string | null;
    bpm?: number | null;
    musicalKey?: string | null;
    timeSignature?: string | null;
    status: string;
    phase: string;
  };
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const advance = useAdminAdvanceSongPhase();
  const [title, setTitle] = useState(song.title);
  const [description, setDescription] = useState(song.description ?? "");
  const [creatorName, setCreatorName] = useState(song.creatorName);
  const [genre, setGenre] = useState(song.genre ?? "");
  const [bpm, setBpm] = useState<number | undefined>(song.bpm ?? undefined);
  const [status, setStatus] = useState<UpdateSongBodyStatus>(
    song.status as UpdateSongBodyStatus,
  );
  const update = useAdminUpdateSong();

  const submit = () => {
    update.mutate(
      {
        songId: song.id,
        data: {
          title,
          description: description || undefined,
          creatorName,
          genre: genre || undefined,
          bpm,
          status,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Song updated" });
          queryClient.invalidateQueries({
            queryKey: getGetSongQueryKey(song.id),
          });
        },
      },
    );
  };

  const advancePhase = (next: AdvancePhaseBodyPhase) => {
    if (
      !confirm(
        next === AdvancePhaseBodyPhase.accents
          ? "Move this song into the Accents phase? Structure rounds will be considered locked."
          : "Move this song back to the Structure phase?",
      )
    )
      return;
    advance.mutate(
      { songId: song.id, data: { phase: next } },
      {
        onSuccess: () => {
          toast({ title: `Phase set to ${next}` });
          queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(song.id) });
        },
        onError: (err) =>
          toast({ title: "Failed", description: String(err), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="bg-card border border-border p-8 space-y-6">
      <div className="border border-primary/40 bg-primary/5 p-4">
        <div className="text-xs uppercase tracking-widest text-primary mb-1">Lifecycle Phase</div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-serif font-bold text-lg">
              Currently: {song.phase === "accents" ? "Accents" : "Structure"}
            </div>
            <p className="text-sm text-muted-foreground">
              {song.phase === "accents"
                ? "The foundation is set. New rounds should add signature accent moments."
                : "The community is shaping drums, bass, and harmony. Lock the structure to advance."}
            </p>
          </div>
          {song.phase === "structure" ? (
            <Button
              onClick={() => advancePhase(AdvancePhaseBodyPhase.accents)}
              disabled={advance.isPending}
              className="rounded-none uppercase tracking-widest text-xs"
            >
              Advance to Accents
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => advancePhase(AdvancePhaseBodyPhase.structure)}
              disabled={advance.isPending}
              className="rounded-none uppercase tracking-widest text-xs"
            >
              Revert to Structure
            </Button>
          )}
        </div>
      </div>
      <h2 className="text-2xl font-serif font-bold mb-2">Song Settings</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-none"
          />
        </div>
        <div>
          <Label>Creator</Label>
          <Input
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            className="rounded-none"
          />
        </div>
        <div>
          <Label>Genre</Label>
          <Input
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="rounded-none"
          />
        </div>
        <div>
          <Label>BPM</Label>
          <Input
            type="number"
            value={bpm ?? ""}
            onChange={(e) =>
              setBpm(e.target.value ? Number(e.target.value) : undefined)
            }
            className="rounded-none"
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as UpdateSongBodyStatus)}
          >
            <SelectTrigger className="rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(UpdateSongBodyStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-none"
          rows={4}
        />
      </div>
      <Button
        onClick={submit}
        disabled={update.isPending}
        className="rounded-none uppercase tracking-widest text-xs"
      >
        <Save className="w-4 h-4 mr-2" /> Save
      </Button>
    </div>
  );
}

function CreditsPanel({ songId, songSlug }: { songId: string; songSlug: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: song, isLoading } = useGetSongBySlug(songSlug, {
    query: { enabled: !!songSlug, queryKey: getGetSongBySlugQueryKey(songSlug) },
  });
  const credits: SongCredit[] = song?.thirdPartyCredits ?? [];

  const create = useAdminCreateSongCredit();
  const reorder = useAdminReorderSongCredits();

  const [draft, setDraft] = useState({
    title: "",
    author: "",
    sourceUrl: "",
    licenseName: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    role: "",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetSongBySlugQueryKey(songSlug) });
    queryClient.invalidateQueries({ queryKey: getGetSongQueryKey(songId) });
  };

  const handleAdd = () => {
    if (!draft.title || !draft.author || !draft.sourceUrl || !draft.licenseName || !draft.licenseUrl) {
      toast({
        title: "Missing fields",
        description: "Title, author, source URL, license name, and license URL are required.",
        variant: "destructive",
      });
      return;
    }
    create.mutate(
      {
        songId,
        data: {
          title: draft.title,
          author: draft.author,
          sourceUrl: draft.sourceUrl,
          licenseName: draft.licenseName,
          licenseUrl: draft.licenseUrl,
          role: draft.role || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Credit added" });
          setDraft({
            title: "",
            author: "",
            sourceUrl: "",
            licenseName: draft.licenseName,
            licenseUrl: draft.licenseUrl,
            role: "",
          });
          invalidate();
        },
        onError: (err) =>
          toast({ title: "Failed", description: String(err), variant: "destructive" }),
      },
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= credits.length) return;
    const ids = credits.map((c) => c.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder.mutate(
      { songId, data: { creditIds: ids } },
      {
        onSuccess: () => invalidate(),
        onError: (err) =>
          toast({ title: "Reorder failed", description: String(err), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="bg-card border border-border p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold mb-2">Music Credits</h2>
        <p className="text-sm text-muted-foreground">
          Third-party assets used in this song. These appear in the Music Credits
          section on the public song page. Add one entry per attributed track or asset.
        </p>
      </div>

      <div className="border border-dashed border-border p-4 space-y-3">
        <h3 className="font-serif font-bold">Add Credit</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Title</Label>
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Drum loop 04"
              className="rounded-none"
            />
          </div>
          <div>
            <Label>Author</Label>
            <Input
              value={draft.author}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
              placeholder="e.g. Jane Doe"
              className="rounded-none"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Source URL</Label>
            <Input
              value={draft.sourceUrl}
              onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
              placeholder="https://commons.wikimedia.org/..."
              className="rounded-none"
            />
          </div>
          <div>
            <Label>License Name</Label>
            <Input
              value={draft.licenseName}
              onChange={(e) => setDraft({ ...draft, licenseName: e.target.value })}
              className="rounded-none"
            />
          </div>
          <div>
            <Label>License URL</Label>
            <Input
              value={draft.licenseUrl}
              onChange={(e) => setDraft({ ...draft, licenseUrl: e.target.value })}
              className="rounded-none"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Role / Usage (optional)</Label>
            <Input
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              placeholder="e.g. Drum loop, Background vocals"
              className="rounded-none"
            />
          </div>
        </div>
        <Button
          onClick={handleAdd}
          disabled={create.isPending}
          className="rounded-none uppercase tracking-widest text-xs"
        >
          <Plus className="w-4 h-4 mr-2" />
          {create.isPending ? "Adding…" : "Add Credit"}
        </Button>
      </div>

      <div>
        <h3 className="font-serif font-bold mb-3">
          Existing Credits ({credits.length})
        </h3>
        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground">Loading…</div>
        ) : credits.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border text-muted-foreground text-sm">
            No third-party credits yet for this song.
          </div>
        ) : (
          <div className="space-y-3">
            {credits.map((credit, i) => (
              <CreditRow
                key={credit.id}
                credit={credit}
                index={i}
                total={credits.length}
                onMove={move}
                onChanged={invalidate}
                reordering={reorder.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreditRow({
  credit,
  index,
  total,
  onMove,
  onChanged,
  reordering,
}: {
  credit: SongCredit;
  index: number;
  total: number;
  onMove: (index: number, dir: -1 | 1) => void;
  onChanged: () => void;
  reordering: boolean;
}) {
  const { toast } = useToast();
  const update = useAdminUpdateSongCredit();
  const del = useAdminDeleteSongCredit();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: credit.title,
    author: credit.author,
    sourceUrl: credit.sourceUrl,
    licenseName: credit.licenseName,
    licenseUrl: credit.licenseUrl,
    role: credit.role ?? "",
  });

  const save = () => {
    update.mutate(
      {
        creditId: credit.id,
        data: {
          title: form.title,
          author: form.author,
          sourceUrl: form.sourceUrl,
          licenseName: form.licenseName,
          licenseUrl: form.licenseUrl,
          role: form.role || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Credit updated" });
          setEditing(false);
          onChanged();
        },
        onError: (err) =>
          toast({ title: "Update failed", description: String(err), variant: "destructive" }),
      },
    );
  };

  const remove = () => {
    if (!confirm(`Delete credit "${credit.title}"?`)) return;
    del.mutate(
      { creditId: credit.id },
      {
        onSuccess: () => {
          toast({ title: "Credit deleted" });
          onChanged();
        },
        onError: (err) =>
          toast({ title: "Delete failed", description: String(err), variant: "destructive" }),
      },
    );
  };

  if (editing) {
    return (
      <div className="border border-primary p-4 space-y-3 bg-background">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded-none"
            />
          </div>
          <div>
            <Label>Author</Label>
            <Input
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              className="rounded-none"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Source URL</Label>
            <Input
              value={form.sourceUrl}
              onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
              className="rounded-none"
            />
          </div>
          <div>
            <Label>License Name</Label>
            <Input
              value={form.licenseName}
              onChange={(e) => setForm({ ...form, licenseName: e.target.value })}
              className="rounded-none"
            />
          </div>
          <div>
            <Label>License URL</Label>
            <Input
              value={form.licenseUrl}
              onChange={(e) => setForm({ ...form, licenseUrl: e.target.value })}
              className="rounded-none"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Role / Usage</Label>
            <Input
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="rounded-none"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={save}
            disabled={update.isPending}
            className="rounded-none uppercase tracking-widest text-xs"
          >
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
          <Button
            variant="outline"
            onClick={() => setEditing(false)}
            disabled={update.isPending}
            className="rounded-none uppercase tracking-widest text-xs"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border p-4 flex items-start justify-between gap-4 bg-background">
      <div className="flex flex-col items-center gap-1 pt-1">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={index === 0 || reordering}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Move up"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <span className="text-xs text-muted-foreground">{index + 1}</span>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1 || reordering}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Move down"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold truncate">{credit.title}</div>
        <div className="text-sm text-muted-foreground truncate">
          by {credit.author}
          {credit.role ? ` · ${credit.role}` : ""}
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
          <a
            href={credit.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1"
          >
            Source <ExternalLink className="w-3 h-3" />
          </a>
          <a
            href={credit.licenseUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground inline-flex items-center gap-1"
          >
            {credit.licenseName} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
          className="rounded-none uppercase tracking-widest text-xs"
        >
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={remove}
          disabled={del.isPending}
          className="rounded-none uppercase tracking-widest text-xs border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
