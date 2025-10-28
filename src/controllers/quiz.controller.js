// src/controllers/quiz.controller.js
import { QuizConfig, QuizThemeTypes } from '../models/QuizConfig.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { Heritage } from '../models/Heritage.js';
import { User } from '../models/User.js'; // Đảm bảo đã import User
import axios from 'axios';

// --- Helper Functions ---
function shuffleArray(array) {
  // Fisher-Yates shuffle algorithm
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Lấy danh sách Tỉnh/Thành từ API (có cache đơn giản)
let provincesCache = null;
async function getProvinces() {
  if (provincesCache) return provincesCache;
  try {
    const response = await axios.get('https://provinces.open-api.vn/api/p/');
    // Chỉ lấy name và codename
    provincesCache = response.data.map(p => ({ name: p.name, codename: p.codename }));
    return provincesCache;
  } catch (error) {
    console.error("Lỗi khi lấy danh sách tỉnh:", error);
    throw error; // Ném lỗi ra ngoài để hàm gọi xử lý
  }
}

// --- CONTROLLERS ---

/**
 * [Public] Lấy danh sách tất cả các Chủ đề Quiz (QuizConfig)
 * GET /api/quiz
 */
export async function listQuizConfigs(req, res) {
  try {
    const configs = await QuizConfig.find({}).sort('themeType');
    res.json(configs);
  } catch (e) {
    console.error("Lỗi listQuizConfigs:", e);
    res.status(500).json({ error: e.message || 'Lỗi server khi lấy danh sách chủ đề' });
  }
}

/**
 * [Admin] Lấy chi tiết 1 Chủ đề Quiz (QuizConfig) bằng _id
 * GET /api/quiz/:configId
 */
export async function getQuizConfigDetail(req, res) {
  // console.log(`>>> [GET /api/quiz/:id] Đã nhận request. ID: ${req.params.configId}`);
  try {
    const { configId } = req.params;
    const config = await QuizConfig.findById(configId); // Find by _id

    if (!config) {
      // console.log(`>>> [GET /api/quiz/:id] Không tìm thấy config với ID: ${configId}`);
      return res.status(404).json({ error: 'Không tìm thấy chủ đề quiz' });
    }
    // console.log(`>>> [GET /api/quiz/:id] Tìm thấy config:`, config.themeType);
    res.json(config); // Trả về chi tiết config
  } catch (e) {
    if (e.kind === 'ObjectId') {
      return res.status(400).json({ error: 'Invalid config ID format' });
    }
    console.error("Lỗi getQuizConfigDetail:", e);
    res.status(500).json({ error: e.message || 'Lỗi server khi lấy chi tiết chủ đề' });
  }
}


/**
 * [User] Bắt đầu một bài quiz (Tự động tạo câu hỏi THEO CHỦ ĐỀ)
 * GET /api/quiz/start/:configId/:level
 */
export async function startDynamicQuiz(req, res) {
  try {
    const { configId, level } = req.params;
    if (!['easy', 'medium', 'hard'].includes(level)) {
      return res.status(400).json({ error: 'Cấp độ không hợp lệ' });
    }

    const config = await QuizConfig.findById(configId);
    if (!config) return res.status(404).json({ error: 'Không tìm thấy chủ đề quiz' });

    const questionCount = config.levelSettings[level];

    // Xác định bộ lọc và các trường cần lấy dựa trên themeType
    let filters = {};
    let requiredFields = 'hid name district_codename';
    switch (config.themeType) {
      case 'GUESS_NAME_FROM_IMAGE':
      case 'GUESS_PROVINCE_FROM_IMAGE':
        filters = { img: { $ne: null, $ne: '' } };
        requiredFields += ' img';
        break;
      case 'GUESS_NAME_FROM_SUMMARY':
        filters = { Summary: { $ne: null, $ne: '' } };
        requiredFields += ' Summary';
        break;
      case 'GUESS_PROVINCE_FROM_NAME':
        filters = {};
        break;
      default:
        return res.status(400).json({ error: 'Loại chủ đề không được hỗ trợ' });
    }

    // Lấy data di sản từ DB
    const candidates = await Heritage.find(filters).select(requiredFields);

    // Kiểm tra data
    const requiresProvinceData = config.themeType.includes('PROVINCE');
    const minCandidatesNeeded = 4; // Cần ít nhất 4 lựa chọn
    if (candidates.length < minCandidatesNeeded || candidates.length < questionCount) {
      return res.status(400).json({ error: `Không đủ di sản (${candidates.length}) phù hợp với chủ đề '${config.themeType}' để tạo ${questionCount} câu hỏi (cần ít nhất ${Math.max(minCandidatesNeeded, questionCount)}).` });
    }

    const allProvinces = requiresProvinceData ? await getProvinces() : [];
    if (requiresProvinceData && allProvinces.length < 4) {
       return res.status(500).json({ error: 'Không thể lấy đủ dữ liệu tỉnh/thành.' });
    }

    // Tạo bộ câu hỏi
    const questions = [];
    const shuffledCandidates = shuffleArray([...candidates]);
    const correctHeritages = shuffledCandidates.slice(0, questionCount);

    for (const correctHeritage of correctHeritages) {
      let questionText = '';
      let options = []; // Mảng các lựa chọn { text: string, value: string }
      let questionData = {
        hid: correctHeritage.hid,
        name: correctHeritage.name,
        ...(config.themeType.includes('IMAGE') && { img: correctHeritage.img }),
        ...(config.themeType === 'GUESS_NAME_FROM_SUMMARY' && { summary: correctHeritage.Summary }),
      };

      // --- Logic tạo câu hỏi và lựa chọn ---
      try {
          switch (config.themeType) {
            case 'GUESS_NAME_FROM_IMAGE':
              questionText = "Đây là di sản nào?";
              const wrongNames = candidates.filter(c => c.hid !== correctHeritage.hid);
              if (wrongNames.length < 3) continue;
              options = shuffleArray([
                correctHeritage,
                ...shuffleArray(wrongNames).slice(0, 3)
              ]).map(opt => ({ text: opt.name, value: opt.hid }));
              break;

            case 'GUESS_PROVINCE_FROM_IMAGE':
            case 'GUESS_PROVINCE_FROM_NAME':
              questionText = config.themeType === 'GUESS_PROVINCE_FROM_IMAGE'
                ? "Di sản này thuộc tỉnh/thành nào?"
                : `Di sản '${correctHeritage.name}' thuộc tỉnh/thành nào?`;

              const correctProvince = allProvinces.find(p =>
                 correctHeritage.district_codename?.includes(p.codename) ||
                 correctHeritage.district_codename?.startsWith(p.codename.replace('tinh_', '').replace('thanh_pho_', ''))
              );
              if (!correctProvince) {
                  console.warn(`Không tìm thấy tỉnh cho di sản ${correctHeritage.hid} (${correctHeritage.district_codename})`);
                  continue;
              }

              const wrongProvinces = allProvinces.filter(p => p.codename !== correctProvince.codename);
               if (wrongProvinces.length < 3) continue;
              options = shuffleArray([
                correctProvince,
                ...shuffleArray(wrongProvinces).slice(0, 3)
              ]).map(opt => ({ text: opt.name, value: opt.codename }));
              break;

            case 'GUESS_NAME_FROM_SUMMARY':
               questionText = "Mô tả này nói về di sản nào?";
               const wrongSummaries = candidates.filter(c => c.hid !== correctHeritage.hid);
                if (wrongSummaries.length < 3) continue;
               options = shuffleArray([
                 correctHeritage,
                 ...shuffleArray(wrongSummaries).slice(0, 3)
               ]).map(opt => ({ text: opt.name, value: opt.hid }));
               break;
          }
      } catch (optionError) {
          console.error(`Lỗi khi tạo options cho ${correctHeritage.hid}:`, optionError);
          continue;
      }

      if (options.length === 4) {
          questions.push({
            questionId: correctHeritage.hid,
            questionText: questionText,
            questionData: questionData,
            options: options
          });
      }
    }

     if (questions.length < questionCount) {
       console.warn(`Chỉ tạo được ${questions.length}/${questionCount} câu hỏi hợp lệ.`);
       if (questions.length === 0) {
            return res.status(400).json({ error: `Không tạo được câu hỏi nào. Vui lòng kiểm tra dữ liệu.` });
       }
     }

    res.json({
      quizConfig: { _id: config._id, themeType: config.themeType },
      level: level,
      // Đảm bảo chỉ trả về đúng số lượng câu hỏi yêu cầu
      questions: questions.slice(0, questionCount),
    });
  } catch (e) {
    console.error("Lỗi startDynamicQuiz:", e);
    res.status(500).json({ error: e.message || 'Lỗi server khi tạo quiz' });
  }
}

/**
 * [User] Nộp bài Quiz động
 * POST /api/quiz/submit
 */
export async function submitDynamicQuiz(req, res) {
  try {
    const userId = req.user.id;
    const { configId, level, answers, startDate } = req.body;

    if (!Array.isArray(answers) || !configId || !level || !['easy', 'medium', 'hard'].includes(level)) {
       return res.status(400).json({ error: 'Thiếu hoặc sai configId, level, hoặc answers' });
    }

    const config = await QuizConfig.findById(configId);
    if (!config) return res.status(404).json({ error: 'Không tìm thấy chủ đề quiz' });

    let correctCount = 0;
    const attemptAnswers = [];

    // --- Logic chấm điểm ---
    const requiresProvinceData = config.themeType.includes('PROVINCE');
    const allProvinces = requiresProvinceData ? await getProvinces() : [];
    const heritageDetails = requiresProvinceData
        ? await Heritage.find({ hid: { $in: answers.map(a => a.questionId) } }).select('hid district_codename')
        : [];
    const heritageMap = new Map(heritageDetails.map(h => [h.hid, h.district_codename]));

    for (const answer of answers) {
       let isCorrect = false;
       const questionHid = answer.questionId;
       const selectedValue = answer.selectedValue;

       switch (config.themeType) {
           case 'GUESS_NAME_FROM_IMAGE':
           case 'GUESS_NAME_FROM_SUMMARY':
               isCorrect = (questionHid === selectedValue);
               break;
           case 'GUESS_PROVINCE_FROM_IMAGE':
           case 'GUESS_PROVINCE_FROM_NAME':
               const correctDistrictCodename = heritageMap.get(questionHid);
               const correctProvince = allProvinces.find(p => correctDistrictCodename?.includes(p.codename));
               isCorrect = (correctProvince?.codename === selectedValue);
               break;
       }

       if (isCorrect) correctCount++;

       attemptAnswers.push({
         questionHid: questionHid,
         selectedHidOrCodename: selectedValue,
         isCorrect: isCorrect
       });
    }
    // --- Kết thúc logic chấm điểm ---

    const totalQuestions = answers.length;
    const percent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    // --- Tính điểm XP và Điểm Tuần ---
    let xpGained = 0;
    const baseCorrectXpPerLevel = { easy: 8, medium: 12, hard: 18 };
    xpGained = correctCount * (baseCorrectXpPerLevel[level] || 10);
    if (percent === 100 && totalQuestions > 0) { xpGained += 50; }
    const weeklyScoreGained = correctCount;
    // --- Kết thúc tính điểm ---

    // --- Logic Tính Toán Streak Update ---
    // console.log('\n--- Bắt đầu kiểm tra Streak ---');
    let streakUpdate = {};
    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0]; // 'YYYY-MM-DD' UTC
    // console.log(`Streak Check: Ngày hôm nay (UTC): ${todayDateString}`);

    const currentUser = await User.findById(userId).select('streak lastQuizCompletionDate');

    if (currentUser) {
      // console.log(`Streak Check: User ${userId} - Streak hiện tại: ${currentUser.streak}`);
      const lastCompletion = currentUser.lastQuizCompletionDate;
      const lastCompletionDateString = lastCompletion ? lastCompletion.toISOString().split('T')[0] : null;
      // console.log(`Streak Check: Ngày chơi cuối (UTC): ${lastCompletionDateString || 'Chưa chơi'}`);

      if (!lastCompletionDateString || lastCompletionDateString < todayDateString) {
        // console.log("Streak Check: Chưa chơi hôm nay.");
        const yesterday = new Date(today);
        yesterday.setUTCDate(today.getUTCDate() - 1);
        const yesterdayDateString = yesterday.toISOString().split('T')[0];
        // console.log(`Streak Check: Ngày hôm qua (UTC): ${yesterdayDateString}`);

        if (lastCompletionDateString === yesterdayDateString) {
          // console.log("Streak Check: Ngày cuối là hôm qua -> Tăng streak.");
          streakUpdate = { $inc: { streak: 1 }, $set: { lastQuizCompletionDate: today } };
        } else {
          // console.log("Streak Check: Ngày cuối KHÔNG phải hôm qua -> Reset streak về 1.");
          streakUpdate = { $set: { streak: 1, lastQuizCompletionDate: today } };
        }
      } else {
        // console.log("Streak Check: Đã chơi hôm nay -> Không đổi streak.");
        // streakUpdate giữ là {}
      }
    } else {
      console.warn(`Streak Check: Không tìm thấy User ${userId}.`);
    }
    // console.log('--- Kết thúc kiểm tra Streak ---');
    // --- Kết thúc Logic Streak ---


    // --- Cập nhật DB ---
    const attemptPromise = QuizAttempt.create({
      quizConfigId: configId, userId, level,
      totalQuestions, correctCount, percent,
      startDate: startDate || new Date(), finishedAt: new Date(),
      answers: attemptAnswers
    });

    const updateUserPromise = User.findByIdAndUpdate(
      userId,
      {
        $inc: { // Phần tăng điểm
          experience: xpGained,
          weeklyScore: weeklyScoreGained
        },
        ...streakUpdate // Áp dụng $inc/$set streak
      },
      { new: true } // Trả về document đã update
      // Lấy các trường cần thiết để trả về client
    ).select('experience weeklyScore streak lastQuizCompletionDate');

    const [attempt, updatedUser] = await Promise.all([attemptPromise, updateUserPromise]);

    // --- Trả về response ---
    res.status(201).json({
        attempt: attempt,
        xpGained: xpGained,
        weeklyScoreGained: weeklyScoreGained,
        currentExperience: updatedUser?.experience,
        currentWeeklyScore: updatedUser?.weeklyScore,
        currentStreak: updatedUser?.streak,
        lastQuizCompletionDate: updatedUser?.lastQuizCompletionDate
    });

  } catch (e) {
     console.error("Lỗi submitDynamicQuiz:", e);
     res.status(500).json({ error: e.message || 'Lỗi server khi nộp bài' });
  }
}

