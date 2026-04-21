import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useGetSongBySlug,
  useSubmitCommit,
  useCreateDraft,
  useUpdateDraft,
  useListMyDrafts,
  useGetCurrentUser,
  getListMyDraftsQueryKey,
} from "@workspace/api-client-react";
import { getGetSongBySlugQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  FileAudio,
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  Layers,
} from "lucide-react";
import { WaveformStack, type WaveformLayer } from "@/components/WaveformStack";

function formatMmSsCs(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds - Math.floor(seconds)) * 100);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

function parseMmSsCs(input: string): number | null {
  const trimmed = input.trim();
  // Accept m:ss(.cs) or ss(.cs)
  const m1 = /^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (m1) {
    const m = parseInt(m1[1], 10);
    const s = parseInt(m1[2], 10);
    const cs = m1[3] ? parseInt(m1[3].padEnd(2, "0"), 10) : 0;
    if (s >= 60) return null;
    return m * 60 + s + cs / 100;
  }
  const m2 = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (m2) {
    const s = parseInt(m2[1], 10);
    const cs = m2[2] ? parseInt(m2[2].padEnd(2, "0"), 10) : 0;
    return s + cs / 100;
  }
  return null;
}

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(120),
  note: z.string().max(500).optional(),
  draftInstrumentType: z.string().optional(),
  confirmedHumanMade: z
    .boolean()
    .refine((v) => v === true, "You must confirm this is human-made"),
  confirmedRightsGrant: z
    .boolean()
    .refine((v) => v === true, "You must agree to the rights grant"),
  displayNameOverride: z.string().optional(),
  socialHandle: z.string().optional(),
});

