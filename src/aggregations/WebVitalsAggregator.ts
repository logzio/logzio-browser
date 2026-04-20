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
import { trace, Tracer } from '@opentelemetry/api';
import { ATTR_URL_PATH } from '@opentelemetry/semantic-conventions';
import { AttributeNames as otelAttributeNames } from '@opentelemetry/instrumentation-user-interaction';
import { LOGZIO_RUM_PROVIDER_NAME, rumLogger } from '../shared';
import { setIfDefined } from '../utils/helpers';
import {
  ATTR_SESSION_ID,
  ATTR_VIEW_ID,
  ATTR_REQUEST_PATH,
  ATTR_WEB_VITAL_NAME,
  ATTR_WEB_VITAL_VALUE,
  ATTR_WEB_VITAL_RATING,
  ATTR_WEB_VITAL_ID,
  ATTR_WEB_VITAL_NAVIGATION_TYPE,
} from '../instrumentation';

/**
 * This class represents the web vitals aggregator.
 * It collects and emits web vitals as spans.
 */
export class WebVitalsAggregator {
  private collectedMetrics: Record<string, MetricWithAttribution> = {};
  private tracer: Tracer = trace.getTracer(LOGZIO_RUM_PROVIDER_NAME);

  constructor(
    private readonly sessionId: string,
    private readonly viewId: string,
  ) {}

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
   * Flushes the collected metrics as spans.
   */
  public flushWebVitals(): void {
    if (Object.keys(this.collectedMetrics).length === 0) {
      this.cleanup();
      return;
    }

    rumLogger.debug(`collected ${Object.keys(this.collectedMetrics).length} web vitals`);
    Object.values(this.collectedMetrics).forEach((metric) => {
      rumLogger.debug(`emitting web vital span ${metric.name}`);
      this.recordWebVital(metric);
    });
    this.cleanup();
  }

  /**
   * Records the metric as a span.
   * @param metric - The metric to record.
   */
  private recordWebVital(metric: MetricWithAttribution): void {
    const urlObj = new URL(window.location.href);

    // Get all attributes for the span
    const spanAttributes: Record<string, any> = {
      'metric.rating': metric.rating,
      [ATTR_URL_PATH]: window.location.href,
      [ATTR_REQUEST_PATH]: urlObj.pathname,
      'navigation.type': metric.navigationType || 'unknown',
      [ATTR_SESSION_ID]: this.sessionId,
      [ATTR_VIEW_ID]: this.viewId,
      ...this.getMetricAttributes(metric),
    };

    // Emit span with all attributes
    this.emitWebVitalSpan(metric, spanAttributes);
  }

  /**
   * Emits a span with Web Vitals attributes.
   * @param metric - The metric to emit as a span.
   * @param attributes - The span attributes.
   */
  private emitWebVitalSpan(metric: MetricWithAttribution, attributes: Record<string, any>): void {
    const span = this.tracer.startSpan(metric.name, {
      attributes: {
        [otelAttributeNames.EVENT_TYPE]: 'web_vital',
        [ATTR_WEB_VITAL_NAME]: metric.name,
        [ATTR_WEB_VITAL_VALUE]: metric.value,
        [ATTR_WEB_VITAL_RATING]: metric.rating,
        [ATTR_WEB_VITAL_ID]: metric.id,
        [ATTR_WEB_VITAL_NAVIGATION_TYPE]: metric.navigationType || 'unknown',
        [ATTR_SESSION_ID]: this.sessionId,
        [ATTR_VIEW_ID]: this.viewId,
        [ATTR_REQUEST_PATH]: attributes[ATTR_REQUEST_PATH],
        ...attributes,
      },
    });
    span.end();
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
   * Returns the collected metrics.
   * @returns The collected metrics.
   */
  public getCollectedMetrics(): Record<string, MetricWithAttribution> {
    return { ...this.collectedMetrics };
  }

  /**
   * Extracts essential navigation attributes for Web Vitals dashboards.
   * Focuses on categorical data and avoids high-cardinality timing points.
   * @param entry - The navigation entry to extract the attributes from.
   * @param prefix - The prefix to use for the attributes.
   * @returns The extracted attributes.
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
   * @param entry - The performance entry to extract the attributes from.
   * @param prefix - The prefix to use for the attributes.
   * @returns The extracted attributes.
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
   * @param entry - The LargestContentfulPaint entry to extract the attributes from.
   * @param prefix - The prefix to use for the attributes.
   * @returns The extracted attributes.
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
   * @param entry - The LayoutShift entry to extract the attributes from.
   * @param prefix - The prefix to use for the attributes.
   * @returns The extracted attributes.
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
   * @param attribution - The LayoutShiftAttribution to extract the attributes from.
   * @param prefix - The prefix to use for the attributes.
   * @returns The extracted attributes.
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
   * @param entries - The PerformanceEventTiming entries to extract the attributes from.
   * @param prefix - The prefix to use for the attributes.
   * @returns The extracted attributes.
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
   * @param entries - The PerformanceLongAnimationFrameTiming entries to extract the attributes from.
   * @param prefix - The prefix to use for the attributes.
   * @returns The extracted attributes.
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
   * @param longestScript - The INPLongestScriptSummary to extract the attributes from.
   * @param prefix - The prefix to use for the attributes.
   * @returns The extracted attributes.
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
