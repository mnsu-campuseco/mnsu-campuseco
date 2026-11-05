// Development-only static server; Phase 2 application data stays in the browser.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };
http
  .createServer((req, res) => {
    let file;
    try {
      file = path.resolve(
        root,
        '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (file === root) file = path.join(root, 'index.html');
    if (!file.startsWith(root + path.sep) || file.includes(path.sep + '.')) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, body) => {
      if (error) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      });
      res.end(body);
    });
  })
  .listen(4173, '127.0.0.1', () => console.log('CampusEco: http://127.0.0.1:4173'));
