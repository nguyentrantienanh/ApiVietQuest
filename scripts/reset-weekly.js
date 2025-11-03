#!/usr/bin/env node
// scripts/reset-weekly.js
// One-off script to run weekly reset manually for testing.
import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../src/config/db.js';
import { resetWeeklyLeaderboard } from '../src/services/scheduler.js';

(async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      console.error('Please set MONGODB_URI in your environment or .env file');
      process.exit(1);
    }

    await connectDB(MONGODB_URI);
    console.log('Connected to DB — running resetWeeklyLeaderboard()...');
    await resetWeeklyLeaderboard();
    console.log('Manual weekly reset completed.');
    process.exit(0);
  } catch (err) {
    console.error('Error running manual weekly reset:', err);
    process.exit(1);
  }
})();
