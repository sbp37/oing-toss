import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const client = resolve(dist, "client");
const server = resolve(dist, "server");

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });
await mkdir(server, { recursive: true });

for (const entry of ["index.html", "css", "js", "assets"]) {
  await cp(resolve(root, entry), resolve(client, entry), { recursive: true });
}

// The play screen ships the approved fixed chrome and default character only.
// Editable generation sources and builders stay out of the client bundle.
const chromeSource = resolve(root, "design/ui-chrome");
const chromeClient = resolve(client, "design/ui-chrome");
await mkdir(chromeClient, { recursive: true });
for (const entry of ["ui-chrome.png", "cat_idle.png"]) {
  await cp(resolve(chromeSource, entry), resolve(chromeClient, entry));
}

// Keep editable source sheets and font candidates in the repository, but do not
// ship them to players. Runtime assets remain untouched and at their source quality.
for (const entry of [
  "assets/source",
  "assets/fonts/candidates",
  "assets/ui/item-buttons-v1",
  "assets/ui/tiles-v3",
  "assets/icons/items/megabomb.png",
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

await cp(resolve(root, "hosting/worker.js"), resolve(server, "index.js"));
