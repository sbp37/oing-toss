import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const client = resolve(dist, "client");
const server = resolve(dist, "server");
const BUILD_TOKEN = "__OING_BUILD_ID__";

async function addTreeToHash(hash, directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await addTreeToHash(hash, path);
    else if (entry.isFile()) {
      hash.update(path.slice(root.length));
      hash.update(await readFile(path));
    }
  }
}

async function stampJavaScriptImports(directory, buildId) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await stampJavaScriptImports(path, buildId);
    else if (entry.isFile() && entry.name.endsWith(".js")) {
      const source = await readFile(path, "utf8");
      const stamped = source.replace(
        /(from\s*["'])(\.{1,2}\/[^"']+\.js)(["'])/g,
        `$1$2?v=${buildId}$3`,
      );
      await writeFile(path, stamped);
    }
  }
}

const buildHash = createHash("sha256");
for (const file of ["index.html", "sw.js", "hosting/build-static.mjs"]) {
  buildHash.update(file);
  buildHash.update(await readFile(resolve(root, file)));
}
await addTreeToHash(buildHash, resolve(root, "css"));
await addTreeToHash(buildHash, resolve(root, "js"));
const buildId = buildHash.digest("hex").slice(0, 12);

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });

for (const entry of ["index.html", "privacy.html", "css", "js", "assets", "manifest.webmanifest", "sw.js"]) {
  await cp(resolve(root, entry), resolve(client, entry), { recursive: true });
}

for (const file of ["index.html", "sw.js"]) {
  const path = resolve(client, file);
  const source = await readFile(path, "utf8");
  await writeFile(path, source.replaceAll(BUILD_TOKEN, buildId));
}
await stampJavaScriptImports(resolve(client, "js"), buildId);

// Keep the isolated item FX/sound comparison lab available on branch previews.
// It reuses the shipped runtime assets and audio module without touching the game.
await mkdir(resolve(client, "design"), { recursive: true });
await cp(resolve(root, "design/item-fx-lab"), resolve(client, "design/item-fx-lab"), { recursive: true });

// Keep editable source sheets and font candidates in the repository, but do not
// ship them to players. Runtime assets remain untouched and at their source quality.
for (const entry of [
  "assets/source",
  "assets/fonts/candidates",
  "assets/ui/item-buttons-v1",
  "assets/ui/tiles-v3",
  "assets/icons/items/megabomb.png",
  // 1024-square masters the shipped icon sizes are derived from - source of
  // record, not something a player ever downloads.
  "assets/icons/app/icon-master.png",
  "assets/icons/app/icon-mask-master.png",
  // Visual explorations and superseded runtime parts. They are kept in the
  // repository for rollback/reference, but no current HTML, CSS or JS path
  // names them. Carrying them in an AIT makes every first install slower.
  "assets/backgrounds/candidates",
  "assets/backgrounds/play-bg-clear-sky-v5.webp",
  "assets/backgrounds/play-bg-rose-morning-v2.webp",
  "assets/icons/hud/goal.webp",
  "assets/ui/logo.webp",
  "assets/ui/button-back.webp",
  "assets/ui/button-pause.webp",
  "assets/ui/item-dock-v2.webp",
  "assets/ui/item-dock-v2.png",
  "assets/ui/item-dock-v3.webp",
  "assets/ui/item-dock-v3.png",
  "assets/ui/play-footer-chrome-v1.webp",
  "assets/ui/play-footer-chrome-v1.png",
  "assets/ui/play-hud-chrome-v1.webp",
  "assets/ui/play-hud-chrome-v1.png",
  "assets/ui/play-stage-badge-v3.webp",
  "assets/ui/play-stage-badge-v3.png",
  "assets/ui/speech-bubble-v2.webp",
  "assets/ui/speech-bubble-v2.png",
  "assets/ui/tile-disabled.webp",
  "assets/ui/tile-empty.webp",
  "assets/ui/tile-hint.webp",
  "assets/ui/tile-normal.webp",
  "assets/ui/tile-selected.webp",
  "assets/ui/tile-success.webp",
]) {
  await rm(resolve(client, entry), { recursive: true, force: true });
}

// The board is one tile now, so only `mint` ships; `peach` stays for the home
// screen's sum-ten equation. The rest of the set, and every PNG twin of the
// webp actually loaded, is repository-only.
for (const name of ["blush", "peach", "lemon", "mint", "aqua", "lilac"]) {
  await rm(resolve(client, `assets/ui/tiles-syrup-v4/tile-${name}.png`), { force: true });
  if (name !== "mint" && name !== "peach") {
    await rm(resolve(client, `assets/ui/tiles-syrup-v4/tile-${name}.webp`), { force: true });
  }
}

// PNG masters whose webp twin is what the game actually loads. Nothing in
// index.html, the stylesheets or the JS ever names a .png, so these were
// sitting in the bundle unreachable - never requested by a browser, but
// carried on every deploy. Dropping one only ever removes the master, and
// only when the twin the game does load is present next to it; a PNG with
// no twin is left in place and reported, so a future PNG-only asset cannot
// be swept out silently.
const uiDir = resolve(client, "assets/ui");
const orphans = [];
for (const name of await readdir(uiDir)) {
  if (!name.endsWith(".png")) continue;
  const twin = resolve(uiDir, `${name.slice(0, -4)}.webp`);
  if (existsSync(twin)) await rm(resolve(uiDir, name), { force: true });
  else orphans.push(name);
}
if (orphans.length) {
  console.warn(`build: kept ${orphans.length} png without a webp twin: ${orphans.join(", ")}`);
}

// Dead stylesheet: index.html never links it, and the atlas image it points
// at is not shipped either.
await rm(resolve(client, "css/atlas-integration.css"), { force: true });

await cp(resolve(root, "hosting/worker.js"), resolve(server, "index.js"));
