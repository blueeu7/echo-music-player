import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Music2,
  Loader2,
  Clock,
  Moon,
  Sun,
  Download,
  CheckSquare,
  Square,
  X,
  CheckCheck,
  Sparkles,
  ListPlus,
} from "lucide-react";
import { ImportDialog } from "@/components/ImportDialog";
import { useTheme } from "next-themes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  searchTracks,
  searchAllSources,
  downloadTrack,
  type Track,
  type SourceOrAll,
} from "@/lib/api";
import { useDebounce } from "@/hooks/use-debounce";
import { usePlayer } from "@/hooks/use-player";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tile = { label: string; query: string; gradient: string };

const TILES: Tile[] = [
  { label: "周杰伦", query: "周杰伦", gradient: "from-indigo-500 via-violet-500 to-fuchsia-500" },
  { label: "Taylor Swift", query: "Taylor Swift", gradient: "from-rose-400 via-pink-400 to-amber-300" },
  { label: "Radiohead", query: "Radiohead", gradient: "from-slate-700 via-slate-500 to-zinc-400" },
  { label: "宇多田ヒカル", query: "宇多田ヒカル", gradient: "from-sky-400 via-cyan-400 to-emerald-300" },
  { label: "陈奕迅", query: "陈奕迅", gradient: "from-amber-500 via-orange-500 to-red-500" },
  { label: "Daft Punk", query: "Daft Punk", gradient: "from-yellow-400 via-amber-500 to-orange-600" },
  { label: "Lorde", query: "Lorde", gradient: "from-violet-600 via-purple-500 to-blue-600" },
  { label: "Frank Ocean", query: "Frank Ocean", gradient: "from-orange-400 via-orange-300 to-amber-200" },
];

const SOURCES: { value: SourceOrAll; label: string }[] = [
  { value: "all", label: "全部音源" },
  { value: "netease", label: "网易云" },
  { value: "tencent", label: "QQ 音乐" },
  { value: "kuwo", label: "酷我" },
  { value: "joox", label: "JOOX" },
  { value: "bilibili", label: "Bilibili" },
  { value: "migu", label: "咪咕" },
  { value: "kugou", label: "酷狗" },
];

const SOURCE_LABEL: Record<string, string> = {
  netease: "网易",
  tencent: "QQ",
  kuwo: "酷我",
  joox: "JOOX",
  bilibili: "B站",
  migu: "咪咕",
  kugou: "酷狗",
};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-full"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("brand-wordmark", className)}>
      <div className="text-foreground">echo</div>
      <div className="text-muted-foreground/80 text-[0.5em] font-medium tracking-tight mt-0.5">
        blue的音乐播放器
      </div>
    </div>
  );
}

const trackKey = (t: Track) => `${t.source}::${t.id}`;

function ResultRow({
  track,
  index,
  onPlay,
  onDownload,
  onToggleSelect,
  selectMode,
  selected,
  isCurrent,
  isPlaying,
  downloading,
}: {
  track: Track;
  index: number;
  onPlay: () => void;
  onDownload: () => void;
  onToggleSelect: () => void;
  selectMode: boolean;
  selected: boolean;
  isCurrent: boolean;
  isPlaying: boolean;
  downloading: boolean;
}) {
  const artistText = Array.isArray(track.artist) ? track.artist.join(", ") : String(track.artist ?? "");
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.015, 0.3), duration: 0.22 }}
      className={cn(
        "group w-full flex items-center gap-3 px-3 py-3.5 rounded-lg transition-colors",
        "hover:bg-foreground/[0.04] dark:hover:bg-white/[0.04]",
        isCurrent && "bg-primary/[0.08]",
        selected && "bg-primary/[0.10] hover:bg-primary/[0.14]",
      )}
    >
      {selectMode ? (
        <div
          role="button"
          tabIndex={0}
          onClick={onToggleSelect}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggleSelect()}
          className="w-9 flex items-center justify-center shrink-0 cursor-pointer"
          aria-label={selected ? "取消选中" : "选中"}
        >
          <Checkbox checked={selected} className="pointer-events-none" />
        </div>
      ) : (
        <button
          onClick={onPlay}
          className="w-9 flex items-center justify-center text-sm font-mono text-muted-foreground shrink-0"
        >
          {isCurrent && isPlaying ? (
            <div className="flex items-end gap-[2px] h-4">
              <span className="w-[3px] bg-primary rounded-full animate-eq-1" />
              <span className="w-[3px] bg-primary rounded-full animate-eq-2" />
              <span className="w-[3px] bg-primary rounded-full animate-eq-3" />
            </div>
          ) : (
            <>
              <span className="group-hover:hidden tabular-nums">{(index + 1).toString().padStart(2, "0")}</span>
              <span className="hidden group-hover:inline-block">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-foreground">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </>
          )}
        </button>
      )}

      <button onClick={selectMode ? onToggleSelect : onPlay} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("truncate font-semibold text-[15px]", isCurrent && "text-primary")}>
            {track.name}
          </span>
          <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground/80 font-semibold">
            {SOURCE_LABEL[track.source] ?? track.source}
          </span>
        </div>
        <div className="truncate text-xs text-muted-foreground mt-1">{artistText}</div>
      </button>

      <div className="hidden sm:block text-xs text-muted-foreground/60 truncate max-w-[180px]">
        {track.album}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onDownload();
        }}
        disabled={downloading}
        className="h-9 w-9 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-label="下载"
      >
        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      </Button>
    </motion.div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-3.5">
      <Skeleton className="w-6 h-6 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-3 w-24 hidden sm:block" />
    </div>
  );
}

