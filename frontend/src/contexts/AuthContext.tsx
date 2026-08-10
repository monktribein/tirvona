import React, { createContext, useState, useEffect, useContext } from "react";
import { authService } from "../services";
import { getErrorMessage, TOKEN_KEY } from "../lib/api";
import { signInWithGoogle } from "../lib/googleAuth";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  district?: string;
  state?: string;
  /**
   * Active parking grants from `parking_staff`. Parking authorisation is not a
   * value of `role` — a guard or partner reads `customer` like any pilgrim — so
   * this is the only signal that an account is parking staff.
   */
  parkingRoles?: string[];
}

// Returned when the backend answers a password login / registration with an OTP
// challenge instead of a session. `otpToken` is a short-lived pending token that
// identifies the challenge — it is NOT a session token and is never persisted.
export interface OtpChallenge {
  otpToken: string;
  type: "PHONE_REGISTER" | "EMAIL_REGISTER" | "EMAIL_LOGIN" | "MOBILE_LOGIN";
  channel: "sms" | "email";
  /** Already masked by the server, e.g. "s***7@gmail.com" or "98****3210". */
  sentTo?: string;
  expiresAt: string;
}

/** Google sign-up state carried between the OTP step and the profile step. */
export interface GoogleChallenge {
  googleToken: string;
  channel: "email";
  type?: string;
  sentTo?: string;
  expiresAt?: string;
}

