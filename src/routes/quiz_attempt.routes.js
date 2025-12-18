
import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import {
  getMyAttempts,
  getMyAttemptDetails
} from '../controllers/quiz_attempt.controller.js';

const r = Router();

// *** BẢO VỆ TẤT CẢ CÁC ROUTE TRONG FILE NÀY ***
r.use(auth());

r.get('/', getMyAttempts);

r.get('/:attemptId', getMyAttemptDetails);

export default r;