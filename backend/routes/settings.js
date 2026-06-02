const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Settings = require('../models/Settings');
const auth = require('../middleware/auth');
const { fileExistsInGridFs, HERO_VIDEO_URL_PREFIX } = require('../utils/gridfsStorage');

const normalizeHeroVideos = async (videos) => {
  if (!Array.isArray(videos)) return [];

  const normalized = [];

  for (const video of videos) {
    if (!video || typeof video.url !== 'string') continue;

    if (video.url.startsWith(HERO_VIDEO_URL_PREFIX)) {
      const exists = await fileExistsInGridFs(video.url).catch(error => {
        console.error(`[Settings] GridFS validation failed for ${video.url}:`, error.message || error);
        return true; // Preserve on transient error to avoid accidental deletion
      });
      if (!exists) {
        console.warn(`[Settings] Dropping missing GridFS hero video from settings: ${video.url}`);
        continue;
      }
    } else if (video.url.startsWith('/uploads/')) {
      const filename = video.url.substring('/uploads/'.length);
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      const filePath = path.join(uploadsDir, filename);

      if (!fs.existsSync(filePath)) {
        console.warn(
          `[Settings] Hero video file not found:\n` +
          `  URL: ${video.url}\n` +
          `  Expected path: ${filePath}\n` +
          `  Uploads dir: ${uploadsDir}\n` +
          `  Uploads dir exists: ${fs.existsSync(uploadsDir)}`
        );
        continue;
      }
    }

    normalized.push(video);
  }

  return normalized;
};

// Get current settings
router.get('/', async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    
    // Initialize with defaults if not exist
    if (!settings) {
      settings = new Settings({
        taxRate: 10,
        shippingFee: 50
      });
      await settings.save();
    }
    
    const filteredHeroVideos = await normalizeHeroVideos(settings.heroVideos || []);
    const videosWereRemoved = filteredHeroVideos.length !== (settings.heroVideos || []).length;
    
    if (videosWereRemoved) {
      const removedCount = (settings.heroVideos || []).length - filteredHeroVideos.length;
      console.warn(
        `[Settings] WARNING: ${removedCount} hero video(s) were missing from filesystem.\n` +
        `  Before: ${(settings.heroVideos || []).length} videos\n` +
        `  After: ${filteredHeroVideos.length} videos\n` +
        `  Removed videos: ${(settings.heroVideos || [])
          .filter(v => !filteredHeroVideos.find(fv => fv.url === v.url))
          .map(v => v.url)
          .join(', ')}`
      );
      
      // Only auto-save if there are still videos remaining
      // This prevents losing the entire collection if there's a path issue
      if (filteredHeroVideos.length > 0) {
        settings.heroVideos = filteredHeroVideos;
        await settings.save();
      } else if (settings.heroVideos && settings.heroVideos.length > 0) {
        // Videos were removed but this might be a path issue
        console.error('[Settings] ERROR: All hero videos were marked as missing! This might indicate a filesystem or path configuration issue.');
      }
    }

    res.status(200).json({
      success: true,
      data: {
        taxRate: settings.taxRate,
        shippingFee: settings.shippingFee,
        heroTitle: settings.heroTitle,
        heroDescription: settings.heroDescription,
        heroVideos: filteredHeroVideos,
        aboutImage: settings.aboutImage || { url: '', uploadedAt: Date.now() }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update settings (admin only)
router.put('/', auth.protect, async (req, res, next) => {
  try {
    const { taxRate, shippingFee } = req.body;
    
    // Validation
    if (taxRate !== undefined && (taxRate < 0 || taxRate > 100)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tax rate must be between 0 and 100' 
      });
    }
    
    if (shippingFee !== undefined && shippingFee < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Shipping fee cannot be negative' 
      });
    }
    
    let settings = await Settings.findOne();
    
    // Initialize if not exist
    if (!settings) {
      settings = new Settings({
        taxRate: taxRate !== undefined ? taxRate : 10,
        shippingFee: shippingFee !== undefined ? shippingFee : 50,
        heroTitle: typeof req.body.heroTitle === 'string' ? req.body.heroTitle.trim().slice(0, 120) : undefined,
        heroDescription: typeof req.body.heroDescription === 'string' ? req.body.heroDescription.trim().slice(0, 260) : undefined,
        heroVideos: Array.isArray(req.body.heroVideos) ? req.body.heroVideos.map(video => ({
          url: String(video.url || '').trim(),
          caption: String(video.caption || '').trim().slice(0, 120),
          uploadedAt: video.uploadedAt ? new Date(video.uploadedAt) : Date.now()
        })).filter(video => video.url) : [],
        aboutImage: req.body.aboutImage && typeof req.body.aboutImage.url === 'string'
          ? {
              url: String(req.body.aboutImage.url).trim(),
              uploadedAt: req.body.aboutImage.uploadedAt ? new Date(req.body.aboutImage.uploadedAt) : Date.now()
            }
          : { url: '', uploadedAt: Date.now() },
        updatedBy: req.user.id
      });
    } else {
      // Update existing
      if (taxRate !== undefined) settings.taxRate = taxRate;
      if (shippingFee !== undefined) settings.shippingFee = shippingFee;
      if (req.body.heroTitle !== undefined) settings.heroTitle = String(req.body.heroTitle).trim().slice(0, 120);
      if (req.body.heroDescription !== undefined) settings.heroDescription = String(req.body.heroDescription).trim().slice(0, 260);
      if (Array.isArray(req.body.heroVideos)) {
        settings.heroVideos = req.body.heroVideos
          .map(video => ({
            url: String(video.url || '').trim(),
            caption: String(video.caption || '').trim().slice(0, 120),
            uploadedAt: video.uploadedAt ? new Date(video.uploadedAt) : Date.now()
          }))
          .filter(video => video.url);
      }
      if (req.body.aboutImage !== undefined) {
        const aboutImageUrl = typeof req.body.aboutImage === 'string'
          ? req.body.aboutImage.trim()
          : req.body.aboutImage?.url ? String(req.body.aboutImage.url).trim() : '';
        settings.aboutImage = {
          url: aboutImageUrl,
          uploadedAt: Date.now()
        };
      }
      settings.updatedBy = req.user.id;
    }
    
    await settings.save();
    
    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        taxRate: settings.taxRate,
        shippingFee: settings.shippingFee,
        heroTitle: settings.heroTitle,
        heroDescription: settings.heroDescription,
        heroVideos: settings.heroVideos || []
      }
    });
  } catch (error) {
    next(error);
  }
});

