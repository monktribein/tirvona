import { uploadBuffer, isCloudinaryConfigured } from '../config/cloudinary.js';
import { resourceTypeFor } from '../middlewares/upload.js';

// @desc    Upload a single file to Cloudinary
// @route   POST /api/uploads   (multipart/form-data, field: "file", optional "folder")
// @access  Private
export const uploadSingle = async (req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'File uploads are not configured on this server (missing Cloudinary credentials).',
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided (expected form field "file")' });
    }

    const folder = req.body.folder ? `ashray-bharat/${req.body.folder}` : 'ashray-bharat/uploads';
    const result = await uploadBuffer(req.file.buffer, {
      folder,
      resourceType: resourceTypeFor(req.file.mimetype),
    });

    res.status(201).json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        bytes: result.bytes,
        format: result.format,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'File upload failed' });
  }
};
