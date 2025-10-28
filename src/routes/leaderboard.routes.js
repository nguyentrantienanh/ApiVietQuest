// src/routes/leaderboard.routes.js
import { Router } from 'express';
// Import cả 3 hàm
import { getLeaderboard, getWeeklyLeaderboard, getProvinceLeaderboard } from '../controllers/leaderboard.controller.js';

const r = Router();

/**
 * @openapi
 * tags:
 * - name: Leaderboard
 * description: Bảng xếp hạng người dùng
 */

/**
 * @openapi
 * /leaderboard:
 * get:
 * tags: [Leaderboard]
 * summary: "Lấy bảng xếp hạng TỔNG theo XP"
 * parameters:
 * - in: query
 * name: limit
 * schema:
 * type: integer
 * default: 50
 */
r.get('/', getLeaderboard); // BXH Tổng

/**
 * @openapi
 * /leaderboard/weekly:
 * get:
 * tags: [Leaderboard]
 * summary: "Lấy bảng xếp hạng TUẦN theo điểm tuần"
 * parameters:
 * - in: query
 * name: limit
 * schema:
 * type: integer
 * default: 50
 */
r.get('/weekly', getWeeklyLeaderboard); // BXH Tuần

/**
 * @openapi
 * /leaderboard/province/{provinceCode}:
 * get:
 * tags: [Leaderboard]
 * summary: "Lấy bảng xếp hạng theo TỈNH (dựa trên XP tổng)"
 * parameters:
 * - in: path
 * name: provinceCode
 * required: true
 * schema:
 * type: string
 * description: Mã codename của tỉnh (vd: tinh_khanh_hoa, thanh_pho_ha_noi)
 * - in: query
 * name: limit
 * schema:
 * type: integer
 * default: 50
 */
r.get('/province/:provinceCode', getProvinceLeaderboard); // BXH Tỉnh

export default r;