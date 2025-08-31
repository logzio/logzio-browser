import {
  CLSAttribution,
  FCPAttribution,
  LCPAttribution,
  TTFBAttribution,
  INPAttribution,
  MetricWithAttribution,
  onFCP,
  onLCP,
  onTTFB,
  onCLS,
  onINP,
} from 'web-vitals/attribution';
import { metrics } from '@opentelemetry/api';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { ATTR_URL_PATH } from '@opentelemetry/semantic-conventions';
import { LOGZIO_RUM_PROVIDER_NAME } from '../shared';

/**
 * This class represents the web vitals aggregator.
 * It collects and aggregates web vitals metrics.
 */
export class WebVitalsAggregator {
  private collectedMetrics: Record<string, MetricWithAttribution> = {};
  private meter = metrics.getMeter(LOGZIO_RUM_PROVIDER_NAME);

  constructor(private readonly meterProvider: MeterProvider | null = null) {}

  /**
   * Starts the web vitals aggregator.
   */
  public start(): void {
    this.cleanup();
    this.registerObservers();
  }

  /**
   * Registers the web vitals observers.
   */
  private registerObservers(): void {
    onFCP((metric: MetricWithAttribution) => this.processMetric(metric));
    onLCP((metric: MetricWithAttribution) => this.processMetric(metric));
    onTTFB((metric: MetricWithAttribution) => this.processMetric(metric));
    onCLS((metric: MetricWithAttribution) => this.processMetric(metric));
    onINP((metric: MetricWithAttribution) => this.processMetric(metric));
  }

  /**
   * Processes the metric.
   * @param metric - The metric to process.
   */
  private processMetric(metric: MetricWithAttribution): void {
    this.collectedMetrics[metric.name] = metric;
  }

  /**
   * Returns the metric unit based on the metric name.
   * @param metricName - The name of the metric.
   * @returns The unit of the metric.
   */
  private getMetricUnit(metricName: string): string {
    switch (metricName) {
      case 'CLS':
        return 'unitless';
      default:
        return 'ms';
    }
  }

  /**
   * Flushes the collected metrics.
   */
  public flushMetrics(): void {
    if (Object.keys(this.collectedMetrics).length === 0) {
      this.cleanup();
      return;
    }

    Object.values(this.collectedMetrics).forEach((metric) => {
      this.recordMetric(metric);
    });
    this.flushProvider();
    this.cleanup();
  }

  /**
   * Records the metric.
   * @param metric - The metric to record.
   */
  private recordMetric(metric: MetricWithAttribution): void {
    const attributes: Record<string, any> = {
      'metric.id': metric.id,
      'metric.rating': metric.rating,
      [ATTR_URL_PATH]: window.location.href,
      'navigation.type': metric.navigationType || 'unknown',
      ...this.getMetricAttributes(metric),
    };

    const histogram = this.meter.createHistogram(`web.vitals.${metric.name.toLowerCase()}`, {
      description: `${metric.name} web vital metric for a view.`,
      unit: this.getMetricUnit(metric.name),
    });

    histogram.record(metric.value, attributes);
  }

