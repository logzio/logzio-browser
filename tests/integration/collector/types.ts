export enum SignalKind {
  TRACES = 'traces',
  METRICS = 'metrics',
  LOGS = 'logs',
}

export interface RecordedReq {
  path: string;
  method: string;
  headers: Record<string, string>;
  body: Buffer;
  receivedAt: number;
}

export interface CollectorInstance {
  port: number;
  stop: () => Promise<void>;
  clear: () => void;
  setStatus: (kind: SignalKind, statusCode: number) => void;
  received: {
    traces: RecordedReq[];
    metrics: RecordedReq[];
    logs: RecordedReq[];
  };
}
