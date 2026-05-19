import 'server-only';

// This is mock/placeholder scaffolding for the interview demo. Production real mode must use IDKit/World App proof generation, backend RP signing, verification at the World verifier endpoint, and persistent nullifier storage.

import {
  MockWorldIdVerificationProvider,
  WorldIdVerificationProvider,
} from '@worldprize/world-id';
import { signRequest } from '@worldcoin/idkit-core/signing';
import { createHash } from 'node:crypto';

import {
  DEFAULT_WORLD_ACTION_FREE_ENTRY,
  DEFAULT_WORLD_APP_ID,
  DEFAULT_WORLD_RP_ID,
  normalizeWorldPrizeMode,
  type WorldRpContext,
  type WorldRpSignature,
} from './config';

const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID ?? DEFAULT_WORLD_APP_ID;
const rpId = process.env.WORLD_RP_ID ?? DEFAULT_WORLD_RP_ID;
const actionFreeEntry =
  process.env.WORLD_ACTION_FREE_ENTRY ?? DEFAULT_WORLD_ACTION_FREE_ENTRY;
const signingKey = process.env.WORLD_SIGNING_KEY;
const worldPrizeMode = normalizeWorldPrizeMode(
  process.env.WORLDPRIZE_MODE ?? process.env.NEXT_PUBLIC_WORLDPRIZE_MODE,
);

function hashSignature(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function toRpSignature(signature: WorldRpSignature): WorldRpContext {
  return {
    rp_id: rpId,
    nonce: signature.nonce,
    created_at: signature.created_at,
    expires_at: signature.expires_at,
    signature: signature.sig,
  };
}

function createMockRpContext(action: string): WorldRpContext {
  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + 300;
  const nonce =
    '0x' +
    hashSignature([appId, rpId, action, String(createdAt)]).slice(0, 64);
  const signature =
    '0x' +
    hashSignature([nonce, action, String(expiresAt), 'mock-rp-context'])
      .padEnd(130, '0')
      .slice(0, 130);

  return {
    rp_id: rpId,
    nonce,
    created_at: createdAt,
    expires_at: expiresAt,
    signature,
  };
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function getWorldConfig() {
  return {
    mode: worldPrizeMode,
    appId,
    rpId,
    actionFreeEntry,
    signingKeyConfigured: Boolean(signingKey),
  };
}

export function createWorldRpContext(action: string): WorldRpContext {
  if (worldPrizeMode !== 'real') {
    return createMockRpContext(action);
  }

  if (!signingKey) {
    throw new Error('WORLD_SIGNING_KEY is required in real mode');
  }

  const { sig, nonce, createdAt, expiresAt } = signRequest({
    signingKeyHex: signingKey,
    action,
    ttl: 300,
  });

  return toRpSignature({
    sig,
    nonce,
    created_at: createdAt,
    expires_at: expiresAt,
  });
}

export function getWorldIdVerificationProvider() {
  return worldPrizeMode === 'real'
    ? new WorldIdVerificationProvider({ rpId })
    : new MockWorldIdVerificationProvider({ appId, rpId });
}

export async function verifyWorldIdResult(input: unknown) {
  if (worldPrizeMode !== 'real') {
    const proof =
      input && typeof input === 'object' && 'proof' in input
        ? (input as { proof?: unknown }).proof
        : input;

    if (!proof || typeof proof !== 'object') {
      return {
        ok: false,
        reason: 'MISSING_PROOF' as const,
      };
    }

    const provider = new MockWorldIdVerificationProvider({ appId, rpId });
    const result = await provider.verify(proof as never);
    return {
      ok: result.ok,
      nullifierHash: result.nullifierHash,
      verification: result,
    };
  }

  const idkitResult =
    input && typeof input === 'object' && 'idkitResult' in input
      ? (input as { idkitResult?: unknown }).idkitResult
      : input;

  if (!idkitResult || typeof idkitResult !== 'object') {
    return {
      ok: false,
      reason: 'MISSING_PROOF' as const,
    };
  }

  const response = await fetch(
    `https://developer.world.org/api/v4/verify/${rpId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(idkitResult),
    },
  );

  const verification = await safeJson<{
    success?: boolean;
    nullifier?: string;
    results?: Array<{ success?: boolean; nullifier?: string }>;
    action?: string;
    message?: string;
  }>(response);

  const nullifierHash =
    verification?.nullifier ??
    verification?.results?.find((result) => result.success)?.nullifier;

  if (!response.ok || !nullifierHash) {
    return {
      ok: false,
      reason: 'INVALID_PROOF' as const,
      verification,
    };
  }

  return {
    ok: true,
    nullifierHash,
    verification,
  };
}
