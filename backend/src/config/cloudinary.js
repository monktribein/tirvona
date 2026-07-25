import { v2 as cloudinary } from 'cloudinary';
import config from './env.js';

// Configure the Cloudinary SDK from environment variables.
// Uploads are disabled (endpoints return 503) when credentials are absent, so
// the rest of the app still runs locally without a Cloudinary account.
if (config.cloudinary.configured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

export const isCloudinaryConfigured = () => config.cloudinary.configured;

// Upload a file buffer to Cloudinary using the streaming uploader.
export const uploadBuffer = (buffer, { folder = 'ashray-bharat', resourceType = 'image' } = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });

export default cloudinary;
