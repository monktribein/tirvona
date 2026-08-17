
const RAW_BASE = (import.meta.env.VITE_LEAD_API_URL || 'http://localhost:5000')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export const LEAD_API_BASE = `${RAW_BASE}/api/lead-collection`;

const TOKEN_KEY = 'tirvona_lead_token';
const AGENT_KEY = 'tirvona_lead_agent';

export const leadSession = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getAgent: () => {
    try {
      const raw = localStorage.getItem(AGENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  save: (token, agent) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(AGENT_KEY, JSON.stringify(agent));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(AGENT_KEY);
  }
};

/**
 * Thin fetch wrapper. Throws an Error carrying the server's own message so
 * callers can surface it verbatim — "Invalid phone or password" is more use to
 * an agent than "Request failed".
 */
async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';

  const token = leadSession.getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${LEAD_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // A 204 or an HTML error page — fall through to the status-based message.
  }

  if (!response.ok) {
    // The session died server-side (suspended agent, password reset, expiry).
    // Clear it locally so the UI drops back to the sign-in state.
    if (response.status === 401) leadSession.clear();
    const message =
      payload?.message ||
      (response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : `Request failed (${response.status})`);
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  return payload?.data ?? payload;
}

export const leadApi = {
  login: (phone, password) =>
    request('/auth/login', {
      method: 'POST',
      body: { phone, password },
      auth: false
    }),

  me: () => request('/auth/me'),

  /** Leads captured by the signed-in agent, newest first. */
  listMyLeads: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== '' && value != null)
    ).toString();
    return request(`/agent/leads${query ? `?${query}` : ''}`);
  },

  myStats: () => request('/agent/leads/stats'),

  createLead: (lead) =>
    request('/agent/leads', { method: 'POST', body: lead }),

  updateLead: (id, lead) =>
    request(`/agent/leads/${id}`, { method: 'PUT', body: lead }),

  deleteLead: (id) => request(`/agent/leads/${id}`, { method: 'DELETE' })
};
