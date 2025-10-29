import { createOtelApiMock } from '../../__utils__/otelApiMocks';

// Mock dependencies
jest.mock('@opentelemetry/api', () => ({
  ...createOtelApiMock(),
  metrics: {
    getMeter: jest.fn(() => ({
      createCounter: jest.fn(() => ({ add: jest.fn() })),
    })),
  },
}));

jest.mock('@src/shared', () => ({
  rumLogger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  LOGZIO_RUM_PROVIDER_NAME: 'logzio-rum',
}));

import { FrustrationDetectionProcessor } from '@src/openTelemetry/processors/FrustrationDetectionProcessor';
import {
  ATTR_FRUSTRATION_TYPE,
  ATTR_FRUSTRATION_DEAD_CLICK,
  ATTR_FRUSTRATION_ERROR_CLICK,
  ATTR_FRUSTRATION_HEAVY_LOAD,
  ATTR_FRUSTRATION_RAGE_CLICK,
  ATTR_SESSION_ID,
  ATTR_VIEW_ID,
  FrustrationType,
  SpanName,
} from '@src/instrumentation';

describe('FrustrationDetectionProcessor - Normalization', () => {
  let processor: FrustrationDetectionProcessor;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      frustrationThresholds: {
        heavyLoadThresholdMs: 2000,
      },
      tokens: {
        metrics: 'test-metrics-token',
        logs: 'test-logs-token',
        traces: 'test-traces-token',
      },
    };
    processor = new FrustrationDetectionProcessor(mockConfig);
  });

  describe('normalizeFrustrationAttributes', () => {
    it('should normalize single frustration type (string)', () => {
      const mockSpan = {
        name: 'UserInteraction',
        startTime: [1, 0] as [number, number],
        endTime: [2, 0] as [number, number],
        attributes: {
          [ATTR_FRUSTRATION_TYPE]: FrustrationType.HEAVY_LOAD,
          [ATTR_SESSION_ID]: 'test-session',
          [ATTR_VIEW_ID]: 'test-view',
        } as any,
      };

      processor.onEnd(mockSpan as any);

      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_HEAVY_LOAD]).toBe(true);
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_TYPE]).toBeUndefined();
    });

    it('should normalize multiple frustration types (array)', () => {
      const mockSpan = {
        name: 'UserInteraction',
        startTime: [1, 0] as [number, number],
        endTime: [2, 0] as [number, number],
        attributes: {
          [ATTR_FRUSTRATION_TYPE]: [FrustrationType.DEAD_CLICK, FrustrationType.RAGE_CLICK],
          [ATTR_SESSION_ID]: 'test-session',
          [ATTR_VIEW_ID]: 'test-view',
        } as any,
      };

      processor.onEnd(mockSpan as any);

      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_DEAD_CLICK]).toBe(true);
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_RAGE_CLICK]).toBe(true);
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_ERROR_CLICK]).toBeUndefined();
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_HEAVY_LOAD]).toBeUndefined();
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_TYPE]).toBeUndefined();
    });

    it('should handle all frustration types', () => {
      const mockSpan = {
        name: 'UserInteraction',
        startTime: [1, 0] as [number, number],
        endTime: [2, 0] as [number, number],
        attributes: {
          [ATTR_FRUSTRATION_TYPE]: [
            FrustrationType.DEAD_CLICK,
            FrustrationType.ERROR_CLICK,
            FrustrationType.HEAVY_LOAD,
            FrustrationType.RAGE_CLICK,
          ],
          [ATTR_SESSION_ID]: 'test-session',
          [ATTR_VIEW_ID]: 'test-view',
        } as any,
      };

      processor.onEnd(mockSpan as any);

      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_DEAD_CLICK]).toBe(true);
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_ERROR_CLICK]).toBe(true);
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_HEAVY_LOAD]).toBe(true);
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_RAGE_CLICK]).toBe(true);
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_TYPE]).toBeUndefined();
    });
  });

  describe('heavy load detection', () => {
    it('should detect heavy load and normalize attributes', () => {
      const mockSpan = {
        name: SpanName.NAVIGATION,
        startTime: [1, 0] as [number, number], // 1 second
        endTime: [4, 0] as [number, number], // 4 seconds (3000ms duration)
        attributes: {
          [ATTR_SESSION_ID]: 'test-session',
          [ATTR_VIEW_ID]: 'test-view',
        } as any,
      };

      processor.onEnd(mockSpan as any);

      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_HEAVY_LOAD]).toBe(true);
      expect((mockSpan.attributes as any)['frustration.load_duration_ms']).toBe(3000);
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_TYPE]).toBeUndefined();
    });

    it('should not detect heavy load when duration is below threshold', () => {
      const mockSpan = {
        name: SpanName.NAVIGATION,
        startTime: [1, 0] as [number, number], // 1 second
        endTime: [2, 500000000] as [number, number], // 2.5 seconds (1500ms duration)
        attributes: {
          [ATTR_SESSION_ID]: 'test-session',
          [ATTR_VIEW_ID]: 'test-view',
        } as any,
      };

      processor.onEnd(mockSpan as any);

      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_HEAVY_LOAD]).toBeUndefined();
      expect((mockSpan.attributes as any)['frustration.load_duration_ms']).toBeUndefined();
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_TYPE]).toBeUndefined();
    });

    it('should not process non-load-related spans', () => {
      const mockSpan = {
        name: 'custom-span',
        startTime: [1, 0] as [number, number],
        endTime: [5, 0] as [number, number], // 4000ms duration (above threshold)
        attributes: {
          [ATTR_SESSION_ID]: 'test-session',
          [ATTR_VIEW_ID]: 'test-view',
        } as any,
      };

      processor.onEnd(mockSpan as any);

      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_HEAVY_LOAD]).toBeUndefined();
      expect((mockSpan.attributes as any)['frustration.load_duration_ms']).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle spans without frustration attributes', () => {
      const mockSpan = {
        name: 'UserInteraction',
        startTime: [1, 0] as [number, number],
        endTime: [2, 0] as [number, number],
        attributes: {
          [ATTR_SESSION_ID]: 'test-session',
          [ATTR_VIEW_ID]: 'test-view',
          // No frustration attributes
        } as any,
      };

      processor.onEnd(mockSpan as any);

      // Should not add any frustration attributes
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_DEAD_CLICK]).toBeUndefined();
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_RAGE_CLICK]).toBeUndefined();
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_ERROR_CLICK]).toBeUndefined();
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_HEAVY_LOAD]).toBeUndefined();
    });

    it('should handle empty frustration types array', () => {
      const mockSpan = {
        name: 'UserInteraction',
        startTime: [1, 0] as [number, number],
        endTime: [2, 0] as [number, number],
        attributes: {
          [ATTR_FRUSTRATION_TYPE]: [], // Empty array
          [ATTR_SESSION_ID]: 'test-session',
          [ATTR_VIEW_ID]: 'test-view',
        } as any,
      };

      processor.onEnd(mockSpan as any);

      // Should remove the frustration.type attribute but not add any boolean attributes
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_TYPE]).toBeUndefined();
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_DEAD_CLICK]).toBeUndefined();
      expect((mockSpan.attributes as any)[ATTR_FRUSTRATION_RAGE_CLICK]).toBeUndefined();
    });
  });
});
