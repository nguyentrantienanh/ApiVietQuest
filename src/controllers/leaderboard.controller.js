// src/controllers/leaderboard.controller.js
import { User } from '../models/User.js';

/**
 * [Public/User] Lấy bảng xếp hạng TỔNG theo điểm kinh nghiệm
 * GET /api/leaderboard
 */
export async function getLeaderboard(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 100);
    const leaderboard = await User.find({ role: 'user' })
      .select('name avatar experience provinces_code') // Thêm province_code nếu cần hiển thị
      .sort({ experience: -1 })
      .limit(limit);
    res.json(leaderboard);
  } catch (e) {
    console.error("Lỗi getLeaderboard:", e);
    res.status(500).json({ error: e.message || 'Lỗi server' });
  }
}

/**
 * [Public/User] Lấy bảng xếp hạng TUẦN theo điểm tuần
 * GET /api/leaderboard/weekly
 */
export async function getWeeklyLeaderboard(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 100);
    const leaderboard = await User.find({ role: 'user' })
      .select('name avatar weeklyScore provinces_code') // Thêm province_code
      .sort({ weeklyScore: -1 })
      .limit(limit);
    res.json(leaderboard);
  } catch (e) {
    console.error("Lỗi getWeeklyLeaderboard:", e);
    res.status(500).json({ error: e.message || 'Lỗi server' });
  }
}

/**
 * [Public/User] Lấy bảng xếp hạng theo TỈNH (dựa trên XP tổng)
 * GET /api/leaderboard/province/:provinceCode
 */
export async function getProvinceLeaderboard(req, res) {
  try {
    const { provinceCode } = req.params; // Lấy mã tỉnh từ URL
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 100);

    if (!provinceCode) {
      return res.status(400).json({ error: 'Thiếu mã tỉnh (provinceCode)' });
    }

    const leaderboard = await User.find({
        role: 'user',
        provinces_code: provinceCode // Lọc theo mã tỉnh
      })
      .select('name avatar experience') // Chỉ lấy thông tin cần thiết
      .sort({ experience: -1 }) // Sắp xếp theo XP tổng
      .limit(limit);

    res.json(leaderboard);
  } catch (e) {
    console.error("Lỗi getProvinceLeaderboard:", e);
    res.status(500).json({ error: e.message || 'Lỗi server' });
  }
}
