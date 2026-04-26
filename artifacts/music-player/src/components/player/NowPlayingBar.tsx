import { usePlayer } from '@/hooks/use-player';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Repeat, Repeat1, Shuffle, ChevronUp, ListMusic
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function NowPlayingBar() {
  const player = usePlayer();
  const {
    currentTrack, isPlaying, coverUrl, togglePlayPause, nextTrack, prevTrack,
    currentTime, duration, seek, volume, setVolume, isMuted, toggleMute,
    repeatMode, toggleRepeat, isShuffle, toggleShuffle, setExpanded,
    isLoadingUrl,
  } = player;

  const formatTime = (time: number) => {
    if (isNaN(time) || time < 0) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 h-20 z-40 transition-transform duration-300",
      player.isExpanded ? "translate-y-full" : "translate-y-0"
    )}>
      <div className="absolute top-0 left-0 right-0 -mt-[2px] z-50 group">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={1}
          onValueChange={(v) => v[0] !== undefined && seek(v[0])}
          className="h-[3px] cursor-pointer"
        />
      </div>

      <div className="absolute inset-0 bg-background/85 backdrop-blur-2xl border-t border-border flex items-center px-4 md:px-6 justify-between gap-4">

        <div
          className="flex items-center gap-3 w-[30%] min-w-[120px] cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
          onClick={() => currentTrack && setExpanded(true)}
        >
          {currentTrack ? (
            <>
              <div className="relative w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0 shadow-sm ring-1 ring-black/5">
                {coverUrl ? (
                  <img src={coverUrl} alt={currentTrack.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary">
                    <ListMusic className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                {isLoadingUrl && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sm truncate text-foreground">{currentTrack.name}</span>
                <span className="text-xs text-muted-foreground truncate">{currentTrack.artist.join(', ')}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <Skeleton className="w-12 h-12 rounded-md" />
              <div className="flex flex-col gap-2 w-full">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center flex-1 max-w-[40%]">
          <div className="flex items-center gap-2 sm:gap-4 md:gap-5">
            <Button
              variant="ghost"
              size="icon"
              className={cn("hidden sm:flex h-8 w-8 text-muted-foreground hover:text-foreground", isShuffle && "text-primary hover:text-primary")}
              onClick={toggleShuffle}
              disabled={!currentTrack}
            >
              <Shuffle className="w-4 h-4" />
            </Button>

            <Button variant="ghost" size="icon" onClick={prevTrack} disabled={!currentTrack} className="h-9 w-9 text-foreground/80 hover:text-foreground">
              <SkipBack className="w-5 h-5 fill-current" />
            </Button>

            <Button
              onClick={togglePlayPause}
              disabled={!currentTrack || isLoadingUrl}
              className="w-10 h-10 rounded-full bg-foreground text-background hover:bg-foreground/90 hover:scale-105 transition-all shadow-md flex items-center justify-center p-0"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-[2px]" />}
            </Button>

            <Button variant="ghost" size="icon" onClick={nextTrack} disabled={!currentTrack} className="h-9 w-9 text-foreground/80 hover:text-foreground">
              <SkipForward className="w-5 h-5 fill-current" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={cn("hidden sm:flex h-8 w-8 text-muted-foreground hover:text-foreground", repeatMode !== 'off' && "text-primary hover:text-primary")}
              onClick={toggleRepeat}
              disabled={!currentTrack}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 w-[30%] min-w-[120px]">
          <span className="text-xs text-muted-foreground font-mono hidden md:inline-block w-10 text-right tabular-nums">
            {formatTime(currentTime)}
          </span>

          <div className="hidden md:flex items-center gap-2 w-24 lg:w-32 group">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={toggleMute}>
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume * 100]}
              max={100}
              step={1}
              onValueChange={(v) => v[0] !== undefined && setVolume(v[0] / 100)}
              className="h-1 cursor-pointer opacity-70 group-hover:opacity-100 transition-opacity"
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => currentTrack && setExpanded(true)}
            disabled={!currentTrack}
            className="text-muted-foreground hover:text-foreground ml-2 hidden sm:flex h-9 w-9"
            aria-label="展开"
          >
            <ChevronUp className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
