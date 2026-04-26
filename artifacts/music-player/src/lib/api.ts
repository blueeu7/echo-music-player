export type Source =
  | "netease"
  | "tencent"
  | "kuwo"
  | "joox"
  | "bilibili"
  | "migu"
  | "kugou";

export type SourceOrAll = Source | "all";

export const ALL_SOURCES: Source[] = [
  "netease",
  "kuwo",
  "joox",
  "bilibili",
  "tencent",
  "migu",
  "kugou",
];

// Stable sources per upstream docs — used for "all" search to be friendly to rate limit.
export const STABLE_SOURCES: Source[] = ["netease", "kuwo", "joox", "bilibili"];

export interface Track {
  id: string | number;
  name: string;
  artist: string[];
  album: string;
  pic_id: string | number;
  lyric_id: string | number;
  source: Source;
}

const API_BASE = "https://music-api.gdstudio.xyz/api.php";
const MEITING_BASE = "https://api.injahow.cn/meting/";

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("API Request failed");
  return res.json();
};

const upgradeHttps = (u: string | undefined | null) =>
  u ? u.replace(/^http:\/\//i, "https://") : null;

export const searchTracks = async (
  keyword: string,
  source: Source = "netease",
  count = 50,
  pages = 1,
): Promise<Track[]> => {
  const url = `${API_BASE}?types=search&source=${source}&name=${encodeURIComponent(
    keyword,
  )}&count=${count}&pages=${pages}`;
  const data = await fetchJson(url);
  return Array.isArray(data) ? data : [];
};

export const searchAllSources = async (
  keyword: string,
  sources: Source[] = STABLE_SOURCES,
  countPerSource = 25,
): Promise<Track[]> => {
  const results = await Promise.allSettled(
    sources.map((s) => searchTracks(keyword, s, countPerSource, 1)),
  );

  const flat: Track[] = [];
  results.forEach((r) => {
    if (r.status === "fulfilled") flat.push(...r.value);
  });

  // Interleave by source
  const buckets = new Map<Source, Track[]>();
  for (const t of flat) {
    if (!buckets.has(t.source)) buckets.set(t.source, []);
    buckets.get(t.source)!.push(t);
  }
  const interleaved: Track[] = [];
  let i = 0;
  let added = true;
  while (added) {
    added = false;
    for (const arr of buckets.values()) {
      if (arr[i]) {
        interleaved.push(arr[i]);
        added = true;
      }
    }
    i++;
  }

  // Dedupe by name + first artist
  const seen = new Set<string>();
  const deduped: Track[] = [];
  for (const t of interleaved) {
    const artist = Array.isArray(t.artist) ? t.artist[0] ?? "" : String(t.artist ?? "");
    const key = `${t.name?.toLowerCase().trim()}::${artist.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(t);
  }

  return deduped;
};

const BITRATE_FALLBACKS: (128 | 192 | 320 | 740 | 999)[] = [320, 192, 128, 740, 999];

/**
 * Try to get a playable URL for the track, falling back through bitrates.
 * Returns null if nothing is available.
 */
export const getTrackUrl = async (
  id: string | number,
  source: Source = "netease",
  preferred: 128 | 192 | 320 | 740 | 999 = 320,
): Promise<{ url: string | null; size: number; br: string | number }> => {
  const ordered = [preferred, ...BITRATE_FALLBACKS.filter((b) => b !== preferred)];
  for (const br of ordered) {
    try {
      const url = `${API_BASE}?types=url&source=${source}&id=${id}&br=${br}`;
      const data = await fetchJson(url);
      const u = upgradeHttps(data?.url);
      if (u) {
        return { url: u, size: data?.size ?? 0, br: data?.br ?? br };
      }
    } catch {
      /* try next bitrate */
    }
  }
  return { url: null, size: 0, br: preferred };
};

export const getTrackPic = async (
  picId: string | number,
  source: Source = "netease",
): Promise<string | null> => {
  if (!picId) return null;
  try {
    const url = `${API_BASE}?types=pic&source=${source}&id=${picId}&size=500`;
    const data = await fetchJson(url);
    return upgradeHttps(data?.url);
  } catch {
    return null;
  }
};

export interface LyricLine {
  time: number;
  text: string;
  translation?: string;
}

export const getLyrics = async (
  lyricId: string | number,
  source: Source = "netease",
): Promise<{ lines: LyricLine[]; hasLyrics: boolean }> => {
  if (!lyricId) return { lines: [], hasLyrics: false };
  const url = `${API_BASE}?types=lyric&source=${source}&id=${lyricId}`;
  const data = await fetchJson(url);

  if (!data?.lyric) return { lines: [], hasLyrics: false };

  const parseLrc = (lrc: string) => {
    const lines = lrc.split("\n");
    const parsed: { time: number; text: string }[] = [];
    const timeRegex = /\[(\d{2}):(\d{2}(?:\.\d{2,3})?)\]/g;

    for (const line of lines) {
      let match;
      while ((match = timeRegex.exec(line)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseFloat(match[2]);
        const time = minutes * 60 + seconds;
        const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, "").trim();
        parsed.push({ time, text });
      }
    }
    return parsed.sort((a, b) => a.time - b.time);
  };

  const origLines = parseLrc(data.lyric);
  const transLines = data.tlyric ? parseLrc(data.tlyric) : [];

  const merged: LyricLine[] = origLines.map((orig) => {
    const trans = transLines.find((t) => Math.abs(t.time - orig.time) < 0.5);
    return { ...orig, translation: trans?.text || undefined };
  });

  return { lines: merged, hasLyrics: merged.length > 0 };
};

const sanitizeFilename = (s: string) =>
  s.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim().slice(0, 120);

const inferExt = (url: string): string => {
  const m = url.match(/\.(mp3|m4a|flac|wav|ogg|aac)(?:\?|$)/i);
  return m ? m[1].toLowerCase() : "mp3";
};

export const downloadTrack = async (
  track: Track,
  br: 128 | 192 | 320 | 740 | 999 = 320,
): Promise<boolean> => {
  const { url } = await getTrackUrl(track.id, track.source, br);
  if (!url) throw new Error("没有可用的播放地址");

  const artist = Array.isArray(track.artist) ? track.artist.join(", ") : String(track.artist ?? "");
  const ext = inferExt(url);
  const filename = sanitizeFilename(`${artist} - ${track.name}.${ext}`);

  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return true;
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    return false;
  }
};

/* -------------------------- Playlist Import -------------------------- */

export interface PlaylistEntry {
  name: string;
  artist: string;
}

const extractNeteaseId = (input: string): string | null => {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/(?:playlist[/?]?|id=)(\d{4,})/i);
  return m ? m[1] : null;
};

/**
 * Fetch a Netease playlist (via meting public proxy) and return the song list.
 * Each entry has `name` and `artist` only — we'll re-resolve them through our
 * primary API so they become first-class tracks (queueable, playable, downloadable).
 */
export const fetchNeteasePlaylist = async (
  urlOrId: string,
): Promise<PlaylistEntry[]> => {
  const id = extractNeteaseId(urlOrId);
  if (!id) throw new Error("无法识别歌单 ID");
  const url = `${MEITING_BASE}?server=netease&type=playlist&id=${id}`;
  const data = await fetchJson(url);
  if (!Array.isArray(data)) throw new Error("歌单为空或链接无效");
  return data
    .filter((d: any) => d?.name)
    .map((d: any) => ({
      name: String(d.name),
      artist: String(d.artist || "").replace(/\//g, ", "),
    }));
};

/**
 * Parse free-form lines like:
 *   披星戴月 - Lil Witch
 *   荒唐谣  DOUDOU
 *   稻香
 */
export const parseTextPlaylist = (text: string): PlaylistEntry[] => {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.+?)[\s]*[-—–~]\s*(.+)$/);
      if (m) return { name: m[1].trim(), artist: m[2].trim() };
      // also accept "歌名  歌手" with two-or-more spaces
      const m2 = line.match(/^(.+?)\s{2,}(.+)$/);
      if (m2) return { name: m2[1].trim(), artist: m2[2].trim() };
      return { name: line, artist: "" };
    });
};

/**
 * Given a list of {name, artist} entries, search each one through the primary
 * API (preferring netease, falling back through other stable sources) and
 * return the resolved Track objects.
 *
 * Calls `onProgress(done, total)` after each resolution so the UI can update.
 */
export const resolvePlaylistEntries = async (
  entries: PlaylistEntry[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ tracks: Track[]; missed: PlaylistEntry[] }> => {
  const tracks: Track[] = [];
  const missed: PlaylistEntry[] = [];
  const total = entries.length;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const q = entry.artist
      ? `${entry.name} ${entry.artist}`
      : entry.name;

    let best: Track | null = null;
    for (const src of STABLE_SOURCES) {
      try {
        const results = await searchTracks(q, src, 5, 1);
        if (results.length > 0) {
          // Prefer exact name match
          const wanted = entry.name.toLowerCase().trim();
          const match =
            results.find((r) => String(r.name).toLowerCase().trim() === wanted) ??
            results[0];
          best = match;
          break;
        }
      } catch {
        /* try next source */
      }
      // tiny delay between sources
      await new Promise((r) => setTimeout(r, 120));
    }

    if (best) tracks.push(best);
    else missed.push(entry);

    onProgress?.(i + 1, total);
    // throttle so we don't hammer the rate limit
    await new Promise((r) => setTimeout(r, 250));
  }

  return { tracks, missed };
};
