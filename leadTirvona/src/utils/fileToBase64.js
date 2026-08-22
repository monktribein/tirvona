/**
 * fileToBase64.js — Convert a File / Blob object to base64 Data URL or Cloudinary URL
 */
import { leadApi, leadSession } from '../services/leadApi';

export async function fileToBase64(file) {
  if (!file) return '';

  // If agent is authenticated, attempt upload to backend / Cloudinary
  if (leadSession.getToken()) {
    try {
      const res = await leadApi.uploadAttachment(file, 'picker');
      if (res?.url) return res.url;
      if (typeof res === 'string') return res;
    } catch (err) {
      console.warn('Cloudinary upload failed, falling back to base64:', err);
    }
  }

  // Fallback to client-side base64 FileReader
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}
