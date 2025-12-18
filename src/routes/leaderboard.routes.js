
import { Router } from 'express';
import { getLeaderboard, getWeeklyLeaderboard, getProvinceLeaderboard,
    getLastWeeklyLeaderboard,          // 📍 HÀM MỚI
  getLastWeeklyProvinceLeaderboard  // 📍 HÀM MỚI
 } from '../controllers/leaderboard.controller.js';

const r = Router();

r.get('/', getLeaderboard); // BXH Tổng

r.get('/weekly', getWeeklyLeaderboard); // BXH Tuần
// ===============================================
// === 📍 API MỚI: BXH TUẦN TRƯỚC (lastWeeklyScore) ===
// ===============================================

r.get('/lastweekly', getLastWeeklyLeaderboard); 
r.get('/lastweekly/province/:provinceCode', getLastWeeklyProvinceLeaderboard); 
r.get('/province/:provinceCode', getProvinceLeaderboard);

export default r;