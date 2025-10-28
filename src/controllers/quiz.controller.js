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
    return []; // Trả về mảng rỗng nếu lỗi
  }
}

// --- CONTROLLERS ---

/**
 * [Public] Lấy danh sách tất cả các Chủ đề Quiz (QuizConfig)
 * GET /api/quiz
 */
export async function listQuizConfigs(req, res) {
  try {
    // Sắp xếp theo themeType thay vì name
    const configs = await QuizConfig.find({}).sort('themeType');
    res.json(configs);
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    const minCandidatesNeeded = requiresProvinceData ? 4 : 4;
    if (candidates.length < minCandidatesNeeded || candidates.length < questionCount) {
      return res.status(400).json({ error: `Không đủ di sản (${candidates.length}) phù hợp với chủ đề '${config.themeType}' để tạo ${questionCount} câu hỏi.` });
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
      switch (config.themeType) {
        case 'GUESS_NAME_FROM_IMAGE':
          questionText = "Đây là di sản nào?";
          const wrongNames = candidates.filter(c => c.hid !== correctHeritage.hid);
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
          if (!correctProvince) continue;

          const wrongProvinces = allProvinces.filter(p => p.codename !== correctProvince.codename);
          options = shuffleArray([
            correctProvince,
            ...shuffleArray(wrongProvinces).slice(0, 3)
          ]).map(opt => ({ text: opt.name, value: opt.codename }));
          break;

        case 'GUESS_NAME_FROM_SUMMARY':
           questionText = "Mô tả này nói về di sản nào?";
           const wrongSummaries = candidates.filter(c => c.hid !== correctHeritage.hid);
           options = shuffleArray([
             correctHeritage,
             ...shuffleArray(wrongSummaries).slice(0, 3)
           ]).map(opt => ({ text: opt.name, value: opt.hid }));
           break;
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
       return res.status(400).json({ error: `Chỉ tạo được ${questions.length}/${questionCount} câu hỏi hợp lệ. Vui lòng kiểm tra lại dữ liệu di sản và tỉnh/thành.` });
     }

    res.json({
      // Truyền themeType thay vì name
      quizConfig: { _id: config._id, themeType: config.themeType },
      level: level,
      questions: questions,
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
    // 1. Get data from request (user ID from auth middleware, others from body)
    const userId = req.user.id; //
    const { configId, level, answers, startDate } = req.body;

    // 2. Validate input
    if (!Array.isArray(answers) || !configId || !level || !['easy', 'medium', 'hard'].includes(level)) {
       return res.status(400).json({ error: 'Thiếu hoặc sai configId, level, hoặc answers' });
    }

    // 3. Fetch the Quiz Configuration
    const config = await QuizConfig.findById(configId);
    if (!config) return res.status(404).json({ error: 'Không tìm thấy chủ đề quiz' });

    // 4. Initialize scoring variables
    let correctCount = 0;
    const attemptAnswers = []; // Array to store detailed answer results

    // 5. Fetch necessary data for scoring (only if needed)
    const requiresProvinceData = config.themeType.includes('PROVINCE');
    const allProvinces = requiresProvinceData ? await getProvinces() : [];
    // Get heritage details only for questions involved in this attempt IF it's a province-guessing theme
    const heritageDetails = requiresProvinceData
        ? await Heritage.find({ hid: { $in: answers.map(a => a.questionId) } }).select('hid district_codename')
        : [];
    // Create a map for quick lookup: hid -> district_codename
    const heritageMap = new Map(heritageDetails.map(h => [h.hid, h.district_codename]));

    // 6. Score the answers
    for (const answer of answers) {
       let isCorrect = false;
       const questionHid = answer.questionId; // HID of the heritage representing the question/correct answer
       const selectedValue = answer.selectedValue; // The value (HID or province codename) the user selected

       // Determine correctness based on the theme type
       switch (config.themeType) {
           case 'GUESS_NAME_FROM_IMAGE':
           case 'GUESS_NAME_FROM_SUMMARY':
               // Correct if the selected HID matches the question HID
               isCorrect = (questionHid === selectedValue);
               break;
           case 'GUESS_PROVINCE_FROM_IMAGE':
           case 'GUESS_PROVINCE_FROM_NAME':
               // Find the correct province codename from the fetched heritage details
               const correctDistrictCodename = heritageMap.get(questionHid);
               // Find the province object matching the codename
               const correctProvince = allProvinces.find(p => correctDistrictCodename?.includes(p.codename));
               // Correct if the selected province codename matches the correct one
               isCorrect = (correctProvince?.codename === selectedValue);
               break;
           // No default needed as themeType is validated in QuizConfig model
       }

       // Increment count if correct
       if (isCorrect) correctCount++;

       // Store detailed result for this answer
       attemptAnswers.push({
         questionHid: questionHid,
         selectedHidOrCodename: selectedValue, // Store what the user selected
         isCorrect: isCorrect
       });
    }

    // 7. Calculate total questions and percentage
    const totalQuestions = answers.length;
    const percent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    // 8. Calculate Experience Points (XP) based on level
    let xpGained = 0;
    const baseCorrectXpPerLevel = {
        easy: 8,
        medium: 12,
        hard: 18
    };
    xpGained = correctCount * (baseCorrectXpPerLevel[level] || 10); // Use level-based points, fallback to 10
    // Optional: Bonus for 100% correct
    if (percent === 100 && totalQuestions > 0) {
      xpGained += 50; // Example bonus
    }

    // 9. Calculate Weekly Score gained (can be same or different logic than XP)
    // Example: Weekly score is simply the number of correct answers
    const weeklyScoreGained = correctCount;

    // 10. Save QuizAttempt and Update User Score/XP concurrently
    const attemptPromise = QuizAttempt.create({
      quizConfigId: configId,
      userId: userId,
      level: level,
      totalQuestions,
      correctCount,
      percent,
      startDate: startDate || new Date(), // Use provided start date or now
      finishedAt: new Date(), // Mark finish time as now
      answers: attemptAnswers // Store the detailed answers
    });

    // Update the user's total experience and weekly score using $inc
    const updateUserPromise = User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          experience: xpGained,       // Increment total XP
          weeklyScore: weeklyScoreGained // Increment weekly score
        }
      },
      { new: true } // Return the updated user document
    ).select('experience weeklyScore'); // Only select the fields needed for the response

    // Wait for both database operations to complete
    const [attempt, updatedUser] = await Promise.all([attemptPromise, updateUserPromise]);

    // 11. Send the response
    res.status(201).json({
        attempt: attempt, // The detailed result of this quiz attempt
        xpGained: xpGained, // How much XP was gained
        weeklyScoreGained: weeklyScoreGained, // How much weekly score was gained
        currentExperience: updatedUser?.experience, // User's new total XP
        currentWeeklyScore: updatedUser?.weeklyScore // User's new total weekly score
    });

  } catch (e) {
     // Log the error on the server
     console.error("Lỗi submitDynamicQuiz:", e);
     // Send a generic error response to the client
     res.status(500).json({ error: e.message || 'Lỗi server khi nộp bài' });
  }
}

