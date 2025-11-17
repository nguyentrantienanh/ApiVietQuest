// src/routes/admin.routes.js
import { Router } from 'express';
import { auth, requireRole } from '../middlewares/auth.js';
import {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminGetUserById
} from '../controllers/admin.controller.js';
import { adminResetWeekly } from '../controllers/admin.controller.js';
import { uploadUserAvatar } from '../middlewares/upload.js';

const r = Router();

// 🔒 Tất cả route dưới đây yêu cầu đăng nhập admin
r.use(auth(), requireRole('admin'));

/**
 * @openapi
 * tags:
 * - name: Admin
 *   description: 🔒 Quản lý User (Chỉ Admin)
 */

/**
 * @openapi
 * /admin:
 *   get:
 *     tags: [Admin]
 *     summary: (Admin) Lấy danh sách user
 *     security:
 *       - bearerAuth: []
 */
r.get('/', adminListUsers);

/**
 * @openapi
 * /admin/{_id}:
 *   get:
 *     tags: [Admin]
 *     summary: (Admin) Lấy chi tiết 1 user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: _id
 *         required: true
 *         schema: { type: string }
 *         description: Mongo _id của user
 */
r.get('/:_id', adminGetUserById);

/**
 * @openapi
 * /admin/add:
 *   post:
 *     tags: [Admin]
 *     summary: (Admin) Tạo user mới (hỗ trợ upload avatar)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: "Nguyễn Văn A" }
 *               email: { type: string, example: "user@example.com" }
 *               password: { type: string, example: "secret123" }
 *               role: { type: string, enum: [admin, user], example: "user" }
 *               phone: { type: string, example: "0987654321" }
 *               provinces: { type: string, example: "Khánh Hòa" }
 *               provinces_code: { type: string, example: "56" }
 *               biography: { type: string, example: "Hi!" }
 *               avatar:
 *                 type: string
 *                 format: binary
 *           encoding:
 *             avatar:
 *               contentType: image/png, image/jpeg, image/webp
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               role: { type: string, enum: [admin, user] }
 *               phone: { type: string }
 *               provinces: { type: string }
 *               provinces_code: { type: string }
 *               biography: { type: string }
 *               avatar: { type: string, description: "URL http/https nếu không upload file" }
 */
r.post('/add', uploadUserAvatar, adminCreateUser);

/**
 * @openapi
 * /admin/update/{_id}:
 *   patch:
 *     tags: [Admin]
 *     summary: (Admin) Cập nhật user (đổi mk, avatar)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: _id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               name: { type: string }
 *               phone: { type: string }
 *               provinces: { type: string }
 *               provinces_code: { type: string }
 *               biography: { type: string }
 *               role: { type: string, enum: [admin, user] }
 *               password: { type: string, description: ">= 6 ký tự" }
 *               avatar:
 *                 type: string
 *                 format: binary
 *           encoding:
 *             avatar:
 *               contentType: image/png, image/jpeg, image/webp
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               name: { type: string }
 *               phone: { type: string }
 *               provinces: { type: string }
 *               provinces_code: { type: string }
 *               biography: { type: string }
 *               role: { type: string, enum: [admin, user] }
 *               password: { type: string }
 *               avatar: { type: string, description: "URL http/https nếu không upload file" }
 */
r.patch('/update/:_id', uploadUserAvatar, adminUpdateUser);

/**
 * @openapi
 * /admin/delete/{_id}:
 *   delete:
 *     tags: [Admin]
 *     summary: (Admin) Xóa user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: _id
 *         required: true
 *         schema: { type: string }
 */
r.delete('/delete/:_id', adminDeleteUser);

/**
 * @openapi
 * /admin/reset-weekly:
 *   post:
 *     tags: [Admin]
 *     summary: (Admin) Kích hoạt reset bảng xếp hạng tuần ngay lập tức
 *     security:
 *       - bearerAuth: []
 */
r.post('/reset-weekly', adminResetWeekly);

export default r;
