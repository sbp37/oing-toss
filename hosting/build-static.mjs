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

// The play screen loads only the compiled atlas outputs at runtime. Keep the
// editable source sheet and atlas builder out of the deployed client bundle.
const atlasSource = resolve(root, "design/ui-atlas");
const atlasClient = resolve(client, "design/ui-atlas");
await mkdir(atlasClient, { recursive: true });
for (const entry of ["oing-ui-atlas.png", "oing-ui-atlas.css", "oing-ui-atlas-map.json"]) {
  await cp(resolve(atlasSource, entry), resolve(atlasClient, entry));
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

for (const name of ["blush", "peach", "lemon", "mint", "aqua", "lilac"]) {
  await rm(resolve(client, `assets/ui/tiles-syrup-v4/tile-${name}.png`), { force: true });
}

await cp(resolve(root, "hosting/worker.js"), resolve(server, "index.js"));
