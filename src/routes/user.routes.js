
import { Router } from 'express';
import { auth } from '../middlewares/auth.js';
import {
  getMe,
  updateMe,
  deleteMe,
  getLastWeekWinners
} from '../controllers/user.controller.js';
import { uploadUserAvatar } from '../middlewares/upload.js';

const r = Router();

 r.get('/leaderboard/lastweek-winners', getLastWeekWinners);
// 🔒 Tất cả route ở file này yêu cầu đăng nhập
r.use(auth());

r.get('/me', getMe);

r.patch('/update', uploadUserAvatar, updateMe);

r.delete('/delete', deleteMe);
 
export default r;
