// Simple validators for auth endpoints
export function validateRegister(body) {
  const required = ['name', 'email', 'password'];
  const missing = required.filter(k => body[k] === undefined || body[k] === null || body[k] === '');
  if (missing.length) return `Thiếu trường bắt buộc: ${missing.join(', ')}`;

  if (typeof body.password !== 'string' || body.password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự';

  // basic email check
  const email = String(body.email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Email không hợp lệ';

  return null;
}

export function pickRegister(body) {
  const allowed = ['name','email','password','phone','provinces','provinces_code','avatar','biography'];
  const out = {};
  for (const k of allowed) if (k in body) out[k] = body[k];
  return out;
}
