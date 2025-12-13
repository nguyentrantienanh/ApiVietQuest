// src/controllers/auth.controller.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { User } from '../models/User.js';
import { validateRegister, pickRegister } from '../validators/auth.validator.js';
import 'dotenv/config'; 

// --- CẤU HÌNH BREVO (SMTP) ---
// Đảm bảo file .env có EMAIL_USER (email brevo) và EMAIL_PASS (smtp key)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Lấy từ biến môi trường
    pass: process.env.EMAIL_PASS  // Lấy từ biến môi trường
  },
  // 👇 CÁC DÒNG QUAN TRỌNG ĐỂ RENDER CHẠY ĐƯỢC 👇
  family: 4,               // Ép dùng IPv4 (Chìa khóa để không bị treo trên Render)
  logger: true,            // Bật log để theo dõi
  debug: true,             // Bật debug
  tls: { 
    rejectUnauthorized: false // Bỏ qua lỗi chứng chỉ SSL
  }
});

// Debug kết nối mail
transporter.verify(function (error, success) {
  if (error) {
    console.log('🔴 LỖI KẾT NỐI EMAIL:', error);
  } else {
    console.log('🟢 KẾT NỐI EMAIL THÀNH CÔNG');
  }
});

/** Helper: chuẩn hoá email */
function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

/** Helper: rút URL công khai từ file */
function fileToPublicUrl(file) {
  if (!file) return undefined;
  if (file.secure_url) return file.secure_url;
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

/** Helper: Gửi email OTP */
async function sendEmailOtp(email, otp, type = 'REGISTER') {
  const subject = type === 'REGISTER' 
    ? '🚀 Kích hoạt tài khoản VietQuest' 
    : '🔑 Mã xác thực đặt lại mật khẩu - VietQuest';
    
  const title = type === 'REGISTER' 
    ? 'Chào mừng đến với VietQuest!' 
    : 'Yêu cầu đặt lại mật khẩu';

  const desc = type === 'REGISTER'
    ? 'Mã xác thực đăng ký tài khoản của bạn là:'
    : 'Mã xác thực (OTP) của bạn là:';

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #4F46E5;">${title}</h2>
      <p>${desc}</p>
      <h1 style="color: #D97706; letter-spacing: 5px;">${otp}</h1>
      <p>Mã này sẽ hết hạn trong vòng <b>10 phút</b>.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #999;">VietQuest Support Team</p>
    </div>
  `;

  await transporter.sendMail({
    from: '"VietQuest Support" <no-reply@vietquest.com>',
    to: email,
    subject: subject,
    html: html
  });
}

// ============================================================
// 1. ĐĂNG KÝ (REGISTER)
// ============================================================
export async function register(req, res) {
  try {
    const preErr = validateRegister(req.body);
    if (preErr) return res.status(400).json({ error: preErr });

    const incoming = pickRegister(req.body);
    const emailNorm = normalizeEmail(incoming.email);

    const existingUser = await User.findOne({ email: emailNorm });
    
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(409).json({ error: 'Email đã được sử dụng.' });
      }
      
      const hashed = await bcrypt.hash(incoming.password, 10);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      existingUser.name = incoming.name;
      existingUser.password = hashed;
      existingUser.phone = incoming.phone;
      existingUser.otp = otp;
      existingUser.otpExpires = Date.now() + 10 * 60 * 1000;
      
      await existingUser.save();
      await sendEmailOtp(existingUser.email, otp, 'REGISTER');
      
      return res.status(200).json({ 
        message: 'Tài khoản chưa kích hoạt. Mã xác thực mới đã được gửi lại vào email.',
        needVerify: true,
        email: emailNorm
      });
    }

    const hashed = await bcrypt.hash(incoming.password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    let avatarUrl = undefined;
    if (req.file) avatarUrl = fileToPublicUrl(req.file);
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
      isVerified: false,
      otp: otp,
      otpExpires: Date.now() + 10 * 60 * 1000
    });

    await user.save();
    await sendEmailOtp(user.email, otp, 'REGISTER');

    res.status(201).json({
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để nhập mã xác thực.',
      needVerify: true,
      email: emailNorm
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server khi đăng ký.' });
  }
}

// ============================================================
// 2. KÍCH HOẠT TÀI KHOẢN
// ============================================================
export async function verifyAccount(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Thiếu thông tin xác thực' });

    const user = await User.findOne({ 
      email: normalizeEmail(email),
      otp: otp,
      otpExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: 'Mã OTP sai hoặc đã hết hạn.' });

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = signToken(user);
    res.json({ message: 'Kích hoạt tài khoản thành công!', token, user });

  } catch (error) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
}

// ============================================================
// 3. ĐĂNG NHẬP
// ============================================================
export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });

  const user = await User.findOne({ email: normalizeEmail(email) });
  
  if (!user) return res.status(401).json({ error: 'Thông tin đăng nhập không đúng' });
  if (!user.isVerified) return res.status(403).json({ error: 'Tài khoản chưa được kích hoạt.', needVerify: true, email: user.email });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Thông tin đăng nhập không đúng' });

  const token = signToken(user);
  res.json({ token, user });
}

// ============================================================
// 4. QUÊN MẬT KHẨU (FORGOT PASSWORD) - BƯỚC 1: GỬI OTP
// ============================================================
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    // CHỈ KIỂM TRA EMAIL - KHÔNG KIỂM TRA MẬT KHẨU MỚI Ở ĐÂY
    if (!email) return res.status(400).json({ error: 'Vui lòng nhập email' });

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(404).json({ error: 'Email chưa được đăng ký.' });

    // Tạo OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000; 
    await user.save();

    // Gửi mail
    await sendEmailOtp(user.email, otp, 'FORGOT_PASS');

    res.json({ message: 'Mã xác thực đã được gửi tới email của bạn.' });

  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Lỗi server khi gửi email.' });
  }
}

// ============================================================
// 5. CHECK OTP (BƯỚC 2)
// ============================================================
export async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: normalizeEmail(email), otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: 'Mã OTP không chính xác hoặc đã hết hạn.' });
    res.json({ message: 'OTP hợp lệ.' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
}

// ============================================================
// 6. ĐỔI MẬT KHẨU (BƯỚC 3 - RESET PASSWORD)
// ============================================================
export async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;
    
    // Logic check mật khẩu chỉ nằm ở đây
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const user = await User.findOne({ email: normalizeEmail(email), otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: 'Phiên làm việc hết hạn hoặc OTP sai.' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;       
    user.otpExpires = undefined; 
    
    await user.save();
    res.json({ message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.' });

  } catch (error) {
    res.status(500).json({ error: 'Lỗi server khi đổi mật khẩu.' });
  }
}

// ============================================================
// 7. THÔNG TIN USER
// ============================================================
export async function me(req, res) {
  const user = await User.findById(req.user.id).select('email role createdAt isVerified');
  res.json({ user });
}