  /**
   * Returns the metric attributes.
   * @param metric - The metric to get the attributes for.
   * @returns The metric attributes.
   */
  private getMetricAttributes(metric: MetricWithAttribution): Record<string, any> {
    if (!metric.attribution) return {};

    const attribution = metric.attribution;
    const result: Record<string, any> = {};

    if (attribution) {
      switch (metric.name) {
        case 'CLS': {
          const clsAttr = metric.attribution as CLSAttribution;
          result['largest.shift.target'] = clsAttr.largestShiftTarget;
          result['largest.shift.time'] = clsAttr.largestShiftTime;
          result['largest.shift.value'] = clsAttr.largestShiftValue;
          result['largest.shift.entry'] = clsAttr.largestShiftEntry;
          result['largest.shift.source'] = clsAttr.largestShiftSource;
          result['load.state'] = clsAttr.loadState;
          break;
        }
        case 'FCP': {
          const fcpAttr = metric.attribution as FCPAttribution;
          result['time.to.first.byte'] = fcpAttr.timeToFirstByte;
          result['first.byte.to.first.contentful.paint'] = fcpAttr.firstByteToFCP;
          result['first.contentful.load.state'] = fcpAttr.loadState;
          result['first.contentful.paint.entry'] = fcpAttr.fcpEntry;
          result['navigation.entry'] = fcpAttr.navigationEntry;
          break;
        }
        case 'LCP': {
          const lcpAttr = metric.attribution as LCPAttribution;
          result['largest.contentful.paint.target'] = lcpAttr.target;
          result['largest.contentful.paint.url'] = lcpAttr.url;
          result['largest.contentful.paint.time.to.first.byte'] = lcpAttr.timeToFirstByte;
          result['largest.contentful.paint.resource.load.delay'] = lcpAttr.resourceLoadDelay;
          result['largest.contentful.paint.resource.load.duration'] = lcpAttr.resourceLoadDuration;
          result['largest.contentful.paint.element.render.delay'] = lcpAttr.elementRenderDelay;
          result['largest.contentful.paint.navigation.entry'] = lcpAttr.navigationEntry;
          result['largest.contentful.paint.entry'] = lcpAttr.lcpEntry;
          break;
        }
        case 'TTFB': {
          const ttfbAttr = metric.attribution as TTFBAttribution;
          result['waiting.duration'] = ttfbAttr.waitingDuration;
          result['cache.duration'] = ttfbAttr.cacheDuration;
          result['dns.duration'] = ttfbAttr.dnsDuration;
          result['connection.duration'] = ttfbAttr.connectionDuration;
          result['request.duration'] = ttfbAttr.requestDuration;
          result['navigation.entry'] = ttfbAttr.navigationEntry;
          break;
        }
        case 'INP': {
          const inpAttr = metric.attribution as INPAttribution;
          result['interaction.target'] = inpAttr.interactionTarget;
          result['interaction.time'] = inpAttr.interactionTime;
          result['interaction.type'] = inpAttr.interactionType;
          result['next.paint.time'] = inpAttr.nextPaintTime;
          result['processed.event.entries'] = inpAttr.processedEventEntries;
          result['input.delay'] = inpAttr.inputDelay;
          result['processing.duration'] = inpAttr.processingDuration;
          result['presentation.delay'] = inpAttr.presentationDelay;
          result['load.state'] = inpAttr.loadState;
          result['long.animation.frame.entries'] = inpAttr.longAnimationFrameEntries;
          result['longest.script'] = inpAttr.longestScript;
          result['total.script.duration'] = inpAttr.totalScriptDuration;
          result['total.style.and.layout.duration'] = inpAttr.totalStyleAndLayoutDuration;
          result['total.paint.duration'] = inpAttr.totalPaintDuration;
          result['total.unattributed.duration'] = inpAttr.totalUnattributedDuration;
          break;
        }
      }
    }
    return result;
  }

  /**
   * Stops the web vitals aggregator gracefully.
   */
  public stop(): void {
    this.cleanup();
  }

  /**
   * Cleans up the web vitals aggregator.
   */
  private cleanup(): void {
    this.clearCollectedMetrics();
  }

  /**
   * Clears the collected metrics.
   */
  private clearCollectedMetrics(): void {
    this.collectedMetrics = {};
  }

  /**
   * Flushes the metrics provider.
   */
  private flushProvider(): void {
    if (this.meterProvider) {
      this.meterProvider.forceFlush();
    }
  }

  /**
   * Returns the collected metrics.
   * @returns The collected metrics.
   */
  public getCollectedMetrics(): Record<string, MetricWithAttribution> {
    return { ...this.collectedMetrics };
  }
}
