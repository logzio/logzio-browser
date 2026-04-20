import { SamplingDecision } from '@opentelemetry/sdk-trace-base';
import { SessionSampler } from '@src/openTelemetry/samplers/SessionSampler';

describe('SessionSampler', () => {
  it('shouldSample returns RECORD_AND_SAMPLED when sampled', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1); // 10 < 50
    const sampler = new SessionSampler(50);

    const result = sampler.shouldSample();

    expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('shouldSample returns NOT_RECORD when not sampled', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.9); // 90 >= 50
    const sampler = new SessionSampler(50);

    const result = sampler.shouldSample();

    expect(result.decision).toBe(SamplingDecision.NOT_RECORD);
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('rate=100 always returns RECORD_AND_SAMPLED', () => {
    const sampler = new SessionSampler(100);

    const result = sampler.shouldSample();

    expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });

  it('rate=0 always returns NOT_RECORD', () => {
    const sampler = new SessionSampler(0);

    const result = sampler.shouldSample();

    expect(result.decision).toBe(SamplingDecision.NOT_RECORD);
  });

  it('reroll() can change the decision', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1); // sampled
    const sampler = new SessionSampler(50);
    expect(sampler.shouldSample().decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);

    jest.spyOn(Math, 'random').mockReturnValue(0.9); // not sampled
    sampler.reroll();
    expect(sampler.shouldSample().decision).toBe(SamplingDecision.NOT_RECORD);

    jest.spyOn(Math, 'random').mockRestore();
  });

  it('toString() returns descriptive string', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const sampler = new SessionSampler(50);

    expect(sampler.toString()).toBe('SessionSampler{rate=50, sampled=true}');
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('caches sampling decision across multiple shouldSample calls', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const sampler = new SessionSampler(50);
    jest.spyOn(Math, 'random').mockRestore();

    // Multiple calls should return same decision
    const result1 = sampler.shouldSample();
    const result2 = sampler.shouldSample();
    const result3 = sampler.shouldSample();

    expect(result1.decision).toBe(result2.decision);
    expect(result2.decision).toBe(result3.decision);
  });
});
