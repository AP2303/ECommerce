const Shipment = require('../models/shipment');
const Order = require('../models/order');
const User = require('../models/user');
const OrderItem = require('../models/order-item');
const Product = require('../models/product');

exports.getShipmentDetail = async (req, res) => {
  try {
    const id = req.params.id;
    const shipment = await Shipment.findByPk(id, {
      include: [{ model: Order, as: 'order', include: [
        { model: User, as: 'user', attributes: ['id','name','email'] },
        { model: OrderItem, as: 'orderItems', include: [{ model: Product, as: 'product', attributes: ['id','title','price'] }] }
      ] }]
    });
    if (!shipment) return res.status(404).render('500', { error: 'Shipment not found' });
    res.render('delivery/shipment-detail', { pageTitle: 'Shipment Detail', path: '/delivery/shipments/' + id, shipment });
  } catch (err) {
    console.error('getShipmentDetail error:', err);
    res.status(500).render('500', { error: 'Failed to load shipment' });
  }
};

exports.postMarkDelivered = async (req, res) => {
  try {
    const id = req.params.id;
    const shipment = await Shipment.findByPk(id);
    if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

    shipment.status = 'Delivered';
    shipment.deliveredAt = new Date();
    await shipment.save();

    // Also update related order status if linked
    if (shipment.orderId) {
      const order = await Order.findByPk(shipment.orderId);
      if (order) {
        order.status = 'Delivered';
        await order.save();
      }
    }

    // Respond depending on request content-type
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') === 0)) {
      return res.json({ message: 'Shipment marked delivered', shipmentId: id });
    }

    res.redirect('/delivery/dashboard');
  } catch (err) {
    console.error('postMarkDelivered error:', err);
    res.status(500).render('500', { error: 'Failed to update shipment' });
  }
};
