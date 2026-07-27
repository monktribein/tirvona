// Shared Admin Middlewares
import { protect, authorize } from '../../middlewares/auth.js';

export const adminProtect = protect;
export const adminAuthorize = (...roles) => authorize(...roles);
