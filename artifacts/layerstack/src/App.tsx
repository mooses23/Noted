import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect, Link } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetCurrentUser } from "@workspace/api-client-react";

import Home from "./pages/home";
import Songs from "./pages/songs";
import SongDetail from "./pages/songs/song";
import SongVersions from "./pages/songs/versions";
import SongStems from "./pages/songs/stems";
import SubmitCommit from "./pages/songs/submit";
import Commits from "./pages/commits";
import CommitDetail from "./pages/commits/commit";
import Credits from "./pages/credits";
import Manifesto from "./pages/manifesto";
import Rules from "./pages/rules";
import Rights from "./pages/rights";
import Privacy from "./pages/privacy";
import Terms from "./pages/terms";
import Profile from "./pages/profile";
import AdminDashboard from "./pages/admin";
import AdminSongs from "./pages/admin/songs";
import AdminSongDetail from "./pages/admin/songs/song";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(15 80% 55%)",
    colorBackground: "hsl(240 10% 6%)",
    colorInputBackground: "hsl(240 5% 15%)",
    colorText: "hsl(40 10% 95%)",
    colorTextSecondary: "hsl(240 5% 65%)",
    colorInputText: "hsl(40 10% 95%)",
    colorNeutral: "hsl(240 5% 65%)",
    borderRadius: "0",
    fontFamily: "'Geist', sans-serif",
    fontFamilyButtons: "'Geist', sans-serif",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: { color: "hsl(40 10% 95%)" },
    headerSubtitle: { color: "hsl(240 5% 65%)" },
    socialButtonsBlockButtonText: { color: "hsl(40 10% 95%)" },
    formFieldLabel: { color: "hsl(40 10% 95%)" },
    footerActionLink: { color: "hsl(15 80% 55%)" },
    footerActionText: { color: "hsl(240 5% 65%)" },
    dividerText: { color: "hsl(240 5% 65%)" },
  },
};

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

type AdminRouteProps = {
  component: React.ComponentType<{ params: Record<string, string | undefined> }>;
  params?: Record<string, string | undefined>;
};

function AdminRoute({ component: Component, params }: AdminRouteProps) {
  const { data: user, isLoading } = useGetCurrentUser();
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded || isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!isSignedIn || !user?.profile?.isAdmin) return <Redirect to="/" />;

  return <Component params={params ?? {}} />;
}

function Layout({ children }: { children: React.ReactNode }) {
  const { data: user } = useGetCurrentUser();
  const clerk = useClerk();
  
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans">
      <header className="border-b border-border py-4 px-6 md:px-12 flex items-center justify-between z-10 sticky top-0 bg-background/90 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.svg" alt="LayerStack Logo" className="w-6 h-6" />
          <span className="font-serif font-bold text-xl tracking-tighter">LayerStack</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm uppercase tracking-widest text-muted-foreground font-medium">
          <Link href="/songs" className="hover:text-foreground transition-colors">Songs</Link>
          <Link href="/commits" className="hover:text-foreground transition-colors">Commits</Link>
          <Link href="/credits" className="hover:text-foreground transition-colors">Credits</Link>
          <Link href="/manifesto" className="hover:text-foreground transition-colors">Manifesto</Link>
        </nav>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Show when="signed-in">
            {user?.profile?.isAdmin && (
              <Link href="/admin" className="text-primary hover:text-primary/80 transition-colors uppercase tracking-widest text-xs mr-4">
                Admin
              </Link>
            )}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{user?.profile?.displayName}</span>
              <button onClick={() => clerk.signOut()} className="text-xs uppercase tracking-widest hover:text-muted-foreground transition-colors">
                Sign Out
              </button>
            </div>
          </Show>
          <Show when="signed-out">
            <Link href="/sign-in" className="hover:text-muted-foreground transition-colors uppercase tracking-widest">Sign In</Link>
          </Show>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <footer className="border-t border-border py-12 px-6 md:px-12 mt-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src="/logo.svg" alt="LayerStack Logo" className="w-5 h-5 opacity-50 grayscale" />
              <span className="font-serif text-lg tracking-tighter text-muted-foreground">LayerStack</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              The collaborative, human-made music platform. We build songs together, one instrument layer at a time. No AI allowed.
            </p>
          </div>
          <div>
            <h4 className="font-serif text-lg mb-4 text-foreground">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/songs" className="hover:text-foreground transition-colors">Songs</Link></li>
              <li><Link href="/commits" className="hover:text-foreground transition-colors">Commits</Link></li>
              <li><Link href="/credits" className="hover:text-foreground transition-colors">Credits Wall</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif text-lg mb-4 text-foreground">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/manifesto" className="hover:text-foreground transition-colors">Manifesto</Link></li>
              <li><Link href="/rules" className="hover:text-foreground transition-colors">Rules</Link></li>
              <li><Link href="/rights" className="hover:text-foreground transition-colors">Rights & Licensing</Link></li>
              <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={{
        signIn: {
          start: {
            title: "Studio Access",
            subtitle: "Sign in to submit your layers",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            
            <Route path="/songs" component={Songs} />
            <Route path="/songs/:slug" component={SongDetail} />
            <Route path="/songs/:slug/versions" component={SongVersions} />
            <Route path="/songs/:slug/stems" component={SongStems} />
            <Route path="/songs/:slug/submit" component={SubmitCommit} />
            
            <Route path="/commits" component={Commits} />
            <Route path="/commits/:commitId" component={CommitDetail} />
            
            <Route path="/credits" component={Credits} />
            <Route path="/manifesto" component={Manifesto} />
            <Route path="/rules" component={Rules} />
            <Route path="/rights" component={Rights} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route path="/profile" component={Profile} />

            {/* Admin Routes */}
            <Route path="/admin">
              {(params) => <AdminRoute component={AdminDashboard} params={params} />}
            </Route>
            <Route path="/admin/songs">
              {(params) => <AdminRoute component={AdminSongs} params={params} />}
            </Route>
            <Route path="/admin/songs/:songId">
              {(params) => <AdminRoute component={AdminSongDetail} params={params} />}
            </Route>
            
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <TooltipProvider>
        <ClerkProviderWithRoutes />
        <Toaster />
      </TooltipProvider>
    </WouterRouter>
  );
}

export default App;
