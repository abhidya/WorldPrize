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
      rpId: string;
      verifyUrl?: string;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async verify(proof: VerificationProof): Promise<VerificationResult> {
    if (!proof?.payload) {
      return { ok: false, reason: 'MISSING_PROOF' };
    }

    // Always forward the proof payload to the World verifier endpoint.
    // Never trust client-side claims like { verified: true } — the verifier
    // is the only authority that can confirm a proof is valid.
    const verifyUrl =
      this.options.verifyUrl ??
      `https://developer.world.org/api/v4/verify/${this.options.rpId}`;
    const fetchImpl = this.options.fetchImpl ?? fetch;

    const response = await fetchImpl(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(proof.payload),
    });

    if (!response.ok) {
      return { ok: false, reason: 'INVALID_PROOF' };
    }

    const data = (await response.json()) as {
      nullifier?: string;
      results?: Array<{ nullifier?: string; success?: boolean }>;
    };

    const nullifierHash =
      data.nullifier ?? data.results?.find((result) => result.success)?.nullifier;

    if (!nullifierHash) {
      return { ok: false, reason: 'SERVER_ERROR' };
    }

    return { ok: true, nullifierHash };
  }
}
