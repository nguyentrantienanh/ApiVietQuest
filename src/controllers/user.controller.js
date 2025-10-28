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
    // req.user.id đến từ middleware auth() và chính là _id
    const userId = req.user.id; // Lấy userId trực tiếp
    if (!userId) {
        console.error("Lỗi getMe: Không tìm thấy ID user trong token payload.");
        return res.status(401).json({ error: 'Token không hợp lệ hoặc thiếu thông tin user' });
    }

    const user = await User.findById(userId).select('-password'); // Sử dụng userId
    if (!user) {
        console.error(`Lỗi getMe: Không tìm thấy user với ID ${userId} trong DB.`);
        return res.status(404).json({ error: 'User không tồn tại' }); // Dùng 404 nếu ID hợp lệ nhưng user ko có
    }
    res.json(user);
  } catch (e) {
    console.error("Lỗi getMe:", e); // Log lỗi chi tiết
    if (e.kind === 'ObjectId') { // Kiểm tra nếu ID sai định dạng
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
    // SỬA Ở ĐÂY: Lấy userId trực tiếp từ req.user.id
    const userId = req.user.id;
    if (!userId) {
        console.error("Lỗi updateMe: Không tìm thấy ID user trong token payload.");
        return res.status(401).json({ error: 'Token không hợp lệ hoặc thiếu thông tin user' });
    }

    const updateData = pickUserUpdate(req.body); // req.body chỉ có text

    // Thêm logic đọc file avatar từ req.file (nếu có)
    if (req.file) {
      updateData.avatar = publicUrl(req.file.filename);
    }

    // Xử lý đổi mật khẩu (nếu có)
    if (updateData.password) {
      if (updateData.password.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
      }
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      // Nếu không gửi password hoặc gửi chuỗi rỗng, không cập nhật password
      delete updateData.password;
    }

    // Sử dụng userId lấy từ token để cập nhật
    const user = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');

    // Kiểm tra lại user sau khi cập nhật
    if (!user) {
        console.error(`Lỗi updateMe: Không tìm thấy user với ID ${userId} sau khi gọi findByIdAndUpdate.`);
        return res.status(404).json({ error: 'Không tìm thấy user để cập nhật' });
    }

    res.json(user); // Trả về user đã cập nhật
  } catch (e) {
    console.error("Lỗi updateMe:", e);
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
    // SỬA Ở ĐÂY: Lấy userId trực tiếp từ req.user.id
    const userId = req.user.id;
     if (!userId) {
        console.error("Lỗi deleteMe: Không tìm thấy ID user trong token payload.");
        return res.status(401).json({ error: 'Token không hợp lệ hoặc thiếu thông tin user' });
    }

    // Sử dụng userId lấy từ token để xóa
    const r = await User.findByIdAndDelete(userId);

    if (!r) {
        console.error(`Lỗi deleteMe: Không tìm thấy user với ID ${userId} để xóa.`);
        return res.status(404).json({ error: 'Không tìm thấy user để xóa' });
    }

    res.json({ ok: true, message: `Đã xóa tài khoản ${r.email}` });
  } catch (e) {
    console.error("Lỗi deleteMe:", e);
    if (e.kind === 'ObjectId') {
        return res.status(400).json({ error: 'Invalid user ID format in token' });
    }
    res.status(500).json({ error: e.message || 'Lỗi server khi xóa tài khoản' });
  }
}