import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/env.js';

// Protect routes
export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, config.jwtSecret);

      // A pending-OTP token identifies a half-authenticated user mid-challenge.
      // It is signed with the same secret, so it must be explicitly rejected
      // here or it would work as a full session token.
      if (decoded.purpose === 'otp_pending' || decoded.purpose === 'google_pending') {
        return res.status(401).json({ success: false, message: 'OTP verification is not complete' });
      }

      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      // Token revocation: a bumped tokenVersion (e.g. after a password reset)
      // invalidates previously-issued tokens. Legacy tokens without `tv` are
      // grandfathered against the current version (both default to 0).
      if ((decoded.tv || 0) !== (user.tokenVersion || 0)) {
        return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      }

      if (user.status === 'suspended') {
        return res.status(403).json({ success: false, message: 'Your account is suspended. Contact support.' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.warn('JWT verification warning:', error.message);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

// Role-based access control (RBAC) middleware
export const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource`,
      });
    }

    // C1: role-gated access requires an ACTIVE account. Self-registered owners
    // remain 'pending' until a Super Admin approves them and must not reach any
    // owner/staff/admin API before then. (Suspended is already blocked earlier.)
    if (req.user.status && req.user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval and cannot access this resource yet.',
      });
    }
    next();
  };
};

export const authorize = restrictTo;
