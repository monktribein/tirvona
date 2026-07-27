import MarketplaceWaitlist from '../models/MarketplaceWaitlist.js';

export const subscribeWaitlist = async (req, res) => {
  try {
    const { email, role } = req.body;
    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const existing = await MarketplaceWaitlist.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(200).json({ success: true, message: 'You are already on the VIP waitlist!', data: existing });
    }

    const newWaitlist = await MarketplaceWaitlist.create({
      email: email.toLowerCase(),
      role: role || 'buyer',
    });

    return res.status(201).json({ success: true, message: 'Subscribed to VIP waitlist successfully!', data: newWaitlist });
  } catch (error) {
    console.error('Error subscribing to waitlist:', error);
    return res.status(500).json({ success: false, message: 'Server error joining waitlist' });
  }
};
