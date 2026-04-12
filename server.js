const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  let filePath = req.url.replace(/\/index\.(html)?\.?/, '/index.html');
  let ext = path.extname(filePath).toLowerCase();
  
  if (!ext) ext = '.html';
  
  res.setHeader('Content-Type', mimeTypes[ext] || 'text/html');
  if (filePath.startsWith('/')) {
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(8000, () => {
  console.log('Server running at: http://localhost:8000');
});
