import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetSongBySlug, 
  useSubmitCommit,
  useGetCurrentUser
} from "@workspace/api-client-react";
import { getGetSongBySlugQueryKey } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { FileAudio, UploadCloud, CheckCircle2, ArrowRight } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(120),
  note: z.string().max(500).optional(),
  confirmedHumanMade: z.boolean().refine(val => val === true, "You must confirm this is human-made"),
  confirmedRightsGrant: z.boolean().refine(val => val === true, "You must agree to the rights grant"),
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
    query: { enabled: !!slug, queryKey: getGetSongBySlugQueryKey(slug) }
  });

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [objectPath, setObjectPath] = useState<string | null>(null);

  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (res) => {
      setObjectPath(res.objectPath);
      toast({ title: "Upload complete", description: "Audio file uploaded successfully." });
    },
    onError: (err) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
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
    if (audioFile && !objectPath && !isUploading && song?.currentRound) {
      uploadFile(audioFile, {
        purpose: "commit-audio",
        songId: song.id,
        roundId: song.currentRound.id,
      });
    }
  }, [audioFile, objectPath, isUploading, uploadFile]);

  if (isSongLoading || isUserLoading) return <div className="container mx-auto p-12 text-center text-muted-foreground">Loading studio...</div>;

  if (!user?.authenticated) {
    return (
      <div className="container mx-auto px-6 py-20 max-w-2xl text-center">
        <h1 className="text-4xl font-serif font-bold mb-6">Studio Access Required</h1>
        <p className="text-muted-foreground mb-8">You must be signed in to submit a layer to this track.</p>
        <Link href={`/sign-in?redirect=/songs/${slug}/submit`}>
          <Button className="rounded-none uppercase tracking-widest h-12 px-8">Sign In</Button>
        </Link>
      </div>
    );
  }

  if (!song || !song.currentRound) {
    return (
      <div className="container mx-auto px-6 py-20 max-w-2xl text-center">
        <h1 className="text-4xl font-serif font-bold mb-6">No Active Round</h1>
        <p className="text-muted-foreground mb-8">This song is not currently accepting submissions.</p>
        <Link href={`/songs/${slug}`}>
          <Button variant="outline" className="rounded-none uppercase tracking-widest h-12 px-8">Back to Song</Button>
        </Link>
      </div>
    );
  }

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!objectPath) {
      toast({ title: "Missing Audio", description: "Please wait for your audio file to finish uploading.", variant: "destructive" });
      return;
    }

    submitMutation.mutate({
      data: {
        roundId: song.currentRound!.id,
        instrumentType: song.currentRound!.allowedInstrumentType,
        audioObjectPath: objectPath,
        ...values
      }
    }, {
      onSuccess: (res) => {
        toast({ title: "Layer Submitted", description: "Your commit has been added to the round." });
        setLocation(`/commits/${res.id}`);
      },
      onError: (err) => {
        toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="container mx-auto px-6 py-12 max-w-3xl">
      <div className="mb-8">
        <Link href={`/songs/${slug}`} className="text-muted-foreground hover:text-foreground text-sm uppercase tracking-widest mb-4 inline-flex items-center gap-2">
          ← Back to {song.title}
        </Link>
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tighter mb-2">
          {song.currentRound.kind === "accent" ? "Submit Accent" : "Submit Layer"}
        </h1>
        <div className="text-lg text-primary mb-2">
          Round {song.currentRound.roundNumber}: {song.currentRound.allowedInstrumentType}
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {song.currentRound.kind === "accent"
            ? "Accent rounds are about signature sonic moments — a clap, a one-shot, a punctuation that becomes the song's fingerprint."
            : "Structure rounds shape the foundation of the song — drums, bass, harmony, melody."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-12">
        <section className="bg-card border border-border p-6 md:p-8">
          <h2 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-sans">1</span>
            Upload Audio
          </h2>
          
          {!audioFile ? (
            <div className="border-2 border-dashed border-border p-12 text-center relative hover:border-primary/50 transition-colors">
              <input 
                type="file" 
                accept="audio/*,.wav,.flac,.aiff,.aif,.mp3,.m4a,.ogg,.opus,.aac,.wma" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 60 * 1024 * 1024) {
                    toast({ title: "File too large", description: `Max 60 MB. Yours is ${(file.size / (1024*1024)).toFixed(1)} MB.`, variant: "destructive" });
                    return;
                  }
                  setAudioFile(file);
                }}
              />
              <UploadCloud className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
              <div className="font-bold mb-1">Click or drag audio file here</div>
              <div className="text-sm text-muted-foreground">WAV, FLAC, AIFF, MP3, M4A, OGG, AAC (Max 60 MB)</div>
            </div>
          ) : (
            <div className="border border-border p-4 bg-background flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <FileAudio className="w-6 h-6 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{audioFile.name}</div>
                  <div className="text-xs text-muted-foreground">{(audioFile.size / (1024 * 1024)).toFixed(2)} MB</div>
                </div>
                {objectPath ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => { setAudioFile(null); setObjectPath(null); }} disabled={isUploading}>
                    Cancel
                  </Button>
                )}
              </div>
              
              {isUploading && (
                <div className="w-full bg-secondary h-1">
                  <div className="bg-primary h-1 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          )}
        </section>

        <section className="bg-card border border-border p-6 md:p-8">
          <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-sans">2</span>
            Commit Details
          </h2>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Commit Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Vintage P-Bass with flatwounds" className="h-12 rounded-none bg-background border-border focus-visible:ring-primary" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="uppercase tracking-widest text-xs text-muted-foreground">Notes for the Curator (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Gear used, intent, mixing suggestions..." className="min-h-[100px] rounded-none bg-background border-border focus-visible:ring-primary" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 pt-6 border-t border-border">
                <h3 className="font-serif font-bold text-lg mb-4 text-primary">Required Attestations</h3>
                
                <FormField
                  control={form.control}
                  name="confirmedHumanMade"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border border-primary/30 bg-primary/5">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-primary/50 data-[state=checked]:bg-primary mt-1" />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-bold text-foreground">Strictly Human-Made Guarantee</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          I attest that no generative AI tools were used in the creation of this musical performance. I understand that violating this policy will result in a permanent ban.
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
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-none border-border data-[state=checked]:bg-primary mt-1" />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-bold text-foreground">Rights & Licensing Grant</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          I grant the seed song creator a royalty-free license to use this layer in their official master recording. This performance is original or uses cleared samples.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-14 rounded-none text-base uppercase tracking-widest font-bold"
                disabled={!objectPath || submitMutation.isPending}
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Commit"}
                {!submitMutation.isPending && <ArrowRight className="w-5 h-5 ml-2" />}
              </Button>
            </form>
          </Form>
        </section>
      </div>
    </div>
  );
}