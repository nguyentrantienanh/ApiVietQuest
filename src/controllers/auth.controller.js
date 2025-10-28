import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { v4 as uuidv4 } from 'uuid';
import { validateRegister, pickRegister } from '../validators/auth.validator.js';

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  );
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });

  // normalize email to match storage (registration lowercases email)
  const emailNorm = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: emailNorm });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      provinces: user.provinces,
      provinces_code: user.provinces_code,
      avatar: user.avatar,
      streak: user.streak,
      biography: user.biography,
      creationdate: user.creationdate,
      role: user.role,
    }
  });
}


export async function me(req, res) {
  // cần auth()
  const user = await User.findById(req.user.id).select('email role createdAt');
  res.json({ user });
}

export async function register(req, res) {
  const err = validateRegister(req.body);
  if (err) return res.status(400).json({ error: err });

  const incoming = pickRegister(req.body);
  const { email, password } = incoming;

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: 'Email đã được sử dụng' });

  const hashed = await bcrypt.hash(password, 10);

  const user = new User({
    id: uuidv4(),
    name: incoming.name,
    email: String(email).toLowerCase().trim(),
    password: hashed,
    phone: incoming.phone,
    provinces: incoming.provinces,
    provinces_code: incoming.provinces_code,
    avatar: incoming.avatar,
    biography: incoming.biography || '',
  });

  await user.save();

  const token = signToken(user);
  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      provinces: user.provinces,
      provinces_code: user.provinces_code,
      avatar: user.avatar,
      streak: user.streak,
      biography: user.biography,
      creationdate: user.creationdate,
      role: user.role,
    }
  });
}
