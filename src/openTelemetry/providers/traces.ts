import { Resource } from '@opentelemetry/resources';
import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  BatchSpanProcessor,
  ParentBasedSampler,
  Sampler,
  SpanExporter,
  SpanProcessor,
  WebTracerProvider,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { RUMConfig } from '../../config';
import { FrustrationDetectionProcessor, SessionContextSpanProcessor } from '../processors';
import { getAuthorizationHeader } from '../../utils/helpers';
import {
  MAX_SAMPLING_PERCENTAGE,
  MIN_SAMPLING_PERCENTAGE,
  MAX_BULK_SIZE,
  MAX_SPAN_WAIT_MS,
  LOGZIO_REGION_HEADER,
  AUTHORIZATION_HEADER,
  LOGZIO_DATA_TYPE_HEADER,
} from './constants';

export function getTraceProvider(
  resource: Resource,
  endpoint: string,
  config: RUMConfig,
): WebTracerProvider {
  return new WebTracerProvider({
    resource,
    sampler: getSampler(config),
    spanProcessors: getSpanProcessors(endpoint, config),
  });
}

function getSampler(config: RUMConfig): Sampler {
  if (config.samplingRate === MAX_SAMPLING_PERCENTAGE) return new AlwaysOnSampler();
  if (config.samplingRate === MIN_SAMPLING_PERCENTAGE) return new AlwaysOffSampler();

  const ratio = config.samplingRate / MAX_SAMPLING_PERCENTAGE;
  return new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(ratio),
  });
}

function getSpanProcessors(endpoint: string, config: RUMConfig): SpanProcessor[] {
  return [
    new SessionContextSpanProcessor(),
    ...(config.enable?.frustrationDetection ? [new FrustrationDetectionProcessor(config)] : []),
    new BatchSpanProcessor(getTraceExporter(endpoint, config), {
      maxExportBatchSize: MAX_BULK_SIZE,
      scheduledDelayMillis: MAX_SPAN_WAIT_MS,
    }),
  ];
}

function getTraceExporter(endpoint: string, config: RUMConfig): SpanExporter {
  return new OTLPTraceExporter({
    url: endpoint,
    headers: {
      [LOGZIO_REGION_HEADER]: config.region,
      [AUTHORIZATION_HEADER]: getAuthorizationHeader(config.tokens.traces),
      [LOGZIO_DATA_TYPE_HEADER]: 'traces',
    },
  });
}
