import { useState } from "react";
import { useAuth, type GoogleChallenge } from "../contexts/AuthContext";

type Stage = "idle" | "otp" | "profile";

export const useGoogleAuth = (onAuthenticated: (user?: any) => void) => {
  const {
    loginWithGoogle,
    verifyGoogleOtp,
    resendGoogleOtp,
    completeGoogleProfile,
  } = useAuth();

  const [stage, setStage] = useState<Stage>("idle");
  const [challenge, setChallenge] = useState<GoogleChallenge | null>(null);
  const [email, setEmail] = useState("");
  const [suggestedName, setSuggestedName] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStage("idle");
    setChallenge(null);
    setEmail("");
    setSuggestedName("");
  };

  const start = async (): Promise<string | null> => {
    setBusy(true);
    const res = await loginWithGoogle();
    setBusy(false);

    if (res.success && res.otpRequired && res.googleChallenge) {
      setChallenge(res.googleChallenge);
      setStage("otp");
      return null;
    }
    if (res.success) {
      onAuthenticated(res.user);
      return null;
    }
    return res.message || "Google sign-in failed";
  };

  const verifyOtp = async (otp: string) => {
    if (!challenge)
      return {
        success: false,
        message: "This session has expired. Please try again.",
      };

    const res = await verifyGoogleOtp(challenge.googleToken, otp);
    if (res.success && res.needsProfile && res.googleChallenge) {
      setChallenge(res.googleChallenge);
      setSuggestedName(res.suggestedName || "");
      setEmail(res.email || challenge.sentTo || "");
      setStage("profile");
    }
    return { success: res.success, message: res.message };
  };

  const resendOtp = async () => {
    if (!challenge)
      return {
        success: false,
        message: "This session has expired. Please try again.",
      };
    const res = await resendGoogleOtp(challenge.googleToken);
    if (res.success && res.googleChallenge) setChallenge(res.googleChallenge);
    return { success: res.success, message: res.message };
  };

  const completeProfile = async (name: string, phone: string) => {
    if (!challenge)
      return {
        success: false,
        message: "This session has expired. Please try again.",
      };
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
