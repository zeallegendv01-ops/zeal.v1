const express = require('express');
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getSupplierProducts,
  getCategories
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Specific routes first (before /:id parameter route)
router.get('/categories', getCategories);
router.get('/supplier/products', protect, getSupplierProducts);

// General routes
router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.post('/', protect, createProduct);
router.put('/:id', protect, updateProduct);
router.delete('/:id', protect, deleteProduct);

module.exports = router;
