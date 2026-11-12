import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createQuestions } from './questions.mjs';

// Local server only. No credentials, source modules, or dotfiles are served.
const port = Number(process.env.PORT || 3000);
const routes = new Map([
  ['/', ['../index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['../index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['../style.css', 'text/css; charset=utf-8']],
  ['/lern-app/', ['index.html', 'text/html; charset=utf-8']],
  ['/lern-app/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/lern-app/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/lern-app/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/bilder/stern.png', ['../bilder/stern.png', 'image/png']],
  ['/bilder/sources-chaudes-myvatn.jpg', ['../bilder/sources-chaudes-myvatn.jpg', 'image/jpeg']],
  ['/bilder/R.jpg', ['../bilder/R.jpg', 'image/jpeg']],
  ['/bilder/ridetur-island-3-c.jpg', ['../bilder/ridetur-island-3-c.jpg', 'image/jpeg']],
  ['/bilder/original.jpeg', ['../bilder/original.jpeg', 'image/jpeg']]
]);
let generating = false;
function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}
const server = createServer(async (request, response) => {
  try {
    const host = request.headers.host;
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host)) { json(response, 403, { error: 'Unzulässiger Host.' }); return; }
    const pathname = new URL(request.url, `http://${host}`).pathname;
    if (pathname === '/api/questions') {
      if (request.method !== 'POST') { json(response, 405, { error: 'Bitte verwende POST.' }); return; }
      if (request.headers.origin !== `http://${host}` || !request.headers['content-type']?.startsWith('application/json')) {
        json(response, 403, { error: 'Bitte öffne die App direkt über den lokalen App-Server.' }); return;
      }
      if (generating) { json(response, 429, { error: 'Eine Fragerunde wird bereits erstellt. Bitte warte kurz.' }); return; }
      if (!process.env.OPENAI_API_KEY) { json(response, 503, { error: 'Die KI-Verbindung ist noch nicht eingerichtet. Du kannst bereits das Römer-Beispiel ausprobieren.' }); return; }
      generating = true;
      try {
        const chunks = [];
        let bytes = 0;
        for await (const chunk of request) {
          bytes += chunk.length;
          if (bytes > 100000) { json(response, 413, { error: 'Der Text ist zu gross.' }); return; }
          chunks.push(chunk);
        }
        let data;
        try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { json(response, 400, { error: 'Die Anfrage ist nicht lesbar.' }); return; }
        if (typeof data?.text !== 'string' || data.text.trim().length < 10 || data.text.length > 20000) {
          json(response, 400, { error: 'Bitte verwende einen Text mit 10 bis 20 000 Zeichen.' }); return;
        }
        const questions = await createQuestions(data.text, { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-5-mini' });
        json(response, 200, { questions });
      } catch (error) {
        json(response, 502, { error: error.name === 'TimeoutError' ? 'Die KI braucht gerade zu lange. Versuche es bitte noch einmal.' : error.message });
      } finally { generating = false; }
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const route = routes.get(pathname);
    if (!route) { response.writeHead(404); response.end('Nicht gefunden'); return; }
    const content = await readFile(fileURLToPath(new URL(route[0], import.meta.url)));
    response.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { if (!response.headersSent) response.writeHead(500); response.end('Die Anfrage konnte nicht verarbeitet werden.'); }
});
server.requestTimeout = 100000;
server.headersTimeout = 15000;
server.listen(port, '127.0.0.1', () => console.log(`Textfuchs: http://127.0.0.1:${port}/lern-app/`));
