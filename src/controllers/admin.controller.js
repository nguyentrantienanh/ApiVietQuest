// src/controllers/admin.controller.js
import { User } from '../models/User.js';
import { validateAdminCreate, pickAdminUpdate } from '../validators/user.validator.js';
import { pickRegister } from '../validators/auth.validator.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { resetWeeklyLeaderboard } from '../services/scheduler.js';

/** Helper: chuẩn hoá email */
function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

/** Helper: lấy URL công khai từ file CloudinaryStorage */
function fileToPublicUrl(file) {
  if (!file) return undefined;
  if (file.secure_url) return file.secure_url; // ưu tiên https
  if (file.url) return file.url;
  if (file.path && String(file.path).startsWith('http')) return file.path;
  // fallback hiếm khi cần
  if (file.filename) {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const fmt = file.format || 'jpg';
    return `https://res.cloudinary.com/${cloud}/image/upload/${file.filename}.${fmt}`;
  }
  return undefined;
}

/**
 * [Admin] Lấy danh sách user (có phân trang)
 * GET /api/admin
 */
export async function adminListUsers(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '1000000', 10), 1), 1000000);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      User.find({}).select('-password').sort('-createdAt').skip(skip).limit(limit),
      User.countDocuments({})
    ]);

    res.json({ items, total, page, limit, hasMore: skip + items.length < total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/**
 * [Admin] Lấy chi tiết user theo _id
 * GET /api/admin/:_id
 */
export async function adminGetUserById(req, res) {
  try {
    const { _id } = req.params;
    const user = await User.findById(_id).select('-password');

    if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });
    res.json(user);
  } catch (e) {
    if (e.kind === 'ObjectId') {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    res.status(500).json({ error: e.message });
  }
}

/**
 * [Admin] Tạo user
 * POST /api/admin/add
 * - Hỗ trợ upload avatar (field: avatar) hoặc avatar là URL text
 */
export async function adminCreateUser(req, res) {
  try {
    const err = validateAdminCreate(req.body);
    if (err) {
      console.error('>>> VALIDATION 400:', err, 'BODY:', req.body);
      return res.status(400).json({ error: err });
    }

    const incoming = pickRegister(req.body); // name, email, password, phone, provinces, provinces_code, avatar?, biography?
    const { password, role } = req.body;

    // Chuẩn hoá email
    const emailNorm = normalizeEmail(incoming.email);

    console.log('>>> [ADMIN CREATE] checking email:', emailNorm);

    const exists = await User.findOne({ email: emailNorm });
    if (exists) {
      console.error('>>> 409 CONFLICT: email exists in DB:', exists.email);
      return res.status(409).json({ error: 'Email đã được sử dụng' });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Avatar: ưu tiên file Cloudinary
    let avatarUrl = undefined;
    if (req.file) {
      avatarUrl = fileToPublicUrl(req.file);
    }
    // Nếu không có file mà body có avatar là URL http/https
    if (!avatarUrl && incoming.avatar && /^https?:\/\//i.test(incoming.avatar)) {
      avatarUrl = incoming.avatar;
    }

    const user = new User({
      id: uuidv4(),
      name: incoming.name,
      email: emailNorm,
      password: hashed,
      phone: incoming.phone,
      provinces: incoming.provinces,
      provinces_code: incoming.provinces_code,
      avatar: avatarUrl || '',
      biography: incoming.biography || '',
      role: role || 'user',
    });

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    res.status(201).json(userObj);
  } catch (e) {
    console.error('>>> 500 ERROR:', e);
    if (e.code === 11000) return res.status(409).json({ error: 'Email đã tồn tại' });
    res.status(500).json({ error: e.message });
  }
}

/**
 * [Admin] Cập nhật user (bao gồm đổi mật khẩu, avatar)
 * PATCH /api/admin/update/:_id
 */
export async function adminUpdateUser(req, res) {
  try {
    const { _id } = req.params;
    const updateData = pickAdminUpdate(req.body); // chỉ field text được phép

    // Avatar: ưu tiên file Cloudinary
    if (req.file) {
      const url = fileToPublicUrl(req.file);
      if (url) updateData.avatar = url;
    } else if (typeof updateData.avatar === 'string') {
      // nếu gửi avatar là URL text
      if (!/^https?:\/\//i.test(updateData.avatar)) {
        // nếu không phải URL http/https thì bỏ qua để tránh lưu rác
        delete updateData.avatar;
      }
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

    // Cập nhật email (nếu có) -> normalize + check trùng
    if (updateData.email) {
      const emailNorm = normalizeEmail(updateData.email);
      const exists = await User.findOne({ email: emailNorm, _id: { $ne: _id } });
      if (exists) return res.status(409).json({ error: 'Email đã được sử dụng' });
      updateData.email = emailNorm;
    }

    const user = await User.findByIdAndUpdate(_id, updateData, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/**
 * [Admin] Xóa user
 * DELETE /api/admin/delete/:_id
 */
export async function adminDeleteUser(req, res) {
  try {
    const { _id } = req.params;

    // Không cho admin tự xóa mình qua route này
    if (req.user.id === _id) {
      return res.status(403).json({ error: 'Không thể tự xóa chính mình qua route admin. Dùng /api/user/delete' });
    }

    const r = await User.findByIdAndDelete(_id);
    if (!r) return res.status(404).json({ error: 'Không tìm thấy user' });

    res.json({ ok: true, message: `Đã xóa user ${r.email}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/**
 * [Admin] Trigger weekly reset (manual/admin)
 * POST /api/admin/reset-weekly
 */
export async function adminResetWeekly(req, res) {
  try {
    await resetWeeklyLeaderboard();
    res.json({ ok: true, message: 'Weekly leaderboard reset triggered' });
  } catch (e) {
    console.error('Error triggering weekly reset via admin endpoint:', e);
    res.status(500).json({ error: e.message });
  }
}
