import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { connectDB } from '../src/config/db.js';
import { Heritage } from '../src/models/Heritage.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  await connectDB(process.env.MONGODB_URI);
  const raw = fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8');
  const data = JSON.parse(raw);
  await Heritage.insertMany(data, { ordered: false });
  console.log('✅ Seeded!');
  process.exit(0);
}
main().catch(err => { console.error(err); process.exit(1); });
