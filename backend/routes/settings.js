const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const auth = require('../middleware/auth');

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
    
    res.status(200).json({
      success: true,
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

module.exports = router;
