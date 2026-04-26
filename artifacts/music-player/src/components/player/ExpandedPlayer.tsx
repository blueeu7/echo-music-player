import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/hooks/use-player';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Play, Pause, SkipBack, SkipForward,
  Repeat, Repeat1, Shuffle, Volume2, VolumeX, ListMusic, Mic2, Disc3,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type View = "cover" | "lyrics" | "both";

export function ExpandedPlayer() {
  const player = usePlayer();
  const {
    currentTrack, isExpanded, setExpanded, coverUrl, isPlaying,
    lyrics, hasLyrics, currentTime, duration, seek,
    togglePlayPause, nextTrack, prevTrack,
    isShuffle, toggleShuffle, repeatMode, toggleRepeat,
    volume, setVolume, isMuted, toggleMute,
  } = player;

  const lyricsRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("both");

  // On wide screens default to "both"; on narrow screens default to "cover"
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isWide = window.matchMedia('(min-width: 1024px)').matches;
      setView(isWide ? "both" : "cover");
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!lyricsRef.current || !hasLyrics || lyrics.length === 0) return;
    const activeIdx = lyrics.findIndex((line, idx) => {
      const nextLine = lyrics[idx + 1];
      return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
    });
    if (activeIdx !== -1) {
      const container = lyricsRef.current;
      const activeEl = container.children[activeIdx] as HTMLElement;
      if (activeEl) {
        const containerHeight = container.clientHeight;
        const offset = activeEl.offsetTop - (containerHeight / 2) + (activeEl.clientHeight / 2);
        container.scrollTo({ top: offset, behavior: 'smooth' });
      }
    }
  }, [currentTime, lyrics, hasLyrics, view]);

  const formatTime = (time: number) => {
    if (isNaN(time) || time < 0) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Layout helpers
  const showCover = view === "cover" || view === "both";
  const showLyrics = view === "lyrics" || view === "both";

  return (
    <AnimatePresence>
      {isExpanded && currentTrack && (
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-50 text-foreground flex flex-col overflow-hidden bg-background"
        >
          {coverUrl && (
            <>
              <div
                className="absolute inset-0 z-0 pointer-events-none scale-150 blur-[120px] saturate-[1.6] opacity-80 dark:opacity-50 transition-all duration-1000"
                style={{ backgroundImage: `url(${coverUrl})`, backgroundPosition: 'center', backgroundSize: 'cover' }}
              />
              <div className="absolute inset-0 z-0 pointer-events-none bg-background/30 dark:bg-background/50" />
            </>
          )}

          <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5">
            <Button variant="ghost" size="icon" onClick={() => setExpanded(false)} className="rounded-full hover:bg-foreground/10 dark:hover:bg-white/10">
              <ChevronDown className="w-6 h-6" />
            </Button>

            {/* View toggle */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-foreground/[0.06] dark:bg-white/[0.06] backdrop-blur">
              <button
                onClick={() => setView("cover")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5",
                  view === "cover" ? "bg-background shadow-sm" : "text-foreground/60 hover:text-foreground",
                )}
              >
                <Disc3 className="w-3.5 h-3.5" />
                封面
              </button>
              <button
                onClick={() => setView("lyrics")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5",
                  view === "lyrics" ? "bg-background shadow-sm" : "text-foreground/60 hover:text-foreground",
                )}
              >
                <Mic2 className="w-3.5 h-3.5" />
                歌词
              </button>
              <button
                onClick={() => setView("both")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition-all hidden lg:inline-flex items-center gap-1.5",
                  view === "both" ? "bg-background shadow-sm" : "text-foreground/60 hover:text-foreground",
                )}
              >
                双视图
              </button>
            </div>

            <div className="w-10" />
          </header>

          <div
            className={cn(
              "relative z-10 flex-1 flex items-stretch justify-center min-h-0 px-4 sm:px-6 lg:px-20 pb-4",
              view === "both" ? "flex-col lg:flex-row gap-6 lg:gap-16" : "flex-col gap-6",
            )}
          >
            {/* COVER PANEL */}
            {showCover && (
              <div
                className={cn(
                  "flex flex-col items-center justify-center min-h-0 shrink-0",
                  view === "both" ? "flex-1 max-w-md w-full" : "flex-1 w-full",
                )}
              >
                <div
                  className={cn(
                    "relative shrink-0 rounded-2xl overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] mb-5",
                    view === "cover"
                      ? "w-[min(75vw,420px)] h-[min(75vw,420px)]"
                      : "w-56 h-56 sm:w-72 sm:h-72 lg:w-[360px] lg:h-[360px]",
                  )}
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={currentTrack.name}
                      className={cn(
                        "w-full h-full object-cover transition-transform duration-700 ease-out",
                        isPlaying ? "scale-100" : "scale-95",
                      )}
                    />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center">
                      <ListMusic className="w-24 h-24 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                <div className="text-center w-full px-4">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight mb-1 line-clamp-2 text-balance leading-tight">
                    {currentTrack.name}
                  </h1>
                  <p className="text-sm sm:text-base lg:text-lg text-foreground/70 line-clamp-1 font-medium">
                    {currentTrack.artist.join(', ')}
                    {currentTrack.album && (
                      <span className="text-foreground/50"> — {currentTrack.album}</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* LYRICS PANEL */}
            {showLyrics && (
              <div
                className={cn(
                  "w-full flex flex-col min-h-0 relative",
                  view === "both" ? "flex-1 max-w-2xl hidden lg:flex" : "flex-1",
                )}
              >
                <div
                  ref={lyricsRef}
                  className="flex-1 overflow-y-auto pr-2 sm:pr-4 pb-32 pt-16 sm:pt-24 space-y-5 sm:space-y-7"
                  style={{
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)',
                    maskImage: 'linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)',
                  }}
                >
                  {hasLyrics && lyrics.length > 0 ? (
                    lyrics.map((line, idx) => {
                      const isActive = currentTime >= line.time && (!lyrics[idx + 1] || currentTime < lyrics[idx + 1].time);
                      return (
                        <div
                          key={idx}
                          onClick={() => seek(line.time)}
                          className={cn(
                            "transition-all duration-500 cursor-pointer",
                            isActive ? "opacity-100 scale-[1.02] translate-x-1" : "opacity-30 hover:opacity-60",
                          )}
                        >
                          <p
                            className={cn(
                              "text-xl sm:text-2xl md:text-3xl lg:text-[34px] leading-[1.35]",
                              isActive ? "font-bold text-foreground" : "font-semibold text-foreground/90",
                            )}
                          >
                            {line.text || " "}
                          </p>
                          {line.translation && (
                            <p className={cn(
                              "text-sm sm:text-base md:text-lg mt-1.5",
                              isActive ? "text-foreground/70 font-medium" : "text-foreground/50",
                            )}>
                              {line.translation}
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-foreground/50 gap-4 pt-16">
                      <ListMusic className="w-12 h-12 opacity-50" />
                      <p className="text-lg font-medium tracking-wide">纯音乐 · 没有歌词</p>
                    </div>
                  )}
                </div>

                {/* Track title above lyrics in lyrics-only view, since cover is hidden */}
                {view === "lyrics" && (
                  <div className="absolute top-0 left-0 right-0 text-center px-4 py-3 bg-gradient-to-b from-background/80 to-transparent pointer-events-none">
                    <div className="text-sm font-bold truncate">{currentTrack.name}</div>
                    <div className="text-xs text-foreground/60 truncate">{currentTrack.artist.join(', ')}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 pb-8 sm:pb-10 pt-2 flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-foreground/60 w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.1}
                onValueChange={(v) => v[0] !== undefined && seek(v[0])}
                className="flex-1 cursor-pointer"
              />
              <span className="text-xs font-mono text-foreground/60 w-10 tabular-nums">-{formatTime(Math.max(0, (duration || 0) - currentTime))}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 w-[100px]">
                <Button variant="ghost" size="icon" onClick={toggleShuffle} className={cn("hover:bg-foreground/10 dark:hover:bg-white/10 h-9 w-9", isShuffle && "text-primary")}>
                  <Shuffle className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleRepeat} className={cn("hover:bg-foreground/10 dark:hover:bg-white/10 h-9 w-9", repeatMode !== 'off' && "text-primary")}>
                  {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </Button>
              </div>

              <div className="flex items-center gap-3 sm:gap-4">
                <Button variant="ghost" size="icon" onClick={prevTrack} className="w-10 h-10 sm:w-11 sm:h-11 rounded-full hover:bg-foreground/10 dark:hover:bg-white/10">
                  <SkipBack className="w-5 h-5 fill-current" />
                </Button>
                <Button
                  onClick={togglePlayPause}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-foreground text-background hover:bg-foreground/90 hover:scale-105 transition-all shadow-lg flex items-center justify-center"
                >
                  {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-[2px]" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={nextTrack} className="w-10 h-10 sm:w-11 sm:h-11 rounded-full hover:bg-foreground/10 dark:hover:bg-white/10">
                  <SkipForward className="w-5 h-5 fill-current" />
                </Button>
              </div>

              <div className="flex items-center gap-2 w-[100px] justify-end group">
                <Button variant="ghost" size="icon" onClick={toggleMute} className="hover:bg-foreground/10 dark:hover:bg-white/10 w-9 h-9 shrink-0">
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-foreground/70" /> : <Volume2 className="w-4 h-4 text-foreground/70" />}
                </Button>
                <div className="w-16 hidden sm:block opacity-60 group-hover:opacity-100 transition-opacity">
                  <Slider
                    value={[isMuted ? 0 : volume * 100]}
                    max={100}
                    step={1}
                    onValueChange={(v) => v[0] !== undefined && setVolume(v[0] / 100)}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
