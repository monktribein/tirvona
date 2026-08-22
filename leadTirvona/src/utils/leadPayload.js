
const numberOrUndefined = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const compact = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  );

export const toApiLead = (lead) => {
  const payload = {};
  if (lead.name !== undefined && lead.name !== '') payload.name = String(lead.name).trim();
  if (lead.location) {
    payload.location = {
      address: lead.location?.address || '',
      googleMapsUrl: lead.location?.googleMapsUrl || lead.googleMapsUrl || '',
      city: lead.location?.city || '',
      district: lead.location?.district || '',
      state: lead.location?.state || '',
      coordinates: compact({
        lat: numberOrUndefined(lead.location?.coordinates?.lat),
        lng: numberOrUndefined(lead.location?.coordinates?.lng)
      })
    };
  }
  if (lead.roomInventory) {
    payload.roomInventory = compact({
      totalRooms: numberOrUndefined(lead.roomInventory?.totalRooms),
      roomPrice: numberOrUndefined(lead.roomInventory?.roomPrice),
      onlineRooms: numberOrUndefined(lead.roomInventory?.onlineRooms),
      offlineRooms: numberOrUndefined(lead.roomInventory?.offlineRooms)
    });
  }
  if (lead.contact) {
    payload.contact = {
      ownerName: lead.contact?.ownerName || '',
      phone: lead.contact?.phone || ''
    };
  }
  if (lead.notes !== undefined) payload.notes = lead.notes;
  if (lead.agentNotes !== undefined) payload.agentNotes = lead.agentNotes;
  if (lead.interest !== undefined) payload.interest = lead.interest;
  if (lead.meeting !== undefined) {
    payload.meeting = {
      requested: Boolean(lead.meeting?.requested),
      time: lead.meeting?.requested ? lead.meeting.time || '' : '',
      mode: lead.meeting?.requested ? lead.meeting.mode || '' : ''
    };
  }
  if (Array.isArray(lead.images)) {
    payload.images = lead.images.slice(0, 50);
  }
  if (lead.assignedAgentId !== undefined) payload.assignedAgentId = lead.assignedAgentId;
  if (lead.assignedAgentName !== undefined) payload.assignedAgentName = lead.assignedAgentName;
  if (lead.assignedAgentCode !== undefined) payload.assignedAgentCode = lead.assignedAgentCode;
  if (lead.documentChecklist !== undefined) payload.documentChecklist = lead.documentChecklist;
  if (lead.documentCategory !== undefined) payload.documentCategory = lead.documentCategory;
  if (lead.docVerificationStatus !== undefined) payload.docVerificationStatus = lead.docVerificationStatus;
  if (lead.documentVerified !== undefined) payload.documentVerified = lead.documentVerified;
  if (lead.docVerifiedAt !== undefined) payload.docVerifiedAt = lead.docVerifiedAt;
  if (lead.docVerifiedByName !== undefined) payload.docVerifiedByName = lead.docVerifiedByName;
  if (lead.docVerifiedById !== undefined) payload.docVerifiedById = lead.docVerifiedById;
  if (lead.docVerificationNotes !== undefined) payload.docVerificationNotes = lead.docVerificationNotes;
  if (lead.fieldVerified !== undefined) payload.fieldVerified = lead.fieldVerified;
  if (lead.fieldVerifiedByName !== undefined) payload.fieldVerifiedByName = lead.fieldVerifiedByName;
  return payload;
};

export const fromApiLead = (row) => ({
  ...row,
  id: row._id,
  createdAt: row.capturedAt || row.createdAt
});

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
