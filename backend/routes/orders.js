const express = require('express');
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders
} = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, createOrder);
router.get('/', protect, getOrders);
router.get('/all', protect, getAllOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id', protect, updateOrderStatus);

module.exports = router;