function HeroTile({ tile, onClick }: { tile: Tile; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "relative aspect-square rounded-xl overflow-hidden text-left p-4",
        "shadow-sm hover:shadow-md transition-shadow",
        "bg-gradient-to-br",
        tile.gradient,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      <div className="absolute bottom-3 left-3 right-3 z-10">
        <div className="text-white font-bold text-sm leading-tight drop-shadow-md">{tile.label}</div>
        <div className="text-white/80 text-[10px] uppercase tracking-wider mt-1 font-semibold">搜索</div>
      </div>
      <Sparkles className="absolute top-3 right-3 w-3.5 h-3.5 text-white/70" />
    </motion.button>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceOrAll>("all");
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [downloadingKeys, setDownloadingKeys] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const debounced = useDebounce(query, 450);
  const { playTrack, currentTrack, isPlaying, recentTracks } = usePlayer();
  const reqIdRef = useRef(0);

  useEffect(() => {
    const term = debounced.trim();
    if (!term) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      return;
    }
    const myReq = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    setHasSearched(true);

    const promise =
      source === "all"
        ? searchAllSources(term)
        : searchTracks(term, source, 50, 1);

    promise
      .then((data) => {
        if (myReq !== reqIdRef.current) return;
        setResults(data);
      })
      .catch((err) => {
        if (myReq !== reqIdRef.current) return;
        console.error(err);
        setError("搜索失败,可能触发了 API 频率限制(5 分钟内 50 次),稍等再试");
        toast.error("搜索失败,稍等再试");
        setResults([]);
      })
      .finally(() => {
        if (myReq === reqIdRef.current) setLoading(false);
      });
  }, [debounced, source]);

  useEffect(() => setSelectedKeys(new Set()), [results]);

  const handlePlay = (track: Track) => {
    playTrack(track, results.length > 0 ? results : [track]);
  };

  const handleSingleDownload = async (track: Track) => {
    const k = trackKey(track);
    if (downloadingKeys.has(k)) return;
    setDownloadingKeys((prev) => new Set(prev).add(k));
    try {
      const realDownload = await downloadTrack(track);
      if (realDownload) toast.success(`已下载: ${track.name}`);
      else
        toast.message("已在新标签页打开", {
          description: "音频源不允许直接下载,请在新标签页右键另存为",
        });
    } catch (e) {
      console.error(e);
      toast.error(`下载失败: ${track.name}`);
    } finally {
      setDownloadingKeys((prev) => {
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    }
  };

  const toggleSelect = (track: Track) => {
    const k = trackKey(track);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const selectAll = () => setSelectedKeys(new Set(results.map(trackKey)));
  const clearSelection = () => setSelectedKeys(new Set());
  const exitSelectMode = () => {
    setSelectMode(false);
    clearSelection();
  };

  const handleBulkDownload = async () => {
    const targets = results.filter((t) => selectedKeys.has(trackKey(t)));
    if (targets.length === 0) {
      toast.message("还没选中歌曲");
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    let fallback = 0;
    let fail = 0;
    const id = toast.loading(`准备下载 ${targets.length} 首...`);

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const k = trackKey(t);
      setDownloadingKeys((prev) => new Set(prev).add(k));
      toast.loading(`下载中 ${i + 1}/${targets.length} · ${t.name}`, { id });
      try {
        const real = await downloadTrack(t);
        if (real) ok++;
        else fallback++;
      } catch (e) {
        console.error(e);
        fail++;
      } finally {
        setDownloadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(k);
          return next;
        });
      }
      await new Promise((r) => setTimeout(r, 350));
    }

    const summary = [
      ok ? `已下载 ${ok}` : "",
      fallback ? `${fallback} 首在新标签页打开` : "",
      fail ? `${fail} 首失败` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    if (fail > 0 && ok === 0 && fallback === 0) toast.error("批量下载失败", { id });
    else toast.success(summary || "完成", { id });
    setBulkBusy(false);
  };

  const headerArtist = useMemo(
    () =>
      currentTrack
        ? Array.isArray(currentTrack.artist)
          ? currentTrack.artist.join(", ")
          : String(currentTrack.artist)
        : "",
    [currentTrack],
  );

  const allSelected = results.length > 0 && selectedKeys.size === results.length;

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(900px 600px at 8% -10%, hsl(var(--primary) / 0.10), transparent 55%), radial-gradient(700px 500px at 100% 10%, hsl(var(--accent) / 0.08), transparent 60%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 pt-7 pb-4">
        <BrandMark className="text-2xl" />
        <div className="flex items-center gap-2">
          {currentTrack && (
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground mr-2 max-w-[280px]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              <span className="truncate">
                <span className="text-foreground/80 font-medium">{currentTrack.name}</span>
                <span className="opacity-60"> · {headerArtist}</span>
              </span>
            </div>
          )}
          <ImportDialog
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5 h-9 hidden sm:inline-flex"
              >
                <ListPlus className="w-4 h-4" />
                导入歌单
              </Button>
            }
          />
          <ImportDialog
            trigger={
              <Button
                variant="outline"
                size="icon"
                className="rounded-full sm:hidden h-9 w-9"
                aria-label="导入歌单"
              >
                <ListPlus className="w-4 h-4" />
              </Button>
            }
          />
          <ThemeToggle />
        </div>
      </header>

      <div className="relative z-10 px-6 md:px-10 pb-6 pt-2">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索歌曲、歌手、专辑..."
              className="h-13 py-3.5 pl-12 pr-40 text-base rounded-full bg-card border-border shadow-sm focus-visible:ring-primary/40"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
              <Select value={source} onValueChange={(v) => setSource(v as SourceOrAll)}>
                <SelectTrigger className="h-10 w-36 rounded-full border-border bg-background/50 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-sm">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="relative z-10 flex-1 px-2 md:px-6 pb-32">
        <div className="max-w-5xl mx-auto pb-12">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-1 max-w-3xl mx-auto"
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20 text-muted-foreground"
              >
                <p className="text-sm max-w-md mx-auto">{error}</p>
              </motion.div>
            ) : hasSearched && results.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20 text-muted-foreground"
              >
                <Music2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">没有找到与 "{debounced}" 相关的歌曲</p>
                <p className="text-xs mt-2 opacity-60">试试切换到 "全部音源" 或换个关键词</p>
              </motion.div>
            ) : !hasSearched ? (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="pt-6 pb-12 px-2 md:px-4"
              >
                <div className="mb-8 px-2">
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">
                    今晚听点什么?
                  </h1>
                  <p className="text-muted-foreground text-sm md:text-base mt-2 max-w-xl">
                    搜任意一首歌、一个歌手或一张专辑。同时在多个音源里找,显示同步歌词,还能批量下载。
                  </p>
                </div>

                <div className="mb-10">
                  <div className="flex items-baseline justify-between mb-3 px-2">
                    <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold">
                      精选推荐
                    </h2>
                    <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                      点一下开始搜
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
                    {TILES.map((t) => (
                      <HeroTile key={t.label} tile={t} onClick={() => setQuery(t.query)} />
                    ))}
                  </div>
                </div>

                {recentTracks.length > 0 && (
                  <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-2 px-2 mb-3">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold">
                        最近播放
                      </h2>
                    </div>
                    <div className="space-y-0.5">
                      {recentTracks.slice(0, 8).map((t, i) => (
                        <ResultRow
                          key={`${trackKey(t)}-${i}`}
                          track={t}
                          index={i}
                          onPlay={() => playTrack(t, recentTracks)}
                          onDownload={() => handleSingleDownload(t)}
                          onToggleSelect={() => {}}
                          selectMode={false}
                          selected={false}
                          isCurrent={!!currentTrack && trackKey(currentTrack) === trackKey(t)}
                          isPlaying={isPlaying}
                          downloading={downloadingKeys.has(trackKey(t))}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-0.5 max-w-3xl mx-auto"
              >
                <div className="flex items-center justify-between px-3 mb-2 mt-2">
                  <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold">
                    {results.length} 首结果
                  </h2>
                  <div className="flex items-center gap-1">
                    {selectMode ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={allSelected ? clearSelection : selectAll}
                          className="h-7 px-2 text-xs gap-1.5"
                        >
                          {allSelected ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                          {allSelected ? "全不选" : "全选"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={exitSelectMode}
                          className="h-7 px-2 text-xs gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          退出
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectMode(true)}
                        className="h-7 px-2 text-xs gap-1.5"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        多选下载
                      </Button>
                    )}
                  </div>
                </div>
                {results.map((t, i) => (
                  <ResultRow
                    key={`${trackKey(t)}-${i}`}
                    track={t}
                    index={i}
                    onPlay={() => handlePlay(t)}
                    onDownload={() => handleSingleDownload(t)}
                    onToggleSelect={() => toggleSelect(t)}
                    selectMode={selectMode}
                    selected={selectedKeys.has(trackKey(t))}
                    isCurrent={!!currentTrack && trackKey(currentTrack) === trackKey(t)}
                    isPlaying={isPlaying}
                    downloading={downloadingKeys.has(trackKey(t))}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <AnimatePresence>
        {selectMode && results.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40"
          >
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-card/95 backdrop-blur-xl border border-border shadow-xl shadow-black/10">
              <span className="text-sm font-medium px-2">
                已选 <span className="text-primary font-bold">{selectedKeys.size}</span> 首
              </span>
              <Button
                size="sm"
                onClick={handleBulkDownload}
                disabled={selectedKeys.size === 0 || bulkBusy}
                className="rounded-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {bulkBusy ? "下载中" : "下载选中"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
