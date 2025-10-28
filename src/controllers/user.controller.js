// src/controllers/user.controller.js
import { User } from '../models/User.js';
import { pickUserUpdate } from '../validators/user.validator.js';
import bcrypt from 'bcryptjs';
import { publicUrl } from '../middlewares/upload.js';

/**
 * [User] Lấy thông tin cá nhân (chính mình)
 * GET /api/user/me
 */
export async function getMe(req, res) {
  try {
    // req.user.id đến từ middleware auth()
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/**
 * [User] Cập nhật thông tin cá nhân (chính mình)
 * PATCH /api/user/update
 */
export async function updateMe(req, res) {
  try {
    const { _id } = req.user.id; // Lấy _id từ token
    const updateData = pickUserUpdate(req.body); // req.body chỉ có text

    // ▼▼▼ THÊM LOGIC ĐỌC TỪ req.file ▼▼▼
    if (req.file) {
      updateData.avatar = publicUrl(req.file.filename);
    }
    // ▲▲▲

    // Xử lý đổi mật khẩu (nếu có)
    if (updateData.password) {
      if (updateData.password.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
      }
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password;
    }

    const user = await User.findByIdAndUpdate(_id, updateData, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/**
 * [User] Xóa tài khoản (chính mình)
 * DELETE /api/user/delete
 */
export async function deleteMe(req, res) {
  try {
    const { _id } = req.user.id; // Lấy _id từ token
    
    const r = await User.findByIdAndDelete(_id);
    if (!r) return res.status(404).json({ error: 'Không tìm thấy user' });

    res.json({ ok: true, message: `Đã xóa tài khoản ${r.email}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}