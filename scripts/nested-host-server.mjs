/**
 * Nested base-path host.
 *
 * Serves the production build beneath the exact games-site asset prefix:
 *
 *   /game-assets/planetary-survey/<version>/
 *
 * This is how the repository proves it does not depend on domain-root
 * deployment (docs/RELEASE_CONTRACT.md §4, docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §8).
 * It also refuses to serve the app at `/`, so a root-relative asset assumption
 * fails here rather than in production.
 */

import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(root, "dist");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = process.env.PLANETARY_SURVEY_VERSION ?? packageJson.version;
const prefix = `/game-assets/planetary-survey/${version}`;
const port = Number(process.env.PORT ?? 5275);

const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".ktx2", "image/ktx2"],
  [".glb", "model/gltf-binary"],
  [".ogg", "audio/ogg"],
  [".woff2", "font/woff2"],
]);

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(
      `<!doctype html><html lang="en"><body><p>Nested host is running. The game lives at <a href="${prefix}/">${prefix}/</a>.</p></body></html>`,
    );
    return;
  }

  if (!pathname.startsWith(`${prefix}/`) && pathname !== prefix) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end(
      `404: this host serves the build only beneath ${prefix}/. A request for ${pathname} means the build assumed domain-root deployment.`,
    );
    return;
  }

  const remainder = pathname.slice(prefix.length).replace(/^\/+/, "");
  const candidate = resolve(join(dist, remainder || "index.html"));

  // Refuse to escape the artifact directory.
  if (!candidate.startsWith(dist)) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("403: path traversal rejected.");
    return;
  }

  const filePath = existsSync(candidate) && statSync(candidate).isFile()
    ? candidate
    : join(dist, "index.html");

  if (!existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("404: the built artifact is missing. Run `npm run build`.");
    return;
  }

  response.writeHead(200, {
    "content-type": CONTENT_TYPES.get(extname(filePath).toLowerCase()) ?? "application/octet-stream",
    "cache-control": "public, max-age=31536000, immutable",
  });
  createReadStream(normalize(filePath)).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`nested host serving dist/ at http://127.0.0.1:${port}${prefix}/`);
});
