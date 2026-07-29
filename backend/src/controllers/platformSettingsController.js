import PlatformSettings from '../models/PlatformSettings.js';

// Helper to ensure main settings document exists
const getOrCreateSettings = async () => {
  let settings = await PlatformSettings.findOne({ key: 'main' });
  if (!settings) {
    settings = await PlatformSettings.create({
      key: 'main',
      platformFee: {
        enabled: true,
        type: 'flat',
        value: 49,
        label: 'Tirvona Platform Fee',
      },
      gstRate: 5,
    });
  }
  return settings;
};

// @desc    Get Platform Settings
// @route   GET /api/platform-settings
// @access  Public
export const getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('getSettings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch platform settings' });
  }
};

// @desc    Update Platform Settings
// @route   PUT /api/platform-settings
// @access  Private (Super Admin / Manager)
export const updateSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    const { platformFee, gstRate } = req.body;

    if (platformFee) {
      if (platformFee.enabled !== undefined) settings.platformFee.enabled = Boolean(platformFee.enabled);
      if (platformFee.type && ['flat', 'percentage'].includes(platformFee.type)) {
        settings.platformFee.type = platformFee.type;
      }
      if (platformFee.value !== undefined) {
        settings.platformFee.value = Math.max(0, parseFloat(platformFee.value) || 0);
      }
      if (platformFee.label !== undefined) settings.platformFee.label = platformFee.label.trim() || 'Tirvona Platform Fee';
    }

    if (gstRate !== undefined) {
      settings.gstRate = Math.max(0, parseFloat(gstRate) || 0);
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Platform settings updated successfully',
      data: settings,
    });
  } catch (error) {
    console.error('updateSettings error:', error);
    res.status(500).json({ success: false, message: 'Failed to update platform settings' });
  }
};
