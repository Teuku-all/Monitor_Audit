const { Readable } = require('stream');
const cloudinary = require('cloudinary').v2;

function configureCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

async function uploadDocument(file) {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'audit-monitor', resource_type: 'auto' },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url || !result.public_id || !result.resource_type) {
          return reject(new Error('Cloudinary returned an incomplete upload result.'));
        }
        resolve(result);
      },
    );
    Readable.from(file.buffer).pipe(stream);
  });
}

async function deleteDocument(publicId, resourceType) {
  configureCloudinary();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

module.exports = { uploadDocument, deleteDocument };
