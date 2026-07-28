import UserMemory from '../models/UserMemory.js';

// GET /api/user-memory - Fetch memory for current user or session
export const getUserMemory = async (req, res) => {
  try {
    const userId = req.user?._id;
    const sessionId = req.headers['x-session-id'] || 'guest-session-default';

    let query = {};
    if (userId) {
      query = { userId };
    } else {
      query = { sessionId };
    }

    let memory = await UserMemory.findOne(query);

    if (!memory) {
      memory = await UserMemory.create({
        userId: userId || null,
        sessionId: sessionId,
      });
    }

    return res.status(200).json({
      success: true,
      data: memory,
    });
  } catch (error) {
    console.error('getUserMemory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user memory profile.',
      error: error.message,
    });
  }
};

// POST /api/user-memory - Auto-save / sync user memory
export const saveUserMemory = async (req, res) => {
  try {
    const userId = req.user?._id;
    const sessionId = req.headers['x-session-id'] || 'guest-session-default';
    const memoryData = req.body;

    let query = userId ? { userId } : { sessionId };

    // Security check: strip passwords, CVV, OTP if accidentally passed
    delete memoryData.password;
    delete memoryData.cvv;
    delete memoryData.otp;

    const memory = await UserMemory.findOneAndUpdate(
      query,
      { $set: { ...memoryData, userId: userId || null, sessionId } },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'User memory synced successfully.',
      data: memory,
    });
  } catch (error) {
    console.error('saveUserMemory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync user memory.',
      error: error.message,
    });
  }
};

// DELETE /api/user-memory/:category - Clear specific memory section (e.g. after booking complete)
export const clearUserMemoryCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const userId = req.user?._id;
    const sessionId = req.headers['x-session-id'] || 'guest-session-default';

    const query = userId ? { userId } : { sessionId };
    const update = { [category]: category === 'marketplaceCart' || category === 'wishlist' ? [] : {} };

    await UserMemory.findOneAndUpdate(query, { $set: update });

    return res.status(200).json({
      success: true,
      message: `Cleared ${category} memory successfully.`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to clear memory section.',
    });
  }
};
