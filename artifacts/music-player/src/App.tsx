import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import { PlayerProvider } from "@/hooks/use-player";
import { ExpandedPlayer } from "@/components/player/ExpandedPlayer";
import { NowPlayingBar } from "@/components/player/NowPlayingBar";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  }
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <PlayerProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <div className="relative min-h-screen flex flex-col w-full max-w-[100vw] overflow-hidden bg-background text-foreground">
                <main className="flex-1 flex flex-col relative z-0 h-[calc(100vh-80px)]">
                  <Router />
                </main>
                
                {/* Fixed bottom bar */}
                <NowPlayingBar />
                
                {/* Full screen overlay player */}
                <ExpandedPlayer />
              </div>
            </WouterRouter>
            <Toaster />
            <SonnerToaster theme="system" />
          </PlayerProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
