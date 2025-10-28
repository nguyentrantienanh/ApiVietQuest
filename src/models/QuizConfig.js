// src/models/QuizConfig.js (Updated)
import mongoose, { Schema } from 'mongoose';

export const QuizThemeTypes = [
  'GUESS_NAME_FROM_IMAGE',
  'GUESS_PROVINCE_FROM_IMAGE',
  'GUESS_PROVINCE_FROM_NAME',
  'GUESS_NAME_FROM_SUMMARY'
];

const QuizConfigSchema = new mongoose.Schema({
  // // REMOVED: Tên chủ đề (Admin đặt)
  // name: { type: String, required: true, trim: true, unique: true },

  // Mô tả (Admin nhập, tùy chọn)
  description: { type: String, trim: true },

  // Loại chủ đề (Admin chọn từ dropdown) - Now the main identifier
  themeType: {
    type: String,
    enum: QuizThemeTypes,
    required: true,
    // Note: Consider if you want this to be unique.
    // If unique: true, you can only have ONE config per theme type.
    // If false (default), you could have multiple configs with the same theme
    // (e.g., maybe different descriptions or slightly different settings later).
    // Let's keep it non-unique for flexibility for now.
    // unique: true,
    index: true // Add index for faster lookups
  },

  // Số lượng câu hỏi cho từng cấp độ
  levelSettings: {
    easy: { type: Number, required: true, default: 5 },
    medium: { type: Number, required: true, default: 10 },
    hard: { type: Number, required: true, default: 15 }
  }

}, { timestamps: true });

export const QuizConfig = mongoose.model('QuizConfig', QuizConfigSchema);