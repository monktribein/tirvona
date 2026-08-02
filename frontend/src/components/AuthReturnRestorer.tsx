import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  clearGuestPendingIntent,
  currentReturnUrl,
  getGuestPendingIntent,
  restorePendingPageSnapshot,
  setGuestPendingIntent,
} from "../utils/guestGate";

/** Handles an expired session and restores safe page controls after login. */
export const AuthReturnRestorer = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onUnauthorized = () => {
      const returnUrl = currentReturnUrl();
      if (returnUrl.startsWith("/login") || returnUrl.startsWith("/register"))
        return;
      setGuestPendingIntent({ type: "generic", returnUrl });
      navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`, {
        replace: true,
      });
    };
    window.addEventListener("tirvona:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener("tirvona:unauthorized", onUnauthorized);
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    const intent = getGuestPendingIntent();
    if (!intent || intent.returnUrl !== currentReturnUrl()) return;

    // Domain pages with structured data consume and clear their own intent.
    if (intent.data && Object.keys(intent.data).length > 0) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (restorePendingPageSnapshot() || attempts >= 10) {
        clearGuestPendingIntent();
        window.clearInterval(timer);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [user, location.pathname, location.search, location.hash]);

  return null;
};

export default AuthReturnRestorer;
