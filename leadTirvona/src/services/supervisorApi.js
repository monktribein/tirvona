/**
 * supervisorApi.js — API client for the supervisor dashboard.
 *
 * Talks to the Lead Collection supervisor endpoints. Uses the same session
 * token as the field agent — the backend distinguishes the two by role, not
 * by token scope — so `leadSession` is shared.
 */

import { leadSession, LEAD_API_BASE } from './leadApi';

const SUPERVISOR_BASE = LEAD_API_BASE.replace(
  '/lead-collection',
  '/lead-collection/supervisor',
);

/**
 * Thin fetch wrapper identical to the one in leadApi.js.
 * Throws an Error with the server's own message.
 */
async function request(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';

  const token = leadSession.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${SUPERVISOR_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // 204 or HTML error page
  }

  if (!response.ok) {
    if (response.status === 401) leadSession.clear();
    const message =
      payload?.message ||
      (response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : response.status === 403
          ? 'You do not have permission to access this resource.'
          : `Request failed (${response.status})`);
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  return payload?.data ?? payload;
}

export const supervisorApi = {
  /** Dashboard overview: stats + agent count for the supervisor's district. */
  getDashboard: () => request('/dashboard'),

  /** All field agents in the supervisor's district. */
  listAgents: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString();
    return request(`/agents${query ? `?${query}` : ''}`);
  },

  /** Single agent detail (with lead stats). */
  getAgent: (agentId) => request(`/agents/${agentId}`),

  /** Leads created by a specific agent. */
  getAgentLeads: (agentId, params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString();
    return request(`/agents/${agentId}/leads${query ? `?${query}` : ''}`);
  },

  /** Single lead detail. */
  getAgentLead: (agentId, leadId) =>
    request(`/agents/${agentId}/leads/${leadId}`),

  /** Create a new field agent in the supervisor's district. */
  createAgent: (data) => request('/agents', { method: 'POST', body: data }),

  /** Update an existing field agent. */
  updateAgent: (agentId, data) =>
    request(`/agents/${agentId}`, { method: 'PUT', body: data }),

  /** Reset agent's password. */
  resetAgentPassword: (agentId, password) =>
    request(`/agents/${agentId}/reset-password`, {
      method: 'POST',
      body: { password },
    }),

  /** Delete field agent account (leads retained). */
  deleteAgent: (agentId) =>
    request(`/agents/${agentId}`, { method: 'DELETE' }),

  /** Update a lead captured by an agent. */
  updateAgentLead: (agentId, leadId, data) =>
    request(`/agents/${agentId}/leads/${leadId}`, {
      method: 'PUT',
      body: data,
    }),
};