// Diagnostic endpoint for hero videos (admin only)
router.get('/diagnose/hero-videos', auth.protect, async (req, res, next) => {
  try {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const settings = await Settings.findOne();
    const storedVideos = settings?.heroVideos || [];
    
    // Check filesystem
    const uploadsExists = fs.existsSync(uploadsDir);
    let filesOnDisk = [];
    if (uploadsExists) {
      const allFiles = fs.readdirSync(uploadsDir);
      filesOnDisk = allFiles
        .filter(f => f.startsWith('hero_'))
        .map(f => {
          const filePath = path.join(uploadsDir, f);
          const stats = fs.statSync(filePath);
          return {
            filename: f,
            url: `/uploads/${f}`,
            sizeBytes: stats.size,
            sizeKB: Math.round(stats.size / 1024),
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    // Compare stored vs. filesystem
    const videoDiagnostics = await Promise.all(storedVideos.map(async video => {
      let fileExists = false;
      let onDisk = null;

      if (video.url.startsWith('/uploads/')) {
        const filename = video.url.substring('/uploads/'.length);
        fileExists = filesOnDisk.some(f => f.filename === filename);
        onDisk = filesOnDisk.find(f => f.filename === filename) || null;
      } else if (video.url.startsWith(HERO_VIDEO_URL_PREFIX)) {
        fileExists = await fileExistsInGridFs(video.url).catch(error => {
          console.error(`[Settings] GridFS diagnostic failed for ${video.url}:`, error.message || error);
          return false;
        });
      } else {
        fileExists = true;
      }

      return {
        url: video.url,
        caption: video.caption,
        uploadedAt: video.uploadedAt,
        fileExists,
        onDisk
      };
    }));
    
    const orphanedFiles = filesOnDisk.filter(
      file => !storedVideos.some(video => video.url === file.url)
    );
    
    res.status(200).json({
      success: true,
      data: {
        uploadsDirectory: uploadsDir,
        uploadsDirExists: uploadsExists,
        storedVideosCount: storedVideos.length,
        filesOnDiskCount: filesOnDisk.length,
        orphanedFilesCount: orphanedFiles.length,
        videos: videoDiagnostics,
        orphanedFiles: orphanedFiles,
        issues: {
          missingFromDisk: videoDiagnostics.filter(v => !v.fileExists).length,
          orphanedOnDisk: orphanedFiles.length,
          hasIssues: videoDiagnostics.some(v => !v.fileExists) || orphanedFiles.length > 0
        },
        recommendations: generateDiagnosticRecommendations(videoDiagnostics, orphanedFiles, uploadsExists)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Helper function for diagnostic recommendations
const generateDiagnosticRecommendations = (videos, orphaned, uploadsExists) => {
  const recommendations = [];
  
  if (!uploadsExists) {
    recommendations.push({
      issue: 'Uploads directory does not exist',
      severity: 'HIGH',
      fix: 'Create backend/uploads/ directory and re-upload videos'
    });
  }
  
  const missing = videos.filter(v => !v.fileExists);
  if (missing.length > 0) {
    recommendations.push({
      issue: `${missing.length} stored videos are missing from filesystem`,
      severity: 'HIGH',
      videos: missing.map(v => v.url),
      fix: 'Either restore the video files or remove these entries from database'
    });
  }
  
  if (orphaned.length > 0) {
    recommendations.push({
      issue: `${orphaned.length} video files on disk are not registered in database`,
      severity: 'MEDIUM',
      files: orphaned.map(f => f.url),
      fix: 'Either register these videos in database or delete orphaned files to free space'
    });
  }
  
  return recommendations;
};

module.exports = router;
