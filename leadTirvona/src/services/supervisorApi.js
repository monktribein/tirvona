
import { leadSession, LEAD_API_BASE } from './leadApi';

const SUPERVISOR_BASE = LEAD_API_BASE.replace(
  '/lead-collection',
  '/lead-collection/supervisor',
);

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
  getDashboard: () => request('/dashboard'),

  listAgents: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString();
    return request(`/agents${query ? `?${query}` : ''}`);
  },

  getAgent: (agentId) => request(`/agents/${agentId}`),

  getAgentLeads: (agentId, params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString();
    return request(`/agents/${agentId}/leads${query ? `?${query}` : ''}`);
  },

  getAgentLead: (agentId, leadId) =>
    request(`/agents/${agentId}/leads/${leadId}`),

  createAgent: (data) => request('/agents', { method: 'POST', body: data }),

  updateAgent: (agentId, data) =>
    request(`/agents/${agentId}`, { method: 'PUT', body: data }),

  resetAgentPassword: (agentId, password) =>
    request(`/agents/${agentId}/reset-password`, {
      method: 'POST',
      body: { password },
    }),

  deleteAgent: (agentId) =>
    request(`/agents/${agentId}`, { method: 'DELETE' }),

  updateAgentLead: (agentId, leadId, data) =>
    request(`/agents/${agentId}/leads/${leadId}`, {
      method: 'PUT',
      body: data,
    }),
};

