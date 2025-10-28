// src/controllers/admin.controller.js
import { User } from '../models/User.js';
import { validateAdminCreate, pickAdminUpdate } from '../validators/user.validator.js';
import { pickRegister } from '../validators/auth.validator.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { publicUrl } from '../middlewares/upload.js';
/**
 * [Admin] Lấy danh sách user (có phân trang)
 * GET /api/admin
 */
export async function adminListUsers(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
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

export async function adminGetUserById(req, res) {
  try {
    const { _id } = req.params;
    const user = await User.findById(_id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy user' });
    }
    
    res.json(user);
  } catch (e) {
    // Xử lý trường hợp _id không đúng định dạng Mongo
    if (e.kind === 'ObjectId') {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    res.status(500).json({ error: e.message });
  }
}

export async function adminCreateUser(req, res) {
  try {
    const err = validateAdminCreate(req.body);
    if (err) {
      // ▼▼▼ LOG 1: XEM LỖI 400 (VALIDATION) ▼▼▼
      console.error('>>> LỖI VALIDATION (400):', err, 'BODY NHẬN ĐƯỢC:', req.body);
      return res.status(400).json({ error: err });
    }

    const incoming = pickRegister(req.body);
    const { email, password, role } = req.body;
    const emailNorm = String(email); // Anh đã bỏ .toLowerCase().trim()

    // ▼▼▼ LOG 2: XEM EMAIL ĐANG KIỂM TRA LÀ GÌ ▼▼▼
    console.log('>>> [ADMIN CREATE] Đang kiểm tra email:', emailNorm);

    const exists = await User.findOne({ email: emailNorm });
    if (exists) {
      // ▼▼▼ LOG 3: XEM LỖI 409 (TRÙNG) ▼▼▼
      console.error('>>> LỖI TRÙNG (409): Database tìm thấy email này:', exists.email);
      return res.status(409).json({ error: 'Email đã được sử dụng' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      ...incoming,
      email: emailNorm,
      password: hashed,
      role: role || 'user',
    });

    if (req.file) {
      user.avatar = publicUrl(req.file.filename);
    }

    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    res.status(201).json(userObj);
  } catch (e) {
    // ▼▼▼ LOG 4: XEM LỖI 500 (LỖI CHUNG) ▼▼▼
    console.error('>>> LỖI 500 (SERVER ERROR):', e);
    // Lỗi 11000 (trùng lặp) gần như 100% là do email
    if (e.code === 11000) return res.status(409).json({ error: 'Email đã tồn tại' });
    res.status(500).json({ error: e.message });
  }
}

/**
 * [Admin] Cập nhật thông tin user (bao gồm đổi mk)
 * PATCH /api/admin/update/:_id
 */
export async function adminUpdateUser(req, res) {
  try {
    const { _id } = req.params;
    const updateData = pickAdminUpdate(req.body); // req.body chỉ có text

    // ▼▼▼ THÊM LOGIC ĐỌC TỪ req.file ▼▼▼
    if (req.file) {
      updateData.avatar = publicUrl(req.file.filename);
    }
    // ▲▲▲

    if (updateData.password) {
      if (updateData.password.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
      }
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password;
    }

    if (updateData.email) {
      const emailNorm = String(updateData.email).toLowerCase().trim();
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