import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';

dotenv.config();

async function main() {
  await connectDB(process.env.MONGODB_URI);

  const email = 'admin@vietquest.local';
  const password = 'Admin@123'; // đổi sau khi đăng nhập
  const hash = await bcrypt.hash(password, 10);

  await User.updateOne(
    { email },
    { $set: { email, password: hash, role: 'admin' } },
    { upsert: true }
  );

  console.log('✅ Seeded admin:', email, 'pass:', password);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
