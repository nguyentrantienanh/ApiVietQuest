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
import { uploadUserAvatar } from '../middlewares/upload.js';
const r = Router();

// *** BẢO VỆ TẤT CẢ CÁC ROUTE TRONG FILE NÀY ***
r.use(auth(), requireRole('admin'));

/**
 * @openapi
 * tags:
 * - name: Admin
 * description: 🔒 Quản lý User (Chỉ Admin)
 */

/**
 * @openapi
 * /admin:
 * get:
 * tags: [Admin]
 * summary: (Admin) Lấy danh sách user
 * security:
 * - bearerAuth: []
 */
r.get('/', adminListUsers);  

/**
 * @openapi
 * /admin/{_id}:
 * get:
 * tags: [Admin]
 * summary: (Admin) Lấy chi tiết 1 user
 * security:
 * - bearerAuth: []
 * parameters:
 * - in: path
 * name: _id
 * required: true
 * schema: { type: string }
 * description: Mongo _id của user
 */
r.get('/:_id', adminGetUserById);
/**
 * @openapi
 * /admin/add:
 * post:
 * tags: [Admin]
 * summary: (Admin) Tạo user mới
 * security:
 * - bearerAuth: []
 */
r.post('/add',uploadUserAvatar, adminCreateUser);

/**
 * @openapi
 * /admin/update/{_id}:
 * patch:
 * tags: [Admin]
 * summary: (Admin) Cập nhật user (hỗ trợ đổi mk)
 * security:
 * - bearerAuth: []
 */
r.patch('/update/:_id',uploadUserAvatar, adminUpdateUser);

/**
 * @openapi
 * /admin/delete/{_id}:
 * delete:
 * tags: [Admin]
 * summary: (Admin) Xóa user
 * security:
 * - bearerAuth: []
 */
r.delete('/delete/:_id', adminDeleteUser);

export default r;