// src/controllers/quiz_attempt.controller.js
import { QuizAttempt } from '../models/QuizAttempt.js';
// Optional: Import QuizConfig if needed for more detailed population later
// import { QuizConfig } from '../models/QuizConfig.js';

/**
 * [User] Lấy lịch sử làm bài của CHÍNH MÌNH
 * GET /api/user/quizattempt
 */
export async function getMyAttempts(req, res) {
  try {
    const userId = req.user.id; // Get user ID from auth token

    const attempts = await QuizAttempt.find({ userId: userId })
      // CORRECTED: Populate the correct field 'quizConfigId'
      // Select fields from QuizConfig to return (e.g., themeType, description)
      .populate('quizConfigId', 'themeType description')
      .sort('-createdAt'); // Sort by newest first

    res.json(attempts);
  } catch (e) {
    console.error("Error in getMyAttempts:", e); // Add error logging
    res.status(500).json({ error: e.message });
  }
}

/**
 * [User] Lấy chi tiết 1 lần làm bài
 * GET /api/user/quizattempt/:attemptId
 */
export async function getMyAttemptDetails(req, res) {
  try {
    const userId = req.user.id; // Get user ID from auth token
    const { attemptId } = req.params; // Get attempt ID from URL

    const attempt = await QuizAttempt.findOne({ _id: attemptId, userId: userId })
      // CORRECTED: Populate the correct field 'quizConfigId'
      .populate('quizConfigId'); // Populate the full referenced QuizConfig document
      // REMOVED: Cannot populate 'answers.questionId' anymore
      // .populate('answers.questionId', 'questionText options');

    // Check if attempt exists and belongs to the user
    if (!attempt) {
      return res.status(404).json({ error: 'Không tìm thấy hoặc không có quyền xem' });
    }

    // Return the detailed attempt information
    res.json(attempt);

  } catch (e) {
    console.error("Error in getMyAttemptDetails:", e); // Add error logging
    // Handle invalid MongoDB ObjectId format for attemptId
    if (e.kind === 'ObjectId') {
        return res.status(400).json({ error: 'Invalid attempt ID format' });
     }
    res.status(500).json({ error: e.message });
  }
}