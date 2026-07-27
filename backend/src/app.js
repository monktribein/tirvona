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

io.on('connection', (socket) => {
  console.log(`Socket client connected: ${socket.id}`);
  
  // Custom room subscription for live booking updates
  socket.on('join_dashboard', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their private notification room`);
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

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Routing Middleware
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));
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

// API documentation (Swagger UI) served from openapi.yaml.
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
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = config.port;
httpServer.listen(PORT, () => {
  console.log(`Server listening (${config.nodeEnv}) on port ${PORT}`);
});

export default app;
