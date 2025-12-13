// src/routes/auth.routes.js
import { Router } from 'express';
import { login, me, register, forgotPassword, verifyOtp, resetPassword } from '../controllers/auth.controller.js';
import { auth } from '../middlewares/auth.js';
import { uploadUserAvatar } from '../middlewares/upload.js';
import { verifyAccount, resendOtp } from '../controllers/auth.controller.js'; // Nhớ import
const r = Router();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Đăng nhập & thông tin tài khoản
 */

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng nhập, trả về JWT (admin hoặc user)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "admin@vietquest.local" }
 *               password: { type: string, example: "Admin@123" }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     email: { type: string }
 *                     role: { type: string, enum: [admin, user] }
 */
r.post('/login', login);

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng ký tài khoản user (public) — hỗ trợ upload avatar
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
 *               phone: { type: string, example: "0987654321" }
 *               provinces: { type: string, example: "Khánh Hòa" }
 *               provinces_code: { type: string, example: "56" }
 *               biography: { type: string, example: "Hello VietQuest!" }
 *               // Cách A: upload trực tiếp file avatar
 *               avatar:
 *                 type: string
 *                 format: binary
 *               // Cách B: nếu đã có URL avatar sẵn, gửi kèm field text avatar (URL http/https)
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
 *               phone: { type: string }
 *               provinces: { type: string }
 *               provinces_code: { type: string }
 *               biography: { type: string }
 *               avatar: { type: string, description: "URL http/https nếu không upload file" }
 *     responses:
 *       201: { description: Created }
 */

r.post('/register', uploadUserAvatar, register);
/**
 * @openapi
 * /auth/verify-account:
 * post:
 * tags: [Auth]
 * summary: Kích hoạt tài khoản bằng OTP sau khi đăng ký
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required: [email, otp]
 * properties:
 * email: { type: string }
 * otp: { type: string }
 */
r.post('/verify-account', verifyAccount);
/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Lấy thông tin người dùng hiện tại
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: OK }
 *       401: { description: Unauthorized }
 */
r.get('/me', auth(true), me);
// === ROUTES MỚI CHO QUÊN MẬT KHẨU ===

/**
 * @openapi
 * /auth/forgot-password:
 * post:
 * summary: Gửi OTP về email
 * tags: [Auth]
 * requestBody:
 * content:
 * application/json:
 * schema:
 * type: object
 * required: [email]
 * properties:
 * email: { type: string }
 */
r.post('/forgot-password', forgotPassword);

/**
 * @openapi
 * /auth/verify-otp:
 * post:
 * summary: Kiểm tra OTP
 * tags: [Auth]
 * requestBody:
 * content:
 * application/json:
 * schema:
 * type: object
 * required: [email, otp]
 * properties:
 * email: { type: string }
 * otp: { type: string }
 */
r.post('/verify-otp', verifyOtp);

/**
 * @openapi
 * /auth/reset-password:
 * post:
 * summary: Đặt mật khẩu mới
 * tags: [Auth]
 * requestBody:
 * content:
 * application/json:
 * schema:
 * type: object
 * required: [email, otp, newPassword]
 * properties:
 * email: { type: string }
 * otp: { type: string }
 * newPassword: { type: string }
 */
r.post('/reset-password', resetPassword);
export default r;
