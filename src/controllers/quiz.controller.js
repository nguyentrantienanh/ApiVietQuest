// src/controllers/quiz.controller.js
import { QuizConfig, QuizThemeTypes } from '../models/QuizConfig.js';
import { QuizAttempt } from '../models/QuizAttempt.js';
import { Heritage } from '../models/Heritage.js';
import { User } from '../models/User.js';
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

// ▼▼▼ HÀM ĐÃ SỬA ▼▼▼
// Cache cho 2 loại dữ liệu
let provincesCache = null; // Dùng cho options { name, codename }
let districtToProvinceMapCache = null; // Dùng để tra cứu Huyện -> Tỉnh

/**
 * Lấy danh sách Tỉnh/Thành (và map Huyện -> Tỉnh) từ API
 */
async function getProvinces() {
  // Nếu có cache, trả về ngay
  if (provincesCache && districtToProvinceMapCache) {
    return { allProvinces: provincesCache, districtMap: districtToProvinceMapCache };
  }

  try {
    // Gọi API lấy đầy đủ Tỉnh (depth=1) và Huyện (depth=2)
    const response = await axios.get('https://provinces.open-api.vn/api/?depth=2');
    
    if (!response.data || !Array.isArray(response.data)) {
        throw new Error('API tỉnh/thành không trả về dữ liệu mảng');
    }

    const allProvinces = [];
    const districtMap = new Map();

    for (const province of response.data) {
        // 1. Thêm vào danh sách Tỉnh (để làm đáp án)
        allProvinces.push({ name: province.name, codename: province.codename });

        // 2. Thêm các huyện/quận của tỉnh này vào bản đồ tra cứu
        if (province.districts && Array.isArray(province.districts)) {
            for (const district of province.districts) {
                // Key: "quan_ba_dinh", Value: "thanh_pho_ha_noi"
                districtMap.set(district.codename, province.codename);
            }
        }
    }
    
    // Lưu vào cache
    provincesCache = allProvinces;
    districtToProvinceMapCache = districtMap;

    return { allProvinces: provincesCache, districtMap: districtToProvinceMapCache };

  } catch (error) {
    console.error("Lỗi khi lấy danh sách tỉnh (depth=2):", error.message);
    // Xóa cache nếu lỗi
    provincesCache = null;
    districtToProvinceMapCache = null;
    throw error; // Ném lỗi ra ngoài
  }
}
// ▲▲▲ HẾT HÀM SỬA ▲▲▲

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

    // ▼▼▼ SỬA LOGIC LẤY TỈNH ▼▼▼
    let allProvinces = [];
    let districtMap = null;

    if (requiresProvinceData) {
      try {
        const provinceData = await getProvinces(); // Gọi hàm mới
        allProvinces = provinceData.allProvinces;
        districtMap = provinceData.districtMap;

        if (allProvinces.length < 4 || districtMap.size === 0) {
           return res.status(500).json({ error: 'Không thể lấy đủ dữ liệu tỉnh/thành hoặc bản đồ huyện.' });
        }
      } catch (e) {
         return res.status(500).json({ error: 'Lỗi API khi lấy dữ liệu Tỉnh/Huyện.' });
      }
    }
    // ▲▲▲ HẾT SỬA LOGIC LẤY TỈNH ▲▲▲

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

            // ▼▼▼ SỬA LOGIC TÌM TỈNH ▼▼▼
            case 'GUESS_PROVINCE_FROM_IMAGE':
            case 'GUESS_PROVINCE_FROM_NAME':
              questionText = config.themeType === 'GUESS_PROVINCE_FROM_IMAGE'
                ? "Di sản này thuộc tỉnh/thành nào?"
                : `Di sản '${correctHeritage.name}' thuộc tỉnh/thành nào?`;

              // 1. Dùng map để tra cứu tỉnh từ huyện
              const correctProvinceCodename = districtMap.get(correctHeritage.district_codename);
              if (!correctProvinceCodename) {
                   console.warn(`(Map) Không tìm thấy tỉnh cho di sản ${correctHeritage.hid} (huyện: ${correctHeritage.district_codename})`);
                   continue; // Bỏ qua nếu huyện này không có trong bản đồ
              }
              
              // 2. Tìm đối tượng Tỉnh đầy đủ
              const correctProvince = allProvinces.find(p => p.codename === correctProvinceCodename);
              
              if (!correctProvince) {
                  console.warn(`(List) Không tìm thấy đối tượng tỉnh cho codename: ${correctProvinceCodename}`);
                  continue;
              }

              // 3. Tìm 3 tỉnh sai (Giữ nguyên)
              const wrongProvinces = allProvinces.filter(p => p.codename !== correctProvince.codename);
              if (wrongProvinces.length < 3) continue; // Cần ít nhất 3 tỉnh khác
              options = shuffleArray([
                correctProvince,
                ...shuffleArray(wrongProvinces).slice(0, 3)
              ]).map(opt => ({ text: opt.name, value: opt.codename }));
              break;
            // ▲▲▲ HẾT SỬA LOGIC TÌM TỈNH ▲▲▲

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
    // ▼▼▼ SỬA LOGIC CHẤM ĐIỂM ▼▼▼
    let allProvinces = [];
    let districtMap = null;
    const requiresProvinceData = config.themeType.includes('PROVINCE');

    if (requiresProvinceData) {
       try {
        const provinceData = await getProvinces(); // Gọi hàm đã sửa
        allProvinces = provinceData.allProvinces;
        districtMap = provinceData.districtMap;
      } catch (e) {
         return res.status(500).json({ error: 'Lỗi API khi lấy dữ liệu Tỉnh/Huyện để chấm điểm.' });
      }
    }
    
    // Lấy di sản (Giữ nguyên)
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
               // Sửa logic chấm điểm
               const correctDistrictCodename = heritageMap.get(questionHid);
               const correctProvinceCodename = districtMap.get(correctDistrictCodename);
               
               isCorrect = (correctProvinceCodename === selectedValue);
               break;
       }
       // ▲▲▲ HẾT SỬA LOGIC CHẤM ĐIỂM ▲▲▲

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
    let streakUpdate = {};
    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0]; // 'YYYY-MM-DD' UTC

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
      } else {
        // Đã chơi hôm nay -> Không đổi streak
      }
    } else {
      console.warn(`Streak Check: Không tìm thấy User ${userId}.`);
    }
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
 */
export async function deleteQuizConfig(req, res) {
  try {
    const { configId } = req.params;
    const config = await QuizConfig.findByIdAndDelete(configId);
    if (!config) return res.status(404).json({ error: 'Không tìm thấy chủ đề' });
    res.json({ ok: true, message: 'Đã xóa chủ đề quiz' });
  } catch (e) {
    console.error("Lỗi deleteQuizConfig:", e); // Log lỗi
    res.status(500).json({ error: e.message });
  }
}