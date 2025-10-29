const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

// Simple HTTP server to serve test pages and built RUM library
const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/test.html' : req.url;

  // Remove query parameters
  filePath = filePath.split('?')[0];

  // Serve test fixtures
  if (filePath.startsWith('/fixtures/')) {
    const fixturePath = path.join(__dirname, '..', filePath);
    serveFile(fixturePath, res);
    return;
  }

  // Serve built RUM library (would be built to dist/ in real scenario)
  if (filePath === '/logzio-rum.js') {
    // For now, serve the source directly (in real scenario this would be built/bundled)
    const rumPath = path.join(__dirname, '../../../src/index.ts');
    serveFile(rumPath, res, 'application/javascript');
    return;
  }

  // Default test page
  if (filePath === '/test.html') {
    const testPagePath = path.join(__dirname, '../fixtures/test.html');
    serveFile(testPagePath, res);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

function serveFile(filePath, res, contentType = null) {
  if (!contentType) {
    const ext = path.extname(filePath);
    switch (ext) {
      case '.html':
        contentType = 'text/html';
        break;
      case '.js':
        contentType = 'application/javascript';
        break;
      case '.ts':
        contentType = 'application/javascript';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      default:
        contentType = 'text/plain';
    }
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log(`Test server running at http://127.0.0.1:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Test server stopped');
    process.exit(0);
  });
});
