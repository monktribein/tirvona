import { useCallback, useEffect, useState } from 'react';
import { leadApi, leadSession } from '../services/leadApi';

export function useLeadAuth() {
  const [agent, setAgent] = useState(() => leadSession.getAgent());
  const [checking, setChecking] = useState(Boolean(leadSession.getToken()));

  useEffect(() => {
    if (!leadSession.getToken()) return;
    let cancelled = false;
    const persistent = leadSession.isPersistent();

    leadApi
      .me()
      .then((fresh) => {
        if (cancelled) return;
        leadSession.save(leadSession.getToken(), fresh, persistent);
        setAgent(fresh);
      })
      .catch(() => {
        if (!cancelled) setAgent(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (phone, password, remember = false) => {
    const result = await leadApi.login(phone, password);
    leadSession.save(result.token, result.user, remember);
    setAgent(result.user);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    leadSession.clear();
    setAgent(null);
  }, []);

  return { agent, checking, isSignedIn: Boolean(agent), login, logout };
}
