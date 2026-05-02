import { Router, type IRouter } from "express";

const router: IRouter = Router();

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

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

router.get("/audio", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "Missing url param" });
    return;
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  if (!ALLOWED_PROTOCOLS.has(target.protocol)) {
    res.status(403).json({ error: "Protocol not allowed" });
    return;
  }

  const hostname = target.hostname.toLowerCase();
  const isAllowed = [...ALLOWED_HOSTS].some(
    (h) => hostname === h || hostname.endsWith("." + h),
  );
  if (!isAllowed) {
    res.status(403).json({ error: "Host not allowed" });
    return;
  }

  try {
    const upstream = await fetch(target.href, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Referer: `${target.protocol}//${target.host}/`,
        Range: req.headers["range"] ?? "bytes=0-",
      },
      signal: AbortSignal.timeout(30_000),
    });

    const ct = upstream.headers.get("content-type") ?? "audio/mpeg";
    const cl = upstream.headers.get("content-length");
    const cr = upstream.headers.get("content-range");

    res.status(upstream.status);
    res.setHeader("Content-Type", ct);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (cl) res.setHeader("Content-Length", cl);
    if (cr) res.setHeader("Content-Range", cr);
    if (upstream.headers.get("accept-ranges")) {
      res.setHeader("Accept-Ranges", "bytes");
    }

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    req.on("close", () => reader.cancel());

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    req.log.error({ err, url }, "proxy/audio fetch error");
    if (!res.headersSent) {
      res.status(502).json({ error: "Upstream fetch failed" });
    } else {
      res.end();
    }
  }
});

export default router;
