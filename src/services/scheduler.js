// src/services/scheduler.js
import cron from 'node-cron';
import { User } from '../models/User.js'; // Import User model

/**
 * Tác vụ này sẽ chạy vào 00:00 sáng thứ Hai hàng tuần
 * (Phút 0, Giờ 0, Mọi ngày, Mọi tháng, Ngày trong tuần = 1 (Thứ Hai))
 */
export function startWeeklyResetScheduler() {
  console.log('✅ Đã khởi động dịch vụ Reset Bảng Xếp Hạng Tuần...');
  
  // Chạy vào 00:00 Thứ Hai
  cron.schedule('0 0 * * 1', async () => {
    console.log('---[CRON JOB START]--- Bắt đầu reset bảng xếp hạng tuần...');
    await resetWeeklyLeaderboard();
    console.log('---[CRON JOB END]--- Reset bảng xếp hạng tuần hoàn tất.');
  }, {
    timezone: "Asia/Ho_Chi_Minh" // Đảm bảo chạy theo giờ Việt Nam
  });
}

/**
 * Logic chính để tìm người thắng và reset điểm
 */
async function resetWeeklyLeaderboard() {
  try {
    // === BƯỚC 1: TÌM NGƯỜI CHIẾN THẮNG TUẦN TRƯỚC ===
    
    // 1. Tìm tất cả user có điểm tuần > 0
    const rankedUsers = await User.find({ weeklyScore: { $gt: 0 } })
      .sort({ weeklyScore: -1 }) // Sắp xếp điểm giảm dần
      .select('_id weeklyScore') // Chỉ lấy ID và điểm
      .lean();

    if (rankedUsers.length === 0) {
      console.log('Không có ai chơi tuần trước. Bỏ qua.');
      return;
    }

    // 2. Lấy điểm số cao nhất
    const winningScore = rankedUsers[0].weeklyScore;

    // 3. Lấy ID của TẤT CẢ user bằng điểm cao nhất (xử lý trường hợp HÒA)
    const winnerIds = rankedUsers
      .filter(user => user.weeklyScore === winningScore)
      .map(user => user._id);

    console.log(`Điểm cao nhất tuần: ${winningScore}. Số người thắng: ${winnerIds.length}`);

    // === BƯỚC 2: RESET ĐIỂM CỦA MỌI NGƯỜI ===

    // 1. Set weeklyScore = 0 VÀ lastWeekRank = 0 cho TẤT CẢ user
    await User.updateMany(
      {},
      { $set: { weeklyScore: 0, lastWeekRank: 0 } }
    );

    // 2. Cập nhật "cúp" cho những người thắng cuộc
    await User.updateMany(
      { _id: { $in: winnerIds } }, // Tìm tất cả ID người thắng
      {
        $set: { lastWeekRank: 1 }, // Set họ là hạng 1 tuần trước
        $inc: { lastWeekWinnerCount: 1 } // Tăng 1 cúp vô địch
      }
    );

  } catch (error) {
    console.error('Lỗi nghiêm trọng khi reset bảng xếp hạng tuần:', error);
  }
}