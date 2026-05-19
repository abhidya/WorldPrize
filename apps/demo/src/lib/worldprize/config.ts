export const DEFAULT_WORLD_APP_ID =
  'app_25d16ee7904752aca5fef279f2fe11c7';
export const DEFAULT_WORLD_RP_ID = 'rp_3d1c7269a4c866a7';
export const DEFAULT_WORLD_ACTION_FREE_ENTRY =
  'worldprize-free-entry-demo';

export const WORLD_PRIZE_MODES = ['mock', 'real'] as const;

export type WorldPrizeMode = (typeof WORLD_PRIZE_MODES)[number];

export function normalizeWorldPrizeMode(
  value?: string | null,
): WorldPrizeMode {
  return value === 'real' ? 'real' : 'mock';
}

export interface WorldRpContext {
  rp_id: string;
  nonce: string;
  created_at: number;
  expires_at: number;
  signature: string;
}

export interface WorldRpSignature {
  sig: string;
  nonce: string;
  created_at: number;
  expires_at: number;
}
