const Category = require('../models/category');
const Product = require('../models/product');
const { Op } = require('sequelize');

/**
 * GET /categories
 * Get all active categories (public)
 */
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']],
      include: [{
        model: Product,
        attributes: ['id'],
        where: { isActive: true },
        required: false
      }]
    });

    // Add product count
    const categoriesWithCount = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      slug: cat.slug,
      productCount: cat.products ? cat.products.length : 0
    }));

    res.status(200).json({
      categories: categoriesWithCount,
      count: categories.length
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

/**
 * GET /categories/:id
 * Get single category with products (public)
 */
exports.getCategory = async (req, res, next) => {
  try {
    const categoryId = req.params.id;

    const category = await Category.findByPk(categoryId, {
      include: [{
        model: Product,
        where: { isActive: true },
        required: false,
        attributes: ['id', 'title', 'price', 'stock', 'imageUrl', 'description']
      }]
    });

    if (!category) {
      return res.status(404).json({
        error: 'Category not found'
      });
    }

    if (!category.isActive) {
      return res.status(404).json({
        error: 'Category is not active'
      });
    }

    res.status(200).json({
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        slug: category.slug,
        products: category.products || []
      }
    });

  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};

/**
 * POST /categories
 * Create new category (Admin only)
 */
exports.postCreateCategory = async (req, res, next) => {
  try {
    const { name, description, slug } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Category name is required'
      });
    }

    // Check if category with same name already exists
    const existingCategory = await Category.findOne({
      where: {
        [Op.or]: [
          { name },
          slug ? { slug } : null
        ].filter(Boolean)
      }
    });

    if (existingCategory) {
      return res.status(409).json({
        error: 'Category with this name or slug already exists'
      });
    }

    // Generate slug if not provided
    const categorySlug = slug || name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const category = await Category.create({
      name,
      description: description || '',
      slug: categorySlug,
      isActive: true
    });

    res.status(201).json({
      message: 'Category created successfully',
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        slug: category.slug
      }
    });

  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

/**
 * PUT /categories/:id
 * Update category (Admin only)
 */
exports.putUpdateCategory = async (req, res, next) => {
  try {
    const categoryId = req.params.id;
    const { name, description, slug, isActive } = req.body;

    const category = await Category.findByPk(categoryId);

    if (!category) {
      return res.status(404).json({
        error: 'Category not found'
      });
    }

    // Check if new name/slug conflicts with another category
    if (name || slug) {
      const existingCategory = await Category.findOne({
        where: {
          id: { [Op.ne]: categoryId },
          [Op.or]: [
            name ? { name } : null,
            slug ? { slug } : null
          ].filter(Boolean)
        }
      });

      if (existingCategory) {
        return res.status(409).json({
          error: 'Category with this name or slug already exists'
        });
      }
    }

    // Update fields
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (slug) category.slug = slug;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.status(200).json({
      message: 'Category updated successfully',
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        slug: category.slug,
        isActive: category.isActive
      }
    });

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

/**
 * DELETE /categories/:id
 * Delete category (Admin only)
 * Soft delete - just set isActive to false
 */
exports.deleteCategory = async (req, res, next) => {
  try {
    const categoryId = req.params.id;

    const category = await Category.findByPk(categoryId, {
      include: [{
        model: Product,
        attributes: ['id']
      }]
    });

    if (!category) {
      return res.status(404).json({
        error: 'Category not found'
      });
    }

    // Check if category has products
    if (category.products && category.products.length > 0) {
      return res.status(409).json({
        error: 'Cannot delete category with existing products. Please reassign or delete products first.',
        productCount: category.products.length
      });
    }

    // Soft delete - set isActive to false
    category.isActive = false;
    await category.save();

    // Or hard delete if preferred:
    // await category.destroy();

    res.status(200).json({
      message: 'Category deleted successfully'
    });

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

