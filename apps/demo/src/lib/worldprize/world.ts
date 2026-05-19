import { createFreeEntryAction, type VerificationProof } from '@worldprize/core';
import {
  MockWorldIdVerificationProvider,
  WorldIdVerificationProvider,
} from '@worldprize/world-id';
import { createHash } from 'node:crypto';

const appId =
  process.env.NEXT_PUBLIC_WORLD_APP_ID ??
  'app_25d16ee7904752aca5fef279f2fe11c7';
const rpId = process.env.WORLD_RP_ID ?? 'rp_3d1c7269a4c866a7';
const actionFreeEntry =
  process.env.WORLD_ACTION_FREE_ENTRY ?? 'worldprize-free-entry-demo';
const signingKey = process.env.WORLD_SIGNING_KEY;

function hashSignature(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function getWorldConfig() {
  return {
    appId,
    rpId,
    actionFreeEntry,
    signingKeyConfigured: Boolean(signingKey),
  };
}

export function buildWorldProof(input: {
  humanLabel: string;
  dayKey: string;
}): VerificationProof {
  const action = createFreeEntryAction(actionFreeEntry, input.dayKey);
  const signature = signingKey
    ? hashSignature([signingKey, appId, rpId, action, input.dayKey, input.humanLabel.toLowerCase()])
    : undefined;

  return {
    action,
    dayKey: input.dayKey,
    humanLabel: input.humanLabel,
    signature,
    mock: !signingKey,
  };
}

export async function verifyWorldProof(proof: VerificationProof) {
  const provider = signingKey
    ? new WorldIdVerificationProvider({ appId, rpId, signingKey })
    : new MockWorldIdVerificationProvider({ appId, rpId });

  return provider.verify(proof);
}
