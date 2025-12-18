
import emailjs from '@emailjs/nodejs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User.js';
import { validateRegister, pickRegister } from '../validators/auth.validator.js';
import 'dotenv/config'; 

// --- CẤU HÌNH EMAILJS ---
emailjs.init({
  publicKey: process.env.EMAILJS_PUBLIC_KEY,
  privateKey: process.env.EMAILJS_PRIVATE_KEY, 
});

// Helper: Chuẩn hoá email
function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

// Helper: Tạo token
function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  );
}

// Helper: Rút URL avatar
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

// --- 🔥 HELPER MỚI: CHECK LIMIT 5 LẦN / 24 GIỜ 🔥 ---
async function checkOtpLimit(user) {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000; // 24 giờ tính bằng mili-giây

  // 1. Nếu chưa có mốc thời gian hoặc đã qua 24h kể từ lần gửi đầu -> Reset chu kỳ mới
  if (!user.otpFirstSentAt || (now - new Date(user.otpFirstSentAt).getTime() > ONE_DAY)) {
    user.otpRequestCount = 0;
    user.otpFirstSentAt = now; // Đặt mốc thời gian mới bắt đầu từ bây giờ
  }

  // 2. Kiểm tra nếu đã đủ 5 lần trong chu kỳ hiện tại
  if (user.otpRequestCount >= 5) {
    // Tính xem còn bao lâu nữa mới được gửi lại
    const resetTime = new Date(user.otpFirstSentAt).getTime() + ONE_DAY;
    const hoursLeft = Math.ceil((resetTime - now) / (60 * 60 * 1000));
    
    throw new Error(`Bạn đã hết lượt gửi OTP trong ngày (5/5). Vui lòng thử lại sau ${hoursLeft} giờ.`);
  }

  // 3. Nếu hợp lệ -> Tăng số lần gửi lên
  user.otpRequestCount += 1;
  // Lưu ý: Việc lưu (save) sẽ được thực hiện ở hàm gọi (register/forgotPassword)
}

// --- GỬI MAIL QUA EMAILJS ---
async function sendEmailOtp(email, otp, type = 'REGISTER') {
  const templateParams = {
    email: email,       
    otp: otp,
    type_message: type === 'REGISTER' ? 'Đăng ký tài khoản' : 'Lấy lại mật khẩu',
    title: 'Mã xác thực' 
  };

  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;

  console.log(`⏳ [EmailJS] Đang gửi OTP tới: ${email} ...`);

  try {
    await emailjs.send(serviceId, templateId, templateParams);
    console.log('✅ [EmailJS] Gửi thành công!');
  } catch (error) {
    console.error('❌ [EmailJS] Lỗi gửi mail:', error);
    // Vẫn in log để test nếu lỡ hết quota EmailJS
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
      
      // 🔥 Kiểm tra giới hạn 5 lần/ngày
      try {
        await checkOtpLimit(existingUser);
      } catch (err) {
        return res.status(429).json({ error: err.message });
      }

      const hashed = await bcrypt.hash(incoming.password, 10);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      existingUser.name = incoming.name;
      existingUser.password = hashed;
      existingUser.otp = otp;
      existingUser.otpExpires = Date.now() + 10 * 60 * 1000;
      
      await existingUser.save();
      await sendEmailOtp(existingUser.email, otp, 'REGISTER');
      
      return res.status(200).json({ 
        message: `Đã gửi lại OTP. (Lần thứ ${existingUser.otpRequestCount}/5 trong ngày)`,
        needVerify: true,
        email: emailNorm
      });
    }

    // USER MỚI
    const hashed = await bcrypt.hash(incoming.password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    let avatarUrl = undefined;
    if (req.file) avatarUrl = fileToPublicUrl(req.file);

    const user = new User({
      id: uuidv4(),
      name: incoming.name,
      email: emailNorm,
      password: hashed,
      otp: otp,
      otpExpires: Date.now() + 10 * 60 * 1000,
      isVerified: false,
      
      // Khởi tạo bộ đếm
      otpRequestCount: 1,
      otpFirstSentAt: Date.now(),
      
      avatar: avatarUrl || '',
      phone: incoming.phone,
      provinces: incoming.provinces,
      provinces_code: incoming.provinces_code,
      biography: incoming.biography
    });

    await user.save();
    await sendEmailOtp(user.email, otp, 'REGISTER');

    res.status(201).json({
      message: 'Đăng ký thành công. Đã gửi OTP.',
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
    
    // ⚠️ LƯU Ý: Không reset otpRequestCount về 0 ở đây nữa
    // Để đảm bảo giới hạn cứng 5 lần/ngày.
    
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
// 4. QUÊN MẬT KHẨU
// ============================================================
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Vui lòng nhập email.' });

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(404).json({ error: 'Email không tồn tại.' });

    // 🔥 Kiểm tra giới hạn 5 lần/ngày
    try {
      await checkOtpLimit(user);
    } catch (err) {
      return res.status(429).json({ error: err.message });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000;
    
    await user.save(); // Lưu otpRequestCount mới tăng

    await sendEmailOtp(user.email, otp, 'FORGOT_PASS');

    res.json({ message: `Mã OTP đã gửi. (Lần thứ ${user.otpRequestCount}/5 trong ngày)` });
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
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const user = await User.findOne({ email: normalizeEmail(email), otp, otpExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ error: 'Phiên làm việc hết hạn hoặc OTP sai.' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;       
    user.otpExpires = undefined; 
    
    // ⚠️ Cũng KHÔNG reset otpRequestCount ở đây.
    
    await user.save();
    res.json({ message: 'Đặt lại mật khẩu thành công!' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server.' });
  }
}
// ============================================================
// 7. GỬI LẠI OTP (RESEND)
// ============================================================
export async function resendOtp(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Vui lòng cung cấp email.' });

    const emailNorm = normalizeEmail(email);
    const user = await User.findOne({ email: emailNorm });

    if (!user) return res.status(404).json({ error: 'Email không tồn tại trong hệ thống.' });

    // Nếu tài khoản đã kích hoạt rồi thì không cho gửi lại mã kích hoạt nữa
    if (user.isVerified) {
      return res.status(400).json({ error: 'Tài khoản này đã được kích hoạt rồi. Vui lòng đăng nhập.' });
    }

    // 🔥 CHECK LIMIT 5 LẦN/NGÀY (Dùng lại hàm anh đã viết)
    try {
      await checkOtpLimit(user);
    } catch (err) {
      return res.status(429).json({ error: err.message });
    }

    // Tạo OTP mới
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 phút

    // Save user (đã bao gồm việc tăng otpRequestCount trong checkOtpLimit nhưng chưa save)
    await user.save();

    // Gửi mail
    await sendEmailOtp(user.email, otp, 'REGISTER'); // Dùng type REGISTER hoặc tạo type RESEND tuỳ ý

    res.json({ 
      message: `Đã gửi lại mã mới. (Lần thứ ${user.otpRequestCount}/5 trong ngày)` 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server.' });
  }
}
export async function me(req, res) {
    const user = await User.findById(req.user.id).select('email role createdAt isVerified');
    res.json({ user });
}