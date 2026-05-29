const Product = require('../models/Product');

const normalizeProductImages = (product) => {
  if (!product) return product;
  const item = product.toObject ? product.toObject() : { ...product };
  if (!Array.isArray(item.images) || item.images.length === 0) {
    if (item.image) {
      item.images = [item.image];
    } else {
      item.images = [];
    }
  }
  return item;
};

exports.getAllProducts = async (req, res, next) => {
  try {
    const { category, status, min, max, sort } = req.query;
    let filter = {};

    if (category) filter.category = category;
    if (status) filter.status = status;

    if ((min !== undefined && min !== null && min !== '') || (max !== undefined && max !== null && max !== '')) {
      filter.pricePerKg = {};
      if (min !== undefined && min !== null && min !== '') {
        const minValue = Number(min);
        if (!Number.isNaN(minValue)) filter.pricePerKg.$gte = minValue;
      }
      if (max !== undefined && max !== null && max !== '') {
        const maxValue = Number(max);
        if (!Number.isNaN(maxValue)) filter.pricePerKg.$lte = maxValue;
      }
    }

    const sortOptions = {};
    if (sort === 'asc') {
      sortOptions.pricePerKg = 1;
    } else if (sort === 'desc') {
      sortOptions.pricePerKg = -1;
    } else {
      sortOptions.name = 1;
    }

    let query = Product.find(filter).populate('supplier', 'firstName lastName company');
    query = query.sort(sortOptions);

    const products = await query;

    // Debug: log price fields of returned products to help diagnose frontend NaN
    products.forEach(p => {
      if (p.type === 'product') {
        console.log(`getAllProducts - product ${p._id} pricePerKg: ${p.pricePerKg}`);
      } else if (p.type === 'land') {
        console.log(`getAllProducts - land ${p._id} landPricingType: ${p.landPricingType}, pricePerPlot: ${p.pricePerPlot}, pricePerSqMeter: ${p.pricePerSqMeter}`);
      } else if (p.type === 'apartment') {
        console.log(`getAllProducts - apartment ${p._id} apartmentType: ${p.apartmentType} listingType: ${p.listingType} price: ${p.price} pricePerMonth: ${p.pricePerMonth} bedrooms: ${p.bedrooms} bathrooms: ${p.bathrooms} apartmentAddress: ${p.apartmentAddress}`);
      }
    });

    const normalizedProducts = products.map(normalizeProductImages);

    res.status(200).json({
      success: true,
      count: normalizedProducts.length,
      data: normalizedProducts
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
      data: normalizeProductImages(product)
    });
  } catch (error) {
    next(error);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const { 
      name, description, pricePerKg, category, image, imageData, imageMimeType, imageUrl, quantity, certification, unit, minLimit, maxLimit, tags, type,
      // Land-specific fields
      location, areaSqMeters, numberOfPlots, legalStatus, accessibility, landPricingType, pricePerPlot, pricePerSqMeter,
      // Apartment-specific fields
      apartmentType, apartment_type,
      listingType, listing_type,
      price, pricePerMonth, price_per_month,
      bedrooms, beds, bathrooms, baths, furnished,
      apartmentAreaSqMeters, apartment_area_sq_meters,
      apartmentAddress, apartment_address,
      apartmentFeatures, apartment_features
    } = req.body;

    const resolvedApartmentType = apartmentType || apartment_type;
    const resolvedListingType = listingType || listing_type;
    const resolvedPricePerMonth = pricePerMonth || price_per_month;
    const resolvedBedrooms = bedrooms !== undefined && bedrooms !== null ? bedrooms : beds;
    const resolvedBathrooms = bathrooms !== undefined && bathrooms !== null ? bathrooms : baths;
    const resolvedApartmentAreaSqMeters = apartmentAreaSqMeters || apartment_area_sq_meters;
    const resolvedApartmentAddress = apartmentAddress || apartment_address;
    const resolvedApartmentFeatures = apartmentFeatures || apartment_features;

    // Debug: log incoming request body to help trace missing price issues
    console.log('createProduct - incoming req.body:', JSON.stringify(req.body));

    // Validate image: must have one of: image, imageData, or imageUrl
    if (!image && !imageData && !imageUrl) {
      return res.status(400).json({ success: false, message: 'Please provide an image (imageData for Base64, imageUrl for external URL, or image field)' });
    }

    if (!name || !description) {
      return res.status(400).json({ success: false, message: 'Please provide required fields: name, description' });
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

    if (resolvedType === 'apartment') {
      if (category !== 'Apartment') {
        return res.status(400).json({ success: false, message: 'Category must be "Apartment" for apartment type' });
      }
      if (!apartmentType) {
        return res.status(400).json({ success: false, message: 'Apartment type is required for apartments' });
      }
      if (!listingType) {
        return res.status(400).json({ success: false, message: 'Listing type (rent or sale) is required for apartments' });
      }
      if (listingType === 'rent' && (!pricePerMonth || pricePerMonth <= 0)) {
        return res.status(400).json({ success: false, message: 'Monthly price is required for apartment rentals' });
      }
      if (listingType === 'sale' && (!price || price <= 0)) {
        return res.status(400).json({ success: false, message: 'Sale price is required for apartment sales' });
      }
      if (bedrooms === undefined || bedrooms === null) {
        return res.status(400).json({ success: false, message: 'Number of bedrooms is required for apartments' });
      }
      if (bathrooms === undefined || bathrooms === null) {
        return res.status(400).json({ success: false, message: 'Number of bathrooms is required for apartments' });
      }
      if (!apartmentAreaSqMeters || apartmentAreaSqMeters <= 0) {
        return res.status(400).json({ success: false, message: 'Area in square meters is required and must be positive for apartments' });
      }
      if (!apartmentAddress) {
        return res.status(400).json({ success: false, message: 'Apartment address is required' });
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

    // Determine which image source to use and set the image field
    let finalImage = image;
    let finalImageData = imageData;
    let finalImageUrl = imageUrl;
    let finalImageMimeType = imageMimeType || 'image/jpeg';

    if (imageData) {
      // Option 2: Base64 data - create data URL for the image field
      finalImage = `data:${finalImageMimeType};base64,${imageData}`;
      finalImageData = imageData;
    } else if (imageUrl) {
      // Option 3: External URL
      finalImage = imageUrl;
      finalImageUrl = imageUrl;
    }

    const resolvedImages = Array.isArray(req.body.images)
      ? req.body.images.slice(0, 4)
      : finalImage
        ? [finalImage]
        : undefined;

    // Build product data
    const productData = {
      name,
      description,
      category,
      image: finalImage,
      imageData: finalImageData,
      imageUrl: finalImageUrl,
      imageMimeType: finalImageMimeType,
      images: resolvedImages,
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

    // Add apartment-specific fields
    if (resolvedType === 'apartment') {
      productData.apartmentType = resolvedApartmentType;
      productData.listingType = resolvedListingType;
      productData.price = resolvedListingType === 'sale' ? parseFloat(price) : undefined;
      productData.pricePerMonth = resolvedListingType === 'rent' ? parseFloat(resolvedPricePerMonth) : undefined;
      productData.bedrooms = resolvedBedrooms !== undefined && resolvedBedrooms !== null ? parseInt(resolvedBedrooms) : undefined;
      productData.bathrooms = resolvedBathrooms !== undefined && resolvedBathrooms !== null ? parseInt(resolvedBathrooms) : undefined;
      productData.furnished = furnished === true || furnished === 'true' || furnished === '1';
      productData.apartmentAreaSqMeters = parseFloat(resolvedApartmentAreaSqMeters);
      productData.apartmentAddress = resolvedApartmentAddress;
      if (resolvedApartmentFeatures) productData.apartmentFeatures = resolvedApartmentFeatures;
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

    // Normalize legacy apartment field aliases before update
    if (req.body.apartment_type !== undefined && req.body.apartmentType === undefined) req.body.apartmentType = req.body.apartment_type;
    if (req.body.listing_type !== undefined && req.body.listingType === undefined) req.body.listingType = req.body.listing_type;
    if (req.body.price_per_month !== undefined && req.body.pricePerMonth === undefined) req.body.pricePerMonth = req.body.price_per_month;
    if (req.body.apartment_area_sq_meters !== undefined && req.body.apartmentAreaSqMeters === undefined) req.body.apartmentAreaSqMeters = req.body.apartment_area_sq_meters;
    if (req.body.apartment_address !== undefined && req.body.apartmentAddress === undefined) req.body.apartmentAddress = req.body.apartment_address;
    if (req.body.apartment_features !== undefined && req.body.apartmentFeatures === undefined) req.body.apartmentFeatures = req.body.apartment_features;
    if (req.body.beds !== undefined && req.body.bedrooms === undefined) req.body.bedrooms = req.body.beds;
    if (req.body.baths !== undefined && req.body.bathrooms === undefined) req.body.bathrooms = req.body.baths;

    if (req.body.images && !Array.isArray(req.body.images)) {
      req.body.images = [req.body.images];
    }

    // Handle image updates (Option 2: Base64 or Option 3: External URL)
    if (req.body.imageData && !req.body.image) {
      const imageMimeType = req.body.imageMimeType || 'image/jpeg';
      req.body.image = `data:${imageMimeType};base64,${req.body.imageData}`;
      req.body.imageMimeType = imageMimeType;
    } else if (req.body.imageUrl && !req.body.image) {
      req.body.image = req.body.imageUrl;
    }

    if ((!req.body.images || req.body.images.length === 0) && req.body.image) {
      req.body.images = [req.body.image];
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

exports.getCategories = async (req, res, next) => {
  try {
    // Get all unique categories from products
    const categories = await Product.distinct('category');
    
    // Sort alphabetically and filter out null/empty values
    const filteredCategories = categories.filter(cat => cat && cat.trim() !== '').sort();
    
    console.log('[OK] Categories endpoint - found', filteredCategories.length, 'categories');

    res.status(200).json({
      success: true,
      count: filteredCategories.length,
      data: filteredCategories
    });
  } catch (error) {
    next(error);
  }
};
