import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getNewNonces } from './wallet/server-helpers';

/**
 * NextAuth configuration for World Mini App wallet authentication.
 *
 * Flow:
 * 1. Client requests a nonce from getNewNonces()
 * 2. Client calls MiniKit.commandsAsync.walletAuth() with the nonce
 * 3. MiniKit returns a SIWE-compatible message and signature
 * 4. Client sends the message + signature to this NextAuth provider
 * 5. Server verifies the signature and creates a session
 *
 * Note: This auth is optional for the WorldPrize demo. The core
 * World ID verification flow (proof-of-humanity) works independently
 * of wallet authentication.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'World Wallet',
      credentials: {
        message: { label: 'SIWE Message', type: 'text' },
        signature: { label: 'Signature', type: 'text' },
      },
      async authorize(credentials) {
        try {
          // In a production integration, you would:
          // 1. Parse the SIWE message
          // 2. Verify the signature against the message
          // 3. Check the nonce matches one you issued
          // 4. Return the user object

          const message = credentials.message as string;
          const signature = credentials.signature as string;

          if (!message || !signature) {
            return null;
          }

          // For the demo, we extract the address from the message header
          // Production code should use verifyMessage from viem
          const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
          const address = addressMatch?.[0];

          if (!address) {
            return null;
          }

          return {
            id: address,
            name: `${address.slice(0, 6)}...${address.slice(-4)}`,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.HMAC_SECRET_KEY,
});

/**
 * Server action: Generate nonce for wallet authentication.
 * Called by the AuthButton component before opening the wallet auth flow.
 */
export async function generateWalletNonce() {
  const { nonce, signedNonce } = await getNewNonces();
  return { nonce, signedNonce };
}
