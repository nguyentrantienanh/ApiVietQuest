// src/controllers/quiz_attempt.controller.js
import { QuizAttempt } from '../models/QuizAttempt.js';

/**
 * [User] Lấy lịch sử làm bài của CHÍNH MÌNH
 * GET /api/user/quizattempt
 */
export async function getMyAttempts(req, res) {
  try {
    const userId = req.user.id; // Lấy từ auth()
    
    const attempts = await QuizAttempt.find({ userId: userId })
      .populate('quizId', 'name coverImage') // Lấy tên và ảnh của quiz
      .sort('-createdAt');
      
    res.json(attempts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/**
 * [User] Lấy chi tiết 1 lần làm bài
 * GET /api/user/quizattempt/:attemptId
 */
export async function getMyAttemptDetails(req, res) {
  try {
    const userId = req.user.id;
    const { attemptId } = req.params;

    const attempt = await QuizAttempt.findOne({ _id: attemptId, userId: userId })
      .populate('quizId')
      .populate('answers.questionId', 'questionText options'); // Lấy chi tiết câu hỏi
      
    if (!attempt) {
      return res.status(404).json({ error: 'Không tìm thấy hoặc không có quyền xem' });
    }
    
    res.json(attempt);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}