// Mock OTEL API and shared before import
import { createOtelApiMock } from '../../__utils__/otelApiMocks';
jest.mock('@opentelemetry/api', () => createOtelApiMock());

import { createLoggerOnlyMock } from '../../__utils__/loggerMocks';

jest.mock('@src/shared', () => createLoggerOnlyMock({ warn: jest.fn(), error: jest.fn() }));

// Keep constants real (import inside test bodies if needed)

describe('FrustrationDetectionProcessor behavior', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function makeSpan(
    attrs: any,
    name = 'NavigationStart',
    start: [number, number] = [0, 0],
    end: [number, number] = [6, 0],
  ): any {
    return {
      name,
      attributes: { ...attrs },
      startTime: start,
      endTime: end,
    };
  }

  it('should initialize metrics and counts rage click type', async () => {
    await jest.isolateModules(async () => {
      const add = jest.fn();
      const meter = { createCounter: jest.fn(() => ({ add })) };
      const { metrics } = require('@opentelemetry/api');
      metrics.getMeter.mockReturnValue(meter);

      const { FrustrationDetectionProcessor } = jest.requireActual(
        '@src/openTelemetry/processors/FrustrationDetectionProcessor',
      );
      const config = {
        frustrationThresholds: { heavyLoadThresholdMs: 5000 },
        tokens: { metrics: 'test-metrics-token', logs: '', traces: 'test-traces-token' },
      } as any;
      const p = new FrustrationDetectionProcessor(config);

      const span = makeSpan(
        {
          'frustration.type': ['rage_click', 'dead_click'],
          'view.id': 'v1',
          'session.id': 's1',
        },
        'UserInteraction',
      );

      p.onEnd(span);

      // Both types should be counted
      expect(add).toHaveBeenCalledTimes(2);

      // Attributes should be normalized
      expect(span.attributes['frustration.rage_click']).toBe(true);
      expect(span.attributes['frustration.dead_click']).toBe(true);
      expect(span.attributes['frustration.type']).toBeUndefined();
    });
  });

  it('should detect heavy load for long navigation spans', async () => {
    await jest.isolateModules(async () => {
      const add = jest.fn();
      const meter = { createCounter: jest.fn(() => ({ add })) };
      const { metrics } = require('@opentelemetry/api');
      metrics.getMeter.mockReturnValue(meter);

      const { FrustrationDetectionProcessor } = jest.requireActual(
        '@src/openTelemetry/processors/FrustrationDetectionProcessor',
      );
      const config = {
        frustrationThresholds: { heavyLoadThresholdMs: 5000 },
        tokens: { metrics: 'test-metrics-token', logs: '', traces: 'test-traces-token' },
      } as any;
      const p = new FrustrationDetectionProcessor(config);

      const span = makeSpan(
        { 'view.id': 'v2', 'session.id': 's2' },
        'NavigationStart',
        [0, 0],
        [6, 0],
      );
      p.onEnd(span);

      expect(span.attributes['frustration.heavy_load']).toBe(true);
      expect(add).toHaveBeenCalledTimes(1);
    });
  });

  it('should not throw when counter is missing', async () => {
    await jest.isolateModules(async () => {
      const { metrics } = require('@opentelemetry/api');
      metrics.getMeter.mockImplementation(() => ({
        createCounter: () => {
          throw new Error('x');
        },
      }));

      const { FrustrationDetectionProcessor } = jest.requireActual(
        '@src/openTelemetry/processors/FrustrationDetectionProcessor',
      );
      const config = {
        frustrationThresholds: { heavyLoadThresholdMs: 5000 },
        tokens: { metrics: 'test-metrics-token', logs: '', traces: 'test-traces-token' },
      } as any;

      expect(() => new FrustrationDetectionProcessor(config)).not.toThrow();

      const p = new FrustrationDetectionProcessor(config);
      const span = makeSpan(
        { 'view.id': 'v3', 'session.id': 's3' },
        'documentFetch',
        [0, 0],
        [6, 0],
      );
      expect(() => p.onEnd(span)).not.toThrow();
    });
  });

  it('should ignore non-navigation spans (no heavy load processing)', async () => {
    await jest.isolateModules(async () => {
      const add = jest.fn();
      const meter = { createCounter: jest.fn(() => ({ add })) };
      const { metrics } = require('@opentelemetry/api');
      metrics.getMeter.mockReturnValue(meter);

      const { FrustrationDetectionProcessor } = jest.requireActual(
        '@src/openTelemetry/processors/FrustrationDetectionProcessor',
      );
      const config = {
        frustrationThresholds: { heavyLoadThresholdMs: 5000 },
        tokens: { metrics: 'test-metrics-token', logs: '', traces: 'test-traces-token' },
      } as any;
      const p = new FrustrationDetectionProcessor(config);

      const span = { name: 'SomeOtherSpan', attributes: {} } as any;
      p.onEnd(span);

      expect(add).not.toHaveBeenCalled();
    });
  });

  it('should ignore non-string frustration types in user interaction', async () => {
    await jest.isolateModules(async () => {
      const add = jest.fn();
      const meter = { createCounter: jest.fn(() => ({ add })) };
      const { metrics } = require('@opentelemetry/api');
      metrics.getMeter.mockReturnValue(meter);

      const { FrustrationDetectionProcessor } = jest.requireActual(
        '@src/openTelemetry/processors/FrustrationDetectionProcessor',
      );
      const config = {
        frustrationThresholds: { heavyLoadThresholdMs: 5000 },
        tokens: { metrics: 'test-metrics-token', logs: '', traces: 'test-traces-token' },
      } as any;
      const p = new FrustrationDetectionProcessor(config);

      const span = {
        name: 'UserInteraction',
        attributes: { 'frustration.type': [null, 123] },
      } as any;

      p.onEnd(span);
      expect(add).not.toHaveBeenCalled();
    });
  });
});