// --- QUYỀN ADMIN ---
/**
 * [Admin] Tạo một Chủ đề Quiz (QuizConfig)
 * POST /api/quiz
 */
export async function createQuizConfig(req, res) {
  try {
    const { themeType, levelSettings, description } = req.body;
    if (!themeType || !levelSettings || !QuizThemeTypes.includes(themeType)) { return res.status(400).json({ error: 'Thiếu Loại Chủ đề hoặc Cài đặt Level' }); }
    if (!levelSettings.easy || !levelSettings.medium || !levelSettings.hard || levelSettings.easy < 1 || levelSettings.medium < 1 || levelSettings.hard < 1) { return res.status(400).json({ error: 'Số câu mỗi level phải lớn hơn 0' }); }
    const config = await QuizConfig.create({ description, themeType, levelSettings });
    res.status(201).json(config);
  } catch (e) {
    console.error("Lỗi createQuizConfig:", e); // Log lỗi
    if (e.code === 11000) return res.status(409).json({ error: 'Tên/Loại chủ đề này đã tồn tại (nếu unique)' });
    res.status(500).json({ error: e.message });
  }
}

/**
 * [Admin] Cập nhật Chủ đề Quiz
 * PATCH /api/quiz/:configId
 */
export async function updateQuizConfig(req, res) {
  try {
    const { configId } = req.params;
    const { description, themeType, levelSettings } = req.body;
    const updateData = {};
    if (description !== undefined) updateData.description = description;
    if (themeType && QuizThemeTypes.includes(themeType)) updateData.themeType = themeType;
    if (levelSettings) {
        if (!levelSettings.easy || !levelSettings.medium || !levelSettings.hard || levelSettings.easy < 1 || levelSettings.medium < 1 || levelSettings.hard < 1) { return res.status(400).json({ error: 'Số câu mỗi level phải lớn hơn 0' }); }
       updateData.levelSettings = levelSettings;
    }
    const config = await QuizConfig.findByIdAndUpdate(configId, updateData, { new: true });
    if (!config) return res.status(404).json({ error: 'Không tìm thấy chủ đề' });
    res.json(config);
  } catch (e) {
     console.error("Lỗi updateQuizConfig:", e); // Log lỗi
     if (e.code === 11000) return res.status(409).json({ error: 'Tên/Loại chủ đề này đã tồn tại (nếu unique)' });
     res.status(500).json({ error: e.message });
  }
}

/**
 * [Admin] Xóa Chủ đề Quiz
 * DELETE /api/quiz/:configId
 */
export async function deleteQuizConfig(req, res) {
  try {
    const { configId } = req.params;
    const config = await QuizConfig.findByIdAndDelete(configId);
    if (!config) return res.status(404).json({ error: 'Không tìm thấy chủ đề' });
    // Optional: Delete associated QuizAttempts
    // await QuizAttempt.deleteMany({ quizConfigId: configId });
    res.json({ ok: true, message: 'Đã xóa chủ đề quiz' });
  } catch (e) {
    console.error("Lỗi deleteQuizConfig:", e); // Log lỗi
    res.status(500).json({ error: e.message });
  }
}