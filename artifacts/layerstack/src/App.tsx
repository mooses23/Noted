import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { setSentryUser } from "@/lib/sentry";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect, Link } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { NotificationsBell } from "@/components/notifications-bell";

import Home from "./pages/home";
import Songs from "./pages/songs";
import SongDetail from "./pages/songs/song";
import SongVersions from "./pages/songs/versions";
import SongStems from "./pages/songs/stems";
import SubmitCommit from "./pages/songs/submit";
import Commits from "./pages/commits";
import CommitDetail from "./pages/commits/commit";
import Credits from "./pages/credits";
import Licenses from "./pages/licenses";
import Manifesto from "./pages/manifesto";
import Rules from "./pages/rules";
import Rights from "./pages/rights";
import Privacy from "./pages/privacy";
import Terms from "./pages/terms";
import Profile from "./pages/profile";
import AdminDashboard from "./pages/admin";
import AdminSongs from "./pages/admin/songs";
import AdminSongDetail from "./pages/admin/songs/song";
import AdminCommentsModeration from "./pages/admin/comments";
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
  return (
    <div className="min-h-[100dvh] grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-12 border-r border-border bg-card">
        <div>
          <Link href="/" className="flex items-center gap-3 mb-12">
            <img src="/logo.svg" alt="Noted Logo" className="w-7 h-7" />
            <span className="font-serif font-bold text-2xl tracking-tighter">Noted</span>
          </Link>
          <h1 className="text-4xl font-serif font-bold tracking-tighter mb-6 leading-tight">
            Sign in to drop a&nbsp;Note.
          </h1>
          <p className="text-muted-foreground max-w-sm leading-relaxed">
            Sign in with Google to layer your sound onto a song-in-progress. We only
            ask for your name and email — never your contacts, never your activity.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>· No tracking pixels, no behavioural ads.</li>
          <li>· You can delete your Notes and account at any time.</li>
          <li>
            ·{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              Read our privacy promise
            </Link>
          </li>
        </ul>
      </div>
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
        <div className="mt-8 text-xs uppercase tracking-widest text-muted-foreground">
          Curator?{" "}
          <Link href="/admin/sign-in" className="text-primary hover:underline">
            Admin sign-in →
          </Link>
        </div>
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function AdminSignInPage() {
  const { data: user, isLoading } = useGetCurrentUser();
  const { isSignedIn, isLoaded } = useUser();

  if (isLoaded && isSignedIn && !isLoading) {
    if (user?.profile?.isAdmin) return <Redirect to="/admin" />;
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center bg-background">
        <h1 className="text-3xl font-serif font-bold mb-2">Not an admin account</h1>
        <p className="text-muted-foreground max-w-md mb-6">
          You're signed in as a contributor. Admin access is allowlisted —
          contact a curator if you believe this is wrong.
        </p>
        <Link href="/" className="text-primary hover:underline uppercase tracking-widest text-xs">
          Back to home →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary/40 bg-primary/5 text-primary text-[10px] uppercase tracking-widest mb-4">
          Curator access
        </div>
        <h1 className="text-3xl font-serif font-bold tracking-tighter">Admin sign-in</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          Restricted area. Use your allowlisted curator account.
        </p>
      </div>
      <SignIn routing="path" path={`${basePath}/admin/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={`${basePath}/admin`} />
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
      setSentryUser(
        user
          ? {
              id: user.id,
              email: user.primaryEmailAddress?.emailAddress ?? null,
            }
          : null,
      );
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
          <img src="/logo.svg" alt="Noted Logo" className="w-6 h-6" />
          <span className="font-serif font-bold text-xl tracking-tighter">Noted</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm uppercase tracking-widest text-muted-foreground font-medium">
          <Link href="/songs" className="hover:text-foreground transition-colors">Songs</Link>
          <Link href="/commits" className="hover:text-foreground transition-colors">Notes</Link>
          <Link href="/credits" className="hover:text-foreground transition-colors">Credits</Link>
          <Link href="/manifesto" className="hover:text-foreground transition-colors">About</Link>
        </nav>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Show when="signed-in">
            {user?.profile?.isAdmin && (
              <Link href="/admin" className="text-primary hover:text-primary/80 transition-colors uppercase tracking-widest text-xs mr-4">
                Admin
              </Link>
            )}
            <NotificationsBell />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground hidden sm:inline">{user?.profile?.displayName}</span>
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
              <img src="/logo.svg" alt="Noted Logo" className="w-5 h-5 opacity-50 grayscale" />
              <span className="font-serif text-lg tracking-tighter text-muted-foreground">Noted</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              The collaborative, human-made music platform. Songs grow structure-first, then take on their accents. No AI allowed.
            </p>
          </div>
          <div>
            <h4 className="font-serif text-lg mb-4 text-foreground">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/songs" className="hover:text-foreground transition-colors">Songs</Link></li>
              <li><Link href="/commits" className="hover:text-foreground transition-colors">Notes</Link></li>
              <li><Link href="/credits" className="hover:text-foreground transition-colors">Credits Wall</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-serif text-lg mb-4 text-foreground">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/manifesto" className="hover:text-foreground transition-colors">Manifesto</Link></li>
              <li><Link href="/rules" className="hover:text-foreground transition-colors">Rules</Link></li>
              <li><Link href="/rights" className="hover:text-foreground transition-colors">Rights & Licensing</Link></li>
              <li><Link href="/licenses" className="hover:text-foreground transition-colors">Third-Party Licenses</Link></li>
              <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);
  return null;
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
        <ScrollToTop />
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/admin/sign-in/*?" component={AdminSignInPage} />
            
            <Route path="/songs" component={Songs} />
            <Route path="/songs/:slug" component={SongDetail} />
            <Route path="/songs/:slug/versions" component={SongVersions} />
            <Route path="/songs/:slug/stems" component={SongStems} />
            <Route path="/songs/:slug/submit" component={SubmitCommit} />
            
            <Route path="/commits" component={Commits} />
            <Route path="/commits/:commitId" component={CommitDetail} />
            
            <Route path="/credits" component={Credits} />
            <Route path="/licenses" component={Licenses} />
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
            <Route path="/admin/comments">
              {(params) => <AdminRoute component={AdminCommentsModeration} params={params} />}
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