interface AuthResult {
  success: boolean;
  message?: string;
  isSuspended?: boolean;
  suspensionData?: any;
  otpRequired?: boolean;
  challenge?: OtpChallenge;
  /** Google sign-up needs an email OTP before the account is created. */
  googleChallenge?: GoogleChallenge;
  /** OTP passed; still needs a name + mobile number to create the account. */
  needsProfile?: boolean;
  suggestedName?: string;
  /** Verified Google address, returned once the OTP step passes. */
  email?: string;
  /** The signed-in user, so callers can route by role without re-reading context. */
  user?: User;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  loginOTP: (phone: string, otp: string) => Promise<AuthResult>;
  verifyLoginOtp: (otpToken: string, otp: string) => Promise<AuthResult>;
  verifyRegistrationOtp: (otpToken: string, otp: string) => Promise<AuthResult>;
  resendOtp: (otpToken: string) => Promise<{
    success: boolean;
    message?: string;
    challenge?: OtpChallenge;
  }>;
  registerUser: (userData: any) => Promise<AuthResult>;
  // ── Google Sign-In ──
  loginWithGoogle: () => Promise<AuthResult>;
  verifyGoogleOtp: (googleToken: string, otp: string) => Promise<AuthResult>;
  resendGoogleOtp: (googleToken: string) => Promise<{
    success: boolean;
    message?: string;
    googleChallenge?: GoogleChallenge;
  }>;
  completeGoogleProfile: (
    googleToken: string,
    name: string,
    phone: string,
  ) => Promise<AuthResult>;
  /** Re-fetch the signed-in user, e.g. after they edit their own profile. */
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clearExpiredSession = () => {
      setToken(null);
      setUser(null);
      setLoading(false);
    };
    window.addEventListener("tirvona:unauthorized", clearExpiredSession);
    return () =>
      window.removeEventListener("tirvona:unauthorized", clearExpiredSession);
  }, []);

  // Recover from legacy login responses that contained an OTP challenge but
  // were mistakenly persisted as if they were a complete user session.
  useEffect(() => {
    if (user && (!token || (!user.id && !(user as any)._id))) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  }, [token, user]);

  // Restore session from stored token on mount.
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken && savedToken !== "undefined" && savedToken !== "null") {
      setToken(savedToken);
      fetchUserProfile();
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const res = await authService.me();
      if (res.data.success) {
        setUser(res.data.data);
      } else {
        logout();
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const persistSession = (data: any): boolean => {
    if (!data?.token || (!data?.id && !data?._id)) return false;
    const { token: userToken, ...userData } = data;
    localStorage.setItem(TOKEN_KEY, userToken);
    setToken(userToken);
    setUser(userData);
    return true;
  };

  const login = async (
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    try {
      const res = await authService.login(email, password);
      // Guest Visitors get an OTP challenge instead of a session. No token is
      // stored here — the session only exists after the code is verified.
      if (res.data.success) {
        if (!persistSession(res.data.data)) {
          return {
            success: false,
            message:
              "A valid login session was not created. Restart the backend and try again.",
          };
        }
        return { success: true, user: res.data.data };
      }
      return {
        success: false,
        message: res.data.message || "Login failed",
        isSuspended: res.data.isSuspended,
        suspensionData: res.data.suspensionData,
      };
    } catch (err: any) {
      if (err.response?.data?.isSuspended) {
        return {
          success: false,
          message: err.response.data.message || "Account Suspended",
          isSuspended: true,
          suspensionData: err.response.data.suspensionData,
        };
      }
      return {
        success: false,
        message: getErrorMessage(err, "Invalid credentials"),
      };
    }
  };

  // Returns the signed-in user alongside the result. Callers that navigate by
  // role cannot read it from context here — `setUser` has not flushed yet, so
  // the value in their closure is still the previous one (usually null).
  const loginOTP = async (phone: string, otp: string): Promise<AuthResult> => {
    try {
      const res = await authService.verifyOtp(phone, otp);
      if (res.data.success) {
        persistSession(res.data.data);
        return { success: true, user: res.data.data };
      }
      return {
        success: false,
        message: res.data.message || "Invalid OTP code",
      };
    } catch (err) {
      return { success: false, message: getErrorMessage(err, "Invalid OTP") };
    }
  };

  const registerUser = async (userData: any): Promise<AuthResult> => {
    try {
      const res = await authService.register(userData);
      // Guest Visitor registrations return an OTP challenge; Ashram Owner
      // registrations still return a session immediately, unchanged.
      if (res.data.success && res.data.otpRequired) {
        return {
          success: true,
          otpRequired: true,
          challenge: res.data.data,
          message: res.data.message,
        };
      }
      if (res.data.success) {
        persistSession(res.data.data);
        return { success: true };
      }
      return {
        success: false,
        message: res.data.message || "Registration failed",
      };
    } catch (err) {
      return {
        success: false,
        message: getErrorMessage(err, "Error occurred"),
      };
    }
  };

  // ── OTP challenge completion ───────────────────────────────────────────────
  // Both verifiers return a full session on success and persist it, so the
  // caller only has to navigate.
  const completeChallenge = async (
    request: Promise<{ data: any }>,
    fallback: string,
  ): Promise<AuthResult> => {
    try {
      const res = await request;
      if (res.data.success) {
        persistSession(res.data.data);
        // Carried back for the same reason as loginOTP: context state is not
        // readable by the caller until after this render commits.
        return { success: true, user: res.data.data };
      }
      return { success: false, message: res.data.message || fallback };
    } catch (err) {
      return { success: false, message: getErrorMessage(err, fallback) };
    }
  };

  const verifyLoginOtp = (otpToken: string, otp: string) =>
    completeChallenge(authService.verifyLoginOtp(otpToken, otp), "Invalid OTP");

  const verifyRegistrationOtp = (otpToken: string, otp: string) =>
    completeChallenge(
      authService.verifyRegistrationOtp(otpToken, otp),
      "Invalid OTP",
    );

  // ── Google Sign-In ─────────────────────────────────────────────────────────

  /**
   * Opens Google's chooser and exchanges the ID token with our API.
   * Returning users get a session immediately; new users get an email OTP
   * challenge, and no account exists until the profile step completes.
   */
  const loginWithGoogle = async (): Promise<AuthResult> => {
    let credential: string;
    try {
      credential = await signInWithGoogle();
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || "Google sign-in was cancelled.",
      };
    }

    try {
      const res = await authService.google(credential);
      if (res.data.success && res.data.otpRequired) {
        return {
          success: true,
          otpRequired: true,
          googleChallenge: res.data.data,
          message: res.data.message,
        };
      }
      if (res.data.success) {
        persistSession(res.data.data);
        return {
          success: true,
          message: res.data.message,
          user: res.data.data,
        };
      }
      return {
        success: false,
        message: res.data.message || "Google sign-in failed",
      };
    } catch (err: any) {
      if (err.response?.data?.isSuspended) {
        return {
          success: false,
          message: err.response.data.message || "Account Suspended",
          isSuspended: true,
          suspensionData: err.response.data.suspensionData,
        };
      }
      return {
        success: false,
        message: getErrorMessage(err, "Google sign-in failed"),
      };
    }
  };

  const verifyGoogleOtp = async (
    googleToken: string,
    otp: string,
  ): Promise<AuthResult> => {
    try {
      const res = await authService.googleVerifyOtp(googleToken, otp);
      if (res.data.success) {
        // Verified, but the account is not created until name + phone arrive.
        return {
          success: true,
          needsProfile: true,
          googleChallenge: {
            googleToken: res.data.data.googleToken,
            channel: "email",
          },
          suggestedName: res.data.data.suggestedName,
          email: res.data.data.email,
          message: res.data.message,
        };
      }
      return { success: false, message: res.data.message || "Invalid OTP" };
    } catch (err) {
      return { success: false, message: getErrorMessage(err, "Invalid OTP") };
    }
  };

  const resendGoogleOtp = async (googleToken: string) => {
    try {
      const res = await authService.googleResendOtp(googleToken);
      if (res.data.success) {
        return {
          success: true,
          message: res.data.message,
          googleChallenge: res.data.data,
        };
      }
      return {
        success: false,
        message: res.data.message || "Could not resend OTP",
      };
    } catch (err) {
      return {
        success: false,
        message: getErrorMessage(err, "Could not resend OTP"),
      };
    }
  };

  const completeGoogleProfile = async (
    googleToken: string,
    name: string,
    phone: string,
  ): Promise<AuthResult> => {
    try {
      const res = await authService.googleComplete(googleToken, name, phone);
      if (res.data.success) {
        persistSession(res.data.data);
        return { success: true, message: res.data.message, user: res.data.data };
      }
      return {
        success: false,
        message: res.data.message || "Could not finish creating your account",
      };
    } catch (err) {
      return {
        success: false,
        message: getErrorMessage(err, "Could not finish creating your account"),
      };
    }
  };

  const resendOtp = async (otpToken: string) => {
    try {
      const res = await authService.resendOtp(otpToken);
      if (res.data.success) {
        return {
          success: true,
          message: res.data.message,
          challenge: res.data.data,
        };
      }
      return {
        success: false,
        message: res.data.message || "Could not resend OTP",
      };
    } catch (err) {
      return {
        success: false,
        message: getErrorMessage(err, "Could not resend OTP"),
      };
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem("sidebar_open_group");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        loginOTP,
        registerUser,
        logout,
        refreshUser: fetchUserProfile,
        verifyLoginOtp,
        verifyRegistrationOtp,
        resendOtp,
        loginWithGoogle,
        verifyGoogleOtp,
        resendGoogleOtp,
        completeGoogleProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
