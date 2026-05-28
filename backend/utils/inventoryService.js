const Product = require('../models/Product');
const telegramNotifier = require('./telegramNotifier');

const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD || '5', 10);

function getInventoryField(product) {
  return product.type === 'land' ? 'numberOfPlots' : 'quantity';
}

function getInventoryQuantity(product) {
  const field = getInventoryField(product);
  const value = product[field];
  return typeof value === 'number' ? value : 0;
}

function getRequestedQuantity(product, item) {
  if (product.type === 'land') {
    return item.plotsRequested || item.quantity || 0;
  }
  return item.quantity || 0;
}

function formatStockMessage(product, availableStock) {
  const unitLabel = product.unit || (product.type === 'land' ? 'plots' : 'units');
  return `${availableStock} ${unitLabel}`;
}

async function validateStockForItem(product, item) {
  const requestedQty = getRequestedQuantity(product, item);
  if (requestedQty <= 0) {
    return;
  }

  const availableStock = getInventoryQuantity(product);
  if (availableStock === 0) {
    throw new Error(`We apologize, but only 0 units are currently available. Please adjust your quantity to proceed.`);
  }

  if (requestedQty > availableStock) {
    throw new Error(`We apologize, but only ${formatStockMessage(product, availableStock)} are currently available. Please adjust your quantity to proceed.`);
  }
}

async function validateStockForItems(items) {
  for (const item of items) {
    const product = await Product.findOne({ $or: [{ _id: item.product }, { code: item.product }] });
    if (!product) {
      throw new Error(`Product ${item.product} not found`);
    }
    await validateStockForItem(product, item);
  }
}

async function deductInventory(product, quantity, session = null) {
  const inventoryField = getInventoryField(product);
  const currentStock = getInventoryQuantity(product);
  if (quantity <= 0 || currentStock === 0) {
    return {
      product,
      remainingStock: currentStock,
      wasStockManaged: false
    };
  }

  const nextStock = currentStock - quantity;
  if (nextStock < 0) {
    throw new Error(`Insufficient stock for ${product.name}`);
  }

  const update = {
    $inc: { [inventoryField]: -quantity }
  };

  if (nextStock === 0) {
    update.$set = { status: 'sold-out' };
  } else if (product.status === 'sold-out' && nextStock > 0) {
    update.$set = { status: 'active' };
  }

  const updatedProduct = await Product.findOneAndUpdate(
    { _id: product._id, [inventoryField]: { $gte: quantity } },
    update,
    { new: true, session }
  );

  if (!updatedProduct) {
    throw new Error(`Insufficient stock for ${product.name}`);
  }

  const remainingStock = getInventoryQuantity(updatedProduct);

  return {
    product: updatedProduct,
    remainingStock,
    wasStockManaged: true
  };
}

module.exports = {
  validateStockForItem,
  validateStockForItems,
  deductInventory,
  getInventoryField,
  getInventoryQuantity,
  getRequestedQuantity
};
