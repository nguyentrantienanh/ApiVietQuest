// src/routes/user.routes.js
import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import {
  getMe,
  updateMe,
  deleteMe,
  getLastWeekWinners
} from '../controllers/user.controller.js';
import { uploadUserAvatar } from '../middlewares/upload.js';

const r = Router();

 r.get('/leaderboard/lastweek-winners', getLastWeekWinners);
// 🔒 Tất cả route ở file này yêu cầu đăng nhập
r.use(auth());

/**
 * @openapi
 * tags:
 * - name: User (Self)
 *   description: 🔒 Quản lý tài khoản cá nhân (cần token)
 */

/**
 * @openapi
 * /user/me:
 *   get:
 *     tags: [User (Self)]
 *     summary: Lấy thông tin người dùng hiện tại (chính mình)
 *     security:
 *       - bearerAuth: []
 */
r.get('/me', getMe);

/**
 * @openapi
 * /user/update:
 *   patch:
 *     tags: [User (Self)]
 *     summary: Cập nhật thông tin cá nhân (chính mình)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *               // các field text khác tuỳ pickUserUpdate
 */
r.patch('/update', uploadUserAvatar, updateMe);

/**
 * @openapi
 * /user/delete:
 *   delete:
 *     tags: [User (Self)]
 *     summary: Xóa tài khoản (chính mình)
 *     security:
 *       - bearerAuth: []
 */
r.delete('/delete', deleteMe);
 
export default r;
