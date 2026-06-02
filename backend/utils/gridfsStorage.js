const mongoose = require('mongoose');

const GRIDFS_BUCKET_NAME = 'heroVideos';
const HERO_VIDEO_URL_PREFIX = '/api/hero-videos/';

const getGridFSBucket = () => {
  if (!mongoose.connection || !mongoose.connection.db) {
    throw new Error('MongoDB connection is not ready for GridFS');
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: GRIDFS_BUCKET_NAME
  });
};

const uploadBufferToGridFs = async ({ buffer, filename, contentType, metadata }) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('GridFS upload requires a Buffer');
  }

  const bucket = getGridFSBucket();

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename || `hero-${Date.now()}`, {
      contentType: contentType || 'application/octet-stream',
      metadata: metadata || {}
    });

    uploadStream.end(buffer);

    uploadStream.on('error', reject);
    uploadStream.on('finish', resolve);
  });
};

const parseVideoIdFromUrl = (url) => {
  if (!url || !url.startsWith(HERO_VIDEO_URL_PREFIX)) return null;
  return url.substring(HERO_VIDEO_URL_PREFIX.length);
};

const getVideoUrl = (fileId) => `${HERO_VIDEO_URL_PREFIX}${fileId}`;

const fileExistsInGridFs = async (videoUrl) => {
  const videoId = parseVideoIdFromUrl(videoUrl);
  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) return false;

  const bucket = getGridFSBucket();
  const files = await bucket.find({ _id: new mongoose.Types.ObjectId(videoId) }).toArray();
  return files.length > 0;
};

module.exports = {
  getGridFSBucket,
  uploadBufferToGridFs,
  getVideoUrl,
  parseVideoIdFromUrl,
  fileExistsInGridFs,
  HERO_VIDEO_URL_PREFIX
};