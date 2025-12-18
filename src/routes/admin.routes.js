
import { Router } from 'express';
import { auth, requireRole } from '../middlewares/auth.js';
import {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminGetUserById
} from '../controllers/admin.controller.js';
import { adminResetWeekly } from '../controllers/admin.controller.js';
import { uploadUserAvatar } from '../middlewares/upload.js';

const r = Router();

// 🔒 Tất cả route dưới đây yêu cầu đăng nhập admin
r.use(auth(), requireRole('admin'));

 
r.get('/', adminListUsers);

 
r.get('/:_id', adminGetUserById);

 
r.post('/add', uploadUserAvatar, adminCreateUser);


r.patch('/update/:_id', uploadUserAvatar, adminUpdateUser);


r.delete('/delete/:_id', adminDeleteUser);

r.post('/reset-weekly', adminResetWeekly);

export default r;
