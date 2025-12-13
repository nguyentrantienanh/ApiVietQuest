import nodemailer from 'nodemailer';

// 👇 DÁN TRỰC TIẾP THÔNG TIN VÀO ĐÂY ĐỂ TEST 👇
const USER = 'tienanh041225@gmail.com';
const PASS = 'tyqkdqvtuqsgjdyo';

async function main() {
  // Cấu hình Gmail "Bất tử" trên Render
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: USER, pass: PASS },
    
    // 👇 3 DÒNG NÀY GIÚP KHÔNG BỊ TREO (TIMEOUT) 👇
    family: 4,               // Ép dùng IPv4 (Fix lỗi treo 100%)
    logger: true,            // Xem log
    tls: { 
      rejectUnauthorized: false // Bỏ qua lỗi SSL
    }
  });

  try {
    console.log("⏳ Đang thử kết nối tới Gmail...");
    await transporter.verify();
    console.log("✅ THÀNH CÔNG! Gmail đã kết nối được.");
  } catch (error) {
    console.log("❌ THẤT BẠI! Lỗi chi tiết:");
    console.error(error);
  }
}

main();