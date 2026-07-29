import { uploadBuffer, isCloudinaryConfigured } from '../config/cloudinary.js';
import { resourceTypeFor } from '../middlewares/upload.js';

// @desc    Upload a single file to Cloudinary
// @route   POST /api/uploads   (multipart/form-data, field: "file", optional "folder")
// @access  Private
//
// Cloudinary is the only destination. The previous local-disk fallback was
// removed deliberately: the API runs on an ephemeral filesystem (Render), so
// anything written to public/uploads disappears on the next deploy, leaving
// dead image URLs in the database — and it also produced host-relative
// localhost URLs that break outside the dev machine.
export const uploadSingle = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided (expected form field "file")' });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Image uploads are unavailable: the media storage service is not configured.',
      });
    }

    const folder = req.body.folder ? `ashray-bharat/${req.body.folder}` : 'ashray-bharat/uploads';

    try {
      const result = await uploadBuffer(req.file.buffer, {
        folder,
        resourceType: resourceTypeFor(req.file.mimetype),
      });

      return res.status(201).json({
        success: true,
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          bytes: result.bytes,
          format: result.format,
        },
      });
    } catch (cloudErr) {
      // Fail loudly. Silently writing to local disk here is what created the
      // localhost-URL records that break in production.
      console.error('Cloudinary upload failed:', cloudErr.message);
      return res.status(502).json({
        success: false,
        message: 'Image upload failed. Please try again.',
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'File upload failed' });
  }
};
