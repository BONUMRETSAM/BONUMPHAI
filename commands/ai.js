const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const MAX_CHUNK = 1900;
const conversationHistory = {};
const SERPAPI_KEY = '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ai', 'opera', 'ask', 'gemini', 'vision', 'gscholar', 'scholar', 'googlescholar', 'research', 'generate', 'image', 'img', 'show'],
  description: 'Multi-modal AI with text, image analysis, Google Scholar, image generation, music search, and lyrics',
  usage: 'ai [message] or send/reply to image or generate [query] or play [song] or lyrics [song]',
  version: '8.0.0',
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
      const isMath = this.isMathProblem(prompt);
      const isExampleReq = this.isExampleRequest(prompt);

      // ============================================================
      // PRIORITY 1: TEXT PROCESSING FUNCTIONS (RUN FIRST)
      // ============================================================

      if (this.isTranslateRequest(prompt)) {
        await this.handleTranslate(senderId, prompt, token);
        return;
      }

      if (this.isHumanizeRequest(prompt)) {
        await this.handleHumanize(senderId, prompt, token);
        return;
      }

      if (this.isSummarizeRequest(prompt)) {
        await this.handleSummarize(senderId, prompt, token);
        return;
      }

      if (this.isShortenRequest(prompt)) {
        await this.handleShorten(senderId, prompt, token);
        return;
      }

      if (this.isFluentRequest(prompt)) {
        await this.handleFluent(senderId, prompt, token);
        return;
      }

      if (this.isElaborateRequest(prompt)) {
        await this.handleElaborate(senderId, prompt, token);
        return;
      }

      if (this.isClarifyRequest(prompt)) {
        await this.handleClarify(senderId, prompt, token);
        return;
      }

      if (this.isValidateRequest(prompt)) {
        await this.handleValidate(senderId, prompt, token);
        return;
      }

      if (this.isSimplifyRequest(prompt)) {
        await this.handleSimplify(senderId, prompt, token);
        return;
      }

      if (this.isEli5Request(prompt)) {
        await this.handleEli5(senderId, prompt, token);
        return;
      }

      if (this.isRephraseRequest(prompt)) {
        await this.handleRephrase(senderId, prompt, token);
        return;
      }

      if (this.isPolishRequest(prompt)) {
        await this.handlePolish(senderId, prompt, token);
        return;
      }

      // ============================================================
      // PRIORITY 2: SPECIAL COMMANDS
      // ============================================================

      if (this.isLyricsRequest(prompt)) {
        await this.handleLyricsSearch(senderId, prompt, token);
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

      // ============================================================
      // PRIORITY 3: RETURN TO TOPIC
      // ============================================================

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

      // ============================================================
      // PRIORITY 4: REPLY TO MESSAGE
      // ============================================================

      if (event?.message?.reply_to?.mid) {
        isReply = true;
        const replyData = await this.getRepliedMessageData(event.message.reply_to.mid, token);
        previousResponse = replyData.message;
        imageUrl = replyData.imageUrl;
        if (!prompt) prompt = 'Please respond to what I said.';
      }

      // ============================================================
      // PRIORITY 5: IMAGE ATTACHMENT
      // ============================================================

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

      // ============================================================
      // PRIORITY 6: CONVERSATION CONTEXT
      // ============================================================

      if (!isReply && prompt && !imageUrl && !isMath && !isExampleReq) {
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

      // ============================================================
      // PRIORITY 7: WELCOME MESSAGE
      // ============================================================

      if (!prompt && !isReply && !imageUrl) {
        await sendMessage(senderId, {
          text: 'Hello! I am Teacher Arlene a Multi-Modal AI.\n\nCapabilities:\n- Answer text conversations\n- Analyze images and activity sheets\n- Provide research articles, studies, and thesis\n- Generate images\n- Search music\n- Search lyrics\n- Solve problems with full solutions\n- Summarize text\n- Create resume\n- Create all types of letters\n- Translate all languages\n- Enhance image resolution\n- Remove image background\n- Test API endpoint\n- Convert images to URL\n- Create PowerPoint presentation slides\n- Extract text from images\n- Understand and respond in all languages\n\nType help to know how to use my commands.'
        }, token);
        return;
      }

      // ============================================================
      // PRIORITY 8: OWNER QUESTION
      // ============================================================

      if (this.isOwnerQuestion(prompt)) {
        const lang = this.getLanguageName(detectedLanguage);
        const response = lang === 'Tagalog' ? 'Ako ay ginawa ni GeoDevz69.\nBisitahin dito para sa karagdagang impormasyon:\nhttps://www.facebook.com/geotechph.net' :
                          lang === 'Bisaya' ? 'Ako gihimo ni GeoDevz69.\nBisitaha diri para sa dugang impormasyon:\nhttps://www.facebook.com/geotechph.net' :
                          'I was created by GeoDevz69.\nVisit here for more information:\nhttps://www.facebook.com/geotechph.net';
        await sendMessage(senderId, { text: response }, token);
        return;
      }

      // ============================================================
      // PRIORITY 9: USER INFO
      // ============================================================

      if (this.isUserInfoQuestion(prompt)) {
        await this.handleUserInfo(senderId, prompt, token);
        return;
      }

      // ============================================================
      // PRIORITY 10: MAIN AI RESPONSE
      // ============================================================

      const wantsDetailed = this.wantsDetailedAnswer(prompt);
      let aiResponse = '';

      // IMAGE ANALYSIS
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
      }
      // MATH PROBLEMS
      else if (isMath || isExampleReq) {
        const finalPrompt = this.buildMathSolutionPrompt(prompt, detectedLanguage);
        const response = await this.callAPI(finalPrompt);
        aiResponse = this.cleanResponse(response || 'No response from API.');

        const history = conversationHistory[senderId] || { topicHistory: {} };
        history.lastPrompt = prompt;
        history.lastResponse = aiResponse;
        history.language = detectedLanguage;
        history.timestamp = Date.now();

        const topicKey = this.extractTopicKey(prompt);
        if (topicKey) {
          history.topicHistory[topicKey] = {
            response: aiResponse,
            prompt: prompt,
            keywords: this.extractKeywordsFromResponse(aiResponse),
            timestamp: Date.now()
          };
        }
        conversationHistory[senderId] = history;
      }
      // REPLY / FOLLOW-UP
      else if (isReply && previousResponse) {
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
      // NEW CONVERSATION
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

  // ========== TYPO CORRECTION ==========
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

  // ========== TOPIC MANAGEMENT ==========
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

  extractKeywordsFromResponse(response) {
    if (!response) return [];
    const lower = response.toLowerCase();
    const keywords = [];
    const topicWords = [
      'activity sheet', 'worksheet', 'quiz', 'homework', 'assignment',
      'math', 'science', 'english', 'tle', 'filipino',
      'problem', 'equation', 'solution', 'answer', 'explanation',
      'composting', 'fermentation', 'fertilizer', 'crops', 'harvest',
      'agriculture', 'biology', 'chemistry', 'physics',
      'environment', 'pollution', 'recycle', 'biodegradable',
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
        if (phrase.length > 4 && !keywords.includes(phrase)) {
          keywords.push(phrase);
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
      'continue about', 'continue with', 'tuloy natin ang', 'ituloy ang',
      'balik tayo', 'balikan natin yung', 'balikan natin ang',
      'balik sa', 'balikan ang', 'tungkol sa last', 'tungkol sa nauna',
      'about the previous', 'about the last'
    ];
    if (patterns.some(p => lower.includes(p))) return true;
    const refs = [
      'last response', 'last reply', 'last answer', 'last message',
      'previous response', 'previous reply', 'previous answer',
      'nauna mong sagot', 'nauna mong reply', 'huling sagot', 'huling reply',
      'sagot mo kanina', 'reply mo kanina', 'sinabi mo kanina'
    ];
    return refs.some(r => lower.includes(r));
  },

  extractTopicKey(prompt) {
    if (!prompt) return null;
    const words = prompt.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'on', 'at', 'to', 'for', 'from', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho'];
    const keywords = words.filter(w => w.length > 3 && !stopWords.includes(w));
    const key = keywords.slice(0, 5).join(' ');
    return key.length > 3 ? key.substring(0, 50) : prompt.substring(0, 50);
  },

  // ========== MATH DETECTION ==========
  isMathProblem(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    const mathPatterns = [
      /\d+\s*[\+\-\*\/\×\÷]\s*\d+/,
      /\d+\s*\+\s*\d+/,
      /\d+\s*\-\s*\d+/,
      /\d+\s*\*\s*\d+/,
      /\d+\s*\/\s*\d+/,
      /\d+\s*=\s*\d+/,
      /\d+\s*[\+\-\*\/]\s*[a-zA-Z]/,
      /[a-zA-Z]\s*[\+\-\*\/]\s*\d+/,
      /[a-zA-Z]\s*=\s*[\d\s\+\-\*\/]+/,
      /addition/i, /subtraction/i, /multiplication/i, /division/i,
      /arithmetic/i, /fraction/i, /decimal/i, /percentage/i, /percent/i,
      /add/i, /subtract/i, /multiply/i, /divide/i,
      /sum/i, /difference/i, /product/i, /quotient/i,
      /algebra/i, /equation/i, /quadratic/i, /polynomial/i,
      /simplify/i, /factor/i, /expand/i, /variable/i,
      /geometry/i, /area of/i, /perimeter of/i, /volume of/i,
      /circumference/i, /triangle/i, /rectangle/i, /circle/i,
      /trigonometry/i, /sine/i, /cosine/i, /tangent/i,
      /calculus/i, /derivative/i, /integral/i, /limit/i,
      /statistics/i, /probability/i, /mean/i, /median/i, /mode/i,
      /standard deviation/i, /variance/i, /quartile/i,
      /frequency distribution/i, /grouped data/i, /ungrouped data/i,
      /data set/i, /dataset/i, /correlation/i, /regression/i,
      /number theory/i, /set theory/i, /matrix/i, /matrices/i,
      /vector/i, /sequence/i, /series/i, /combination/i,
      /permutation/i, /binomial/i, /logarithm/i, /exponent/i,
      /interest/i, /compound interest/i, /simple interest/i,
      /conversion/i, /convert/i, /measurement/i,
      /pagdadagdag/i, /pagbabawas/i, /pagpaparami/i, /paghahati/i,
      /hati/i, /dagdag/i, /bawas/i, /paramihin/i,
      /suma/i, /kabuuan/i, /produkto/i,
      /matematika/i, /sipnayan/i, /bilang/i, /numero/i,
      /praksyon/i, /desimal/i, /porsyento/i,
      /alhebra/i, /ekwasyon/i, /lutasin/i, /sagutin/i,
      /kompyut/i, /kuwenta/i, /kwenta/i,
      /heometriya/i, /sukat/i, /lawak/i, /tatsulok/i,
      /parihaba/i, /bilog/i, /parisukat/i, /anggulo/i,
      /estadistika/i, /probabilidad/i, /hanay/i,
      /frequency/i, /grouped data/i, /data set/i,
      /sequence/i, /serye/i, /kombinasyon/i, /permutasyon/i,
      /logarithm/i, /exponent/i, /interest/i,
      /pagdugang/i, /pag-ibanan/i, /pagpadaghan/i, /pagbahin/i,
      /bahin/i, /dugang/i, /ibanan/i, /padaghan/i,
      /matematika/i, /ihap/i, /numero/i,
      /praksyon/i, /desimal/i, /porsyento/i,
      /alhebra/i, /ekwasyon/i, /sulbad/i, /tubag/i,
      /kwenta/i, /kuwentaha/i,
      /heometriya/i, /sukod/i, /gilapdon/i, /trianggulo/i,
      /rektanggulo/i, /lingin/i, /kwadrado/i, /anggulo/i,
      /estadistika/i, /probabilidad/i, /frequency/i,
      /grouped data/i, /data set/i,
      /sequence/i, /serye/i, /kombinasyon/i, /permutasyon/i,
      /logarithm/i, /exponent/i, /interest/i,
      /solve/i, /sulbad/i, /kuwenta/i, /kwenta/i,
      /tuos/i, /ihap/i, /bilang/i, /kompyut/i,
      /sagutin/i, /lutasin/i, /hanapin/i,
      /pangitaa/i, /kwentaha/i, /kuwentaha/i,
      /math problem/i, /word problem/i, /problem solving/i,
      /calculate/i, /kalkulahin/i, /kuwentahin/i,
      /prime number/i, /gcd/i, /lcm/i, /divisibility/i,
      /annuity/i, /amortization/i, /investment/i, /loan/i,
      /mortgage/i, /depreciation/i, /tubo/i, /interes/i,
      /kilometer/i, /meter/i, /centimeter/i, /kilogram/i,
      /gram/i, /liter/i, /timbang/i, /bigat/i,
      /venn diagram/i, /factorial/i, /square root/i, /cube root/i,
      /arithmetic sequence/i, /geometric sequence/i,
      /summation/i, /sigma notation/i, /nth term/i,
      /how many/i, /how much/i, /what is the total/i,
      /what is the sum/i, /what is the difference/i,
      /ilang lahat/i, /magkano lahat/i, /ano ang kabuuan/i,
      /pila ka buok/i, /pila ang total/i, /unsa ang total/i
    ];
    return mathPatterns.some(pattern => {
      if (pattern instanceof RegExp) return pattern.test(prompt);
      return lower.includes(pattern);
    });
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
      'halimbawa ng', 'halimbawa with solution',
      'pananglitan', 'mga pananglitan', 'paghatag ug pananglitan'
    ];
    return exampleKeywords.some(keyword => lower.includes(keyword));
  },

  detectMathTopic(prompt) {
    if (!prompt) return 'general';
    const lower = prompt.toLowerCase();
    const topics = {
      arithmetic: ['addition', 'subtraction', 'multiplication', 'division', 'add', 'subtract', 'multiply', 'divide', 'sum', 'difference', 'product', 'quotient', 'fraction', 'decimal', 'percentage', 'percent', 'arithmetic', 'pagdadagdag', 'pagbabawas', 'pagpaparami', 'paghahati', 'hati', 'dagdag', 'bawas', 'pagdugang', 'pag-ibanan', 'pagpadaghan', 'pagbahin'],
      algebra: ['algebra', 'equation', 'quadratic', 'polynomial', 'simplify', 'factor', 'expand', 'variable', 'expression', 'inequality', 'solve for', 'find x', 'alhebra', 'ekwasyon', 'lutasin', 'sulbad'],
      geometry: ['geometry', 'area', 'perimeter', 'volume', 'circumference', 'triangle', 'rectangle', 'circle', 'square', 'angle', 'pythagorean', 'heometriya', 'sukat', 'lawak', 'tatsulok', 'parihaba', 'bilog'],
      trigonometry: ['trigonometry', 'sine', 'cosine', 'tangent', 'sin', 'cos', 'tan', 'right triangle', 'trigonometriya'],
      calculus: ['calculus', 'derivative', 'integral', 'differentiation', 'integration', 'limit', 'function', 'kalkulo'],
      statistics: ['statistics', 'probability', 'mean', 'median', 'mode', 'standard deviation', 'variance', 'quartile', 'frequency distribution', 'grouped data', 'ungrouped data', 'data set', 'estadistika', 'probabilidad', 'frequency', 'grouped data', 'data set'],
      sequences: ['sequence', 'series', 'arithmetic sequence', 'geometric sequence', 'summation', 'nth term', 'serye', 'pagkakasunod-sunod'],
      numberTheory: ['number theory', 'prime number', 'gcd', 'lcm', 'divisibility', 'integer', 'teorya ng numero'],
      financialMath: ['interest', 'compound interest', 'simple interest', 'annuity', 'amortization', 'investment', 'loan', 'mortgage', 'depreciation', 'tubo', 'interes', 'pautang'],
      measurement: ['conversion', 'convert', 'unit', 'kilometer', 'meter', 'centimeter', 'kilogram', 'gram', 'liter', 'measurement', 'sukat', 'timbang', 'bigat'],
      setTheory: ['set theory', 'set', 'subset', 'union', 'intersection', 'venn diagram', 'teorya ng set'],
      matrices: ['matrix', 'matrices', 'determinant', 'vector', 'eigenvalue', 'transpose'],
      combinatorics: ['combination', 'permutation', 'binomial theorem', 'factorial', 'counting', 'kombinasyon', 'permutasyon'],
      logarithms: ['logarithm', 'log', 'exponent', 'exponential', 'radical', 'square root', 'cube root']
    };
    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(keyword => lower.includes(keyword))) {
        return topic;
      }
    }
    return 'general';
  },

  getTopicSpecificInstructions(topic, language) {
    const isTagalog = language === 'tagalog' || language === 'filipino';
    const isBisaya = language === 'bisaya' || language === 'cebuano';
    const instructions = {
      arithmetic: { english: 'Focus ONLY on basic arithmetic operations.', tagalog: 'Tumutok LAMANG sa basic arithmetic operations.', bisaya: 'Tumutok LAMANG sa basic arithmetic operations.' },
      algebra: { english: 'Focus ONLY on algebraic concepts.', tagalog: 'Tumutok LAMANG sa algebraic concepts.', bisaya: 'Tumutok LAMANG sa algebraic concepts.' },
      geometry: { english: 'Focus ONLY on geometric concepts.', tagalog: 'Tumutok LAMANG sa geometric concepts.', bisaya: 'Tumutok LAMANG sa geometric concepts.' },
      statistics: { english: 'Focus ONLY on statistical concepts.', tagalog: 'Tumutok LAMANG sa statistical concepts.', bisaya: 'Tumutok LAMANG sa statistical concepts.' },
      sequences: { english: 'Focus ONLY on sequences and series.', tagalog: 'Tumutok LAMANG sa sequences at series.', bisaya: 'Tumutok LAMANG sa sequences ug series.' },
      general: { english: 'Focus on the specific mathematical concept.', tagalog: 'Tumutok sa specific mathematical concept.', bisaya: 'Tumutok sa specific mathematical concept.' }
    };
    const topicInstructions = instructions[topic] || instructions.general;
    if (isTagalog) return topicInstructions.tagalog;
    if (isBisaya) return topicInstructions.bisaya;
    return topicInstructions.english;
  },

  buildMathSolutionPrompt(prompt, language) {
    const langName = this.getLanguageName(language);
    const topic = this.detectMathTopic(prompt);
    const wantsExamples = this.isExampleRequest(prompt);
    const topicInstructions = this.getTopicSpecificInstructions(topic, language);
    const isTagalog = language === 'tagalog' || language === 'filipino';
    const isBisaya = language === 'bisaya' || language === 'cebuano';
    let final = '';
    
    if (isTagalog) {
      final += `IKAW AY ISANG MATH TUTOR NA EKSPERTO SA ${topic.toUpperCase()}.\n\n`;
      final += `TANONG NG USER: "${prompt}"\n\n`;
      final += `MAHALAGANG INSTRUKSYON:\n${topicInstructions}\n\n`;
      if (wantsExamples) {
        final += `MAGBIGAY NG MGA HALIMBAWA NA TUNGKOL LAMANG SA ${topic.toUpperCase()}.\n`;
        final += `MAGBIGAY NG 2-3 HALIMBAWA na may kumpletong solusyon.\n\n`;
      } else {
        final += `MAGBIGAY NG KUMPLETONG SOLUSYON na may hakbang-hakbang na paliwanag.\n\n`;
      }
      final += `KRITIKAL NA INSTRUKSYON PARA SA KUMPLETONG SAGOT:\n`;
      final += `- HUWAG GUMAMIT NG "..." PARA PUTULIN ANG SAGOT\n`;
      final += `- KUMPLETUHIN ANG BUONG SOLUSYON HANGGANG SA FINAL ANSWER\n`;
      final += `- IPAKITA ANG LAHAT NG HAKBANG AT KALKULASYON\n\n`;
      final += `KRITIKAL NA FORMAT INSTRUCTIONS:\n`;
      final += `- GUMAMIT LAMANG NG PLAIN TEXT\n`;
      final += `- WALANG LaTeX notation, WALANG backslash commands\n`;
      final += `- Isulat ang fractions bilang (a)/(b) o a/b\n`;
      final += `- Isulat ang multiplication bilang x o *\n`;
      final += `- Isulat ang subscripts bilang a1, a2, a3\n`;
      final += `- Isulat ang exponents bilang x^2\n\n`;
      final += `FORMAT NG SAGOT:\n`;
      final += `Problema: [Ang problema]\n\nDatos: [Ang mga given values]\n\n`;
      if (topic !== 'arithmetic') final += `Pormula: [Ang pormula na ginamit]\n\n`;
      final += `Hakbang-hakbang na Solusyon:\n`;
      final += `Hakbang 1: [Unang hakbang]\nPaliwanag: [Bakit ginawa ito]\nKalkulasyon: [Ang kalkulasyon]\n\n`;
      final += `Hakbang 2: [Pangalawang hakbang]\nPaliwanag: [Bakit ginawa ito]\nKalkulasyon: [Ang kalkulasyon]\n\n`;
      final += `Pinal na Sagot: [Ang sagot]\n\n`;
      final += `Tumugon sa ${langName.toUpperCase()}.\n`;
    } else if (isBisaya) {
      final += `IKAW USA KA MATH TUTOR NGA EKSPERTO SA ${topic.toUpperCase()}.\n\n`;
      final += `PANGUTANA SA USER: "${prompt}"\n\n`;
      final += `MAHINUNGDANON NGA INSTRUKSYON:\n${topicInstructions}\n\n`;
      if (wantsExamples) {
        final += `PAGHATAG UG MGA PANANGLITAN MAHITUNGOD LAMANG SA ${topic.toUpperCase()}.\n`;
        final += `PAGHATAG UG 2-3 KA PANANGLITAN nga adunay kompletong solusyon.\n\n`;
      } else {
        final += `PAGHATAG UG KOMPLETONG SOLUSYON nga adunay lakang-lakang nga pagpasabot.\n\n`;
      }
      final += `KRITIKAL NGA INSTRUKSYON PARA SA KOMPLETONG TUBAG:\n`;
      final += `- AYAW GAMITA ANG "..." SA PAGPUTOL SA TUBAG\n`;
      final += `- KOMPLETUHA ANG TIBUOK SOLUSYON HANGGANG SA FINAL ANSWER\n\n`;
      final += `KRITIKAL NGA FORMAT INSTRUCTIONS:\n`;
      final += `- GAMITA LAMANG ANG PLAIN TEXT\n`;
      final += `- WALAY LaTeX notation, WALAY backslash commands\n`;
      final += `- Isulat ang fractions isip (a)/(b) o a/b\n`;
      final += `- Isulat ang multiplication isip x o *\n\n`;
      final += `FORMAT SA TUBAG:\n`;
      final += `Problema: [Ang problema]\n\nDatos: [Ang mga given values]\n\n`;
      if (topic !== 'arithmetic') final += `Pormula: [Ang pormula nga gigamit]\n\n`;
      final += `Lakang-lakang nga Solusyon:\n`;
      final += `Lakang 1: [Unang lakang]\nPagpasabot: [Ngano gibuhat kini]\nKalkulasyon: [Ang kalkulasyon]\n\n`;
      final += `Lakang 2: [Ikaduhang lakang]\nPagpasabot: [Ngano gibuhat kini]\nKalkulasyon: [Ang kalkulasyon]\n\n`;
      final += `Pinal nga Tubag: [Ang tubag]\n\n`;
      final += `Tubag sa ${langName.toUpperCase()}.\n`;
    } else {
      final += `YOU ARE A MATH TUTOR SPECIALIZING IN ${topic.toUpperCase()}.\n\n`;
      final += `USER QUESTION: "${prompt}"\n\n`;
      final += `IMPORTANT INSTRUCTIONS:\n${topicInstructions}\n\n`;
      if (wantsExamples) {
        final += `PROVIDE EXAMPLES ONLY ABOUT ${topic.toUpperCase()}.\n`;
        final += `PROVIDE 2-3 EXAMPLES with complete solutions.\n\n`;
      } else {
        final += `PROVIDE COMPLETE SOLUTION with step-by-step explanation.\n\n`;
      }
      final += `CRITICAL INSTRUCTIONS FOR COMPLETE ANSWER:\n`;
      final += `- DO NOT USE "..." TO TRUNCATE THE ANSWER\n`;
      final += `- COMPLETE THE ENTIRE SOLUTION UNTIL THE FINAL ANSWER\n\n`;
      final += `CRITICAL FORMAT INSTRUCTIONS:\n`;
      final += `- USE ONLY PLAIN TEXT\n`;
      final += `- NO LaTeX notation, NO backslash commands\n`;
      final += `- Write fractions as (a)/(b) or a/b\n`;
      final += `- Write multiplication as x or *\n`;
      final += `- Write subscripts as a1, a2, a3\n`;
      final += `- Write exponents as x^2\n\n`;
      final += `RESPONSE FORMAT:\n`;
      final += `Problem: [The problem]\n\nData: [The given values]\n\n`;
      if (topic !== 'arithmetic') final += `Formula: [The formula used]\n\n`;
      final += `Step-by-step Solution:\n`;
      final += `Step 1: [First step]\nExplanation: [Why this is done]\nCalculation: [The calculation]\n\n`;
      final += `Step 2: [Second step]\nExplanation: [Why this is done]\nCalculation: [The calculation]\n\n`;
      final += `Final Answer: [The answer]\n\n`;
      final += `Respond in ${langName.toUpperCase()}.\n`;
    }
    return final;
  },

  // ========== LANGUAGE DETECTION ==========
  detectLanguage(prompt) {
    if (!prompt) return 'english';
    const lower = prompt.toLowerCase();
    const languages = {
      tagalog: {
        keywords: ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ako', 'ikaw', 'siya', 'kami', 'tayo', 'kayo', 'sila', 'ito', 'iyan', 'iyon', 'gusto', 'ayaw', 'pwede', 'maaari', 'dapat', 'kailangan', 'hindi', 'oo', 'salamat', 'paki', 'tanong', 'sagot', 'tulong', 'paliwanag', 'ano', 'bakit', 'paano', 'saan', 'kailan', 'sino', 'halimbawa', 'lutasin', 'hanapin', 'sagutin'],
        minMatches: 2
      },
      bisaya: {
        keywords: ['ako', 'ikaw', 'siya', 'kami', 'kita', 'kamo', 'sila', 'kini', 'kana', 'kadto', 'dinhi', 'diha', 'didto', 'unsa', 'ngano', 'giunsa', 'asa', 'kanus-a', 'kinsa', 'pila', 'gusto', 'ayaw', 'pwede', 'mahimo', 'kinahanglan', 'naa', 'wala', 'dili', 'oo', 'salamat', 'palihug', 'pangutana', 'tubag', 'tabang', 'pananglitan', 'sulbad', 'pangitaa', 'kwentaha'],
        minMatches: 2
      },
      cebuano: {
        keywords: ['ako', 'ikaw', 'siya', 'kami', 'kita', 'kamo', 'sila', 'kini', 'kana', 'kadto', 'dinhi', 'diha', 'didto', 'unsa', 'ngano', 'giunsa', 'asa', 'kanus-a', 'kinsa', 'pila', 'gusto', 'ayaw', 'pwede', 'mahimo', 'kinahanglan', 'naa', 'wala', 'dili', 'oo', 'salamat', 'palihug', 'pangutana', 'tubag', 'tabang', 'pananglitan', 'sulbad', 'pangitaa', 'kwentaha'],
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
      'english': 'English', 'tagalog': 'Tagalog', 'filipino': 'Filipino',
      'bisaya': 'Bisaya', 'cebuano': 'Cebuano', 'ilocano': 'Ilocano',
      'waray': 'Waray', 'hiligaynon': 'Hiligaynon', 'kapampangan': 'Kapampangan',
      'spanish': 'Spanish'
    };
    return names[languageCode] || 'English';
  },

  // ========== CASUAL CONVERSATION ==========
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
      'ikaw', 'ikaw ba', 'eh ikaw',
      'unsa ka', 'unsa man', 'naunsa ka',
      'unsa balita', 'ok ra', 'maayo ra',
      'how are you', 'hows it going', 'whats up',
      'how you doing', 'sup', 'yo', 'thanks',
      'hows your day', 'whats new'
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

  // ========== PROMPT BUILDERS ==========
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
    if (wantsDetailed) final += `Provide a COMPREHENSIVE and DETAILED explanation.\n`;
    else final += `Provide a SHORT, DIRECT, and ACCURATE response.\n`;
    final += `Use plain text only. No markdown or symbols.\n`;
    final += `Respond in ${langName.toUpperCase()} language.\n`;
    return final;
  },

  // ========== IMAGE ANALYSIS ==========
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
      prompt += `UNAHIN MONG TUKUYIN KUNG ANONG KLASE NG IMAGE ITO, pagkatapos ay tumugon nang ANGKOP.\n\n`;
      prompt += `CLASSIFICATION AT RESPONSE:\n\n`;
      prompt += `1. ACTIVITY SHEET / WORKSHEET / QUIZ / EXAM:\n`;
      prompt += `   - HUWAG isama ang pangalan ng estudyante\n`;
      prompt += `   - HUWAG isama ang grade at section\n`;
      prompt += `   - HUWAG maglagay ng intro\n`;
      prompt += `   - DIREKTA sa mga sagot\n`;
      prompt += `   - BASAHIN MABUTI ANG INSTRUCTIONS NG BAWAT PART\n`;
      prompt += `   - SUNDIN ANG EXACT FORMAT na hinihingi ng instructions\n\n`;
      prompt += `   KUNG SEQUENCING (Arrange in order):\n`;
      prompt += `   - Ibigay ang tamang ORDER ng steps\n`;
      prompt += `   - Isulat ang number (1, 2, 3, etc.) sa tamang sequence\n`;
      prompt += `   - Ipakita ang steps sa TAMANG ORDER\n\n`;
      prompt += `   KUNG CHECK OR X (Proper/Improper):\n`;
      prompt += `   - Gumamit ng T para sa PROPER\n`;
      prompt += `   - Gumamit ng F para sa IMPROPER\n`;
      prompt += `   - HUWAG iwanang blank ang mga sagot\n`;
      prompt += `   - Bawat item dapat may T o F\n\n`;
      prompt += `   KUNG MULTIPLE CHOICE:\n`;
      prompt += `   - Ibigay ang LETTER ng tamang sagot\n`;
      prompt += `   - Isulat ang buong sagot\n\n`;
      prompt += `   KUNG ENUMERATION:\n`;
      prompt += `   - Ibigay ang KUMPLETONG listahan\n`;
      prompt += `   - Sundin ang hinihinging bilang ng items\n\n`;
      prompt += `   KUNG ESSAY (1-2 sentences):\n`;
      prompt += `   - Ibigay ang sagot sa 1-2 pangungusap LAMANG\n`;
      prompt += `   - HUWAG lumampas sa hinihinging bilang ng pangungusap\n\n`;
      prompt += `   KUNG MATH:\n`;
      prompt += `   - Ipakita ang step-by-step solution\n`;
      prompt += `   - Ibigay ang pinal na sagot\n\n`;
      prompt += `   MAHALAGA:\n`;
      prompt += `   - Panatilihin ang ORIGINAL na format ng activity sheet\n`;
      prompt += `   - Ibigay ang SAGOT LAMANG, walang explanation kung hindi kailangan\n`;
      prompt += `   - Kung may blank na kailangan sagutan, LAGYAN ng sagot\n`;
      prompt += `   - HUWAG iwanang blank ang anumang item\n\n`;
      prompt += `2. MATH PROBLEM / EQUATION / GRAPH:\n`;
      prompt += `   - Ipakita ang KUMPLETONG step-by-step solution\n`;
      prompt += `   - Ibigay ang pinal na sagot\n\n`;
      prompt += `3. INFOGRAPHIC / EDUCATIONAL IMAGE:\n`;
      prompt += `   - Ibuod sa 2-3 pangungusap LAMANG\n`;
      prompt += `   - Sabihin ang pangunahing mensahe\n\n`;
      prompt += `4. PAINTING / DRAWING / ARTWORK:\n`;
      prompt += `   - Ilarawan sa 1-2 pangungusap\n`;
      prompt += `   - Kung may deep meaning: Ipaliwanag sa 1-2 pangungusap\n\n`;
      prompt += `5. MEME / JOKE / HUMOROUS IMAGE:\n`;
      prompt += `   - Ipaliwanag ang biro sa 1 pangungusap\n\n`;
      prompt += `6. PHOTO / CASUAL IMAGE:\n`;
      prompt += `   - Ilarawan sa 1-2 pangungusap lamang\n\n`;
      prompt += `MAHALAGANG PANUNTUNAN:\n`;
      prompt += `- DIREKTA sa mga sagot, WALANG intro\n`;
      prompt += `- SUNDIN ANG INSTRUCTIONS NG ACTIVITY SHEET\n`;
      prompt += `- HUWAG iwanang blank ang mga sagot\n`;
      prompt += `- Gumamit ng T o F kung hinihingi\n`;
      prompt += `- Ibigay ang tamang ORDER kung sequencing\n`;
      prompt += `- WALANG translation\n`;
      prompt += `- Tumugon sa ${langName.toUpperCase()} LAMANG\n\n`;
      prompt += `TANONG NG USER: ${userPrompt || 'Suriin ang imaheng ito'}`;
    } else {
      prompt = `You are an AI assistant analyzing an image.\n\n`;
      prompt += `FIRST IDENTIFY WHAT TYPE OF IMAGE THIS IS, then respond APPROPRIATELY.\n\n`;
      prompt += `CLASSIFICATION AND RESPONSE:\n\n`;
      prompt += `1. ACTIVITY SHEET / WORKSHEET / QUIZ / EXAM:\n`;
      prompt += `   - DO NOT include student name\n`;
      prompt += `   - DO NOT include grade and section\n`;
      prompt += `   - DO NOT add intro\n`;
      prompt += `   - DIRECTLY provide answers\n`;
      prompt += `   - READ THE INSTRUCTIONS OF EACH PART CAREFULLY\n`;
      prompt += `   - FOLLOW THE EXACT FORMAT required by instructions\n\n`;
      prompt += `   IF SEQUENCING (Arrange in order):\n`;
      prompt += `   - Provide the correct ORDER of steps\n`;
      prompt += `   - Write the number (1, 2, 3, etc.) in correct sequence\n`;
      prompt += `   - Show steps in CORRECT ORDER\n\n`;
      prompt += `   IF CHECK OR X (Proper/Improper):\n`;
      prompt += `   - Use T for PROPER\n`;
      prompt += `   - Use F for IMPROPER\n`;
      prompt += `   - DO NOT leave answers blank\n`;
      prompt += `   - Each item should have T or F\n\n`;
      prompt += `   IF MULTIPLE CHOICE:\n`;
      prompt += `   - Provide the LETTER of correct answer\n`;
      prompt += `   - Write the complete answer\n\n`;
      prompt += `   IF ENUMERATION:\n`;
      prompt += `   - Provide COMPLETE list\n`;
      prompt += `   - Follow the required number of items\n\n`;
      prompt += `   IF ESSAY (1-2 sentences):\n`;
      prompt += `   - Provide answer in 1-2 sentences ONLY\n`;
      prompt += `   - DO NOT exceed the required number of sentences\n\n`;
      prompt += `   IF MATH:\n`;
      prompt += `   - Show step-by-step solution\n`;
      prompt += `   - Provide final answer\n\n`;
      prompt += `   IMPORTANT:\n`;
      prompt += `   - Maintain the ORIGINAL format of activity sheet\n`;
      prompt += `   - Provide ANSWER ONLY, no explanation if not needed\n`;
      prompt += `   - If there are blanks to fill, FILL them with answers\n`;
      prompt += `   - DO NOT leave any item blank\n\n`;
      prompt += `2. MATH PROBLEM / EQUATION / GRAPH:\n`;
      prompt += `   - Show COMPLETE step-by-step solution\n`;
      prompt += `   - Provide final answer\n\n`;
      prompt += `3. INFOGRAPHIC / EDUCATIONAL IMAGE:\n`;
      prompt += `   - Summarize in 2-3 sentences ONLY\n`;
      prompt += `   - State the main message\n\n`;
      prompt += `4. PAINTING / DRAWING / ARTWORK:\n`;
      prompt += `   - Describe in 1-2 sentences\n`;
      prompt += `   - If deep meaning: Explain in 1-2 sentences\n\n`;
      prompt += `5. MEME / JOKE / HUMOROUS IMAGE:\n`;
      prompt += `   - Explain the joke in 1 sentence\n\n`;
      prompt += `6. PHOTO / CASUAL IMAGE:\n`;
      prompt += `   - Describe in 1-2 sentences only\n\n`;
      prompt += `IMPORTANT RULES:\n`;
      prompt += `- DIRECTLY provide answers, NO intro\n`;
      prompt += `- FOLLOW THE INSTRUCTIONS of the activity sheet\n`;
      prompt += `- DO NOT leave answers blank\n`;
      prompt += `- Use T or F if required\n`;
      prompt += `- Provide correct ORDER if sequencing\n`;
      prompt += `- NO translations\n`;
      prompt += `- Respond in ${langName.toUpperCase()} ONLY\n\n`;
      prompt += `USER QUESTION: ${userPrompt || 'Analyze this image'}`;
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
    
    processed = processed.replace(/\s*\([^)]*[A-Za-z]{20,}[^)]*\)/g, '');
    
    processed = processed
      .replace(/^\s*[\*\-•]\s*Landscape:.*?\n/gim, '')
      .replace(/^\s*[\*\-•]\s*Lake:.*?\n/gim, '')
      .replace(/^\s*[\*\-•]\s*Foreground:.*?\n/gim, '')
      .replace(/^\s*[\*\-•]\s*Activities.*?\n/gim, '')
      .replace(/^\s*[\*\-•]\s*People:.*?\n/gim, '')
      .replace(/^\s*[\*\-•]\s*Overall Mood:.*?\n/gim, '')
      .replace(/^\s*[\*\-•]\s*Canoeing:.*?\n/gim, '')
      .replace(/^\s*[\*\-•]\s*Barbecue.*?\n/gim, '');
    
    const hasMathOrQuiz = processed.includes('Step 1:') || 
                          processed.includes('Hakbang 1:') ||
                          processed.includes('1.') ||
                          processed.includes('Paliwanag:') ||
                          processed.includes('Explanation:') ||
                          processed.includes('PART I') ||
                          processed.includes('PART II') ||
                          processed.includes('PART III');
    
    if (!hasMathOrQuiz) {
      const sentences = processed.split(/(?<=[.!?])\s+/);
      if (sentences.length > 3) {
        processed = sentences.slice(0, 3).join(' ');
      }
    }
    
    return this.cleanResponse(processed);
  },

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

  // ========== MODIFICATION & FOLLOW-UP ==========
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

  // ========== NEW TEXT PROCESSING FUNCTION DETECTIONS ==========
  isTranslateRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    return lower.startsWith('translate') && lower.includes(' to ');
  },

  isHumanizeRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = ['humanize ', 'make it human', 'parang tao', 'naturalize'];
    return patterns.some(p => lower.startsWith(p) || lower.includes(' ' + p));
  },

  isSummarizeRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = ['summarize ', 'summary ', 'buod ', 'summarize this'];
    return patterns.some(p => lower.startsWith(p) || lower.includes(' ' + p));
  },

  isShortenRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = ['shorten ', 'concise ', 'condense ', 'paikliin ', 'pamubo '];
    return patterns.some(p => lower.startsWith(p) || lower.includes(' ' + p));
  },

  isFluentRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = ['fluent ', 'make it fluent', 'improve fluency', 'smooth text'];
    return patterns.some(p => lower.startsWith(p) || lower.includes(' ' + p));
  },

  isElaborateRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = ['elaborate ', 'explain more', 'expand ', 'ipaliwanag '];
    return patterns.some(p => lower.startsWith(p) || lower.includes(' ' + p));
  },

  isClarifyRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = ['clarify ', 'make it clear', 'paki linaw', 'linawin '];
    return patterns.some(p => lower.startsWith(p) || lower.includes(' ' + p));
  },

  isValidateRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = ['validate ', 'verify ', 'check ', 'totoo ba', 'tama ba'];
    return patterns.some(p => lower.startsWith(p) || lower.includes(' ' + p));
  },

  isSimplifyRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = ['simplify ', 'make it simple', 'payak ', 'gawing simple'];
    return patterns.some(p => lower.startsWith(p) || lower.includes(' ' + p));
  },

  isEli5Request(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = ['explain like i\'m 5', 'eli5 ', 'para sa bata', 'pang bata'];
    return patterns.some(p => lower.startsWith(p) || lower.includes(' ' + p));
  },

  isRephraseRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = ['rephrase ', 'paraphrase ', 'rewrite ', 'ibang salita'];
    return patterns.some(p => lower.startsWith(p) || lower.includes(' ' + p));
  },

  isPolishRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = ['polish ', 'improve ', 'enhance ', 'gawing mas maganda'];
    return patterns.some(p => lower.startsWith(p) || lower.includes(' ' + p));
  },

  // ========== SPECIAL COMMANDS DETECTION ==========
  isLyricsRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    const keywords = ['lyrics ', 'lyric ', 'letra ', 'song lyrics'];
    return keywords.some(k => lower.startsWith(k) || lower.includes(' ' + k));
  },

  isGenerateCommand(prompt) {
    const commands = ['generate', 'image', 'img', 'show'];
    return commands.some(cmd => prompt.toLowerCase().startsWith(cmd + ' '));
  },

  isImageRequest(prompt) {
    const lower = prompt.toLowerCase();
    const patterns = [
      'show me image', 'show me picture', 'picture of', 'image of',
      'larawan ng', 'litrato ng', 'imahe ng'
    ];
    return patterns.some(pattern => lower.includes(pattern));
  },

  isMusicRequest(prompt) {
    const keywords = ['play', 'song', 'music', 'track', 'audio'];
    return keywords.some(k => prompt.toLowerCase().includes(k));
  },

  isScholarCommand(prompt) {
    const commands = ['gscholar', 'scholar', 'research'];
    return commands.some(cmd => prompt.toLowerCase().startsWith(cmd + ' '));
  },

  isResearchQuery(prompt) {
    const lower = prompt.toLowerCase();
    const patterns = [
      'find research', 'find study', 'research about', 'study about',
      'academic paper', 'scholarly article'
    ];
    return patterns.some(pattern => lower.includes(pattern));
  },

  // ========== NEW TEXT PROCESSING HANDLERS ==========
  async handleTranslate(senderId, prompt, token) {
    const lower = prompt.toLowerCase();
    const parts = prompt.split(' to ');
    if (parts.length < 2) {
      await sendMessage(senderId, { text: 'Usage: translate [text] to [language]' }, token);
      return;
    }
    const textToTranslate = parts[0].replace('translate', '').trim();
    const targetLanguage = parts[1].trim();
    const detectedLang = this.detectLanguage(textToTranslate);
    const sourceLang = this.getLanguageName(detectedLang);
    const targetLang = targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1);
    
    const translationPrompt = `Translate the following text from ${sourceLang} to ${targetLang}. Only provide the translation, no other text. Text: "${textToTranslate}"`;
    const response = await this.callAPI(translationPrompt);
    const translated = this.cleanResponse(response || 'Translation not available.');
    
    const output = `Translation:\n\nOriginal: ${textToTranslate}\nTranslated: ${translated}\n\nSuccessfully translated from ${sourceLang} to ${targetLang}.`;
    await this.sendChunks(senderId, output, token);
  },

  async handleHumanize(senderId, prompt, token) {
    const text = prompt.replace(/humanize|make it human|parang tao|naturalize/gi, '').trim();
    if (!text) {
      await sendMessage(senderId, { text: 'Usage: humanize [text to humanize]' }, token);
      return;
    }
    const detectedLang = this.detectLanguage(text);
    const humanizePrompt = `Rewrite the following text in a more natural, conversational, and human-like way. Make it sound like a real person talking. Keep the same meaning. Text: "${text}"`;
    const response = await this.callAPI(humanizePrompt);
    const humanized = this.cleanResponse(response || 'Unable to humanize text.');
    const output = `Humanized Version:\n\n${humanized}`;
    await this.sendChunks(senderId, output, token);
  },

  async handleSummarize(senderId, prompt, token) {
    const text = prompt.replace(/summarize|summary|buod|summarize this/gi, '').trim();
    if (!text) {
      await sendMessage(senderId, { text: 'Usage: summarize [text to summarize]' }, token);
      return;
    }
    const detectedLang = this.detectLanguage(text);
    const langName = this.getLanguageName(detectedLang);
    const summarizePrompt = `Summarize the following text in maximum 3 sentences. Be direct and concise. Language: ${langName}. Text: "${text}"`;
    const response = await this.callAPI(summarizePrompt);
    const summarized = this.cleanResponse(response || 'Unable to summarize text.');
    const output = `Summary:\n\n${summarized}`;
    await this.sendChunks(senderId, output, token);
  },

  async handleShorten(senderId, prompt, token) {
    const text = prompt.replace(/shorten|concise|condense|paikliin|pamubo|direct to the point/gi, '').trim();
    if (!text) {
      await sendMessage(senderId, { text: 'Usage: shorten [text to shorten]' }, token);
      return;
    }
    const detectedLang = this.detectLanguage(text);
    const langName = this.getLanguageName(detectedLang);
    const shortenPrompt = `Make the following text very short, concise, and direct to the point. Maximum 2 sentences. Language: ${langName}. Text: "${text}"`;
    const response = await this.callAPI(shortenPrompt);
    const shortened = this.cleanResponse(response || 'Unable to shorten text.');
    const output = `Shortened:\n\n${shortened}`;
    await this.sendChunks(senderId, output, token);
  },

  async handleFluent(senderId, prompt, token) {
    const text = prompt.replace(/fluent|make it fluent|improve fluency|smooth text/gi, '').trim();
    if (!text) {
      await sendMessage(senderId, { text: 'Usage: fluent [text to improve]' }, token);
      return;
    }
    const detectedLang = this.detectLanguage(text);
    const langName = this.getLanguageName(detectedLang);
    const fluentPrompt = `Rewrite the following text to make it more fluent, smooth, and professional. Improve the flow and readability. Language: ${langName}. Text: "${text}"`;
    const response = await this.callAPI(fluentPrompt);
    const fluent = this.cleanResponse(response || 'Unable to improve fluency.');
    const output = `Fluent Version:\n\n${fluent}`;
    await this.sendChunks(senderId, output, token);
  },

  async handleElaborate(senderId, prompt, token) {
    const text = prompt.replace(/elaborate|explain more|expand|ipaliwanag|more details/gi, '').trim();
    if (!text) {
      await sendMessage(senderId, { text: 'Usage: elaborate [topic to elaborate]' }, token);
      return;
    }
    const detectedLang = this.detectLanguage(text);
    const langName = this.getLanguageName(detectedLang);
    const elaboratePrompt = `Provide a detailed elaboration on the following topic. Include examples, explanations, and comprehensive information. Language: ${langName}. Topic: "${text}"`;
    const response = await this.callAPI(elaboratePrompt);
    const elaborated = this.cleanResponse(response || 'Unable to elaborate.');
    const output = `Elaborated Version:\n\n${elaborated}`;
    await this.sendChunks(senderId, output, token);
  },

  async handleClarify(senderId, prompt, token) {
    const text = prompt.replace(/clarify|make it clear|paki linaw|linawin|clear/gi, '').trim();
    if (!text) {
      await sendMessage(senderId, { text: 'Usage: clarify [topic to clarify]' }, token);
      return;
    }
    const detectedLang = this.detectLanguage(text);
    const langName = this.getLanguageName(detectedLang);
    const clarifyPrompt = `Clarify and explain the following in simple, clear terms. Make it easy to understand. Language: ${langName}. Text: "${text}"`;
    const response = await this.callAPI(clarifyPrompt);
    const clarified = this.cleanResponse(response || 'Unable to clarify.');
    const output = `Clarification:\n\n${clarified}`;
    await this.sendChunks(senderId, output, token);
  },

  async handleValidate(senderId, prompt, token) {
    const text = prompt.replace(/validate|verify|check|totoo ba|tama ba|confirm/gi, '').trim();
    if (!text) {
      await sendMessage(senderId, { text: 'Usage: validate [statement to verify]' }, token);
      return;
    }
    const detectedLang = this.detectLanguage(text);
    const langName = this.getLanguageName(detectedLang);
    const validatePrompt = `Verify and validate the following statement. Provide factual information, evidence, and reasoning. Language: ${langName}. Statement: "${text}"`;
    const response = await this.callAPI(validatePrompt);
    const validated = this.cleanResponse(response || 'Unable to validate.');
    const output = `Validation Result:\n\n${validated}`;
    await this.sendChunks(senderId, output, token);
  },

  async handleSimplify(senderId, prompt, token) {
    const text = prompt.replace(/simplify|make it simple|payak|gawing simple/gi, '').trim();
    if (!text) {
      await sendMessage(senderId, { text: 'Usage: simplify [text to simplify]' }, token);
      return;
    }
    const detectedLang = this.detectLanguage(text);
    const langName = this.getLanguageName(detectedLang);
    const simplifyPrompt = `Simplify the following text. Remove complexity and make it easy to understand. Use simple words and clear explanations. Language: ${langName}. Text: "${text}"`;
    const response = await this.callAPI(simplifyPrompt);
    const simplified = this.cleanResponse(response || 'Unable to simplify.');
    const output = `Simplified Version:\n\n${simplified}`;
    await this.sendChunks(senderId, output, token);
  },

  async handleEli5(senderId, prompt, token) {
    const text = prompt.replace(/explain like i'm 5|eli5|para sa bata|pang bata/gi, '').trim();
    if (!text) {
      await sendMessage(senderId, { text: 'Usage: explain like I\'m 5 [topic]' }, token);
      return;
    }
    const detectedLang = this.detectLanguage(text);
    const langName = this.getLanguageName(detectedLang);
    const eli5Prompt = `Explain the following like I'm 5 years old. Use very simple words, analogies, and examples that a child would understand. Language: ${langName}. Topic: "${text}"`;
    const response = await this.callAPI(eli5Prompt);
    const explained = this.cleanResponse(response || 'Unable to explain.');
    const output = `Explain Like I'm 5:\n\n${explained}`;
    await this.sendChunks(senderId, output, token);
  },

  async handleRephrase(senderId, prompt, token) {
    const text = prompt.replace(/rephrase|paraphrase|rewrite|ibang salita/gi, '').trim();
    if (!text) {
      await sendMessage(senderId, { text: 'Usage: rephrase [text to rephrase]' }, token);
      return;
    }
    const detectedLang = this.detectLanguage(text);
    const langName = this.getLanguageName(detectedLang);
    const rephrasePrompt = `Rephrase the following text in different ways. Provide 3 different versions. Keep the same meaning but use different wording. Language: ${langName}. Text: "${text}"`;
    const response = await this.callAPI(rephrasePrompt);
    const rephrased = this.cleanResponse(response || 'Unable to rephrase.');
    const output = `Rephrased Versions:\n\n${rephrased}`;
    await this.sendChunks(senderId, output, token);
  },

  async handlePolish(senderId, prompt, token) {
    const text = prompt.replace(/polish|improve|enhance|gawing mas maganda/gi, '').trim();
    if (!text) {
      await sendMessage(senderId, { text: 'Usage: polish [text to polish]' }, token);
      return;
    }
    const detectedLang = this.detectLanguage(text);
    const langName = this.getLanguageName(detectedLang);
    const polishPrompt = `Polish and improve the following text. Make it more refined, professional, and well-written. Language: ${langName}. Text: "${text}"`;
    const response = await this.callAPI(polishPrompt);
    const polished = this.cleanResponse(response || 'Unable to polish.');
    const output = `Polished Version:\n\n${polished}`;
    await this.sendChunks(senderId, output, token);
  },

  // ========== LYRIC HANDLERS ==========
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
      await sendMessage(senderId, { text: 'Usage: lyrics [song title] by [artist]' }, token);
      return;
    }
    try {
      let query = title;
      if (artist) query += ` ${artist}`;
      const encodedQuery = encodeURIComponent(query);
      const apiUrl = `https://api-library-kohi-production.up.railway.app/api/lyrics?query=${encodedQuery}`;
      const response = await axios.get(apiUrl, { timeout: 15000 });
      const data = response.data;
      if (!data.status || !data.data) {
        await sendMessage(senderId, { text: `Walang nakitang lyrics para sa "${title}".` }, token);
        return;
      }
      const lyricsData = data.data;
      const songTitle = lyricsData.title || title;
      const songArtist = lyricsData.artist || artist || 'Unknown Artist';
      const lyrics = lyricsData.lyrics || 'Lyrics not available.';
      let formattedLyrics = this.formatLyrics(lyrics);
      let message = `${songTitle}\nArtist: ${songArtist}\n\n${formattedLyrics}`;
      await this.sendChunks(senderId, message, token);
    } catch (error) {
      console.error('[Lyrics] Error:', error.message);
      await sendMessage(senderId, { text: `Error sa pagkuha ng lyrics. Subukan muli.` }, token);
    }
  },

  formatLyrics(lyrics) {
    let formatted = lyrics;
    if (!formatted.includes('[Verse') && !formatted.includes('[Chorus') && !formatted.includes('[Bridge')) {
      const lines = formatted.split('\n');
      let newLines = [];
      let isFirst = true;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') { newLines.push(''); continue; }
        if (isFirst && line.length > 0) {
          newLines.push(`[Verse 1]`);
          newLines.push(line);
          isFirst = false;
        } else {
          newLines.push(line);
        }
      }
      formatted = newLines.join('\n');
    }
    return formatted;
  },

  // ========== IMAGE GENERATION HANDLER ==========
  async handleImageGeneration(senderId, prompt, token) {
    let searchTerm = prompt;
    let imageCount = 10;
    const commands = ['generate', 'image', 'img', 'show'];
    for (const cmd of commands) {
      if (searchTerm.toLowerCase().startsWith(cmd)) {
        searchTerm = searchTerm.slice(cmd.length).trim();
        break;
      }
    }
    const args = searchTerm.split(' ');
    const lastArg = args[args.length - 1];
    if (!isNaN(lastArg) && lastArg > 0 && lastArg <= 30) {
      imageCount = parseInt(lastArg);
      searchTerm = args.slice(0, -1).join(' ');
    }
    if (!searchTerm) {
      await sendMessage(senderId, { text: 'Usage: generate [search term] [number]' }, token);
      return;
    }
    try {
      const response = await axios.get('https://hiroshi-api.onrender.com/image/pinterest', {
        params: { search: searchTerm, limit: imageCount }
      });
      const images = (response.data?.data || []).filter(url => this.isValidUrl(url));
      if (images.length === 0) {
        await sendMessage(senderId, { text: `Walang nakitang mga larawan para sa "${searchTerm}".` }, token);
        return;
      }
      for (const imageUrl of images.slice(0, imageCount)) {
        await sendMessage(senderId, { attachment: { type: 'image', payload: { url: imageUrl } } }, token);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error('[Generate] Error:', error.message);
      await sendMessage(senderId, { text: `Error sa pagkuha ng mga larawan.` }, token);
    }
  },

  isValidUrl(string) {
    try { new URL(string); return true; } catch (_) { return false; }
  },

  // ========== MUSIC HANDLER ==========
  async handleMusicSearch(senderId, prompt, token) {
    let searchTerm = prompt;
    const removeKeywords = ['play', 'song', 'music', 'track', 'audio'];
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
      console.error('[Music] Error:', error.message);
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

  // ========== SCHOLAR HANDLER ==========
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
      console.error('[Scholar] Error:', error.message);
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

  generateAPA(authors, year, title, venue, volume, issue, pages, doi, url) {
    const list = authors.split(',').map(a => a.trim()).filter(a => a);
    let formatted = '';
    if (list.length === 0) formatted = 'Unknown';
    else if (list.length === 1) formatted = list[0];
    else if (list.length === 2) formatted = `${list[0]} & ${list[1]}`;
    else formatted = `${list[0]} et al.`;
    let citation = `${formatted} (${year}). ${title}.`;
    if (venue && venue !== 'Unknown') citation += ` ${venue}`;
    if (doi) citation += ` ${doi}`;
    else if (url) citation += ` Retrieved from ${url}`;
    return citation;
  },

  generateMLA(authors, title, venue, year, url, doi, volume, issue, pages) {
    const list = authors.split(',').map(a => a.trim()).filter(a => a);
    let formatted = '';
    if (list.length === 0) formatted = 'Unknown';
    else if (list.length === 1) formatted = list[0];
    else if (list.length === 2) formatted = `${list[0]} and ${list[1]}`;
    else formatted = `${list[0]} et al.`;
    let citation = `${formatted}. "${title}." ${venue}, ${year}.`;
    if (url) citation += ` ${url}.`;
    return citation;
  },

  async fetchDOIFromCrossRef(title, authors, year) {
    try {
      let query = encodeURIComponent(title);
      if (authors && authors !== 'Unknown') query += `+${encodeURIComponent(authors.split(',')[0].trim())}`;
      const url = `https://api.crossref.org/works?query=${query}&rows=1`;
      const response = await axios.get(url, { timeout: 10000 });
      const items = response.data?.message?.items || [];
      if (items.length > 0 && items[0].DOI) return `https://doi.org/${items[0].DOI}`;
      return null;
    } catch (error) {
      return null;
    }
  },

  extractDOIFromLink(link) {
    if (!link) return null;
    const match = link.match(/doi\.org\/([^\s]+)/i);
    if (match) return `https://doi.org/${match[1]}`;
    return null;
  },

  async getCompleteMetadata(doi) {
    try {
      const clean = doi.replace('https://doi.org/', '');
      const url = `https://api.crossref.org/works/${clean}`;
      const response = await axios.get(url, { timeout: 10000 });
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
      return null;
    }
  },

  // ========== USER INFO ==========
  isOwnerQuestion(prompt) {
    const keywords = ['who is your owner', 'who created you', 'who made you', 'sino gumawa sayo'];
    return keywords.some(k => prompt.toLowerCase().includes(k));
  },

  isUserInfoQuestion(prompt) {
    const keywords = ['what is my name', 'ano pangalan ko', 'my name'];
    return keywords.some(k => prompt.toLowerCase().includes(k));
  },

  async handleUserInfo(senderId, prompt, token) {
    try {
      const userInfo = await this.getUserInfo(senderId, token);
      const lang = this.detectLanguage(prompt);
      let response = '';
      if (prompt.toLowerCase().includes('name')) {
        response = userInfo.name ? 
          (lang === 'tagalog' ? `Ang pangalan mo ay ${userInfo.name}.` : `Your name is ${userInfo.name}.`) : 
          'I cannot say that because it is confidential.';
      }
      if (!response) response = 'I cannot say that because it is confidential.';
      await sendMessage(senderId, { text: response }, token);
    } catch (error) {
      await sendMessage(senderId, { text: 'Error sa pagkuha ng impormasyon.' }, token);
    }
  },

  async getUserInfo(senderId, token) {
    try {
      const url = `https://graph.facebook.com/${senderId}`;
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
      return {};
    }
  },

  // ========== GET REPLIED MESSAGE ==========
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

  // ========== API CALLS ==========
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

  // ========== HELPERS ==========
  wantsDetailedAnswer(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['explain more', 'more details', 'detailed', 'elaborate', 'paliwanag', 'ipaliwanag'];
    return keywords.some(k => lower.includes(k));
  },

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
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    return cleaned.trim();
  },

  cleanResponse(text) {
    if (!text) return 'No response.';
    let cleaned = text.trim();
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
    cleaned = cleaned.replace(/#{1,6}\s*/g, '');
    cleaned = cleaned.replace(/`/g, '');
    cleaned = cleaned.replace(/```/g, '');
    cleaned = cleaned.replace(/[━═─]{3,}/g, '');
    cleaned = cleaned.replace(/[-_=]{5,}/g, '');
    cleaned = cleaned.replace(/\|/g, ' ');
    cleaned = cleaned.replace(/[\u{1F000}-\u{1FFFF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2600}-\u{27BF}]/gu, '');
    cleaned = cleaned.replace(/[📌📊📐📝✅📚✏️🎯💡📖🔢🧮]/g, '');
    cleaned = this.cleanMathNotation(cleaned);
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    return cleaned.trim() || 'No response.';
  },

  cleanOldHistory() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000;
    for (const [userId, data] of Object.entries(conversationHistory)) {
      if (now - data.timestamp > maxAge) {
        delete conversationHistory[userId];
      }
    }
  },

  getErrorMessage(error, detectedLanguage = 'english') {
    if (error.code === 'ECONNABORTED') {
      return detectedLanguage === 'tagalog' ? 'Nag-timeout ang request. Subukan muli.' : 'Request timed out. Please try again.';
    }
    return detectedLanguage === 'tagalog' ? 'Error sa pagproseso. Subukan muli.' : 'Error processing request. Please try again.';
  },

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
  }
};
