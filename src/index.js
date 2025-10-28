import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import heritageRoutes from './routes/heritage.routes.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js'; // <-- THÊM DÒNG NÀY
import adminRoutes from './routes/admin.routes.js'; // <-- THÊM DÒNG NÀY
// 
import quizRoutes from './routes/quiz.routes.js'; // <-- THÊM DÒNG NÀY
import quizAttemptRoutes from './routes/quiz_attempt.routes.js'; // <-- THÊM DÒNG NÀY
import path from 'path';
import { fileURLToPath } from 'url';
  import leaderboardRoutes from './routes/leaderboard.routes.js'; // <-- THÊM DÒNG NÀY      
import heritageViewRoutes from './routes/heritage.views.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' })); 
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Pretty error for invalid JSON from client (body-parser SyntaxError)
app.use((err, req, res, next) => {
  if (err && err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Invalid JSON body:', err.message);
    return res.status(400).json({ error: 'Invalid JSON body', message: err.message });
  }
  next(err);
});

// Serve uploaded files publicly before any auth middleware to avoid accidental blocking
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "../uploads"))
);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/heritages', heritageRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));

// Auth routes (canonical under /api/auth)
app.use('/api/auth', authRoutes);

 // Cấu hình EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// User (Self) API routes (me, updateMe, deleteMe)
app.use('/api/user', userRoutes);

// Admin API routes (listUsers, createUser, ...)
app.use('/api/admin', adminRoutes);

 
app.use('/api/quiz', quizRoutes);
app.use('/api/user/quizattempt', quizAttemptRoutes); // Gắn vào /api/user/

app.use('/api/leaderboard', leaderboardRoutes); // <-- THÊM DÒNG NÀY
// Gắn route hiển thị form
app.use('/', heritageViewRoutes);

// Helper to collect registered routes as strings (method + path)
function getRegisteredRoutes(app) {
  const routes = [];
  const stack = app._router && app._router.stack ? app._router.stack : [];

  function walk(stack, prefix = '') {
    for (const layer of stack) {
      if (layer.route && layer.route.path) {
        const paths = Array.isArray(layer.route.path) ? layer.route.path : [layer.route.path];
        for (const p of paths) {
          const methods = Object.keys(layer.route.methods || {}).map(m => m.toUpperCase()).join(',') || 'ALL';
          routes.push(`${methods} ${prefix}${p}`);
        }
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        const mountPath = regexpToPath(layer.regexp);
        walk(layer.handle.stack, prefix + mountPath);
      }
    }
  }

  walk(stack, '');
  return routes;
}

// Expose route list as JSON for quick debugging
app.get('/api/_routes', (req, res) => {
  res.json({ routes: getRegisteredRoutes(app) });
});
app.get('/_routes', (req, res) => res.json({ routes: getRegisteredRoutes(app) }));
app.get('/routes', (req, res) => {
  const lines = getRegisteredRoutes(app);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(lines.join('\n'));
});

// Print all registered routes (helpful for debugging which URL to call)
function regexpToPath(re) {
  if (!re) return '';
  let s = re.source || String(re);
  // remove regex tokens used by express for mounts
  s = s.replace('^', '').replace('\/?(?=\/|$)', '').replace('(?:', '(').replace(')$', '').replace('\\/', '/');
  // unescape remaining slashes
  s = s.replace(/\\\//g, '/');
  return s;
}

 
 
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

connectDB(MONGODB_URI).then(() => {
  const server = app.listen(PORT, () => {
    console.log(`🚀 VietQuest API listening on http://localhost:${PORT}`);
    console.log(`📘 Swagger: http://localhost:${PORT}/api/docs`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Another process is listening on this port.`);
      console.error(`To find and kill the process on Windows (PowerShell):`);
      console.error(`  netstat -a -n -o | findstr :${PORT}`);
      console.error(`  # note the PID from the last column, then:`);
      console.error(`  taskkill /PID <pid> /F`);
      console.error(`Or run the server on a different port for this session:`);
      console.error(`  $env:PORT=4001; npm run dev`);
      process.exit(1);
    }
    console.error(err);
    process.exit(1);
  });
});
