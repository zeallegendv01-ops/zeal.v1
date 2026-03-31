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
        shippingFee: settings.shippingFee
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
        updatedBy: req.user.id
      });
    } else {
      // Update existing
      if (taxRate !== undefined) settings.taxRate = taxRate;
      if (shippingFee !== undefined) settings.shippingFee = shippingFee;
      settings.updatedBy = req.user.id;
    }
    
    await settings.save();
    
    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        taxRate: settings.taxRate,
        shippingFee: settings.shippingFee
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
