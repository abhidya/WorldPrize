import crypto from 'crypto';

export const hashNonce = ({ nonce }: { nonce: string }) => {
  const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET_KEY!);
  hmac.update(nonce);
  return hmac.digest('hex');
};
