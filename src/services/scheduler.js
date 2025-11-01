// src/services/scheduler.js
import cron from 'node-cron';
import { User } from '../models/User.js';

/**
 * Tác vụ này sẽ chạy vào 00:00 sáng thứ Hai hàng tuần
 */
export function startWeeklyResetScheduler() {
  console.log('✅ Đã khởi động dịch vụ Reset Bảng Xếp Hạng Tuần...');
  
  cron.schedule('0 0 * * 1', async () => {
    console.log('---[CRON JOB START]--- Bắt đầu reset bảng xếp hạng tuần...');
    await resetWeeklyLeaderboard();
    console.log('---[CRON JOB END]--- Reset bảng xếp hạng tuần hoàn tất.');
  }, {
    timezone: "Asia/Ho_Chi_Minh" // Đảm bảo chạy theo giờ Việt Nam
  });
}

/**
 * Logic chính: SAO LƯU điểm, RESET điểm, GÁN hạng 1 toàn cầu
 */
export async function resetWeeklyLeaderboard() {
  try {
    // === BƯỚC 1: SAO LƯU ĐIỂM VÀ RESET VỀ 0 ===
    // Dùng aggregation pipeline để copy "weeklyScore" -> "lastWeeklyScore"
    // VÀ set "weeklyScore" = 0, "lastWeekRank" = 0 cho tất cả
    console.log('Bắt đầu sao lưu điểm tuần trước và reset...');
    await User.updateMany(
      { weeklyScore: { $gt: 0 } }, // Chỉ cập nhật ai có điểm
      [
        { 
          $set: { 
            lastWeeklyScore: "$weeklyScore", // Copy
            weeklyScore: 0,                  // Reset
            lastWeekRank: 0                  // Reset
          } 
        }
      ]
    );
    // Những người không chơi (score=0) cũng cần reset
    await User.updateMany(
      { weeklyScore: { $lte: 0 } },
      { $set: { lastWeeklyScore: 0, lastWeekRank: 0 } }
    );
    
    console.log('Đã reset điểm. Bắt đầu tìm global winner...');

    // === BƯỚC 2: TÌM VÀ GÁN GLOBAL WINNER (Hạng 1 Việt Nam) ===
    // (Dựa trên 'lastWeeklyScore' chúng ta vừa sao lưu)
    const rankedUsers = await User.find({ lastWeeklyScore: { $gt: 0 } })
      .sort({ lastWeeklyScore: -1 })
      .select('_id lastWeeklyScore')
      .lean();

    if (rankedUsers.length === 0) {
      console.log('Không có ai chơi tuần trước.');
      return;
    }

    const winningScore = rankedUsers[0].lastWeeklyScore;
    const winnerIds = rankedUsers
      .filter(user => user.lastWeeklyScore === winningScore)
      .map(user => user._id);

    console.log(`Global Winner Score: ${winningScore}. IDs: ${winnerIds.join(', ')}`);

    // Cập nhật "cúp" (Global Rank 1)
    await User.updateMany(
      { _id: { $in: winnerIds } },
      {
        $set: { lastWeekRank: 1 }, // Set hạng 1 Global
        $inc: { lastWeekWinnerCount: 1 } 
      }
    );

  } catch (error) {
    console.error('Lỗi nghiêm trọng khi reset bảng xếp hạng tuần:', error);
  }
}