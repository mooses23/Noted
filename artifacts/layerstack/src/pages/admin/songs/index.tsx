import { useState } from "react";
import { Link } from "wouter";
import { useAdminListSongs, useAdminCreateSong, getAdminListSongsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Plus, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const createSongSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Must be lowercase alphanumeric with hyphens"),
  creatorName: z.string().min(1, "Creator name is required"),
  genre: z.string().min(1, "Genre is required"),
  bpm: z.coerce.number().min(1).max(300),
  musicalKey: z.string().min(1, "Key is required"),
  timeSignature: z.string().default("4/4"),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
});

export default function AdminSongs() {
  const { data: songs, isLoading } = useAdminListSongs();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="container mx-auto px-6 py-12 max-w-6xl">
      <div className="mb-12 flex justify-between items-end">
        <div>
          <div className="text-xs uppercase tracking-widest text-primary mb-2">Admin</div>
          <h1 className="text-4xl font-serif font-bold tracking-tighter">Manage Songs</h1>
        </div>
        <CreateSongDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-card border border-border animate-pulse" />)}
        </div>
      ) : songs?.length ? (
        <div className="bg-card border border-border">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-background/50 text-xs uppercase tracking-widest text-muted-foreground font-bold">
            <div className="col-span-4">Title</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Genre</div>
            <div className="col-span-2">BPM/Key</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          <div className="divide-y divide-border">
            {songs.map(song => (
              <div key={song.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-background/50 transition-colors">
                <div className="col-span-4">
                  <div className="font-bold truncate">{song.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{song.slug}</div>
                </div>
                <div className="col-span-2">
                  <span className={`text-xs uppercase tracking-widest ${
                    song.status === 'active' ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {song.status}
                  </span>
                </div>
                <div className="col-span-2 text-sm text-muted-foreground truncate">{song.genre}</div>
                <div className="col-span-2 text-sm text-muted-foreground">{song.bpm} • {song.musicalKey}</div>
                <div className="col-span-2 text-right">
                  <Link href={`/admin/songs/${song.id}`}>
                    <Button variant="outline" size="sm" className="rounded-none text-xs uppercase tracking-widest">
                      <Settings2 className="w-3 h-3 mr-2" /> Manage
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center border border-border bg-card text-muted-foreground">
          No songs found. Create one to get started.
        </div>
      )}
    </div>
  );
}

function CreateSongDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useAdminCreateSong();

  const form = useForm<z.infer<typeof createSongSchema>>({
    resolver: zodResolver(createSongSchema),
    defaultValues: {
      title: "",
      slug: "",
      creatorName: "",
      genre: "",
      bpm: 120,
      musicalKey: "C Major",
      timeSignature: "4/4",
      description: "",
      status: "draft",
    },
  });

  const onSubmit = (values: z.infer<typeof createSongSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Song Created", description: "The new seed song has been created." });
        queryClient.invalidateQueries({ queryKey: getAdminListSongsQueryKey() });
        onOpenChange(false);
        form.reset();
      },
      onError: (err) => {
        toast({ title: "Creation Failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="rounded-none uppercase tracking-widest h-10 px-6"><Plus className="w-4 h-4 mr-2" /> New Song</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl border-border bg-card rounded-none p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b border-border bg-background">
          <DialogTitle className="font-serif text-2xl">Create New Seed Song</DialogTitle>
        </DialogHeader>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Title</FormLabel>
                    <FormControl><Input className="rounded-none bg-background border-border focus-visible:ring-primary" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                
                <FormField control={form.control} name="slug" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">URL Slug</FormLabel>
                    <FormControl><Input className="rounded-none bg-background border-border focus-visible:ring-primary" placeholder="my-song-name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="creatorName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Original Creator</FormLabel>
                    <FormControl><Input className="rounded-none bg-background border-border focus-visible:ring-primary" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="genre" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Genre</FormLabel>
                    <FormControl><Input className="rounded-none bg-background border-border focus-visible:ring-primary" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="musicalKey" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Musical Key</FormLabel>
                    <FormControl><Input className="rounded-none bg-background border-border focus-visible:ring-primary" placeholder="C Minor" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="bpm" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">BPM</FormLabel>
                    <FormControl><Input type="number" className="rounded-none bg-background border-border focus-visible:ring-primary" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="timeSignature" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Time Signature</FormLabel>
                    <FormControl><Input className="rounded-none bg-background border-border focus-visible:ring-primary" placeholder="4/4" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Initial Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-none bg-background border-border focus:ring-primary">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-none border-border bg-card">
                        <SelectItem value="draft" className="rounded-none focus:bg-primary focus:text-primary-foreground">Draft (Hidden)</SelectItem>
                        <SelectItem value="active" className="rounded-none focus:bg-primary focus:text-primary-foreground">Active (Public)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Description</FormLabel>
                    <FormControl><Textarea className="rounded-none bg-background border-border focus-visible:ring-primary" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              
              <div className="flex justify-end pt-6 border-t border-border mt-8">
                <Button type="submit" disabled={createMutation.isPending} className="rounded-none uppercase tracking-widest px-8">
                  {createMutation.isPending ? "Creating..." : "Create Song"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}