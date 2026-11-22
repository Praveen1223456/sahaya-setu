const cloudinary = require('cloudinary').v2;
const env = require('../config/env');
const imaging = require('./imaging');

let isCloudinaryConfigured = false;
if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  isCloudinaryConfigured = true;
}

/**
 * Upload single buffer to Cloudinary or fallback to local disk
 * @param {Buffer} buffer
 * @param {string} folder - 'reports' or 'resolutions'
 * @returns {Promise<string>} URL or relative upload path
 */
async function uploadImage(buffer, folder = 'reports') {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Valid image buffer is required');
  }

  // If Cloudinary is configured, try uploading to Cloudinary
  if (isCloudinaryConfigured) {
    try {
      return await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `sahaya_setu/${folder}`,
            resource_type: 'image',
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          }
        );
        stream.end(buffer);
      });
    } catch (err) {
      console.warn('Cloudinary upload failed, falling back to local storage:', err.message);
    }
  }

  // Fallback to local storage
  const relPath = await imaging.saveImage(buffer, folder);
  return `/uploads/${relPath}`;
}

/**
 * Upload multiple image buffers
 * @param {Array<Buffer>} buffers
 * @param {string} folder
 * @returns {Promise<Array<string>>}
 */
async function uploadMultipleImages(buffers, folder = 'reports') {
  if (!buffers || !Array.isArray(buffers) || buffers.length === 0) return [];
  const urls = [];
  for (const buf of buffers) {
    try {
      const url = await uploadImage(buf, folder);
      urls.push(url);
    } catch (err) {
      console.warn('Failed to upload one image in batch:', err.message);
    }
  }
  return urls;
}

module.exports = {
  uploadImage,
  uploadMultipleImages,
  isCloudinaryConfigured: () => isCloudinaryConfigured,
};
