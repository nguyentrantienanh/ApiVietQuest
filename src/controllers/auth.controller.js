// src/controllers/auth.controller.js
import emailjs from '@emailjs/nodejs'; // Import thư viện mới
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User.js';
import { validateRegister, pickRegister } from '../validators/auth.validator.js';
import 'dotenv/config'; 

// --- CẤU HÌNH EMAILJS ---
// ⚠️ QUAN TRỌNG: Private Key chỉ chạy được ở Backend Node.js
emailjs.init({
  publicKey: process.env.EMAILJS_PUBLIC_KEY,
  privateKey: process.env.EMAILJS_PRIVATE_KEY, 
});

/** Helper: Chuẩn hoá email */
function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

/** Helper: Tạo token */
function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  );
}

/** * Helper: Gửi OTP qua EmailJS (Server Web Port 443 - Không bị chặn)
 */
async function sendEmailOtp(email, otp, type = 'REGISTER') {
  // Chuẩn bị tham số để gửi sang Template HTML đã tạo ở Phần 1
  const templateParams = {
    email: email,                  // Biến {{to_email}}
    otp: otp,                         // Biến {{otp}}
    type_message: type === 'REGISTER' ? 'Đăng ký tài khoản mới' : 'Đặt lại mật khẩu' // Biến {{type_message}}
  };

  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;

  console.log(`⏳ [EmailJS] Đang gửi OTP tới: ${email}...`);

  try {
    // Gọi API của EmailJS
    await emailjs.send(serviceId, templateId, templateParams);
    console.log('✅ [EmailJS] Gửi thành công!');
  } catch (error) {
    console.error('❌ [EmailJS] Lỗi gửi mail:', error);
    // In OTP ra log để backup trường hợp xấu nhất (hết quota free)
    console.log(`🔑 [BACKUP LOG OTP]: ${otp}`);
  }
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
      
      // Ghi đè user cũ chưa kích hoạt
      const hashed = await bcrypt.hash(incoming.password, 10);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      existingUser.name = incoming.name;
      existingUser.password = hashed;
      existingUser.otp = otp;
      existingUser.otpExpires = Date.now() + 10 * 60 * 1000;
      
      await existingUser.save();
      await sendEmailOtp(existingUser.email, otp, 'REGISTER');
      
      return res.status(200).json({ 
        message: 'Tài khoản chưa kích hoạt. Đã gửi lại OTP.',
        needVerify: true,
        email: emailNorm
      });
    }

    // Tạo user mới
    const hashed = await bcrypt.hash(incoming.password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const user = new User({
      id: uuidv4(),
      name: incoming.name,
      email: emailNorm,
      password: hashed,
      otp: otp,
      otpExpires: Date.now() + 10 * 60 * 1000,
      isVerified: false
      // ... (Các trường avatar, provinces... giữ nguyên như cũ)
    });

    await user.save();
    
    // Gửi mail
    await sendEmailOtp(user.email, otp, 'REGISTER');

    res.status(201).json({
      message: 'Đăng ký thành công. Vui lòng kiểm tra email.',
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
    const user = await User.findOne({ 
      email: normalizeEmail(email),
      otp: otp,
      otpExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: 'Mã OTP sai hoặc hết hạn.' });

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = signToken(user);
    res.json({ message: 'Kích hoạt thành công!', token, user });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
}

// ============================================================
// 3. LOGIN
// ============================================================
export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: normalizeEmail(email) });
  
  if (!user) return res.status(401).json({ error: 'Sai thông tin đăng nhập' });
  if (!user.isVerified) return res.status(403).json({ error: 'Chưa kích hoạt tài khoản.', needVerify: true });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Sai thông tin đăng nhập' });

  const token = signToken(user);
  res.json({ token, user });
}

// ============================================================
// 4. QUÊN MẬT KHẨU (Gửi OTP)
// ============================================================
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Vui lòng nhập email.' });

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(404).json({ error: 'Email không tồn tại.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000;
    await user.save();

    await sendEmailOtp(user.email, otp, 'FORGOT_PASS');

    res.json({ message: 'Mã OTP đã được gửi tới email của bạn.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server.' });
  }
}

// ============================================================
// 5. CHECK OTP
// ============================================================
export async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: normalizeEmail(email), otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: 'Mã OTP sai hoặc hết hạn.' });
    res.json({ message: 'OTP hợp lệ.' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
}

// ============================================================
// 6. ĐỔI MẬT KHẨU
// ============================================================
export async function resetPassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải từ 6 ký tự.' });
    }

    const user = await User.findOne({ email: normalizeEmail(email), otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: 'OTP sai hoặc hết hạn.' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;       
    user.otpExpires = undefined; 
    
    await user.save();
    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
}

export async function me(req, res) {
    const user = await User.findById(req.user.id).select('email role createdAt isVerified');
    res.json({ user });
}