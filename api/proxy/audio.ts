import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

const ALLOWED_HOSTS = new Set([
  "music.163.com",
  "m8.music.126.net",
  "m701.music.126.net",
  "m702.music.126.net",
  "m801.music.126.net",
  "m802.music.126.net",
  "m901.music.126.net",
  "m902.music.126.net",
  "dl.stream.qqmusic.qq.com",
  "ws.stream.qqmusic.qq.com",
  "isure.stream.qqmusic.qq.com",
  "streamoc.music.tc.qq.com",
  "audio.music.tc.qq.com",
  "kuwo.cn",
  "antiserver.kuwo.cn",
  "jooxdownload.jj.net",
  "jooxdownload.music.joox.com",
  "cn-east-1.static.joox.com",
  "cn-east-2.static.joox.com",
  "interface3.music.163.com",
  "music.migu.cn",
  "freetyst.nf.migu.cn",
  "audio-dolby.music.migu.cn",
  "cdnmusic.migu.cn",
  "trackdown.kugou.com",
  "downcdn.kugou.com",
  "downlocalcdn.kugou.com",
  "fs.i.kugou.com",
  "audio-dolby.music.bilibili.com",
  "upos-sz-mirrorcoso1.bilivideo.com",
  "upos-sz-mirrorc08c.bilivideo.com",
  "upos-sz-mirrorcos.bilivideo.com",
  "upos-sz-mirrorgoogle.bilivideo.com",
]);

type VercelRequest = IncomingMessage & { query: Record<string, string | string[]> };
type VercelResponse = ServerResponse;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;

  if (!rawUrl) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing url param" }));
    return;
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid URL" }));
    return;
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Protocol not allowed" }));
    return;
  }

  const hostname = target.hostname.toLowerCase();
  const isAllowed = [...ALLOWED_HOSTS].some(
    (h) => hostname === h || hostname.endsWith("." + h),
  );
  if (!isAllowed) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Host not allowed" }));
    return;
  }

  try {
    const range = req.headers["range"];
    const upstream = await fetch(target.href, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Referer: `${target.protocol}//${target.host}/`,
        ...(range ? { Range: range } : {}),
      },
      signal: AbortSignal.timeout(30_000),
    });

    const ct = upstream.headers.get("content-type") ?? "audio/mpeg";
    const cl = upstream.headers.get("content-length");
    const cr = upstream.headers.get("content-range");

    const headers: Record<string, string> = {
      "Content-Type": ct,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    };
    if (cl) headers["Content-Length"] = cl;
    if (cr) headers["Content-Range"] = cr;
    if (upstream.headers.get("accept-ranges")) headers["Accept-Ranges"] = "bytes";

    res.writeHead(upstream.status, headers);

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    req.on?.("close", () => reader.cancel());

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Upstream fetch failed" }));
    } else {
      res.end();
    }
  }
}
