/**
 * leadPayload.js
 *
 * Translates between the capture form's shape and what the Lead Collection
 * API accepts.
 *
 * The form keeps every numeric field as a string because that is what an
 * `<input>` gives back, and an untouched box holds `''`. The API validates
 * numbers strictly, and `Number('')` is `0` — which would silently record an
 * ashram as having zero rooms rather than "not asked". So blanks are dropped
 * from the payload entirely instead of being coerced.
 */

const numberOrUndefined = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Strip keys whose value is `undefined` so they are omitted from the JSON. */
const compact = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );

export const toApiLead = (lead) => ({
  name: (lead.name || '').trim(),
  location: {
    address: lead.location?.address || '',
    city: lead.location?.city || '',
    district: lead.location?.district || '',
    state: lead.location?.state || '',
    coordinates: compact({
      lat: numberOrUndefined(lead.location?.coordinates?.lat),
      lng: numberOrUndefined(lead.location?.coordinates?.lng)
    })
  },
  roomInventory: compact({
    totalRooms: numberOrUndefined(lead.roomInventory?.totalRooms),
    roomPrice: numberOrUndefined(lead.roomInventory?.roomPrice),
    onlineRooms: numberOrUndefined(lead.roomInventory?.onlineRooms),
    offlineRooms: numberOrUndefined(lead.roomInventory?.offlineRooms)
  }),
  contact: {
    ownerName: lead.contact?.ownerName || '',
    phone: lead.contact?.phone || ''
  },
  notes: lead.notes || '',
  interest: lead.interest || 'Interested',
  meeting: {
    requested: Boolean(lead.meeting?.requested),
    time: lead.meeting?.requested ? lead.meeting.time || '' : '',
    mode: lead.meeting?.requested ? lead.meeting.mode || '' : ''
  },
  images: Array.isArray(lead.images) ? lead.images.slice(0, 10) : []
});

/**
 * Server record → the shape the existing cards render. Keeps `id` alongside
 * `_id` so LeadCard and the dashboard need no changes.
 */
export const fromApiLead = (row) => ({
  ...row,
  id: row._id,
  createdAt: row.capturedAt || row.createdAt
});

/**
 * An approved lead, presented as the Tirvona ashram document it will become.
 * Read-only here — the real listing is created by an admin in the console.
 */
export const toApprovedAshram = (row) => ({
  id: row._id,
  leadId: row._id,
  name: row.name,
  address: row.location?.address || '',
  city: row.location?.city || '',
  district: row.location?.district || '',
  state: row.location?.state || '',
  location: {
    type: 'Point',
    coordinates: [
      row.location?.coordinates?.lng ?? 0,
      row.location?.coordinates?.lat ?? 0
    ]
  },
  contactNumber: row.contact?.phone || '',
  trusteeName: row.contact?.ownerName || '',
  isVerified: true,
  status: row.status === 'converted' ? 'ACTIVE' : 'APPROVED',
  notes: row.notes || '',
  approvedAt: row.reviewedAt || row.updatedAt,
  images: row.images || []
});
