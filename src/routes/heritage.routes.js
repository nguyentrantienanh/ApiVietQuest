import { auth, requireRole } from '../middlewares/auth.js';
import { Router } from 'express';
import { uploadHeritageImages } from '../middlewares/upload.js';
import {
  createHeritage, listHeritages, getHeritage, updateHeritage, deleteHeritage, enums
} from '../controllers/heritage.controller.js';
 
 
const r = Router();

r.get('/enums', enums);

r.get('/', listHeritages);

r.get('/:hid', getHeritage);

/**
 * (Admin) Tạo di sản: use POST /heritages/add (see below)
 */

r.post('/add' , auth (), requireRole('admin'), uploadHeritageImages, createHeritage);

/**
 * (Admin) Cập nhật di sản: use PATCH /heritages/update/:hid (see below)
 */

r.patch('/update/:hid' , auth (), requireRole('admin'), uploadHeritageImages, updateHeritage);

/**
 * (Admin) Xoá di sản: use DELETE /heritages/delete/:hid (see below)
 */

r.delete('/delete/:hid' , auth (), requireRole('admin'), deleteHeritage);

export default r;
