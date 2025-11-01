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
    creationdate: { type: Date, default: Date.now },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    experience: { type: Number, default: 0, index: true },
    weeklyScore: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', UserSchema);
