import { auth, requireRole } from '../middlewares/auth.js';
import { Router } from 'express';
import { uploadHeritageImages } from '../middlewares/upload.js';
import {
  createHeritage, listHeritages, getHeritage, updateHeritage, deleteHeritage, enums
} from '../controllers/heritage.controller.js';
 
 
const r = Router();

/**
 * @openapi
 * tags:
 *   - name: Public
 *     description: Endpoint dùng chung (không cần token)
 *   - name: Admin
 *     description: 🔒 Chỉ Admin (cần Bearer token)
 */

/**
 * @openapi
 * /heritages/enums:
 *   get:
 *     tags: [Public]
 *     summary: Danh sách enum (type/level)
 *     responses:
 *       200: { description: OK }
 */
r.get('/enums', enums);

/**
 * @openapi
 * /heritages:
 *   get:
 *     tags: [Public]
 *     summary: Danh sách di sản (lọc, phân trang, tìm kiếm, near-by)
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: ward_codename
 *         schema: { type: string }
 *       - in: query
 *         name: type_code
 *         schema: { type: integer, enum: [1,2,3] }
 *       - in: query
 *         name: code_level
 *         schema: { type: integer, enum: [1,2,3,4,5,6,7,8] }
 *       - in: query
 *         name: near
 *         schema: { type: string, example: "21.036,105.836" }
 *         description: lat,lng
 *       - in: query
 *         name: radiusKm
 *         schema: { type: number, example: 5 }
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 20 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, example: "-createdAt" }
 *     responses:
 *       200:
 *         description: OK
 */
r.get('/', listHeritages);

/**
 * @openapi
 * /heritages/{hid}:
 *   get:
 *     tags: [Public]
 *     summary: Lấy chi tiết di sản theo hid
 *     parameters:
 *       - in: path
 *         name: hid
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Không tìm thấy }
 */
r.get('/:hid', getHeritage);

/**
 * (Admin) Tạo di sản: use POST /heritages/add (see below)
 */

// Alternate clearer admin paths (compatibility) -> /heritages/add
/**
 * @openapi
 * /heritages/add:
 *   post:
 *     tags: [Admin]
 *     summary: (Admin) Tạo di sản (tương đương POST /heritages)
 *     security:
 *       - bearerAuth: []
 */
r.post('/add' , auth (), requireRole('admin'), uploadHeritageImages, createHeritage);

/**
 * (Admin) Cập nhật di sản: use PATCH /heritages/update/:hid (see below)
 */

// Alternate clearer admin path -> /heritages/update/:hid
/**
 * @openapi
 * /heritages/update/{hid}:
 *   patch:
 *     tags: [Admin]
 *     summary: (Admin) Cập nhật di sản theo hid (tương đương PATCH /heritages/{hid})
 *     security:
 *       - bearerAuth: []
 */
r.patch('/update/:hid' , auth (), requireRole('admin'), uploadHeritageImages, updateHeritage);

/**
 * (Admin) Xoá di sản: use DELETE /heritages/delete/:hid (see below)
 */

// Alternate clearer admin path -> /heritages/delete/:hid
/**
 * @openapi
 * /heritages/delete/{hid}:
 *   delete:
 *     tags: [Admin]
 *     summary: (Admin) Xoá di sản theo hid (tương đương DELETE /heritages/{hid})
 *     security:
 *       - bearerAuth: []
 */
r.delete('/delete/:hid' , auth (), requireRole('admin'), deleteHeritage);

export default r;
