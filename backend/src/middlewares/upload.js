import multer from 'multer';

// Keep files in memory; we stream the buffer straight to Cloudinary.
const storage = multer.memoryStorage();

const ALLOWED = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  raw: ['application/pdf'],
};

const fileFilter = (req, file, cb) => {
  const allowed = [...ALLOWED.image, ...ALLOWED.raw];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Allowed: JPG, PNG, WEBP, GIF, PDF.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

export const resourceTypeFor = (mimetype) =>
  ALLOWED.raw.includes(mimetype) ? 'raw' : 'image';
