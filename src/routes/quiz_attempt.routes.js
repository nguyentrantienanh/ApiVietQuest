// src/routes/quiz_attempt.routes.js
import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import {
  getMyAttempts,
  getMyAttemptDetails
} from '../controllers/quiz_attempt.controller.js';

const r = Router();

// *** BẢO VỆ TẤT CẢ CÁC ROUTE TRONG FILE NÀY ***
r.use(auth());

/**
 * @openapi
 * /user/quizattempt:
 * get:
 * tags:
 * - User (Self)
 * summary: "User: Lấy lịch sử làm bài (của tôi)"
 * security:
 * - bearerAuth: []
 */
r.get('/', getMyAttempts);

/**
 * @openapi
 * /user/quizattempt/{attemptId}:
 * get:
 * tags:
 * - User (Self)
 * summary: "User: Lấy chi tiết 1 lần làm bài"
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: attemptId
 * required: true
 * schema:
 * type: string
 */
r.get('/:attemptId', getMyAttemptDetails);

export default r;