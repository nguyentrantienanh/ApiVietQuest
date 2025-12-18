import { validateRegister } from './auth.validator.js';

export const validateAdminCreate = validateRegister;

/**
 * Chọn các trường User TỰ cập nhật (KHÔNG được đổi role)
 */
export function pickUserUpdate(body) {
  const allowed = [
    'name',
    'password',
    'phone',
    'provinces',
    'provinces_code',
    'avatar',
    'biography',
  ];
  const out = {};
  for (const k of allowed) {
    if (k in body) out[k] = body[k];
  }
  return out;
}

/**
 * Chọn các trường Admin được phép cập nhật (CÓ thể đổi role)
 */
export function pickAdminUpdate(body) {
  const allowed = [
    'name',
    'email',
    'password',
    'phone',
    'provinces',
    'provinces_code',
    'avatar',
    'biography',
    'role', // Admin có thể đổi role
    'streak',
  ];
  const out = {};
  for (const k of allowed) {
    if (k in body) out[k] = body[k];
  }
  return out;
}