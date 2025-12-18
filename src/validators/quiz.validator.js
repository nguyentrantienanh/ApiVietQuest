export function validateCreateQuiz(body) {
  const { name, type, level } = body;
  if (!name || !type || !level) {
    return 'Thiếu trường bắt buộc: name, type, level';
  }
  if (!['easy', 'medium', 'hard'].includes(level)) {
    return 'level phải là: easy, medium, hoặc hard';
  }
  return null;
}

export function validateCreateQuestion(body) {
  const { quizId, questionText, options, correctAnswerIndex } = body;
  if (!quizId || !questionText || !options || correctAnswerIndex === undefined) {
    return 'Thiếu trường: quizId, questionText, options, correctAnswerIndex';
  }
  if (!Array.isArray(options) || options.length < 2) {
    return 'options phải là một mảng có ít nhất 2 lựa chọn';
  }
  if (options.some(opt => !opt || !opt.text)) {
    return 'Mỗi option trong mảng phải có dạng { "text": "..." }';
  }
  if (correctAnswerIndex < 0 || correctAnswerIndex >= options.length) {
    return 'correctAnswerIndex không hợp lệ (nằm ngoài mảng options)';
  }
  return null;
}