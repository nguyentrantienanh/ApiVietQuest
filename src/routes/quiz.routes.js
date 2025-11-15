// src/routes/quiz.routes.js
import { Router } from 'express';
import { auth, requireRole } from '../middlewares/auth.js';
import {
  listQuizConfigs,
  startDynamicQuiz,
  submitDynamicQuiz,
  createQuizConfig,
  updateQuizConfig,
  deleteQuizConfig,
  getQuizConfigDetail
} from '../controllers/quiz.controller.js';

const r = Router();

// --- ROUTE CHO USER & PUBLIC ---
/**
 * @openapi
 * /quiz:
 * get:
 * tags:
 * - Quiz (Public/User)
 * summary: "Public: Lấy danh sách tất cả Chủ đề Quiz"
 */
r.get('/', listQuizConfigs);

/**
 * @openapi
 * /quiz/start/{configId}/{level}:
 * get:
 * tags:
 * - Quiz (Public/User)
 * summary: "User: Bắt đầu Quiz (Lấy bộ câu hỏi ngẫu nhiên)"
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: configId
 * required: true
 * schema:
 * type: string
 * - in: path
 * name: level
 * required: true
 * schema:
 * type: string
 * enum: [easy, medium, hard]
 */
r.get('/start/:configId/:level', auth(), startDynamicQuiz);

/**
 * @openapi
 * /quiz/submit:
 * post:
 * tags:
 * - Quiz (Public/User)
 * summary: "User: Nộp bài và nhận kết quả (Quiz động)"
 * security:
 * - bearerAuth: []
 */
r.post('/submit', auth(), submitDynamicQuiz);


// --- ROUTE CHO ADMIN ---

/**
 * @openapi
 * /quiz:
 * post:
 * tags:
 * - Quiz (Admin)
 * summary: "Admin: Tạo Chủ đề Quiz mới"
 * security:
 * - bearerAuth: []
 */
r.post('/', auth(), requireRole('admin'), createQuizConfig);
/**
 * @openapi
 * /quiz/{configId}:
 *   get:
 *     tags: [Quiz (Public/User)]
 *     summary: "User: Lấy chi tiết 1 Chủ đề Quiz (dùng để xem hoặc bắt đầu)"
 *     security:
 *       - bearerAuth: []
 * parameters:
 * - in: path
 * name: configId
 * required: true
 * schema:
 * type: string
 */
r.get('/:configId', auth(), getQuizConfigDetail);
/**
 * @openapi
 * /quiz/{configId}:
 * patch:
 * tags:
 * - Quiz (Admin)
 * summary: "Admin: Cập nhật Chủ đề Quiz"
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: configId
 * required: true
 * schema:
 * type: string
 */
r.patch('/:configId', auth(), requireRole('admin'), updateQuizConfig);

/**
 * @openapi
 * /quiz/{configId}:
 * delete:
 * tags:
 * - Quiz (Admin)
 * summary: "Admin: Xóa Chủ đề Quiz"
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: configId
 * required: true
 * schema:
 * type: string
 */
r.delete('/:configId', auth(), requireRole('admin'), deleteQuizConfig);

export default r;