// --- QUYỀN ADMIN ---



export async function getQuizConfigDetail(req, res) { // <--- THÊM "export"
 
  try {
    const { configId } = req.params;
    const config = await QuizConfig.findById(configId); // Find by _id

    if (!config) {
      console.log(`>>> [GET /api/quiz/:id] Không tìm thấy config với ID: ${configId}`); // Thêm log
      return res.status(404).json({ error: 'Không tìm thấy chủ đề quiz' });
    }
    console.log(`>>> [GET /api/quiz/:id] Tìm thấy config:`, config.themeType); // Thêm log
    res.json(config); // Trả về chi tiết config
  } catch (e) {
    // Xử lý trường hợp _id không đúng định dạng Mongo
    if (e.kind === 'ObjectId') {
      return res.status(400).json({ error: 'Invalid config ID format' });
    }
    console.error("Lỗi getQuizConfigDetail:", e); // Log lỗi
    res.status(500).json({ error: e.message || 'Lỗi server khi lấy chi tiết chủ đề' });
  }
}

/**
 * [Admin] Tạo một Chủ đề Quiz (QuizConfig) - Không có trường name
 * POST /api/quiz
 */
export async function createQuizConfig(req, res) {
  try {
    // Không còn 'name'
    const { themeType, levelSettings, description } = req.body;

    if (!themeType || !levelSettings || !QuizThemeTypes.includes(themeType)) {
      return res.status(400).json({ error: 'Thiếu Loại Chủ đề hoặc Cài đặt Level' });
    }
    if (!levelSettings.easy || !levelSettings.medium || !levelSettings.hard ||
        levelSettings.easy < 1 || levelSettings.medium < 1 || levelSettings.hard < 1) {
       return res.status(400).json({ error: 'Số câu mỗi level phải lớn hơn 0' });
    }

    // Tạo config không cần name
    const config = await QuizConfig.create({ description, themeType, levelSettings });
    res.status(201).json(config);
  } catch (e) {
    // Nếu themeType là unique, cần bắt lỗi 11000
    // if (e.code === 11000) return res.status(409).json({ error: 'Loại chủ đề này đã tồn tại' });
    res.status(500).json({ error: e.message });
  }
}

/**
 * [Admin] Cập nhật Chủ đề Quiz - Không có trường name
 * PATCH /api/quiz/:configId
 */
export async function updateQuizConfig(req, res) {
  try {
    const { configId } = req.params;
    // Không còn 'name'
    const { description, themeType, levelSettings } = req.body;
    const updateData = {};

    if (description !== undefined) updateData.description = description;
    if (themeType && QuizThemeTypes.includes(themeType)) updateData.themeType = themeType;
    if (levelSettings) {
        if (!levelSettings.easy || !levelSettings.medium || !levelSettings.hard ||
            levelSettings.easy < 1 || levelSettings.medium < 1 || levelSettings.hard < 1) {
           return res.status(400).json({ error: 'Số câu mỗi level phải lớn hơn 0' });
        }
       updateData.levelSettings = levelSettings;
    }

    const config = await QuizConfig.findByIdAndUpdate(configId, updateData, { new: true });
    if (!config) return res.status(404).json({ error: 'Không tìm thấy chủ đề' });
    res.json(config);
  } catch (e) {
     // Nếu themeType là unique, cần bắt lỗi 11000
     // if (e.code === 11000) return res.status(409).json({ error: 'Loại chủ đề này đã tồn tại' });
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
    res.json({ ok: true, message: 'Đã xóa chủ đề quiz' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}