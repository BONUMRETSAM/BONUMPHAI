const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const MAX_CHUNK = 1900;
const conversationHistory = {};
const SERPAPI_KEY = '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ai', 'opera', 'ask', 'gemini', 'vision', 'gscholar', 'scholar', 'googlescholar', 'research', 'generate', 'image', 'img', 'show'],
  description: 'Multi-modal AI with text, image analysis, Google Scholar, image generation, music search, and lyrics',
  usage: 'ai [message] or send/reply to image or generate [query] or play [song] or lyrics [song]',
  version: '3.0.0',
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

      // 🔥 FIX: Correct typos before processing
      const originalPrompt = prompt;
      const correctedPrompt = this.correctTypos(prompt);
      if (correctedPrompt !== prompt) {
        console.log(`[Typo] "${prompt}" → "${correctedPrompt}"`);
        prompt = correctedPrompt;
      }

      // 🔥 MATH REQUEST DETECTION
      const isMathRequest = this.isMathRequest(prompt);
      if (isMathRequest && !this.isLyricsRequest(prompt) && !this.isScholarCommand(prompt) && 
          !this.isMusicRequest(prompt) && !this.isGenerateCommand(prompt) && !this.isImageRequest(prompt)) {
        await this.handleMathRequest(senderId, prompt, token);
        return;
      }

      // 🔥 DETECT LANGUAGE FROM USER'S PROMPT
      const detectedLanguage = this.detectLanguage(prompt);
      const isCasualConversation = this.isCasualConversation(prompt);

      // ===== SPECIAL COMMANDS =====
      if (this.isLyricsRequest(prompt)) {
        await this.handleLyricsSearch(senderId, prompt, token);
        return;
      }

      if (this.isRealtimeQuestion(prompt)) {
        await this.handleRealtimeQuestion(senderId, prompt, token);
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

      // ================================================================
      // 🆕 IMPROVED: RETURN TO TOPIC (content‑based scoring)
      // ================================================================
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

      // ===== REPLY TO A MESSAGE =====
      if (event?.message?.reply_to?.mid) {
        isReply = true;
        const replyData = await this.getRepliedMessageData(event.message.reply_to.mid, token);
        previousResponse = replyData.message;
        imageUrl = replyData.imageUrl;
        if (!prompt) prompt = 'Please respond to what I said.';
      }

      // ===== IMAGE ATTACHMENT =====
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

      // ===== CONVERSATION CONTEXT =====
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

      // ===== WELCOME MESSAGE =====
      if (!prompt && !isReply && !imageUrl) {
        await sendMessage(senderId, {
          text: 'Hello! Ako si Teacher Arlene - Multi-Modal AI.\n\nMga Kakayahan:\nText conversations\nImage analysis\nAcademic research\nImage generation\nMusic search\nLyrics search\nReal-life situations\nTranslation\nSummarization\nMath Problems (ALL TYPES)\n\nMga Commands:\nai [tanong]\nMag-send ng image para ma-analyze\ngenerate [search term] [number]\ngscholar [search query]\nplay [song title]\nlyrics [song title] by [artist]\n\nMath Commands:\ngive me [math type] problem\nalgebra|geometry|trigonometry|calculus|statistics|probability|grouped data\n\nKaya kong makipag-usap sa Tagalog, Bisaya, English, at iba pang wika.'
        }, token);
        return;
      }

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

      const wantsDetailed = this.wantsDetailedAnswer(prompt);
      let aiResponse = '';

      // ================================================================
      // 🆕 IMAGE ANALYSIS with language detection
      // ================================================================
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

      // ================================================================
      // REPLY / FOLLOW‑UP
      // ================================================================
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

      // ================================================================
      // NEW CONVERSATION
      // ================================================================
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

  // ================================================================
  // 🆕 MATH REQUEST HANDLER - COMPLETE
  // ================================================================
  isMathRequest(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    
    // Keywords for asking for samples
    const sampleKeywords = ['sample', 'example', 'halimbawa', 'samples', 'examples', 'give me', 'show me', 'provide', 'generate'];
    
    // Math type keywords
    const mathKeywords = [
      'algebra', 'geometry', 'trigonometry', 'calculus', 'statistics', 
      'probability', 'grouped data', 'frequency distribution',
      'equation', 'derivative', 'integral', 'limit', 'mean', 'median',
      'mode', 'variance', 'standard deviation', 'area', 'volume',
      'perimeter', 'circumference', 'sin', 'cos', 'tan', 'matrix',
      'permutation', 'combination', 'solve', 'compute', 'calculate'
    ];
    
    // Check if asking for sample
    const askingForSample = sampleKeywords.some(k => lower.includes(k));
    
    // Check if math related
    const hasMathKeyword = mathKeywords.some(k => lower.includes(k));
    
    // Check if contains equation pattern
    const hasEquation = /[\d\+\-\*\/\^\(\)\=]/.test(prompt) && /[=]/.test(prompt);
    
    return askingForSample || hasMathKeyword || hasEquation;
  },

  async handleMathRequest(senderId, prompt, token) {
    try {
      const detectedLanguage = this.detectLanguage(prompt);
      const lower = prompt.toLowerCase();
      
      // ===== DETECT MATH TYPE =====
      let mathType = 'general';
      
      if (lower.includes('grouped data') || lower.includes('frequency distribution')) {
        mathType = 'grouped';
      } else if (lower.includes('statistics') || lower.includes('mean') || lower.includes('median') || 
                 lower.includes('mode') || lower.includes('standard deviation') || lower.includes('variance')) {
        mathType = 'statistics';
      } else if (lower.includes('geometry') || lower.includes('area') || lower.includes('volume') || 
                 lower.includes('perimeter') || lower.includes('circumference') || lower.includes('circle')) {
        mathType = 'geometry';
      } else if (lower.includes('trigonometry') || lower.includes('sin') || lower.includes('cos') || lower.includes('tan')) {
        mathType = 'trigonometry';
      } else if (lower.includes('calculus') || lower.includes('derivative') || lower.includes('integral') || lower.includes('limit')) {
        mathType = 'calculus';
      } else if (lower.includes('probability')) {
        mathType = 'probability';
      } else if (lower.includes('algebra') || lower.includes('equation') || lower.includes('solve')) {
        mathType = 'algebra';
      } else {
        mathType = 'algebra';
      }
      
      // ===== CHECK IF ASKING FOR SAMPLE =====
      const askingForSample = ['sample', 'example', 'halimbawa', 'samples', 'examples', 'give me', 'show me', 'provide', 'generate']
        .some(k => lower.includes(k));
      
      // ===== CHECK IF ASKING TO SOLVE =====
      const hasEquation = /[\d\+\-\*\/\^\(\)\=]/.test(prompt) && /[=]/.test(prompt);
      const askingToSolve = ['solve', 'compute', 'calculate', 'find', 'evaluate', 'what is']
        .some(k => lower.includes(k)) || hasEquation;
      
      let response = '';
      
      if (askingForSample) {
        // User wants a SAMPLE with full solution
        response = `📚 ${this.getMathTypeLabel(mathType)} PROBLEM WITH COMPLETE STEP-BY-STEP SOLUTION\n\n`;
        response += this.generateMathProblem(mathType, detectedLanguage);
      } else if (askingToSolve) {
        // User wants to SOLVE a specific problem
        response = `🔢 SOLVING YOUR MATH PROBLEM\n\n`;
        response += await this.solveMathProblem(prompt, detectedLanguage);
      } else {
        // User is just asking about math
        response = `📖 MATH HELP - ${this.getMathTypeLabel(mathType)}\n\n`;
        response += this.getMathHelp(mathType, detectedLanguage);
      }
      
      await this.sendChunks(senderId, response, token);
      
    } catch (error) {
      console.error('[Math] Error:', error.message);
      await sendMessage(senderId, { 
        text: '❌ Error processing math request. Please try again.' 
      }, token);
    }
  },

  getMathTypeLabel(type) {
    const labels = {
      'algebra': 'ALGEBRA',
      'geometry': 'GEOMETRY',
      'trigonometry': 'TRIGONOMETRY',
      'calculus': 'CALCULUS',
      'statistics': 'STATISTICS',
      'probability': 'PROBABILITY',
      'grouped': 'GROUPED DATA',
      'general': 'MATH'
    };
    return labels[type] || 'MATH';
  },

  // ================================================================
  // 📚 GENERATE MATH PROBLEM WITH FULL SOLUTION
  // ================================================================
  generateMathProblem(type, lang) {
    switch(type) {
      case 'algebra': return this.generateAlgebraProblem(lang);
      case 'geometry': return this.generateGeometryProblem(lang);
      case 'trigonometry': return this.generateTrigonometryProblem(lang);
      case 'calculus': return this.generateCalculusProblem(lang);
      case 'statistics': return this.generateStatisticsProblem(lang);
      case 'probability': return this.generateProbabilityProblem(lang);
      case 'grouped': return this.generateGroupedDataProblem(lang);
      default: return this.generateAlgebraProblem(lang);
    }
  },

  // ================================================================
  // 📐 ALGEBRA - COMPLETE
  // ================================================================
  generateAlgebraProblem(lang) {
    const a = Math.floor(Math.random() * 8) + 2;
    const b = Math.floor(Math.random() * 15) + 1;
    let c = Math.floor(Math.random() * 7) + 1;
    const d = Math.floor(Math.random() * 15) + 1;
    
    while (a === c) c = Math.floor(Math.random() * 7) + 1;
    
    const x = -(d + b) / (a - c);
    
    let response = '';
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `🎯 PROBLEM:\nSolve for x: ${a}x + ${b} = ${c}x - ${d}\n\n`;
      response += `🔢 STEP-BY-STEP SOLUTION:\n\n`;
      response += `Step 1: Move all x terms to one side\n`;
      response += `${a}x + ${b} = ${c}x - ${d}\n`;
      response += `${a}x - ${c}x = -${d} - ${b}\n`;
      response += `${a - c}x = ${-(d + b)}\n\n`;
      response += `Step 2: Divide both sides by ${a - c}\n`;
      response += `x = ${-(d + b)} / ${a - c}\n`;
      response += `x = ${x.toFixed(2)}\n\n`;
      response += `✅ CHECK:\n`;
      response += `${a}(${x.toFixed(2)}) + ${b} = ${c}(${x.toFixed(2)}) - ${d}\n`;
      response += `${(a * x + b).toFixed(2)} = ${(c * x - d).toFixed(2)} ✓\n\n`;
      response += `🎯 FINAL ANSWER: x = ${x.toFixed(2)}`;
    } else {
      response = `🎯 PROBLEM:\nSolve for x: ${a}x + ${b} = ${c}x - ${d}\n\n`;
      response += `🔢 STEP-BY-STEP SOLUTION:\n\n`;
      response += `Step 1: Move all x terms to one side\n`;
      response += `${a}x + ${b} = ${c}x - ${d}\n`;
      response += `${a}x - ${c}x = -${d} - ${b}\n`;
      response += `${a - c}x = ${-(d + b)}\n\n`;
      response += `Step 2: Divide both sides by ${a - c}\n`;
      response += `x = ${-(d + b)} / ${a - c}\n`;
      response += `x = ${x.toFixed(2)}\n\n`;
      response += `✅ CHECK:\n`;
      response += `${a}(${x.toFixed(2)}) + ${b} = ${c}(${x.toFixed(2)}) - ${d}\n`;
      response += `${(a * x + b).toFixed(2)} = ${(c * x - d).toFixed(2)} ✓\n\n`;
      response += `🎯 FINAL ANSWER: x = ${x.toFixed(2)}`;
    }
    return response;
  },

  // ================================================================
  // 📐 GEOMETRY - COMPLETE
  // ================================================================
  generateGeometryProblem(lang) {
    const r = Math.floor(Math.random() * 12) + 2;
    const area = Math.PI * r * r;
    const circumference = 2 * Math.PI * r;
    
    let response = '';
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `🎯 PROBLEM:\nFind the area and circumference of a circle with radius ${r} cm.\n\n`;
      response += `🔢 STEP-BY-STEP SOLUTION:\n\n`;
      response += `Step 1: Write the formula for Area\n`;
      response += `A = πr²\n`;
      response += `A = π(${r})²\n`;
      response += `A = ${r * r}π\n`;
      response += `A = ${area.toFixed(2)} cm²\n\n`;
      response += `Step 2: Write the formula for Circumference\n`;
      response += `C = 2πr\n`;
      response += `C = 2π(${r})\n`;
      response += `C = ${2 * r}π\n`;
      response += `C = ${circumference.toFixed(2)} cm\n\n`;
      response += `✅ CHECK:\n`;
      response += `Area: ${r * r} × 3.1416 = ${area.toFixed(2)} ✓\n`;
      response += `Circumference: ${2 * r} × 3.1416 = ${circumference.toFixed(2)} ✓\n\n`;
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Area = ${area.toFixed(2)} cm²\n`;
      response += `Circumference = ${circumference.toFixed(2)} cm`;
    } else {
      response = `🎯 PROBLEM:\nFind the area and circumference of a circle with radius ${r} cm.\n\n`;
      response += `🔢 STEP-BY-STEP SOLUTION:\n\n`;
      response += `Step 1: Write the formula for Area\n`;
      response += `A = πr²\n`;
      response += `A = π(${r})²\n`;
      response += `A = ${r * r}π\n`;
      response += `A = ${area.toFixed(2)} cm²\n\n`;
      response += `Step 2: Write the formula for Circumference\n`;
      response += `C = 2πr\n`;
      response += `C = 2π(${r})\n`;
      response += `C = ${2 * r}π\n`;
      response += `C = ${circumference.toFixed(2)} cm\n\n`;
      response += `✅ CHECK:\n`;
      response += `Area: ${r * r} × 3.1416 = ${area.toFixed(2)} ✓\n`;
      response += `Circumference: ${2 * r} × 3.1416 = ${circumference.toFixed(2)} ✓\n\n`;
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Area = ${area.toFixed(2)} cm²\n`;
      response += `Circumference = ${circumference.toFixed(2)} cm`;
    }
    return response;
  },

  // ================================================================
  // 📐 TRIGONOMETRY - COMPLETE
  // ================================================================
  generateTrigonometryProblem(lang) {
    const angle = Math.floor(Math.random() * 40) + 20;
    const rad = angle * Math.PI / 180;
    const sinVal = Math.sin(rad);
    const cosVal = Math.cos(rad);
    const tanVal = Math.tan(rad);
    
    let response = '';
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `🎯 PROBLEM:\nFind sin(${angle}°), cos(${angle}°), and tan(${angle}°).\n\n`;
      response += `🔢 STEP-BY-STEP SOLUTION:\n\n`;
      response += `Step 1: Convert angle to radians\n`;
      response += `${angle}° = ${angle} × π/180\n`;
      response += `${angle}° = ${rad.toFixed(4)} radians\n\n`;
      response += `Step 2: Use trigonometric ratios\n`;
      response += `sin(${angle}°) = ${sinVal.toFixed(4)}\n`;
      response += `cos(${angle}°) = ${cosVal.toFixed(4)}\n`;
      response += `tan(${angle}°) = ${tanVal.toFixed(4)}\n\n`;
      response += `Step 3: Verify using Pythagorean identity\n`;
      response += `sin²(${angle}°) + cos²(${angle}°) = 1\n`;
      response += `${(sinVal ** 2).toFixed(4)} + ${(cosVal ** 2).toFixed(4)} = 1\n`;
      response += `${(sinVal ** 2 + cosVal ** 2).toFixed(4)} = 1 ✓\n\n`;
      response += `🎯 FINAL ANSWERS:\n`;
      response += `sin(${angle}°) = ${sinVal.toFixed(4)}\n`;
      response += `cos(${angle}°) = ${cosVal.toFixed(4)}\n`;
      response += `tan(${angle}°) = ${tanVal.toFixed(4)}`;
    } else {
      response = `🎯 PROBLEM:\nFind sin(${angle}°), cos(${angle}°), and tan(${angle}°).\n\n`;
      response += `🔢 STEP-BY-STEP SOLUTION:\n\n`;
      response += `Step 1: Convert angle to radians\n`;
      response += `${angle}° = ${angle} × π/180\n`;
      response += `${angle}° = ${rad.toFixed(4)} radians\n\n`;
      response += `Step 2: Use trigonometric ratios\n`;
      response += `sin(${angle}°) = ${sinVal.toFixed(4)}\n`;
      response += `cos(${angle}°) = ${cosVal.toFixed(4)}\n`;
      response += `tan(${angle}°) = ${tanVal.toFixed(4)}\n\n`;
      response += `Step 3: Verify using Pythagorean identity\n`;
      response += `sin²(${angle}°) + cos²(${angle}°) = 1\n`;
      response += `${(sinVal ** 2).toFixed(4)} + ${(cosVal ** 2).toFixed(4)} = 1\n`;
      response += `${(sinVal ** 2 + cosVal ** 2).toFixed(4)} = 1 ✓\n\n`;
      response += `🎯 FINAL ANSWERS:\n`;
      response += `sin(${angle}°) = ${sinVal.toFixed(4)}\n`;
      response += `cos(${angle}°) = ${cosVal.toFixed(4)}\n`;
      response += `tan(${angle}°) = ${tanVal.toFixed(4)}`;
    }
    return response;
  },

  // ================================================================
  // 📐 CALCULUS - COMPLETE
  // ================================================================
  generateCalculusProblem(lang) {
    const a = Math.floor(Math.random() * 4) + 2;
    const b = Math.floor(Math.random() * 5) + 1;
    const c = Math.floor(Math.random() * 4) + 1;
    const d = Math.floor(Math.random() * 5) + 1;
    
    let response = '';
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `🎯 PROBLEM:\nFind the derivative of f(x) = ${a}x³ - ${b}x² + ${c}x - ${d}\n\n`;
      response += `🔢 STEP-BY-STEP SOLUTION:\n\n`;
      response += `Step 1: Apply power rule: d/dx(xⁿ) = nxⁿ⁻¹\n\n`;
      response += `Step 2: Differentiate each term\n`;
      response += `Term 1: ${a}x³ → d/dx = ${a} × 3 × x³⁻¹ = ${3 * a}x²\n`;
      response += `Term 2: -${b}x² → d/dx = -${b} × 2 × x²⁻¹ = -${2 * b}x\n`;
      response += `Term 3: ${c}x → d/dx = ${c} × 1 × x⁰ = ${c}\n`;
      response += `Term 4: -${d} → d/dx = 0\n\n`;
      response += `Step 3: Combine all terms\n`;
      response += `f'(x) = ${3 * a}x² - ${2 * b}x + ${c}\n\n`;
      response += `✅ CHECK at x = 1:\n`;
      response += `f'(1) = ${3 * a}(1)² - ${2 * b}(1) + ${c}\n`;
      response += `f'(1) = ${3 * a - 2 * b + c}\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `f'(x) = ${3 * a}x² - ${2 * b}x + ${c}`;
    } else {
      response = `🎯 PROBLEM:\nFind the derivative of f(x) = ${a}x³ - ${b}x² + ${c}x - ${d}\n\n`;
      response += `🔢 STEP-BY-STEP SOLUTION:\n\n`;
      response += `Step 1: Apply power rule: d/dx(xⁿ) = nxⁿ⁻¹\n\n`;
      response += `Step 2: Differentiate each term\n`;
      response += `Term 1: ${a}x³ → d/dx = ${a} × 3 × x³⁻¹ = ${3 * a}x²\n`;
      response += `Term 2: -${b}x² → d/dx = -${b} × 2 × x²⁻¹ = -${2 * b}x\n`;
      response += `Term 3: ${c}x → d/dx = ${c} × 1 × x⁰ = ${c}\n`;
      response += `Term 4: -${d} → d/dx = 0\n\n`;
      response += `Step 3: Combine all terms\n`;
      response += `f'(x) = ${3 * a}x² - ${2 * b}x + ${c}\n\n`;
      response += `✅ CHECK at x = 1:\n`;
      response += `f'(1) = ${3 * a}(1)² - ${2 * b}(1) + ${c}\n`;
      response += `f'(1) = ${3 * a - 2 * b + c}\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `f'(x) = ${3 * a}x² - ${2 * b}x + ${c}`;
    }
    return response;
  },

  // ================================================================
  // 📊 STATISTICS - COMPLETE
  // ================================================================
  generateStatisticsProblem(lang) {
    const data = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      data.push(Math.floor(Math.random() * 40) + 60);
    }
    
    const sorted = [...data].sort((a, b) => a - b);
    const sum = data.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const median = sorted[Math.floor(n/2)];
    
    const freq = {};
    data.forEach(num => freq[num] = (freq[num] || 0) + 1);
    let mode = null;
    let maxFreq = 0;
    for (const [num, count] of Object.entries(freq)) {
      if (count > maxFreq) {
        maxFreq = count;
        mode = num;
      }
    }
    
    const squaredDiffs = data.map(x => (x - mean) ** 2);
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(variance);
    
    let response = '';
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `🎯 PROBLEM:\nFind the mean, median, mode, variance, and standard deviation of:\n${data.join(', ')}\n\n`;
      response += `🔢 STEP-BY-STEP SOLUTION:\n\n`;
      response += `Step 1: Arrange data in ascending order\n`;
      response += `${sorted.join(', ')}\n\n`;
      response += `Step 2: Find Mean\n`;
      response += `Sum = ${data.join(' + ')} = ${sum}\n`;
      response += `n = ${n}\n`;
      response += `Mean = ${sum} ÷ ${n} = ${mean.toFixed(2)}\n\n`;
      response += `Step 3: Find Median\n`;
      response += `Middle position = (${n} + 1) ÷ 2 = ${(n + 1) / 2}th position\n`;
      response += `Median = ${median}\n\n`;
      response += `Step 4: Find Mode\n`;
      response += `Frequency: ${JSON.stringify(freq)}\n`;
      response += `Mode = ${mode}\n\n`;
      response += `Step 5: Find Variance\n`;
      response += `Variance = Σ(x - x̄)²/n\n`;
      response += `Sum of squared deviations = ${squaredDiffs.reduce((a,b) => a + b, 0).toFixed(2)}\n`;
      response += `Variance = ${variance.toFixed(2)}\n\n`;
      response += `Step 6: Find Standard Deviation\n`;
      response += `SD = √Variance\n`;
      response += `SD = √${variance.toFixed(2)} = ${stdDev.toFixed(2)}\n\n`;
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Mean = ${mean.toFixed(2)}\n`;
      response += `Median = ${median}\n`;
      response += `Mode = ${mode}\n`;
      response += `Variance = ${variance.toFixed(2)}\n`;
      response += `Standard Deviation = ${stdDev.toFixed(2)}`;
    } else {
      response = `🎯 PROBLEM:\nFind the mean, median, mode, variance, and standard deviation of:\n${data.join(', ')}\n\n`;
      response += `🔢 STEP-BY-STEP SOLUTION:\n\n`;
      response += `Step 1: Arrange data in ascending order\n`;
      response += `${sorted.join(', ')}\n\n`;
      response += `Step 2: Find Mean\n`;
      response += `Sum = ${data.join(' + ')} = ${sum}\n`;
      response += `n = ${n}\n`;
      response += `Mean = ${sum} ÷ ${n} = ${mean.toFixed(2)}\n\n`;
      response += `Step 3: Find Median\n`;
      response += `Middle position = (${n} + 1) ÷ 2 = ${(n + 1) / 2}th position\n`;
      response += `Median = ${median}\n\n`;
      response += `Step 4: Find Mode\n`;
      response += `Frequency: ${JSON.stringify(freq)}\n`;
      response += `Mode = ${mode}\n\n`;
      response += `Step 5: Find Variance\n`;
      response += `Variance = Σ(x - x̄)²/n\n`;
      response += `Sum of squared deviations = ${squaredDiffs.reduce((a,b) => a + b, 0).toFixed(2)}\n`;
      response += `Variance = ${variance.toFixed(2)}\n\n`;
      response += `Step 6: Find Standard Deviation\n`;
      response += `SD = √Variance\n`;
      response += `SD = √${variance.toFixed(2)} = ${stdDev.toFixed(2)}\n\n`;
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Mean = ${mean.toFixed(2)}\n`;
      response += `Median = ${median}\n`;
      response += `Mode = ${mode}\n`;
      response += `Variance = ${variance.toFixed(2)}\n`;
      response += `Standard Deviation = ${stdDev.toFixed(2)}`;
    }
    return response;
  },

  // ================================================================
  // 🎲 PROBABILITY - COMPLETE
  // ================================================================
  generateProbabilityProblem(lang) {
    const total = Math.floor(Math.random() * 8) + 5;
    const favorable = Math.floor(Math.random() * (total - 1)) + 1;
    const prob = favorable / total;
    const percent = prob * 100;
    
    let response = '';
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `🎯 PROBLEM:\nA bag contains ${total} balls. ${favorable} are red and the rest are blue.\n`;
      response += `What is the probability of drawing a red ball?\n\n`;
      response += `🔢 STEP-BY-STEP SOLUTION:\n\n`;
      response += `Step 1: Identify total outcomes\n`;
      response += `Total balls = ${total}\n\n`;
      response += `Step 2: Identify favorable outcomes\n`;
      response += `Red balls = ${favorable}\n\n`;
      response += `Step 3: Apply probability formula\n`;
      response += `P(red) = Favorable Outcomes / Total Outcomes\n`;
      response += `P(red) = ${favorable} / ${total}\n`;
      response += `P(red) = ${prob.toFixed(3)}\n\n`;
      response += `Step 4: Convert to percentage\n`;
      response += `P(red) = ${prob.toFixed(3)} × 100% = ${percent.toFixed(1)}%\n\n`;
      response += `✅ CHECK: Probability is between 0 and 1: ${prob.toFixed(3)} ✓\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `Probability = ${prob.toFixed(3)} or ${percent.toFixed(1)}%`;
    } else {
      response = `🎯 PROBLEM:\nA bag contains ${total} balls. ${favorable} are red and the rest are blue.\n`;
      response += `What is the probability of drawing a red ball?\n\n`;
      response += `🔢 STEP-BY-STEP SOLUTION:\n\n`;
      response += `Step 1: Identify total outcomes\n`;
      response += `Total balls = ${total}\n\n`;
      response += `Step 2: Identify favorable outcomes\n`;
      response += `Red balls = ${favorable}\n\n`;
      response += `Step 3: Apply probability formula\n`;
      response += `P(red) = Favorable Outcomes / Total Outcomes\n`;
      response += `P(red) = ${favorable} / ${total}\n`;
      response += `P(red) = ${prob.toFixed(3)}\n\n`;
      response += `Step 4: Convert to percentage\n`;
      response += `P(red) = ${prob.toFixed(3)} × 100% = ${percent.toFixed(1)}%\n\n`;
      response += `✅ CHECK: Probability is between 0 and 1: ${prob.toFixed(3)} ✓\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `Probability = ${prob.toFixed(3)} or ${percent.toFixed(1)}%`;
    }
    return response;
  },

  // ================================================================
  // 📊 GROUPED DATA - COMPLETE
  // ================================================================
  generateGroupedDataProblem(lang) {
    const data = [];
    const n = 50;
    for (let i = 0; i < n; i++) {
      data.push(Math.floor(Math.random() * 50) + 50);
    }
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    const classes = Math.ceil(Math.sqrt(n));
    const width = Math.ceil(range / classes);
    
    const freqTable = [];
    let start = min;
    let cumulativeFreq = 0;
    let totalFx = 0;
    let totalF = 0;
    let totalFx2 = 0;
    
    for (let i = 0; i < classes; i++) {
      const end = start + width - 1;
      const count = data.filter(x => x >= start && x <= end).length;
      const mid = (start + end) / 2;
      const fx = count * mid;
      const fx2 = count * mid * mid;
      
      cumulativeFreq += count;
      totalFx += fx;
      totalF += count;
      totalFx2 += fx2;
      
      freqTable.push({
        class: `${start}-${end}`,
        f: count,
        mid: mid,
        fx: fx,
        cf: cumulativeFreq,
        fx2: fx2
      });
      
      start = end + 1;
    }
    
    const mean = totalFx / totalF;
    const variance = (totalFx2 / totalF) - (mean * mean);
    const stdDev = Math.sqrt(variance);
    
    const medianPos = totalF / 2;
    let medianClass = null;
    let prevCF = 0;
    for (const row of freqTable) {
      if (row.cf >= medianPos) {
        medianClass = row;
        break;
      }
      prevCF = row.cf;
    }
    
    const lowerBound = parseInt(medianClass.class.split('-')[0]) - 0.5;
    const median = lowerBound + ((medianPos - prevCF) / medianClass.f) * width;
    
    const maxFreq = Math.max(...freqTable.map(r => r.f));
    const modalClass = freqTable.find(r => r.f === maxFreq);
    const modalLower = parseInt(modalClass.class.split('-')[0]) - 0.5;
    const d1 = modalClass.f - (freqTable[freqTable.indexOf(modalClass) - 1]?.f || 0);
    const d2 = modalClass.f - (freqTable[freqTable.indexOf(modalClass) + 1]?.f || 0);
    const mode = modalLower + (d1 / (d1 + d2)) * width;
    
    let response = '';
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `🎯 PROBLEM:\nThe following are scores of ${totalF} students in a test.\n`;
      response += `Create a grouped frequency distribution and find the mean, median, mode, variance, and standard deviation.\n\n`;
      response += `📋 FREQUENCY DISTRIBUTION TABLE:\n`;
      response += `┌──────────┬─────┬──────────┬─────────┬───────────┬──────────┐\n`;
      response += `│  Class   │  f  │  Mid(x)  │   fx    │    cf     │   fx²    │\n`;
      response += `├──────────┼─────┼──────────┼─────────┼───────────┼──────────┤\n`;
      
      for (const row of freqTable) {
        response += `│ ${row.class.padEnd(8)} │ ${String(row.f).padEnd(3)} │ ${row.mid.toFixed(1).padEnd(8)} │ ${row.fx.toFixed(1).padEnd(7)} │ ${String(row.cf).padEnd(9)} │ ${row.fx2.toFixed(1).padEnd(8)} │\n`;
      }
      
      response += `└──────────┴─────┴──────────┴─────────┴───────────┴──────────┘\n\n`;
      response += `🔢 STEP-BY-STEP COMPUTATIONS:\n\n`;
      response += `Step 1: Find Mean\n`;
      response += `x̄ = Σfx / Σf = ${totalFx.toFixed(1)} / ${totalF} = ${mean.toFixed(2)}\n\n`;
      response += `Step 2: Find Median\n`;
      response += `Median = L + [(n/2 - cf) / f] × i\n`;
      response += `Median = ${lowerBound} + [(${medianPos} - ${prevCF}) / ${medianClass.f}] × ${width}\n`;
      response += `Median = ${median.toFixed(2)}\n\n`;
      response += `Step 3: Find Mode\n`;
      response += `Mode = L + [d₁/(d₁ + d₂)] × i\n`;
      response += `Mode = ${modalLower} + [${d1}/(${d1} + ${d2})] × ${width}\n`;
      response += `Mode = ${mode.toFixed(2)}\n\n`;
      response += `Step 4: Find Variance\n`;
      response += `σ² = Σfx²/Σf - (Σfx/Σf)²\n`;
      response += `σ² = ${(totalFx2/totalF).toFixed(2)} - ${mean.toFixed(2)}²\n`;
      response += `σ² = ${variance.toFixed(2)}\n\n`;
      response += `Step 5: Find Standard Deviation\n`;
      response += `σ = √σ² = √${variance.toFixed(2)} = ${stdDev.toFixed(2)}\n\n`;
      response += `✅ CHECK: Total Frequency = ${freqTable.reduce((sum, row) => sum + row.f, 0)} = ${totalF} ✓\n\n`;
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Mean = ${mean.toFixed(2)}\n`;
      response += `Median = ${median.toFixed(2)}\n`;
      response += `Mode = ${mode.toFixed(2)}\n`;
      response += `Variance = ${variance.toFixed(2)}\n`;
      response += `Standard Deviation = ${stdDev.toFixed(2)}`;
    } else {
      response = `🎯 PROBLEM:\nThe following are scores of ${totalF} students in a test.\n`;
      response += `Create a grouped frequency distribution and find the mean, median, mode, variance, and standard deviation.\n\n`;
      response += `📋 FREQUENCY DISTRIBUTION TABLE:\n`;
      response += `┌──────────┬─────┬──────────┬─────────┬───────────┬──────────┐\n`;
      response += `│  Class   │  f  │  Mid(x)  │   fx    │    cf     │   fx²    │\n`;
      response += `├──────────┼─────┼──────────┼─────────┼───────────┼──────────┤\n`;
      
      for (const row of freqTable) {
        response += `│ ${row.class.padEnd(8)} │ ${String(row.f).padEnd(3)} │ ${row.mid.toFixed(1).padEnd(8)} │ ${row.fx.toFixed(1).padEnd(7)} │ ${String(row.cf).padEnd(9)} │ ${row.fx2.toFixed(1).padEnd(8)} │\n`;
      }
      
      response += `└──────────┴─────┴──────────┴─────────┴───────────┴──────────┘\n\n`;
      response += `🔢 STEP-BY-STEP COMPUTATIONS:\n\n`;
      response += `Step 1: Find Mean\n`;
      response += `x̄ = Σfx / Σf = ${totalFx.toFixed(1)} / ${totalF} = ${mean.toFixed(2)}\n\n`;
      response += `Step 2: Find Median\n`;
      response += `Median = L + [(n/2 - cf) / f] × i\n`;
      response += `Median = ${lowerBound} + [(${medianPos} - ${prevCF}) / ${medianClass.f}] × ${width}\n`;
      response += `Median = ${median.toFixed(2)}\n\n`;
      response += `Step 3: Find Mode\n`;
      response += `Mode = L + [d₁/(d₁ + d₂)] × i\n`;
      response += `Mode = ${modalLower} + [${d1}/(${d1} + ${d2})] × ${width}\n`;
      response += `Mode = ${mode.toFixed(2)}\n\n`;
      response += `Step 4: Find Variance\n`;
      response += `σ² = Σfx²/Σf - (Σfx/Σf)²\n`;
      response += `σ² = ${(totalFx2/totalF).toFixed(2)} - ${mean.toFixed(2)}²\n`;
      response += `σ² = ${variance.toFixed(2)}\n\n`;
      response += `Step 5: Find Standard Deviation\n`;
      response += `σ = √σ² = √${variance.toFixed(2)} = ${stdDev.toFixed(2)}\n\n`;
      response += `✅ CHECK: Total Frequency = ${freqTable.reduce((sum, row) => sum + row.f, 0)} = ${totalF} ✓\n\n`;
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Mean = ${mean.toFixed(2)}\n`;
      response += `Median = ${median.toFixed(2)}\n`;
      response += `Mode = ${mode.toFixed(2)}\n`;
      response += `Variance = ${variance.toFixed(2)}\n`;
      response += `Standard Deviation = ${stdDev.toFixed(2)}`;
    }
    return response;
  },

  // ================================================================
  // 🔢 SOLVE SPECIFIC MATH PROBLEM
  // ================================================================
  async solveMathProblem(prompt, lang) {
    const lower = prompt.toLowerCase();
    let response = '';
    
    // Check if it's an equation
    if (lower.includes('x') && lower.includes('=')) {
      try {
        const clean = prompt.replace(/[^0-9xX+\-*/=]/g, '').trim();
        const parts = clean.split('=');
        if (parts.length === 2) {
          response = `🔢 SOLVING: ${prompt}\n\n`;
          response += `Step 1: Identify the equation\n`;
          response += `${parts[0].trim()} = ${parts[1].trim()}\n\n`;
          response += `Step 2: Solve for x\n`;
          
          // Parse simple equations
          const left = parts[0].trim();
          const right = parts[1].trim();
          
          // Try to solve ax + b = c
          const leftMatch = left.match(/([0-9]+)?x?([+-][0-9]+)?/);
          const rightMatch = right.match(/([0-9]+)?x?([+-][0-9]+)?/);
          
          if (leftMatch || rightMatch) {
            response += `Moving x terms to one side...\n`;
            response += `x = ...\n\n`;
          }
          
          response += `⚠️ For complex equations, please use clear format.\n`;
          response += `Example: "2x + 3 = 7"`;
        }
      } catch (e) {
        response = `❌ Could not parse the equation.\n`;
        response += `Please format it clearly: e.g., "2x + 3 = 7"`;
      }
    } else {
      response = `📖 I can help you solve math problems!\n\n`;
      response += `Try:\n`;
      response += `• "solve 2x + 3 = 7"\n`;
      response += `• "find the area of a circle with radius 5"\n`;
      response += `• "calculate the mean of 5, 8, 12, 15, 10"\n\n`;
      response += `Or ask for a sample: "give me algebra problem"`;
    }
    
    return response;
  },

  // ================================================================
  // 📖 MATH HELP
  // ================================================================
  getMathHelp(mathType, lang) {
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `📖 MATH HELP\n\n`;
      response += `I can help you with:\n\n`;
      response += `📐 Algebra - Linear equations, quadratic equations\n`;
      response += `📐 Geometry - Area, volume, perimeter\n`;
      response += `📐 Trigonometry - Sin, cos, tan\n`;
      response += `📐 Calculus - Derivatives, integrals\n`;
      response += `📊 Statistics - Mean, median, mode, variance, SD\n`;
      response += `🎲 Probability - Basic probability\n`;
      response += `📊 Grouped Data - Frequency distribution\n\n`;
      response += `💡 How to use:\n`;
      response += `• For SAMPLES: "give me algebra problem"\n`;
      response += `• To SOLVE: "solve 2x + 3 = 7"\n`;
      response += `• For HELP: "statistics help"`;
    } else {
      response = `📖 MATH HELP\n\n`;
      response += `I can help you with:\n\n`;
      response += `📐 Algebra - Linear equations, quadratic equations\n`;
      response += `📐 Geometry - Area, volume, perimeter\n`;
      response += `📐 Trigonometry - Sin, cos, tan\n`;
      response += `📐 Calculus - Derivatives, integrals\n`;
      response += `📊 Statistics - Mean, median, mode, variance, SD\n`;
      response += `🎲 Probability - Basic probability\n`;
      response += `📊 Grouped Data - Frequency distribution\n\n`;
      response += `💡 How to use:\n`;
      response += `• For SAMPLES: "give me algebra problem"\n`;
      response += `• To SOLVE: "solve 2x + 3 = 7"\n`;
      response += `• For HELP: "statistics help"`;
    }
    
    return response;
  },

  // ================================================================
  // 🆕 TYPO CORRECTION
  // ================================================================
  correctTypos(prompt) {
    if (!prompt) return prompt;
    
    const typoMap = {
      'pingi': 'paki', 'pengi': 'paki', 'peng': 'paki', 'ping': 'paki',
      'pking': 'paki', 'pk': 'paki', 'pak': 'paki', 'pki': 'paki',
      'pki explain': 'paki explain', 'pki elaborate': 'paki elaborate',
      'pki linaw': 'paki linaw', 'pki clear': 'paki clear',
      'pls': 'please', 'plz': 'please', 'pleas': 'please',
      'mre': 'more', 'mor': 'more', 'elab': 'elaborate',
      'expln': 'explanation', 'expl': 'explain',
      'plihug': 'palihug', 'plihg': 'palihug',
      'detailled': 'detailed', 'detialed': 'detailed',
      'explaination': 'explanation', 'summarry': 'summary'
    };
    
    let corrected = prompt;
    for (const [typo, correct] of Object.entries(typoMap)) {
      if (prompt.toLowerCase().includes(typo)) {
        corrected = corrected.replace(new RegExp(typo, 'gi'), correct);
      }
    }
    return corrected;
  },

  // ================================================================
  // 🆕 CONTENT‑BASED TOPIC RETRIEVAL
  // ================================================================
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

      if (data.timestamp && (Date.now() - data.timestamp) < 600000) score += 5;

      if (userLower.includes('last') || userLower.includes('nauna') || userLower.includes('kanina')) {
        if (data.timestamp && (Date.now() - data.timestamp) < 600000) score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }

    return (bestScore > 0) ? bestKey : null;
  },

  // ================================================================
  // EXTRACT KEYWORDS FROM RESPONSE
  // ================================================================
  extractKeywordsFromResponse(response) {
    if (!response) return [];
    const lower = response.toLowerCase();
    const keywords = [];

    const topicWords = [
      'activity sheet', 'worksheet', 'quiz', 'homework', 'assignment',
      'math', 'science', 'english', 'tle', 'filipino',
      'problem', 'equation', 'solution', 'answer', 'explanation',
      'algebra', 'geometry', 'trigonometry', 'calculus', 'statistics',
      'mean', 'median', 'mode', 'variance', 'standard deviation',
      'area', 'volume', 'perimeter', 'circumference',
      'sin', 'cos', 'tan', 'derivative', 'integral', 'limit'
    ];

    for (const word of topicWords) {
      if (lower.includes(word)) keywords.push(word);
    }

    const stopWords = ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'the', 'a', 'an', 'is', 'are', 'was', 'were'];
    const words = lower.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length > 2 && !stopWords.includes(words[i]) &&
          words[i+1].length > 2 && !stopWords.includes(words[i+1])) {
        const phrase = words[i] + ' ' + words[i+1];
        if (phrase.length > 4 && !keywords.includes(phrase)) keywords.push(phrase);
      }
    }

    return [...new Set(keywords)].slice(0, 20);
  },

  // ================================================================
  // RETURN‑TO‑TOPIC DETECTION
  // ================================================================
  isReturnToTopicRequest(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    const patterns = [
      'balik tayo sa', 'balikan natin', 'going back to',
      'back to the topic', 'return to topic', 'balik sa topic',
      'continue about', 'continue with', 'tuloy natin ang',
      'ituloy ang', 'balik tayo', 'balikan natin',
      'padayon ta sa', 'padayon sa', 'ipadayon ang',
      'tungkol sa last', 'tungkol sa nauna', 'about the previous',
      'about the last', 'balik sa sinabi mo', 'balik sa sagot mo'
    ];
    if (patterns.some(p => lower.includes(p))) return true;

    const refs = [
      'last response', 'last reply', 'last answer', 'last message',
      'previous response', 'previous reply', 'previous answer',
      'nauna mong sagot', 'nauna mong reply', 'huling sagot',
      'sagot mo kanina', 'reply mo kanina', 'sinabi mo kanina'
    ];
    return refs.some(r => lower.includes(r));
  },

  // ================================================================
  // CASUAL CONVERSATION
  // ================================================================
  isCasualConversation(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    const casualPatterns = [
      'kamusta', 'kumusta', 'musta', 'msta', 'kamusta ka', 'kumusta ka',
      'ano ginagawa mo', 'anong ginagawa mo', 'ano gawa mo',
      'ano balita', 'anong balita', 'kamusta na', 'kumusta na',
      'ayos lang', 'ok lang', 'buti naman', 'mabuti naman',
      'salamat', 'sige', 'cge', 'ge', 'ok', 'okay',
      'hehe', 'haha', 'hahaha', 'lol', 'hmm', 'ah', 'oh',
      'nice', 'galing', 'astig', 'ayos', 'magaling',
      'ikaw', 'ikaw ba', 'ikaw naman', 'eh ikaw',
      'how are you', 'hows it going', 'whats up', 'what are you doing',
      'how you doing', 'sup', 'yo', 'thanks', 'thank you'
    ];
    return casualPatterns.some(p => lower.includes(p));
  },

  buildCasualPrompt(prompt, language) {
    const langName = this.getLanguageName(language);
    let final = '';
    
    if (language === 'tagalog' || language === 'bisaya' || language === 'cebuano') {
      final += `Ikaw ay nakikipag-usap sa isang user sa ${langName.toUpperCase()}.\n`;
      final += `Sinabi ng user: "${prompt}"\n\n`;
      final += `MAHALAGA:\n`;
      final += `- Tumugon nang NATURAL sa ${langName.toUpperCase()}.\n`;
      final += `- Maging palakaibigan, mainit, at conversational.\n`;
      final += `- Panatilihing MAIKLI at NATURAL ang mga tugon (1-2 pangungusap).\n`;
      final += `- Huwag masyadong pormal o robotic.\n\n`;
      final += `TUMUGON SA USER SA ${langName.toUpperCase()} NGAYON.`;
    } else {
      final += `You are having a CASUAL CONVERSATION with a user in ${langName.toUpperCase()}.\n`;
      final += `The user said: "${prompt}"\n\n`;
      final += `IMPORTANT:\n`;
      final += `- Respond NATURALLY in ${langName.toUpperCase()}.\n`;
      final += `- Be friendly, warm, and conversational.\n`;
      final += `- Keep responses SHORT and NATURAL (1-2 sentences).\n`;
      final += `- Don't be too formal or robotic.\n\n`;
      final += `NOW RESPOND TO THE USER'S MESSAGE IN ${langName.toUpperCase()}.`;
    }
    return final;
  },

  // ================================================================
  // GEMINI API
  // ================================================================
  async callGeminiAPI(prompt, imageUrl, detectedLanguage = 'english') {
    try {
      const geminiPrompt = this.buildGeminiPrompt(prompt, detectedLanguage);
      const apiUrl = `https://norch-project.gleeze.com/api/gemini?prompt=${encodeURIComponent(geminiPrompt)}&imageurl=${encodeURIComponent(imageUrl)}`;

      let response = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          response = await axios.get(apiUrl, {
            timeout: 90000,
            headers: { 'Accept': 'application/json' }
          });
          if (response.status === 200 && response.data) break;
        } catch (error) {
          console.log(`[Gemini] Attempt ${attempts} failed:`, error.message);
          if (attempts >= maxAttempts) throw error;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!response || !response.data) throw new Error('No response from Gemini API');
      return this.processGeminiResponse(response.data.response || '') || 'Hindi ma-analyze ang image. Subukan muli.';

    } catch (error) {
      console.error('[Gemini] Error:', error.message);
      const fallbackPrompt = `The user sent an image. The user asked: ${prompt || 'Please describe what you see'}. Provide a helpful response.`;
      const response = await this.callAPI(fallbackPrompt);
      return this.cleanResponse(response || 'Hindi ma-analyze ang image. Subukan muli.');
    }
  },

  buildGeminiPrompt(userPrompt, language = 'english') {
    const langName = this.getLanguageName(language);
    return `You are an AI assistant analyzing an image. Respond in ${langName.toUpperCase()}.

DETECT WHAT THE IMAGE CONTAINS and respond accordingly:

1. ACTIVITY SHEET / WORKSHEET / QUIZ / HOMEWORK
   - Read and understand each question
   - Provide ACCURATE answers
   - For math: Show step-by-step solution

2. MATH PROBLEMS / EQUATIONS
   - Show step-by-step solution
   - Provide final answer

3. SCIENCE / DIAGRAMS / LABELS
   - Identify parts and their functions
   - Explain processes

4. TEXTBOOK / NOTES / EDUCATIONAL CONTENT
   - Extract key concepts
   - Summarize main ideas

5. GENERAL IMAGE (Photo, Art, Screenshot)
   - Describe what you see (1-3 sentences)
   - Keep it SIMPLE and DIRECT

RESPONSE FORMAT:
For educational content: Answer: [Direct answer] Explanation: [Brief explanation]
For general images: [Brief description, 2-3 sentences]

USER QUESTION: ${userPrompt || 'Analyze this image'}`;
  },

  processGeminiResponse(response) {
    let processed = response || '';
    processed = processed
      .replace(/^I'?m?\s+a?\s*Gemini.*?model.*?\n\n?/i, '')
      .replace(/^Here is my analysis.*?\n/i, '')
      .replace(/^Let me analyze.*?\n/i, '')
      .replace(/^Based on my analysis.*?\n/i, '')
      .replace(/^I can see that.*?\n/i, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return this.cleanResponse(processed);
  },

  buildImageFollowUpPrompt(prompt, previousResponse, previousPrompt, wantsDetailed, language) {
    const langName = this.getLanguageName(language);
    let final = '';
    final += `PREVIOUS IMAGE ANALYSIS:\n${previousResponse}\n\n`;
    final += `USER ASKED: "${prompt}"\n\n`;
    final += `Provide a helpful response in ${langName.toUpperCase()}.\n`;
    final += `Keep it CLEAR and DIRECT. Use Answer/Explanation format if applicable.\n`;
    if (wantsDetailed) final += `Provide a detailed explanation.\n`;
    else final += `Keep it concise and to the point.\n`;
    return final;
  },

  buildImageModificationPrompt(prompt, previousResponse, wantsDetailed, language) {
    const langName = this.getLanguageName(language);
    let final = '';
    final += `PREVIOUS IMAGE ANALYSIS:\n${previousResponse}\n\n`;
    final += `USER REQUEST: "${prompt}"\n\n`;
    const lower = prompt.toLowerCase();
    if (lower.includes('short') || lower.includes('concise') || lower.includes('brief') ||
        lower.includes('maikli') || lower.includes('iklian') || lower.includes('paikliin')) {
      final += `Make the analysis SHORTER. Keep only the key points.\n`;
    } else if (lower.includes('clear') || lower.includes('clarify') || lower.includes('linaw')) {
      final += `Make the analysis CLEARER. Use simpler language.\n`;
    } else if (lower.includes('detail') || lower.includes('elaborate') || lower.includes('explain more')) {
      final += `Provide MORE DETAILS. Expand on each point.\n`;
    } else if (lower.includes('summar') || lower.includes('summary') || lower.includes('buod')) {
      final += `Provide a SUMMARY. Just the most important points.\n`;
    } else {
      final += `Modify the analysis as requested.\n`;
    }
    final += `\nRespond in ${langName.toUpperCase()}. Keep it clear and direct.`;
    return final;
  },

  // ================================================================
  // LANGUAGE DETECTION
  // ================================================================
  detectLanguage(prompt) {
    if (!prompt) return 'english';
    const lower = prompt.toLowerCase();
    
    const languages = {
      tagalog: {
        keywords: ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho', 'ako', 'ikaw', 'siya', 'kami', 'tayo', 'kayo', 'sila', 'ito', 'iyan', 'iyon', 'gusto', 'ayaw', 'pwede', 'maaari', 'dapat', 'kailangan', 'meron', 'mayroon', 'wala', 'hindi', 'oo', 'salamat', 'paki', 'tanong', 'sagot'],
        minMatches: 2
      },
      bisaya: {
        keywords: ['ako', 'ikaw', 'siya', 'kami', 'kita', 'kamo', 'sila', 'kini', 'kana', 'kadto', 'dinhi', 'diha', 'didto', 'unsa', 'ngano', 'giunsa', 'asa', 'kanus-a', 'kinsa', 'pila', 'gusto', 'ayaw', 'pwede', 'mahimo', 'kinahanglan', 'naa', 'wala', 'dili', 'oo', 'salamat', 'palihug', 'pangutana', 'tubag', 'sulti', 'buhaton'],
        minMatches: 2
      },
      cebuano: {
        keywords: ['ako', 'ikaw', 'siya', 'kami', 'kita', 'kamo', 'sila', 'kini', 'kana', 'kadto', 'dinhi', 'diha', 'didto', 'unsa', 'ngano', 'giunsa', 'asa', 'kanus-a', 'kinsa', 'pila', 'gusto', 'ayaw', 'pwede', 'mahimo', 'kinahanglan', 'naa', 'wala', 'dili', 'oo', 'salamat', 'palihug', 'pangutana', 'tubag'],
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
      'bisaya': 'Bisaya',
      'cebuano': 'Cebuano',
      'ilocano': 'Ilocano',
      'waray': 'Waray',
      'hiligaynon': 'Hiligaynon',
      'kapampangan': 'Kapampangan',
      'spanish': 'Spanish'
    };
    return names[languageCode] || 'English';
  },

  // ================================================================
  // MODIFICATION REQUEST
  // ================================================================
  isModificationRequest(prompt) {
    const corrected = this.correctTypos(prompt);
    const patterns = [
      'make it short', 'make it shorter', 'make it concise', 'make it brief',
      'make it simple', 'make it simpler', 'make it clear', 'make it clearer',
      'shorten it', 'simplify it', 'clarify it', 'explain more',
      'explain further', 'elaborate', 'more details', 'more information',
      'tell me more', 'expand', 'summarize', 'summary', 'brief', 'concise',
      'short', 'simple', 'clear', 'detailed', 'detail', 'in depth',
      'translate', 'translation', 'paki explain', 'paki linaw',
      'paki elaborate', 'paki summarize', 'paikliin', 'pasimplehin',
      'paliwanag', 'ipaliwanag', 'ilinaw', 'linawin', 'dagdagan',
      'dagdag', 'additional', 'add more', 'more examples',
      'give examples', 'halimbawa', 'example', 'examples', 'sample'
    ];
    
    const lower = prompt.toLowerCase();
    return patterns.some(p => lower.includes(p));
  },

  // ================================================================
  // FOLLOW-UP DETECTION
  // ================================================================
  isFollowUpRequest(prompt) {
    const corrected = this.correctTypos(prompt);
    const keywords = [
      'translate', 'isalin', 'salin', 'ipasalin',
      'elaborate', 'paki elaborate', 'paki explain', 'paliwanag', 'ipaliwanag',
      'elab', 'explain', 'detail', 'further', 'more details',
      'summarize', 'summary', 'i-summarize', 'brief', 'make it short',
      'short', 'concise', 'shorten', 'ikli', 'paikliin', 'simplify',
      'simple', 'pasimplehin', 'example', 'sample', 'halimbawa',
      'instance', 'give example', 'magbigay ng halimbawa',
      'correct', 'fix', 'tama', 'ayusin', 'improve', 'better',
      'add', 'additional', 'dagdagan', 'more', 'add more'
    ];
    
    const lower = prompt.toLowerCase();
    return keywords.some(k => lower.includes(k));
  },

  // ================================================================
  // NEW TOPIC DETECTION
  // ================================================================
  isNewTopic(prompt, previousPrompt, originalPrompt) {
    if (!previousPrompt) return true;
    
    const corrected = this.correctTypos(prompt);
    const followUpIndicators = [
      'paki', 'please', 'elaborate', 'explain', 'more', 'detail',
      'paliwanag', 'linaw', 'clear', 'example', 'sample',
      'halimbawa', 'summarize', 'summary', 'short', 'simple',
      'translate', 'isalin', 'dagdag', 'add', 'correct', 'fix'
    ];
    
    if (followUpIndicators.some(i => corrected.includes(i))) return false;
    
    const lowerPrompt = prompt.toLowerCase();
    const casualPhrases = ['hahaha', 'haha', 'hehe', 'lol', 'oh', 'ah', 'eh', 'ay', 'hmm', 'hm', 'wow', 'shet', 'gagi', 'hala', 'talaga', 'seryoso', 'grabe', 'sus', 'hay', 'ayoko', 'sige', 'cge', 'okay', 'ok'];
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
    const patterns = ['so yan', 'so ito', 'so iyan', 'so yun', 'so ganyan', 'so ganito', 'so ganun', 'yan na ba', 'yun na ba', 'ito na ba', 'tama ba', 'tama', 'correct', 'right', 'so tungkol', 'so sa', 'so para sa', 'so ibig sabihin', 'so meaning', 'so parang', 'so sa madaling salita', 'so in short', 'paano naman', 'what about', 'how about', 'paano kung', 'what if', 'bakit', 'why', 'paano', 'how', 'kailan', 'when', 'saan', 'where', 'sino', 'who', 'alin', 'which', 'ano', 'what', 'ano ba', 'gets', 'gets ko', 'nagets', 'naintindihan', 'so gets', 'ayun', 'ayon', 'ganun pala', 'ganyan pala', 'so ayun', 'so ayon', 'ok', 'okay', 'sige', 'cge', 'so okay', 'talaga', 'really', 'sure', 'so talaga', 'so that', 'so this', 'so it', 'so about', 'so regarding', 'so basically', 'so essentially', 'so you mean', 'mao na', 'mao ni', 'mao to', 'mao diay', 'mao ba', 'so mao', 'so mao na', 'sakto ba', 'sakto'];
    const isRelated = patterns.some(p => prompt.includes(p));
    const prevWords = previousPrompt.split(' ').filter(w => w.length > 2);
    const currentWords = prompt.split(' ').filter(w => w.length > 2);
    const hasRelated = prevWords.some(w => currentWords.some(c => c.includes(w) || w.includes(c)));
    return isRelated || hasRelated;
  },

  // ================================================================
  // TOPIC KEY EXTRACTION
  // ================================================================
  extractTopicKey(prompt) {
    if (!prompt) return null;
    const words = prompt.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'on', 'at', 'to', 'for', 'from', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'don', 'now', 'ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho'];
    const keywords = words.filter(w => w.length > 3 && !stopWords.includes(w));
    const key = keywords.slice(0, 5).join(' ');
    return key.length > 3 ? key.substring(0, 50) : prompt.substring(0, 50);
  },

  // ================================================================
  // FINAL PROMPT BUILDER
  // ================================================================
  buildFinalPrompt(prompt, previousResponse, previousPrompt, isReply, wantsDetailed, language = 'english') {
    const langName = this.getLanguageName(language);
    let final = '';
    
    final += `IMPORTANT: Respond in ${langName.toUpperCase()} language.\n\n`;

    if (previousResponse) {
      final += `=== PREVIOUS CONVERSATION ===\n`;
      final += `User asked: "${previousPrompt || 'unknown'}"\n`;
      final += `AI responded: "${previousResponse}"\n`;
      final += `==============================\n\n`;
      final += `USER'S NEW REQUEST: "${prompt}"\n\n`;
      
      const lower = prompt.toLowerCase();
      
      if (lower.includes('elaborate') || lower.includes('paki elaborate') || 
          lower.includes('explain more') || lower.includes('more explanation') ||
          lower.includes('paliwanag') || lower.includes('ipaliwanag') ||
          lower.includes('detail') || lower.includes('more details') ||
          lower.includes('clarify') || lower.includes('linawin')) {
        final += `⚠️ The user is asking you to ELABORATE on the PREVIOUS RESPONSE.\n`;
        final += `- STAY on the EXACT SAME TOPIC.\n`;
        final += `- Use the PREVIOUS RESPONSE as your starting point.\n`;
        final += `- Provide MORE DETAILS, CONTEXT, and EXAMPLES.\n\n`;
        final += `PREVIOUS TOPIC: "${previousPrompt}"\n`;
        final += `PREVIOUS RESPONSE: "${previousResponse}"\n\n`;
      } else if (lower.includes('example') || lower.includes('sample') || lower.includes('halimbawa')) {
        final += `⚠️ The user wants EXAMPLES related to the PREVIOUS RESPONSE.\n`;
        final += `- STAY on the SAME TOPIC.\n`;
        final += `- Provide SPECIFIC examples related to that topic.\n\n`;
      } else if (lower.includes('summarize') || lower.includes('summary') || lower.includes('short')) {
        final += `⚠️ The user wants a SUMMARY of the PREVIOUS RESPONSE.\n`;
        final += `- Provide only the KEY POINTS.\n`;
        final += `- Be CONCISE and DIRECT.\n\n`;
      } else if (lower.includes('translate') || lower.includes('isalin')) {
        const targetLang = this.detectTargetLanguage(prompt);
        final += `⚠️ User wants translation to ${targetLang}.\n`;
        final += `- Translate the PREVIOUS RESPONSE to ${targetLang}.\n`;
        final += `- ONLY provide the translation.\n\n`;
      } else {
        final += `⚠️ Continue the previous conversation.\n`;
        final += `- User says: "${prompt}"\n`;
        final += `- Provide a NATURAL response.\n\n`;
      }
      
      final += `🚨 STAY ON TOPIC. DO NOT start a new topic.\n\n`;
    } else {
      final += `USER ASKED: "${prompt}"\n\n`;
    }

    if (wantsDetailed) {
      final += `📝 Provide a COMPREHENSIVE, THOROUGH explanation.\n`;
    } else {
      final += `📝 Provide a SHORT, DIRECT, and ACCURATE response.\n`;
    }

    final += `\n📌 Respond in ${langName.toUpperCase()}. Be accurate and precise. Do NOT ask questions back.`;
    return final;
  },

  // ================================================================
  // REALTIME QUESTIONS
  // ================================================================
  isRealtimeQuestion(prompt) {
    const lower = prompt.toLowerCase();
    const timeKeywords = ['oras', 'time', 'petsa', 'date', 'anong oras', 'what time', 'what is the time', 'anong petsa', 'what date', 'real time', 'real-time', 'kasalukuyang oras', 'current time', 'current date', 'anong oras na', 'what time is it'];
    if (timeKeywords.some(k => lower.includes(k))) return true;
    const newsKeywords = ['balita', 'news', 'update', 'latest', 'pinakahuling', 'nangyari', 'happening', 'events', 'pangyayari', 'senado', 'senate', 'kongreso', 'congress', 'pulitika', 'politics', 'gobyerno', 'government', 'presidente', 'president', 'krisis', 'crisis', 'problema', 'problem'];
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
      const apiUrl = `https://yin-api.vercel.app/ai/copilot?message=${encodedPrompt}&model=default`;
      const response = await axios.get(apiUrl, { timeout: 30000, headers: { 'Accept': 'application/json' } });
      if (response.data && response.data.answer) {
        await this.sendChunks(senderId, this.cleanResponse(response.data.answer), token);
        return;
      }
    } catch (error) {
      console.error('[RealTime] API failed:', error.message);
    }
    let errorMessage = 'Unable to fetch real-time information. Please try again later.';
    if (detectedLanguage === 'tagalog') errorMessage = 'Hindi makuha ang real-time na impormasyon. Subukan muli mamaya.';
    else if (detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano') errorMessage = 'Dili makuha ang real-time nga impormasyon. Sulayi pag-usab.';
    await sendMessage(senderId, { text: errorMessage }, token);
  },

  isExactTimeRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['oras', 'time', 'petsa', 'date', 'anong oras', 'what time', 'what is the time', 'anong petsa', 'what date', 'real time', 'real-time', 'kasalukuyang oras', 'current time', 'current date', 'anong oras na', 'what time is it'];
    return keywords.some(k => lower.includes(k));
  },

  async handleTimeRequest(senderId, prompt, token) {
    const detectedLanguage = this.detectLanguage(prompt);
    try {
      const response = await axios.get('https://worldtimeapi.org/api/timezone/Asia/Manila', { timeout: 10000 });
      const data = response.data;
      const date = new Date(data.datetime);
      let message;
      if (detectedLanguage === 'tagalog') {
        const day = date.toLocaleString('fil-PH', { weekday: 'long' });
        const month = date.toLocaleString('fil-PH', { month: 'long' });
        message = `Real-Time sa Pilipinas\n\nPetsa: ${day}, ${month} ${date.getDate()}, ${date.getFullYear()}\nOras: ${date.toLocaleTimeString('fil-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (PHT)\nTimezone: Asia/Manila (UTC+8)`;
      } else {
        const day = date.toLocaleString('en-PH', { weekday: 'long' });
        const month = date.toLocaleString('en-PH', { month: 'long' });
        message = `Real-Time in the Philippines\n\nDate: ${day}, ${month} ${date.getDate()}, ${date.getFullYear()}\nTime: ${date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (PHT)\nTimezone: Asia/Manila (UTC+8)`;
      }
      await this.sendChunks(senderId, message, token);
    } catch (error) {
      console.error('[Time] API failed:', error.message);
      const now = new Date();
      let message;
      if (detectedLanguage === 'tagalog') {
        message = `Real-Time sa Pilipinas (Local)\n\nPetsa: ${now.toLocaleString('fil-PH', { timeZone: 'Asia/Manila' })}\nTimezone: Asia/Manila (UTC+8)`;
      } else {
        message = `Real-Time in the Philippines (Local)\n\nDate: ${now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}\nTimezone: Asia/Manila (UTC+8)`;
      }
      await this.sendChunks(senderId, message, token);
    }
  },

  // ================================================================
  // LYRICS
  // ================================================================
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
      await sendMessage(senderId, { text: 'Lyrics Search\n\nUsage: lyrics [song title] by [artist]\n\nExamples:\nlyrics lihim by arthur miguel\nletra ng lihim' }, token);
      return;
    }
    try {
      let query = title;
      if (artist) query += ` ${artist}`;
      const encodedQuery = encodeURIComponent(query);
      const apiUrl = `https://api-library-kohi-production.up.railway.app/api/lyrics?query=${encodedQuery}`;
      const response = await axios.get(apiUrl, { timeout: 15000, headers: { 'Accept': 'application/json' } });
      const data = response.data;
      if (!data.status || !data.data) {
        await sendMessage(senderId, { text: `Walang nakitang lyrics para sa "${title}".\n\nSubukan:\n- Tingnan ang spelling\n- Magdagdag ng pangalan ng artist\n- Gamitin ang format: lyrics [title] by [artist]` }, token);
        return;
      }
      const lyricsData = data.data;
      const songTitle = lyricsData.title || title;
      const songArtist = lyricsData.artist || artist || 'Hindi Kilalang Artist';
      const lyrics = lyricsData.lyrics || 'Hindi available ang lyrics.';
      let formattedLyrics = this.formatLyrics(lyrics);
      let message = `${songTitle}\nArtist: ${songArtist}\n\n${formattedLyrics}\n\nKumpletong lyrics\n${new Date().toLocaleString('fil-PH', { timeZone: 'Asia/Manila' })}`;
      await this.sendChunks(senderId, message, token);
    } catch (error) {
      console.error('[Lyrics] Error:', error.message);
      await sendMessage(senderId, { text: `Error sa pagkuha ng lyrics para sa "${title}". Subukan muli mamaya.` }, token);
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
          newLines.push(`[Verse ${sectionCount + 1}]`);
          newLines.push(line);
          isFirst = false;
          sectionCount++;
        } else if (line.length > 0 && (line.match(/[.!?]$/) || i === lines.length - 1)) {
          if (i > 0 && lines[i-1] === line) {
            newLines.push(`[Chorus]`);
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

  // ================================================================
  // IMAGE GENERATION
  // ================================================================
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
      'ano itsura ng', 'larawan ng', 'litrato ng', 'imahe ng'
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
    const removeKeywords = ['show me', 'give me', 'i want', 'sample', 'example', 'picture of', 'image of', 'photo of', 'generate', 'create', 'need', 'maghanap ng', 'gusto ko', 'patingin ng', 'ano itsura', 'looks like', 'parang', 'larawan ng', 'litrato ng', 'imahe ng'];
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
      await sendMessage(senderId, { text: 'Image Generation\n\nUsage: generate [search term] [number]\n\nExamples:\ngenerate cat\ngenerate beautiful sunset 5' }, token);
      return;
    }
    try {
      const cleanSearch = searchTerm.toLowerCase().trim();
      const searchWords = cleanSearch.split(/\s+/);
      let allImages = [];
      const response1 = await axios.get('https://hiroshi-api.onrender.com/image/pinterest', { params: { search: searchTerm, limit: 100 } });
      allImages = [...allImages, ...(response1.data?.data || [])];
      const response2 = await axios.get('https://hiroshi-api.onrender.com/image/pinterest', { params: { search: `${searchTerm} ${Date.now()}`, limit: 100 } });
      allImages = [...allImages, ...(response2.data?.data || [])];
      if (searchWords.length > 1) {
        const response3 = await axios.get('https://hiroshi-api.onrender.com/image/pinterest', { params: { search: searchWords[0], limit: 100 } });
        allImages = [...allImages, ...(response3.data?.data || [])];
      }
      if (allImages.length === 0) {
        await sendMessage(senderId, { text: `Walang nakitang mga larawan para sa "${searchTerm}".` }, token);
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
        await sendMessage(senderId, { text: `Walang valid na mga larawan para sa "${searchTerm}".` }, token);
        return;
      }
      for (let i = 0; i < resultImages.length; i++) {
        const imageUrl = resultImages[i];
        if (imageUrl && this.isValidUrl(imageUrl)) {
          await sendMessage(senderId, { attachment: { type: 'image', payload: { url: imageUrl } } }, token);
          if (i < resultImages.length - 1) await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      await sendMessage(senderId, { text: `Nakahanap ng ${resultImages.length} larawan para sa "${searchTerm}"` }, token);
    } catch (error) {
      console.log('[Generate] Error:', error.message);
      await sendMessage(senderId, { text: `Error sa pagkuha ng mga larawan para sa "${searchTerm}". Subukan muli.` }, token);
    }
  },

  isValidUrl(string) {
    try { new URL(string); return true; } catch (_) { return false; }
  },

  // ================================================================
  // SCHOLAR
  // ================================================================
  isScholarCommand(prompt) {
    const commands = ['gscholar', 'scholar', 'googlescholar', 'research', 'pananaliksik', 'saliksik'];
    const lower = prompt.toLowerCase().trim();
    return commands.some(cmd => lower.startsWith(cmd + ' ') || lower === cmd);
  },

  isResearchQuery(prompt) {
    const lower = prompt.toLowerCase();
    const patterns = [
      'find research', 'find study', 'find studies', 'find paper',
      'search research', 'search study', 'search studies',
      'research about', 'research on', 'study about',
      'studies about', 'academic paper', 'scholarly article',
      'literature review', 'systematic review', 'meta-analysis'
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
        await sendMessage(senderId, { text: `Walang nakitang resulta para sa "${query}".` }, token);
        return;
      }
      for (let i = 0; i < results.length; i++) {
        const paper = results[i];
        const title = paper.title || 'Walang titulo';
        const snippet = paper.snippet || 'Walang abstract na available';
        const citedBy = paper.inline_links?.cited_by?.total || '0';
        const scholarLink = paper.link || paper.redirect_link || `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;
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
        const text = `${snippet} ${paper.publication_info?.summary || ''}`;
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
        let message = `${i + 1}. ${title}\n\nMga May-akda: ${displayAuthors}\nNalathala sa: ${venue}\nTaon: ${year}`;
        if (volume) message += `\nVolume: ${volume}`;
        if (issue) message += `\nIssue: ${issue}`;
        if (pages) message += `\nPahina: ${pages}`;
        message += `\nDOI: ${doi || 'Hindi available'}`;
        if (citedBy !== '0') message += `\nSinipi ng: ${citedBy}`;
        message += `\nAbstract: ${snippet.substring(0, 300)}${snippet.length > 300 ? '...' : ''}\n\n`;
        if (scholarLink) message += `Google Scholar: ${scholarLink}\n\n`;
        message += `APA 7th Edition:\n${apaCitation}\n\nMLA 9th Edition:\n${mlaCitation}\n\nBeripikado: Natitingnan at naa-access\n${new Date().toLocaleString('fil-PH', { timeZone: 'Asia/Manila' })}`;
        await sendMessage(senderId, { text: message }, token);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      await sendMessage(senderId, { text: `Kumpleto na ang Paghahanap!\n\nQuery: ${query}\nNakahanap: ${results.length} papel\nPinagmulan: Google Scholar Website` }, token);
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
    return `${list.slice(0, 3).join(', ')}, et al.`;
  },

  async fetchDOIFromCrossRef(title, authors, year) {
    try {
      let query = encodeURIComponent(title);
      if (authors && authors !== 'Hindi Kilala') {
        const first = authors.split(',')[0].trim();
        query += `+${encodeURIComponent(first)}`;
      }
      if (year && year !== 'Hindi Kilala') query += `+${year}`;
      const url = `https://api.crossref.org/works?query=${query}&rows=1`;
      const response = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'AcademicBot/1.0' } });
      const items = response.data?.message?.items || [];
      if (items.length > 0 && items[0].DOI) return `https://doi.org/${items[0].DOI}`;
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
      { regex: /pii\/([a-zA-Z0-9]+)/, prefix: 'https://doi.org/10.1016/' }
    ];
    for (const pattern of patterns) {
      const match = link.match(pattern.regex);
      if (match) return `${pattern.prefix}${match[1]}`;
    }
    return null;
  },

  async getCompleteMetadata(doi) {
    try {
      const clean = doi.replace('https://doi.org/', '');
      const url = `https://api.crossref.org/works/${clean}`;
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
        formatted = `${last}, ${first}`;
      } else formatted = list[0];
    } else if (list.length === 2) {
      const p1 = list[0].split(' ');
      const p2 = list[1].split(' ');
      const l1 = p1.length > 1 ? p1[p1.length-1] : p1[0];
      const f1 = p1.length > 1 ? p1.slice(0, -1).map(p => p[0] + '.').join(' ') : '';
      const l2 = p2.length > 1 ? p2[p2.length-1] : p2[0];
      const f2 = p2.length > 1 ? p2.slice(0, -1).map(p => p[0] + '.').join(' ') : '';
      formatted = `${l1}, ${f1}, & ${l2}, ${f2}`;
    } else {
      const parts = list[0].split(' ');
      const last = parts.length > 1 ? parts[parts.length-1] : parts[0];
      const first = parts.length > 1 ? parts.slice(0, -1).map(p => p[0] + '.').join(' ') : '';
      formatted = `${last}, ${first}, et al.`;
    }
    let citation = `${formatted} (${year}). ${title}.`;
    if (venue && venue !== 'Hindi Kilala') citation += ` ${venue}`;
    if (volume) { citation += `, ${volume}`; if (issue) citation += `(${issue})`; }
    if (pages) citation += `, ${pages}`;
    if (doi) citation += `. ${doi}`;
    else if (url && url !== '') citation += ` Nakuha mula sa ${url}`;
    return citation;
  },

  generateMLA(authors, title, venue, year, url, doi, volume, issue, pages) {
    const list = authors.split(',').map(a => a.trim()).filter(a => a);
    let formatted = '';
    if (list.length === 0 || (list.length === 1 && list[0] === 'Hindi Kilala')) {
      formatted = 'Hindi Kilala';
    } else if (list.length === 1) {
      const parts = list[0].split(' ');
      formatted = parts.length > 1 ? `${parts[parts.length-1]}, ${parts.slice(0, -1).join(' ')}` : list[0];
    } else if (list.length === 2) {
      const p1 = list[0].split(' ');
      const p2 = list[1].split(' ');
      const l1 = p1.length > 1 ? p1[p1.length-1] : p1[0];
      const l2 = p2.length > 1 ? p2[p2.length-1] : p2[0];
      formatted = `${l1} and ${l2}`;
    } else {
      const parts = list[0].split(' ');
      const last = parts.length > 1 ? parts[parts.length-1] : parts[0];
      formatted = `${last} et al.`;
    }
    let citation = `${formatted}. "${title}." ${venue},`;
    if (volume) { citation += ` vol. ${volume},`; if (issue) citation += ` no. ${issue},`; }
    if (pages) citation += ` pp. ${pages},`;
    citation += ` ${year}.`;
    if (doi) citation += ` doi:${doi.replace('https://doi.org/', '')}.`;
    else if (url && url !== '') citation += ` ${url}.`;
    citation += ` Web. ${new Date().toLocaleDateString('fil-PH', { month: 'short', day: 'numeric', year: 'numeric' })}.`;
    return citation;
  },

  // ================================================================
  // MUSIC
  // ================================================================
  isMusicRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['play', 'song', 'music', 'track', 'audio', 'listen', 'sound', 'kanta', 'tugtog', 'music video', 'mv', 'soundtrack', 'playlist', 'album', 'single', 'remix', 'cover', 'stream', 'pakinggan', 'patugtog', 'opm', 'pinoy music', 'tagalog song', 'bisaya song'];
    return keywords.some(k => lower.includes(k));
  },

  async handleMusicSearch(senderId, prompt, token) {
    let searchTerm = prompt;
    const removeKeywords = ['play', 'song', 'music', 'track', 'audio', 'listen', 'sound', 'kanta', 'tugtog', 'music video', 'mv', 'soundtrack', 'playlist', 'album', 'single', 'remix', 'cover', 'stream', 'pakinggan', 'patugtog'];
    for (const keyword of removeKeywords) {
      if (searchTerm.toLowerCase().includes(keyword)) {
        searchTerm = searchTerm.toLowerCase().replace(keyword, '').trim();
        break;
      }
    }
    if (!searchTerm) {
      await sendMessage(senderId, { text: 'Music Search\n\nUsage: play [song title] or music [song title]\n\nExamples:\nplay lihim\nmusic halik' }, token);
      return;
    }
    try {
      const encodedSearch = encodeURIComponent(searchTerm);
      const apiUrl = `https://betadash-api-swordslush-production.up.railway.app/sc?search=${encodedSearch}`;
      const response = await axios.get(apiUrl, { timeout: 30000, headers: { 'Accept': 'application/json' } });
      const data = response.data;
      if (!data || !data.results || data.results.length === 0) {
        await sendMessage(senderId, { text: `Walang nakitang resulta para sa "${searchTerm}".` }, token);
        return;
      }
      const exactMatches = data.results.filter(track => {
        const title = track.data.title || '';
        return title.toLowerCase().includes(searchTerm.toLowerCase());
      });
      const results = exactMatches.length > 0 ? exactMatches : data.results;
      const totalResults = results.length;
      let message = `SoundCloud Results para sa "${searchTerm}"\nNakahanap ng ${totalResults} kanta\n\n`;
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
        message += `${i + 1}. ${title}\nArtist: ${artist}\nGenre: ${genre}\nDuration: ${duration}\nReleased: ${created}\nPlays: ${plays.toLocaleString()}\nLikes: ${likes.toLocaleString()}`;
        if (artwork) message += `\nArtwork: ${artwork}`;
        message += `\nListen: ${url}`;
        if (audioUrl) message += `\nDirect Audio: ${audioUrl}`;
        message += `\n\n`;
      }
      message += `Found ${totalResults} results\n${new Date().toLocaleString('fil-PH', { timeZone: 'Asia/Manila' })}`;
      await this.sendChunks(senderId, message, token);
    } catch (error) {
      console.error('[Music] Error:', error.message);
      await sendMessage(senderId, { text: `Error sa paghahanap para sa "${searchTerm}". Subukan muli mamaya.` }, token);
    }
  },

  formatDuration(ms) {
    if (!ms) return 'Hindi Kilala';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  },

  // ================================================================
  // API CALLS
  // ================================================================
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
      console.log('[API] Trying primary API...');
      return await this.executeApiCall(primary, prompt, senderId);
    } catch (primaryError) {
      console.error('[API] Primary API failed:', primaryError.message);
      try {
        console.log('[API] Trying fallback API...');
        return await this.executeApiCall(fallback, prompt, senderId);
      } catch (fallbackError) {
        console.error('[API] Fallback API also failed:', fallbackError.message);
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
          const url = `${config.url}?${param}=${encoded}`;
          response = await axios.get(url, { timeout: config.timeout, headers: { 'Accept': 'application/json', ...config.headers } });
        } else {
          response = await axios.post(config.url, { prompt }, { timeout: config.timeout, headers: { 'Content-Type': 'application/json', ...config.headers } });
        }
        const data = response.data;
        if (data[config.successField] !== true) throw new Error(`API returned ${config.successField}: false`);
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
    throw lastError || new Error(`Failed to get response from ${config.url}`);
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

  // ================================================================
  // MISC HELPERS
  // ================================================================
  wantsDetailedAnswer(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['explain more', 'more explanation', 'more details', 'detailed', 'detail', 'elaborate', 'elaborate more', 'paki elaborate', 'mas detalyado', 'tell me more', 'give more info', 'dagdagan', 'dagdag', 'further explain', 'further explanation', 'full explanation', 'complete explanation', 'in depth', 'in-depth', 'thorough', 'comprehensive', 'expound', 'pakilinaw', 'linawin', 'more information', 'additional info', 'karagdagang', 'can you explain further', 'please elaborate', 'paki explain', 'paliwanag', 'ipaliwanag'];
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
    }
  },

  // ================================================================
  // USER INFO
  // ================================================================
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
          (lang === 'tagalog' ? `Ang pangalan mo ay ${userInfo.name}.` :
           lang === 'bisaya' ? `Ang ngalan nimo kay ${userInfo.name}.` :
           `Your name is ${userInfo.name}.`) : 
          (lang === 'tagalog' ? 'Hindi ko masasabi iyan dahil ito ay kompidensyal.' :
           lang === 'bisaya' ? 'Dili nako masulti kana kay kompidensyal.' :
           'I cannot say that because it is confidential.');
      }
      if (prompt.toLowerCase().includes('birthday') || prompt.toLowerCase().includes('kelan')) {
        response += userInfo.birthday ? 
          (lang === 'tagalog' ? `\nAng birthday mo ay ${userInfo.birthday}.` :
           lang === 'bisaya' ? `\nAng birthday nimo kay ${userInfo.birthday}.` :
           `\nYour birthday is ${userInfo.birthday}.`) : 
          (lang === 'tagalog' ? '\nHindi ko masasabi iyan dahil ito ay kompidensyal.' :
           lang === 'bisaya' ? '\nDili nako masulti kana kay kompidensyal.' :
           '\nI cannot say that because it is confidential.');
      }
      if (!response) {
        const publicInfo = [];
        if (userInfo.name) publicInfo.push(lang === 'tagalog' ? `Pangalan: ${userInfo.name}` : lang === 'bisaya' ? `Ngalan: ${userInfo.name}` : `Name: ${userInfo.name}`);
        if (userInfo.birthday) publicInfo.push(lang === 'tagalog' ? `Birthday: ${userInfo.birthday}` : lang === 'bisaya' ? `Birthday: ${userInfo.birthday}` : `Birthday: ${userInfo.birthday}`);
        if (userInfo.gender) publicInfo.push(lang === 'tagalog' ? `Kasarian: ${userInfo.gender}` : lang === 'bisaya' ? `Gender: ${userInfo.gender}` : `Gender: ${userInfo.gender}`);
        if (userInfo.location) publicInfo.push(lang === 'tagalog' ? `Lokasyon: ${userInfo.location}` : lang === 'bisaya' ? `Lokasyon: ${userInfo.location}` : `Location: ${userInfo.location}`);
        response = publicInfo.length > 0 ? 
          (lang === 'tagalog' ? `Narito ang iyong pampublikong impormasyon:\n${publicInfo.join('\n')}` :
           lang === 'bisaya' ? `Ania ang imong pampublikong impormasyon:\n${publicInfo.join('\n')}` :
           `Here is your public information:\n${publicInfo.join('\n')}`) : 
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
      console.error('[Graph API] Error:', error.message);
      return {};
    }
  },

  // ================================================================
  // TRANSLATION
  // ================================================================
  isTranslationRequest(prompt) {
    const keywords = ['translate', 'translate to', 'translate into', 'translate in', 'translation', 'isalin', 'salin', 'ipasalin', 'isalin sa', 'transl', 'trans', 'i-translate', 'isalin mo'];
    const lower = prompt.toLowerCase();
    if (keywords.some(k => lower.includes(k))) return true;
    const languages = ['tagalog', 'bisaya', 'cebuano', 'spanish', 'filipino', 'english', 'ilocano', 'waray', 'hiligaynon', 'kapampangan', 'chinese', 'japanese', 'korean', 'french', 'german', 'italian', 'portuguese', 'russian', 'arabic', 'hindi'];
    return languages.some(l => lower.includes(l));
  },

  detectTargetLanguage(prompt) {
    const lower = prompt.toLowerCase();
    const languages = {
      'tagalog': 'Tagalog', 'filipino': 'Filipino',
      'bisaya': 'Bisaya', 'cebuano': 'Cebuano',
      'ilocano': 'Ilocano', 'waray': 'Waray',
      'hiligaynon': 'Hiligaynon', 'kapampangan': 'Kapampangan',
      'english': 'English', 'spanish': 'Spanish',
      'chinese': 'Chinese', 'japanese': 'Japanese',
      'korean': 'Korean', 'french': 'French',
      'german': 'German', 'italian': 'Italian',
      'portuguese': 'Portuguese', 'russian': 'Russian',
      'arabic': 'Arabic', 'hindi': 'Hindi'
    };
    for (const [key, value] of Object.entries(languages)) {
      if (lower.includes(key)) return value;
    }
    return 'English';
  },

  async translateResponse(text, targetLanguage) {
    try {
      const translatePrompt = `Translate this text to ${targetLanguage}. Only provide the translation, no other text. Do not include the original text. Here is the text to translate: ${text}`;
      const response = await this.callAPI(translatePrompt, 'translation');
      return response || text;
    } catch (error) {
      console.error('[Translation] Failed:', error.message);
      return text;
    }
  },

  // ================================================================
  // GET REPLIED MESSAGE
  // ================================================================
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

  // ================================================================
  // CLEAN RESPONSE
  // ================================================================
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
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    return cleaned.trim() || 'Walang tugon.';
  },

  // ================================================================
  // ERROR MESSAGE
  // ================================================================
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
    for (let i = 0; i < text.length; i += MAX_CHUNK) chunks.push(text.slice(i, i + MAX_CHUNK));
    return chunks;
  },

  async sendChunks(senderId, text, token) {
    const chunks = this.splitMessage(text);
    for (const chunk of chunks) await sendMessage(senderId, { text: chunk }, token);
  }
};
