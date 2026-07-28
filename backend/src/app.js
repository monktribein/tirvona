import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import jwt from 'jsonwebtoken';
import compression from 'compression';
import mongoose from 'mongoose';

// Config
import config from './config/env.js';
import connectDB from './config/db.js';

// Routes imports
import authRoutes from './routes/authRoutes.js';
import ashramRoutes from './routes/ashramRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import verificationRoutes from './routes/verificationRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import offerRoutes from './routes/offerRoutes.js';
import userRoutes from './routes/userRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import housekeepingRoutes from './routes/housekeepingRoutes.js';
import marketplaceRoutes from './routes/marketplaceRoutes.js';
import sacredServicesRoutes from './routes/sacredServicesRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import plannerRoutes from './routes/plannerRoutes.js';
import localHubRoutes from './routes/localHubRoutes.js';
import marketplaceHubRoutes from './routes/marketplaceHubRoutes.js';
import institutionRoutes from './routes/institutionRoutes.js';
import cmsRoutes from './routes/cmsRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import userMemoryRoutes from './routes/userMemoryRoutes.js';
import adminRoutes from './admin/index.js';

// Connect to MongoDB
connectDB();

const app = express();
const httpServer = createServer(app);

// CORS configuration — CLIENT_URL may be a comma-separated list of origins
const allowedOrigins = [
  ...(config.clientUrl ? config.clientUrl.split(',').map((o) => o.trim()) : []),
  'http://localhost:5173',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Socket.io integration
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// M3: authenticate each socket from its JWT so a client cannot join another
// user's private room. The verified id — never a client-sent value — names the room.
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.data.userId = decoded.id;
    }
  } catch (err) {
    // Invalid/absent token → connect without an identity; no private room join.
  }
  next();
});

io.on('connection', (socket) => {
  console.log(`Socket client connected: ${socket.id}`);

  // Custom room subscription for live booking updates.
  // M3: ignore any client-supplied id; only join the authenticated user's room.
  socket.on('join_dashboard', () => {
    if (socket.data.userId) {
      socket.join(socket.data.userId.toString());
      console.log(`User ${socket.data.userId} joined their private notification room`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket client disconnected: ${socket.id}`);
  });
});

// Attach socket server to express app so controllers can trigger real-time updates
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Security headers
app.use(helmet({ crossOriginResourcePolicy: false }));

// Gzip-compress responses — bandwidth + latency win for JSON payloads.
app.use(compression());

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));       // bound body size to resist large-payload DoS
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Strip MongoDB operator-injection keys ($-prefixed, e.g. {"$gt":""}) from all
// request input. Dependency-free equivalent of express-mongo-sanitize
// (Express 4 req.query is writable). Neutralises NoSQL operator injection.
const stripMongoOperators = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) {
      delete obj[key];
    } else {
      stripMongoOperators(obj[key]);
    }
  }
};
app.use((req, res, next) => {
  stripMongoOperators(req.body);
  stripMongoOperators(req.query);
  stripMongoOperators(req.params);
  next();
});

// Behind Render/Vercel proxies, trust the first proxy so req.ip / rate-limit work.
app.set('trust proxy', 1);

// Throttle authentication endpoints to slow brute-force / credential stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

// General abuse limiter for the whole API — generous ceiling that blocks floods
// (scraping, brute-force) without affecting normal use. Auth stays stricter above.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Routing Middleware
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/ashrams', ashramRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/verify', verificationRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/housekeeping', housekeepingRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/services', sacredServicesRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/local', localHubRoutes);
app.use('/api/marketplace/hub', marketplaceHubRoutes);
app.use('/api/institution', institutionRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/enterprise-services', serviceRoutes);
app.use('/api/user-memory', userMemoryRoutes);
app.use('/api/admin', adminRoutes);

// API documentation (Swagger UI). Exposed only outside production so the full
// API schema is not handed to attackers in prod.
if (!config.isProduction) {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const openapiDoc = YAML.parse(fs.readFileSync(path.join(__dirname, '../openapi.yaml'), 'utf8'));
    app.get('/api/docs.json', (req, res) => res.json(openapiDoc));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiDoc, {
      customSiteTitle: 'Tirvona API Docs',
    }));
    console.log('API docs available at /api/docs');
  } catch (err) {
    console.warn('Could not load openapi.yaml for Swagger UI:', err.message);
  }
}

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Tirvona API (Sacred Ashram Booking & Management Platform)',
    version: '1.0.0',
    status: 'Running',
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  // Honour known client-error statuses (e.g. 413 payload-too-large, CORS 403).
  const status = err.status || err.statusCode || 500;
  // Surface client-error (4xx) messages; hide internal 5xx details in production.
  const message = (!config.isProduction || status < 500)
    ? (err.message || 'Error')
    : 'Internal Server Error';
  res.status(status).json({ success: false, message });
});

const PORT = config.port;

// Handle server listen errors gracefully (e.g. EADDRINUSE port conflict)
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ ERROR: Port ${PORT} is already in use by another process.`);
    console.error(`👉 Stop any background process using port ${PORT} before restarting.\n`);
  } else {
    console.error('❌ Server startup error:', err);
  }
  process.exit(1);
});

// Start HTTP & Socket.io server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server listening (${config.nodeEnv}) on port ${PORT}`);
});

// Graceful shutdown sequence
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  httpServer.close(async () => {
    console.log('HTTP server closed.');
    try {
      await mongoose.connection.close();
      console.log('MongoDB connection closed.');
    } catch (err) {
      console.error('Error closing MongoDB connection:', err);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forcefully shutting down server due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

export default app;