export default function SubmitCommit() {
  const params = useParams();
  const slug = params.slug || "";
  const [, setLocation] = useLocation();
  const search = useSearch();
  const draftId = useMemo(() => {
    const sp = new URLSearchParams(search);
    return sp.get("draftId");
  }, [search]);
  const isEditing = !!draftId;
  const { toast } = useToast();

  const { data: user, isLoading: isUserLoading } = useGetCurrentUser();
  const { data: song, isLoading: isSongLoading } = useGetSongBySlug(slug, {
    query: { enabled: !!slug, queryKey: getGetSongBySlugQueryKey(slug) },
  });
  const { data: drafts, isLoading: draftsLoading } = useListMyDrafts({
    query: { enabled: isEditing },
  });
  const editingDraft = useMemo(
    () => (isEditing ? drafts?.find((d) => d.id === draftId) ?? null : null),
    [isEditing, drafts, draftId],
  );

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [objectPath, setObjectPath] = useState<string | null>(null);
  const [overlayOffset, setOverlayOffset] = useState(0);
  const [prefilled, setPrefilled] = useState(false);

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res) => {
      setObjectPath(res.objectPath);
      toast({
        title: "Upload complete",
        description: "Audio uploaded — ready to drop your Note.",
      });
    },
    onError: (err) => {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const submitMutation = useSubmitCommit();
  const draftMutation = useCreateDraft();
  const updateDraftMutation = useUpdateDraft();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      note: "",
      draftInstrumentType: "",
      confirmedHumanMade: false,
      confirmedRightsGrant: false,
      displayNameOverride: "",
      socialHandle: "",
    },
  });

  useEffect(() => {
    if (audioFile && !objectPath && !isUploading && song) {
      uploadFile(audioFile, {
        purpose: "commit-audio",
        songId: song.id,
        // When no round is open we still upload, but as a draft.
        ...(song.currentRound ? { roundId: song.currentRound.id } : {}),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioFile, objectPath, isUploading, song?.id, song?.currentRound?.id]);

  // Prefill the form from an existing draft once the data has loaded.
  useEffect(() => {
    if (!isEditing || prefilled || !editingDraft) return;
    form.reset({
      title: editingDraft.title,
      note: editingDraft.note ?? "",
      draftInstrumentType: editingDraft.instrumentType,
      confirmedHumanMade: editingDraft.confirmedHumanMade,
      confirmedRightsGrant: editingDraft.confirmedRightsGrant,
      displayNameOverride: editingDraft.displayNameOverride ?? "",
      socialHandle: editingDraft.socialHandle ?? "",
    });
    setOverlayOffset(editingDraft.overlayOffsetSeconds ?? 0);
    setObjectPath(editingDraft.audioFileUrl);
    setPrefilled(true);
  }, [isEditing, prefilled, editingDraft, form]);

  const baseLayer = useMemo<WaveformLayer | null>(() => {
    if (!song?.currentVersion?.officialMixUrl) return null;
    return {
      id: "base",
      label: `${song.title} v${song.currentVersion.versionNumber}`,
      source: song.currentVersion.officialMixUrl,
      isBase: true,
    };
  }, [song]);

  const stackLayers = useMemo<WaveformLayer[]>(() => {
    const layers: WaveformLayer[] = [];
    if (baseLayer) layers.push(baseLayer);
    if (audioFile) {
      layers.push({
        id: "overlay",
        label: form.watch("title") || audioFile.name,
        source: audioFile,
        offsetSeconds: overlayOffset,
      });
    } else if (isEditing && editingDraft && objectPath) {
      layers.push({
        id: "overlay",
        label: form.watch("title") || editingDraft.title,
        source: editingDraft.audioFileUrl,
        offsetSeconds: overlayOffset,
      });
    }
    return layers;
  }, [baseLayer, audioFile, overlayOffset, form.watch("title"), isEditing, editingDraft, objectPath]);

  if (isSongLoading || isUserLoading || (isEditing && draftsLoading))
    return (
      <div className="container mx-auto p-12 text-center text-muted-foreground">
        Loading studio...
      </div>
    );

  if (isEditing && !editingDraft && !draftsLoading) {
    return (
      <div className="container mx-auto px-6 py-20 max-w-2xl text-center">
        <h1 className="text-4xl font-serif font-bold mb-6">Draft not found</h1>
        <p className="text-muted-foreground mb-8">
          This draft may have already been submitted or discarded.
        </p>
        <Link href="/profile">
          <Button className="rounded-none uppercase tracking-widest h-12 px-8">
            Back to profile
          </Button>
        </Link>
      </div>
    );
  }

  if (!user?.authenticated) {
    return (
      <div className="container mx-auto px-6 py-20 max-w-2xl text-center">
        <h1 className="text-4xl font-serif font-bold mb-6">Sign in to drop a Note</h1>
        <p className="text-muted-foreground mb-8">
          You need an account to layer your sound onto this track.
        </p>
        <Link href={`/sign-in?redirect=/songs/${slug}/submit`}>
          <Button className="rounded-none uppercase tracking-widest h-12 px-8">
            Sign In
          </Button>
        </Link>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="container mx-auto px-6 py-20 max-w-2xl text-center">
        <h1 className="text-4xl font-serif font-bold mb-6">Song not found</h1>
      </div>
    );
  }

  const isAccent = song.currentRound?.kind === "accent";
  const noActiveRound = !song.currentRound;

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!objectPath) {
      toast({
        title: "Missing audio",
        description: "Wait for the upload to finish before dropping your Note.",
        variant: "destructive",
      });
      return;
    }
    if (isEditing && editingDraft) {
      const instrumentType =
        (values.draftInstrumentType ?? "").trim() || editingDraft.instrumentType;
      const { draftInstrumentType: _ignored3, ...rest } = values;
      void _ignored3;
      updateDraftMutation.mutate(
        {
          draftId: editingDraft.id,
          data: {
            ...rest,
            instrumentType,
            audioObjectPath: objectPath,
            overlayOffsetSeconds: overlayOffset,
          },
        },
        {
          onSuccess: () => {
            toast({
              title: "Draft updated",
              description: "Your changes have been saved.",
            });
            queryClient.invalidateQueries({ queryKey: getListMyDraftsQueryKey() });
            setLocation(`/profile`);
          },
          onError: (err) => {
            toast({
              title: "Couldn't save changes",
              description: err.message,
              variant: "destructive",
            });
          },
        },
      );
      return;
    }
    if (!song.currentRound) {
      const instrumentType = (values.draftInstrumentType ?? "").trim();
      if (!instrumentType) {
        toast({
          title: "Pick an instrument",
          description:
            "Tell curators what kind of layer this is so it lands in the right round.",
          variant: "destructive",
        });
        return;
      }
      // Save the Note as a draft tied to this song. Once a matching round
      // opens the user can promote it from their profile.
      const { draftInstrumentType: _ignored, ...rest } = values;
      void _ignored;
      draftMutation.mutate(
        {
          data: {
            songId: song.id,
            instrumentType,
            audioObjectPath: objectPath,
            overlayOffsetSeconds: overlayOffset,
            ...rest,
          },
        },
        {
          onSuccess: () => {
            toast({
              title: "Note saved as draft",
              description:
                "We'll hold it until a matching round opens. You can submit it from your profile.",
            });
            queryClient.invalidateQueries({ queryKey: getListMyDraftsQueryKey() });
            setLocation(`/profile`);
          },
          onError: (err) => {
            toast({
              title: "Couldn't save draft",
              description: err.message,
              variant: "destructive",
            });
          },
        },
      );
      return;
    }

    const { draftInstrumentType: _ignored2, ...rest } = values;
    void _ignored2;
    submitMutation.mutate(
      {
        data: {
          roundId: song.currentRound.id,
          instrumentType: song.currentRound.allowedInstrumentType,
          audioObjectPath: objectPath,
          overlayOffsetSeconds: overlayOffset,
          ...rest,
        },
      },
      {
        onSuccess: (res) => {
          toast({
            title: "Note dropped",
            description: "Your Note has been added to the round.",
          });
          setLocation(`/commits/${res.id}`);
        },
        onError: (err) => {
          toast({
            title: "Submission failed",
            description: err.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl">
      <div className="mb-8">
        <Link
          href={isEditing ? "/profile" : `/songs/${slug}`}
          className="text-muted-foreground hover:text-foreground text-xs uppercase tracking-widest mb-3 inline-flex items-center gap-2"
        >
          ← {isEditing ? "Back to profile" : `Back to ${song.title}`}
        </Link>
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-2">
          {isEditing ? "Edit your draft" : "Upload a Note"}
        </h1>
        {song.currentRound ? (
          <div className="text-sm text-primary">
            Round {song.currentRound.roundNumber}: wanted —{" "}
            <strong>{song.currentRound.allowedInstrumentType}</strong>
            {isAccent && " (accent)"}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No round is currently open on this song. You can still finish your
            Note — when curators reopen the song you'll be reminded to submit.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Step 1 — Base layer */}
        <Section number={1} title="Base layer">
          {baseLayer ? (
            <div className="bg-background border border-border p-4 flex items-center gap-4">
              <Layers className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{song.title}</div>
                <div className="text-xs text-muted-foreground">
                  Current official mix · v{song.currentVersion?.versionNumber}
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-primary">
                Locked
              </div>
            </div>
          ) : (
            <div className="bg-background border border-dashed border-border p-4 text-sm text-muted-foreground">
              No official mix yet — your Note will become part of the seed.
            </div>
          )}
        </Section>

        {/* Step 2 — Layer audio */}
        <Section number={2} title="Layer your audio">
          {!audioFile && isEditing && objectPath ? (
            <div className="border border-border p-4 bg-background flex items-center gap-3">
              <FileAudio className="w-6 h-6 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">Current audio saved</div>
                <div className="text-xs text-muted-foreground">
                  Keep this file or upload a replacement below.
                </div>
              </div>
              <label className="relative inline-block">
                <input
                  type="file"
                  accept="audio/*,.wav,.flac,.aiff,.aif,.mp3,.m4a,.ogg,.opus,.aac,.wma"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 60 * 1024 * 1024) {
                      toast({
                        title: "File too large",
                        description: `Max 60 MB. Yours is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`,
                        variant: "destructive",
                      });
                      return;
                    }
                    setObjectPath(null);
                    setAudioFile(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-none uppercase tracking-widest text-[10px] h-9 pointer-events-none"
                >
                  Replace audio
                </Button>
              </label>
            </div>
          ) : !audioFile ? (
            <div className="border-2 border-dashed border-border p-10 text-center relative hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept="audio/*,.wav,.flac,.aiff,.aif,.mp3,.m4a,.ogg,.opus,.aac,.wma"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 60 * 1024 * 1024) {
                    toast({
                      title: "File too large",
                      description: `Max 60 MB. Yours is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`,
                      variant: "destructive",
                    });
                    return;
                  }
                  setAudioFile(file);
                }}
              />
              <UploadCloud className="w-7 h-7 mx-auto mb-3 text-muted-foreground" />
              <div className="font-bold mb-1">
                {isAccent
                  ? "Drop your one-shot or short take"
                  : "Click or drag your layer here"}
              </div>
              <div className="text-xs text-muted-foreground">
                WAV, FLAC, AIFF, MP3, M4A, OGG, AAC · max 60 MB
              </div>
            </div>
          ) : (
            <div className="border border-border p-4 bg-background flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <FileAudio className="w-6 h-6 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{audioFile.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
                {objectPath ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAudioFile(null);
                      setObjectPath(null);
                    }}
                    disabled={isUploading}
                  >
                    Replace
                  </Button>
                )}
              </div>
              {isUploading && (
                <div className="w-full bg-secondary h-1">
                  <div
                    className="bg-primary h-1 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Step 3 — Stack & align */}
        {(audioFile || (isEditing && objectPath)) && (
          <Section number={3} title="Stack & align">
            <p className="text-xs text-muted-foreground mb-3">
              Preview your Note over the base. Drag the start offset until they
              line up — your chosen offset is saved with the Note so curators
              and listeners hear it at the same alignment. Final mixing still
              happens when a curator merges your Note.
            </p>
            <WaveformStack
              layers={stackLayers}
              editableLayerIds={["overlay"]}
              onOffsetChange={(_id, v) => setOverlayOffset(v)}
            />
            <div className="mt-3 flex items-center gap-3">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Start at
              </label>
              <input
                type="text"
                value={formatMmSsCs(overlayOffset)}
                onChange={(e) => {
                  const v = parseMmSsCs(e.target.value);
                  if (v !== null) setOverlayOffset(v);
                }}
                placeholder="0:00.00"
                className="h-9 w-24 rounded-none bg-background border border-border px-2 text-sm font-mono tabular-nums text-center focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                mm:ss.cs · type to fine-tune
              </span>
            </div>
          </Section>
        )}

        {/* Step 4 — Details + attestations */}
        <Section
          number={audioFile ? 4 : 3}
          title={isAccent ? "Tag your Note" : "Note details"}
        >
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-8"
            >
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">
                        {isAccent ? "Tag your accent" : "Note title"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            isAccent
                              ? "e.g. 808 clap, downbeat 3"
                              : "e.g. Vintage P-Bass with flatwounds"
                          }
                          className="h-12 rounded-none bg-background border-border focus-visible:ring-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {noActiveRound && (
                  <FormField
                    control={form.control}
                    name="draftInstrumentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">
                          Instrument / layer type
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. bass, vocals, drums, hi-hat"
                            className="h-12 rounded-none bg-background border-border focus-visible:ring-primary"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-[11px] text-muted-foreground">
                          We'll use this to match your draft to the next open round.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {!isAccent && (
                  <FormField
                    control={form.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">
                          Notes for the curator (optional)
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Gear used, intent, mixing suggestions…"
                            className="min-h-[100px] rounded-none bg-background border-border focus-visible:ring-primary"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="space-y-4 pt-6 border-t border-border">
                <h3 className="font-serif font-bold text-lg mb-3 text-primary">
                  Required attestations
                </h3>

                <FormField
                  control={form.control}
                  name="confirmedHumanMade"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border border-primary/30 bg-primary/5">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="rounded-none border-primary/50 data-[state=checked]:bg-primary mt-1"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-bold text-foreground">
                          Strictly human-made
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          I attest that no generative AI tools were used in the
                          creation of this performance. Violating this policy
                          results in a permanent ban.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmedRightsGrant"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border border-border bg-background">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="rounded-none border-border data-[state=checked]:bg-primary mt-1"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-bold text-foreground">
                          Rights & licensing grant
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          I grant the song creator a royalty-free license to use
                          this layer in their official mix. This performance is
                          original or uses cleared samples.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-14 rounded-none text-base uppercase tracking-widest font-bold"
                disabled={
                  !objectPath ||
                  submitMutation.isPending ||
                  draftMutation.isPending ||
                  updateDraftMutation.isPending ||
                  isUploading
                }
              >
                {isEditing
                  ? updateDraftMutation.isPending
                    ? "Saving changes…"
                    : "Save changes"
                  : noActiveRound
                  ? draftMutation.isPending
                    ? "Saving draft…"
                    : "Save as draft"
                  : submitMutation.isPending
                  ? "Dropping…"
                  : "Drop this Note"}
                {!submitMutation.isPending &&
                  !draftMutation.isPending &&
                  !updateDraftMutation.isPending && (
                    <ArrowRight className="w-5 h-5 ml-2" />
                  )}
              </Button>
              {!isEditing && noActiveRound && (
                <p className="text-xs text-muted-foreground text-center">
                  No round is open right now — your Note is held as a draft and
                  shows up on your profile so you can submit it the moment
                  curators reopen the song.
                </p>
              )}
              {isEditing && (
                <p className="text-xs text-muted-foreground text-center">
                  Editing a saved draft — submit it from your profile when a
                  matching round is open.
                </p>
              )}
            </form>
          </Form>
        </Section>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border p-6 md:p-8">
      <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-sans">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
