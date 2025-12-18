
import { Router } from 'express';
import { 
  login, 
  me, 
  register, 
  verifyAccount,    
  forgotPassword,   
  verifyOtp,        
  resetPassword,   
  resendOtp
} from '../controllers/auth.controller.js';
import { auth } from '../middlewares/auth.js';
import { uploadUserAvatar } from '../middlewares/upload.js';

const r = Router();

// 1. Đăng nhập
r.post('/login', login);

// 2. Đăng ký (Có upload ảnh)
r.post('/register', uploadUserAvatar, register);

// 3. Kích hoạt tài khoản
r.post('/verify-account', verifyAccount);

// 4. Lấy thông tin bản thân
r.get('/me', auth(true), me);

// --- CỤM CHỨC NĂNG QUÊN MẬT KHẨU ---

// Bước 1: Chỉ gửi email -> Nhận OTP
r.post('/forgot-password', forgotPassword);

// Bước 2: Gửi email + OTP -> Check đúng sai
r.post('/verify-otp', verifyOtp);

// Bước 3: Gửi email + OTP + Pass mới -> Đổi mật khẩu
r.post('/reset-password', resetPassword);
// Bước 4: Gửi lại OTP
r.post('/resend-otp', resendOtp);

export default r;