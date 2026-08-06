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

await cp(resolve(root, "hosting/worker.js"), resolve(server, "index.js"));
