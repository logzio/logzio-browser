import { Resource } from '@opentelemetry/resources';
import {
  LoggerProvider,
  LogRecordExporter,
  LogRecordProcessor,
  BatchLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { SessionContextLogProcessor } from '../processors';
import { RUMConfig } from '../../config';
import { getAuthorizationHeader } from '../../utils/helpers';
import {
  MAX_BULK_SIZE,
  MAX_LOG_WAIT_MS,
  LOGZIO_REGION_HEADER,
  AUTHORIZATION_HEADER,
} from './constants';

export function getLogProvider(
  resource: Resource,
  endpoint: string,
  config: RUMConfig,
): LoggerProvider {
  return new LoggerProvider({
    resource,
    processors: getLogProcessors(endpoint, config),
  });
}

function getLogProcessors(endpoint: string, config: RUMConfig): LogRecordProcessor[] {
  return [
    new SessionContextLogProcessor(),
    new BatchLogRecordProcessor(getLogExporter(endpoint, config), {
      maxExportBatchSize: MAX_BULK_SIZE,
      scheduledDelayMillis: MAX_LOG_WAIT_MS,
    }),
  ];
}

function getLogExporter(endpoint: string, config: RUMConfig): LogRecordExporter {
  return new OTLPLogExporter({
    url: endpoint,
    headers: {
      [LOGZIO_REGION_HEADER]: config.region,
      [AUTHORIZATION_HEADER]: getAuthorizationHeader(config.tokens.logs),
    },
  });
}
