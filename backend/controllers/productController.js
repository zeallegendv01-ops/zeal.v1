const Product = require('../models/Product');

exports.getAllProducts = async (req, res, next) => {
  try {
    const { category, status } = req.query;
    let filter = {};

    if (category) filter.category = category;
    if (status) filter.status = status;

    const products = await Product.find(filter).populate('supplier', 'firstName lastName company');

    // Debug: log price fields of returned products to help diagnose frontend NaN
    products.forEach(p => {
      if (p.type === 'product') {
        console.log(`getAllProducts - product ${p._id} pricePerKg: ${p.pricePerKg}`);
      } else if (p.type === 'land') {
        console.log(`getAllProducts - land ${p._id} landPricingType: ${p.landPricingType}, pricePerPlot: ${p.pricePerPlot}, pricePerSqMeter: ${p.pricePerSqMeter}`);
      }
    });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('supplier', 'firstName lastName company email phone');
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const { 
      name, description, pricePerKg, category, image, quantity, certification, unit, minLimit, maxLimit, tags, type,
      // Land-specific fields
      location, areaSqMeters, numberOfPlots, legalStatus, accessibility, landPricingType, pricePerPlot, pricePerSqMeter
    } = req.body;

    // Debug: log incoming request body to help trace missing price issues
    console.log('createProduct - incoming req.body:', JSON.stringify(req.body));

    if (!name || !description || !image) {
      return res.status(400).json({ success: false, message: 'Please provide required fields: name, description, image' });
    }

    // Resolve type default (treat omitted type as 'product')
    const resolvedType = type || 'product';

    // Validate based on product type
    if (resolvedType === 'product') {
      const priceNum = pricePerKg !== undefined && pricePerKg !== null ? parseFloat(pricePerKg) : NaN;
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({ success: false, message: 'pricePerKg is required for products and must be a positive number' });
      }
    }

    if (resolvedType === 'land') {
      if (category !== 'Land') {
        return res.status(400).json({ success: false, message: 'Category must be "Land" for land type' });
      }
      if (!location) {
        return res.status(400).json({ success: false, message: 'Location is required for land' });
      }
      if (!areaSqMeters || areaSqMeters <= 0) {
        return res.status(400).json({ success: false, message: 'Area in square meters is required and must be positive' });
      }
      if (!numberOfPlots || numberOfPlots <= 0) {
        return res.status(400).json({ success: false, message: 'Number of plots is required and must be positive' });
      }
      if (!landPricingType) {
        return res.status(400).json({ success: false, message: 'Pricing type (fixed or per-meter) is required for land' });
      }
      if (landPricingType === 'fixed' && (!pricePerPlot || pricePerPlot <= 0)) {
        return res.status(400).json({ success: false, message: 'Price per plot is required for fixed pricing' });
      }
      if (landPricingType === 'per-meter' && (!pricePerSqMeter || pricePerSqMeter <= 0)) {
        return res.status(400).json({ success: false, message: 'Price per square meter is required for per-meter pricing' });
      }
    }

    if (!unit) {
      return res.status(400).json({ success: false, message: 'Unit of measurement is required' });
    }

    if (minLimit === undefined || minLimit === null) {
      return res.status(400).json({ success: false, message: 'Minimum limit is required' });
    }

    if (maxLimit === undefined || maxLimit === null) {
      return res.status(400).json({ success: false, message: 'Maximum limit is required' });
    }

    // Build product data
    const productData = {
      name,
      description,
      category,
      image,
      quantity: quantity !== undefined && quantity !== null ? parseFloat(quantity) : 0,
      unit,
      minLimit: minLimit !== undefined && minLimit !== null ? parseFloat(minLimit) : undefined,
      maxLimit: maxLimit !== undefined && maxLimit !== null ? parseFloat(maxLimit) : undefined,
      supplier: req.user.id,
      tags,
      type: resolvedType
    };

    // Add product-specific fields
    if (resolvedType === 'product') {
      productData.pricePerKg = parseFloat(pricePerKg);
      if (certification) productData.certification = certification;
    }

    // Add land-specific fields
    if (resolvedType === 'land') {
      productData.location = location;
      productData.areaSqMeters = parseFloat(areaSqMeters);
      productData.numberOfPlots = parseInt(numberOfPlots);
      productData.legalStatus = legalStatus || 'unknown';
      productData.accessibility = accessibility || 'limited';
      productData.landPricingType = landPricingType;
      
      if (landPricingType === 'fixed') {
        productData.pricePerPlot = pricePerPlot ? parseFloat(pricePerPlot) : undefined;
      } else if (landPricingType === 'per-meter') {
        productData.pricePerSqMeter = pricePerSqMeter ? parseFloat(pricePerSqMeter) : undefined;
      }
    }

    const product = await Product.create(productData);

    // Debug: log created product to verify stored fields
    console.log('createProduct - productData before save:', JSON.stringify(productData));
    console.log('createProduct - created product:', JSON.stringify(product));
    console.log('createProduct - created product pricePerKg:', product.pricePerKg, 'type:', typeof product.pricePerKg);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if user is the supplier
    if (product.supplier.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this product' });
    }

    product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if user is the supplier
    if (product.supplier.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this product' });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.getSupplierProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ supplier: req.user.id });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    next(error);
  }
};
