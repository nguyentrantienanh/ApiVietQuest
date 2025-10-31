// routes/ai.route.js
import { Router } from 'express';
import dotenv from 'dotenv';

dotenv.config();``
const r = Router();

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

r.post('/chat', async (req, res) => {
  const { message } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const resp = await fetch(
      `${GEMINI_ENDPOINT}?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: message }],
            },
          ],
        }),
      }
    );

    const data = await resp.json();

    // nếu gemini trả lỗi thì vẫn trả 200 để app chat hiển thị
    if (!resp.ok) {
      return res.status(200).json({
        reply:
          data?.error?.message ||
          'Gemini báo lỗi, vui lòng kiểm tra lại key hoặc quota.',
        upstream_error: data,
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Gemini không trả về nội dung.';

    return res.json({ reply });
  } catch (err) {
    console.error('Gemini error:', err);
    return res
      .status(500)
      .json({ error: 'gemini_failed', detail: err.message });
  }
});

export default r;
