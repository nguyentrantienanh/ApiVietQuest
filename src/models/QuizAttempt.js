
import mongoose, { Schema } from 'mongoose';

const DynamicAnswerSchema = new Schema({
  questionHid: { type: String, required: true }, 
  questionText: { type: String }, 
  questionImage: { type: String }, 
  selectedHidOrCodename: { type: String }, 
  selectedAnswerText: { type: String }, 
  isCorrect: { type: Boolean, required: true }
}, { _id: false });

const QuizAttemptSchema = new mongoose.Schema({
  quizConfigId: {  
    type: Schema.Types.ObjectId,
    ref: 'QuizConfig', 
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
  
  xpGained: { type: Number, default: 0 }, 

  answers: [DynamicAnswerSchema] 
}, { timestamps: true });

export const QuizAttempt = mongoose.model('QuizAttempt', QuizAttemptSchema);