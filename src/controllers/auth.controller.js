// src/controllers/auth.controller.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer'; // Import nodemailer
import { User } from '../models/User.js';
import { validateRegister, pickRegister } from '../validators/auth.validator.js';
import 'dotenv/config'; 

// --- Cấu hình gửi mail ---
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS  
  }
});

// Debug kết nối mail khi khởi động
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

/**
 * Helper: Gửi email OTP (Dùng chung cho Register & Forgot Pass)
 */
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
      <p style="font-size: 12px; color: #666;">Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
      <p style="font-size: 12px; color: #666;"> email hỗ trợ vui lòng không trả lời.</p>
      <p style="font-size: 12px; color: #666;"> VietQuest Support</p>
    </div>
  `;

  const mailOptions = {
    from: '"VietQuest Support" <no-reply@vietquest.com>',
    to: email,
    subject: subject,
    html: html
  };

  await transporter.sendMail(mailOptions);
}

// ============================================================
// 1. ĐĂNG KÝ (REGISTER) - YÊU CẦU XÁC THỰC
// ============================================================

export async function register(req, res) {
  try {
    const preErr = validateRegister(req.body);
    if (preErr) return res.status(400).json({ error: preErr });

    const incoming = pickRegister(req.body);
    const emailNorm = normalizeEmail(incoming.email);

    // Check trùng email
    const existingUser = await User.findOne({ email: emailNorm });
    
    if (existingUser) {
      // Nếu email đã tồn tại và ĐÃ xác thực -> Báo lỗi
      if (existingUser.isVerified) {
        return res.status(409).json({ error: 'Email đã được sử dụng.' });
      }
      
      // Nếu email tồn tại nhưng CHƯA xác thực -> Cho phép gửi lại OTP (Ghi đè user cũ)
      const hashed = await bcrypt.hash(incoming.password, 10);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      existingUser.name = incoming.name;
      existingUser.password = hashed;
      existingUser.phone = incoming.phone;
      existingUser.otp = otp;
      existingUser.otpExpires = Date.now() + 10 * 60 * 1000; // 10 phút
      
      await existingUser.save();
      
      await sendEmailOtp(existingUser.email, otp, 'REGISTER');
      
      return res.status(200).json({ 
        message: 'Tài khoản chưa kích hoạt. Mã xác thực mới đã được gửi lại vào email.',
        needVerify: true,
        email: emailNorm
      });
    }

    // --- Tạo User Mới ---
    const hashed = await bcrypt.hash(incoming.password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Xử lý avatar
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
      
      isVerified: false, // Mặc định chưa kích hoạt
      otp: otp,
      otpExpires: Date.now() + 10 * 60 * 1000 // 10 phút
    });

    await user.save();

    // Gửi Email OTP
    await sendEmailOtp(user.email, otp, 'REGISTER');

    // Trả về thông báo chuyển sang màn hình nhập OTP (Không trả token)
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
// 2. KÍCH HOẠT TÀI KHOẢN (VERIFY ACCOUNT)
// ============================================================

export async function verifyAccount(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Thiếu thông tin xác thực' });

    const emailNorm = normalizeEmail(email);

    const user = await User.findOne({ 
      email: emailNorm,
      otp: otp,
      otpExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Mã OTP sai hoặc đã hết hạn.' });
    }

    // Kích hoạt tài khoản
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Đăng nhập luôn cho user (trả về Token)
    const token = signToken(user);
    
    res.json({
      message: 'Kích hoạt tài khoản thành công!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        isVerified: true
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
}



// ============================================================
// 3. ĐĂNG NHẬP (LOGIN) - CÓ CHECK VERIFIED
// ============================================================

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });

  const emailNorm = normalizeEmail(email);
  const user = await User.findOne({ email: emailNorm });
  
  if (!user) return res.status(401).json({ error: 'Thông tin đăng nhập không đúng' });

  // === CHECK KÍCH HOẠT ===
  if (!user.isVerified) {
    return res.status(403).json({ 
      error: 'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email.',
      needVerify: true, 
      email: user.email
    });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Thông tin đăng nhập không đúng' });

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

// ============================================================
// 4. QUÊN MẬT KHẨU (FORGOT PASSWORD)
// ============================================================

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Vui lòng nhập email' });

    const emailNorm = normalizeEmail(email);
    const user = await User.findOne({ email: emailNorm });
    
    if (!user) {
      return res.status(404).json({ error: 'Email chưa được đăng ký.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.otp = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000; // 5 phút
    await user.save();

    await sendEmailOtp(user.email, otp, 'FORGOT_PASS');

    res.json({ message: 'Mã xác thực đã được gửi tới email của bạn.' });

  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ error: 'Lỗi server khi gửi email.' });
  }
}

export async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    const emailNorm = normalizeEmail(email);

    const user = await User.findOne({ 
      email: emailNorm,
      otp: otp,
      otpExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Mã OTP không chính xác hoặc đã hết hạn.' });
    }

    res.json({ message: 'OTP hợp lệ.' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
}

export async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const emailNorm = normalizeEmail(email);

    const user = await User.findOne({ 
      email: emailNorm,
      otp: otp,
      otpExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Phiên làm việc hết hạn hoặc OTP sai.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    
    user.password = hashed;
    user.otp = undefined;       
    user.otpExpires = undefined; 
    
    await user.save();

    res.json({ message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server khi đổi mật khẩu.' });
  }
}

// ============================================================
// 5. THÔNG TIN USER (ME)
// ============================================================

export async function me(req, res) {
  const user = await User.findById(req.user.id).select('email role createdAt isVerified');
  res.json({ user });
}