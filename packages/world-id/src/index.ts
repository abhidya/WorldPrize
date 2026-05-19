import {
  createFreeEntryAction,
  hashNullifier,
  type VerificationProof,
  type VerificationProvider,
  type VerificationResult,
} from '@worldprize/core';

export type { VerificationProof, VerificationProvider, VerificationResult } from '@worldprize/core';

export { createFreeEntryAction };

function serverHash(parts: string[]): string {
  return hashNullifier(parts.join('|'));
}

export class MockWorldIdVerificationProvider implements VerificationProvider {
  constructor(
    private readonly options: {
      appId: string;
      rpId: string;
      signingKey?: string;
    },
  ) {}

  async verify(proof: VerificationProof): Promise<VerificationResult> {
    if (!proof?.humanLabel || proof.humanLabel.toLowerCase() === 'bot') {
      return { ok: false, reason: 'INVALID_PROOF' };
    }

    const nullifierHash = serverHash([
      this.options.appId,
      this.options.rpId,
      proof.action,
      proof.dayKey,
      proof.humanLabel.toLowerCase(),
    ]);

    return { ok: true, nullifierHash };
  }
}

export class WorldIdVerificationProvider implements VerificationProvider {
  constructor(
    private readonly options: {
      appId: string;
      rpId: string;
      signingKey: string;
    },
  ) {}

  async verify(proof: VerificationProof): Promise<VerificationResult> {
    if (!this.options.signingKey) {
      return { ok: false, reason: 'SERVER_ERROR' };
    }

    if (!proof?.signature) {
      return { ok: false, reason: 'MISSING_PROOF' };
    }

    const expectedSignature = serverHash([
      this.options.signingKey,
      this.options.appId,
      this.options.rpId,
      proof.action,
      proof.dayKey,
      proof.humanLabel.toLowerCase(),
    ]);

    if (expectedSignature !== proof.signature) {
      return { ok: false, reason: 'INVALID_PROOF' };
    }

    const nullifierHash = serverHash([
      this.options.appId,
      this.options.rpId,
      proof.action,
      proof.dayKey,
      proof.humanLabel.toLowerCase(),
    ]);

    return { ok: true, nullifierHash };
  }
}
