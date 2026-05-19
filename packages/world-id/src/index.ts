import {
  createFreeEntryAction,
  hashNullifier,
  type VerificationProof,
  type VerificationProvider,
  type VerificationResult,
} from '@worldprize/core';

export type { VerificationProof, VerificationProvider, VerificationResult } from '@worldprize/core';

export { createFreeEntryAction };

const NULLIFIER_KEYS = [
  'nullifier',
  'nullifier_hash',
  'nullifierHash',
  'session_nullifier',
  'sessionNullifier',
] as const;

const WRAPPED_KEYS = ['verification', 'idkitResult', 'result', 'data'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function extractWorldNullifier(payload: unknown): string | null {
  const seen = new WeakSet<object>();

  function walk(node: unknown): string | null {
    if (!node || typeof node !== 'object') {
      return null;
    }

    if (seen.has(node as object)) {
      return null;
    }
    seen.add(node as object);

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item);
        if (found) {
          return found;
        }
      }
      return null;
    }

    const record = node as Record<string, unknown>;

    for (const key of NULLIFIER_KEYS) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    for (const key of WRAPPED_KEYS) {
      const value = record[key];
      const found = walk(value);
      if (found) {
        return found;
      }
    }

    for (const value of Object.values(record)) {
      const found = walk(value);
      if (found) {
        return found;
      }
    }

    return null;
  }

  return walk(payload);
}

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

    const embeddedNullifier = extractWorldNullifier(proof.payload);
    if (
      isPlainObject(proof.payload) &&
      proof.payload.verified === true &&
      embeddedNullifier
    ) {
      return { ok: true, nullifierHash: embeddedNullifier };
    }

    // Always forward raw proof payloads to the World verifier endpoint.
    // Server-created verified payloads may short-circuit after explicit
    // backend verification, but client claims alone are never enough.
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

    const data = (await response.json()) as unknown;
    const nullifierHash = extractWorldNullifier(data) ?? embeddedNullifier;

    if (!nullifierHash) {
      return { ok: false, reason: 'SERVER_ERROR' };
    }

    return { ok: true, nullifierHash };
  }
}
