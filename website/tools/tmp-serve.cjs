/* 临时静态服务器：伺服 website/ 目录，禁用缓存。用完即删。 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

http
  .createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    fs.readFile(f, (e, d) => {
      if (e) {
        res.writeHead(404);
        res.end('404');
        return;
      }
      res.writeHead(200, {
        'Content-Type': mime[path.extname(f).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      });
      res.end(d);
    });
  })
  .listen(5173, () => console.log('serving website/ on http://localhost:5173'));
