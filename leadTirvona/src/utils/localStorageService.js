/**
 * localStorageService.js
 *
 * Responsibility: All read/write operations to localStorage for ashram field leads
 * and approved ashram entries. Also handles conversion to Tirvona-compatible MongoDB
 * GeoJSON structure when a lead is approved.
 *
 * localStorage keys used:
 *  - "ashram_leads"      → raw field lead submissions
 *  - "approved_ashrams"  → converted, Tirvona-ready ashram entities
 */

const LEADS_KEY = 'ashram_leads';
const APPROVED_ASHRAMS_KEY = 'approved_ashrams';

// ---------------------------------------------------------------------------
// Demo seed data (shown on first load / after reset)
// ---------------------------------------------------------------------------

const INITIAL_LEADS = [
  {
    id: 'lead-1723120000001',
    name: 'Parmarth Niketan Ashram',
    location: {
      address: 'Main Road, Swargashram',
      city: 'Rishikesh',
      state: 'Uttarakhand',
      coordinates: { lat: 30.1205, lng: 78.3135 }
    },
    contact: {
      phone: '+91 98765 43210',
      ownerName: 'Swami Chidanand Saraswati'
    },
    notes:
      'Visited ashram during evening Ganga Aarti. Owner expressed high interest in Tirvona digital check-in system for 150+ rooms. Requested live demo for trustee board.',
    interest: 'Interested',
    meeting: { requested: true, time: '2026-08-12T11:00', mode: 'In-person' },
    images: [],
    status: 'pending',
    createdAt: '2026-08-08T09:30:00.000Z'
  },
  {
    id: 'lead-1723120000002',
    name: 'Kashi Annapurna Sadhana Ashram',
    location: {
      address: 'D-37/42 Godowlia Corridor',
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      coordinates: { lat: 25.3109, lng: 83.0104 }
    },
    contact: {
      phone: '+91 94152 88990',
      ownerName: 'Mahant Rameshwar Giri'
    },
    notes: 'Discussed pilgrim counter management. Trustee approved trial onboarding for 40 Satvic rooms.',
    interest: 'Interested',
    meeting: { requested: true, time: '2026-08-10T15:30', mode: 'Call' },
    images: [],
    status: 'approved',
    createdAt: '2026-08-07T14:15:00.000Z'
  }
];

const INITIAL_APPROVED_ASHRAMS = [
  {
    id: 'ashram-1723120000002',
    leadId: 'lead-1723120000002',
    name: 'Kashi Annapurna Sadhana Ashram',
    address: 'D-37/42 Godowlia Corridor',
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    location: {
      type: 'Point',
      coordinates: [83.0104, 25.3109] // GeoJSON standard: [lng, lat]
    },
    contactNumber: '+91 94152 88990',
    trusteeName: 'Mahant Rameshwar Giri',
    isVerified: true,
    status: 'ACTIVE',
    notes: 'Discussed pilgrim counter management. Trustee approved trial onboarding for 40 Satvic rooms.',
    approvedAt: '2026-08-08T10:00:00.000Z',
    images: []
  }
];

// ---------------------------------------------------------------------------
// Lead CRUD operations
// ---------------------------------------------------------------------------

export const getLeads = () => {
  try {
    const data = localStorage.getItem(LEADS_KEY);
    if (!data) {
      localStorage.setItem(LEADS_KEY, JSON.stringify(INITIAL_LEADS));
      return INITIAL_LEADS;
    }
    return JSON.parse(data);
  } catch (err) {
    console.error('[localStorageService] Failed to read leads:', err);
    return INITIAL_LEADS;
  }
};

export const saveLead = (newLeadData) => {
  const leads = getLeads();
  const leadToSave = {
    id: `lead-${Date.now()}`,
    ...newLeadData,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  localStorage.setItem(LEADS_KEY, JSON.stringify([leadToSave, ...leads]));
  return leadToSave;
};

export const updateLeadStatus = (leadId, newStatus) => {
  const leads = getLeads();
  const index = leads.findIndex((l) => l.id === leadId);
  if (index === -1) return null;

  leads[index].status = newStatus;
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));

  if (newStatus === 'approved') {
    convertLeadToApprovedAshram(leads[index]);
  }

  return leads[index];
};

export const deleteLead = (leadId) => {
  const filtered = getLeads().filter((l) => l.id !== leadId);
  localStorage.setItem(LEADS_KEY, JSON.stringify(filtered));
  return filtered;
};

// ---------------------------------------------------------------------------
// Approved Ashrams (Tirvona-compatible GeoJSON structure)
// ---------------------------------------------------------------------------

export const getApprovedAshrams = () => {
  try {
    const data = localStorage.getItem(APPROVED_ASHRAMS_KEY);
    if (!data) {
      localStorage.setItem(APPROVED_ASHRAMS_KEY, JSON.stringify(INITIAL_APPROVED_ASHRAMS));
      return INITIAL_APPROVED_ASHRAMS;
    }
    return JSON.parse(data);
  } catch (err) {
    console.error('[localStorageService] Failed to read approved ashrams:', err);
    return INITIAL_APPROVED_ASHRAMS;
  }
};

/**
 * Converts an approved lead into the standard Tirvona Ashram MongoDB document
 * with GeoJSON 2D-sphere location and persists it to "approved_ashrams".
 */
export const convertLeadToApprovedAshram = (lead) => {
  const existing = getApprovedAshrams();
  if (existing.some((a) => a.leadId === lead.id)) return existing;

  const tirvonaAshramDocument = {
    id: `ashram-${Date.now()}`,
    leadId: lead.id,
    name: lead.name,
    address: lead.location.address,
    city: lead.location.city,
    state: lead.location.state,
    location: {
      type: 'Point',
      coordinates: [
        lead.location.coordinates.lng ? parseFloat(lead.location.coordinates.lng) : 0,
        lead.location.coordinates.lat ? parseFloat(lead.location.coordinates.lat) : 0
      ]
    },
    contactNumber: lead.contact.phone,
    trusteeName: lead.contact.ownerName,
    isVerified: true,
    status: 'ACTIVE',
    notes: lead.notes,
    approvedAt: new Date().toISOString(),
    images: lead.images || []
  };

  const updated = [tirvonaAshramDocument, ...existing];
  localStorage.setItem(APPROVED_ASHRAMS_KEY, JSON.stringify(updated));
  return tirvonaAshramDocument;
};

// ---------------------------------------------------------------------------
// Dev utility: reset storage to initial demo state
// ---------------------------------------------------------------------------

export const resetToInitialDemoData = () => {
  localStorage.setItem(LEADS_KEY, JSON.stringify(INITIAL_LEADS));
  localStorage.setItem(APPROVED_ASHRAMS_KEY, JSON.stringify(INITIAL_APPROVED_ASHRAMS));
  return { leads: INITIAL_LEADS, approved: INITIAL_APPROVED_ASHRAMS };
};
