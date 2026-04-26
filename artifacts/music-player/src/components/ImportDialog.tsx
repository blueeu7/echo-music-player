import { useState } from "react";
import { Loader2, Download, ListMusic, Link2, FileText, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  fetchNeteasePlaylist,
  parseTextPlaylist,
  resolvePlaylistEntries,
  downloadTrack,
  type Track,
  type PlaylistEntry,
} from "@/lib/api";
import { usePlayer } from "@/hooks/use-player";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Phase = "input" | "resolving" | "ready";

export function ImportDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"netease" | "list">("netease");
  const [neteaseInput, setNeteaseInput] = useState("");
  const [listInput, setListInput] = useState("");

  const [phase, setPhase] = useState<Phase>("input");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [tracks, setTracks] = useState<Track[]>([]);
  const [missed, setMissed] = useState<PlaylistEntry[]>([]);
  const [downloading, setDownloading] = useState(false);

  const { playTrack } = usePlayer();

  const reset = () => {
    setPhase("input");
    setProgress({ done: 0, total: 0 });
    setTracks([]);
    setMissed([]);
    setDownloading(false);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      // Reset shortly after closing so the flash isn't visible
      setTimeout(reset, 200);
    }
  };

  const startImport = async () => {
    let entries: PlaylistEntry[] = [];
    try {
      if (tab === "netease") {
        if (!neteaseInput.trim()) {
          toast.error("请贴一个网易云歌单链接或 ID");
          return;
        }
        setPhase("resolving");
        toast.loading("正在拉取歌单...", { id: "import" });
        entries = await fetchNeteasePlaylist(neteaseInput);
        toast.success(`找到 ${entries.length} 首,开始匹配音源...`, { id: "import" });
      } else {
        const parsed = parseTextPlaylist(listInput);
        if (parsed.length === 0) {
          toast.error("请粘贴至少一行歌曲");
          return;
        }
        entries = parsed;
        setPhase("resolving");
        toast.loading(`匹配 ${entries.length} 首歌...`, { id: "import" });
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "导入失败", { id: "import" });
      setPhase("input");
      return;
    }

    setProgress({ done: 0, total: entries.length });
    const { tracks: resolved, missed } = await resolvePlaylistEntries(
      entries,
      (done, total) => setProgress({ done, total }),
    );
    setTracks(resolved);
    setMissed(missed);
    setPhase("ready");
    toast.success(
      `匹配到 ${resolved.length} 首${missed.length ? ` · ${missed.length} 首没找到` : ""}`,
      { id: "import" },
    );
  };

  const handleDownloadAll = async () => {
    if (tracks.length === 0) return;
    setDownloading(true);
    let ok = 0;
    let fb = 0;
    let fail = 0;
    const id = toast.loading(`准备下载 ${tracks.length} 首...`);
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      toast.loading(`下载中 ${i + 1}/${tracks.length} · ${t.name}`, { id });
      try {
        const real = await downloadTrack(t);
        if (real) ok++;
        else fb++;
      } catch (e) {
        fail++;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    const msg = [
      ok ? `已下载 ${ok}` : "",
      fb ? `${fb} 首在新标签打开` : "",
      fail ? `${fail} 首失败` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    toast.success(msg || "完成", { id });
    setDownloading(false);
  };

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    playTrack(tracks[0], tracks);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-primary" />
            导入外部歌单
          </DialogTitle>
          <DialogDescription>
            支持网易云歌单链接,或直接粘贴歌曲列表。匹配完成后可一键播放或批量下载。
          </DialogDescription>
        </DialogHeader>

        {phase === "input" && (
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="netease" className="gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                网易云链接
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                粘贴列表
              </TabsTrigger>
            </TabsList>

            <TabsContent value="netease" className="space-y-3 mt-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  歌单链接 / ID
                </label>
                <Input
                  value={neteaseInput}
                  onChange={(e) => setNeteaseInput(e.target.value)}
                  placeholder="例:https://music.163.com/playlist?id=2884035 或 2884035"
                  className="h-11 rounded-lg"
                />
                <p className="text-xs text-muted-foreground/80 leading-relaxed">
                  在网易云 App 里点歌单 → 分享 → 复制链接,粘贴到这里即可。
                </p>
              </div>
            </TabsContent>

            <TabsContent value="list" className="space-y-3 mt-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  歌曲列表(每行一首)
                </label>
                <Textarea
                  value={listInput}
                  onChange={(e) => setListInput(e.target.value)}
                  placeholder={"披星戴月 - Lil Witch\n稻香 - 周杰伦\nCreep - Radiohead\n..."}
                  className="min-h-[180px] rounded-lg font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground/80 leading-relaxed">
                  格式:<code className="bg-muted px-1 rounded">歌名 - 歌手</code>。QQ
                  音乐 / 酷狗的歌单可以先把列表复制到这里。
                </p>
              </div>
            </TabsContent>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                取消
              </Button>
              <Button onClick={startImport} className="gap-2">
                <ListMusic className="w-4 h-4" />
                开始导入
              </Button>
            </div>
          </Tabs>
        )}

        {phase === "resolving" && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium">
                正在匹配音源 {progress.done}/{progress.total}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                每首歌大约 0.3 秒,API 限流期间请耐心等待
              </p>
            </div>
            {progress.total > 0 && (
              <div className="w-full max-w-xs h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {phase === "ready" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <div className="text-2xl font-bold">{tracks.length}</div>
                <div className="text-xs text-muted-foreground">匹配成功</div>
              </div>
              {missed.length > 0 && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-muted-foreground">{missed.length}</div>
                  <div className="text-xs text-muted-foreground">未找到</div>
                </div>
              )}
            </div>

            <div className="max-h-[240px] overflow-y-auto space-y-1 pr-1">
              {tracks.slice(0, 50).map((t, i) => (
                <div
                  key={`${t.source}-${t.id}-${i}`}
                  className="flex items-center gap-3 px-2 py-1.5 text-sm rounded-md hover:bg-muted/50"
                >
                  <span className="w-6 text-xs text-muted-foreground tabular-nums text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{t.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.artist.join(", ")}
                    </div>
                  </div>
                </div>
              ))}
              {tracks.length > 50 && (
                <div className="text-xs text-center text-muted-foreground py-2">
                  以及其他 {tracks.length - 50} 首...
                </div>
              )}

              {missed.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                    未匹配({missed.length})
                  </div>
                  {missed.slice(0, 20).map((m, i) => (
                    <div key={i} className="px-2 py-1 text-xs text-muted-foreground truncate">
                      {m.name} {m.artist && <span className="opacity-60">— {m.artist}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={reset}>
                重新导入
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handlePlayAll}
                  disabled={tracks.length === 0}
                  className="gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  全部播放
                </Button>
                <Button
                  onClick={handleDownloadAll}
                  disabled={tracks.length === 0 || downloading}
                  className={cn("gap-2", downloading && "opacity-70")}
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {downloading ? "下载中" : "下载全部"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
