// src/routes/user.routes.js
import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import {
  getMe,
  updateMe,
  deleteMe
} from '../controllers/user.controller.js';
import { uploadUserAvatar } from '../middlewares/upload.js';
const r = Router();

// *** BẢO VỆ TẤT CẢ CÁC ROUTE TRONG FILE NÀY ***
// Tất cả các route bên dưới đều yêu cầu đăng nhập (user thường hoặc admin)
r.use(auth());

/**
 * @openapi
 * tags:
 * - name: User (Self)
 * description: 🔒 Quản lý tài khoản cá nhân (cần token)
 */

/**
 * @openapi
 * /user/me:
 * get:
 * tags: [User (Self)]
 * summary: Lấy thông tin người dùng hiện tại (chính mình)
 * security:
 * - bearerAuth: []
 */
r.get('/me', getMe);

/**
 * @openapi
 * /user/update:
 * patch:
 * tags: [User (Self)]
 * summary: Cập nhật thông tin cá nhân (chính mình)
 * security:
 * - bearerAuth: []
 */
r.patch('/update',uploadUserAvatar, updateMe);

/**
 * @openapi
 * /user/delete:
 * delete:
 * tags: [User (Self)]
 * summary: Xóa tài khoản (chính mình)
 * security:
 * - bearerAuth: []
 */
r.delete('/delete', deleteMe);

export default r;