jest.mock('@opentelemetry/api', () => ({
  Context: {} as any,
  HrTime: [0, 0] as any,
  metrics: {
    getMeter: jest.fn(() => ({ createCounter: jest.fn(() => ({ add: jest.fn() })) })),
  },
}));

jest.mock('@src/shared', () => ({
  rumLogger: { warn: jest.fn(), error: jest.fn() },
  LOGZIO_RUM_PROVIDER_NAME: 'logzio-rum',
}));

jest.mock('@src/instrumentation', () => ({
  ATTR_FRUSTRATION_TYPE: 'frustration.type',
  ATTR_SESSION_ID: 'session.id',
  ATTR_VIEW_ID: 'view.id',
  FrustrationType: {
    RAGE_CLICK: 'rage_click',
    DEAD_CLICK: 'dead_click',
    HEAVY_LOAD: 'heavy_load',
  },
}));

describe('FrustrationDetectionProcessor additional branches', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should not set heavy_load when duration equals threshold', async () => {
    await jest.isolateModules(async () => {
      const { FrustrationDetectionProcessor } = jest.requireActual(
        '@src/openTelemetry/processors/FrustrationDetectionProcessor',
      );
      const p = new FrustrationDetectionProcessor({
        frustrationThresholds: { heavyLoadThresholdMs: 5000 },
        tokens: { metrics: 'test-metrics-token', logs: '', traces: 'test-traces-token' },
      } as any);

      const span = {
        name: 'NavigationStart',
        attributes: {},
        startTime: [5, 0],
        endTime: [10, 0],
      } as any; // 5000ms exactly
      p.onEnd(span);

      expect(span.attributes['frustration.type']).toBeUndefined();
    });
  });

  it('should forceFlush and shutdown resolve successfully', async () => {
    await jest.isolateModules(async () => {
      const { FrustrationDetectionProcessor } = jest.requireActual(
        '@src/openTelemetry/processors/FrustrationDetectionProcessor',
      );
      const p = new FrustrationDetectionProcessor({
        frustrationThresholds: { heavyLoadThresholdMs: 5000 },
        tokens: { metrics: 'test-metrics-token', logs: '', traces: 'test-traces-token' },
      } as any);

      await expect(p.forceFlush()).resolves.toBeUndefined();
      await expect(p.shutdown()).resolves.toBeUndefined();
    });
  });
});
