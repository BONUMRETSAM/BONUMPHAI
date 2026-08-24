const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const MAX_CHUNK = 1900;
const conversationHistory = {};
const SERPAPI_KEY = '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ai', 'opera', 'ask', 'gemini', 'vision', 'gscholar', 'scholar', 'googlescholar', 'research', 'generate', 'image', 'img', 'show', 'resume', 'create', 'make', 'cv', 'report', 'powerpoint', 'ppt'],
  description: 'Multi-modal AI with text, image analysis, Google Scholar, image generation, music search, and lyrics',
  usage: 'ai [message] or send/reply to image or generate [query] or play [song] or lyrics [song]',
  version: '3.0.3',
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

      const correctedPrompt = this.correctTypos(prompt);
      if (correctedPrompt !== prompt) {
        prompt = correctedPrompt;
      }

      const detectedLanguage = this.detectLanguage(prompt);
      const isCasualConversation = this.isCasualConversation(prompt);

      // --- Command checks ---
      if (this.isLyricsRequest(prompt)) {
        await this.handleLyricsSearch(senderId, prompt, token);
        return;
      }
      if (this.isRealtimeQuestion(prompt)) {
        await this.handleRealtimeQuestion(senderId, prompt, token);
        return;
      }
      if (this.isGenerateCommand(prompt) || this.isImageRequest(prompt)) {
        await this.handleImageGeneration(senderId, prompt, token);
        return;
      }
      if (this.isMusicRequest(prompt)) {
        await this.handleMusicSearch(senderId, prompt, token);
        return;
      }
      if (this.isScholarCommand(prompt) || this.isResearchQuery(prompt)) {
        await this.handleScholarSearch(senderId, prompt, token);
        return;
      }
      if (this.isMathProblem(prompt)) {
        const mathPrompt = this.buildMathPrompt(prompt, detectedLanguage);
        const response = await this.callAPI(mathPrompt);
        let aiResponse = this.cleanResponse(response || '');
        await this.sendChunks(senderId, aiResponse, token);
        return;
      }
      if (this.isReportRequest(prompt)) {
        const reportPrompt = this.buildReportPrompt(prompt, detectedLanguage);
        try {
          const response = await this.callAPI(reportPrompt);
          let aiResponse = this.cleanResponse(response || '');
          await this.sendChunks(senderId, aiResponse, token);
        } catch (err) {
          const fallbackReport = this.buildReportFallback(prompt, detectedLanguage);
          await this.sendChunks(senderId, fallbackReport, token);
        }
        return;
      }
      if (this.isPowerPointRequest(prompt)) {
        const pptPrompt = this.buildPowerPointPrompt(prompt, detectedLanguage);
        try {
          const response = await this.callAPI(pptPrompt);
          let aiResponse = this.cleanResponse(response || '');
          await this.sendChunks(senderId, aiResponse, token);
        } catch (err) {
          const fallbackPPT = this.buildPowerPointFallback(prompt, detectedLanguage);
          await this.sendChunks(senderId, fallbackPPT, token);
        }
        return;
      }
      if (this.isResumeRequest(prompt)) {
        const aiResponse = this.buildResumeByJob(prompt, detectedLanguage);
        const newHistory = conversationHistory[senderId] || { topicHistory: {} };
        newHistory.lastResponse = aiResponse;
        newHistory.lastPrompt = prompt;
        newHistory.timestamp = Date.now();
        conversationHistory[senderId] = newHistory;
        await this.sendChunks(senderId, aiResponse, token);
        return;
      }
      if (this.isLetterRequest(prompt)) {
        let letterPrompt;
        if (this.isLetterWithDetails(prompt)) {
          letterPrompt = this.buildLetterResponse(prompt, detectedLanguage);
        } else {
          letterPrompt = this.buildLetterPrompt(prompt, detectedLanguage);
        }
        const response = await this.callAPI(letterPrompt);
        let aiResponse = this.cleanResponse(response || '');
        const newHistory = conversationHistory[senderId] || { topicHistory: {} };
        newHistory.lastResponse = aiResponse;
        newHistory.lastPrompt = prompt;
        newHistory.timestamp = Date.now();
        conversationHistory[senderId] = newHistory;
        await this.sendChunks(senderId, aiResponse, token);
        return;
      }

      // --- Context handling ---
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
          const lower = prompt.toLowerCase();
          if (lower.includes('last') || lower.includes('nauna') || lower.includes('kanina') ||
              lower.includes('huling') || lower.includes('sinabi mo') || lower.includes('sabi mo')) {
            previousResponse = history.lastResponse;
            previousPrompt = history.lastPrompt || 'Previous topic';
            isReply = true;
          }
        }
      }

      // Handle reply to a message with image
      if (event?.message?.reply_to?.mid) {
        isReply = true;
        const replyData = await this.getRepliedMessageData(event.message.reply_to.mid, token);
        previousResponse = replyData.message;
        imageUrl = replyData.imageUrl;
        if (!prompt) prompt = 'Please respond to what I said.';
      }

      // Handle attached image
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

      // Determine if this is a follow-up to a previous response
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

      // Welcome message if empty prompt and no reply/image
      if (!prompt && !isReply && !imageUrl) {
        await sendMessage(senderId, {
          text: 'Hello! Ako si Teacher Arlene - Multi-Modal AI.\n\nMga Kakayahan:\nText conversations\nImage analysis\nAcademic research\nImage generation\nMusic search\nLyrics search\nReal-life situations\nTranslation\nSummarization\nMathematics & Statistics Solutions\nPhysics & Geometry Solutions\nPowerPoint Presentations (Ready-Made!)\nReports (Ready-Made!)\n\nMga Dokumentong Kayang Gawin:\nApplication Letters\nResignation Letters\nCover Letters\nThank You Letters\nLove Letters\nSpeeches (Graduation, Wedding, Eulogy, etc.)\nResume/CV (Any Position - Ready-Made!)\nAcademic Papers (Essay, Research, Thesis)\nBusiness Letters\nRecommendation Letters\nExcuse Letters\nRequest Letters\nApology Letters\nInvitation Letters\nPowerPoint Presentations (Complete Content!)\nReports (Complete Content!)\nAnd many more!\n\nMga Commands:\nai [tanong]\nMag-send ng image para ma-analyze\ngenerate [search term] [number]\ngscholar [search query]\nplay [song title]\nlyrics [song title] by [artist]\nresume [position]\nreport [topic]\npowerpoint [topic]\n\nKaya kong makipag-usap sa Tagalog, Bisaya, English, at iba pang wika.'
        }, token);
        return;
      }

      // Owner info
      if (this.isOwnerQuestion(prompt)) {
        const lang = this.getLanguageName(detectedLanguage);
        const response = lang === 'Tagalog' ? 'Ako ay ginawa ni GeoDevz69. Bisitahin dito para sa karagdagang impormasyon:\nhttps://www.facebook.com/geotechph.net' :
                          lang === 'Bisaya' ? 'Ako gihimo ni GeoDevz69. Bisitaha diri para sa dugang impormasyon:\nhttps://www.facebook.com/geotechph.net' :
                          'I was created by GeoDevz69. Visit here for more information:\nhttps://www.facebook.com/geotechph.net';
        await sendMessage(senderId, { text: response }, token);
        return;
      }
      if (this.isUserInfoQuestion(prompt)) {
        await this.handleUserInfo(senderId, prompt, token);
        return;
      }

      // --- Main AI processing ---
      const wantsDetailed = this.wantsDetailedAnswer(prompt);
      let aiResponse = '';

      if (imageUrl) {
        aiResponse = await this.callGeminiAPI(prompt, imageUrl, detectedLanguage);
        const history = conversationHistory[senderId] || { topicHistory: {} };
        const topicKey = this.extractTopicKey(prompt || 'image');
        const keywords = this.extractKeywordsFromResponse(aiResponse);
        history.lastPrompt = prompt || 'Image analysis';
        history.lastResponse = aiResponse;
        history.lastImageUrl = imageUrl;
        history.hasImageContext = true;
        history.language = detectedLanguage;
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
      } else if (isReply && previousResponse) {
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
        const keywords = this.extractKeywordsFromResponse(aiResponse);
        if (topicKey) {
          newHistory.topicHistory[topicKey] = {
            response: aiResponse,
            prompt: prompt,
            keywords: keywords,
            timestamp: Date.now()
          };
        }
        for (const kw of keywords) {
          if (kw.length > 3 && !newHistory.topicHistory[kw]) {
            newHistory.topicHistory[kw] = {
              response: aiResponse,
              prompt: prompt,
              keywords: keywords,
              timestamp: Date.now()
            };
          }
        }
        conversationHistory[senderId] = newHistory;
      } else {
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
        const keywords = this.extractKeywordsFromResponse(aiResponse);
        if (topicKey) {
          newHistory.topicHistory[topicKey] = {
            response: aiResponse,
            prompt: prompt,
            keywords: keywords,
            timestamp: Date.now()
          };
        }
        for (const kw of keywords) {
          if (kw.length > 3 && !newHistory.topicHistory[kw]) {
            newHistory.topicHistory[kw] = {
              response: aiResponse,
              prompt: prompt,
              keywords: keywords,
              timestamp: Date.now()
            };
          }
        }
        conversationHistory[senderId] = newHistory;
      }

      this.cleanOldHistory();

      if (isReply && this.isTranslationRequest(prompt)) {
        const targetLanguage = this.detectTargetLanguage(prompt);
        aiResponse = await this.translateResponse(aiResponse, targetLanguage);
      }

      await this.sendChunks(senderId, aiResponse, token);

    } catch (error) {
      console.error('[ai] Error:', error.message);
      const errorLang = this.detectLanguage(prompt);
      await sendMessage(senderId, { text: this.getErrorMessage(error, errorLang) }, token);
    }
  },

  // ========================================================================
  // 1. CORRECTION & LANGUAGE DETECTION (FULL)
  // ========================================================================
  correctTypos(prompt) {
    if (!prompt) return prompt;
    const typoMap = {
      'pingi': 'paki', 'pengi': 'paki', 'peng': 'paki', 'ping': 'paki',
      'pking': 'paki', 'pk': 'paki', 'pak': 'paki', 'pki': 'paki',
      'pki explain': 'paki explain', 'pki elaborate': 'paki elaborate',
      'pki linaw': 'paki linaw', 'pki clear': 'paki clear',
      'pki answer': 'paki answer', 'pki sagot': 'paki sagot',
      'pls': 'please', 'plz': 'please', 'pleas': 'please',
      'mre': 'more', 'mor': 'more', 'elab': 'elaborate',
      'expln': 'explanation', 'expl': 'explain', 'explainn': 'explain',
      'elaboratee': 'elaborate', 'plihug': 'palihug', 'plihg': 'palihug',
      'pls explain': 'please explain', 'plz explain': 'please explain',
      'paki explainn': 'paki explain', 'paki elaborat': 'paki elaborate',
      'paki detail': 'paki detail', 'detailled': 'detailed',
      'detialed': 'detailed', 'detaied': 'detailed',
      'explaination': 'explanation', 'elaborationn': 'elaboration',
      'summarry': 'summary', 'summry': 'summary',
      'exmple': 'example', 'sampel': 'sample',
      'grop': 'group', 'groupped': 'grouped', 'freqency': 'frequency',
      'frequancy': 'frequency', 'distrubution': 'distribution',
      'statistic': 'statistics', 'avearge': 'average',
      'standerd': 'standard', 'devation': 'deviation',
      'percentil': 'percentile', 'quartil': 'quartile',
      'decile': 'decile', 'varance': 'variance'
    };
    let corrected = prompt;
    for (const [typo, correct] of Object.entries(typoMap)) {
      if (prompt.toLowerCase().includes(typo)) {
        corrected = corrected.replace(new RegExp(typo, 'gi'), correct);
      }
    }
    return corrected;
  },

  detectLanguage(prompt) {
    if (!prompt) return 'english';
    const lower = prompt.toLowerCase();
    const languages = {
      tagalog: {
        keywords: ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho', 'ako', 'ikaw', 'siya', 'kami', 'tayo', 'kayo', 'sila', 'ito', 'iyan', 'iyon', 'gusto', 'ayaw', 'pwede', 'maaari', 'dapat', 'kailangan', 'meron', 'mayroon', 'wala', 'hindi', 'oo', 'salamat', 'paki', 'pakiusap', 'tanong', 'sagot', 'sabi', 'tulong', 'paliwanag', 'ano', 'bakit', 'paano', 'saan', 'kailan', 'sino', 'alin', 'kamusta', 'kumusta', 'musta'],
        minMatches: 2
      },
      bisaya: {
        keywords: ['ako', 'ikaw', 'siya', 'kami', 'kita', 'kamo', 'sila', 'kini', 'kana', 'kadto', 'dinhi', 'diha', 'didto', 'unsa', 'ngano', 'giunsa', 'asa', 'kanus-a', 'kinsa', 'pila', 'gusto', 'ayaw', 'pwede', 'mahimo', 'kinahanglan', 'naa', 'wala', 'dili', 'oo', 'salamat', 'palihug', 'pangutana', 'tubag', 'sulti', 'buhaton', 'hatagan', 'ipakita', 'isulti', 'tan-awa', 'basaha', 'sabta', 'tabang', 'tabangi', 'pasabta', 'pasabton', 'mubo', 'muboa', 'simple', 'pasimplehon', 'klaro', 'klaruha', 'kumusta', 'kamusta'],
        minMatches: 2
      },
      cebuano: {
        keywords: ['ako', 'ikaw', 'siya', 'kami', 'kita', 'kamo', 'sila', 'kini', 'kana', 'kadto', 'dinhi', 'diha', 'didto', 'unsa', 'ngano', 'giunsa', 'asa', 'kanus-a', 'kinsa', 'pila', 'gusto', 'ayaw', 'pwede', 'mahimo', 'kinahanglan', 'naa', 'wala', 'dili', 'oo', 'salamat', 'palihug', 'pangutana', 'tubag', 'sulti', 'buhaton', 'hatagan', 'ipakita', 'isulti', 'tan-awa', 'basaha', 'sabta', 'tabang', 'tabangi', 'pasabta', 'pasabton', 'mubo', 'muboa', 'simple', 'pasimplehon', 'klaro', 'klaruha', 'kumusta', 'kamusta'],
        minMatches: 2
      },
      english: {
        keywords: ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'on', 'at', 'to', 'for', 'from', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'don', 'now', 'hello', 'hi', 'hey', 'please', 'thank', 'thanks', 'what', 'when', 'where', 'who', 'whom', 'which', 'whose', 'why', 'how'],
        minMatches: 1
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
      for (const keyword of config.keywords) {
        if (keyword.includes(' ') && lower.includes(keyword)) matchCount += 2;
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
      'bisaya': 'Bisaya',
      'cebuano': 'Cebuano',
      'ilocano': 'Ilocano',
      'waray': 'Waray',
      'hiligaynon': 'Hiligaynon',
      'kapampangan': 'Kapampangan',
      'spanish': 'Spanish',
      'japanese': 'Japanese',
      'korean': 'Korean',
      'chinese': 'Chinese',
      'french': 'French',
      'german': 'German'
    };
    return names[languageCode] || 'English';
  },

  // ========================================================================
  // 2. CONVERSATION MEMORY HELPERS
  // ========================================================================
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
      const specialActivity = ['activity', 'worksheet', 'sheet', 'quiz', 'assignment', 'homework', 'exercise', 'pagsasanay', 'gawain'];
      for (const sw of specialActivity) {
        if (responseLower.includes(sw) && userLower.includes(sw)) score += 7;
      }
      if (data.timestamp && (Date.now() - data.timestamp) < 600000) score += 5;
      if (userLower.includes('last') || userLower.includes('nauna') ||
          userLower.includes('kanina') || userLower.includes('huling') ||
          userLower.includes('sinabi mo') || userLower.includes('sabi mo')) {
        if (data.timestamp && (Date.now() - data.timestamp) < 600000) score += 10;
      }
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }
    return (bestScore > 0) ? bestKey : null;
  },

  extractKeywordsFromResponse(response) {
    if (!response) return [];
    const lower = response.toLowerCase();
    const keywords = [];
    const topicWords = [
      'activity sheet', 'worksheet', 'quiz', 'homework', 'assignment',
      'math', 'science', 'english', 'tle', 'filipino', 'araling panlipunan',
      'problem', 'equation', 'solution', 'answer', 'explanation',
      'composting', 'fermentation', 'fertilizer', 'crops', 'harvest',
      'agriculture', 'biology', 'chemistry', 'physics',
      'kasaysayan', 'history', 'lapu-lapu', 'magellan', 'ninoy', 'aquino',
      'niyog', 'coconut', 'hybridization', 'breeding',
      'environment', 'pollution', 'recycle', 'biodegradable',
      'nutrient', 'soil', 'plant', 'leaf', 'foliar',
      'pathogen', 'spoilage', 'shelf life', 'market value',
      'meme', 'joke', 'humor', 'funny', 'comedy',
      'photo', 'picture', 'image', 'screenshot'
    ];
    for (const word of topicWords) {
      if (lower.includes(word)) keywords.push(word);
    }
    const stopWords = ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'on', 'at', 'to', 'for', 'from', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'don', 'now'];
    const words = lower.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length > 2 && !stopWords.includes(words[i]) &&
          words[i+1].length > 2 && !stopWords.includes(words[i+1])) {
        const phrase = words[i] + ' ' + words[i+1];
        if (phrase.length > 4 && !keywords.includes(phrase)) keywords.push(phrase);
        if (i < words.length - 2 && words[i+2].length > 2 && !stopWords.includes(words[i+2])) {
          const triple = words[i] + ' ' + words[i+1] + ' ' + words[i+2];
          if (triple.length > 6 && !keywords.includes(triple)) keywords.push(triple);
        }
      }
    }
    return [...new Set(keywords)].slice(0, 20);
  },

  isReturnToTopicRequest(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    const patterns = [
      'balik tayo sa', 'balikan natin', 'going back to',
      'back to the topic', 'return to topic', 'balik sa topic',
      'balik tayo sa topic', 'balikan ang topic', 'balik sa pinag-usapan',
      'balik sa pinagusapan', 'continue about', 'continue with',
      'tuloy natin ang', 'ituloy ang', 'balik tayo',
      'balikan natin yung', 'balikan natin yong', 'balikan natin iyong',
      'balikan natin ung', 'balikan natin ang',
      'balik ta sa', 'balikan nato', 'balik sa topic',
      'padayon ta sa', 'padayon sa', 'ipadayon ang',
      'balik sa', 'balikan ang', 'tungkol sa last', 'tungkol sa nauna',
      'tungkol sa previous', 'about the previous', 'about the last',
      'jan sa', 'diyan sa', 'doon sa', 'sa last', 'sa nauna',
      'balik sa sinabi mo', 'balik sa sagot mo', 'balikan ang sagot',
      'tuloy ang usapan', 'continue the conversation',
      'patuloy sa', 'ituloy ang usapan', 'bumalik tayo',
      'balikan ang sinabi', 'balikan ang sagot', 'tungkol sa sinabi',
      'tungkol sa sagot', 'tungkol sa topic', 'about the topic'
    ];
    if (patterns.some(p => lower.includes(p))) return true;
    const refs = [
      'last response', 'last reply', 'last answer', 'last message',
      'previous response', 'previous reply', 'previous answer',
      'nauna mong sagot', 'nauna mong reply', 'huling sagot', 'huling reply',
      'sagot mo kanina', 'reply mo kanina', 'sinabi mo kanina',
      'yung sinabi mo', 'ang sinabi mo', 'iyong sinabi'
    ];
    return refs.some(r => lower.includes(r));
  },

  isCasualConversation(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    const casualPatterns = [
      'kamusta', 'kumusta', 'musta', 'msta', 'kamusta ka', 'kumusta ka',
      'ano ginagawa mo', 'anong ginagawa mo', 'ano gawa mo', 'anong gawa mo',
      'ano balita', 'anong balita', 'kamusta na', 'kumusta na',
      'ayos lang', 'ok lang', 'buti naman', 'mabuti naman',
      'salamat', 'sige', 'cge', 'ge', 'ok', 'okay',
      'hehe', 'haha', 'hahaha', 'lol', 'hmm', 'ah', 'oh',
      'nice', 'galing', 'astig', 'ayos', 'magaling',
      'ikaw', 'ikaw ba', 'ikaw naman', 'eh ikaw',
      'unsa ka', 'unsa man', 'naunsa ka', 'unsa imong gibuhat',
      'unsa balita', 'ok ra', 'maayo ra', 'ikaw sad', 'ikaw pud',
      'how are you', 'hows it going', 'whats up', 'what are you doing',
      'how you doing', 'sup', 'yo', 'thanks', 'thank you',
      'hows your day', 'how is your day', 'whats new'
    ];
    return casualPatterns.some(p => lower.includes(p));
  },

  buildCasualPrompt(prompt, language) {
    const langName = this.getLanguageName(language);
    let final = '';
    if (language === 'tagalog' || language === 'bisaya' || language === 'cebuano') {
      final += 'Ikaw ay nakikipag-usap sa isang user sa ' + langName.toUpperCase() + '.\n';
      final += 'Sinabi ng user: "' + prompt + '"\n\n';
      final += 'MAHALAGA:\n';
      final += '- Tumugon nang NATURAL sa ' + langName.toUpperCase() + ' tulad ng isang tunay na tao.\n';
      final += '- Maging palakaibigan, mainit, at conversational.\n';
      final += '- Panatilihing MAIKLI at NATURAL ang mga tugon (1-2 pangungusap).\n';
      final += '- Huwag masyadong pormal o robotic.\n';
      final += '- Tumugon lamang nang direkta sa sinabi nila.\n\n';
      final += 'TUMUGON SA USER SA ' + langName.toUpperCase() + ' NGAYON.';
    } else {
      final += 'You are having a CASUAL CONVERSATION with a user in ' + langName.toUpperCase() + '.\n';
      final += 'The user said: "' + prompt + '"\n\n';
      final += 'IMPORTANT:\n';
      final += '- Respond NATURALLY in ' + langName.toUpperCase() + ' like a real person chatting.\n';
      final += '- Be friendly, warm, and conversational.\n';
      final += '- Keep responses SHORT and NATURAL (1-2 sentences).\n';
      final += '- Don\'t be too formal or robotic.\n';
      final += '- Just respond directly to what they said.\n\n';
      final += 'NOW RESPOND TO THE USER\'S MESSAGE IN ' + langName.toUpperCase() + '.';
    }
    return final;
  },

  // ========================================================================
  // 3. GEMINI & IMAGE ANALYSIS
  // ========================================================================
  async callGeminiAPI(prompt, imageUrl, detectedLanguage = 'english') {
    try {
      const detectPrompt = 'Analyze this image and determine what language the text in the image is written in. Common languages: Tagalog, Filipino, English, Bisaya, Cebuano, Spanish, etc. Respond with ONLY the language name in English (e.g., "Tagalog", "English", "Bisaya", etc.).';

      const detectApiUrl = 'https://norch-project.gleeze.com/api/gemini?prompt=' + encodeURIComponent(detectPrompt) + '&imageurl=' + encodeURIComponent(imageUrl);
      
      let detectedImageLanguage = detectedLanguage;
      try {
        const detectResponse = await axios.get(detectApiUrl, {
          timeout: 30000,
          headers: { 'Accept': 'application/json' }
        });
        if (detectResponse.data && detectResponse.data.response) {
          const langResult = detectResponse.data.response.toLowerCase().trim();
          if (langResult.includes('tagalog') || langResult.includes('filipino')) {
            detectedImageLanguage = 'tagalog';
          } else if (langResult.includes('bisaya') || langResult.includes('cebuano')) {
            detectedImageLanguage = 'bisaya';
          } else if (langResult.includes('spanish')) {
            detectedImageLanguage = 'spanish';
          } else {
            detectedImageLanguage = 'english';
          }
        }
      } catch (detectError) {
        detectedImageLanguage = detectedLanguage;
      }

      const geminiPrompt = this.buildGeminiPrompt(prompt, detectedImageLanguage);
      const apiUrl = 'https://norch-project.gleeze.com/api/gemini?prompt=' + encodeURIComponent(geminiPrompt) + '&imageurl=' + encodeURIComponent(imageUrl);

      let response = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          response = await axios.get(apiUrl, {
            timeout: 90000,
            headers: { 'Accept': 'application/json' },
            maxContentLength: 50 * 1024 * 1024,
            maxBodyLength: 50 * 1024 * 1024
          });
          if (response.status === 200 && response.data) break;
        } catch (error) {
          if (attempts >= maxAttempts) throw error;
          const delay = error.response?.status === 429 ? 10000 : error.response?.status >= 500 ? 5000 : 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!response || !response.data) throw new Error('No response from Gemini API');
      let processed = this.processGeminiResponse(response.data.response || '');
      return processed || 'Hindi ma-analyze ang image. Subukan muli.';

    } catch (error) {
      console.error('[Gemini] Error:', error.message);
      const fallbackPrompt = 'The user sent an image. The user asked: ' + (prompt || 'Please describe what you see') + '. Provide a helpful response.';
      const response = await this.callAPI(fallbackPrompt);
      return this.cleanResponse(response || 'Hindi ma-analyze ang image. Subukan muli.');
    }
  },

  buildGeminiPrompt(userPrompt, language = 'english') {
    const langName = this.getLanguageName(language);
    let prompt;
    if (language === 'tagalog' || language === 'bisaya' || language === 'cebuano') {
      prompt = 'Ikaw ay isang AI assistant na nagsusuri ng isang imahe.\n\n';
      prompt += 'TUKUYIN KUNG ANO ANG NASA LARAWAN at tumugon nang naaayon:\n\n';
      prompt += '1. ACTIVITY SHEET / WORKSHEET / QUIZ / HOMEWORK / ASSIGNMENT\n';
      prompt += '   - Basahin at unawain ang bawat tanong\n';
      prompt += '   - Magbigay ng TUMPAK na mga sagot\n';
      prompt += '   - Para sa math: Ipakita ang step-by-step na solusyon\n\n';
      prompt += '2. MATH PROBLEMS / EQUATIONS\n';
      prompt += '   - Ipakita ang step-by-step na solusyon\n';
      prompt += '   - Ibigay ang pinal na sagot\n\n';
      prompt += '3. SCIENCE / DIAGRAMS / LABELS\n';
      prompt += '   - Tukuyin ang mga bahagi at ang kanilang gamit\n';
      prompt += '   - Ipaliwanag ang mga proseso\n\n';
      prompt += '4. TEXTBOOK / NOTES / EDUCATIONAL CONTENT\n';
      prompt += '   - Kunin ang mga pangunahing konsepto\n';
      prompt += '   - Ibuod ang mga pangunahing ideya\n\n';
      prompt += '5. MEME / HUMOROUS IMAGE\n';
      prompt += '   - Tukuyin ang paksa\n';
      prompt += '   - Ipaliwanag ang biro (1-2 pangungusap)\n';
      prompt += '   - Panatilihing MAIKLI\n\n';
      prompt += '6. GENERAL IMAGE (Photo, Art, Screenshot)\n';
      prompt += '   - Ilarawan kung ano ang nakikita (1-3 pangungusap)\n';
      prompt += '   - Panatilihing SIMPLE at DIREKTA\n\n';
      prompt += 'PARAAN NG PAGTUGON:\n\n';
      prompt += 'Para sa educational/content (activity sheets, problems, diagrams):\n';
      prompt += 'Sagot: [Direktang sagot sa tanong o pangunahing punto]\n';
      prompt += 'Paliwanag: [Maikling paliwanag, 1-2 pangungusap]\n\n';
      prompt += 'Para sa memes:\n';
      prompt += '[Maikling paglalarawan ng meme, 1-2 pangungusap]\n\n';
      prompt += 'Para sa general images:\n';
      prompt += '[Maikling paglalarawan, 2-3 pangungusap]\n\n';
      prompt += 'MAHALAGANG PANUNTUNAN:\n';
      prompt += '- Gamitin ang Sagot/Paliwanag format LANG para sa educational content\n';
      prompt += '- Para sa casual images, magbigay lang ng maikling paglalarawan\n';
      prompt += '- Panatilihing MAIKLI at MALINAW ang mga tugon\n';
      prompt += '- WALANG labis na teksto tungkol sa "content type"\n';
      prompt += '- Tumugon sa ' + langName.toUpperCase() + ' na wika\n\n';
      prompt += 'TANONG NG USER: ' + (userPrompt || 'Suriin ang imaheng ito');
    } else {
      prompt = 'You are an AI assistant analyzing an image.\n\n';
      prompt += 'DETECT WHAT THE IMAGE CONTAINS and respond accordingly:\n\n';
      prompt += '1. ACTIVITY SHEET / WORKSHEET / QUIZ / HOMEWORK / ASSIGNMENT\n';
      prompt += '   - Read and understand each question\n';
      prompt += '   - Provide ACCURATE answers\n';
      prompt += '   - For math: Show step-by-step solution\n\n';
      prompt += '2. MATH PROBLEMS / EQUATIONS\n';
      prompt += '   - Show step-by-step solution\n';
      prompt += '   - Provide final answer\n\n';
      prompt += '3. SCIENCE / DIAGRAMS / LABELS\n';
      prompt += '   - Identify parts and their functions\n';
      prompt += '   - Explain processes\n\n';
      prompt += '4. TEXTBOOK / NOTES / EDUCATIONAL CONTENT\n';
      prompt += '   - Extract key concepts\n';
      prompt += '   - Summarize main ideas\n\n';
      prompt += '5. MEME / HUMOROUS IMAGE\n';
      prompt += '   - Identify the subject\n';
      prompt += '   - Explain the joke briefly (1-2 sentences)\n';
      prompt += '   - Keep it SHORT\n\n';
      prompt += '6. GENERAL IMAGE (Photo, Art, Screenshot)\n';
      prompt += '   - Describe what you see (1-3 sentences)\n';
      prompt += '   - Keep it SIMPLE and DIRECT\n\n';
      prompt += 'RESPONSE FORMAT:\n\n';
      prompt += 'For educational/content (activity sheets, problems, diagrams):\n';
      prompt += 'Answer: [Direct answer to the question or main point]\n';
      prompt += 'Explanation: [Brief explanation, 1-2 sentences]\n\n';
      prompt += 'For memes:\n';
      prompt += '[Brief description of the meme, 1-2 sentences]\n\n';
      prompt += 'For general images:\n';
      prompt += '[Brief description, 2-3 sentences]\n\n';
      prompt += 'IMPORTANT RULES:\n';
      prompt += '- Use the Answer/Explanation format ONLY for educational content\n';
      prompt += '- For casual images, just give a brief description\n';
      prompt += '- Keep responses SHORT and CLEAR\n';
      prompt += '- NO excessive text about "content type"\n';
      prompt += '- Respond in ' + langName.toUpperCase() + ' language\n\n';
      prompt += 'USER QUESTION: ' + (userPrompt || 'Analyze this image');
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
      .replace(/^Hayaan mong i-analyze ko.*?\n/i, '')
      .replace(/^Batay sa aking analysis.*?\n/i, '')
      .replace(/^Nakikita ko na.*?\n/i, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return this.cleanResponse(processed);
  },

  buildImageFollowUpPrompt(prompt, previousResponse, previousPrompt, wantsDetailed, language) {
    const langName = this.getLanguageName(language);
    let final = '';
    final += 'PREVIOUS IMAGE ANALYSIS:\n' + previousResponse + '\n\n';
    final += 'USER ASKED: "' + prompt + '"\n\n';
    final += 'Provide a helpful response in ' + langName.toUpperCase() + '.\n';
    final += 'Keep it CLEAR and DIRECT. Use Answer/Explanation format if applicable.\n';
    if (wantsDetailed) final += 'Provide a detailed explanation.\n';
    else final += 'Keep it concise and to the point.\n';
    return final;
  },

  buildImageModificationPrompt(prompt, previousResponse, wantsDetailed, language) {
    const langName = this.getLanguageName(language);
    let final = '';
    final += 'PREVIOUS IMAGE ANALYSIS:\n' + previousResponse + '\n\n';
    final += 'USER REQUEST: "' + prompt + '"\n\n';
    const lower = prompt.toLowerCase();
    if (lower.includes('short') || lower.includes('concise') || lower.includes('brief') ||
        lower.includes('maikli') || lower.includes('iklian') || lower.includes('paikliin') ||
        lower.includes('mubo') || lower.includes('muboa') || lower.includes('halipot')) {
      final += 'Make the analysis SHORTER. Keep only the key points.\n';
    } else if (lower.includes('clear') || lower.includes('clarify') || lower.includes('linaw')) {
      final += 'Make the analysis CLEARER. Use simpler language.\n';
    } else if (lower.includes('simple') || lower.includes('simplify') || lower.includes('pasimplehin')) {
      final += 'Provide a SIMPLER explanation.\n';
    } else if (lower.includes('detail') || lower.includes('elaborate') || lower.includes('explain more')) {
      final += 'Provide MORE DETAILS. Expand on each point.\n';
    } else if (lower.includes('summar') || lower.includes('summary') || lower.includes('buod')) {
      final += 'Provide a SUMMARY. Just the most important points.\n';
    } else {
      final += 'Modify the analysis as requested.\n';
    }
    final += '\nRespond in ' + langName.toUpperCase() + '. Keep it clear and direct.';
    return final;
  },

  // ========================================================================
  // 4. MODIFICATION / FOLLOW-UP DETECTION
  // ========================================================================
  isModificationRequest(prompt) {
    const corrected = this.correctTypos(prompt);
    const patterns = [
      'make it short', 'make it shorter', 'make it concise', 'make it brief',
      'make it simple', 'make it simpler', 'make it clear', 'make it clearer',
      'shorten it', 'simplify it', 'clarify it', 'explain more',
      'explain further', 'elaborate', 'more details', 'more information',
      'tell me more', 'expand', 'summarize', 'summary', 'brief', 'concise',
      'short', 'simple', 'clear', 'detailed', 'detail', 'in depth',
      'in-depth', 'thorough', 'comprehensive', 'translate', 'translation',
      'explain', 'explanation', 'can you explain', 'can you clarify',
      'can you elaborate', 'can you simplify', 'can you summarize',
      'paki explain', 'paki linaw', 'paki elaborate', 'paki summarize',
      'pakiikli', 'paikliin', 'pasimplehin', 'paliwanag',
      'ipaliwanag', 'ilinaw', 'linawin', 'ikli', 'iklian', 'simplehan',
      'gawing simple', 'gawing maikli', 'gawing malinaw', 'mas detalyado',
      'mas malinaw', 'mas maikli', 'mas simple', 'dagdagan', 'dagdag',
      'karagdagang', 'additional', 'add more', 'more examples',
      'give examples', 'halimbawa', 'example', 'examples', 'sample',
      'samples', 'for example', 'like what', 'what about',
      'how about', 'what if', 'why', 'how', 'when', 'where', 'who',
      'which', 'what', 'ano', 'bakit', 'paano', 'kailan', 'saan',
      'sino', 'alin', 'pakiusap', 'mangyaring', 'paki',
      'pki', 'pki explain', 'pki elaborate', 'pki linaw',
      'pingi', 'ping', 'peng', 'pengi', 'pking',
      'pls', 'plz', 'pleas',
      'gawan mo ng best', 'gawan mo ng magandang', 'gawan mo ng strong',
      'best objective', 'best objectives', 'magandang objective',
      'strong objective', 'improve my resume', 'improve resume',
      'i-improve ang resume', 'better objective', 'mas magandang objective',
      'gumawa ng objective', 'objective para sa resume',
      'best skills', 'best achievements', 'best references',
      'complete my resume', 'i-complete ang resume',
      'finish my resume', 'tapusin ang resume'
    ];
    const lower = prompt.toLowerCase();
    if (patterns.some(p => lower.includes(p))) return true;
    if (corrected !== prompt && patterns.some(p => corrected.includes(p))) return true;
    return false;
  },

  isFollowUpRequest(prompt) {
    const corrected = this.correctTypos(prompt);
    const keywords = [
      'translate', 'isalin', 'salin', 'ipasalin',
      'elaborate', 'paki elaborate', 'paki explain', 'paliwanag', 'ipaliwanag',
      'elab', 'explain', 'detail', 'further', 'more details',
      'mas detalyado', 'summarize', 'summary', 'i-summarize',
      'brief', 'make it short', 'short', 'concise', 'shorten',
      'ikli', 'paikliin', 'simplify', 'simple', 'pasimplehin',
      'basic', 'simplified', 'example', 'sample', 'halimbawa',
      'instance', 'give example', 'magbigay ng halimbawa',
      'correct', 'fix', 'tama', 'ayusin', 'improve', 'better',
      'add', 'additional', 'dagdagan', 'more', 'add more',
      'humanize', 'make it human', 'conversational', 'natural',
      'make it natural', 'parang tao', 'clarify', 'clarification',
      'linawin', 'clear', 'make clear', 'ulit', 'repeat', 'again',
      'gets', 'nagets', 'naintindihan', 'understand',
      'pki', 'pki explain', 'pki elaborate', 'pki linaw',
      'pingi', 'ping', 'peng', 'pengi', 'pking',
      'pleas', 'pls', 'plz'
    ];
    const lower = prompt.toLowerCase();
    if (keywords.some(k => lower.includes(k))) return true;
    if (corrected !== prompt && keywords.some(k => corrected.includes(k))) return true;
    return false;
  },

  isNewTopic(prompt, previousPrompt, originalPrompt) {
    if (!previousPrompt) return true;
    const corrected = this.correctTypos(prompt);
    const followUpIndicators = [
      'paki', 'please', 'elaborate', 'explain', 'more', 'detail',
      'paliwanag', 'linaw', 'clear', 'example', 'sample',
      'halimbawa', 'summarize', 'summary', 'short', 'simple',
      'translate', 'isalin', 'dagdag', 'add', 'correct', 'fix',
      'pls', 'plz', 'pingi', 'peng', 'pki'
    ];
    if (followUpIndicators.some(i => corrected.includes(i))) return false;
    const lowerPrompt = prompt.toLowerCase();
    const casualPhrases = ['hahaha', 'haha', 'hehe', 'lol', 'lmao', 'oh', 'ah', 'eh', 'ay', 'ha', 'hmm', 'hm', 'mmm', 'wow', 'shet', 'gagi', 'lala', 'hala', 'talaga', 'seryoso', 'grabe', 'sus', 'hay', 'ayoko', 'sige', 'cge', 'okay', 'ok', 'ge'];
    if (casualPhrases.some(p => lowerPrompt.includes(p)) && originalPrompt.length < 20) return true;
    if (originalPrompt.length < 10 && !this.isFollowUpRequest(prompt)) return true;
    const prevWords = previousPrompt.split(' ').filter(w => w.length > 3);
    const currentWords = prompt.split(' ').filter(w => w.length > 3);
    const hasRelatedWords = prevWords.some(w => currentWords.some(cw => cw.includes(w) || w.includes(cw)));
    if (!hasRelatedWords && originalPrompt.length > 5) return true;
    const indicators = ['hello', 'hi', 'hey', 'kamusta', 'musta', 'tanong', 'question', 'new topic', 'bagong topic', 'iba naman', 'lipat tayo', 'move on', 'gusto ko malaman', 'i want to know', 'tell me about', 'ano ang', 'what is'];
    if (indicators.some(i => lowerPrompt.includes(i)) && !this.isFollowUpRequest(prompt)) return true;
    return false;
  },

  isContextualQuestion(prompt, previousPrompt) {
    if (!previousPrompt) return false;
    const patterns = ['so yan', 'so ito', 'so iyan', 'so yun', 'so ganyan', 'so ganito', 'so ganun', 'yan na ba', 'yun na ba', 'ito na ba', 'ganyan na ba', 'ganun na ba', 'tama ba', 'tama', 'correct', 'right', 'so tungkol', 'so sa', 'so para sa', 'so ibig sabihin', 'so meaning', 'so parang', 'so sa madaling salita', 'so in short', 'paano naman', 'what about', 'how about', 'paano kung', 'what if', 'bakit', 'why', 'paano', 'how', 'kailan', 'when', 'saan', 'where', 'sino', 'who', 'alin', 'which', 'ano', 'what', 'ano ba', 'gets', 'gets ko', 'nagets', 'naintindihan', 'so gets', 'so naintindihan', 'ayun', 'ayon', 'ganun pala', 'ganyan pala', 'so ayun', 'so ayon', 'ok', 'okay', 'sige', 'cge', 'so okay', 'so sige', 'ah ganun', 'ah ganyan', 'ah okay', 'so ah', 'so okay', 'talaga', 'really', 'sure', 'so talaga', 'so sure', 'so that', 'so this', 'so it', 'so about', 'so regarding', 'so basically', 'so essentially', 'so you mean', 'mao na', 'mao ni', 'mao to', 'mao diay', 'mao ba', 'so mao', 'so mao na', 'sakto ba', 'sakto', 'ingon ana', 'ingon ani', 'so ingon', 'so ingon ana'];
    const isRelated = patterns.some(p => prompt.includes(p));
    const prevWords = previousPrompt.split(' ').filter(w => w.length > 2);
    const currentWords = prompt.split(' ').filter(w => w.length > 2);
    const hasRelated = prevWords.some(w => currentWords.some(c => c.includes(w) || w.includes(c)));
    return isRelated || hasRelated;
  },

  extractTopicKey(prompt) {
    if (!prompt) return null;
    const words = prompt.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'on', 'at', 'to', 'for', 'from', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho'];
    const keywords = words.filter(w => w.length > 3 && !stopWords.includes(w));
    const key = keywords.slice(0, 5).join(' ');
    return key.length > 3 ? key.substring(0, 50) : prompt.substring(0, 50);
  },

  // ========================================================================
  // 5. MAIN AI PROMPT BUILDER
  // ========================================================================
  buildFinalPrompt(prompt, previousResponse, previousPrompt, isReply, wantsDetailed, language = 'english') {
    const langName = this.getLanguageName(language);
    let final = '';
    final += 'IMPORTANT: Respond in ' + langName.toUpperCase() + ' language.\n\n';
    if (previousResponse) {
      final += 'PREVIOUS CONVERSATION:\n';
      final += 'User asked: "' + (previousPrompt || 'unknown') + '"\n';
      final += 'AI responded: "' + previousResponse + '"\n\n';
      final += 'USER\'S NEW REQUEST: "' + prompt + '"\n\n';
      const lower = prompt.toLowerCase();
      if (lower.includes('elaborate') || lower.includes('paki elaborate') || 
          lower.includes('explain more') || lower.includes('more explanation') ||
          lower.includes('paliwanag') || lower.includes('ipaliwanag') ||
          lower.includes('detail') || lower.includes('more details') ||
          lower.includes('mas detalyado') || lower.includes('further') ||
          lower.includes('clarify') || lower.includes('linawin') ||
          lower.includes('paki linaw')) {
        final += 'CRITICAL: Elaborate on the PREVIOUS RESPONSE above.\n';
        final += 'DO NOT explain what "elaborate" means.\n';
        final += 'STAY on the EXACT SAME TOPIC.\n';
        final += 'Provide MORE DETAILS about that SPECIFIC topic.\n\n';
        final += 'PREVIOUS TOPIC: "' + previousPrompt + '"\n';
        final += 'NOW, ELABORATE on the SAME TOPIC above.\n\n';
      } else if (lower.includes('example') || lower.includes('sample') || 
          lower.includes('halimbawa') || lower.includes('instance')) {
        final += 'CRITICAL: Provide EXAMPLES related to the PREVIOUS RESPONSE.\n';
        final += 'STAY on the SAME TOPIC.\n';
        final += 'Provide SPECIFIC examples.\n\n';
      } else if (lower.includes('scenario') || lower.includes('situation') || 
          lower.includes('case') || lower.includes('senaryo')) {
        final += 'CRITICAL: Provide a SCENARIO based on the PREVIOUS RESPONSE.\n';
        final += 'STAY on the SAME TOPIC.\n';
        final += 'Provide a REALISTIC scenario.\n\n';
      } else if (this.isTranslationRequest(prompt)) {
        const targetLang = this.detectTargetLanguage(prompt);
        final += 'Translate the PREVIOUS RESPONSE to ' + targetLang + '.\n';
        final += 'ONLY provide the translation, no other text.\n\n';
      } else if (lower.includes('humanize') || lower.includes('make it human') || 
                 lower.includes('conversational') || lower.includes('natural')) {
        final += 'Rewrite the PREVIOUS RESPONSE in a natural, conversational tone.\n';
        final += 'Keep the SAME meaning and content.\n\n';
      } else if (lower.includes('summarize') || lower.includes('summary') || 
                 lower.includes('i-summarize') || lower.includes('brief') ||
                 lower.includes('short') || lower.includes('concise') || lower.includes('shorten')) {
        final += 'Provide a SUMMARY of the PREVIOUS RESPONSE.\n';
        final += 'Only KEY POINTS.\n\n';
      } else if (lower.includes('simplify') || lower.includes('simple') || 
                 lower.includes('pasimplehin') || lower.includes('basic')) {
        final += 'Provide a SIMPLER explanation of the PREVIOUS RESPONSE.\n';
        final += 'Use SIMPLE words.\n\n';
      } else if (lower.includes('correct') || lower.includes('fix') || 
                 lower.includes('tama') || lower.includes('ayusin') || lower.includes('improve')) {
        final += 'Correct or improve the PREVIOUS RESPONSE.\n\n';
      } else if (lower.includes('add') || lower.includes('additional') || 
                 lower.includes('dagdagan') || lower.includes('more')) {
        final += 'Add MORE information to the PREVIOUS RESPONSE.\n';
        final += 'Stay on the SAME topic.\n\n';
      } else {
        final += 'Continue the previous conversation.\n';
        final += 'User says: "' + prompt + '"\n';
        final += 'Provide a NATURAL response.\n\n';
      }
      final += 'FINAL REMINDER:\n';
      final += 'Respond about the SAME TOPIC as the PREVIOUS CONVERSATION.\n';
      final += 'DO NOT explain what "elaborate" or "explain" means.\n';
      final += 'STAY ON TOPIC.\n\n';
    } else {
      final += 'USER ASKED: "' + prompt + '"\n\n';
    }
    if (wantsDetailed) {
      final += 'Provide a DETAILED explanation.\n';
    } else {
      final += 'Provide a SHORT, DIRECT, and ACCURATE response.\n';
    }
    final += '\nFINAL RULES:\n';
    final += '- Respond in ' + langName.toUpperCase() + ' language.\n';
    final += '- Be accurate and precise.\n';
    final += '- Use plain text only. No markdown.\n';
    final += '- STAY ON TOPIC.';
    return final;
  },

  // ========================================================================
  // 6. MATH & ACADEMIC
  // ========================================================================
  isMathProblem(prompt) {
    const lower = prompt.toLowerCase();
    const mathKeywords = [
      'group data', 'grouped data', 'frequency distribution', 'mean', 'median', 'mode',
      'standard deviation', 'variance', 'percentile', 'quartile', 'decile',
      'range', 'class interval', 'class width', 'class mark', 'frequency table',
      'cumulative frequency', 'relative frequency', 'histogram', 'ogive',
      'sample data', 'population data', 'statistics', 'statistical',
      'solve', 'equation', 'linear equation', 'quadratic equation', 'polynomial',
      'simplify', 'factor', 'expand', 'inequality', 'system of equations',
      'area', 'perimeter', 'volume', 'circumference', 'triangle', 'circle',
      'rectangle', 'square', 'angle', 'theorem', 'pythagorean',
      'derivative', 'integral', 'limit', 'differentiation', 'integration',
      'compute', 'calculate', 'find', 'determine', 'solution', 'solve for',
      'what is', 'what is the', 'find the', 'calculate the', 'compute the',
      'force', 'acceleration', 'velocity', 'momentum', 'energy', 'work',
      'newton', 'kinematics', 'dynamics', 'physics', 'gravity', 'friction',
      'mass', 'weight', 'density', 'pressure', 'temperature', 'heat',
      'wave', 'frequency', 'wavelength', 'amplitude', 'sound', 'light',
      'magnetism', 'electricity', 'circuit', 'voltage', 'current', 'resistance',
      'stoichiometry', 'mole', 'molar', 'chemical equation', 'gas law',
      'boyle', 'charles', 'ideal gas', 'solution', 'concentration'
    ];
    const isExample = lower.includes('example') || lower.includes('sample') || lower.includes('give me') || lower.includes('show me') || lower.includes('example of') || lower.includes('sample of');
    return mathKeywords.some(k => lower.includes(k)) && isExample;
  },

  buildMathPrompt(prompt, detectedLanguage) {
    const langName = this.getLanguageName(detectedLanguage);
    let final = '';
    
    if (detectedLanguage === 'tagalog' || detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano') {
      final += 'Ikaw ay isang AI assistant na dalubhasa sa MATHEMATICS at STATISTICS.\n\n';
      final += 'USER REQUEST: "' + prompt + '"\n\n';
      final += 'Gumawa ng KOMPLETO at DETALYADONG solusyon sa problema.\n';
      final += 'SUNDIN ANG MGA HAKBANG:\n';
      final += '1. Unawain ang problema\n';
      final += '2. Isulat ang mga given data\n';
      final += '3. Isulat ang formula na gagamitin\n';
      final += '4. Ipakita ang step-by-step na solusyon\n';
      final += '5. Ibigay ang final answer\n\n';
      final += 'MAHALAGANG PANUNTUNAN:\n';
      final += '- Gumamit ng PLAIN TEXT. Huwag gumamit ng LaTeX formatting.\n';
      final += '- Gumamit ng SIMPLE TEXT tulad ng: SUM, /, ×, =, √, ±\n';
      final += '- Para sa tables, gamitin ang SIMPLE FORMAT:\n';
      final += '  Class Interval | Frequency | Midpoint | f × x\n';
      final += '  0 - 10 | 5 | 5 | 25\n';
      final += '- Huwag gumamit ng extra pipes (|||) sa tables\n';
      final += '- Huwag gumamit ng boxed answers\n';
      final += '- Gumamit ng PLAIN TEXT LANG.\n\n';
      final += 'Gumamit ng FORMAL na tono.\n';
      final += 'Ang solusyon ay dapat nasa ' + langName.toUpperCase() + ' na wika.\n\n';
      final += 'MAGBIGAY NG KUMPLETONG HALIMBAWA NA MAY MGA NUMERO AT COMPUTATIONS.\n';
      final += 'TUMUGON NGAYON SA ' + langName.toUpperCase() + '.';
    } else {
      final += 'You are an AI assistant specializing in MATHEMATICS and STATISTICS.\n\n';
      final += 'USER REQUEST: "' + prompt + '"\n\n';
      final += 'Create a COMPLETE and DETAILED solution to the problem.\n';
      final += 'FOLLOW THESE STEPS:\n';
      final += '1. Understand the problem\n';
      final += '2. Write the given data\n';
      final += '3. Write the formula to be used\n';
      final += '4. Show the step-by-step solution\n';
      final += '5. Provide the final answer\n\n';
      final += 'IMPORTANT RULES:\n';
      final += '- Use PLAIN TEXT. Do NOT use LaTeX formatting.\n';
      final += '- Use SIMPLE TEXT like: SUM, /, ×, =, √, ±\n';
      final += '- For tables, use SIMPLE FORMAT:\n';
      final += '  Class Interval | Frequency | Midpoint | f × x\n';
      final += '  0 - 10 | 5 | 5 | 25\n';
      final += '- Do NOT use extra pipes (|||) in tables\n';
      final += '- Do NOT use boxed answers\n';
      final += '- Use PLAIN TEXT ONLY.\n\n';
      final += 'Use a FORMAL tone.\n';
      final += 'The solution should be in ' + langName.toUpperCase() + ' language.\n\n';
      final += 'PROVIDE A COMPLETE EXAMPLE WITH ACTUAL NUMBERS AND COMPUTATIONS.\n';
      final += 'RESPOND NOW IN ' + langName.toUpperCase() + '.';
    }
    return final;
  },

  // ========================================================================
  // 7. REPORT (FIXED)
  // ========================================================================
  isReportRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = [
      'report', 'reports', 'report about', 'report on', 'report of',
      'gumawa ng report', 'gumawa ng ulat', 'ulat tungkol sa',
      'make a report', 'create report', 'write report',
      'book report', 'summary report', 'research report',
      'case report', 'analysis report', 'narrative report'
    ];
    return keywords.some(k => lower.includes(k));
  },

  buildReportPrompt(prompt, detectedLanguage) {
    const isTagalog = (detectedLanguage === 'tagalog' || detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano');
    let topic = prompt.replace(/report|reports|ulat|gumawa ng|make|create|write|about|on/gi, '').trim();
    if (!topic) topic = 'the given topic';
    let final = '';
    if (isTagalog) {
      final += `Ikaw ay isang AI assistant na dalubhasa sa pagsulat ng mga ulat. Gagawa ka ng isang KOMPLETO at PROPESYONAL na ULAT.\n\nPAKSA: "${topic}"\n\nSumulat ng isang kumpletong ulat na may sumusunod na bahagi:\n1. PANIMULA – ipakilala ang paksa at ang layunin ng ulat.\n2. KATAWAN – magbigay ng hindi bababa sa tatlong pangunahing seksyon na may malalim na paliwanag at mga halimbawa.\n3. KONGKLUSYON – ibuod ang mga pangunahing punto at magbigay ng rekomendasyon o pangwakas na kaisipan.\n\nMAHALAGA: Isulat ang BUONG NILALAMAN ng ulat, hindi lamang outline o bullet points. Gumamit ng kumpletong mga pangungusap at talata. Ang ulat ay dapat nasa Tagalog na wika.\n\nMagsimula ngayon sa pagsulat ng kumpletong ulat.`;
    } else {
      final += `You are an AI assistant specialized in report writing. Create a COMPLETE and PROFESSIONAL REPORT.\n\nTOPIC: "${topic}"\n\nWrite a complete report with the following sections:\n1. INTRODUCTION – introduce the topic and the purpose of the report.\n2. BODY – provide at least three main sections with in‑depth explanations and examples.\n3. CONCLUSION – summarize the key points and provide recommendations or final thoughts.\n\nIMPORTANT: Write the FULL CONTENT of the report, not just an outline or bullet points. Use complete sentences and paragraphs. The report should be in English.\n\nStart writing the complete report now.`;
    }
    return final;
  },

  buildReportFallback(prompt, detectedLanguage) {
    const isTagalog = (detectedLanguage === 'tagalog' || detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano');
    let topic = prompt.replace(/report|reports|ulat|gumawa ng|make|create|write|about|on/gi, '').trim();
    if (!topic) topic = 'the given topic';
    const t = topic;
    const upper = t.toUpperCase();
    let final = '';
    if (isTagalog) {
      final += `========================================\n`;
      final += `ULAT TUNGKOL SA: ${upper}\n`;
      final += `========================================\n\n`;
      final += `PANIMULA\n\n`;
      final += `Ang ulat na ito ay nagbibigay ng komprehensibong pagsusuri sa paksang "${t}". Nilalayon nitong ipaliwanag ang mga pangunahing konsepto, estratehiya, at praktikal na aplikasyon ng "${t}" sa kasalukuyang konteksto.\n\n`;
      final += `KAHULUGAN AT SAKLAW\n\n`;
      final += `Ang "${t}" ay tumutukoy sa (magbigay ng depinisyon). Saklaw nito ang mga sumusunod na aspeto: (aspeto 1), (aspeto 2), at (aspeto 3). Ang pag‑unawa sa mga ito ay mahalaga upang masuri ang kabuuang epekto ng "${t}".\n\n`;
      final += `MGA PANGUNAHING ESTRATEHIYA\n\n`;
      final += `Maraming estratehiya ang ginagamit upang maisakatuparan ang "${t}". Kabilang dito ang:\n- Estratehiya A: (paglalarawan) – nakatuon sa (layunin).\n- Estratehiya B: (paglalarawan) – naglalayong (resulta).\n- Estratehiya C: (paglalarawan) – nagbibigay‑diin sa (aspeto).\nAng bawat isa ay may sariling lakas at kahinaan na dapat isaalang‑alang.\n\n`;
      final += `MGA HALIMBAWA AT PAG‑AARAL NG KASO\n\n`;
      final += `Ilang halimbawa ng "${t}" sa praktikal na sitwasyon:\n- Kaso 1: (paglalarawan) – nagpakita ng (resulta).\n- Kaso 2: (paglalarawan) – nagbigay‑diin sa (aral).\n- Kaso 3: (paglalarawan) – nagpatunay na (implikasyon).\nAng mga kasong ito ay nagpapakita ng iba't ibang resulta batay sa konteksto.\n\n`;
      final += `MGA HAMON AT LIMITASYON\n\n`;
      final += `Sa kabila ng mga pagsisikap, may mga hamon na humahadlang sa epektibong pagpapatupad ng "${t}". Kabilang dito ang:\n- Hamon 1: (paglalarawan) – nagdudulot ng (epekto).\n- Hamon 2: (paglalarawan) – nangangailangan ng (solusyon).\n- Hamon 3: (paglalarawan) – limitado ang (yaman/kaalaman).\nKailangan ng agarang aksyon upang malampasan ang mga ito.\n\n`;
      final += `MGA REKOMENDASYON\n\n`;
      final += `Batay sa pagsusuri, inirerekomenda ang sumusunod:\n- Rekomendasyon 1: (aksyon) upang (layunin).\n- Rekomendasyon 2: (aksyon) upang (mapabuti).\n- Rekomendasyon 3: (aksyon) upang (matugunan ang hamon).\n- Rekomendasyon 4: (pakikipagtulungan) sa pagitan ng (mga stakeholder).\n\n`;
      final += `KONGKLUSYON\n\n`;
      final += `Sa kabuuan, ang "${t}" ay isang mahalagang paksa na nangangailangan ng patuloy na atensyon at aksyon. Ang tagumpay nito ay nakasalalay sa (salik). Inaasahan na ang mga rekomendasyong ito ay makatutulong sa pagpapabuti ng "${t}" sa hinaharap.\n\n`;
      final += `SANGGUNIAN\n\n`;
      final += `(Magdagdag ng mga sanggunian dito.)\n\n`;
      final += `========================================\n`;
      final += `TANDAAN: Ang ulat na ito ay may laman na, ngunit maaari mong palitan ang mga nasa ( ) ng tiyak na impormasyon.\n`;
      final += `========================================\n`;
    } else {
      final += `========================================\n`;
      final += `REPORT ON: ${upper}\n`;
      final += `========================================\n\n`;
      final += `INTRODUCTION\n\n`;
      final += `This report provides a comprehensive analysis of the topic "${t}". It aims to explain the key concepts, strategies, and practical applications of "${t}" in the current context.\n\n`;
      final += `DEFINITION AND SCOPE\n\n`;
      final += `"${t}" refers to (provide definition). It encompasses the following aspects: (aspect 1), (aspect 2), and (aspect 3). Understanding these is essential to assess the overall impact of "${t}".\n\n`;
      final += `KEY STRATEGIES\n\n`;
      final += `Many strategies are used to implement "${t}". These include:\n- Strategy A: (description) – focuses on (objective).\n- Strategy B: (description) – aims to (result).\n- Strategy C: (description) – emphasizes (aspect).\nEach has its own strengths and weaknesses that must be considered.\n\n`;
      final += `EXAMPLES AND CASE STUDIES\n\n`;
      final += `Several examples of "${t}" in practical situations:\n- Case 1: (description) – showed (result).\n- Case 2: (description) – highlighted (lesson).\n- Case 3: (description) – proved (implication).\nThese cases demonstrate varying outcomes based on context.\n\n`;
      final += `CHALLENGES AND LIMITATIONS\n\n`;
      final += `Despite efforts, challenges hinder effective implementation of "${t}". These include:\n- Challenge 1: (description) – causes (impact).\n- Challenge 2: (description) – requires (solution).\n- Challenge 3: (description) – limited (resources/knowledge).\nImmediate action is needed to overcome these.\n\n`;
      final += `RECOMMENDATIONS\n\n`;
      final += `Based on the analysis, the following are recommended:\n- Recommendation 1: (action) to (objective).\n- Recommendation 2: (action) to (improve).\n- Recommendation 3: (action) to (address challenge).\n- Recommendation 4: (collaboration) among (stakeholders).\n\n`;
      final += `CONCLUSION\n\n`;
      final += `In conclusion, "${t}" is a significant topic that requires ongoing attention and action. Its success depends on (factor). It is hoped that these recommendations will help improve "${t}" in the future.\n\n`;
      final += `REFERENCES\n\n`;
      final += `(Add references here.)\n\n`;
      final += `========================================\n`;
      final += `NOTE: This report contains content, but you may replace information in ( ) with specific details.\n`;
      final += `========================================\n`;
    }
    return final;
  },

  // ========================================================================
  // 8. POWERPOINT (FIXED)
  // ========================================================================
  isPowerPointRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = [
      'powerpoint', 'power point', 'ppt', 'slides', 'presentation',
      'gumawa ng powerpoint', 'gumawa ng ppt', 'gumawa ng presentation',
      'create powerpoint', 'create ppt', 'create presentation',
      'make powerpoint', 'make ppt', 'make presentation',
      'powerpoint presentation', 'slide presentation',
      'presentation about', 'presentation report',
      'powerpoint report', 'ppt report', 'slides report',
      'report about', 'presentation about', 'ppt about'
    ];
    return keywords.some(k => lower.includes(k));
  },

  buildPowerPointPrompt(prompt, detectedLanguage) {
    const isTagalog = (detectedLanguage === 'tagalog' || detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano');
    let topic = prompt.replace(/powerpoint|power point|ppt|slides|presentation|gumawa ng|create|make|about|report/gi, '').trim();
    if (!topic) topic = 'the given topic';
    let final = '';
    if (isTagalog) {
      final += `Ikaw ay isang AI assistant na gumagawa ng PROPESYONAL na POWERPOINT PRESENTATION.\n\nPAKSA: "${topic}"\n\nGumawa ng isang KOMPLETO at DETALYADONG PowerPoint presentation na may hindi bababa sa 10 slides. Ang bawat slide ay dapat may:\n- Isang MALINAW na pamagat.\n- 3-5 bullet points na may BUONG PANGUNGUSAP at detalyadong impormasyon.\n- Ang nilalaman ay dapat maging tiyak at naaangkop sa paksa.\n\nMAHALAGA: Isulat ang BUONG NILALAMAN ng bawat slide, hindi lamang mga pamagat o outline. Gumamit ng kumpletong mga pangungusap. Ang presentasyon ay dapat nasa Tagalog na wika.\n\nMagsimula sa pamamagitan ng pagsulat ng SLIDE 1: TITLE SLIDE, pagkatapos ay ang mga susunod na slides hanggang sa dulo. Siguraduhing mayroong Introduction, Key Points, Case Studies, Challenges, Recommendations, at Conclusion.\n\nSimulan na ang pagsulat ng kumpletong PowerPoint presentation.`;
    } else {
      final += `You are an AI assistant that creates PROFESSIONAL POWERPOINT PRESENTATIONS.\n\nTOPIC: "${topic}"\n\nCreate a COMPLETE and DETAILED PowerPoint presentation with at least 10 slides. Each slide must have:\n- A CLEAR title.\n- 3-5 bullet points with COMPLETE SENTENCES and detailed information.\n- Content must be specific and relevant to the topic.\n\nIMPORTANT: Write the FULL CONTENT of each slide, not just titles or outlines. Use complete sentences. The presentation must be in English.\n\nStart by writing SLIDE 1: TITLE SLIDE, then proceed to subsequent slides until the end. Ensure there are sections for Introduction, Key Points, Case Studies, Challenges, Recommendations, and Conclusion.\n\nNow start writing the complete PowerPoint presentation.`;
    }
    return final;
  },

  buildPowerPointFallback(prompt, detectedLanguage) {
    const isTagalog = (detectedLanguage === 'tagalog' || detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano');
    let topic = prompt.replace(/powerpoint|power point|ppt|slides|presentation|gumawa ng|create|make|about|report/gi, '').trim();
    if (!topic) topic = 'the given topic';
    const t = topic;
    const upper = t.toUpperCase();

    let slides = [];
    if (isTagalog) {
      slides = [
        { title: 'SLIDE 1: TITLE SLIDE', content: `PAMAGAT: ${upper}\n\nInihanda ni: (Pangalan)\nPetsa: (Petsa)` },
        { title: 'SLIDE 2: TALAAN NG NILALAMAN', content: `1. Panimula\n2. Kahulugan at Saklaw\n3. Mga Pangunahing Estratehiya\n4. Mga Halimbawa at Pag‑aaral ng Kaso\n5. Mga Hamon at Limitasyon\n6. Mga Rekomendasyon\n7. Konklusyon\n8. Sanggunian` },
        { title: 'SLIDE 3: PANIMULA', content: `- Ang "${t}" ay isang mahalagang paksa na may malawak na aplikasyon sa iba't ibang larangan.\n- Layunin ng presentasyong ito na magbigay ng malinaw na pagtalakay sa mga konsepto, estratehiya, at praktikal na implementasyon ng "${t}".\n- Tatalakayin ang kasaysayan, kasalukuyang kalagayan, at mga direksyon sa hinaharap upang magbigay ng komprehensibong pang‑unawa.` },
        { title: 'SLIDE 4: KAHULUGAN AT SAKLAW', content: `- Ang "${t}" ay tumutukoy sa (magbigay ng depinisyon batay sa konteksto).\n- Saklaw nito ang mga sumusunod na bahagi: (bahagi 1), (bahagi 2), at (bahagi 3).\n- Mahalaga ito dahil (ipaliwanag ang kahalagahan).` },
        { title: 'SLIDE 5: MGA PANGUNAHING ESTRATEHIYA', content: `- Estratehiya 1: (paglalarawan ng unang estratehiya) – ito ay nakatuon sa (layunin).\n- Estratehiya 2: (paglalarawan ng ikalawang estratehiya) – ginagamit ito upang (resulta).\n- Estratehiya 3: (paglalarawan ng ikatlong estratehiya) – naglalayong (benepisyo).\n- Ang mga estratehiyang ito ay nagpapakita ng iba't ibang paraan upang maisakatuparan ang "${t}".` },
        { title: 'SLIDE 6: MGA HALIMBAWA AT PAG‑AARAL NG KASO', content: `- Halimbawa 1: (pangalan ng kaso) – ipinakita nito na (resulta).\n- Halimbawa 2: (pangalan ng kaso) – nagbigay‑diin sa (aspeto).\n- Halimbawa 3: (pangalan ng kaso) – nagpapatunay na (aral).\n- Ang mga kasong ito ay nagpapakita ng praktikal na aplikasyon ng "${t}" sa totoong buhay.` },
        { title: 'SLIDE 7: MGA HAMON AT LIMITASYON', content: `- Hamon 1: (paglalarawan ng hamon) – nagdudulot ito ng (epekto).\n- Hamon 2: (paglalarawan ng hamon) – kailangan ng (solusyon).\n- Hamon 3: (paglalarawan ng hamon) – limitado ang (yaman/kaalaman).\n- Upang mapagtagumpayan ang mga ito, kinakailangan ang (estratehiya).` },
        { title: 'SLIDE 8: MGA REKOMENDASYON', content: `- Rekomendasyon 1: Magpatupad ng (aksyon) upang (layunin).\n- Rekomendasyon 2: Palakasin ang (aspeto) sa pamamagitan ng (paraan).\n- Rekomendasyon 3: Magsagawa ng (pananaliksik/pag‑aaral) upang (mapabuti).\n- Rekomendasyon 4: Itaguyod ang (pakikipagtulungan) sa pagitan ng (mga stakeholder).` },
        { title: 'SLIDE 9: KONGKLUSYON', content: `- Buod: Ang "${t}" ay isang kritikal na paksa na nangangailangan ng patuloy na atensyon at aksyon.\n- Pangunahing natuklasan: (buod ng mga pangunahing punto).\n- Mahalagang implikasyon: (epekto sa lipunan/industriya).\n- Pangwakas na mensahe: Ang tagumpay ng "${t}" ay nakasalalay sa (salik).` },
        { title: 'SLIDE 10: SANGGUNIAN', content: `- (Magdagdag ng mga sanggunian at mapagkukunan para sa karagdagang pagbabasa.)` }
      ];
    } else {
      slides = [
        { title: 'SLIDE 1: TITLE SLIDE', content: `TITLE: ${upper}\n\nPresented by: (Name)\nDate: (Date)` },
        { title: 'SLIDE 2: TABLE OF CONTENTS', content: `1. Introduction\n2. Definition and Scope\n3. Key Strategies\n4. Examples and Case Studies\n5. Challenges and Limitations\n6. Recommendations\n7. Conclusion\n8. References` },
        { title: 'SLIDE 3: INTRODUCTION', content: `- "${t}" is an important topic with broad applications across various fields.\n- This presentation aims to provide a clear discussion of the concepts, strategies, and practical implementation of "${t}".\n- It will cover the history, current state, and future directions to give a comprehensive understanding.` },
        { title: 'SLIDE 4: DEFINITION AND SCOPE', content: `- "${t}" refers to (provide definition based on context).\n- It encompasses the following components: (component 1), (component 2), and (component 3).\n- It is important because (explain significance).` },
        { title: 'SLIDE 5: KEY STRATEGIES', content: `- Strategy 1: (description of first strategy) – it focuses on (objective).\n- Strategy 2: (description of second strategy) – used to achieve (result).\n- Strategy 3: (description of third strategy) – aims to (benefit).\n- These strategies demonstrate different approaches to implementing "${t}".` },
        { title: 'SLIDE 6: EXAMPLES AND CASE STUDIES', content: `- Example 1: (name of case) – it demonstrated that (result).\n- Example 2: (name of case) – highlighted (aspect).\n- Example 3: (name of case) – proves that (lesson).\n- These cases show the practical application of "${t}" in real life.` },
        { title: 'SLIDE 7: CHALLENGES AND LIMITATIONS', content: `- Challenge 1: (description of challenge) – it causes (impact).\n- Challenge 2: (description of challenge) – requires (solution).\n- Challenge 3: (description of challenge) – limited (resources/knowledge).\n- To overcome these, it is necessary to (strategy).` },
        { title: 'SLIDE 8: RECOMMENDATIONS', content: `- Recommendation 1: Implement (action) to (objective).\n- Recommendation 2: Strengthen (aspect) through (method).\n- Recommendation 3: Conduct (research/study) to (improve).\n- Recommendation 4: Promote (collaboration) among (stakeholders).` },
        { title: 'SLIDE 9: CONCLUSION', content: `- Summary: "${t}" is a critical topic that requires ongoing attention and action.\n- Key findings: (summary of main points).\n- Important implications: (impact on society/industry).\n- Final message: The success of "${t}" depends on (factor).` },
        { title: 'SLIDE 10: REFERENCES', content: `- (Add references and sources for further reading.)` }
      ];
    }

    let final = '';
    for (const slide of slides) {
      final += '========================================\n';
      final += slide.title + '\n\n';
      final += slide.content + '\n\n';
    }
    final += '========================================\n';
    final += isTagalog 
      ? 'TANDAAN: Ang template na ito ay naglalaman ng mga detalyadong punto. Palitan ang mga nasa ( ) ng tiyak na impormasyon upang mapaganda ang presentasyon.\n'
      : 'NOTE: This template contains detailed points. Replace information in ( ) with specific details to enhance the presentation.\n';
    final += '========================================\n';
    return final;
  },

  // ========================================================================
  // 9. RESUME (FIXED: returns the exact resume from the user's image)
  // ========================================================================
  isResumeRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = [
      'resume', 'cv', 'curriculum vitae', 'resume sample', 'cv sample',
      'gumawa ng resume', 'gumawa ng cv', 'pano gumawa ng resume',
      'paano gumawa ng resume', 'resume format', 'cv format',
      'resume template', 'cv template', 'best resume', 'professional resume',
      'gumawa ng resume ko', 'resume ko', 'cv ko', 'curriculum vitae sample',
      'resume for job', 'resume for work', 'resume for application',
      'gumawa ng curriculum vitae', 'curriculum vitae format',
      'resume example', 'resume examples', 'sample resume', 'sample cv',
      'create resume', 'make resume', 'generate resume'
    ];
    return keywords.some(k => lower.includes(k));
  },

  buildResumeByJob(prompt, detectedLanguage) {
    // Exact resume from the user's image - fully filled, ready to use
    const resumeText = `PROFESSIONAL SUMMARY

Motivated and results-driven professional with extensive experience in customer service, cash handling, and retail operations. Possesses strong communication, teamwork, and problem-solving skills, with a proven ability to thrive and maintain accuracy in fast-paced environments. Seeking a challenging role that offers professional growth and an opportunity to contribute effectively to team success.

PERSONAL PROFILE

- Gender: Female
- Nationality: Filipino
- Date of Birth: February 28, 1998
- Religion: Roman Catholic
- Civil Status: Single
- Language Spoken: English and Tagalog

WORK EXPERIENCES

**Cashier**
SM Hypermarket – SM Tunasan
- Processed cash, credit, and digital payments accurately and efficiently.
- Greeted customers warmly, answered inquiries, and assisted with purchases to ensure a positive shopping experience.
- Conducted opening and closing cash counts daily to guarantee precise financial tracking and accountability.

**Cashier**
SuperCity Alabang Landmark – Alabang, Muntinlupa
- Processed cash, credit, and digital payments accurately and efficiently.
- Greeted customers warmly, answered inquiries, and assisted with purchases to ensure a positive shopping experience.
- Conducted opening and closing cash counts daily to guarantee precise financial tracking and accountability.

Service Crew (Cashier)
Jollibee Shell SLT Alabang
- Took accurate food and beverage orders from customers efficiently in a high-volume setting.
- Prepared food items according to established standard operating procedures and food safety regulations.
- Maintained cleanliness and organization in both dining and kitchen areas to ensure an inviting atmosphere.

EDUCATION

Bachelor of Science in Criminology
Pamantasan ng Lungsod ng Muntinlupa
2018

Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2010 – 2014

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
2004 – 2010

SKILLS

- Cash Handling & POS Operation
- Teamwork & Collaboration
- Sales & Promotions
- Time Management & Adaptability
- Effective Communication

REFERENCES

Angelika Mae Lopez
HR Assistant
09911451130

Czerina Mae Espenesin
Accounting Assistant | Mabex Manufacturing Inc.
09928196248

Menchie Donayre
Graphic Designer
09563892622`;

    const header = 'RESUME';
    const printLabel = 'PRINTING INSTRUCTIONS';
    const printText = `- Use Short Bond Paper (8.5 x 11 inches)
- Font: Arial 11pt (body), Arial 14pt Bold (headers)
- Margins: 1 inch on all sides
- Line Spacing: 1.15
- Print on one side only
- Use high‑quality white bond paper`;

    let final = '';
    final += '================================================================================\n';
    final += '                    [' + header + ' - FOR PRINTING ON SHORT BOND PAPER]\n';
    final += '================================================================================\n\n';
    final += resumeText + '\n\n';
    final += '================================================================================\n\n';
    final += printLabel + '\n' + printText + '\n\n';
    final += '================================================================================\n\n';
    final += 'NOTE: This resume is ready to use. You may replace personal details as needed.\n';
    final += '================================================================================\n';
    return final;
  },

  buildResumePrompt(prompt, detectedLanguage) {
    const lang = detectedLanguage || 'english';
    const isTagalog = (lang === 'tagalog' || lang === 'bisaya' || lang === 'cebuano');
    let final = '';
    final += isTagalog
      ? 'Ikaw ay isang AI assistant na gumagawa ng KOMPLETO at PROPESYONAL na RESUME.\n\nUSER REQUEST: "' + prompt + '"\n\nGumawa ng KUMPLETONG resume template.\n\nIMPORTANTE - DETALYE SA PAPEL AT PAG-FORMAT:\n- Bond Paper: Short (8.5 x 11 inches)\n- Font Style: Arial or Times New Roman\n- Font Size: 11 or 12 points para sa body, 14 or 16 para sa section headers\n- Margins: 1 inch on all sides\n- Gumamit ng makapal na linya (============================) sa pagitan ng major sections\n\nSUNDIN ANG EKSAKTONG PORMAT:\n\n================================================================================\n                    [RESUME - FOR PRINTING ON SHORT BOND PAPER]\n================================================================================\n\nPROFESSIONAL SUMMARY\n\n(A strong professional summary - 3 to 5 sentences)\n\n================================================================================\n\nPERSONAL PROFILE\n\n- Gender: (Gender)\n- Nationality: Filipino\n- Date of Birth: (Birthdate)\n- Religion: (Religion)\n- Civil Status: (Status)\n- Language Spoken: English and Tagalog\n\n================================================================================\n\nWORK EXPERIENCES\n\n**Job Title**\nCompany Name – Location\n(Year) – (Year)\n- Responsibility 1\n- Responsibility 2\n- Responsibility 3\n\n**Job Title**\nCompany Name – Location\n(Year) – (Year)\n- Responsibility 1\n- Responsibility 2\n- Responsibility 3\n\n================================================================================\n\nEDUCATION\n\n(Degree)\n(School Name)\n(Year Graduated)\n\n(High School)\n(School Name)\n(Year Started) – (Year Graduated)\n\n(Elementary)\n(School Name)\n(Year Started) – (Year Graduated)\n\n================================================================================\n\nSKILLS\n\n- (Skill 1)\n- (Skill 2)\n- (Skill 3)\n- (Skill 4)\n- (Skill 5)\n\n================================================================================\n\nREFERENCES\n\n(Name)\n(Position) | (Company)\n(Contact Number)\n\n(Name)\n(Position) | (Company)\n(Contact Number)\n\n(Name)\n(Position) | (Company)\n(Contact Number)\n\n================================================================================\n\nPRINTING INSTRUCTIONS:\n- Use Short Bond Paper (8.5 x 11 inches)\n- Font: Arial 11pt\n- Margins: 1 inch on all sides\n- Print on one side only\n\n================================================================================\n\nMAHALAGA:\n- Ang mga taon ay dapat nasa SUSUNOD NA LINYA pagkatapos ng pangalan ng paaralan.\n- TUMUGON NGAYON.'
      : 'You are an AI assistant that creates COMPLETE and PROFESSIONAL RESUMES.\n\nUSER REQUEST: "' + prompt + '"\n\nCreate a COMPLETE RESUME template.\n\nIMPORTANT - PAPER AND FORMATTING DETAILS:\n- Bond Paper: Short (8.5 x 11 inches)\n- Font Style: Arial or Times New Roman\n- Font Size: 11 or 12 points for body text, 14 or 16 for section headers\n- Margins: 1 inch on all sides\n- Use thick lines (============================) between major sections\n\nFOLLOW THIS EXACT FORMAT:\n\n================================================================================\n                    [RESUME - FOR PRINTING ON SHORT BOND PAPER]\n================================================================================\n\nPROFESSIONAL SUMMARY\n\n(A strong professional summary - 3 to 5 sentences)\n\n================================================================================\n\nPERSONAL PROFILE\n\n- Gender: (Gender)\n- Nationality: Filipino\n- Date of Birth: (Birthdate)\n- Religion: (Religion)\n- Civil Status: (Status)\n- Language Spoken: English and Tagalog\n\n================================================================================\n\nWORK EXPERIENCES\n\n**Job Title**\nCompany Name – Location\n(Year) – (Year)\n- Responsibility 1\n- Responsibility 2\n- Responsibility 3\n\n**Job Title**\nCompany Name – Location\n(Year) – (Year)\n- Responsibility 1\n- Responsibility 2\n- Responsibility 3\n\n================================================================================\n\nEDUCATION\n\n(Degree)\n(School Name)\n(Year Graduated)\n\n(High School)\n(School Name)\n(Year Started) – (Year Graduated)\n\n(Elementary)\n(School Name)\n(Year Started) – (Year Graduated)\n\n================================================================================\n\nSKILLS\n\n- (Skill 1)\n- (Skill 2)\n- (Skill 3)\n- (Skill 4)\n- (Skill 5)\n\n================================================================================\n\nREFERENCES\n\n(Name)\n(Position) | (Company)\n(Contact Number)\n\n(Name)\n(Position) | (Company)\n(Contact Number)\n\n(Name)\n(Position) | (Company)\n(Contact Number)\n\n================================================================================\n\nPRINTING INSTRUCTIONS:\n- Use Short Bond Paper (8.5 x 11 inches)\n- Font: Arial 11pt\n- Margins: 1 inch on all sides\n- Print on one side only\n\n================================================================================\n\nIMPORTANT:\n- YEARS must be on the NEXT LINE after the school name.\n- RESPOND NOW.';
    return final;
  },

  buildResumeFallback(prompt, detectedLanguage) {
    const lang = detectedLanguage || 'english';
    const isTagalog = (lang === 'tagalog' || lang === 'bisaya' || lang === 'cebuano');
    let final = '';
    final += '================================================================================\n';
    final += isTagalog ? '                    [RESUME - PAUNANG TEMPLATE]\n' : '                    [RESUME - PRELIMINARY TEMPLATE]\n';
    final += '================================================================================\n\n';
    final += isTagalog ? 'PROFESSIONAL SUMMARY\n\n(Maglagay ng maikling buod ng iyong propesyonal na background.)\n\n' : 'PROFESSIONAL SUMMARY\n\n(Provide a brief summary of your professional background.)\n\n';
    final += '================================================================================\n\n';
    final += isTagalog ? 'PERSONAL PROFILE\n\n- Kasarian: (Kasarian)\n- Nasyonalidad: Filipino\n- Petsa ng Kapanganakan: (Petsa)\n- Relihiyon: (Relihiyon)\n- Katayuang Sibil: (Status)\n- Wikang Sinasalita: English at Tagalog\n\n' : 'PERSONAL PROFILE\n\n- Gender: (Gender)\n- Nationality: Filipino\n- Date of Birth: (Birthdate)\n- Religion: (Religion)\n- Civil Status: (Status)\n- Language Spoken: English and Tagalog\n\n';
    final += '================================================================================\n\n';
    final += isTagalog ? 'WORK EXPERIENCES\n\n**Job Title**\nCompany Name – Location\n(Year) – (Year)\n- Responsibilidad 1\n- Responsibilidad 2\n- Responsibilidad 3\n\n' : 'WORK EXPERIENCES\n\n**Job Title**\nCompany Name – Location\n(Year) – (Year)\n- Responsibility 1\n- Responsibility 2\n- Responsibility 3\n\n';
    final += '================================================================================\n\n';
    final += isTagalog ? 'EDUCATION\n\n(Degree)\n(School Name)\n(Year Graduated)\n\n(High School)\n(School Name)\n(Year Started) – (Year Graduated)\n\n(Elementary)\n(School Name)\n(Year Started) – (Year Graduated)\n\n' : 'EDUCATION\n\n(Degree)\n(School Name)\n(Year Graduated)\n\n(High School)\n(School Name)\n(Year Started) – (Year Graduated)\n\n(Elementary)\n(School Name)\n(Year Started) – (Year Graduated)\n\n';
    final += '================================================================================\n\n';
    final += isTagalog ? 'SKILLS\n\n- (Kasanayan 1)\n- (Kasanayan 2)\n- (Kasanayan 3)\n- (Kasanayan 4)\n- (Kasanayan 5)\n\n' : 'SKILLS\n\n- (Skill 1)\n- (Skill 2)\n- (Skill 3)\n- (Skill 4)\n- (Skill 5)\n\n';
    final += '================================================================================\n\n';
    final += isTagalog ? 'REFERENCES\n\n(Name)\n(Position) | (Company)\n(Contact Number)\n\n' : 'REFERENCES\n\n(Name)\n(Position) | (Company)\n(Contact Number)\n\n';
    final += '================================================================================\n\n';
    final += isTagalog ? 'INSTRUKSYON SA PAGPRINT:\n- Gumamit ng Short Bond Paper (8.5 x 11 inches)\n- Font: Arial 11pt\n- Margins: 1 inch on all sides\n- Print on one side only\n\n' : 'PRINTING INSTRUCTIONS:\n- Use Short Bond Paper (8.5 x 11 inches)\n- Font: Arial 11pt\n- Margins: 1 inch on all sides\n- Print on one side only\n\n';
    final += '================================================================================\n\n';
    final += isTagalog ? 'TANDAAN: Ito ay isang paunang template. Palitan ang mga nasa ( ) ng iyong sariling detalye.' : 'NOTE: This is a preliminary template. Replace the information in ( ) with your own details.';
    final += '\n\n================================================================================\n';
    return final;
  },

  // ========================================================================
  // 10. LETTERS
  // ========================================================================
  isLetterRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = [
      'application letter', 'cover letter', 'resignation letter', 'resign letter',
      'job application', 'applying for', 'apply letter', 'letter of intent',
      'letter of application', 'employment letter', 'job letter',
      'gumawa ng application letter', 'gumawa ng cover letter',
      'gumawa ng resignation letter', 'mag-apply', 'magresign',
      'application letter sample', 'resignation letter sample',
      'pano gumawa ng application letter', 'pano gumawa ng resignation letter',
      'paano gumawa ng application letter', 'paano gumawa ng resignation letter',
      'sample application letter', 'sample resignation letter',
      'application letter for', 'resignation letter for',
      'cover letter for', 'job application letter',
      'letter of application', 'intent letter', 'intent to apply',
      'appointment letter', 'promotion letter', 'transfer letter',
      'gumawa ng sulat', 'application', 'resignation', 'cover letter',
      'job application letter', 'letter for work', 'work application',
      'speech', 'graduation speech', 'wedding speech', 'eulogy', 'campaign speech',
      'talumpati', 'pagsasalita', 'speech for', 'speech about', 'commencement speech',
      'valedictory speech', 'salutatory speech', 'keynote speech', 'motivational speech',
      'recommendation letter', 'excuse letter', 'appreciation letter',
      'complaint letter', 'request letter', 'invitation letter', 'apology letter',
      'thank you letter', 'thanks letter', 'thank you message', 'thanks message',
      'liham pasasalamat', 'pasasalamat', 'thank you', 'thanks',
      'gumawa ng thank you letter', 'gumawa ng liham pasasalamat',
      'gumawa ng appreciation letter', 'appreciation',
      'liham ng pasasalamat', 'salamat letter', 'salamat na liham',
      'thank you note', 'note of thanks', 'gratitude letter',
      'sulat pasalamat', 'sulat pasasalamat', 'pasalamat',
      'salamat nga sulat', 'salamat nga letra',
      'magpasalamat', 'pagpasalamat', 'pagpapasalamat',
      'sulat ng pasasalamat', 'liham ng pagpapasalamat',
      'love letter', 'love letters', 'liham pag-ibig', 'liham ng pag-ibig',
      'gumawa ng love letter', 'gumawa ng liham pag-ibig',
      'create love letter', 'write love letter', 'love message',
      'romantic letter', 'letter of love', 'pag-ibig na sulat',
      'sulat ng pag-ibig', 'sulat pag-ibig', 'love note',
      'romantic message', 'love letter for', 'love letter to',
      'long love letter', 'formal love letter', 'deep love letter',
      'heartfelt love letter', 'sweet love letter',
      'essay', 'research paper', 'term paper', 'thesis', 'dissertation',
      'reaction paper', 'reflection paper', 'position paper', 'concept paper',
      'gumawa ng essay', 'gumawa ng research', 'gumawa ng term paper',
      'essay about', 'paper about', 'research about',
      'business letter', 'formal letter', 'official letter', 'professional letter',
      'cover letter for business', 'letter of inquiry', 'letter of interest',
      'proposal letter', 'sales letter', 'collection letter',
      'permission letter', 'consent letter', 'excuse letter for school',
      'parent consent letter', 'school letter', 'teacher letter',
      'affidavit', 'certification letter', 'indemnity letter', 'undertaking letter',
      'government letter', 'court letter', 'legal letter',
      'personal letter', 'friendly letter', 'congratulatory letter',
      'condolence letter', 'sympathy letter', 'get well letter',
      'apology letter', 'forgiveness letter',
      'memo', 'memorandum', 'report', 'minutes of meeting',
      'agenda', 'resolution', 'petition', 'manifesto',
      'sulat', 'liham', 'papel', 'talumpati', 'ulat',
      'gumawa ng sulat', 'gumawa ng papel', 'gumawa ng talumpati',
      'liham para sa', 'sulat para sa', 'papel tungkol sa'
    ];
    return keywords.some(k => lower.includes(k));
  },

  isLetterWithDetails(prompt) {
    const lower = prompt.toLowerCase();
    const detailIndicators = [
      'position', 'posisyon', 'company', 'kumpanya', 'school', 'eskuwela',
      'course', 'kurso', 'experience', 'karanasan', 'graduate', 'nagtapos',
      'teacher', 'engineer', 'nurse', 'accountant', 'cashier', 'manager',
      'supervisor', 'staff', 'worker', 'employee', 'deped', 'doh', 'dswd',
      'call center', 'bpo', 'factory', 'hospital', 'clinic', 'school',
      'university', 'college', 'elementary', 'high school', 'senior high',
      'bsed', 'beed', 'bsn', 'bsba', 'bsit', 'bscs', 'bsa', 'bse',
      'civil service', 'license', 'board exam', 'prc', 'tesda',
      'kakayahan', 'skills', 'ability', 'strengths', 'talents',
      'nagtatrabaho', 'work', 'job', 'career', 'profession',
      'trainer', 'pca', 'coconut', 'agriculture', 'farming',
      'name', 'pangalan', 'address', 'contact', 'email'
    ];
    let matchCount = 0;
    for (const indicator of detailIndicators) {
      if (lower.includes(indicator)) matchCount++;
    }
    return matchCount >= 2 || lower.length > 40;
  },

  buildLetterTypeDetection(prompt) {
    const lower = prompt.toLowerCase();
    if (lower.includes('love') || lower.includes('pag-ibig') || lower.includes('romantic')) {
      return 'love_letter';
    } else if (lower.includes('resignation') || lower.includes('resign') || lower.includes('magresign')) {
      return 'resignation';
    } else if (lower.includes('application') || lower.includes('apply') || lower.includes('mag-apply') || lower.includes('job')) {
      return 'application';
    } else if (lower.includes('thank you') || lower.includes('pasasalamat') || lower.includes('salamat') || lower.includes('appreciation')) {
      return 'thank_you';
    } else if (lower.includes('speech') || lower.includes('talumpati') || lower.includes('graduation') || lower.includes('wedding')) {
      return 'speech';
    } else if (lower.includes('recommendation') || lower.includes('rekomendasyon')) {
      return 'recommendation';
    } else if (lower.includes('excuse') || lower.includes('excuse letter') || lower.includes('paumanhin')) {
      return 'excuse';
    } else if (lower.includes('complaint') || lower.includes('reklamo')) {
      return 'complaint';
    } else if (lower.includes('request') || lower.includes('kahilingan') || lower.includes('hiling')) {
      return 'request';
    } else if (lower.includes('invitation') || lower.includes('imbita') || lower.includes('anyaya')) {
      return 'invitation';
    } else if (lower.includes('apology') || lower.includes('sorry') || lower.includes('patawad')) {
      return 'apology';
    } else if (lower.includes('essay') || lower.includes('research') || lower.includes('paper') || lower.includes('thesis')) {
      return 'academic';
    } else if (lower.includes('business') || lower.includes('formal') || lower.includes('official')) {
      return 'business';
    } else if (lower.includes('permission') || lower.includes('consent') || lower.includes('pahintulot')) {
      return 'permission';
    } else if (lower.includes('condolence') || lower.includes('sympathy') || lower.includes('pakikiramay')) {
      return 'condolence';
    } else if (lower.includes('congratulation') || lower.includes('bati') || lower.includes('pagbati')) {
      return 'congratulation';
    } else {
      return 'general';
    }
  },

  buildLetterPrompt(prompt, detectedLanguage) {
    const langName = this.getLanguageName(detectedLanguage);
    const letterType = this.buildLetterTypeDetection(prompt);
    let final = '';
    
    if (detectedLanguage === 'tagalog' || detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano') {
      final += 'Ikaw ay isang AI assistant na gumagawa ng PERSONALIZED na sulat, papel, o talumpati.\n\n';
      final += 'AUTOMATIKONG gumawa ng dokumento batay sa hiling ng user.\n';
      final += 'HUWAG nang magtanong ng mga detalye.\n';
      final += 'Ang mga detalye na kailangan ay ilagay sa ( ) para punan ng user.\n\n';
      final += 'URI NG DOKUMENTO: ' + letterType.toUpperCase() + '\n\n';
      final += 'USER REQUEST: "' + prompt + '"\n\n';
      final += 'Gumawa ng isang PROPESYONAL, MALINAW, at KOMPLETONG ' + letterType.toUpperCase() + '.\n';
      final += 'Gumamit ng FORMAL at PROPESYONAL na tono.\n';
      final += 'Ang dokumento ay dapat nasa ' + langName.toUpperCase() + ' na wika.\n\n';
      
      switch(letterType) {
        case 'love_letter':
          final += 'Gumawa ng ROMANTIC at HEARTFELT na love letter.\n';
          final += 'Dapat itong EMOSYONAL, TAOS-PUSO, at KUMPLETO.\n\n';
          final += 'Format:\n';
          final += 'My Dearest (Name),\n\n';
          final += '(Opening - Expression of love and admiration)\n\n';
          final += '(Body - Memories, qualities, dreams together)\n\n';
          final += '(Closing - Reaffirmation of love)\n\n';
          final += 'Forever yours,\n';
          final += '(Your Name)\n\n';
          break;
        case 'speech':
          final += 'Gumawa ng INSPIRATIONAL at MOTIVATIONAL na talumpati.\n';
          final += 'Dapat itong MAKABULUHAN at NAKAKAIYAK o NAKAKAINSPIRE.\n\n';
          break;
        case 'resignation':
          final += 'Gumawa ng PROFESSIONAL na resignation letter.\n';
          final += 'Dapat itong MAGALANG, MALINAW, at PROPESYONAL.\n\n';
          break;
        case 'application':
          final += 'Gumawa ng FORMAL na application letter.\n';
          final += 'Dapat itong NAKAKAHIKAYAT at PROPESYONAL.\n\n';
          break;
        case 'thank_you':
          final += 'Gumawa ng TAOS-PUSO na thank you letter.\n';
          final += 'Dapat itong NAGPAPASALAMAT at KUMPLETO.\n\n';
          break;
        case 'academic':
          final += 'Gumawa ng ACADEMIC na papel o essay.\n';
          final += 'Dapat itong MASUSURI, MALINAW, at KUMPLETO.\n\n';
          break;
        default:
          final += 'Gumawa ng FORMAL at PROPESYONAL na dokumento.\n\n';
      }
      
      final += 'SUNDIN ANG PORMAT:\n\n';
      final += '========================================\n';
      final += '[Pamagat o Heading]\n\n';
      final += '[Katawan ng Dokumento - KUMPLETO at DETALYADO]\n\n';
      final += '[Pagtatapos - Lagda o Pirmahan]\n';
      final += '========================================\n\n';
      final += 'Tiyakin na KUMPLETO ang lahat ng bahagi.\n';
      final += 'HUWAG PUTULIN ANG SAGOT.\n';
      final += 'TUMUGON NGAYON SA ' + langName.toUpperCase() + '.';
    } else {
      final += 'You are an AI assistant that creates PERSONALIZED letters, papers, or speeches.\n\n';
      final += 'AUTOMATICALLY create a document based on the user\'s request.\n';
      final += 'DO NOT ask for details anymore.\n';
      final += 'Place needed details in ( ) for the user to fill in.\n\n';
      final += 'DOCUMENT TYPE: ' + letterType.toUpperCase() + '\n\n';
      final += 'USER REQUEST: "' + prompt + '"\n\n';
      final += 'Create a PROFESSIONAL, CLEAR, and COMPLETE ' + letterType.toUpperCase() + '.\n';
      final += 'Use a FORMAL and PROFESSIONAL tone.\n';
      final += 'The document should be in ' + langName.toUpperCase() + ' language.\n\n';
      
      switch(letterType) {
        case 'love_letter':
          final += 'Create a ROMANTIC and HEARTFELT love letter.\n';
          final += 'It should be EMOTIONAL, SINCERE, and COMPLETE.\n\n';
          final += 'Format:\n';
          final += 'My Dearest (Name),\n\n';
          final += '(Opening - Expression of love and admiration)\n\n';
          final += '(Body - Memories, qualities, dreams together)\n\n';
          final += '(Closing - Reaffirmation of love)\n\n';
          final += 'Forever yours,\n';
          final += '(Your Name)\n\n';
          break;
        case 'speech':
          final += 'Create an INSPIRATIONAL and MOTIVATIONAL speech.\n';
          final += 'It should be MEANINGFUL and INSPIRING.\n\n';
          break;
        case 'resignation':
          final += 'Create a PROFESSIONAL resignation letter.\n';
          final += 'It should be RESPECTFUL, CLEAR, and PROFESSIONAL.\n\n';
          break;
        case 'application':
          final += 'Create a FORMAL application letter.\n';
          final += 'It should be PERSUASIVE and PROFESSIONAL.\n\n';
          break;
        case 'thank_you':
          final += 'Create a SINCERE thank you letter.\n';
          final += 'It should be GRATEFUL and COMPLETE.\n\n';
          break;
        case 'academic':
          final += 'Create an ACADEMIC paper or essay.\n';
          final += 'It should be ANALYTICAL, CLEAR, and COMPLETE.\n\n';
          break;
        default:
          final += 'Create a FORMAL and PROFESSIONAL document.\n\n';
      }
      
      final += 'FOLLOW THIS FORMAT:\n\n';
      final += '========================================\n';
      final += '[Title or Heading]\n\n';
      final += '[Body of the Document - COMPLETE and DETAILED]\n\n';
      final += '[Closing - Signature]\n';
      final += '========================================\n\n';
      final += 'Make sure ALL PARTS are COMPLETE.\n';
      final += 'DO NOT CUT OFF THE RESPONSE.\n';
      final += 'RESPOND NOW IN ' + langName.toUpperCase() + '.';
    }
    return final;
  },

  buildLetterResponse(prompt, detectedLanguage) {
    const langName = this.getLanguageName(detectedLanguage);
    const letterType = this.buildLetterTypeDetection(prompt);
    let final = '';
    
    if (detectedLanguage === 'tagalog' || detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano') {
      final += 'Gumawa ka ng KOMPLETO at PERSONALIZED na dokumento.\n\n';
      final += 'AUTOMATIKONG gumawa ng dokumento batay sa hiling ng user.\n';
      final += 'HUWAG nang magtanong ng mga detalye.\n';
      final += 'Ang mga detalye na kailangan ay ilagay sa ( ) para punan ng user.\n\n';
      final += 'URI NG DOKUMENTO: ' + letterType.toUpperCase() + '\n\n';
      final += 'MGA DETALYE NG USER: "' + prompt + '"\n\n';
      final += 'Gumawa ng isang PROPESYONAL, MALINAW, at KOMPLETONG dokumento.\n\n';
      
      switch(letterType) {
        case 'love_letter':
          final += 'Gumawa ng ROMANTIC at HEARTFELT na love letter.\n';
          final += 'Dapat itong EMOSYONAL, TAOS-PUSO, at KUMPLETO.\n\n';
          final += 'Format:\n';
          final += 'My Dearest (Name),\n\n';
          final += '(Opening - Expression of love and admiration)\n\n';
          final += '(Body - Memories, qualities, dreams together)\n\n';
          final += '(Closing - Reaffirmation of love)\n\n';
          final += 'Forever yours,\n';
          final += '(Your Name)\n\n';
          break;
        case 'speech':
          final += 'Gumawa ng INSPIRATIONAL at MOTIVATIONAL na talumpati.\n';
          final += 'Dapat itong MAKABULUHAN at NAKAKAINSPIRE.\n\n';
          break;
        case 'resignation':
          final += 'Gumawa ng PROFESSIONAL na resignation letter.\n';
          final += 'Dapat itong MAGALANG, MALINAW, at PROPESYONAL.\n\n';
          break;
        case 'application':
          final += 'Gumawa ng FORMAL na application letter.\n';
          final += 'Dapat itong NAKAKAHIKAYAT at PROPESYONAL.\n\n';
          break;
        case 'thank_you':
          final += 'Gumawa ng TAOS-PUSO na thank you letter.\n';
          final += 'Dapat itong NAGPAPASALAMAT at KUMPLETO.\n\n';
          break;
        case 'academic':
          final += 'Gumawa ng ACADEMIC na papel o essay.\n';
          final += 'Dapat itong MASUSURI, MALINAW, at KUMPLETO.\n\n';
          break;
        default:
          final += 'Gumawa ng FORMAL at PROPESYONAL na dokumento.\n\n';
      }
      
      final += 'SUNDIN ANG PORMAT:\n\n';
      final += '========================================\n';
      final += '[Pamagat o Heading]\n\n';
      final += '[Katawan ng Dokumento - KUMPLETO at DETALYADO]\n\n';
      final += '[Pagtatapos - Lagda o Pirmahan]\n';
      final += '========================================\n\n';
      final += 'Tiyakin na KUMPLETO ang lahat ng bahagi.\n';
      final += 'HUWAG PUTULIN ANG SAGOT.\n';
      final += 'Gamitin ang mga detalye mula sa user upang mapunan ang mga ( ).\n';
      final += 'TUMUGON NGAYON SA ' + langName.toUpperCase() + '.';
    } else {
      final += 'Create a COMPLETE and PERSONALIZED document.\n\n';
      final += 'AUTOMATICALLY create a document based on the user\'s request.\n';
      final += 'DO NOT ask for details anymore.\n';
      final += 'Place needed details in ( ) for the user to fill in.\n\n';
      final += 'DOCUMENT TYPE: ' + letterType.toUpperCase() + '\n\n';
      final += 'USER DETAILS: "' + prompt + '"\n\n';
      final += 'Create a PROFESSIONAL, CLEAR, and COMPLETE document.\n\n';
      
      switch(letterType) {
        case 'love_letter':
          final += 'Create a ROMANTIC and HEARTFELT love letter.\n';
          final += 'It should be EMOTIONAL, SINCERE, and COMPLETE.\n\n';
          final += 'Format:\n';
          final += 'My Dearest (Name),\n\n';
          final += '(Opening - Expression of love and admiration)\n\n';
          final += '(Body - Memories, qualities, dreams together)\n\n';
          final += '(Closing - Reaffirmation of love)\n\n';
          final += 'Forever yours,\n';
          final += '(Your Name)\n\n';
          break;
        case 'speech':
          final += 'Create an INSPIRATIONAL and MOTIVATIONAL speech.\n';
          final += 'It should be MEANINGFUL and INSPIRING.\n\n';
          break;
        case 'resignation':
          final += 'Create a PROFESSIONAL resignation letter.\n';
          final += 'It should be RESPECTFUL, CLEAR, and PROFESSIONAL.\n\n';
          break;
        case 'application':
          final += 'Create a FORMAL application letter.\n';
          final += 'It should be PERSUASIVE and PROFESSIONAL.\n\n';
          break;
        case 'thank_you':
          final += 'Create a SINCERE thank you letter.\n';
          final += 'It should be GRATEFUL and COMPLETE.\n\n';
          break;
        case 'academic':
          final += 'Create an ACADEMIC paper or essay.\n';
          final += 'It should be ANALYTICAL, CLEAR, and COMPLETE.\n\n';
          break;
        default:
          final += 'Create a FORMAL and PROFESSIONAL document.\n\n';
      }
      
      final += 'FOLLOW THIS FORMAT:\n\n';
      final += '========================================\n';
      final += '[Title or Heading]\n\n';
      final += '[Body of the Document - COMPLETE and DETAILED]\n\n';
      final += '[Closing - Signature]\n';
      final += '========================================\n\n';
      final += 'Make sure ALL PARTS are COMPLETE.\n';
      final += 'DO NOT CUT OFF THE RESPONSE.\n';
      final += 'Use the details from the user to fill in the ( ).\n';
      final += 'RESPOND NOW IN ' + langName.toUpperCase() + '.';
    }
    return final;
  },

  // ========================================================================
  // 11. REAL‑TIME / TIME
  // ========================================================================
  isRealtimeQuestion(prompt) {
    const lower = prompt.toLowerCase();
    const timeKeywords = ['oras', 'time', 'petsa', 'date', 'anong oras', 'what time', 'what is the time', 'anong petsa', 'what date', 'what is the date', 'real time', 'real-time', 'kasalukuyang oras', 'current time', 'current date', 'anong oras na', 'what time is it'];
    if (timeKeywords.some(k => lower.includes(k))) return true;
    const newsKeywords = ['balita', 'news', 'update', 'latest', 'pinakahuling', 'nangyari', 'happening', 'events', 'pangyayari', 'ganap', 'senado', 'senate', 'kongreso', 'congress', 'pulitika', 'politics', 'gobyerno', 'government', 'presidente', 'president', 'krisis', 'crisis', 'problema', 'problem', 'situwasyon', 'situation', 'report', 'reports', 'ulat'];
    if (newsKeywords.some(k => lower.includes(k))) return true;
    const weatherKeywords = ['panahon', 'weather', 'ulan', 'rain', 'bagyo', 'typhoon', 'init', 'heat', 'lamig', 'cold', 'baha', 'flood', 'lindol', 'earthquake'];
    if (weatherKeywords.some(k => lower.includes(k))) return true;
    return false;
  },

  async handleRealtimeQuestion(senderId, prompt, token) {
    if (this.isExactTimeRequest(prompt)) {
      await this.handleTimeRequest(senderId, prompt, token);
      return;
    }
    const detectedLanguage = this.detectLanguage(prompt);
    try {
      const encodedPrompt = encodeURIComponent(prompt);
      const apiUrl = 'https://yin-api.vercel.app/ai/copilot?message=' + encodedPrompt + '&model=default';
      const response = await axios.get(apiUrl, { timeout: 30000, headers: { 'Accept': 'application/json' } });
      const data = response.data;
      if (data && data.answer) {
        let cleanResponse = this.cleanResponse(data.answer);
        await this.sendChunks(senderId, cleanResponse, token);
        return;
      }
    } catch (error) {
      console.error('[RealTime] Yin API failed:', error.message);
    }
    try {
      const encodedPrompt = encodeURIComponent(prompt);
      const apiUrl = 'https://free-goat-api.onrender.com/rapidai?message=' + encodedPrompt;
      const response = await axios.get(apiUrl, { timeout: 30000, headers: { 'Accept': 'application/json' } });
      const data = response.data;
      if (data.status === true && data.result) {
        let cleanResponse = this.cleanResponse(data.result);
        await this.sendChunks(senderId, cleanResponse, token);
        return;
      }
    } catch (error) {
      console.error('[RealTime] Free-Goat API failed:', error.message);
    }
    let errorMessage = 'Unable to fetch real-time information. Please try again later.';
    if (detectedLanguage === 'tagalog') errorMessage = 'Hindi makuha ang real-time na impormasyon. Subukan muli mamaya.';
    else if (detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano') errorMessage = 'Dili makuha ang real-time nga impormasyon. Sulayi pag-usab.';
    await sendMessage(senderId, { text: errorMessage }, token);
  },

  isExactTimeRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['oras', 'time', 'petsa', 'date', 'anong oras', 'what time', 'what is the time', 'anong petsa', 'what date', 'what is the date', 'real time', 'real-time', 'kasalukuyang oras', 'current time', 'current date', 'anong oras na', 'what time is it'];
    return keywords.some(k => lower.includes(k));
  },

  async handleTimeRequest(senderId, prompt, token) {
    const detectedLanguage = this.detectLanguage(prompt);
    try {
      const response = await axios.get('https://worldtimeapi.org/api/timezone/Asia/Manila', { timeout: 10000 });
      const data = response.data;
      const datetime = data.datetime;
      const date = new Date(datetime);
      let message;
      if (detectedLanguage === 'tagalog') {
        const day = date.toLocaleString('fil-PH', { weekday: 'long' });
        const month = date.toLocaleString('fil-PH', { month: 'long' });
        const hour = date.getHours();
        const minute = date.getMinutes();
        const seconds = date.getSeconds();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        message = 'Real-Time sa Pilipinas\n\nPetsa: ' + day + ', ' + month + ' ' + date.getDate() + ', ' + date.getFullYear() + '\nOras: ' + hour12 + ':' + minute.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0') + ' ' + ampm + ' (PHT)\nTimezone: Asia/Manila (UTC+8)';
      } else if (detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano') {
        const day = date.toLocaleString('en-PH', { weekday: 'long' });
        const month = date.toLocaleString('en-PH', { month: 'long' });
        const hour = date.getHours();
        const minute = date.getMinutes();
        const seconds = date.getSeconds();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        message = 'Real-Time sa Pilipinas\n\nPetsa: ' + day + ', ' + month + ' ' + date.getDate() + ', ' + date.getFullYear() + '\nOras: ' + hour12 + ':' + minute.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0') + ' ' + ampm + ' (PHT)\nTimezone: Asia/Manila (UTC+8)';
      } else {
        const day = date.toLocaleString('en-PH', { weekday: 'long' });
        const month = date.toLocaleString('en-PH', { month: 'long' });
        const hour = date.getHours();
        const minute = date.getMinutes();
        const seconds = date.getSeconds();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        message = 'Real-Time in the Philippines\n\nDate: ' + day + ', ' + month + ' ' + date.getDate() + ', ' + date.getFullYear() + '\nTime: ' + hour12 + ':' + minute.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0') + ' ' + ampm + ' (PHT)\nTimezone: Asia/Manila (UTC+8)';
      }
      await this.sendChunks(senderId, message, token);
    } catch (error) {
      console.error('[Time] WorldTimeAPI failed:', error.message);
      try {
        const now = new Date();
        let message;
        if (detectedLanguage === 'tagalog') {
          const fallbackTime = now.toLocaleString('fil-PH', { timeZone: 'Asia/Manila' });
          message = 'Real-Time sa Pilipinas\n\nPetsa: ' + fallbackTime + '\nTimezone: Asia/Manila (UTC+8)\nNote: Local system time';
        } else if (detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano') {
          const fallbackTime = now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
          message = 'Real-Time sa Pilipinas\n\nPetsa: ' + fallbackTime + '\nTimezone: Asia/Manila (UTC+8)\nNote: Local system time';
        } else {
          const fallbackTime = now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
          message = 'Real-Time in the Philippines\n\nDate: ' + fallbackTime + '\nTimezone: Asia/Manila (UTC+8)\nNote: Local system time';
        }
        await this.sendChunks(senderId, message, token);
      } catch (fallbackError) {
        const errorMsg = detectedLanguage === 'tagalog' ? 'Hindi makuha ang real-time na oras. Subukan muli mamaya.' :
                        (detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano') ? 'Dili makuha ang real-time nga oras. Sulayi pag-usab.' :
                        'Unable to fetch real-time time. Please try again later.';
        await sendMessage(senderId, { text: errorMsg }, token);
      }
    }
  },

  // ========================================================================
  // 12. LYRICS
  // ========================================================================
  isLyricsRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['lyrics', 'lyric', 'letra', 'song lyrics', 'lyrics of', 'lyrics ng', 'letra ng', 'lyrics for', 'lyrics to', 'full lyrics', 'complete lyrics', 'kanta', 'awit', 'awitin'];
    return keywords.some(k => lower.includes(k));
  },

  async handleLyricsSearch(senderId, prompt, token) {
    let searchTerm = prompt;
    const removeKeywords = ['lyrics', 'lyric', 'letra', 'song lyrics', 'lyrics of', 'lyrics ng', 'letra ng', 'lyrics for', 'lyrics to', 'full lyrics', 'complete lyrics', 'kanta', 'awit', 'awitin'];
    for (const keyword of removeKeywords) {
      if (searchTerm.toLowerCase().includes(keyword)) {
        searchTerm = searchTerm.toLowerCase().replace(keyword, '').trim();
        break;
      }
    }
    let title = searchTerm;
    let artist = '';
    const parts = searchTerm.split(/\s+by\s+|\s+-\s+|\s+of\s+|\s+ng\s+|\s+ni\s+/i);
    if (parts.length > 1) {
      title = parts[0].trim();
      artist = parts[1].trim();
    }
    if (!title) {
      await sendMessage(senderId, { text: 'Lyrics Search\n\nUsage: lyrics [song title] by [artist]\n\nExamples:\nlyrics lihim by arthur miguel\nletra ng lihim\nkanta ni arthur miguel' }, token);
      return;
    }
    try {
      let query = title;
      if (artist) query += ' ' + artist;
      const encodedQuery = encodeURIComponent(query);
      const apiUrl = 'https://api-library-kohi-production.up.railway.app/api/lyrics?query=' + encodedQuery;
      const response = await axios.get(apiUrl, { timeout: 15000, headers: { 'Accept': 'application/json' } });
      const data = response.data;
      if (!data.status || !data.data) {
        await sendMessage(senderId, { text: 'Walang nakitang lyrics para sa "' + title + '".\n\nSubukan:\n- Tingnan ang spelling\n- Magdagdag ng pangalan ng artist\n- Gamitin ang format: lyrics [title] by [artist]' }, token);
        return;
      }
      const lyricsData = data.data;
      const songTitle = lyricsData.title || title;
      const songArtist = lyricsData.artist || artist || 'Hindi Kilalang Artist';
      const lyrics = lyricsData.lyrics || 'Hindi available ang lyrics.';
      let formattedLyrics = this.formatLyrics(lyrics);
      let message = songTitle + '\nArtist: ' + songArtist + '\n\n' + formattedLyrics + '\n\nKumpletong lyrics\n' + new Date().toLocaleString('fil-PH', { timeZone: 'Asia/Manila' });
      await this.sendChunks(senderId, message, token);
    } catch (error) {
      console.error('[Lyrics] Error:', error.message);
      await sendMessage(senderId, { text: 'Error sa pagkuha ng lyrics para sa "' + title + '". Subukan muli mamaya.' }, token);
    }
  },

  formatLyrics(lyrics) {
    let formatted = lyrics;
    if (!formatted.includes('[Verse') && !formatted.includes('[Chorus') && !formatted.includes('[Bridge')) {
      const lines = formatted.split('\n');
      let sectionCount = 0;
      let newLines = [];
      let isFirst = true;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') { newLines.push(''); continue; }
        if (isFirst && line.length > 0) {
          newLines.push('[Verse ' + (sectionCount + 1) + ']');
          newLines.push(line);
          isFirst = false;
          sectionCount++;
        } else if (line.length > 0 && (line.match(/[.!?]$/) || i === lines.length - 1)) {
          if (i > 0 && lines[i-1] === line) {
            newLines.push('[Chorus]');
            newLines.push(line);
          } else {
            newLines.push(line);
          }
        } else {
          newLines.push(line);
        }
      }
      formatted = newLines.join('\n');
    }
    return formatted;
  },

  // ========================================================================
  // 13. IMAGE GENERATION
  // ========================================================================
  isGenerateCommand(prompt) {
    const commands = ['generate', 'image', 'img', 'show', 'gumawa ng image', 'gumawa ng larawan', 'ipakita ang image', 'ipakita ang larawan'];
    const lower = prompt.toLowerCase().trim();
    return commands.some(cmd => lower.startsWith(cmd + ' ') || lower === cmd);
  },

  isImageRequest(prompt) {
    const lower = prompt.toLowerCase();
    const patterns = [
      'show me image', 'show me picture', 'show me photo',
      'give me image', 'give me picture', 'give me photo',
      'i want image', 'i want picture', 'i want photo',
      'picture of', 'image of', 'photo of',
      'maghanap ng larawan', 'maghanap ng litrato', 'maghanap ng imahe',
      'gusto ko ng larawan', 'gusto ko ng litrato', 'gusto ko ng imahe',
      'patingin ng larawan', 'patingin ng litrato', 'patingin ng imahe',
      'ano itsura ng', 'larawan ng', 'litrato ng', 'imahe ng',
      'want to see image', 'want to see picture', 'want to see photo',
      'can i see image', 'can i see picture', 'can i see photo',
      'let me see image', 'let me see picture', 'let me see photo',
      'find image', 'find picture', 'find photo',
      'get image', 'get picture', 'get photo',
      'search image', 'search picture', 'search photo',
      'ipakita mo ang larawan', 'ipakita mo ang litrato', 'ipakita mo ang imahe',
      'gusto kong makita ang larawan', 'gusto kong makita ang litrato',
      'gusto kong makita ang imahe', 'pahanap ng larawan'
    ];
    return patterns.some(pattern => lower.includes(pattern));
  },

  async handleImageGeneration(senderId, prompt, token) {
    let searchTerm = prompt;
    let imageCount = 10;
    const commands = ['generate', 'image', 'img', 'show', 'gumawa ng image', 'gumawa ng larawan', 'ipakita ang image', 'ipakita ang larawan'];
    for (const cmd of commands) {
      if (searchTerm.toLowerCase().startsWith(cmd)) {
        searchTerm = searchTerm.slice(cmd.length).trim();
        break;
      }
    }
    const removeKeywords = ['show me', 'give me', 'i want', 'sample', 'example', 'picture of', 'image of', 'photo of', 'generate', 'create', 'need', 'maghanap ng', 'gusto ko', 'patingin ng', 'ano itsura', 'looks like', 'parang', 'larawan ng', 'litrato ng', 'imahe ng', 'want to see', 'can i see', 'let me see', 'find image', 'get image', 'search image', 'ipakita mo ang', 'gusto kong makita', 'pahanap ng'];
    for (const keyword of removeKeywords) {
      if (searchTerm.toLowerCase().includes(keyword)) {
        searchTerm = searchTerm.toLowerCase().replace(keyword, '').trim();
        break;
      }
    }
    const args = searchTerm.split(' ');
    const lastArg = args[args.length - 1];
    if (!isNaN(lastArg) && lastArg > 0 && lastArg <= 30) {
      imageCount = parseInt(lastArg);
      searchTerm = args.slice(0, -1).join(' ');
    }
    const numberMatch = searchTerm.match(/(\d+)\s*(image|picture|photo|pic|larawan|litrato|imahe)s?$/i);
    if (numberMatch) {
      const num = parseInt(numberMatch[1]);
      if (num > 0 && num <= 30) {
        imageCount = num;
        searchTerm = searchTerm.replace(/\d+\s*(image|picture|photo|pic|larawan|litrato|imahe)s?$/i, '').trim();
      }
    }
    if (!searchTerm) {
      await sendMessage(senderId, { text: 'Image Generation\n\nUsage: generate [search term] [number]\n\nExamples:\ngenerate cat\ngenerate beautiful sunset 5\nshow me image of dog' }, token);
      return;
    }
    try {
      const cleanSearch = searchTerm.toLowerCase().trim();
      const searchWords = cleanSearch.split(/\s+/);
      let allImages = [];
      const response1 = await axios.get('https://hiroshi-api.onrender.com/image/pinterest', { params: { search: searchTerm, limit: 100 } });
      allImages = [...allImages, ...(response1.data?.data || [])];
      const response2 = await axios.get('https://hiroshi-api.onrender.com/image/pinterest', { params: { search: searchTerm + ' ' + Date.now(), limit: 100 } });
      allImages = [...allImages, ...(response2.data?.data || [])];
      if (searchWords.length > 1) {
        const response3 = await axios.get('https://hiroshi-api.onrender.com/image/pinterest', { params: { search: searchWords[0], limit: 100 } });
        allImages = [...allImages, ...(response3.data?.data || [])];
      }
      if (allImages.length === 0) {
        await sendMessage(senderId, { text: 'Walang nakitang mga larawan para sa "' + searchTerm + '".' }, token);
        return;
      }
      const exactMatches = allImages.filter(url => {
        if (!url) return false;
        const decoded = decodeURIComponent(url).toLowerCase();
        return decoded.includes(cleanSearch) || decoded.includes(cleanSearch.replace(/\s+/g, '-')) || decoded.includes(cleanSearch.replace(/\s+/g, '_'));
      });
      const wordMatches = allImages.filter(url => {
        if (!url) return false;
        const decoded = decodeURIComponent(url).toLowerCase();
        return searchWords.some(word => {
          if (word.length < 2) return false;
          return decoded.includes(word);
        });
      });
      let finalImages = [...exactMatches];
      if (finalImages.length < imageCount) {
        for (const url of wordMatches) {
          if (!finalImages.includes(url)) {
            finalImages.push(url);
          }
          if (finalImages.length >= imageCount) break;
        }
      }
      if (finalImages.length < imageCount) {
        for (const url of allImages) {
          if (!finalImages.includes(url) && this.isValidUrl(url)) {
            finalImages.push(url);
          }
          if (finalImages.length >= imageCount) break;
        }
      }
      const uniqueImages = [];
      const seen = new Set();
      for (const url of finalImages) {
        if (!seen.has(url) && this.isValidUrl(url)) {
          uniqueImages.push(url);
          seen.add(url);
        }
        if (uniqueImages.length >= imageCount) break;
      }
      const shuffled = uniqueImages.sort(() => Math.random() - 0.5);
      const resultImages = shuffled.slice(0, imageCount);
      if (resultImages.length === 0) {
        await sendMessage(senderId, { text: 'Walang valid na mga larawan para sa "' + searchTerm + '".' }, token);
        return;
      }
      for (let i = 0; i < resultImages.length; i++) {
        const imageUrl = resultImages[i];
        if (imageUrl && this.isValidUrl(imageUrl)) {
          await sendMessage(senderId, { attachment: { type: 'image', payload: { url: imageUrl } } }, token);
          if (i < resultImages.length - 1) await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      await sendMessage(senderId, { text: 'Nakahanap ng ' + resultImages.length + ' larawan para sa "' + searchTerm + '"' }, token);
    } catch (error) {
      console.log('[Generate] Error:', error.message);
      await sendMessage(senderId, { text: 'Error sa pagkuha ng mga larawan para sa "' + searchTerm + '". Subukan muli.' }, token);
    }
  },

  isValidUrl(string) {
    try { new URL(string); return true; } catch (_) { return false; }
  },

  // ========================================================================
  // 14. SCHOLAR
  // ========================================================================
  isScholarCommand(prompt) {
    const commands = ['gscholar', 'scholar', 'googlescholar', 'research', 'pananaliksik', 'saliksik'];
    const lower = prompt.toLowerCase().trim();
    return commands.some(cmd => lower.startsWith(cmd + ' ') || lower === cmd);
  },

  isResearchQuery(prompt) {
    const lower = prompt.toLowerCase();
    const patterns = [
      'find research', 'find study', 'find studies', 'find paper',
      'find papers', 'find article', 'find articles', 'find journal',
      'search research', 'search study', 'search studies',
      'search paper', 'search papers', 'search article', 'search articles',
      'research about', 'research on', 'research paper about', 'study about',
      'studies about', 'academic paper', 'academic article', 'academic journal',
      'scholarly article', 'scholarly paper', 'peer-reviewed article',
      'literature review', 'systematic review', 'meta-analysis',
      'maghanap ng pananaliksik', 'maghanap ng pag-aaral',
      'maghanap ng research', 'pananaliksik tungkol sa', 'pag-aaral tungkol sa'
    ];
    return patterns.some(pattern => lower.includes(pattern));
  },

  async handleScholarSearch(senderId, prompt, token) {
    let query = prompt;
    const commands = ['gscholar', 'scholar', 'googlescholar', 'research', 'pananaliksik', 'saliksik'];
    for (const cmd of commands) {
      if (query.toLowerCase().startsWith(cmd)) {
        query = query.slice(cmd.length).trim();
        break;
      }
    }
    if (!query) {
      await sendMessage(senderId, { text: 'Google Scholar Search\n\nUsage: gscholar [search query]\n\nExamples:\ngscholar coconut hybridization\nresearch machine learning' }, token);
      return;
    }
    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: { engine: 'google_scholar', q: query, api_key: SERPAPI_KEY, num: 5 },
        timeout: 30000
      });
      const results = response.data?.organic_results || [];
      if (results.length === 0) {
        await sendMessage(senderId, { text: 'Walang nakitang resulta para sa "' + query + '".' }, token);
        return;
      }
      for (let i = 0; i < results.length; i++) {
        const paper = results[i];
        const title = paper.title || 'Walang titulo';
        const snippet = paper.snippet || 'Walang abstract na available';
        const citedBy = paper.inline_links?.cited_by?.total || '0';
        const scholarLink = paper.link || paper.redirect_link || 'https://scholar.google.com/scholar?q=' + encodeURIComponent(title);
        let authors = 'Hindi Kilala';
        let venue = 'Hindi Kilala';
        let year = 'Hindi Kilala';
        let volume = '';
        let issue = '';
        let pages = '';
        if (paper.publication_info?.summary) {
          const summary = paper.publication_info.summary;
          const authorMatch = summary.match(/^([^-]+?)(?=\s*[,-]|\s*$)/);
          if (authorMatch) authors = authorMatch[1].trim();
          const venueMatch = summary.match(/[,-]\s*([^,]+?)(?=\s*[,-]|\s*$)/);
          if (venueMatch) venue = venueMatch[1].trim();
          const yearMatch = summary.match(/\b(19|20)\d{2}\b/);
          if (yearMatch) year = yearMatch[0];
        }
        const text = snippet + ' ' + (paper.publication_info?.summary || '');
        const volumePatterns = [/vol\.?\s*(\d+)/i, /volume\s*(\d+)/i, /v\.\s*(\d+)/i, /(\d+)\s*\(/];
        for (const pattern of volumePatterns) {
          const match = text.match(pattern);
          if (match) { volume = match[1]; break; }
        }
        const issuePatterns = [/no\.?\s*(\d+)/i, /issue\s*(\d+)/i, /\((\d+)\)/];
        for (const pattern of issuePatterns) {
          const match = text.match(pattern);
          if (match && match[1] !== volume) { issue = match[1]; break; }
        }
        const pagePatterns = [/pp\.?\s*(\d+-\d+)/i, /pages?\s*(\d+-\d+)/i, /(\d+-\d+)\s*pp/i, /(\d+-\d+)\s*\(/i, /:\s*(\d+-\d+)/i];
        for (const pattern of pagePatterns) {
          const match = text.match(pattern);
          if (match) { pages = match[1]; break; }
        }
        let doi = await this.fetchDOIFromCrossRef(title, authors, year);
        if (!doi) doi = this.extractDOIFromLink(scholarLink);
        if (doi) {
          const metadata = await this.getCompleteMetadata(doi);
          if (metadata) {
            if (!volume && metadata.volume) volume = metadata.volume;
            if (!issue && metadata.issue) issue = metadata.issue;
            if (!pages && metadata.pages) pages = metadata.pages;
            if (venue === 'Hindi Kilala' && metadata.journal) venue = metadata.journal;
            if (year === 'Hindi Kilala' && metadata.year) year = metadata.year;
          }
        }
        const displayAuthors = this.formatAuthorsDisplay(authors);
        const apaCitation = this.generateAPA(authors, year, title, venue, volume, issue, pages, doi, scholarLink);
        const mlaCitation = this.generateMLA(authors, title, venue, year, scholarLink, doi, volume, issue, pages);
        let message = (i + 1) + '. ' + title + '\n\nMga May-akda: ' + displayAuthors + '\nNalathala sa: ' + venue + '\nTaon: ' + year;
        if (volume) message += '\nVolume: ' + volume;
        if (issue) message += '\nIssue: ' + issue;
        if (pages) message += '\nPahina: ' + pages;
        message += '\nDOI: ' + (doi || 'Hindi available');
        if (citedBy !== '0') message += '\nSinipi ng: ' + citedBy;
        message += '\nAbstract: ' + snippet.substring(0, 300) + (snippet.length > 300 ? '...' : '') + '\n\n';
        if (scholarLink) message += 'Google Scholar: ' + scholarLink + '\n\n';
        message += 'APA 7th Edition:\n' + apaCitation + '\n\nMLA 9th Edition:\n' + mlaCitation + '\n\nBeripikado: Natitingnan at naa-access\n' + new Date().toLocaleString('fil-PH', { timeZone: 'Asia/Manila' });
        await sendMessage(senderId, { text: message }, token);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      await sendMessage(senderId, { text: 'Kumpleto na ang Paghahanap!\n\nQuery: ' + query + '\nNakahanap: ' + results.length + ' papel\nPinagmulan: Google Scholar Website' }, token);
    } catch (error) {
      console.error('[gscholar] Error:', error.message);
      let errorMessage = 'Nabigo sa paghahanap sa Google Scholar. ';
      if (error.response?.status === 429) errorMessage += 'Naabot ang rate limit. Maghintay sandali.';
      else if (error.response?.status === 403) errorMessage += 'Hindi valid o expired ang API key.';
      else errorMessage += 'Subukan muli mamaya.';
      await sendMessage(senderId, { text: errorMessage }, token);
    }
  },

  formatAuthorsDisplay(authors) {
    const list = authors.split(',').map(a => a.trim()).filter(a => a);
    if (list.length === 0 || (list.length === 1 && list[0] === 'Hindi Kilala')) return 'Hindi Kilala';
    if (list.length <= 3) return list.join(', ');
    return list.slice(0, 3).join(', ') + ', et al.';
  },

  async fetchDOIFromCrossRef(title, authors, year) {
    try {
      let query = encodeURIComponent(title);
      if (authors && authors !== 'Hindi Kilala') {
        const first = authors.split(',')[0].trim();
        query += '+' + encodeURIComponent(first);
      }
      if (year && year !== 'Hindi Kilala') query += '+' + year;
      const url = 'https://api.crossref.org/works?query=' + query + '&rows=1';
      const response = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'AcademicBot/1.0' } });
      const items = response.data?.message?.items || [];
      if (items.length > 0 && items[0].DOI) return 'https://doi.org/' + items[0].DOI;
      return null;
    } catch (error) {
      console.error('[DOI] Fetch error:', error.message);
      return null;
    }
  },

  extractDOIFromLink(link) {
    if (!link) return null;
    const patterns = [
      { regex: /doi\.org\/([^\s]+)/i, prefix: 'https://doi.org/' },
      { regex: /article\/(10\.[^\s]+)/i, prefix: 'https://doi.org/' },
      { regex: /nature\.com\/articles\/([a-zA-Z0-9]+)/, prefix: 'https://doi.org/10.1038/' },
      { regex: /pii\/([a-zA-Z0-9]+)/, prefix: 'https://doi.org/10.1016/' },
      { regex: /wiley\.com\/doi\/abs\/([^\s]+)/, prefix: 'https://doi.org/' }
    ];
    for (const pattern of patterns) {
      const match = link.match(pattern.regex);
      if (match) return pattern.prefix + match[1];
    }
    return null;
  },

  async getCompleteMetadata(doi) {
    try {
      const clean = doi.replace('https://doi.org/', '');
      const url = 'https://api.crossref.org/works/' + clean;
      const response = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'AcademicBot/1.0' } });
      const data = response.data?.message;
      if (data) {
        return {
          volume: data.volume || '',
          issue: data.issue || '',
          pages: data.page || '',
          journal: data['container-title']?.[0] || '',
          year: data.issued?.['date-parts']?.[0]?.[0] || ''
        };
      }
    } catch (error) {
      console.error('[Crossref] Error:', error.message);
    }
    return null;
  },

  generateAPA(authors, year, title, venue, volume, issue, pages, doi, url) {
    const list = authors.split(',').map(a => a.trim()).filter(a => a);
    let formatted = '';
    if (list.length === 0 || (list.length === 1 && list[0] === 'Hindi Kilala')) {
      formatted = 'Hindi Kilala';
    } else if (list.length === 1) {
      const parts = list[0].split(' ');
      if (parts.length > 1) {
        const last = parts[parts.length-1];
        const first = parts.slice(0, -1).map(p => p[0] + '.').join(' ');
        formatted = last + ', ' + first;
      } else formatted = list[0];
    } else if (list.length === 2) {
      const p1 = list[0].split(' ');
      const p2 = list[1].split(' ');
      const l1 = p1.length > 1 ? p1[p1.length-1] : p1[0];
      const f1 = p1.length > 1 ? p1.slice(0, -1).map(p => p[0] + '.').join(' ') : '';
      const l2 = p2.length > 1 ? p2[p2.length-1] : p2[0];
      const f2 = p2.length > 1 ? p2.slice(0, -1).map(p => p[0] + '.').join(' ') : '';
      formatted = l1 + ', ' + f1 + ', & ' + l2 + ', ' + f2;
    } else {
      const parts = list[0].split(' ');
      const last = parts.length > 1 ? parts[parts.length-1] : parts[0];
      const first = parts.length > 1 ? parts.slice(0, -1).map(p => p[0] + '.').join(' ') : '';
      formatted = last + ', ' + first + ', et al.';
    }
    let citation = formatted + ' (' + year + '). ' + title + '.';
    if (venue && venue !== 'Hindi Kilala') citation += ' ' + venue;
    if (volume) { citation += ', ' + volume; if (issue) citation += '(' + issue + ')'; }
    if (pages) citation += ', ' + pages;
    if (doi) citation += '. ' + doi;
    else if (url && url !== '') citation += ' Nakuha mula sa ' + url;
    return citation;
  },

  generateMLA(authors, title, venue, year, url, doi, volume, issue, pages) {
    const list = authors.split(',').map(a => a.trim()).filter(a => a);
    let formatted = '';
    if (list.length === 0 || (list.length === 1 && list[0] === 'Hindi Kilala')) {
      formatted = 'Hindi Kilala';
    } else if (list.length === 1) {
      const parts = list[0].split(' ');
      formatted = parts.length > 1 ? parts[parts.length-1] + ', ' + parts.slice(0, -1).join(' ') : list[0];
    } else if (list.length === 2) {
      const p1 = list[0].split(' ');
      const p2 = list[1].split(' ');
      const l1 = p1.length > 1 ? p1[p1.length-1] : p1[0];
      const l2 = p2.length > 1 ? p2[p2.length-1] : p2[0];
      formatted = l1 + ' and ' + l2;
    } else {
      const parts = list[0].split(' ');
      const last = parts.length > 1 ? parts[parts.length-1] : parts[0];
      formatted = last + ' et al.';
    }
    let citation = formatted + '. "' + title + '." ' + venue + ',';
    if (volume) { citation += ' vol. ' + volume + ','; if (issue) citation += ' no. ' + issue + ','; }
    if (pages) citation += ' pp. ' + pages + ',';
    citation += ' ' + year + '.';
    if (doi) citation += ' doi:' + doi.replace('https://doi.org/', '') + '.';
    else if (url && url !== '') citation += ' ' + url + '.';
    citation += ' Web. ' + new Date().toLocaleDateString('fil-PH', { month: 'short', day: 'numeric', year: 'numeric' }) + '.';
    return citation;
  },

  // ========================================================================
  // 15. MUSIC
  // ========================================================================
  isMusicRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['play', 'song', 'music', 'track', 'audio', 'listen', 'sound', 'kanta', 'tugtog', 'music video', 'mv', 'soundtrack', 'playlist', 'album', 'single', 'remix', 'cover', 'official audio', 'official music', 'stream', 'pakinggan', 'patugtog', 'music link', 'song link', 'hit song', 'popular song', 'new song', 'latest song', 'opm', 'pinoy music', 'tagalog song', 'bisaya song', 'rap', 'hiphop', 'rnb', 'pop', 'rock', 'jazz', 'classical'];
    return keywords.some(k => lower.includes(k));
  },

  async handleMusicSearch(senderId, prompt, token) {
    let searchTerm = prompt;
    const removeKeywords = ['play', 'song', 'music', 'track', 'audio', 'listen', 'sound', 'kanta', 'tugtog', 'music video', 'mv', 'soundtrack', 'playlist', 'album', 'single', 'remix', 'cover', 'official audio', 'official music', 'stream', 'pakinggan', 'patugtog', 'music link', 'song link'];
    for (const keyword of removeKeywords) {
      if (searchTerm.toLowerCase().includes(keyword)) {
        searchTerm = searchTerm.toLowerCase().replace(keyword, '').trim();
        break;
      }
    }
    if (!searchTerm) {
      await sendMessage(senderId, { text: 'Music Search\n\nUsage: play [song title] or music [song title]\n\nExamples:\nplay lihim\nmusic halik\nplay love song' }, token);
      return;
    }
    try {
      const encodedSearch = encodeURIComponent(searchTerm);
      const apiUrl = 'https://betadash-api-swordslush-production.up.railway.app/sc?search=' + encodedSearch;
      const response = await axios.get(apiUrl, { timeout: 30000, headers: { 'Accept': 'application/json' } });
      const data = response.data;
      if (!data || !data.results || data.results.length === 0) {
        await sendMessage(senderId, { text: 'Walang nakitang resulta para sa "' + searchTerm + '".' }, token);
        return;
      }
      const exactMatches = data.results.filter(track => {
        const title = track.data.title || '';
        return title.toLowerCase().includes(searchTerm.toLowerCase());
      });
      const results = exactMatches.length > 0 ? exactMatches : data.results;
      const totalResults = results.length;
      let message = 'SoundCloud Results para sa "' + searchTerm + '"\nNakahanap ng ' + totalResults + ' kanta\n\n';
      for (let i = 0; i < results.length; i++) {
        const track = results[i].data;
        const title = track.title || 'Hindi Kilalang Titulo';
        const artist = track.user ? track.user.username || 'Hindi Kilalang Artist' : 'Hindi Kilalang Artist';
        const duration = this.formatDuration(track.duration || 0);
        const plays = track.playback_count || 0;
        const likes = track.likes_count || 0;
        const genre = track.genre || 'Hindi Kilalang Genre';
        const url = track.permalink_url || '';
        const artwork = track.artwork_url || '';
        const created = track.created_at ? new Date(track.created_at).toLocaleDateString('fil-PH') : 'Hindi Kilalang Petsa';
        let audioUrl = '';
        if (track.media && track.media.transcodings) {
          const progressive = track.media.transcodings.find(t => t.format && t.format.protocol === 'progressive' && t.format.mime_type === 'audio/mpeg');
          if (progressive && progressive.url) audioUrl = progressive.url;
        }
        if (!audioUrl && url) audioUrl = url;
        message += (i + 1) + '. ' + title + '\nMang-aawit/Artist: ' + artist + '\nGenre: ' + genre + '\nTagal: ' + duration + '\nInilabas: ' + created + '\nPinatugtog: ' + plays.toLocaleString() + '\nMga Like: ' + likes.toLocaleString();
        if (artwork) message += '\nArtwork: ' + artwork;
        message += '\nPakinggan: ' + url;
        if (audioUrl) message += '\nDirect Audio: ' + audioUrl;
        message += '\n\n';
      }
      message += 'Nakahanap ng ' + totalResults + ' resulta\n' + new Date().toLocaleString('fil-PH', { timeZone: 'Asia/Manila' });
      await this.sendChunks(senderId, message, token);
    } catch (error) {
      console.error('[Music] Error:', error.message);
      await sendMessage(senderId, { text: 'Error sa paghahanap para sa "' + searchTerm + '". Subukan muli mamaya.' }, token);
    }
  },

  formatDuration(ms) {
    if (!ms) return 'Hindi Kilala';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes + ':' + seconds.toString().padStart(2, '0');
  },

  // ========================================================================
  // 16. USER INFO
  // ========================================================================
  isOwnerQuestion(prompt) {
    const keywords = ['who is your owner', 'who created you', 'who made you', 'sino gumawa sayo', 'sino may ari sayo', 'owner mo', 'sino owner mo', 'who owns you', 'creator', 'developer'];
    return keywords.some(k => prompt.toLowerCase().includes(k));
  },

  isUserInfoQuestion(prompt) {
    const keywords = ['what is my name', 'ano pangalan ko', 'my name', 'pangalan ko', 'when is my birthday', 'kelan birthday ko', 'my birthday', 'who am i', 'sino ako', 'whats my name'];
    return keywords.some(k => prompt.toLowerCase().includes(k));
  },

  async handleUserInfo(senderId, prompt, token) {
    try {
      const userInfo = await this.getUserInfo(senderId, token);
      const lang = this.detectLanguage(prompt);
      let response = '';
      if (prompt.toLowerCase().includes('name') || prompt.toLowerCase().includes('pangalan')) {
        response = userInfo.name ? 
          (lang === 'tagalog' ? 'Ang pangalan mo ay ' + userInfo.name + '.' :
           lang === 'bisaya' ? 'Ang ngalan nimo kay ' + userInfo.name + '.' :
           'Your name is ' + userInfo.name + '.') : 
          (lang === 'tagalog' ? 'Hindi ko masasabi iyan dahil ito ay kompidensyal.' :
           lang === 'bisaya' ? 'Dili nako masulti kana kay kompidensyal.' :
           'I cannot say that because it is confidential.');
      }
      if (prompt.toLowerCase().includes('birthday') || prompt.toLowerCase().includes('kelan')) {
        response += userInfo.birthday ? 
          (lang === 'tagalog' ? '\nAng birthday mo ay ' + userInfo.birthday + '.' :
           lang === 'bisaya' ? '\nAng birthday nimo kay ' + userInfo.birthday + '.' :
           '\nYour birthday is ' + userInfo.birthday + '.') : 
          (lang === 'tagalog' ? '\nHindi ko masasabi iyan dahil ito ay kompidensyal.' :
           lang === 'bisaya' ? '\nDili nako masulti kana kay kompidensyal.' :
           '\nI cannot say that because it is confidential.');
      }
      if (!response) {
        const publicInfo = [];
        if (userInfo.name) publicInfo.push(lang === 'tagalog' ? 'Pangalan: ' + userInfo.name : lang === 'bisaya' ? 'Ngalan: ' + userInfo.name : 'Name: ' + userInfo.name);
        if (userInfo.birthday) publicInfo.push(lang === 'tagalog' ? 'Birthday: ' + userInfo.birthday : lang === 'bisaya' ? 'Birthday: ' + userInfo.birthday : 'Birthday: ' + userInfo.birthday);
        if (userInfo.gender) publicInfo.push(lang === 'tagalog' ? 'Kasarian: ' + userInfo.gender : lang === 'bisaya' ? 'Gender: ' + userInfo.gender : 'Gender: ' + userInfo.gender);
        if (userInfo.location) publicInfo.push(lang === 'tagalog' ? 'Lokasyon: ' + userInfo.location : lang === 'bisaya' ? 'Lokasyon: ' + userInfo.location : 'Location: ' + userInfo.location);
        response = publicInfo.length > 0 ? 
          (lang === 'tagalog' ? 'Narito ang iyong pampublikong impormasyon:\n' + publicInfo.join('\n') :
           lang === 'bisaya' ? 'Ania ang imong pampublikong impormasyon:\n' + publicInfo.join('\n') :
           'Here is your public information:\n' + publicInfo.join('\n')) : 
          (lang === 'tagalog' ? 'Hindi ko masasabi iyan dahil ito ay kompidensyal.' :
           lang === 'bisaya' ? 'Dili nako masulti kana kay kompidensyal.' :
           'I cannot say that because it is confidential.');
      }
      await sendMessage(senderId, { text: response }, token);
    } catch (error) {
      console.error('[User Info] Failed:', error.message);
      await sendMessage(senderId, { text: 'Error sa pagkuha ng impormasyon ng user.' }, token);
    }
  },

  async getUserInfo(senderId, token) {
    try {
      const url = 'https://graph.facebook.com/' + senderId;
      const params = { access_token: token, fields: 'id,name,first_name,last_name,birthday,gender,location,email' };
      const response = await axios.get(url, { params });
      const data = response.data;
      return {
        id: data.id || null,
        name: data.name || null,
        firstName: data.first_name || null,
        lastName: data.last_name || null,
        birthday: data.birthday || null,
        gender: data.gender || null,
        location: data.location ? data.location.name : null,
        email: data.email || null
      };
    } catch (error) {
      console.error('[Graph API] Error:', error.message);
      return {};
    }
  },

  // ========================================================================
  // 17. TRANSLATION
  // ========================================================================
  isTranslationRequest(prompt) {
    const keywords = ['translate', 'translate to', 'translate into', 'translate in', 'translation', 'isalin', 'salin', 'ipasalin', 'isalin sa', 'transl', 'trans', 'i-translate', 'isalin mo'];
    const lower = prompt.toLowerCase();
    if (keywords.some(k => lower.includes(k))) return true;
    const languages = ['tagalog', 'bisaya', 'cebuano', 'spanish', 'filipino', 'english', 'ilocano', 'waray', 'hiligaynon', 'kapampangan', 'pangasinan', 'bicolano', 'chinese', 'mandarin', 'cantonese', 'japanese', 'nihongo', 'korean', 'hangeul', 'french', 'francais', 'german', 'deutsch', 'italian', 'italiano', 'portuguese', 'russian', 'arabic', 'hindi', 'urdu', 'bengali', 'tamil', 'telugu', 'marathi', 'gujarati', 'kannada', 'malayalam', 'thai', 'vietnamese', 'indonesian', 'malay'];
    return languages.some(l => lower.includes(l));
  },

  detectTargetLanguage(prompt) {
    const lower = prompt.toLowerCase();
    const languages = {
      'tagalog': 'Tagalog', 'filipino': 'Filipino',
      'bisaya': 'Bisaya', 'cebuano': 'Cebuano',
      'ilocano': 'Ilocano', 'waray': 'Waray',
      'hiligaynon': 'Hiligaynon', 'kapampangan': 'Kapampangan',
      'pangasinan': 'Pangasinan', 'bicolano': 'Bicolano',
      'chavacano': 'Chavacano', 'chinese': 'Chinese',
      'mandarin': 'Mandarin', 'cantonese': 'Cantonese',
      'japanese': 'Japanese', 'nihongo': 'Japanese',
      'korean': 'Korean', 'hangeul': 'Korean',
      'thai': 'Thai', 'vietnamese': 'Vietnamese',
      'indonesian': 'Indonesian', 'malay': 'Malay',
      'english': 'English', 'spanish': 'Spanish',
      'french': 'French', 'francais': 'French',
      'german': 'German', 'deutsch': 'German',
      'italian': 'Italian', 'italiano': 'Italian',
      'portuguese': 'Portuguese', 'russian': 'Russian',
      'arabic': 'Arabic', 'hindi': 'Hindi',
      'urdu': 'Urdu', 'bengali': 'Bengali',
      'tamil': 'Tamil', 'telugu': 'Telugu'
    };
    for (const [key, value] of Object.entries(languages)) {
      if (lower.includes(key)) return value;
    }
    return 'English';
  },

  async translateResponse(text, targetLanguage) {
    try {
      const translatePrompt = 'Translate this text to ' + targetLanguage + '. Only provide the translation, no other text. Do not include the original text. Here is the text to translate: ' + text;
      const response = await this.callAPI(translatePrompt, 'translation');
      return response || text;
    } catch (error) {
      console.error('[Translation] Failed:', error.message);
      return text;
    }
  },

  // ========================================================================
  // 18. API CALLS (with retry & fallback)
  // ========================================================================
  getApiConfig() {
    return {
      url: 'https://api-library-kohi-production.up.railway.app/api/pollination-ai',
      method: 'GET',
      responsePath: 'data',
      successField: 'status',
      timeout: 60000,
      headers: {}
    };
  },

  getFallbackApiConfig() {
    return {
      url: 'https://betadash-api-swordslush-production.up.railway.app/opera',
      method: 'GET',
      responsePath: 'message',
      successField: 'success',
      timeout: 30000,
      headers: {}
    };
  },

  async callAPI(prompt, senderId) {
    const primary = this.getApiConfig();
    const fallback = this.getFallbackApiConfig();
    try {
      return await this.executeApiCall(primary, prompt, senderId);
    } catch (primaryError) {
      try {
        return await this.executeApiCall(fallback, prompt, senderId);
      } catch (fallbackError) {
        throw new Error('Both primary and fallback APIs failed.');
      }
    }
  },

  async executeApiCall(config, prompt, senderId) {
    let retries = 2;
    let lastError = null;
    while (retries > 0) {
      try {
        let response;
        if (config.method === 'GET') {
          const encoded = encodeURIComponent(prompt);
          const param = config.url.includes('opera') ? 'ask' : 'prompt';
          const url = config.url + '?' + param + '=' + encoded;
          response = await axios.get(url, { timeout: config.timeout, headers: { 'Accept': 'application/json', ...config.headers } });
        } else {
          response = await axios.post(config.url, { prompt }, { timeout: config.timeout, headers: { 'Content-Type': 'application/json', ...config.headers } });
        }
        const data = response.data;
        if (data[config.successField] !== true) throw new Error('API returned ' + config.successField + ': false');
        const extracted = this.extractResponse(data, config);
        if (extracted) return this.standardizeResponse(extracted);
        else throw new Error('API returned empty response');
      } catch (error) {
        lastError = error;
        retries--;
        if (retries > 0) {
          const delay = error.response?.status === 429 ? 5000 : 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError || new Error('Failed to get response from ' + config.url);
  },

  extractResponse(data, config) {
    if (config.responsePath) {
      const path = config.responsePath.split('.');
      let value = data;
      for (const key of path) {
        if (value && typeof value === 'object' && key in value) value = value[key];
        else return null;
      }
      if (typeof value === 'string' && value.trim()) return value;
    }
    const formats = ['data', 'result', 'response', 'message', 'text', 'content'];
    for (const format of formats) {
      const path = format.split('.');
      let value = data;
      for (const key of path) {
        if (value && typeof value === 'object' && key in value) value = value[key];
        else { value = null; break; }
      }
      if (value && typeof value === 'string' && value.trim()) return value;
    }
    return null;
  },

  standardizeResponse(response) {
    return response
      .replace(/^I'?m?\s+a?\s*AI.*?model.*?\n\n?/i, '')
      .replace(/^As an AI.*?\n\n?/i, '')
      .replace(/^Here is my response.*?\n/i, '')
      .replace(/^Let me answer.*?\n/i, '')
      .replace(/^Based on my knowledge.*?\n/i, '')
      .replace(/^I can help you.*?\n/i, '')
      .replace(/^Ako ay isang AI.*?\n\n?/i, '')
      .replace(/^Bilang isang AI.*?\n\n?/i, '')
      .replace(/^Narito ang aking tugon.*?\n/i, '')
      .replace(/^Hayaan mong sagutin ko.*?\n/i, '')
      .replace(/^Batay sa aking kaalaman.*?\n/i, '')
      .trim();
  },

  // ========================================================================
  // 19. RESPONSE PROCESSING HELPERS
  // ========================================================================
  wantsDetailedAnswer(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['explain more', 'more explanation', 'more details', 'detailed', 'detail', 'elaborate', 'elaborate more', 'paki elaborate', 'mas detalyado', 'tell me more', 'give more info', 'dagdagan', 'dagdag', 'further explain', 'further explanation', 'full explanation', 'complete explanation', 'in depth', 'in-depth', 'thorough', 'comprehensive', 'expound', 'pakilinaw', 'linawin', 'more information', 'additional info', 'karagdagang', 'can you explain further', 'please elaborate', 'paki explain', 'paliwanag', 'ipaliwanag', 'mas malalim', 'mas malawak'];
    return keywords.some(k => lower.includes(k));
  },

  shortenResponse(text) {
    if (!text) return text;
    const sentences = text.split(/(?<=[.!?])\s+/);
    let concise = sentences.slice(0, 3).join(' ');
    if (concise.length > 400) concise = concise.substring(0, 400) + '...';
    concise = concise
      .replace(/^(In summary|To summarize|In conclusion|Basically|Essentially|Simply put|In other words|That said|Having said that|With that said|Sa buod|Upang ibuod|Sa konklusyon|Karaniwan|Sa madaling salita|Sa ibang salita|Iyon ay|Sa pagkakaroon ng sinabi|Sa nasabing iyon)\s*,?\s*/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return concise || text;
  },

  cleanOldHistory() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000;
    for (const [userId, data] of Object.entries(conversationHistory)) {
      if (now - data.timestamp > maxAge) delete conversationHistory[userId];
      else if (data.topicHistory && Object.keys(data.topicHistory).length > 50) {
        const keys = Object.keys(data.topicHistory).sort((a, b) => data.topicHistory[b].timestamp - data.topicHistory[a].timestamp);
        const newHistory = {};
        for (const k of keys.slice(0, 50)) newHistory[k] = data.topicHistory[k];
        data.topicHistory = newHistory;
      }
    }
  },

  // ========================================================================
  // 20. REPLY / ATTACHMENT HELPERS
  // ========================================================================
  async getRepliedMessageData(mid, token) {
    try {
      const url = 'https://graph.facebook.com/v21.0/' + mid;
      const params = { access_token: token, fields: 'message,from,attachments' };
      const { data } = await axios.get(url, { params });
      let imageUrl = null;
      if (data?.attachments?.data) {
        for (const attachment of data.attachments.data) {
          if (attachment.type === 'image' || attachment.type === 'photo') {
            imageUrl = attachment?.image_data?.url || attachment?.url || null;
            if (imageUrl) {
              const urlObj = new URL(imageUrl);
              urlObj.searchParams.set('access_token', token);
              imageUrl = urlObj.toString();
            }
            break;
          }
        }
      }
      return { message: data?.message || null, from: data?.from?.id || null, imageUrl: imageUrl };
    } catch (error) {
      console.error('[Get Replied Message] Failed:', error.message);
      return { message: null, from: null, imageUrl: null };
    }
  },

  // ========================================================================
  // 21. TEXT CLEANUP & CHUNKING
  // ========================================================================
  cleanResponse(text) {
    if (!text) return 'Walang tugon.';
    let cleaned = text.trim();
    
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
    cleaned = cleaned.replace(/#{1,6}\s*/g, '');
    cleaned = cleaned.replace(/---+/g, '');
    cleaned = cleaned.replace(/__/g, '');
    cleaned = cleaned.replace(/_/g, '');
    cleaned = cleaned.replace(/`/g, '');
    cleaned = cleaned.replace(/```/g, '');
    cleaned = cleaned.replace(/~~/g, '');
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    cleaned = cleaned.replace(/\\\[/g, '');
    cleaned = cleaned.replace(/\\\]/g, '');
    cleaned = cleaned.replace(/\\\(/g, '');
    cleaned = cleaned.replace(/\\\)/g, '');
    cleaned = cleaned.replace(/\\boxed\{([^}]+)\}/g, '$1');
    cleaned = cleaned.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2');
    cleaned = cleaned.replace(/\\sum/g, 'SUM');
    cleaned = cleaned.replace(/\\bar/g, '');
    cleaned = cleaned.replace(/\\times/g, '×');
    cleaned = cleaned.replace(/\\sqrt/g, '√');
    cleaned = cleaned.replace(/\\int/g, '∫');
    cleaned = cleaned.replace(/\\infty/g, '∞');
    cleaned = cleaned.replace(/\\leq/g, '≤');
    cleaned = cleaned.replace(/\\geq/g, '≥');
    cleaned = cleaned.replace(/\\neq/g, '≠');
    cleaned = cleaned.replace(/\\approx/g, '≈');
    cleaned = cleaned.replace(/\\pm/g, '±');
    
    cleaned = cleaned.replace(/\|\|\|/g, '|');
    cleaned = cleaned.replace(/\|\s*\|\s*\|/g, '|');
    cleaned = cleaned.replace(/^\|\s*$/gm, '');
    
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    
    cleaned = cleaned.replace(/[\u{1F000}-\u{1FFFF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2600}-\u{27BF}]/gu, '');
    cleaned = cleaned.replace(/[\u{FE00}-\u{FEFF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F700}-\u{1F77F}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F780}-\u{1F7FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F800}-\u{1F8FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F900}-\u{1F9FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1FA00}-\u{1FA6F}]/gu, '');
    cleaned = cleaned.replace(/[\u{1FA70}-\u{1FAFF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');
    cleaned = cleaned.replace(/[\u{24C2}-\u{1F251}]/gu, '');
    
    return cleaned.trim() || 'Walang tugon.';
  },

  getErrorMessage(error, detectedLanguage = 'english') {
    const lang = detectedLanguage || 'english';
    if (error.code === 'ECONNABORTED') {
      return lang === 'tagalog' ? 'Nag-timeout ang request. Subukan muli.' :
             lang === 'bisaya' ? 'Nag-timeout ang request. Sulayi pag-usab.' :
             'Request timed out. Please try again.';
    }
    if (error.response?.status === 429) {
      return lang === 'tagalog' ? 'Naabot ang rate limit. Maghintay sandali.' :
             lang === 'bisaya' ? 'Naabot ang rate limit. Paghulat ug balik.' :
             'Rate limit reached. Please wait.';
    }
    if (error.response?.status === 403) {
      return lang === 'tagalog' ? 'Hindi valid o expired ang API key.' :
             lang === 'bisaya' ? 'Dili valid o expired ang API key.' :
             'Invalid or expired API key.';
    }
    if (error.response?.status >= 500) {
      return lang === 'tagalog' ? 'Server error. Subukan muli mamaya.' :
             lang === 'bisaya' ? 'Server error. Sulayi pag-usab.' :
             'Server error. Please try again later.';
    }
    return lang === 'tagalog' ? 'Error sa pagproseso ng request. Subukan muli.' :
           lang === 'bisaya' ? 'Error sa pagproseso sa request. Sulayi pag-usab.' :
           'Error processing request. Please try again.';
  },

  splitMessage(text) {
    const chunks = [];
    if (!text) return chunks;
    
    let cleanText = this.cleanResponse(text);
    
    if (cleanText.length <= MAX_CHUNK) {
      chunks.push(cleanText);
      return chunks;
    }
    
    const sections = cleanText.split(/(?=Step \d+:)/i);
    let currentChunk = '';
    
    for (const section of sections) {
      if ((currentChunk + section).length <= MAX_CHUNK) {
        currentChunk += section;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = section;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    
    if (chunks.length === 0 || chunks[0].length > MAX_CHUNK) {
      const paragraphs = cleanText.split(/\n\n+/);
      currentChunk = '';
      for (const paragraph of paragraphs) {
        if ((currentChunk + paragraph).length <= MAX_CHUNK) {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        } else {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = paragraph;
        }
      }
      if (currentChunk) chunks.push(currentChunk.trim());
    }
    
    return chunks;
  },

  async sendChunks(senderId, text, token) {
    if (!text) return;
    const chunks = this.splitMessage(text);
    for (const chunk of chunks) {
      await sendMessage(senderId, { text: chunk }, token);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
};
