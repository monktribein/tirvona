import { OAuth2Client } from 'google-auth-library';
import config from '../config/env.js';

// Verifies Google ID tokens. The library caches Google's public keys, so this
// does not hit the network on every sign-in.
let client = null;
const getClient = () => {
  if (!config.google.configured) return null;
  if (!client) client = new OAuth2Client(config.google.clientId);
  return client;
};

/**
 * Validate a Google ID token (the `credential` returned by Google Identity
 * Services in the browser) and extract the identity from it.
 *
 * Everything about the user is taken from the *verified token payload* — never
 * from values the client sends alongside it, which are trivially forged.
 *
 * Returns { success, profile } or { success: false, code, message }.
 */
export const verifyGoogleIdToken = async (credential) => {
  const oauth = getClient();
  if (!oauth) {
    return {
      success: false,
      code: 'GOOGLE_NOT_CONFIGURED',
      message: 'Google Sign-In is not configured on this server.',
    };
  }

  if (typeof credential !== 'string' || !credential) {
    return { success: false, code: 'INVALID_CREDENTIAL', message: 'Google sign-in failed. Please try again.' };
  }

  try {
    const ticket = await oauth.verifyIdToken({
      idToken: credential,
      // Rejects a token minted for a different Google project.
      audience: config.google.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      return { success: false, code: 'NO_EMAIL', message: 'Your Google account did not share an email address.' };
    }

    // Google sets this false for unverified addresses on some workspace setups.
    // Accepting one would let someone claim an address they do not control.
    if (payload.email_verified === false) {
      return {
        success: false,
        code: 'EMAIL_UNVERIFIED',
        message: 'Your Google email address is not verified. Please verify it with Google and try again.',
      };
    }

    return {
      success: true,
      profile: {
        googleId: payload.sub, // stable; the email can change, this cannot
        email: String(payload.email).toLowerCase(),
        name: payload.name || '',
        avatarUrl: payload.picture || '',
      },
    };
  } catch (error) {
    console.warn('[GOOGLE] ID token verification failed:', error.message);
    return { success: false, code: 'INVALID_CREDENTIAL', message: 'Google sign-in failed. Please try again.' };
  }
};

export default { verifyGoogleIdToken };
