import * as http from 'http';
import { SignalKind, RecordedReq, CollectorInstance } from './types';

export async function startCollector(): Promise<CollectorInstance> {
  const received = {
    traces: [] as RecordedReq[],
    metrics: [] as RecordedReq[],
    logs: [] as RecordedReq[],
  };

  const statusOverrides = new Map<SignalKind, number>();

  const server = http.createServer((req, res) => {
    // Add CORS headers for browser fetch/XHR requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const chunks: Buffer[] = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const path = req.url || '';
      const method = req.method || '';

      // Record the request
      const recordedReq: RecordedReq = {
        path,
        method,
        headers: req.headers as Record<string, string>,
        body,
        receivedAt: Date.now(),
      };

      // Route to appropriate signal collection
      if (path === '/traces') {
        received.traces.push(recordedReq);
        const status = statusOverrides.get(SignalKind.TRACES) || 200;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end('{}');
      } else if (path === '/metrics') {
        received.metrics.push(recordedReq);
        const status = statusOverrides.get(SignalKind.METRICS) || 200;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end('{}');
      } else if (path === '/logs') {
        received.logs.push(recordedReq);
        const status = statusOverrides.get(SignalKind.LOGS) || 200;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end('{}');
      } else if (path === '/echo') {
        // Echo endpoint for network instrumentation testing
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ echo: 'success', method }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to start collector server'));
        return;
      }

      const port = address.port;

      const instance: CollectorInstance = {
        port,
        stop: () =>
          new Promise((resolveStop) => {
            server.close(() => resolveStop());
          }),
        clear: () => {
          received.traces.length = 0;
          received.metrics.length = 0;
          received.logs.length = 0;
        },
        setStatus: (kind: SignalKind, statusCode: number) => {
          statusOverrides.set(kind, statusCode);
        },
        received,
      };

      resolve(instance);
    });

    server.on('error', reject);
  });
}
