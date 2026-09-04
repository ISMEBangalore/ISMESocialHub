const http = require("http");
const fs = require("fs");
const path = require("path");

const BUILD_DIR = path.join(__dirname, "build");
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function send(res, status, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(status, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const resolved = path.normalize(path.join(BUILD_DIR, urlPath));

  if (!resolved.startsWith(BUILD_DIR)) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  fs.stat(resolved, (err, stats) => {
    if (!err && stats.isFile()) {
      send(res, 200, resolved);
      return;
    }
    // SPA fallback: any unmatched route serves index.html
    send(res, 200, path.join(BUILD_DIR, "index.html"));
  });
});

server.listen(PORT, () => {
  console.log(`Serving ${BUILD_DIR} on port ${PORT}`);
});
