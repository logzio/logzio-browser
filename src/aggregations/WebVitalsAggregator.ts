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
import { setIfDefined } from '../utils/helpers';

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
          setIfDefined(result, 'largest.shift.target', clsAttr.largestShiftTarget);
          setIfDefined(result, 'largest.shift.time', clsAttr.largestShiftTime);
          setIfDefined(result, 'largest.shift.value', clsAttr.largestShiftValue);
          setIfDefined(result, 'load.state', clsAttr.loadState);
          if (clsAttr.largestShiftEntry) {
            Object.assign(
              result,
              this.extractLayoutShiftEntryAttributes(
                clsAttr.largestShiftEntry,
                'largest.shift.entry',
              ),
            );
          }
          if (clsAttr.largestShiftSource) {
            Object.assign(
              result,
              this.extractLayoutShiftAttributionAttributes(
                clsAttr.largestShiftSource,
                'largest.shift.source',
              ),
            );
          }
          break;
        }
        case 'FCP': {
          const fcpAttr = metric.attribution as FCPAttribution;
          setIfDefined(result, 'time.to.first.byte', fcpAttr.timeToFirstByte);
          setIfDefined(result, 'first.byte.to.first.contentful.paint', fcpAttr.firstByteToFCP);
          setIfDefined(result, 'first.contentful.load.state', fcpAttr.loadState);
          if (fcpAttr.fcpEntry) {
            Object.assign(
              result,
              this.extractPerformanceEntryAttributes(
                fcpAttr.fcpEntry,
                'first.contentful.paint.entry',
              ),
            );
          }
          if (fcpAttr.navigationEntry) {
            Object.assign(
              result,
              this.extractNavigationEntryAttributes(fcpAttr.navigationEntry, 'navigation.entry'),
            );
          }
          break;
        }
        case 'LCP': {
          const lcpAttr = metric.attribution as LCPAttribution;
          setIfDefined(result, 'largest.contentful.paint.target', lcpAttr.target);
          setIfDefined(result, 'largest.contentful.paint.url', lcpAttr.url);
          setIfDefined(
            result,
            'largest.contentful.paint.time.to.first.byte',
            lcpAttr.timeToFirstByte,
          );
          setIfDefined(
            result,
            'largest.contentful.paint.resource.load.delay',
            lcpAttr.resourceLoadDelay,
          );
          setIfDefined(
            result,
            'largest.contentful.paint.resource.load.duration',
            lcpAttr.resourceLoadDuration,
          );
          setIfDefined(
            result,
            'largest.contentful.paint.element.render.delay',
            lcpAttr.elementRenderDelay,
          );

          if (lcpAttr.navigationEntry) {
            Object.assign(
              result,
              this.extractNavigationEntryAttributes(
                lcpAttr.navigationEntry,
                'largest.contentful.paint.navigation.entry',
              ),
            );
          }

          if (lcpAttr.lcpEntry) {
            Object.assign(
              result,
              this.extractLCPEntryAttributes(lcpAttr.lcpEntry, 'largest.contentful.paint.entry'),
            );
          }

          if ((lcpAttr as any).lcpResourceEntry) {
            Object.assign(
              result,
              this.extractPerformanceEntryAttributes(
                (lcpAttr as any).lcpResourceEntry,
                'largest.contentful.paint.resource.entry',
              ),
            );
          }
          break;
        }
        case 'TTFB': {
          const ttfbAttr = metric.attribution as TTFBAttribution;
          setIfDefined(result, 'waiting.duration', ttfbAttr.waitingDuration);
          setIfDefined(result, 'cache.duration', ttfbAttr.cacheDuration);
          setIfDefined(result, 'dns.duration', ttfbAttr.dnsDuration);
          setIfDefined(result, 'connection.duration', ttfbAttr.connectionDuration);
          setIfDefined(result, 'request.duration', ttfbAttr.requestDuration);
          if (ttfbAttr.navigationEntry) {
            Object.assign(
              result,
              this.extractNavigationEntryAttributes(ttfbAttr.navigationEntry, 'navigation.entry'),
            );
          }
          break;
        }
        case 'INP': {
          const inpAttr = metric.attribution as INPAttribution;
          setIfDefined(result, 'interaction.target', inpAttr.interactionTarget);
          setIfDefined(result, 'interaction.time', inpAttr.interactionTime);
          setIfDefined(result, 'interaction.type', inpAttr.interactionType);
          setIfDefined(result, 'next.paint.time', inpAttr.nextPaintTime);
          setIfDefined(result, 'input.delay', inpAttr.inputDelay);
          setIfDefined(result, 'processing.duration', inpAttr.processingDuration);
          setIfDefined(result, 'presentation.delay', inpAttr.presentationDelay);
          setIfDefined(result, 'load.state', inpAttr.loadState);
          setIfDefined(result, 'total.script.duration', inpAttr.totalScriptDuration);
          setIfDefined(
            result,
            'total.style.and.layout.duration',
            inpAttr.totalStyleAndLayoutDuration,
          );
          setIfDefined(result, 'total.paint.duration', inpAttr.totalPaintDuration);
          setIfDefined(result, 'total.unattributed.duration', inpAttr.totalUnattributedDuration);
          if (inpAttr.processedEventEntries && inpAttr.processedEventEntries.length > 0) {
            Object.assign(
              result,
              this.extractEventTimingAttributes(
                inpAttr.processedEventEntries,
                'processed.event.entries',
              ),
            );
          }
          if (inpAttr.longAnimationFrameEntries && inpAttr.longAnimationFrameEntries.length > 0) {
            Object.assign(
              result,
              this.extractLongAnimationFrameAttributes(
                inpAttr.longAnimationFrameEntries,
                'long.animation.frame.entries',
              ),
            );
          }
          if (inpAttr.longestScript) {
            Object.assign(
              result,
              this.extractLongestScriptAttributes(inpAttr.longestScript, 'longest.script'),
            );
          }
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

  /**
   * Extracts essential navigation attributes for Web Vitals dashboards.
   * Focuses on categorical data and avoids high-cardinality timing points.
   */
  private extractNavigationEntryAttributes(
    entry: PerformanceNavigationTiming,
    prefix: string = 'navigation',
  ): Record<string, any> {
    const result: Record<string, any> = {};

    setIfDefined(result, `${prefix}.type`, entry.type);

    if (entry.redirectCount !== undefined) {
      const redirectBucket =
        entry.redirectCount === 0
          ? '0'
          : entry.redirectCount === 1
            ? '1'
            : entry.redirectCount <= 3
              ? '2-3'
              : '4+';
      setIfDefined(result, `${prefix}.redirect.bucket`, redirectBucket);
    }

    return result;
  }

  /**
   * Extracts attributes from PerformanceEntry objects (paint timing, etc.)
   */
  private extractPerformanceEntryAttributes(
    entry: PerformanceEntry,
    prefix: string,
  ): Record<string, any> {
    const result: Record<string, any> = {};

    setIfDefined(result, `${prefix}.name`, entry.name);
    setIfDefined(result, `${prefix}.entry.type`, entry.entryType);
    setIfDefined(result, `${prefix}.start.time`, entry.startTime);
    setIfDefined(result, `${prefix}.duration`, entry.duration);

    return result;
  }

  /**
   * Extracts attributes from LargestContentfulPaint entry
   */
  private extractLCPEntryAttributes(
    entry: any, // LargestContentfulPaint
    prefix: string = 'lcp.entry',
  ): Record<string, any> {
    const result: Record<string, any> = {};

    setIfDefined(result, `${prefix}.element.tag.name`, entry.element?.tagName);

    if (entry.size !== undefined) {
      const sizeBucket =
        entry.size < 1000
          ? 'small'
          : entry.size < 10000
            ? 'medium'
            : entry.size < 50000
              ? 'large'
              : 'xlarge';
      setIfDefined(result, `${prefix}.size.bucket`, sizeBucket);
    }

    return result;
  }

  /**
   * Extracts attributes from LayoutShift entry
   */
  private extractLayoutShiftEntryAttributes(
    entry: any, // LayoutShift
    prefix: string = 'layout.shift.entry',
  ): Record<string, any> {
    const result: Record<string, any> = {};

    setIfDefined(result, `${prefix}.had.recent.input`, entry.hadRecentInput);

    if (entry.sources?.length !== undefined) {
      const sourcesCount = entry.sources.length;
      const sourcesBucket =
        sourcesCount === 0 ? '0' : sourcesCount === 1 ? '1' : sourcesCount <= 3 ? '2-3' : '4+';
      setIfDefined(result, `${prefix}.sources.bucket`, sourcesBucket);
    }

    return result;
  }

  /**
   * Extracts attributes from LayoutShiftAttribution
   */
  private extractLayoutShiftAttributionAttributes(
    attribution: any, // LayoutShiftAttribution
    prefix: string = 'layout.shift.source',
  ): Record<string, any> {
    const result: Record<string, any> = {};

    setIfDefined(result, `${prefix}.node.tag.name`, attribution.node?.tagName);

    return result;
  }

  /**
   * Extracts essential attributes from PerformanceEventTiming entries.
   * Focuses on event type and bucketed counts, avoiding timing measurements as labels.
   */
  private extractEventTimingAttributes(
    entries: any[], // PerformanceEventTiming[]
    prefix: string = 'processed.events',
  ): Record<string, any> {
    const result: Record<string, any> = {};

    const count = entries.length;
    const countBucket =
      count === 0 ? '0' : count === 1 ? '1' : count <= 3 ? '2-3' : count <= 10 ? '4-10' : '11+';
    setIfDefined(result, `${prefix}.count.bucket`, countBucket);

    if (entries.length > 0) {
      const firstEntry = entries[0];
      setIfDefined(result, `${prefix}.first.name`, firstEntry.name);
    }

    return result;
  }

  /**
   * Extracts essential attributes from Long Animation Frame entries.
   * Focuses on bucketed counts, avoiding timing measurements as labels.
   */
  private extractLongAnimationFrameAttributes(
    entries: any[], // PerformanceLongAnimationFrameTiming[]
    prefix: string = 'long.animation.frames',
  ): Record<string, any> {
    const result: Record<string, any> = {};

    const count = entries.length;
    const countBucket =
      count === 0 ? '0' : count === 1 ? '1' : count <= 3 ? '2-3' : count <= 10 ? '4-10' : '11+';
    setIfDefined(result, `${prefix}.count.bucket`, countBucket);

    if (entries.length > 0) {
      const firstEntry = entries[0];
      const scriptsCount = firstEntry.scripts?.length || 0;
      const scriptsBucket =
        scriptsCount === 0 ? '0' : scriptsCount === 1 ? '1' : scriptsCount <= 3 ? '2-3' : '4+';
      setIfDefined(result, `${prefix}.first.scripts.bucket`, scriptsBucket);
    }

    return result;
  }

  /**
   * Extracts essential attributes from INP longest script summary.
   * Focuses on categorical data, avoiding high-cardinality identifiers and URLs.
   */
  private extractLongestScriptAttributes(
    longestScript: any, // INPLongestScriptSummary
    prefix: string = 'longest.script',
  ): Record<string, any> {
    const result: Record<string, any> = {};

    if (longestScript?.entry) {
      const entry = longestScript.entry;
      setIfDefined(result, `${prefix}.invoker.type`, entry.invokerType);
    }

    setIfDefined(result, `${prefix}.subpart`, longestScript?.subpart);

    return result;
  }
}
