/**
 * formatDate.js — Clean Tirvona styling helpers
 */

export const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
};

export const formatMeetingDateTime = (datetimeLocalString) => {
  if (!datetimeLocalString) return 'Not specified';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date(datetimeLocalString));
  } catch {
    return datetimeLocalString;
  }
};

export const buildGoogleMapsUrl = (lat, lng) => {
  if (!lat || !lng) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

/**
 * Returns clean Tailwind badge styles matching Tirvona's subtle pill design
 */
export const getInterestBadgeStyle = (interest) => {
  switch (interest) {
    case 'Interested':
      return {
        bg: 'rgba(10, 77, 166, 0.08)',
        color: '#0A4DA6',
        border: '1px solid rgba(10, 77, 166, 0.2)'
      };
    case 'Not Interested':
      return {
        bg: 'rgba(239, 68, 68, 0.08)',
        color: '#DC2626',
        border: '1px solid rgba(239, 68, 68, 0.2)'
      };
    case 'Follow-up Required':
    default:
      return {
        bg: 'rgba(229, 140, 40, 0.08)',
        color: '#D97706',
        border: '1px solid rgba(229, 140, 40, 0.3)'
      };
  }
};
