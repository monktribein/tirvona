/**
 * useLeadAuth.js
 *
 * Field-agent session for the lead app. Restores whatever is in localStorage
 * on mount and re-validates it against `/auth/me`, so an account suspended or
 * password-reset from the admin console is signed out here on next load
 * rather than appearing to still work.
 */
import { useCallback, useEffect, useState } from 'react';
import { leadApi, leadSession } from '../services/leadApi';

export function useLeadAuth() {
  const [agent, setAgent] = useState(() => leadSession.getAgent());
  const [checking, setChecking] = useState(Boolean(leadSession.getToken()));

  useEffect(() => {
    if (!leadSession.getToken()) return;
    let cancelled = false;

    leadApi
      .me()
      .then((fresh) => {
        if (cancelled) return;
        leadSession.save(leadSession.getToken(), fresh);
        setAgent(fresh);
      })
      .catch(() => {
        // `request()` already cleared the token on a 401.
        if (!cancelled) setAgent(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (phone, password) => {
    const result = await leadApi.login(phone, password);
    leadSession.save(result.token, result.user);
    setAgent(result.user);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    leadSession.clear();
    setAgent(null);
  }, []);

  return { agent, checking, isSignedIn: Boolean(agent), login, logout };
}
