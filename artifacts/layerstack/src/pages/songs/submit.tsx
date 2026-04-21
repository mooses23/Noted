import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useGetSongBySlug,
  useSubmitCommit,
  useGetCurrentUser,
} from "@workspace/api-client-react";
import { getGetSongBySlugQueryKey } from "@workspace/api-client-react";
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
  const { toast } = useToast();

  const { data: user, isLoading: isUserLoading } = useGetCurrentUser();
  const { data: song, isLoading: isSongLoading } = useGetSongBySlug(slug, {
    query: { enabled: !!slug, queryKey: getGetSongBySlugQueryKey(slug) },
  });

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [objectPath, setObjectPath] = useState<string | null>(null);
  const [overlayOffset, setOverlayOffset] = useState(0);

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      note: "",
      confirmedHumanMade: false,
      confirmedRightsGrant: false,
      displayNameOverride: "",
      socialHandle: "",
    },
  });

  useEffect(() => {
    if (
      audioFile &&
      !objectPath &&
      !isUploading &&
      song &&
      song.currentRound
    ) {
      uploadFile(audioFile, {
        purpose: "commit-audio",
        songId: song.id,
        roundId: song.currentRound.id,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioFile, objectPath, isUploading, song?.currentRound?.id]);

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
    }
    return layers;
  }, [baseLayer, audioFile, overlayOffset, form.watch("title")]);

  if (isSongLoading || isUserLoading)
    return (
      <div className="container mx-auto p-12 text-center text-muted-foreground">
        Loading studio...
      </div>
    );

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
    if (!song.currentRound) {
      toast({
        title: "No open round",
        description:
          "There's no open round on this song right now. Come back when curators open the next round.",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate(
      {
        data: {
          roundId: song.currentRound.id,
          instrumentType: song.currentRound.allowedInstrumentType,
          audioObjectPath: objectPath,
          overlayOffsetSeconds: overlayOffset,
          ...values,
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
          href={`/songs/${slug}`}
          className="text-muted-foreground hover:text-foreground text-xs uppercase tracking-widest mb-3 inline-flex items-center gap-2"
        >
          ← Back to {song.title}
        </Link>
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-2">
          Upload a Note
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
          {!audioFile ? (
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
        {audioFile && (
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
                disabled={!objectPath || submitMutation.isPending || noActiveRound}
                title={noActiveRound ? "No open round on this song right now." : ""}
              >
                {submitMutation.isPending
                  ? "Dropping…"
                  : noActiveRound
                  ? "No open round"
                  : "Drop this Note"}
                {!submitMutation.isPending && !noActiveRound && (
                  <ArrowRight className="w-5 h-5 ml-2" />
                )}
              </Button>
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
