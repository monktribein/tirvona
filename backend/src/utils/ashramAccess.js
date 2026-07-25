// Central authorization helper: can this user manage this specific ashram?
// - super_admin  → any ashram
// - owner        → only ashrams they own
// - manager      → only the ashram they are employed at (employerAshramId)
// Reception/housekeeping are operational roles and are handled by dedicated
// booking/housekeeping endpoints, not general ashram/room management.
export const canManageAshram = (user, ashram) => {
  if (!user || !ashram) return false;
  if (user.role === 'super_admin') return true;

  const ashramId = (ashram._id || ashram).toString();

  if (user.role === 'owner') {
    return ashram.ownerId?.toString() === user.id;
  }
  if (user.role === 'manager') {
    return user.employerAshramId?.toString() === ashramId;
  }
  return false;
};

// The set of ashram ids a user is scoped to (for list/dashboard queries).
// Returns null when the user should see everything (super_admin).
export const scopedAshramIds = async (user, AshramModel) => {
  if (user.role === 'super_admin') return null;
  if (user.role === 'owner') {
    const owned = await AshramModel.find({ ownerId: user.id }).select('_id');
    return owned.map((a) => a._id);
  }
  if (['manager', 'reception', 'housekeeping'].includes(user.role) && user.employerAshramId) {
    return [user.employerAshramId];
  }
  return [];
};
