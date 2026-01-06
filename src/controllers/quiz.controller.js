import { QuizConfig, QuizThemeTypes } from '../models/QuizConfig.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { Heritage } from '../models/Heritage.js';
import { User } from '../models/User.js';
import { getProvinces } from '../services/province.service.js';

// --- Helper Functions ---
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// --- CONTROLLERS ---

/**
 * [Public] Lấy danh sách tất cả các Chủ đề Quiz (QuizConfig)
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
 */
export async function getQuizConfigDetail(req, res) {
  try {
    const { configId } = req.params;
    const config = await QuizConfig.findById(configId);

    if (!config) {
      return res.status(404).json({ error: 'Không tìm thấy chủ đề quiz' });
    }
    res.json(config);
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

    // ✅ Project đã bao gồm 'ward_codename' (chính xác)
    let filters = {};
    let projectFields = {
      _id: 0,
      hid: 1,
      name: 1,
      ward_codename: 1
    };

    switch (config.themeType) {
      case 'GUESS_NAME_FROM_IMAGE':
      case 'GUESS_PROVINCE_FROM_IMAGE':
        // [FIXED] Trọc vào 'img.url' thay vì 'img' để lọc đúng các di sản có link ảnh
        filters = { 'img.url': { $ne: null, $ne: '' } };
        projectFields.img = 1;
        break;
      case 'GUESS_NAME_FROM_SUMMARY':
        filters = { Summary: { $ne: null, $ne: '' } };
        projectFields.Summary = 1;
        break;
      case 'GUESS_PROVINCE_FROM_NAME':
        filters = {};
        break;
      default:
        return res.status(400).json({ error: 'Loại chủ đề không được hỗ trợ' });
    }
    const sampleSize = Math.max(questionCount * 4, 50);
    const candidates = await Heritage.aggregate([
      { $match: filters },
      { $sample: { size: sampleSize } },
      { $project: projectFields }
    ]);

    // Kiểm tra data
    const requiresProvinceData = config.themeType.includes('PROVINCE');
    const minCandidatesNeeded = 4;
    if (candidates.length < minCandidatesNeeded || candidates.length < questionCount) {
      return res.status(400).json({ error: `Không đủ di sản (${candidates.length}) phù hợp với chủ đề '${config.themeType}' để tạo ${questionCount} câu hỏi (cần ít nhất ${Math.max(minCandidatesNeeded, questionCount)}).` });
    }

    let allProvinces = [];

    let wardMap = null;

    if (requiresProvinceData) {
      try {
        // ✅ Sử dụng hàm getProvinces từ service
        const provinceData = await getProvinces();
        allProvinces = provinceData.allProvinces;
        wardMap = provinceData.wardMap;

        if (allProvinces.length < 4 || !wardMap || wardMap.size === 0) {
          return res.status(500).json({ error: 'Không thể lấy đủ dữ liệu tỉnh/thành hoặc bản đồ phường/xã.' });
        }
      } catch (e) {
        return res.status(500).json({ error: 'Lỗi API khi lấy dữ liệu Tỉnh/Phường/Xã.' });
      }
    }

    // Tạo bộ câu hỏi
    const questions = [];
    const shuffledCandidates = shuffleArray([...candidates]);
    const correctHeritages = shuffledCandidates.slice(0, questionCount);

    for (const correctHeritage of correctHeritages) {
      let questionText = '';
      let options = [];
      
      // [FIXED] Lấy .url từ object img. Nếu img là string cũ thì fallback về chính nó.
      const imgUrl = correctHeritage.img?.url || correctHeritage.img;

      let questionData = {
        hid: correctHeritage.hid,
        name: correctHeritage.name,
        ...(config.themeType.includes('IMAGE') && { img: imgUrl }), // Chỉ trả về URL string
        ...(config.themeType === 'GUESS_NAME_FROM_SUMMARY' && { summary: correctHeritage.Summary }),
      };

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


            const correctProvinceCodename = wardMap.get(correctHeritage.ward_codename);
            if (!correctProvinceCodename) {
              console.warn(`(Map) Không tìm thấy tỉnh cho di sản ${correctHeritage.hid} (phường/xã: ${correctHeritage.ward_codename})`);
              continue;
            }

            const correctProvince = allProvinces.find(p => p.codename === correctProvinceCodename);

            if (!correctProvince) {
              console.warn(`(List) Không tìm thấy đối tượng tỉnh cho codename: ${correctProvinceCodename}`);
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
    let allProvinces = [];

    let wardMap = null;
    const requiresProvinceData = config.themeType.includes('PROVINCE');

    if (requiresProvinceData) {
      try {
        const provinceData = await getProvinces();
        allProvinces = provinceData.allProvinces;

        wardMap = provinceData.wardMap;
      } catch (e) {
        return res.status(500).json({ error: 'Lỗi API khi lấy dữ liệu Tỉnh/Phường/Xã để chấm điểm.' });
      }
    }

    const heritageDetails = requiresProvinceData
      ? await Heritage.find({ hid: { $in: answers.map(a => a.questionId) } }).select('hid ward_codename')
      : [];

    const heritageMap = new Map(heritageDetails.map(h => [h.hid, h.ward_codename]));

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
          const correctWardCodename = heritageMap.get(questionHid);
          const correctProvinceCodename = wardMap.get(correctWardCodename);
          isCorrect = (correctProvinceCodename === selectedValue);
          break;
      }

      if (isCorrect) correctCount++;

      attemptAnswers.push({
        questionHid: questionHid,
        questionText: answer.questionText,
        questionImage: answer.questionImage,
        selectedHidOrCodename: selectedValue,
        selectedAnswerText: answer.selectedAnswerText,
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

    // --- Logic Streak ---
    let streakUpdate = {};
    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0];
    const currentUser = await User.findById(userId).select('streak lastQuizCompletionDate');
    if (currentUser) {
      const lastCompletion = currentUser.lastQuizCompletionDate;
      const lastCompletionDateString = lastCompletion ? lastCompletion.toISOString().split('T')[0] : null;
      if (!lastCompletionDateString || lastCompletionDateString < todayDateString) {
        const yesterday = new Date(today);
        yesterday.setUTCDate(today.getUTCDate() - 1);
        const yesterdayDateString = yesterday.toISOString().split('T')[0];
        if (lastCompletionDateString === yesterdayDateString) {
          streakUpdate = { $inc: { streak: 1 }, $set: { lastQuizCompletionDate: today } };
        } else {
          streakUpdate = { $set: { streak: 1, lastQuizCompletionDate: today } };
        }
      }
    } else {
      console.warn(`Streak Check: Không tìm thấy User ${userId}.`);
    }

    // --- Cập nhật DB ---
    const attemptPromise = QuizAttempt.create({
      quizConfigId: configId, userId, level,
      totalQuestions, correctCount, percent,
      startDate: startDate || new Date(), finishedAt: new Date(),
      answers: attemptAnswers,
      xpGained: xpGained
    });

    const updateUserPromise = User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          experience: xpGained,
          weeklyScore: weeklyScoreGained
        },
        ...streakUpdate
      },
      { new: true }
    ).select('experience weeklyScore streak lastQuizCompletionDate');

    const [attempt, updatedUser] = await Promise.all([attemptPromise, updateUserPromise]);

    // --- Trả về response (Giữ nguyên) ---
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

// --- QUYỀN ADMIN (Không thay đổi) ---
/**
 * [Admin] Tạo một Chủ đề Quiz (QuizConfig)
 */
export async function createQuizConfig(req, res) {
  try {
    const { themeType, levelSettings, description } = req.body;
    if (!themeType || !levelSettings || !QuizThemeTypes.includes(themeType)) { return res.status(400).json({ error: 'Thiếu Loại Chủ đề hoặc Cài đặt Level' }); }
    if (!levelSettings.easy || !levelSettings.medium || !levelSettings.hard || levelSettings.easy < 1 || levelSettings.medium < 1 || levelSettings.hard < 1) { return res.status(400).json({ error: 'Số câu mỗi level phải lớn hơn 0' }); }
    const config = await QuizConfig.create({ description, themeType, levelSettings });
    res.status(201).json(config);
  } catch (e) {
    console.error("Lỗi createQuizConfig:", e);
    if (e.code === 11000) return res.status(409).json({ error: 'Tên/Loại chủ đề này đã tồn tại (nếu unique)' });
    res.status(500).json({ error: e.message });
  }
}

/**
 * [Admin] Cập nhật Chủ đề Quiz
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
    console.error("Lỗi updateQuizConfig:", e);
    if (e.code === 11000) return res.status(409).json({ error: 'Tên/Loại chủ đề này đã tồn tại (nếu unique)' });
    res.status(500).json({ error: e.message });
  }
}

/**
 * [Admin] Xóa Chủ đề Quiz
 */
export async function deleteQuizConfig(req, res) {
  try {
    const { configId } = req.params;
    const config = await QuizConfig.findByIdAndDelete(configId);
    if (!config) return res.status(404).json({ error: 'Không tìm thấy chủ đề' });
    res.json({ ok: true, message: 'Đã xóa chủ đề quiz' });
  } catch (e) {
    console.error("Lỗi deleteQuizConfig:", e);
    res.status(500).json({ error: e.message });
  }
}