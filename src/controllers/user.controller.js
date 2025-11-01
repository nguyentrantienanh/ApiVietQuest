// src/controllers/user.controller.js
import { User } from '../models/User.js';
import { pickUserUpdate } from '../validators/user.validator.js';
import bcrypt from 'bcryptjs';

/** Lấy URL công khai từ file upload của CloudinaryStorage */
function fileToPublicUrl(file) {
  if (!file) return undefined;
  // CloudinaryStorage meta thường có:
  // - secure_url (https)  ← ưu tiên
  // - url
  // - path (nhiều bản map luôn URL vào path)
  if (file.secure_url) return file.secure_url;
  if (file.url) return file.url;
  if (file.path && String(file.path).startsWith('http')) return file.path;

  // Fallback hiếm khi cần: tự dựng từ filename/public_id + format
  if (file.filename) {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const fmt = file.format || 'jpg';
    return `https://res.cloudinary.com/${cloud}/image/upload/${file.filename}.${fmt}`;
  }
  return undefined;
}

/**
 * [User] Lấy thông tin cá nhân (chính mình)
 * GET /api/user/me
 */
export async function getMe(req, res) {
  try {
    // req.user.id đến từ middleware auth() và chính là _id
    const userId = req.user.id;
    if (!userId) {
      console.error('Lỗi getMe: Không tìm thấy ID user trong token payload.');
      return res.status(401).json({ error: 'Token không hợp lệ hoặc thiếu thông tin user' });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      console.error(`Lỗi getMe: Không tìm thấy user với ID ${userId} trong DB.`);
      return res.status(404).json({ error: 'User không tồn tại' });
    }
    res.json(user);
  } catch (e) {
    console.error('Lỗi getMe:', e);
    if (e.kind === 'ObjectId') {
      return res.status(400).json({ error: 'Invalid user ID format in token' });
    }
    res.status(500).json({ error: e.message || 'Lỗi server khi lấy thông tin user' });
  }
}

/**
 * [User] Cập nhật thông tin cá nhân (chính mình)
 * PATCH /api/user/update
 */
export async function updateMe(req, res) {
  try {
    const userId = req.user.id;
    if (!userId) {
      console.error('Lỗi updateMe: Không tìm thấy ID user trong token payload.');
      return res.status(401).json({ error: 'Token không hợp lệ hoặc thiếu thông tin user' });
    }

    const updateData = pickUserUpdate(req.body); // chỉ chứa field text cho phép cập nhật

    // ✅ NHẬN AVATAR TỪ CLOUDINARY
    if (req.file) {
      const url = fileToPublicUrl(req.file);
      if (url) updateData.avatar = url;
    }

    // Đổi mật khẩu (nếu có)
    if (updateData.password) {
      if (updateData.password.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
      }
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password;
    }

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');
    if (!user) {
      console.error(`Lỗi updateMe: Không tìm thấy user với ID ${userId} sau khi cập nhật.`);
      return res.status(404).json({ error: 'Không tìm thấy user để cập nhật' });
    }

    res.json(user);
  } catch (e) {
    console.error('Lỗi updateMe:', e);
    if (e.kind === 'ObjectId') {
      return res.status(400).json({ error: 'Invalid user ID format in token' });
    }
    res.status(500).json({ error: e.message || 'Lỗi server khi cập nhật thông tin' });
  }
}

/**
 * [User] Xóa tài khoản (chính mình)
 * DELETE /api/user/delete
 */
export async function deleteMe(req, res) {
  try {
    const userId = req.user.id;
    if (!userId) {
      console.error('Lỗi deleteMe: Không tìm thấy ID user trong token payload.');
      return res.status(401).json({ error: 'Token không hợp lệ hoặc thiếu thông tin user' });
    }

    const r = await User.findByIdAndDelete(userId);
    if (!r) {
      console.error(`Lỗi deleteMe: Không tìm thấy user với ID ${userId} để xóa.`);
      return res.status(404).json({ error: 'Không tìm thấy user để xóa' });
    }

    res.json({ ok: true, message: `Đã xóa tài khoản ${r.email}` });
  } catch (e) {
    console.error('Lỗi deleteMe:', e);
    if (e.kind === 'ObjectId') {
      return res.status(400).json({ error: 'Invalid user ID format in token' });
    }
    res.status(500).json({ error: e.message || 'Lỗi server khi xóa tài khoản' });
  }
}
/**
 * [Public] Lấy Top 3 người chiến thắng tuần trước
 * GET /api/user/leaderboard/lastweek-winners
 */
export async function getLastWeekWinners(req, res) {
  try {
    // Chỉ tìm những người có lastWeekRank = 1
    const winners = await User.find({ lastWeekRank: 1 })
      .select('name avatar provinces weeklyScore lastWeekWinnerCount') // Lấy các trường cần thiết
      .sort({ weeklyScore: -1 }) // Sắp xếp theo điểm (nếu có nhiều người)
      .limit(3) // Chỉ lấy tối đa 3 người
      .lean();

    // Quan trọng: Trả về mảng rỗng [] nếu không có ai
    res.json(winners);
  } catch (e) {
    console.error('Lỗi getLastWeekWinners:', e);
    res.status(500).json({ error: e.message || 'Lỗi server khi lấy người thắng tuần trước' });
  }
}