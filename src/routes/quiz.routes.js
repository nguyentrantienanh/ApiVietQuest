import { Router } from 'express';
import { auth, requireRole } from '../middlewares/auth.js';
import {
  listQuizConfigs,
  startDynamicQuiz,
  submitDynamicQuiz,
  createQuizConfig,
  updateQuizConfig,
  deleteQuizConfig,
  getQuizConfigDetail
} from '../controllers/quiz.controller.js';

const r = Router();

// --- ROUTE CHO USER & PUBLIC ---

r.get('/', listQuizConfigs);


r.get('/start/:configId/:level', auth(), startDynamicQuiz);


r.post('/submit', auth(), submitDynamicQuiz);


// --- ROUTE CHO ADMIN ---

r.post('/', auth(), requireRole('admin'), createQuizConfig);

r.get('/:configId', auth(), getQuizConfigDetail);

r.patch('/:configId', auth(), requireRole('admin'), updateQuizConfig);

r.delete('/:configId', auth(), requireRole('admin'), deleteQuizConfig);

export default r;