import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    // ⚙️ Dùng string thay vì ref
    provinces: { type: String },         // ví dụ: "Khánh Hòa"
    provinces_code: { type: String },    // ví dụ: "56" hoặc "tinh_khanh_hoa"
lastQuizCompletionDate: { type: Date },  // Ngày hoàn thành quiz gần nhất
    avatar: { type: String },
    streak: { type: Number, default: 0 },
    biography: { type: String, default: '' },
     
lastWeeklyScore: { type: Number, default: 0, index: true }, // Điểm tuần trước
    creationdate: { type: Date, default: Date.now }, // Ngày tạo tài khoản
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    experience: { type: Number, default: 0, index: true },
    weeklyScore: { type: Number, default: 0, index: true },
    // === [MỚI] === Trạng thái xác thực email
    isVerified: { type: Boolean, default: false },
    // Đếm số lần đã gửi trong ngày
  otpRequestCount: { type: Number, default: 0 }, 
  
  // Thời điểm gửi OTP đầu tiên trong chu kỳ 24h
  otpFirstSentAt: { type: Date, default: null },
    // === [MỚI] === Thêm field cho OTP
    otp: { type: String }, 
    otpExpires: { type: Date }
  },
   
  { timestamps: true }
);

export const User = mongoose.model('User', UserSchema);
