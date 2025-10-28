// src/routes/leaderboard.routes.js
import { Router } from 'express';
// Import cả 2 hàm
import { getLeaderboard, getWeeklyLeaderboard } from '../controllers/leaderboard.controller.js';

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
 * summary: "Lấy bảng xếp hạng TỔNG theo điểm kinh nghiệm (XP)"
 * parameters:
 * - in: query
 * name: limit
 * schema:
 * type: integer
 * default: 50
 */
r.get('/', getLeaderboard); // Bảng xếp hạng tổng

/**
 * @openapi
 * /leaderboard/weekly:
 * get:
 * tags: [Leaderboard]
 * summary: "Lấy bảng xếp hạng TUẦN theo điểm tuần (Weekly Score)"
 * parameters:
 * - in: query
 * name: limit
 * schema:
 * type: integer
 * default: 50
 */
r.get('/weekly', getWeeklyLeaderboard); // Bảng xếp hạng tuần

export default r;