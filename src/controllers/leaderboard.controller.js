// src/controllers/leaderboard.controller.js
import { User } from '../models/User.js';

/**
 * [Public/User] Lấy bảng xếp hạng người dùng theo điểm kinh nghiệm
 * GET /api/leaderboard
 */
export async function getLeaderboard(req, res) {
  try {
    // Lấy top người dùng (vd: top 50)
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 100);

    const leaderboard = await User.find({ role: 'user' }) // Chỉ lấy user thường
      .select('name avatar experience') // Chỉ lấy các trường cần thiết
      .sort({ experience: -1 }) // Sắp xếp giảm dần theo experience
      .limit(limit);

    res.json(leaderboard);
  } catch (e) {
    console.error("Lỗi getLeaderboard:", e);
    res.status(500).json({ error: e.message || 'Lỗi server khi lấy bảng xếp hạng' });
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
      .select('name avatar weeklyScore') // Lấy điểm tuần
      .sort({ weeklyScore: -1 }) // Sort theo điểm tuần
      .limit(limit);
    res.json(leaderboard);
  } catch (e) {
    console.error("Lỗi getWeeklyLeaderboard:", e);
    res.status(500).json({ error: e.message || 'Lỗi server' });
  }
}