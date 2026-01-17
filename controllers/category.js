const Category = require('../models/category');

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    res.render('admin/category-list', {
      pageTitle: 'Categories',
      path: '/admin/categories',
      categories
    });
  } catch (err) {
    console.error('getCategories error:', err);
    res.status(500).render('500', { error: 'Failed to load categories' });
  }
};

exports.getAddCategory = (req, res) => {
  res.render('admin/edit-category', {
    pageTitle: 'Add Category',
    path: '/admin/categories',
    editing: false,
    category: null
  });
};

exports.postAddCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    await Category.create({ name, description });
    res.redirect('/admin/categories');
  } catch (err) {
    console.error('postAddCategory error:', err);
    res.status(500).render('500', { error: 'Failed to create category' });
  }
};

exports.getEditCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.categoryId);
    if (!category) return res.redirect('/admin/categories');
    res.render('admin/edit-category', {
      pageTitle: 'Edit Category',
      path: '/admin/categories',
      editing: true,
      category
    });
  } catch (err) {
    console.error('getEditCategory error:', err);
    res.status(500).render('500', { error: 'Failed to load category' });
  }
};

exports.postEditCategory = async (req, res) => {
  try {
    const { categoryId, name, description } = req.body;
    const category = await Category.findByPk(categoryId);
    if (!category) return res.redirect('/admin/categories');
    category.name = name;
    category.description = description;
    await category.save();
    res.redirect('/admin/categories');
  } catch (err) {
    console.error('postEditCategory error:', err);
    res.status(500).render('500', { error: 'Failed to save category' });
  }
};

exports.postDeleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.body;
    await Category.destroy({ where: { id: categoryId } });
    res.redirect('/admin/categories');
  } catch (err) {
    console.error('postDeleteCategory error:', err);
    res.status(500).render('500', { error: 'Failed to delete category' });
  }
};

// Public: get single category with products
exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).render('404', { pageTitle: 'Not Found' });
    // TODO: include products when needed
    res.render('shop/category', { pageTitle: category.name, path: '/categories', category });
  } catch (err) {
    console.error('getCategory error:', err);
    res.status(500).render('500', { error: 'Failed to load category' });
  }
};

// Admin: create category
exports.postCreateCategory = exports.postAddCategory;

// Admin: update category
exports.putUpdateCategory = async (req, res) => {
  // Using the postEditCategory behavior for simplicity
  req.body.categoryId = req.params.id;
  return exports.postEditCategory(req, res);
};

// Admin: delete category
exports.deleteCategory = async (req, res) => {
  // For DELETE, expecting req.params.id
  try {
    await Category.destroy({ where: { id: req.params.id } });
    res.status(200).json({ message: 'Category deleted' });
  } catch (err) {
    console.error('deleteCategory error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

// Public API: return categories (JSON or render shop categories)
exports.getAllPublic = async (req, res) => {
  try {
    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    // If request expects JSON (AJAX) return JSON
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
      return res.status(200).json(categories);
    }
    // Otherwise render a simple customer-facing category list
    res.render('shop/category-list', {
      pageTitle: 'Categories',
      path: '/categories',
      categories
    });
  } catch (err) {
    console.error('getAllPublic error:', err);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
      return res.status(500).json({ error: 'Failed to load categories' });
    }
    res.status(500).render('500', { error: 'Failed to load categories' });
  }
};
