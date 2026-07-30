import { useState } from 'react';
import { useAuth, type GoogleChallenge } from '../contexts/AuthContext';

type Stage = 'idle' | 'otp' | 'profile';

/**
 * Drives the three-step Google sign-up shared by the login and register pages:
 *
 *   1. `start()`      → Google chooser. Existing users are logged straight in
 *                       (Google has already proven the address). New users move
 *                       to step 2.
 *   2. stage 'otp'    → email OTP, verified against a pre-account record.
 *   3. stage 'profile'→ name + mobile collected, then the account is created.
 *
 * Nothing is written to the database until step 3 succeeds, so an abandoned
 * sign-up leaves no partial user behind.
 */
export const useGoogleAuth = (onAuthenticated: (user?: any) => void) => {
  const { loginWithGoogle, verifyGoogleOtp, resendGoogleOtp, completeGoogleProfile } = useAuth();

  const [stage, setStage] = useState<Stage>('idle');
  const [challenge, setChallenge] = useState<GoogleChallenge | null>(null);
  const [email, setEmail] = useState('');
  const [suggestedName, setSuggestedName] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStage('idle');
    setChallenge(null);
    setEmail('');
    setSuggestedName('');
  };

  /** Returns an error message to display, or null when handled. */
  const start = async (): Promise<string | null> => {
    setBusy(true);
    const res = await loginWithGoogle();
    setBusy(false);

    if (res.success && res.otpRequired && res.googleChallenge) {
      setChallenge(res.googleChallenge);
      setStage('otp');
      return null;
    }
    if (res.success) {
      onAuthenticated(res.user);
      return null;
    }
    return res.message || 'Google sign-in failed';
  };

  const verifyOtp = async (otp: string) => {
    if (!challenge) return { success: false, message: 'This session has expired. Please try again.' };

    const res = await verifyGoogleOtp(challenge.googleToken, otp);
    if (res.success && res.needsProfile && res.googleChallenge) {
      setChallenge(res.googleChallenge);
      setSuggestedName(res.suggestedName || '');
      // The verify response carries the real (unmasked) address for the modal.
      setEmail(res.email || challenge.sentTo || '');
      setStage('profile');
    }
    return { success: res.success, message: res.message };
  };

  const resendOtp = async () => {
    if (!challenge) return { success: false, message: 'This session has expired. Please try again.' };
    const res = await resendGoogleOtp(challenge.googleToken);
    if (res.success && res.googleChallenge) setChallenge(res.googleChallenge);
    return { success: res.success, message: res.message };
  };

  const completeProfile = async (name: string, phone: string) => {
    if (!challenge) return { success: false, message: 'This session has expired. Please try again.' };
    return completeGoogleProfile(challenge.googleToken, name, phone);
  };

  return {
    stage,
    challenge,
    email,
    setEmail,
    suggestedName,
    busy,
    start,
    verifyOtp,
    resendOtp,
    completeProfile,
    reset,
  };
};

export default useGoogleAuth;
