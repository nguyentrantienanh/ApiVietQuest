// routes/ai.route.js
import { Router } from 'express';
import dotenv from 'dotenv';

dotenv.config();
const r = Router();

const GEMINI_ENDPOINT =
  process.env.GEMINI_ENDPOINT ||
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  
  

const GEMINI_KEY = process.env.GEMINI_API_KEY;

// ---- Helpers ---------------------------------------------------------

function humanizeError(err, extra = {}) {
  const msg = String(err?.message || err || '');
  const code = err?.status || err?.code || extra.status;

  // Quota / rate-limit
  if (code === 429 || /quota|rate[-\s]?limit/i.test(msg)) {
    const retry = Number(extra.retryAfterSec);
    const tail = retry && !Number.isNaN(retry) ? ` (~${retry}s)` : '';
    return { reply: `Hôm nay máy chủ AI đang quá tải 😵‍💫. Bạn thử lại sau một chút${tail} nhé!` };
  }

  // Key/Quyền truy cập
  if (code === 401 || code === 403 || /api ?key|unauthori[sz]ed|forbidden/i.test(msg)) {
    return { reply: 'AI tạm thời không truy cập được dịch vụ. Admin kiểm tra giúp khóa API hoặc quyền truy cập nhé.' };
  }

  // Timeout / mạng
  if (code === 'ETIMEDOUT' || /timeout|network|fetch failed/i.test(msg)) {
    return { reply: 'Kết nối tới AI bị chậm hoặc mất mạng. Bạn thử gửi lại sau ít giây nha.' };
  }

  // Mặc định
  return { reply: 'Xin lỗi, AI gặp sự cố nhỏ nên chưa trả lời được. Bạn thử lại giúp mình nhé!' };
}

function extractGeminiText(json) {
  return (
    json?.candidates?.[0]?.content?.parts?.[0]?.text ||
    json?.candidates?.[0]?.content?.parts?.map(p => p?.text).filter(Boolean).join('\n') ||
    ''
  );
}

// ---- Route -----------------------------------------------------------

r.post('/chat', async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }
  if (!GEMINI_KEY) {
    // Không lộ cấu hình, vẫn trả reply thân thiện
    return res.status(200).json({
      reply: 'Máy chủ chưa cấu hình khóa AI. Admin bổ sung GEMINI_API_KEY giúp nhé.',
    });
  }

  // Timeout để tránh treo request
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s

  try {
    const resp = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }]}],
      }),
    });
    clearTimeout(timeout);

    // Luôn cố đọc JSON
    let data = {};
    try { data = await resp.json(); } catch { data = {}; }

    if (!resp.ok) {
      // Map lỗi → reply thân thiện, không trả upstream_error
      const retryAfter =
        resp.headers.get('retry-after') ||
        data?.error?.details?.find?.(d => d?.retryDelay)?.retryDelay; // đôi khi ở details
      const retryAfterSec =
        retryAfter && /^\d+(\.\d+)?$/.test(String(retryAfter))
          ? Number(retryAfter)
          : undefined;

      const friendly = humanizeError(
        { message: data?.error?.message, status: resp.status },
        { status: resp.status, retryAfterSec }
      );
      return res.status(200).json(friendly);
    }

    const reply = (extractGeminiText(data) || '...').trim();
    return res.status(200).json({ reply: reply || 'Xin lỗi, mình chưa có nội dung trả lời.' });
  } catch (err) {
    clearTimeout(timeout);
    // Đừng trả chi tiết lỗi thô
    const friendly = humanizeError(err);
    return res.status(200).json(friendly);
  }
});

export default r;
