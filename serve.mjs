import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.OING_PREVIEW_PORT || process.env.PORT) || 8766;
const host = process.env.OING_PREVIEW_HOST || '127.0.0.1';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const relative = normalize(requested).replace(/^[/\\]+/, '');
    const filename = join(root, relative);
    if (!filename.startsWith(root)) throw new Error('Forbidden');
    const body = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': mime[extname(filename)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch (error) {
    const forbidden = error.message === 'Forbidden';
    response.writeHead(forbidden ? 403 : 404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(forbidden ? 'Forbidden' : 'Not found');
  }
}).listen(port, host, () => {
  const previewHost = host === '0.0.0.0' ? 'LAN IP' : host;
  console.log(`OING local preview: http://${previewHost}:${port}`);
});
