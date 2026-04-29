import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Track, getTrackUrl, getTrackPic, getLyrics, LyricLine } from "@/lib/api";
import { toast } from "sonner";

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  repeatMode: "off" | "one" | "all";
  isShuffle: boolean;
  isExpanded: boolean;
  lyrics: LyricLine[];
  hasLyrics: boolean;
  coverUrl: string | null;
  isLoadingUrl: boolean;
  
  // Actions
  playTrack: (track: Track, queue: Track[]) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setExpanded: (expanded: boolean) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  playFromQueue: (index: number) => void;
  clearQueue: () => void;
  recentTracks: Track[];
}

const PlayerContext = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(() => {
    const saved = localStorage.getItem("echo-volume");
    return saved ? parseFloat(saved) : 0.8;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState<"off" | "one" | "all">("off");
  const [isShuffle, setIsShuffle] = useState(false);
  const [isExpanded, setExpanded] = useState(false);
  
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [hasLyrics, setHasLyrics] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [recentTracks, setRecentTracks] = useState<Track[]>(() => {
    const saved = localStorage.getItem("echo-recent");
    return saved ? JSON.parse(saved) : [];
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => handleTrackEnd();
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = (e: Event) => {
      console.error("Audio error:", e);
      setIsPlaying(false);
      setIsLoadingUrl(false);
    };
    const handleWaiting = () => setIsLoadingUrl(true);
    const handleCanPlay = () => setIsLoadingUrl(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("playing", handleCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("playing", handleCanPlay);
      audio.pause();
    };
  }, []); // Empty deps, handleTrackEnd uses refs or useCallback if needed
  
  // We need to make handleTrackEnd accessible to the audio ended listener
  // Since it depends on state, we use a ref to the latest function
  const handleTrackEndRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const loadReqIdRef = useRef(0);

  const loadTrackResources = async (track: Track) => {
    const reqId = ++loadReqIdRef.current;
    setIsLoadingUrl(true);
    setLyrics([]);
    setHasLyrics(false);
    setCoverUrl(null);
    setCurrentTime(0);
    setDuration(0);

    try {
      const urlResultP = getTrackUrl(track.id, track.source).catch(() => ({ url: null }));
      const picUrlP = getTrackPic(track.pic_id, track.source).catch(() => null);
      const lyricDataP = getLyrics(track.lyric_id, track.source).catch(() => ({ lines: [], hasLyrics: false }));

      const [urlResult, picUrl, lyricData] = await Promise.all([urlResultP, picUrlP, lyricDataP]);

      // If a newer request started while we were waiting, abandon this one.
      if (reqId !== loadReqIdRef.current) return false;

      const url = (urlResult as { url: string | null }).url;

      if (!url) {
        toast.error(`找不到 "${track.name}" 的播放地址,可能版权下架,或 API 限流了(5 分钟内 50 次)`);
        setIsLoadingUrl(false);
        setIsPlaying(false);
        return false;
      }

      setCoverUrl(picUrl);
      setLyrics(lyricData.lines);
      setHasLyrics(lyricData.hasLyrics);

      if (audioRef.current) {
        audioRef.current.src = url;
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (e) {
          // Autoplay may be blocked on first interaction — that's OK,
          // user can hit play. Don't keep the spinner up.
          console.warn("Autoplay prevented:", e);
          setIsPlaying(false);
        }
      }

      // Update recent tracks
      setRecentTracks(prev => {
        const filtered = prev.filter(t => !(t.id === track.id && t.source === track.source));
        const next = [track, ...filtered].slice(0, 20);
        localStorage.setItem("echo-recent", JSON.stringify(next));
        return next;
      });

      setIsLoadingUrl(false);
      return true;
    } catch (error) {
      console.error(error);
      if (reqId === loadReqIdRef.current) {
        toast.error(`无法加载 ${track.name}`);
        setIsLoadingUrl(false);
        setIsPlaying(false);
      }
      return false;
    }
  };

  const playTrack = useCallback((track: Track, newQueue: Track[] = []) => {
    setCurrentTrack(track);
    if (newQueue.length > 0) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.id === track.id);
      setQueueIndex(idx >= 0 ? idx : 0);
    }
    loadTrackResources(track);
  }, []);

  const playFromQueue = useCallback((index: number) => {
    if (index >= 0 && index < queue.length) {
      setQueueIndex(index);
      setCurrentTrack(queue[index]);
      loadTrackResources(queue[index]);
    }
  }, [queue]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error(e));
    }
  }, [isPlaying, currentTrack]);

  const getNextIndex = useCallback(() => {
    if (queue.length === 0) return -1;
    if (isShuffle) {
      let nextIdx = Math.floor(Math.random() * queue.length);
      if (nextIdx === queueIndex && queue.length > 1) {
        nextIdx = (nextIdx + 1) % queue.length;
      }
      return nextIdx;
    }
    return (queueIndex + 1) % queue.length;
  }, [queue, queueIndex, isShuffle]);

  const getPrevIndex = useCallback(() => {
    if (queue.length === 0) return -1;
    if (currentTime > 3) {
      return queueIndex; // Just restart song
    }
    if (isShuffle) {
      return Math.floor(Math.random() * queue.length);
    }
    return queueIndex - 1 < 0 ? queue.length - 1 : queueIndex - 1;
  }, [queue, queueIndex, isShuffle, currentTime]);

  const nextTrack = useCallback(() => {
    const idx = getNextIndex();
    if (idx !== -1) playFromQueue(idx);
  }, [getNextIndex, playFromQueue]);

  const prevTrack = useCallback(() => {
    const idx = getPrevIndex();
    if (idx !== -1 && idx !== queueIndex) {
      playFromQueue(idx);
    } else if (idx === queueIndex && audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, [getPrevIndex, queueIndex, playFromQueue]);

  const handleTrackEnd = useCallback(() => {
    if (repeatMode === "one" && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error(e));
    } else if (repeatMode === "all" || queueIndex < queue.length - 1 || isShuffle) {
      nextTrack();
    } else {
      setIsPlaying(false);
    }
  }, [repeatMode, queueIndex, queue.length, isShuffle, nextTrack]);

  handleTrackEndRef.current = handleTrackEnd;

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const v = Math.max(0, Math.min(1, vol));
    setVolumeState(v);
    localStorage.setItem("echo-volume", v.toString());
    if (v > 0 && isMuted) setIsMuted(false);
  }, [isMuted]);

  const toggleMute = useCallback(() => setIsMuted(m => !m), []);
  
  const toggleRepeat = useCallback(() => {
    setRepeatMode(r => {
      if (r === "off") return "all";
      if (r === "all") return "one";
      return "off";
    });
  }, []);

  const toggleShuffle = useCallback(() => setIsShuffle(s => !s), []);

  const addToQueue = useCallback((track: Track) => {
    setQueue(q => [...q, track]);
    toast.success(`Added ${track.name} to queue`);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue(q => {
      const newQ = [...q];
      newQ.splice(index, 1);
      return newQ;
    });
    if (index < queueIndex) {
      setQueueIndex(i => i - 1);
    } else if (index === queueIndex) {
      // Current track removed
      if (queue.length > 1) {
        nextTrack();
      } else {
        setCurrentTrack(null);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
        }
        setIsPlaying(false);
      }
    }
  }, [queueIndex, nextTrack, queue.length]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueueIndex(-1);
    setCurrentTrack(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setIsPlaying(false);
  }, []);

  const value: PlayerState = {
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    duration,
    repeatMode,
    isShuffle,
    isExpanded,
    lyrics,
    hasLyrics,
    coverUrl,
    isLoadingUrl,
    playTrack,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    setExpanded,
    addToQueue,
    removeFromQueue,
    playFromQueue,
    clearQueue,
    recentTracks
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
}
