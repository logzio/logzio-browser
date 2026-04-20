import { Sampler, SamplingDecision, SamplingResult } from '@opentelemetry/sdk-trace-base';

export class SessionSampler implements Sampler {
  private sampled: boolean;
  private readonly rate: number;

  constructor(rate: number) {
    this.rate = rate;
    this.sampled = this.roll();
  }

  shouldSample(): SamplingResult {
    return {
      decision: this.sampled ? SamplingDecision.RECORD_AND_SAMPLED : SamplingDecision.NOT_RECORD,
    };
  }

  /** Called by session manager when a new session starts (renewWithNewSessionId). */
  reroll(): void {
    this.sampled = this.roll();
  }

  private roll(): boolean {
    if (this.rate >= 100) return true;
    if (this.rate <= 0) return false;
    return Math.random() * 100 < this.rate;
  }

  toString(): string {
    return `SessionSampler{rate=${this.rate}, sampled=${this.sampled}}`;
  }
}
