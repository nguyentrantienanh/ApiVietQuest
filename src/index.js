import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
// import rateLimit from 'express-rate-limit'; // Bỏ comment nếu dùng
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import heritageRoutes from './routes/heritage.routes.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import quizRoutes from './routes/quiz.routes.js';
import quizAttemptRoutes from './routes/quiz_attempt.routes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import leaderboardRoutes from './routes/leaderboard.routes.js';
import heritageViewRoutes from './routes/heritage.views.js'; // Nếu còn dùng EJS Views
import cron from 'node-cron';         // Import node-cron
import { User } from './models/User.js'; // Import User model

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const app = express();
app.use(helmet({
    contentSecurityPolicy: false, // Tắt CSP nếu gây lỗi với Swagger/EJS/Ảnh
    crossOriginEmbedderPolicy: false, // Tắt COEP nếu cần
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// Error handler cho JSON sai
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Invalid JSON body:', err.message);
    return res.status(400).json({ error: 'Invalid JSON body', message: err.message });
  }
  next(err);
});

// Serve ảnh upload công khai
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  // Đường dẫn đúng là từ __dirname ra ngoài rồi vào /uploads
  express.static(path.join(__dirname, "../uploads"))
);

// --- API Routes ---
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/heritages', heritageRoutes);
app.get('/api/health', (_, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/user/quizattempt', quizAttemptRoutes); // Gắn vào /api/user/
app.use('/api/leaderboard', leaderboardRoutes);

// --- EJS View Routes (Nếu còn dùng) ---
// app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views'));
// app.use('/', heritageViewRoutes);

// --- Cổng và URI MongoDB ---
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

// --- Kết nối DB và Khởi động Server ---
connectDB(MONGODB_URI).then(() => {
  const server = app.listen(PORT, () => {
    console.log(`🚀 VietQuest API listening on port ${PORT}`);
    console.log(`📘 Swagger Docs available at /api/docs`); // Đường dẫn không cần localhost
  });

  // --- Lập Lịch Cron Jobs ---

  // 1. Reset Điểm Tuần (00:00 Thứ Hai)
  cron.schedule('0 0 * * 1', async () => {
    console.log('>>> [CRON] Starting weekly score reset...');
    try {
      const result = await User.updateMany(
        { role: 'user', weeklyScore: { $gt: 0 } }, // Chỉ reset user có điểm > 0
        { $set: { weeklyScore: 0 } }
      );
      console.log(`>>> [CRON] Weekly score reset complete. Updated ${result.modifiedCount} users.`);
    } catch (error) {
      console.error('>>> [CRON] Error resetting weekly scores:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
  });
  console.log('>>> [CRON] Weekly score reset scheduled for every Monday at 00:00 (VN Time).');

  // 2. Reset Streak (00:05 Mỗi Ngày)
  cron.schedule('5 0 * * *', async () => {
    console.log('>>> [CRON] Starting daily streak check...');
    try {
      const threeDaysAgo = new Date();
      // Đặt về đầu ngày cách đây 3 ngày (00:00)
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      threeDaysAgo.setHours(0, 0, 0, 0);

      const result = await User.updateMany(
        {
          role: 'user',
          streak: { $gt: 0 },
          // Tìm user có ngày chơi cuối cùng NHỎ HƠN (cũ hơn) đầu ngày của 3 ngày trước
          $or: [
              { lastQuizCompletionDate: { $exists: false } }, // Chưa chơi bao giờ (không nên xảy ra nếu streak > 0)
              { lastQuizCompletionDate: { $lt: threeDaysAgo } }
          ]
        },
        { $set: { streak: 0 } } // Reset streak
      );
      if (result.modifiedCount > 0) {
          console.log(`>>> [CRON] Streak reset for ${result.modifiedCount} inactive users.`);
      }
      // Không cần log nếu không có ai bị reset
    } catch (error) {
      console.error('>>> [CRON] Error resetting streaks:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh"
  });
  console.log('>>> [CRON] Daily streak reset check scheduled for 00:05 (VN Time).');

  // --- Xử lý lỗi Server ---
  server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') { // Kiểm tra lỗi kỹ hơn
      console.error(`Error: Port ${PORT} is already in use.`);
      process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
  });

}).catch(err => {
    console.error("❌ Failed to connect to MongoDB. Check MONGODB_URI and DB status.", err);
    process.exit(1);
});