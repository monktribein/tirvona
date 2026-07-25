import path from 'path';
import fs from 'fs';
import { uploadBuffer, isCloudinaryConfigured } from '../config/cloudinary.js';
import { resourceTypeFor } from '../middlewares/upload.js';

// @desc    Upload a single file to Cloudinary (with local disk fallback)
// @route   POST /api/uploads   (multipart/form-data, field: "file", optional "folder")
// @access  Private
export const uploadSingle = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided (expected form field "file")' });
    }

    // 1. Try Cloudinary if configured
    if (isCloudinaryConfigured()) {
      try {
        const folder = req.body.folder ? `ashray-bharat/${req.body.folder}` : 'ashray-bharat/uploads';
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
        console.warn('Cloudinary upload warning, falling back to local storage:', cloudErr.message);
      }
    }

    // 2. Local File Storage Fallback (guarantees direct upload from computer works 100%)
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, req.file.buffer);

    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5000';
    const localUrl = `${baseUrl.replace(/\/$/, '')}/uploads/${filename}`;

    return res.status(201).json({
      success: true,
      data: {
        url: localUrl,
        filename,
        resourceType: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'File upload failed' });
  }
};
