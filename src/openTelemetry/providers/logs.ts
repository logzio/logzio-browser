import { Resource } from '@opentelemetry/resources';
import {
  LoggerProvider,
  LogRecordExporter,
  LogRecordProcessor,
  BatchLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { SessionContextLogProcessor } from '../processors';
import { MAX_BULK_SIZE, MAX_LOG_WAIT_MS } from './constants';

export function getLogProvider(resource: Resource, endoint: string): LoggerProvider {
  return new LoggerProvider({
    resource,
    processors: getLogProcessors(endoint),
  });
}

function getLogProcessors(endoint: string): LogRecordProcessor[] {
  return [
    new SessionContextLogProcessor(),
    new BatchLogRecordProcessor(getLogExporter(endoint), {
      maxExportBatchSize: MAX_BULK_SIZE,
      scheduledDelayMillis: MAX_LOG_WAIT_MS,
    }),
  ];
}

function getLogExporter(endoint: string): LogRecordExporter {
  return new OTLPLogExporter({
    url: endoint,
    headers: {
      // TODO: fine tune
    },
  });
}
