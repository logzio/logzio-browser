import { Resource } from '@opentelemetry/resources';
import {
  LoggerProvider,
  LogRecordExporter,
  LogRecordProcessor,
  BatchLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { SessionContextLogProcessor } from '../processors';
import { RUMConfig } from '../../config';
import {
  MAX_BULK_SIZE,
  MAX_LOG_WAIT_MS,
  LOGZIO_REGION_HEADER,
  LOGZIO_LOGS_TOKEN_HEADER,
} from './constants';

export function getLogProvider(
  resource: Resource,
  endoint: string,
  config: RUMConfig,
): LoggerProvider {
  return new LoggerProvider({
    resource,
    processors: getLogProcessors(endoint, config),
  });
}

function getLogProcessors(endoint: string, config: RUMConfig): LogRecordProcessor[] {
  return [
    new SessionContextLogProcessor(),
    new BatchLogRecordProcessor(getLogExporter(endoint, config), {
      maxExportBatchSize: MAX_BULK_SIZE,
      scheduledDelayMillis: MAX_LOG_WAIT_MS,
    }),
  ];
}

function getLogExporter(endoint: string, config: RUMConfig): LogRecordExporter {
  return new OTLPLogExporter({
    url: endoint,
    headers: {
      [LOGZIO_REGION_HEADER]: config.region,
      [LOGZIO_LOGS_TOKEN_HEADER]: config.tokens.logs,
    },
  });
}
