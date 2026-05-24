const express = require('express');
const router = express.Router();
const Marquee = require('../models/Marquee');

// Get latest marquee items (optionally limit via ?limit=10)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit || '12', 10));
    const items = await Marquee.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ ok: true, items });
  } catch (err) {
    console.error('[Marquee] GET error:', err.message);
    res.status(500).json({ ok: false, error: 'Failed to fetch marquee items' });
  }
});

// Add a marquee item (admin use only) - simple POST body { text, tag, url, createdBy }
router.post('/', async (req, res) => {
  try {
    const { text, tag, url, createdBy } = req.body;
    if (!text || typeof text !== 'string') return res.status(400).json({ ok: false, error: 'Invalid text' });

    const item = await Marquee.create({ text: text.trim(), tag: tag || '', url: url || '', createdBy: createdBy || 'bot' });
    res.json({ ok: true, item });
  } catch (err) {
    console.error('[Marquee] POST error:', err.message);
    res.status(500).json({ ok: false, error: 'Failed to create marquee item' });
  }
});

// Edit a marquee item by id
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { text, tag, url } = req.body;
    if (!text || typeof text !== 'string') return res.status(400).json({ ok: false, error: 'Invalid text' });

    const updated = await Marquee.findByIdAndUpdate(
      id,
      { text: text.trim(), tag: tag || '', url: url || '' },
      { new: true }
    );

    if (!updated) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[Marquee] PUT error:', err.message);
    res.status(500).json({ ok: false, error: 'Failed to update marquee item' });
  }
});

// Delete a marquee item by id (admin use should be enforced upstream)
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const removed = await Marquee.findByIdAndDelete(id);
    if (!removed) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, removed });
  } catch (err) {
    console.error('[Marquee] DELETE error:', err.message);
    res.status(500).json({ ok: false, error: 'Failed to delete marquee item' });
  }
});

module.exports = router;
