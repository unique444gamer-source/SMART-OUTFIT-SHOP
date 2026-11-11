
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json());

// Frontend build directory
const clientDist = path.resolve(__dirname, '../../client/dist');

// ===============================
// DATABASE SCHEMAS
// ===============================

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: String,
  price: { type: Number, required: true },
  old: Number,
  tag: String,
  rating: Number,
  image: String,
  desc: String,
  stock: { type: Number, default: 0 }
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  phone: String,
  address: String,
  items: [{
    productId: String,
    name: String,
    price: Number,
    qty: Number
  }],
  subtotal: Number,
  delivery: Number,
  total: Number,
  status: { type: String, default: 'Processing' },
  paymentMethod: { type: String, default: 'COD' }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'customer' }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const User = mongoose.model('User', userSchema);

// ===============================
// AUTHENTICATION MIDDLEWARE
// ===============================

const auth = (roles = []) => async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');

    const data = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev_secret_change_me'
    );

    req.user = await User.findById(data.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  } catch {
    return res.status(401).json({
      message: 'Invalid or expired token'
    });
  }
};

// ===============================
// HEALTH CHECK
// ===============================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SMART OUTFIT API'
  });
});

// ===============================
// PRODUCT ROUTES
// ===============================

app.get('/api/products', async (req, res) => {
  try {
    const q = {};

    if (req.query.category && req.query.category !== 'All') {
      q.category = req.query.category;
    }

    if (req.query.search) {
      q.name = {
        $regex: req.query.search,
        $options: 'i'
      };
    }

    res.json(await Product.find(q).sort({ createdAt: -1 }));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);

    if (!p) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(p);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.post('/api/products', auth(['admin']), async (req, res) => {
  try {
    res.status(201).json(await Product.create(req.body));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.patch('/api/products/:id', auth(['admin']), async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!p) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(p);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.delete('/api/products/:id', auth(['admin']), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ===============================
// AUTH ROUTES
// ===============================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({
        message: 'Name, email and password (6+ chars) required'
      });
    }

    const exists = await User.findOne({ email });

    if (exists) {
      return res.status(409).json({
        message: 'Email already registered'
      });
    }

    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12)
    });

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || 'dev_secret_change_me',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user || !await bcrypt.compare(req.body.password, user.password)) {
      return res.status(401).json({
        message: 'Invalid email or password'
      });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || 'dev_secret_change_me',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ===============================
// ORDER ROUTES
// ===============================

app.post('/api/orders', async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      items,
      paymentMethod = 'COD'
    } = req.body;

    if (!name || !phone || !address || !items?.length) {
      return res.status(400).json({
        message: 'Delivery details and items are required'
      });
    }

    const subtotal = items.reduce(
      (s, i) => s + Number(i.price) * Number(i.qty),
      0
    );

    const delivery = subtotal >= 3000 ? 0 : 80;

    const order = await Order.create({
      orderNumber: 'SO-' + Date.now().toString().slice(-8),
      name,
      phone,
      address,
      items,
      subtotal,
      delivery,
      total: subtotal + delivery,
      paymentMethod
    });

    res.status(201).json(order);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.get('/api/orders/track/:number', async (req, res) => {
  try {
    const o = await Order.findOne({
      orderNumber: req.params.number
    });

    if (!o) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(o);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ===============================
// ADMIN ROUTES
// ===============================

app.get('/api/admin/orders', auth(['admin']), async (req, res) => {
  try {
    res.json(await Order.find().sort({ createdAt: -1 }));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.patch('/api/admin/orders/:id', auth(['admin']), async (req, res) => {
  try {
    const o = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    if (!o) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(o);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.get('/api/admin/customers', auth(['admin']), async (req, res) => {
  try {
    res.json(
      await User.find({ role: 'customer' }).select('-password')
    );
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ===============================
// SERVE FRONTEND (IMPORTANT FIX)
// ===============================

// Serve React/Vite static files
app.use(express.static(clientDist));

// React Router fallback
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) {
    return next();
  }

  res.sendFile(
    path.join(clientDist, 'index.html'),
    (err) => {
      if (err) next(err);
    }
  );
});

// ===============================
// DATABASE CONNECTION & SERVER
// ===============================

const port = process.env.PORT || 5000;

mongoose.connect(
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/smart-outfit'
)
  .then(() => console.log('MongoDB connected'))
  .catch(e => console.error('MongoDB connection failed:', e.message));

app.listen(port, () => {
  console.log(`SMART OUTFIT API listening on ${port}`);
});
