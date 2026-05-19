'use server';

import crypto from 'crypto';
import { hashNonce } from './client-helpers';

export const getNewNonces = async () => {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const signedNonce = hashNonce({ nonce });
  return {
    nonce,
    signedNonce,
  };
};
