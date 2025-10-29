// src/controllers/auth.controller.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User.js';
import { validateRegister, pickRegister } from '../validators/auth.validator.js';

/** Helper: chuẩn hoá email */
function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

/** Helper: rút URL công khai từ file (CloudinaryStorage) */
function fileToPublicUrl(file) {
  if (!file) return undefined;
  if (file.secure_url) return file.secure_url;          // ưu tiên https
  if (file.url) return file.url;
  if (file.path && String(file.path).startsWith('http')) return file.path;
  if (file.filename) {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const fmt = file.format || 'jpg';
    return `https://res.cloudinary.com/${cloud}/image/upload/${file.filename}.${fmt}`;
  }
  return undefined;
}

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  );
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });

  const emailNorm = normalizeEmail(email);
  const user = await User.findOne({ email: emailNorm });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      provinces: user.provinces,
      provinces_code: user.provinces_code,
      avatar: user.avatar,
      streak: user.streak,
      biography: user.biography,
      creationdate: user.creationdate,
      role: user.role,
    }
  });
}

export async function me(req, res) {
  const user = await User.findById(req.user.id).select('email role createdAt');
  res.json({ user });
}

/**
 * Đăng ký tài khoản (có hỗ trợ avatar):
 * - Nếu client gửi file `avatar` (multipart/form-data) -> ưu tiên URL Cloudinary.
 * - Nếu không có file, nhưng body có `avatar` (URL) -> dùng URL.
 */
export async function register(req, res) {
  // Nếu validator yêu cầu raw body text, chạy trước để báo lỗi sớm
  const preErr = validateRegister(req.body);
  if (preErr) return res.status(400).json({ error: preErr });

  // Lấy field text hợp lệ
  const incoming = pickRegister(req.body);
  const emailNorm = normalizeEmail(incoming.email);

  // Check trùng email
  const exists = await User.findOne({ email: emailNorm });
  if (exists) return res.status(409).json({ error: 'Email đã được sử dụng' });

  // Hash password
  const hashed = await bcrypt.hash(incoming.password, 10);

  // Lấy avatar:
  // 1) Nếu có file từ Cloudinary
  let avatarUrl = undefined;
  if (req.file) {
    avatarUrl = fileToPublicUrl(req.file);
  }
  // 2) Nếu không có file mà body có avatar là URL -> dùng URL
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
    avatar: avatarUrl || '',               // có thể để rỗng nếu chưa có
    biography: incoming.biography || '',
  });

  await user.save();

  const token = signToken(user);
  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      provinces: user.provinces,
      provinces_code: user.provinces_code,
      avatar: user.avatar,
      streak: user.streak,
      biography: user.biography,
      creationdate: user.creationdate,
      role: user.role,
    }
  });
}
