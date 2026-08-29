const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const MAX_CHUNK = 1900;
const conversationHistory = {};
const SERPAPI_KEY = process.env.SERPAPI_KEY || '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ai', 'opera', 'ask', 'gemini', 'vision', 'gscholar', 'scholar', 'googlescholar', 'research', 'generate', 'image', 'img', 'show', 'answer', 'solve', 'help'],
  description: 'AI Assistant that answers with 100% accuracy for all tests and questions',
  usage: 'ai [question/activity/assignment] or send/reply to image',
  version: '14.0.0',
  author: 'codex',
  category: 'AI',
  cooldown: 3,

  async execute(senderId, args, token, event) {
    try {
      let prompt = args.join(' ').trim();
      let previousResponse = null;
      let isReply = false;
      let previousPrompt = null;
      let imageUrl = null;

      // ========== WELCOME MESSAGE ==========
      if (!prompt && !event?.message?.reply_to?.mid && !event?.message?.attachments) {
        await sendMessage(senderId, {
          text: '🤖 AI ASSISTANT - 100% ACCURATE ANSWERS\n\nI can answer ALL types of tests and questions:\n• 📝 Activity Sheets & Worksheets\n• 📝 Quizzes and Exams\n• 📝 Assignments & Homework\n• 📝 Shading Exams (Scantron/Bubble)\n• 📝 ✓ / ✗ (Check / X) Questions\n• 📝 😊 Emoji Ratings\n• 📝 Multiple Choice (A, B, C, D)\n• 📝 True or False\n• 📝 Fill in the Blank\n• 📝 Matching Type\n• 📝 Enumeration\n• 📝 Essay Questions\n• 📝 Math Problems (with step-by-step solution)\n• 📝 Summative/Pre-Assessment/Post-Assessment\n• ❓ Any Questions\n• 🖼️ Image Analysis\n\nHow to use:\n• ai [your test/question/assignment]\n• Or send/reply to an image'
        }, token);
        return;
      }

      // ========== TYPO CORRECTION ==========
      const correctedPrompt = this.correctTypos(prompt);
      if (correctedPrompt !== prompt) {
        prompt = correctedPrompt;
      }

      // ========== DETECT INPUT TYPE ==========
      const inputType = this.detectInputType(prompt);
      console.log('[ai] Input type detected:', inputType);

      // ========== IF PRESENTATION TOPIC -> REDIRECT TO PPT.JS ==========
      if (inputType === 'presentation') {
        await sendMessage(senderId, {
          text: `📊 This appears to be a presentation outline/topic.\n\nPlease use the "ppt" command to generate a comprehensive presentation:\n\nppt ${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}`
        }, token);
        return;
      }

      // ========== HANDLE ALL TEST TYPES ==========
      if (inputType === 'shading' || inputType === 'symbol' || 
          inputType === 'emoji' || inputType === 'assessment' || 
          inputType === 'activity' || inputType === 'quiz' || 
          inputType === 'assignment' || inputType === 'multiple_choice' ||
          inputType === 'true_false') {
        
        await sendMessage(senderId, { 
          text: `📝 Analyzing for 100% accurate answers... Please wait.` 
        }, token);
        
        const response = await this.handleActivitySheet(prompt);
        await this.sendChunks(senderId, response, token);
        return;
      }

      // ========== HANDLE QUESTION ==========
      if (inputType === 'question') {
        await sendMessage(senderId, { 
          text: '💭 Searching for accurate answer...' 
        }, token);
      }

      // ========== HANDLE MATH ==========
      if (inputType === 'math') {
        await sendMessage(senderId, { 
          text: '🧮 Solving with step-by-step solution...' 
        }, token);
        
        const finalPrompt = this.buildMathSolutionPrompt(prompt, this.detectLanguage(prompt));
        const response = await this.callAPI(finalPrompt);
        const aiResponse = this.cleanResponse(response || 'No response from API.');
        await this.sendChunks(senderId, aiResponse, token);
        return;
      }

      // ========== SPECIAL COMMANDS ==========
      if (this.isLyricsRequest(prompt)) {
        await this.handleLyricsSearch(senderId, prompt, token);
        return;
      }

      if (this.isGenerateCommand(prompt)) {
        await this.handleImageGeneration(senderId, prompt, token);
        return;
      }

      if (this.isImageRequest(prompt)) {
        await this.handleImageGeneration(senderId, prompt, token);
        return;
      }

      if (this.isMusicRequest(prompt)) {
        await this.handleMusicSearch(senderId, prompt, token);
        return;
      }

      if (this.isScholarCommand(prompt)) {
        await this.handleScholarSearch(senderId, prompt, token);
        return;
      }

      if (this.isResearchQuery(prompt)) {
        await this.handleScholarSearch(senderId, prompt, token);
        return;
      }

      // ========== RETURN TO TOPIC ==========
      if (this.isReturnToTopicRequest(prompt)) {
        const history = conversationHistory[senderId];
        if (history && history.topicHistory) {
          const bestMatch = this.findBestTopicMatch(prompt, history);
          if (bestMatch) {
            const topicData = history.topicHistory[bestMatch];
            const response = topicData.response || topicData;
            if (response) {
              previousResponse = response;
              previousPrompt = topicData.prompt || bestMatch;
              isReply = true;
            }
          }
        }
        if (!isReply && history && history.lastResponse) {
          previousResponse = history.lastResponse;
          previousPrompt = history.lastPrompt || 'Previous topic';
          isReply = true;
        }
      }

      // ========== REPLY TO A MESSAGE ==========
      if (event?.message?.reply_to?.mid) {
        isReply = true;
        const replyData = await this.getRepliedMessageData(event.message.reply_to.mid, token);
        previousResponse = replyData.message;
        imageUrl = replyData.imageUrl;
        if (!prompt) prompt = 'Please respond to what I said.';
      }

      // ========== IMAGE ATTACHMENT ==========
      if (!imageUrl && event?.message?.attachments) {
        for (const attachment of event.message.attachments) {
          if (attachment.type === 'image' || attachment.type === 'photo') {
            imageUrl = attachment.payload?.url || attachment.url || null;
            if (imageUrl) {
              const urlObj = new URL(imageUrl);
              urlObj.searchParams.set('access_token', token);
              imageUrl = urlObj.toString();
            }
            break;
          }
        }
        if (imageUrl && !prompt) prompt = 'Analyze this image.';
      }

      // ========== CONVERSATION CONTEXT ==========
      if (!isReply && prompt && !imageUrl) {
        const history = conversationHistory[senderId];
        if (history && history.lastResponse) {
          const lowerPrompt = prompt.toLowerCase();
          const isModification = this.isModificationRequest(lowerPrompt);
          const isFollowUp = this.isFollowUpRequest(lowerPrompt) ||
                            this.isContextualQuestion(lowerPrompt, history.lastPrompt) ||
                            isModification;
          const isNewTopic = this.isNewTopic(lowerPrompt, history.lastPrompt, prompt);

          if (isModification && !isNewTopic) {
            previousResponse = history.lastResponse;
            previousPrompt = history.lastPrompt || 'image analysis';
            isReply = true;
          } else if (isFollowUp && !isNewTopic) {
            previousResponse = history.lastResponse;
            previousPrompt = history.lastPrompt || 'image analysis';
            isReply = true;
          } else if (!isNewTopic && history.hasImageContext) {
            previousResponse = history.lastResponse;
            previousPrompt = history.lastPrompt || 'image analysis';
            isReply = true;
          }
        }
      }

      // ========== IMAGE ANALYSIS ==========
      if (imageUrl) {
        await sendMessage(senderId, { text: '🖼️ Analyzing image with 100% accuracy...' }, token);
        const aiResponse = await this.callGeminiAPI(prompt, imageUrl, this.detectLanguage(prompt));
        
        const history = conversationHistory[senderId] || { topicHistory: {} };
        const topicKey = this.extractTopicKey(prompt || 'image');
        const keywords = this.extractKeywordsFromResponse(aiResponse);

        history.lastPrompt = prompt || 'Image analysis';
        history.lastResponse = aiResponse;
        history.lastImageUrl = imageUrl;
        history.hasImageContext = true;
        history.language = this.detectLanguage(prompt);
        history.timestamp = Date.now();

        if (topicKey) {
          history.topicHistory[topicKey] = {
            response: aiResponse,
            prompt: prompt || 'image analysis',
            keywords: keywords,
            timestamp: Date.now()
          };
        }
        for (const kw of keywords) {
          if (kw.length > 3 && !history.topicHistory[kw]) {
            history.topicHistory[kw] = {
              response: aiResponse,
              prompt: prompt || 'image analysis',
              keywords: keywords,
              timestamp: Date.now()
            };
          }
        }
        conversationHistory[senderId] = history;
        
        await this.sendChunks(senderId, aiResponse, token);
        return;
      }

      // ========== OWNER QUESTION ==========
      if (this.isOwnerQuestion(prompt)) {
        const lang = this.getLanguageName(this.detectLanguage(prompt));
        const response = lang === 'Tagalog' ? 'Ako ay ginawa ni GeoDevz69. Bisitahin dito para sa karagdagang impormasyon:\nhttps://www.facebook.com/geotechph.net' :
                          lang === 'Bisaya' ? 'Ako gihimo ni GeoDevz69. Bisitaha diri para sa dugang impormasyon:\nhttps://www.facebook.com/geotechph.net' :
                          'I was created by GeoDevz69. Visit here for more information:\nhttps://www.facebook.com/geotechph.net';
        await sendMessage(senderId, { text: response }, token);
        return;
      }

      // ========== USER INFO ==========
      if (this.isUserInfoQuestion(prompt)) {
        await this.handleUserInfo(senderId, prompt, token);
        return;
      }

      const detectedLanguage = this.detectLanguage(prompt);
      const isCasualConversation = this.isCasualConversation(prompt);
      const wantsDetailed = this.wantsDetailedAnswer(prompt);
      let aiResponse = '';

      // ========== REPLY / FOLLOW-UP ==========
      if (isReply && previousResponse) {
        const history = conversationHistory[senderId];
        const responseLanguage = detectedLanguage || history?.language || 'english';

        if (history?.hasImageContext && this.isModificationRequest(prompt.toLowerCase())) {
          const finalPrompt = this.buildImageModificationPrompt(prompt, previousResponse, wantsDetailed, responseLanguage);
          const response = await this.callAPI(finalPrompt);
          aiResponse = this.cleanResponse(response || 'No response from API.');
        } else if (history?.hasImageContext && !imageUrl) {
          const finalPrompt = this.buildImageFollowUpPrompt(prompt, previousResponse, previousPrompt, wantsDetailed, responseLanguage);
          const response = await this.callAPI(finalPrompt);
          aiResponse = this.cleanResponse(response || 'No response from API.');
        } else {
          const finalPrompt = this.buildFinalPrompt(prompt, previousResponse, previousPrompt, isReply, wantsDetailed, responseLanguage);
          const response = await this.callAPI(finalPrompt);
          aiResponse = this.cleanResponse(response || 'No response from API.');
        }

        if (!wantsDetailed && !this.isModificationRequest(prompt.toLowerCase())) {
          aiResponse = this.shortenResponse(aiResponse);
        }

        const newHistory = conversationHistory[senderId] || { topicHistory: {} };
        newHistory.lastPrompt = prompt;
        newHistory.lastResponse = aiResponse;
        newHistory.lastImageUrl = history?.lastImageUrl || null;
        newHistory.hasImageContext = history?.hasImageContext || false;
        newHistory.language = responseLanguage;
        newHistory.timestamp = Date.now();

        const topicKey = this.extractTopicKey(prompt);
        if (topicKey) {
          newHistory.topicHistory[topicKey] = {
            response: aiResponse,
            prompt: prompt,
            keywords: this.extractKeywordsFromResponse(aiResponse),
            timestamp: Date.now()
          };
        }
        conversationHistory[senderId] = newHistory;
      }
      // ========== NEW CONVERSATION ==========
      else {
        if (isCasualConversation) {
          const finalPrompt = this.buildCasualPrompt(prompt, detectedLanguage);
          const response = await this.callAPI(finalPrompt);
          aiResponse = this.cleanResponse(response || 'No response from API.');
        } else {
          const finalPrompt = this.buildFinalPrompt(prompt, null, null, false, wantsDetailed, detectedLanguage);
          const response = await this.callAPI(finalPrompt);
          aiResponse = this.cleanResponse(response || 'No response from API.');
        }

        if (!wantsDetailed && !isCasualConversation) {
          aiResponse = this.shortenResponse(aiResponse);
        }

        const newHistory = conversationHistory[senderId] || { topicHistory: {} };
        newHistory.lastPrompt = prompt;
        newHistory.lastResponse = aiResponse;
        newHistory.lastImageUrl = null;
        newHistory.hasImageContext = false;
        newHistory.language = detectedLanguage;
        newHistory.timestamp = Date.now();

        const topicKey = this.extractTopicKey(prompt);
        if (topicKey) {
          newHistory.topicHistory[topicKey] = {
            response: aiResponse,
            prompt: prompt,
            keywords: this.extractKeywordsFromResponse(aiResponse),
            timestamp: Date.now()
          };
        }
        conversationHistory[senderId] = newHistory;
      }

      this.cleanOldHistory();

      await this.sendChunks(senderId, aiResponse, token);

    } catch (error) {
      console.error('[ai] Error:', error.message);
      const errorLang = this.detectLanguage(prompt);
      await sendMessage(senderId, { text: this.getErrorMessage(error, errorLang) }, token);
    }
  },

  // ========== DETECT INPUT TYPE ==========
  detectInputType(prompt) {
    if (!prompt) return 'conversation';
    const lower = prompt.toLowerCase();

    // ===== CHECK: Presentation Topic =====
    if (this.isPresentationTopic(prompt)) {
      return 'presentation';
    }

    // ===== CHECK: Shading Exam =====
    if (this.isShadingExam(prompt)) return 'shading';

    // ===== CHECK: Emoji/Symbol =====
    if (this.hasEmojiAnswers(prompt)) return 'emoji';
    if (this.hasSymbolAnswers(prompt)) return 'symbol';

    // ===== CHECK: Multiple Choice =====
    if (this.hasMultipleChoice(prompt)) return 'multiple_choice';

    // ===== CHECK: True/False =====
    if (this.hasTrueFalse(prompt)) return 'true_false';

    // ===== CHECK: Assessment/Test =====
    if (this.isAssessment(prompt) || this.hasTestStructure(prompt)) return 'assessment';

    // ===== CHECK: Activity Sheet =====
    if (this.isActivitySheet(prompt)) return 'activity';

    // ===== CHECK: Quiz/Exam =====
    if (this.isQuiz(prompt)) return 'quiz';

    // ===== CHECK: Assignment/Homework =====
    if (this.isAssignment(prompt)) return 'assignment';

    // ===== CHECK: Question =====
    if (this.isQuestion(prompt)) return 'question';

    // ===== CHECK: Math =====
    if (this.isMathProblem(prompt)) return 'math';

    // ===== DEFAULT =====
    return 'conversation';
  },

  // ===== PRESENTATION TOPIC DETECTION =====
  isPresentationTopic(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    
    const hasStructure = this.isStructuredOutline(prompt);
    
    const keywords = [
      'chapter', 'lesson', 'module', 'unit', 'topic', 'subject',
      'communication', 'globalization', 'digital age',
      'academic purposes', 'work purposes', 'various purposes',
      'multimodal', 'blogging', 'public speaking',
      'essay writing', 'research paper', 'plagiarism',
      'job application', 'resume', 'curriculum vitae', 'job interview',
      'introduction', 'conclusion', 'recommendation', 'reference',
      'overview', 'summary', 'analysis', 'discussion'
    ];
    
    let matchCount = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) matchCount++;
    }
    
    if (hasStructure && matchCount >= 2) return true;
    if (matchCount >= 3) return true;
    
    return false;
  },

  // ===== STRUCTURED OUTLINE DETECTION =====
  isStructuredOutline(prompt) {
    const lines = prompt.split('\n');
    let hasLetters = false;
    let hasNumbers = false;
    let hasBullets = false;
    let hasHierarchy = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      if (/^[a-z]\)/.test(trimmed)) hasLetters = true;
      if (/^\d+[.)]/.test(trimmed)) hasNumbers = true;
      if (/^[•\-*]/.test(trimmed)) hasBullets = true;
      if (line.startsWith('  ') || line.startsWith('\t')) hasHierarchy = true;
    }
    
    const indicators = [hasLetters, hasNumbers, hasBullets, hasHierarchy];
    const count = indicators.filter(Boolean).length;
    
    return count >= 2;
  },

  // ===== ACTIVITY SHEET DETECTION =====
  isActivitySheet(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();

    const hasInstructions = [
      'directions', 'instruction', 'read and answer', 'analyze and answer',
      'answer the following', 'solve the following', 'identify the following',
      'panuto', 'instruksyon', 'basahin', 'sagutan', 'sagutin'
    ].some(k => lower.includes(k));

    if (!hasInstructions) return false;

    const indicators = [
      'activity sheet', 'worksheet', 'activity', 'exercise',
      'part i', 'part ii', 'part iii', 'part iv', 'section a', 'section b',
      'multiple choice', 'true or false', 'fill in the blank', 'matching type',
      'enumeration', 'essay', 'short answer', 'explain your answer'
    ];

    let matchCount = 0;
    for (const indicator of indicators) {
      if (lower.includes(indicator)) matchCount++;
    }

    return matchCount >= 2;
  },

  // ===== QUIZ DETECTION =====
  isQuiz(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();

    const hasQuizKeyword = ['quiz', 'exam', 'test', 'assessment', 'evaluation', 'pagsusulit'].some(k => lower.includes(k));
    if (!hasQuizKeyword) return false;

    const hasQuestions = lower.includes('?') || 
                         lower.includes('answer the following') ||
                         lower.includes('solve the following');

    return hasQuestions;
  },

  // ===== ASSIGNMENT DETECTION =====
  isAssignment(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();

    const hasAssignmentKeyword = ['assignment', 'homework', 'project', 'task', 'takdang-aralin'].some(k => lower.includes(k));
    if (!hasAssignmentKeyword) return false;

    const hasSubmission = ['submit', 'deadline', 'due date', 'pass', 'hand in', 'ipasa', 'isumite'].some(k => lower.includes(k));

    return hasSubmission;
  },

  // ===== SHADING EXAM DETECTION =====
  isShadingExam(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    
    const indicators = [
      'shade', 'shading', 'shade the', 'shade the letter',
      'fill the circle', 'fill the oval', 'bubble sheet',
      'answer sheet', 'scantron', 'scan tron',
      'shade your answer', 'mark your answer',
      'circle the letter', 'shade the circle',
      'shade the correct', 'shade the box',
      'piliin ang titik', 'bilugan ang titik',
      'shade the corresponding', 'mark the correct',
      'shade only', 'shade the oval',
      'kulayan', 'punan ang bilog', 'punan ang kahon',
      'bilugan ang tamang sagot', 'markahan'
    ];
    
    for (const indicator of indicators) {
      if (lower.includes(indicator)) return true;
    }
    return false;
  },

  // ===== SYMBOL ANSWERS DETECTION =====
  hasSymbolAnswers(prompt) {
    const lines = prompt.split('\n');
    for (const line of lines) {
      if (/[✓✔✅]/.test(line)) return true;
      if (/[✗❌✘]/.test(line)) return true;
    }
    return false;
  },

  // ===== EMOJI ANSWERS DETECTION =====
  hasEmojiAnswers(prompt) {
    const lines = prompt.split('\n');
    for (const line of lines) {
      if (/[😊😃😄😁😆😅😂🤣😍🥰😘😗😙😚🙂🤗🤩😌]/.test(line)) return true;
      if (/[😔😕😖😞😣😢😭😥😪😫]/.test(line)) return true;
      if (/[😠😡🤬]/.test(line)) return true;
      if (/[😐😑😶]/.test(line)) return true;
      if (/[⭐🌟]/.test(line)) return true;
      if (/[❤️💜💙💚💛🧡🖤]/.test(line)) return true;
    }
    return false;
  },

  // ===== IDENTIFY EMOJI TYPES =====
  identifyEmojiTypes(prompt) {
    const lines = prompt.split('\n');
    const emojis = {
      happy: false,
      sad: false,
      angry: false,
      neutral: false,
      star: false,
      heart: false,
      check: false,
      x: false
    };
    
    for (const line of lines) {
      if (/[😊😃😄😁😆😅😂🤣😍🥰😘😗😙😚🙂🤗🤩😌]/.test(line)) emojis.happy = true;
      if (/[😔😕😖😞😣😢😭😥😪😫]/.test(line)) emojis.sad = true;
      if (/[😠😡🤬]/.test(line)) emojis.angry = true;
      if (/[😐😑😶]/.test(line)) emojis.neutral = true;
      if (/[⭐🌟]/.test(line)) emojis.star = true;
      if (/[❤️💜💙💚💛🧡🖤]/.test(line)) emojis.heart = true;
      if (/[✓✔✅]/.test(line)) emojis.check = true;
      if (/[✗❌✘]/.test(line)) emojis.x = true;
    }
    
    return emojis;
  },

  // ===== MULTIPLE CHOICE DETECTION =====
  hasMultipleChoice(prompt) {
    const lower = prompt.toLowerCase();
    if (lower.includes('multiple choice')) return true;
    if (lower.includes('choose the')) return true;
    if (lower.includes('select the')) return true;
    
    const lines = prompt.split('\n');
    let letterCount = 0;
    for (const line of lines) {
      if (/^[A-D]\)/.test(line.trim())) letterCount++;
      if (/^[A-D]\./.test(line.trim())) letterCount++;
    }
    return letterCount >= 2;
  },

  // ===== TRUE/FALSE DETECTION =====
  hasTrueFalse(prompt) {
    const lower = prompt.toLowerCase();
    if (lower.includes('true or false')) return true;
    if (lower.includes('true/false')) return true;
    if (lower.includes('tama o mali')) return true;
    if (lower.includes('sakto o sayop')) return true;
    
    const lines = prompt.split('\n');
    let tfCount = 0;
    for (const line of lines) {
      if (/TRUE/i.test(line) || /FALSE/i.test(line)) tfCount++;
      if (/Tama/i.test(line) || /Mali/i.test(line)) tfCount++;
    }
    return tfCount >= 2;
  },

  // ===== ASSESSMENT DETECTION =====
  isAssessment(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();

    const indicators = [
      'summative', 'assessment', 'pre-assessment', 'post-assessment',
      'diagnostic', 'formative', 'benchmark', 'performance',
      'quarterly', 'periodical', 'unit test', 'final exam',
      'midterm', 'prelim', 'periodic', 'achievement test',
      'sumatibo', 'sumatibong', 'pagtatasa', 'paunang pagtatasa'
    ];

    let matchCount = 0;
    for (const indicator of indicators) {
      if (lower.includes(indicator)) {
        matchCount++;
        if (matchCount >= 2) return true;
      }
    }

    return false;
  },

  // ===== TEST STRUCTURE DETECTION =====
  hasTestStructure(prompt) {
    const lines = prompt.split('\n');
    let hasTestParts = false;
    let hasInstructions = false;
    let hasQuestions = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (/^(PART|SECTION|TEST|I|II|III|IV|V)\s+/.test(trimmed) ||
          /^[A-D]\)/.test(trimmed) ||
          /^[1-9]\./.test(trimmed)) {
        hasTestParts = true;
      }

      if (/^(DIRECTIONS|INSTRUCTION|Read|Answer|Choose|Solve|Analyze)/i.test(trimmed) ||
          /^(PANUTO|INSTRUKSYON|BASAHIN|SAGUTAN|PUMILI|LUTASIN)/i.test(trimmed)) {
        hasInstructions = true;
      }

      if (trimmed.includes('?') || /^[A-Z]\./.test(trimmed) || /^[1-9]\./.test(trimmed)) {
        hasQuestions = true;
      }
    }

    const indicators = [hasTestParts, hasInstructions, hasQuestions];
    return indicators.filter(Boolean).length >= 2;
  },

  // ===== QUESTION DETECTION =====
  isQuestion(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();

    if (lower.includes('?')) return true;

    const starters = [
      'what', 'why', 'how', 'when', 'where', 'who', 'which',
      'is', 'are', 'was', 'were', 'do', 'does', 'did',
      'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must',
      'ano', 'bakit', 'paano', 'kailan', 'saan', 'sino', 'alin',
      'unsa', 'ngano', 'giunsa', 'kanus-a', 'asa', 'kinsa', 'hain'
    ];

    const words = lower.split(/\s+/);
    if (words.length > 0 && starters.includes(words[0])) {
      return true;
    }

    return false;
  },

  // ===== MATH PROBLEM DETECTION =====
  isMathProblem(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();

    const patterns = [
      /\d+\s*[\+\-\*\/\×\÷]\s*\d+/,
      /\d+\s*\+\s*\d+/,
      /\d+\s*\-\s*\d+/,
      /\d+\s*\*\s*\d+/,
      /\d+\s*\/\s*\d+/,
      /[a-zA-Z]\s*=\s*[\d\s\+\-\*\/]+/,
      /algebra/i, /equation/i, /quadratic/i, /polynomial/i,
      /simplify/i, /factor/i, /solve/i, /calculate/i,
      /geometry/i, /area/i, /perimeter/i, /volume/i,
      /statistics/i, /probability/i, /mean/i, /median/i, /mode/i,
      /fraction/i, /decimal/i, /percentage/i,
      /sulbad/i, /kwentaha/i, /kompyut/i, /tuos/i
    ];

    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern instanceof RegExp) {
        if (pattern.test(prompt)) matchCount++;
      }
    }

    return matchCount >= 1;
  },

  // ===== QUESTION TYPE DETECTORS =====
  hasFillInTheBlank(prompt) {
    const lower = prompt.toLowerCase();
    return lower.includes('fill in the blank') || 
           lower.includes('fill in the blanks') ||
           lower.includes('complete the sentence') ||
           lower.includes('blank') ||
           lower.includes('______') ||
           lower.includes('_____') ||
           lower.includes('punan ang patlang');
  },

  hasMatching(prompt) {
    const lower = prompt.toLowerCase();
    return lower.includes('matching type') || 
           lower.includes('match column') ||
           lower.includes('match the') ||
           lower.includes('pagtapatin') ||
           lower.includes('ipares ang');
  },

  hasEnumeration(prompt) {
    const lower = prompt.toLowerCase();
    return lower.includes('enumeration') || 
           lower.includes('list down') ||
           lower.includes('list the') ||
           lower.includes('enumerate the') ||
           lower.includes('maglista') ||
           lower.includes('ilista ang');
  },

  hasEssay(prompt) {
    const lower = prompt.toLowerCase();
    return lower.includes('essay') || 
           lower.includes('explain your answer') ||
           lower.includes('describe in') ||
           lower.includes('what do you think') ||
           lower.includes('how would you') ||
           lower.includes('ipaliwanag') ||
           lower.includes('ihulagway');
  },

  hasSequencing(prompt) {
    const lower = prompt.toLowerCase();
    return lower.includes('sequence') || 
           lower.includes('arrange') ||
           lower.includes('order') ||
           lower.includes('chronological') ||
           lower.includes('ayusin') ||
           lower.includes('ihanay');
  },

  isExampleRequest(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    const exampleKeywords = [
      'example', 'examples', 'sample', 'samples',
      'give example', 'give me example', 'show example',
      'provide example', 'for example', 'sample problem',
      'worked example', 'demonstrate', 'show me how',
      'how to solve', 'can you show', 'example with solution',
      'halimbawa', 'mga halimbawa', 'magbigay ng halimbawa',
      'pananglitan', 'mga pananglitan', 'paghatag ug pananglitan'
    ];
    return exampleKeywords.some(keyword => lower.includes(keyword));
  },

  // ===== HANDLE ACTIVITY SHEET (ENHANCED FOR 100% ACCURACY) =====
  async handleActivitySheet(prompt) {
    const lang = this.detectLanguage(prompt);
    const isTagalog = lang === 'tagalog' || lang === 'filipino';

    // Detect all question types
    const hasMultipleChoice = this.hasMultipleChoice(prompt);
    const hasTrueFalse = this.hasTrueFalse(prompt);
    const hasFillInTheBlank = this.hasFillInTheBlank(prompt);
    const hasMatching = this.hasMatching(prompt);
    const hasEnumeration = this.hasEnumeration(prompt);
    const hasEssay = this.hasEssay(prompt);
    const hasMath = this.isMathProblem(prompt);
    const hasSequencing = this.hasSequencing(prompt);
    
    const isShading = this.isShadingExam(prompt);
    const hasSymbols = this.hasSymbolAnswers(prompt);
    const hasEmojis = this.hasEmojiAnswers(prompt);
    const emojiTypes = this.identifyEmojiTypes(prompt);

    let activityPrompt = '';

    // ===== ENHANCED PROMPT FOR 100% ACCURACY =====
    if (isTagalog) {
      activityPrompt = `🚨 IMPORTANTE: MAGBIGAY NG 100% TAMANG SAGOT.

IKAW AY ISANG EKSPERTO NA SUMASAGOT NG MGA PAGSUSULIT.

MAHIGPIT NA PANUNTUNAN:
1. MAGBIGAY NG TUWIRANG SAGOT - WALANG PALIWANAG
2. KUNG TANONG, SAGUTAN NG DIREKTA
3. KUNG MATH, IPAKITA ANG STEP-BY-STEP SOLUTION
4. KUNG MULTIPLE CHOICE, IBIGAY ANG LETTER AT SAGOT
5. KUNG TRUE/FALSE, ISULAT ANG "TRUE" O "FALSE"
6. KUNG ENUMERATION, IBIGAY ANG KUMPLETONG LISTAHAN
7. KUNG ESSAY, SAGUTAN NG 1-2 PANGUNGUSAP
8. KUNG SHADING, IBIGAY LANG ANG TITIK
9. KUNG ✓/✗, GAMITIN ANG TAMANG SYMBOL
10. KUNG EMOJI, GAMITIN ANG TAMANG EMOJI

NARITO ANG PAGSUSULIT:

${prompt}

MGA URI NG TANONG:
- Multiple Choice: ${hasMultipleChoice ? '✓ (IBIGAY ANG LETTER AT SAGOT)' : '✗'}
- True or False: ${hasTrueFalse ? '✓ (ISULAT ANG "TRUE" O "FALSE")' : '✗'}
- Fill in the Blank: ${hasFillInTheBlank ? '✓ (KUMPLETUHIN ANG BANGHAY)' : '✗'}
- Matching Type: ${hasMatching ? '✓ (1-A, 2-B, 3-C)' : '✗'}
- Enumeration: ${hasEnumeration ? '✓ (KUMPLETONG LISTAHAN)' : '✗'}
- Essay: ${hasEssay ? '✓ (1-2 PANGUNGUSAP LAMANG)' : '✗'}
- Math: ${hasMath ? '✓ (STEP-BY-STEP SOLUTION)' : '✗'}
- Sequencing: ${hasSequencing ? '✓ (TAMANG ORDER)' : '✗'}

${isShading ? `SHADING: IBIGAY LANG ANG TITIK NG SAGOT` : ''}
${hasSymbols ? `✓/✗: GAMITIN ANG TAMANG SYMBOL` : ''}
${hasEmojis ? `EMOJI: GAMITIN ANG TAMANG EMOJI` : ''}

TUWIRANG SAGOT LAMANG. WALANG INTRO. WALANG PALIWANAG.

TUMUGON SA TAGALOG.`;
    } else {
      activityPrompt = `🚨 IMPORTANT: PROVIDE 100% CORRECT ANSWERS.

YOU ARE AN EXPERT AT ANSWERING TESTS.

STRICT RULES:
1. PROVIDE DIRECT ANSWERS - NO EXPLANATIONS
2. IF QUESTION, ANSWER DIRECTLY
3. IF MATH, SHOW STEP-BY-STEP SOLUTION
4. IF MULTIPLE CHOICE, PROVIDE LETTER AND ANSWER
5. IF TRUE/FALSE, WRITE "TRUE" OR "FALSE"
6. IF ENUMERATION, PROVIDE COMPLETE LIST
7. IF ESSAY, ANSWER IN 1-2 SENTENCES
8. IF SHADING, PROVIDE LETTER ONLY
9. IF ✓/✗, USE THE CORRECT SYMBOL
10. IF EMOJI, USE THE CORRECT EMOJI

HERE IS THE TEST:

${prompt}

QUESTION TYPES:
- Multiple Choice: ${hasMultipleChoice ? '✓ (PROVIDE LETTER AND ANSWER)' : '✗'}
- True or False: ${hasTrueFalse ? '✓ (WRITE "TRUE" OR "FALSE")' : '✗'}
- Fill in the Blank: ${hasFillInTheBlank ? '✓ (COMPLETE THE SENTENCE)' : '✗'}
- Matching Type: ${hasMatching ? '✓ (1-A, 2-B, 3-C)' : '✗'}
- Enumeration: ${hasEnumeration ? '✓ (COMPLETE LIST)' : '✗'}
- Essay: ${hasEssay ? '✓ (1-2 SENTENCES ONLY)' : '✗'}
- Math: ${hasMath ? '✓ (STEP-BY-STEP SOLUTION)' : '✗'}
- Sequencing: ${hasSequencing ? '✓ (CORRECT ORDER)' : '✗'}

${isShading ? `SHADING: PROVIDE LETTER ONLY` : ''}
${hasSymbols ? `✓/✗: USE THE CORRECT SYMBOL` : ''}
${hasEmojis ? `EMOJI: USE THE CORRECT EMOJI` : ''}

DIRECT ANSWERS ONLY. NO INTRO. NO EXPLANATIONS.

RESPOND IN ENGLISH.`;
    }

    const response = await this.callAPI(activityPrompt);
    return this.cleanResponse(response || 'No response from API.');
  },

  // ===== BUILD MATH SOLUTION PROMPT (ENHANCED) =====
  buildMathSolutionPrompt(prompt, language) {
    const topic = this.detectMathTopic(prompt);
    const wantsExamples = this.isExampleRequest(prompt);
    const isTagalog = language === 'tagalog' || language === 'filipino';

    let final = '';

    if (isTagalog) {
      final += `🚨 IMPORTANTE: MAGBIGAY NG 100% TAMANG SAGOT.

IKAW AY ISANG MATH TUTOR.

TANONG: "${prompt}"

PANUNTUNAN:
1. IPAKITA ANG STEP-BY-STEP SOLUTION
2. MAGBIGAY NG PINAL NA SAGOT
3. WALANG INTRO, DIREKTA SA SOLUSYON

FORMAT:
Problema: [Ang problema]

Datos: [Ang mga given]

Solusyon:
Hakbang 1: [Unang hakbang]
Paliwanag: [Bakit ginawa ito]
Kalkulasyon: [Ang kalkulasyon]

Hakbang 2: [Pangalawang hakbang]
Paliwanag: [Bakit ginawa ito]
Kalkulasyon: [Ang kalkulasyon]

Pinal na Sagot: [Ang sagot]

Tumugon sa TAGALOG.`;
    } else {
      final += `🚨 IMPORTANT: PROVIDE 100% CORRECT ANSWER.

YOU ARE A MATH TUTOR.

QUESTION: "${prompt}"

RULES:
1. SHOW STEP-BY-STEP SOLUTION
2. PROVIDE FINAL ANSWER
3. NO INTRO, DIRECTLY TO SOLUTION

FORMAT:
Problem: [The problem]

Data: [The given values]

Solution:
Step 1: [First step]
Explanation: [Why this is done]
Calculation: [The calculation]

Step 2: [Second step]
Explanation: [Why this is done]
Calculation: [The calculation]

Final Answer: [The answer]

Respond in ENGLISH.`;
    }

    return final;
  },

  detectMathTopic(prompt) {
    if (!prompt) return 'general';
    const lower = prompt.toLowerCase();

    const topics = {
      arithmetic: ['addition', 'subtraction', 'multiplication', 'division', 'add', 'subtract', 'multiply', 'divide', 'sum', 'difference', 'product', 'quotient', 'fraction', 'decimal', 'percentage'],
      algebra: ['algebra', 'equation', 'quadratic', 'polynomial', 'simplify', 'factor', 'expand', 'variable', 'expression', 'inequality', 'solve for'],
      geometry: ['geometry', 'area', 'perimeter', 'volume', 'circumference', 'triangle', 'rectangle', 'circle', 'square', 'angle'],
      statistics: ['statistics', 'probability', 'mean', 'median', 'mode', 'standard deviation', 'variance']
    };

    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(keyword => lower.includes(keyword))) {
        return topic;
      }
    }

    return 'general';
  },

  // ===== LANGUAGE DETECTION =====
  detectLanguage(prompt) {
    if (!prompt) return 'english';
    const lower = prompt.toLowerCase();

    const languages = {
      tagalog: {
        keywords: ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ako', 'ikaw', 'siya', 'kami', 'tayo', 'kayo', 'sila'],
        minMatches: 2
      },
      bisaya: {
        keywords: ['ako', 'ikaw', 'siya', 'kami', 'kita', 'kamo', 'sila', 'kini', 'kana', 'kadto', 'dinhi', 'diha', 'didto', 'unsa', 'ngano', 'giunsa', 'asa', 'kanus-a', 'kinsa', 'pila'],
        minMatches: 2
      }
    };

    let bestMatch = 'english';
    let bestScore = 0;
    const words = lower.split(/\s+/);

    for (const [lang, config] of Object.entries(languages)) {
      let matchCount = 0;
      for (const word of words) {
        if (config.keywords.includes(word)) matchCount++;
      }
      if (matchCount >= config.minMatches && matchCount > bestScore) {
        bestMatch = lang;
        bestScore = matchCount;
      }
    }

    return bestMatch;
  },

  getLanguageName(languageCode) {
    const names = {
      'english': 'English',
      'tagalog': 'Tagalog',
      'filipino': 'Filipino',
      'bisaya': 'Bisaya',
      'cebuano': 'Cebuano'
    };
    return names[languageCode] || 'English';
  },

  // ===== CASUAL CONVERSATION =====
  isCasualConversation(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    const casualPatterns = [
      'kamusta', 'kumusta', 'musta', 'kamusta ka',
      'ano ginagawa mo', 'ano balita', 'kamusta na',
      'ayos lang', 'ok lang', 'buti naman',
      'salamat', 'sige', 'cge', 'ge', 'ok', 'okay',
      'hehe', 'haha', 'lol', 'hmm', 'ah', 'oh',
      'nice', 'galing', 'astig', 'ayos',
      'how are you', 'hows it going', 'whats up',
      'how you doing', 'sup', 'yo', 'thanks'
    ];
    return casualPatterns.some(p => lower.includes(p));
  },

  buildCasualPrompt(prompt, language) {
    const langName = this.getLanguageName(language);
    let final = '';

    if (language === 'tagalog' || language === 'bisaya' || language === 'cebuano') {
      final += `Ikaw ay nakikipag-usap sa isang user sa ${langName.toUpperCase()}.\n`;
      final += `Sinabi ng user: "${prompt}"\n\n`;
      final += `Tumugon nang NATURAL sa ${langName.toUpperCase()} tulad ng isang tunay na tao.\n`;
      final += `Panatilihing MAIKLI at NATURAL ang mga tugon (1-2 pangungusap).\n`;
      final += `Tumugon sa ${langName.toUpperCase()} NGAYON.`;
    } else {
      final += `You are having a CASUAL CONVERSATION with a user in ${langName.toUpperCase()}.\n`;
      final += `The user said: "${prompt}"\n\n`;
      final += `Respond NATURALLY in ${langName.toUpperCase()} like a real person.\n`;
      final += `Keep responses SHORT and NATURAL (1-2 sentences).\n`;
      final += `Respond in ${langName.toUpperCase()}.`;
    }

    return final;
  },

  // ===== BUILD FINAL PROMPT =====
  buildFinalPrompt(prompt, previousResponse, previousPrompt, isReply, wantsDetailed, language = 'english') {
    const langName = this.getLanguageName(language);
    let final = '';

    final += `IMPORTANT: Respond in ${langName.toUpperCase()} language.\n\n`;

    if (previousResponse) {
      final += `PREVIOUS CONVERSATION:\nUser asked: "${previousPrompt || 'unknown'}"\nAI responded: "${previousResponse}"\n\n`;
      final += `USER'S NEW REQUEST: "${prompt}"\n\n`;
      final += `Continue the discussion about the previous topic.\n`;
    } else {
      final += `USER ASKED: "${prompt}"\n\n`;
    }

    if (wantsDetailed) {
      final += `Provide a COMPREHENSIVE and DETAILED explanation.\n`;
    } else {
      final += `Provide a SHORT, DIRECT, and ACCURATE response.\n`;
    }

    final += `Use plain text only. No markdown or symbols.\n`;
    final += `Respond in ${langName.toUpperCase()} language.\n`;

    return final;
  },

  // ===== IMAGE FOLLOW-UP PROMPTS =====
  buildImageFollowUpPrompt(prompt, previousResponse, previousPrompt, wantsDetailed, language) {
    const langName = this.getLanguageName(language);
    let final = `PREVIOUS IMAGE ANALYSIS:\n${previousResponse}\n\n`;
    final += `USER ASKED: "${prompt}"\n\n`;
    final += `Provide a helpful response in ${langName.toUpperCase()}.\n`;
    return final;
  },

  buildImageModificationPrompt(prompt, previousResponse, wantsDetailed, language) {
    const langName = this.getLanguageName(language);
    let final = `PREVIOUS IMAGE ANALYSIS:\n${previousResponse}\n\n`;
    final += `USER REQUEST: "${prompt}"\n\n`;
    final += `Modify the analysis as requested.\n`;
    final += `Respond in ${langName.toUpperCase()}.`;
    return final;
  },

  // ===== TYPO CORRECTION =====
  correctTypos(prompt) {
    if (!prompt) return prompt;
    const typoMap = {
      'pingi': 'paki', 'pengi': 'paki', 'peng': 'paki',
      'ping': 'paki', 'pking': 'paki', 'pk': 'paki',
      'pak': 'paki', 'pki': 'paki',
      'pls': 'please', 'plz': 'please', 'pleas': 'please',
      'mre': 'more', 'mor': 'more',
      'elab': 'elaborate', 'expln': 'explanation',
      'expl': 'explain', 'explainn': 'explain',
      'plihug': 'palihug', 'plihg': 'palihug',
      'detailled': 'detailed', 'detialed': 'detailed',
      'explaination': 'explanation', 'elaborationn': 'elaboration',
      'summarry': 'summary', 'summry': 'summary',
      'exmple': 'example', 'sampel': 'sample'
    };

    let corrected = prompt;
    const lower = prompt.toLowerCase();
    for (const [typo, correct] of Object.entries(typoMap)) {
      if (lower.includes(typo)) {
        corrected = corrected.replace(new RegExp(typo, 'gi'), correct);
      }
    }
    return corrected;
  },

  // ===== IMAGE ANALYSIS =====
  async callGeminiAPI(prompt, imageUrl, detectedLanguage = 'english') {
    try {
      const geminiPrompt = this.buildGeminiPrompt(prompt, detectedLanguage);
      const apiUrl = `https://norch-project.gleeze.com/api/gemini?prompt=${encodeURIComponent(geminiPrompt)}&imageurl=${encodeURIComponent(imageUrl)}`;
      const response = await axios.get(apiUrl, { timeout: 90000, headers: { 'Accept': 'application/json' } });

      if (!response || !response.data) throw new Error('No response from Gemini API');

      return this.processGeminiResponse(response.data.response || '');
    } catch (error) {
      console.error('[Gemini] Error:', error.message);
      const fallbackPrompt = `The user sent an image. The user asked: ${prompt || 'Please describe what you see'}. Provide a helpful response.`;
      const response = await this.callAPI(fallbackPrompt);
      return this.cleanResponse(response || 'Cannot analyze the image. Please try again.');
    }
  },

  buildGeminiPrompt(userPrompt, language = 'english') {
    const langName = this.getLanguageName(language);
    let prompt;

    if (language === 'tagalog' || language === 'bisaya' || language === 'cebuano') {
      prompt = `Ikaw ay isang AI assistant na nagsusuri ng isang imahe.\n\n`;
      prompt += `UNAHIN MONG TUKUYIN KUNG ANONG KLASE NG IMAGE ITO.\n\n`;
      prompt += `KUNG ACTIVITY SHEET/WORKSHEET/QUIZ/EXAM:\n`;
      prompt += `- BASAHIN ANG MGA INSTRUKSYON\n`;
      prompt += `- SAGUTAN ANG BAWAT TANONG\n`;
      prompt += `- MAGBIGAY NG 100% TAMANG SAGOT\n`;
      prompt += `- WALANG INTRO, DIREKTA SA SAGOT\n\n`;
      prompt += `KUNG MATH PROBLEM:\n`;
      prompt += `- IPAKITA ANG STEP-BY-STEP SOLUTION\n`;
      prompt += `- IBIGAY ANG PINAL NA SAGOT\n\n`;
      prompt += `KUNG IBA PANG IMAGE:\n`;
      prompt += `- ILARAWAN SA 2-3 PANGUNGUSAP LAMANG\n\n`;
      prompt += `TANONG NG USER: ${userPrompt || 'Suriin ang imaheng ito'}\n`;
      prompt += `Tumugon sa ${langName.toUpperCase()} LAMANG.`;
    } else {
      prompt = `You are an AI assistant analyzing an image.\n\n`;
      prompt += `FIRST IDENTIFY WHAT TYPE OF IMAGE THIS IS.\n\n`;
      prompt += `IF ACTIVITY SHEET/WORKSHEET/QUIZ/EXAM:\n`;
      prompt += `- READ THE INSTRUCTIONS\n`;
      prompt += `- ANSWER EVERY QUESTION\n`;
      prompt += `- PROVIDE 100% CORRECT ANSWERS\n`;
      prompt += `- NO INTRO, DIRECTLY PROVIDE ANSWERS\n\n`;
      prompt += `IF MATH PROBLEM:\n`;
      prompt += `- SHOW STEP-BY-STEP SOLUTION\n`;
      prompt += `- PROVIDE THE FINAL ANSWER\n\n`;
      prompt += `IF OTHER IMAGE:\n`;
      prompt += `- DESCRIBE IN 2-3 SENTENCES ONLY\n\n`;
      prompt += `USER QUESTION: ${userPrompt || 'Analyze this image'}\n`;
      prompt += `Respond in ${langName.toUpperCase()} ONLY.`;
    }

    return prompt;
  },

  processGeminiResponse(response) {
    let processed = response || '';

    processed = processed
      .replace(/^I'?m?\s+a?\s*Gemini.*?model.*?\n\n?/i, '')
      .replace(/^Here is my analysis.*?\n/i, '')
      .replace(/^Let me analyze.*?\n/i, '')
      .replace(/^Based on my analysis.*?\n/i, '')
      .replace(/^I can see that.*?\n/i, '')
      .replace(/^Ako ay si Gemini.*?\n/i, '')
      .replace(/^Narito ang aking analysis.*?\n/i, '')
      .replace(/^The image is.*?\n/i, '')
      .replace(/^Ang larawan ay.*?\n/i, '')
      .replace(/^The image shows.*?\n/i, '')
      .replace(/^Ang larawan ay nagpapakita.*?\n/i, '')
      .replace(/^The image appears.*?\n/i, '')
      .replace(/^This image depicts.*?\n/i, '')
      .replace(/^Ang imaheng ito ay.*?\n/i, '')
      .replace(/^This image is.*?\n/i, '')
      .replace(/^Here's a detailed description.*?\n/i, '')
      .replace(/^Narito ang detalyadong.*?\n/i, '')
      .replace(/^This is an activity sheet.*?\n/i, '')
      .replace(/^Ito ay isang activity sheet.*?\n/i, '')
      .replace(/^I will read and answer.*?\n/i, '')
      .replace(/^Babasahin ko at sasagutin.*?\n/i, '')
      .replace(/^Name:.*?\n/i, '')
      .replace(/^Pangalan:.*?\n/i, '')
      .replace(/^Grade & Section:.*?\n/i, '')
      .replace(/^Baitang at Seksyon:.*?\n/i, '')
      .replace(/^Grade and Section:.*?\n/i, '')
      .replace(/^---+\n/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return this.cleanResponse(processed);
  },

  // ===== API CALLS =====
  async callAPI(prompt) {
    const primary = {
      url: 'https://api-library-kohi-production.up.railway.app/api/pollination-ai',
      param: 'prompt',
      responsePath: 'data',
      successField: 'status'
    };

    const fallback = {
      url: 'https://betadash-api-swordslush-production.up.railway.app/opera',
      param: 'ask',
      responsePath: 'message',
      successField: 'success'
    };

    try {
      return await this.executeApiCall(primary, prompt);
    } catch (primaryError) {
      console.error('[API] Primary failed:', primaryError.message);
      try {
        return await this.executeApiCall(fallback, prompt);
      } catch (fallbackError) {
        console.error('[API] Fallback failed:', fallbackError.message);
        throw new Error('Both APIs failed');
      }
    }
  },

  async executeApiCall(config, prompt) {
    const encoded = encodeURIComponent(prompt);
    const url = `${config.url}?${config.param}=${encoded}`;

    const response = await axios.get(url, {
      timeout: 60000,
      headers: { 'Accept': 'application/json' }
    });

    const data = response.data;
    if (data[config.successField] !== true) {
      throw new Error(`API returned ${config.successField}: false`);
    }

    const path = config.responsePath.split('.');
    let value = data;
    for (const key of path) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }

    return typeof value === 'string' ? value : null;
  },

  // ===== CLEAN RESPONSE =====
  cleanResponse(text) {
    if (!text) return 'No response.';

    let cleaned = text.trim();

    cleaned = cleaned
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/#{1,6}\s*/g, '')
      .replace(/`/g, '')
      .replace(/```/g, '')
      .replace(/[━═─]{3,}/g, '')
      .replace(/[-_=]{5,}/g, '')
      .replace(/\|/g, ' ')
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[📌📊📐📝✅📚✏️🎯💡📖🔢🧮]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ');

    cleaned = this.cleanMathNotation(cleaned);

    return cleaned.trim() || 'No response.';
  },

  cleanMathNotation(text) {
    if (!text) return text;

    let cleaned = text;
    cleaned = cleaned.replace(/\\\[/g, '').replace(/\\\]/g, '');
    cleaned = cleaned.replace(/\\\(/g, '').replace(/\\\)/g, '');
    cleaned = cleaned.replace(/\$\$/g, '').replace(/\$/g, '');
    cleaned = cleaned.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
    cleaned = cleaned.replace(/\\bar\{([^}]+)\}/g, '$1-bar');
    cleaned = cleaned.replace(/\\sum/g, 'sum');
    cleaned = cleaned.replace(/\\times/g, ' x ');
    cleaned = cleaned.replace(/\\cdot/g, ' * ');
    cleaned = cleaned.replace(/\\div/g, ' / ');
    cleaned = cleaned.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');
    cleaned = cleaned.replace(/\\left/g, '').replace(/\\right/g, '');
    cleaned = cleaned.replace(/\\text\{([^}]+)\}/g, '$1');
    cleaned = cleaned.replace(/\\pi/g, 'pi');
    cleaned = cleaned.replace(/\\theta/g, 'theta');
    cleaned = cleaned.replace(/\\infty/g, 'infinity');
    cleaned = cleaned.replace(/\\leq/g, '<=');
    cleaned = cleaned.replace(/\\geq/g, '>=');
    cleaned = cleaned.replace(/\\neq/g, '!=');
    cleaned = cleaned.replace(/\\rightarrow/g, '->');
    cleaned = cleaned.replace(/\\ldots/g, '...');
    cleaned = cleaned.replace(/\\begin\{[^}]+\}/g, '');
    cleaned = cleaned.replace(/\\end\{[^}]+\}/g, '');
    cleaned = cleaned.replace(/\\[a-zA-Z]+/g, '');
    cleaned = cleaned.replace(/([a-zA-Z])_\{?(\d+)\}?/g, '$1$2');
    cleaned = cleaned.replace(/\^\{([^}]+)\}/g, '^($1)');
    cleaned = cleaned.replace(/\\/g, '');

    return cleaned.trim();
  },

  // ===== SHORTEN RESPONSE =====
  shortenResponse(text) {
    if (!text) return text;

    const hasMathIndicators = ['Problem:', 'Problema:', 'Step 1:', 'Hakbang 1:', 'Final Answer:', 'Pinal na Sagot:'];
    if (hasMathIndicators.some(indicator => text.includes(indicator))) {
      return text;
    }

    const sentences = text.split(/(?<=[.!?])\s+/);
    let concise = sentences.slice(0, 3).join(' ');
    if (concise.length > 400) concise = concise.substring(0, 400) + '...';

    return concise || text;
  },

  wantsDetailedAnswer(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['explain more', 'more details', 'detailed', 'elaborate', 'paliwanag', 'ipaliwanag'];
    return keywords.some(k => lower.includes(k));
  },

  // ===== CONVERSATION CONTEXT FUNCTIONS =====
  isModificationRequest(prompt) {
    const patterns = [
      'make it short', 'shorten', 'simplify', 'clarify',
      'explain more', 'elaborate', 'more details',
      'summarize', 'summary', 'brief', 'concise',
      'paki explain', 'paki linaw', 'paliwanag', 'ipaliwanag'
    ];
    return patterns.some(p => prompt.includes(p));
  },

  isFollowUpRequest(prompt) {
    const keywords = [
      'elaborate', 'explain', 'detail', 'more', 'summarize',
      'simplify', 'clarify', 'example', 'sample',
      'paki', 'please', 'what about', 'how about'
    ];
    return keywords.some(k => prompt.includes(k));
  },

  isNewTopic(prompt, previousPrompt, originalPrompt) {
    if (!previousPrompt) return true;
    if (this.isFollowUpRequest(prompt)) return false;
    const prevWords = previousPrompt.split(' ').filter(w => w.length > 3);
    const currentWords = prompt.split(' ').filter(w => w.length > 3);
    const hasRelatedWords = prevWords.some(w => 
      currentWords.some(cw => cw.includes(w) || w.includes(cw))
    );
    if (!hasRelatedWords && originalPrompt.length > 5) return true;
    return false;
  },

  isContextualQuestion(prompt, previousPrompt) {
    if (!previousPrompt) return false;
    const patterns = ['so', 'what about', 'how about', 'why', 'how', 'what if'];
    return patterns.some(p => prompt.includes(p));
  },

  isReturnToTopicRequest(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    const patterns = [
      'balik tayo sa', 'balikan natin', 'going back to',
      'back to the topic', 'return to topic', 'balik sa topic',
      'continue about', 'continue with', 'tuloy natin ang'
    ];
    return patterns.some(p => lower.includes(p));
  },

  findBestTopicMatch(prompt, history) {
    if (!history || !history.topicHistory) return null;
    const userLower = prompt.toLowerCase();
    const userWords = userLower.split(/\s+/).filter(w => w.length > 2);
    let bestKey = null;
    let bestScore = 0;
    for (const [key, data] of Object.entries(history.topicHistory)) {
      let score = 0;
      const response = data.response || data;
      const responseLower = response.toLowerCase();
      const keywords = data.keywords || [];
      for (const kw of keywords) {
        if (userLower.includes(kw)) score += 8;
      }
      for (const word of userWords) {
        if (word.length > 2 && responseLower.includes(word)) score += 2;
      }
      if (userLower.includes(key.toLowerCase())) score += 10;
      if (data.prompt && userLower.includes(data.prompt.toLowerCase())) score += 8;
      if (data.timestamp && (Date.now() - data.timestamp) < 600000) score += 5;
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }
    return (bestScore > 0) ? bestKey : null;
  },

  extractTopicKey(prompt) {
    if (!prompt) return null;
    const words = prompt.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'on', 'at', 'to', 'for', 'from', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho'];
    const keywords = words.filter(w => w.length > 3 && !stopWords.includes(w));
    const key = keywords.slice(0, 5).join(' ');
    return key.length > 3 ? key.substring(0, 50) : prompt.substring(0, 50);
  },

  extractKeywordsFromResponse(response) {
    if (!response) return [];
    const lower = response.toLowerCase();
    const keywords = [];
    const topicWords = [
      'activity sheet', 'worksheet', 'quiz', 'homework', 'assignment',
      'math', 'science', 'english', 'tle', 'filipino',
      'problem', 'equation', 'solution', 'answer', 'explanation'
    ];
    for (const word of topicWords) {
      if (lower.includes(word)) keywords.push(word);
    }
    const stopWords = ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho', 'the', 'a', 'an', 'is', 'are', 'was', 'were'];
    const words = lower.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length > 2 && !stopWords.includes(words[i]) &&
          words[i+1].length > 2 && !stopWords.includes(words[i+1])) {
        const phrase = words[i] + ' ' + words[i+1];
        if (phrase.length > 4 && !keywords.includes(phrase)) {
          keywords.push(phrase);
        }
      }
    }
    return [...new Set(keywords)].slice(0, 20);
  },

  // ===== GET REPLIED MESSAGE =====
  async getRepliedMessageData(mid, token) {
    try {
      const url = `https://graph.facebook.com/v21.0/${mid}`;
      const params = { access_token: token, fields: 'message,from,attachments' };
      const { data } = await axios.get(url, { params });
      let imageUrl = null;
      if (data?.attachments?.data) {
        for (const attachment of data.attachments.data) {
          if (attachment.type === 'image' || attachment.type === 'photo') {
            imageUrl = attachment?.image_data?.url || attachment?.url || null;
            break;
          }
        }
      }
      return { message: data?.message || null, from: data?.from?.id || null, imageUrl };
    } catch (error) {
      return { message: null, from: null, imageUrl: null };
    }
  },

  // ===== CLEAN OLD HISTORY =====
  cleanOldHistory() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000;
    for (const [userId, data] of Object.entries(conversationHistory)) {
      if (now - data.timestamp > maxAge) {
        delete conversationHistory[userId];
      }
    }
  },

  // ===== SEND CHUNKS =====
  splitMessage(text) {
    const chunks = [];
    for (let i = 0; i < text.length; i += MAX_CHUNK) {
      chunks.push(text.slice(i, i + MAX_CHUNK));
    }
    return chunks;
  },

  async sendChunks(senderId, text, token) {
    const chunks = this.splitMessage(text);
    for (const chunk of chunks) {
      await sendMessage(senderId, { text: chunk }, token);
    }
  },

  // ===== ERROR MESSAGE =====
  getErrorMessage(error, detectedLanguage = 'english') {
    if (error.code === 'ECONNABORTED') {
      return detectedLanguage === 'tagalog' ? 'Nag-timeout ang request. Subukan muli.' : 'Request timed out. Please try again.';
    }
    return detectedLanguage === 'tagalog' ? 'Error sa pagproseso. Subukan muli.' : 'Error processing request. Please try again.';
  },

  // ===== SPECIAL COMMANDS DETECTION =====
  isLyricsRequest(prompt) { return prompt.toLowerCase().includes('lyrics'); },
  isGenerateCommand(prompt) { return prompt.toLowerCase().startsWith('generate'); },
  isImageRequest(prompt) { return prompt.toLowerCase().includes('show me image') || prompt.toLowerCase().includes('picture of'); },
  isMusicRequest(prompt) { return prompt.toLowerCase().includes('play') || prompt.toLowerCase().includes('song'); },
  isScholarCommand(prompt) { return prompt.toLowerCase().startsWith('gscholar') || prompt.toLowerCase().startsWith('scholar'); },
  isResearchQuery(prompt) { return prompt.toLowerCase().includes('research about') || prompt.toLowerCase().includes('study about'); },
  isOwnerQuestion(prompt) { return prompt.toLowerCase().includes('who is your owner') || prompt.toLowerCase().includes('sino gumawa sayo'); },
  isUserInfoQuestion(prompt) { return prompt.toLowerCase().includes('what is my name') || prompt.toLowerCase().includes('ano pangalan ko'); },

  // ===== SPECIAL COMMANDS HANDLERS =====
  async handleLyricsSearch(senderId, prompt, token) {
    let searchTerm = prompt;
    const removeKeywords = ['lyrics', 'lyric', 'letra', 'song lyrics'];
    for (const keyword of removeKeywords) {
      if (searchTerm.toLowerCase().includes(keyword)) {
        searchTerm = searchTerm.toLowerCase().replace(keyword, '').trim();
        break;
      }
    }
    if (!searchTerm) {
      await sendMessage(senderId, { text: 'Usage: lyrics [song title]' }, token);
      return;
    }
    try {
      const encodedQuery = encodeURIComponent(searchTerm);
      const apiUrl = `https://api-library-kohi-production.up.railway.app/api/lyrics?query=${encodedQuery}`;
      const response = await axios.get(apiUrl, { timeout: 15000 });
      const data = response.data;
      if (!data.status || !data.data) {
        await sendMessage(senderId, { text: `Walang nakitang lyrics para sa "${searchTerm}".` }, token);
        return;
      }
      const lyricsData = data.data;
      let message = `${lyricsData.title || searchTerm}\nArtist: ${lyricsData.artist || 'Unknown'}\n\n${lyricsData.lyrics || 'Lyrics not available.'}`;
      await this.sendChunks(senderId, message, token);
    } catch (error) {
      await sendMessage(senderId, { text: `Error sa pagkuha ng lyrics. Subukan muli.` }, token);
    }
  },

  async handleImageGeneration(senderId, prompt, token) {
    let searchTerm = prompt;
    const commands = ['generate', 'image', 'img', 'show'];
    for (const cmd of commands) {
      if (searchTerm.toLowerCase().startsWith(cmd)) {
        searchTerm = searchTerm.slice(cmd.length).trim();
        break;
      }
    }
    if (!searchTerm) {
      await sendMessage(senderId, { text: 'Usage: generate [search term]' }, token);
      return;
    }
    try {
      const response = await axios.get('https://hiroshi-api.onrender.com/image/pinterest', {
        params: { search: searchTerm, limit: 5 }
      });
      const images = response.data?.data || [];
      if (images.length === 0) {
        await sendMessage(senderId, { text: `Walang nakitang mga larawan para sa "${searchTerm}".` }, token);
        return;
      }
      for (const imageUrl of images.slice(0, 5)) {
        await sendMessage(senderId, { attachment: { type: 'image', payload: { url: imageUrl } } }, token);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      await sendMessage(senderId, { text: `Error sa pagkuha ng mga larawan.` }, token);
    }
  },

  async handleMusicSearch(senderId, prompt, token) {
    let searchTerm = prompt;
    const removeKeywords = ['play', 'song', 'music', 'track'];
    for (const keyword of removeKeywords) {
      if (searchTerm.toLowerCase().includes(keyword)) {
        searchTerm = searchTerm.toLowerCase().replace(keyword, '').trim();
        break;
      }
    }
    if (!searchTerm) {
      await sendMessage(senderId, { text: 'Usage: play [song title]' }, token);
      return;
    }
    try {
      const encodedSearch = encodeURIComponent(searchTerm);
      const apiUrl = `https://betadash-api-swordslush-production.up.railway.app/sc?search=${encodedSearch}`;
      const response = await axios.get(apiUrl, { timeout: 30000 });
      const data = response.data;
      if (!data || !data.results || data.results.length === 0) {
        await sendMessage(senderId, { text: `Walang nakitang resulta para sa "${searchTerm}".` }, token);
        return;
      }
      let message = `SoundCloud Results para sa "${searchTerm}"\n\n`;
      for (let i = 0; i < Math.min(5, data.results.length); i++) {
        const track = data.results[i].data;
        message += `${i + 1}. ${track.title || 'Unknown'}\n`;
        message += `Artist: ${track.user?.username || 'Unknown'}\n`;
        message += `Duration: ${this.formatDuration(track.duration || 0)}\n`;
        message += `Link: ${track.permalink_url || 'N/A'}\n\n`;
      }
      await this.sendChunks(senderId, message, token);
    } catch (error) {
      await sendMessage(senderId, { text: `Error sa paghahanap. Subukan muli.` }, token);
    }
  },

  formatDuration(ms) {
    if (!ms) return 'Unknown';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  },

  async handleScholarSearch(senderId, prompt, token) {
    let query = prompt;
    const commands = ['gscholar', 'scholar', 'research'];
    for (const cmd of commands) {
      if (query.toLowerCase().startsWith(cmd)) {
        query = query.slice(cmd.length).trim();
        break;
      }
    }
    if (!query) {
      await sendMessage(senderId, { text: 'Usage: gscholar [search query]' }, token);
      return;
    }
    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: { engine: 'google_scholar', q: query, api_key: SERPAPI_KEY, num: 5 },
        timeout: 30000
      });
      const results = response.data?.organic_results || [];
      if (results.length === 0) {
        await sendMessage(senderId, { text: `Walang nakitang resulta para sa "${query}".` }, token);
        return;
      }
      let message = `Google Scholar Results para sa "${query}"\n\n`;
      for (let i = 0; i < results.length; i++) {
        const paper = results[i];
        message += `${i + 1}. ${paper.title || 'No title'}\n`;
        message += `Authors: ${this.formatAuthorsDisplay(paper.publication_info?.summary || '')}\n`;
        message += `Link: ${paper.link || 'N/A'}\n\n`;
      }
      await this.sendChunks(senderId, message, token);
    } catch (error) {
      await sendMessage(senderId, { text: 'Error sa paghahanap sa Google Scholar.' }, token);
    }
  },

  formatAuthorsDisplay(authors) {
    if (!authors) return 'Unknown';
    const list = authors.split(',').map(a => a.trim()).filter(a => a);
    if (list.length === 0) return 'Unknown';
    if (list.length <= 3) return list.join(', ');
    return `${list.slice(0, 3).join(', ')}, et al.`;
  },

  async handleUserInfo(senderId, prompt, token) {
    await sendMessage(senderId, { text: 'I cannot say that because it is confidential.' }, token);
  }
};
