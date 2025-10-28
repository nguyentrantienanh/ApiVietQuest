import { Router } from 'express';
import { login, me, register } from '../controllers/auth.controller.js';
import { validateRegister } from '../validators/auth.validator.js';
import { auth } from '../middlewares/auth.js';

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
 *     summary: Đăng ký tài khoản user (public)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       201: { description: Created }
 */
r.post('/register', register);

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

export default r;
