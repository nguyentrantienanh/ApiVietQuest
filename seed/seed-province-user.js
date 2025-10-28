import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDB } from '../src/config/db.js';
import { Province } from '../src/models/Province.js';
import { User } from '../src/models/User.js';

dotenv.config();

async function main() {
  await connectDB(process.env.MONGODB_URI);

  // Seed province
  const provinces = [
    { id: 'vn-01', code: 1, name: 'Hà Nội' },
    { id: 'vn-48', code: 48, name: 'Đà Nẵng' },
    { id: 'vn-79', code: 79, name: 'TP. Hồ Chí Minh' },
  ];
  await Province.deleteMany({});
  await Province.insertMany(provinces);
  console.log('✅ Seeded provinces');

  // Seed one user (role: user)
  const hash = await bcrypt.hash('User@123', 10);
  const user = {
    id: 'us-0001',
    name: 'Nguyễn Trần Tiến Anh',
    phone: '0901234567',
    email: 'user@vietquest.local',
    password: hash,
    provinces: 'Khánh Hòa',
    provinces_code: 56,
    avatar: '',
    streak: 0,
    biography: 'Sinh viên CNTT yêu văn hóa Việt Nam.',
    role: 'user',
  };
  await User.updateOne({ email: user.email }, { $set: user }, { upsert: true });
  console.log('✅ Seeded user:', user.email);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
