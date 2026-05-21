const express = require('express');
const { protect } = require('../middleware/auth');
const {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartCount
} = require('../controllers/cartController');

const router = express.Router();

// All cart routes require authentication
router.use(protect);

router.post('/', addToCart);
router.get('/', getCart);
router.get('/count', getCartCount);
router.put('/:product', updateCartItem);
router.delete('/item/:product', removeFromCart);
router.delete('/', clearCart);

module.exports = router;
