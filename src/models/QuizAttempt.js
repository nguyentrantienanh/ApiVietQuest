// src/models/QuizAttempt.js (Cập nhật)
import mongoose, { Schema } from 'mongoose';

const DynamicAnswerSchema = new Schema({
  questionHid: { type: String, required: true }, // HID của di sản (câu hỏi/đáp án đúng)
  selectedHidOrCodename: { type: String, required: true }, // Giá trị user chọn (HID hoặc province codename)
  isCorrect: { type: Boolean, required: true }
}, { _id: false });

const QuizAttemptSchema = new mongoose.Schema({
  quizConfigId: { // Đổi tên từ quizId
    type: Schema.Types.ObjectId,
    ref: 'QuizConfig', // Trỏ đến model mới
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  level: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  totalQuestions: { type: Number, required: true },
  correctCount: { type: Number, required: true, default: 0 },
  percent: { type: Number, required: true, default: 0, min: 0, max: 100 },
  startDate: { type: Date, default: Date.now },
  finishedAt: { type: Date },
  answers: [DynamicAnswerSchema] // Dùng schema mới
}, { timestamps: true });

export const QuizAttempt = mongoose.model('QuizAttempt', QuizAttemptSchema);