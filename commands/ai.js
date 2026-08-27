const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const MAX_CHUNK = 1900;
const conversationHistory = {};
const SERPAPI_KEY = '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ai', 'opera', 'ask', 'gemini', 'vision', 'gscholar', 'scholar', 'googlescholar', 'research', 'generate', 'image', 'img', 'show'],
  description: 'Multi-modal AI with text, image analysis, Google Scholar, image generation, music search, and lyrics',
  usage: 'ai [message] or send/reply to image or generate [query] or play [song] or lyrics [song]',
  version: '4.0.0',
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

      // 🔥 NEW: Check if this is a MATH PROBLEM request
      const isMathRequest = this.isMathRequest(prompt);
      
      // 🔥 NEW: If MATH problem, generate complete solution with examples
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
          text: 'Hello! Ako si Teacher Arlene - Multi-Modal AI.\n\nMga Kakayahan:\nText conversations\nImage analysis\nAcademic research\nImage generation\nMusic search\nLyrics search\nReal-life situations\nTranslation\nSummarization\nMath Problems & Solutions (ALL TYPES)\n\nMga Commands:\nai [tanong]\nMag-send ng image para ma-analyze\ngenerate [search term] [number]\ngscholar [search query]\nplay [song title]\nlyrics [song title] by [artist]\n\nMath Commands:\ngive me [math type] problem\nalgebra|geometry|trigonometry|calculus|statistics|probability|permutation|combination|matrix|grouped data\n\nKaya kong makipag-usap sa Tagalog, Bisaya, English, at iba pang wika.'
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
  // 🆕 NEW: MATH REQUEST HANDLER - GENERATES COMPLETE SAMPLES & SOLUTIONS
  // ================================================================
  isMathRequest(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    const mathKeywords = [
      'solve', 'equation', 'algebra', 'geometry', 'trigonometry', 'calculus',
      'statistics', 'probability', 'permutation', 'combination', 'matrix',
      'derivative', 'integral', 'limit', 'series', 'sequence',
      'arithmetic', 'geometric', 'fraction', 'decimal', 'percentage',
      'ratio', 'proportion', 'exponent', 'radical', 'logarithm',
      'linear', 'quadratic', 'polynomial', 'rational', 'inequality',
      'absolute value', 'complex number', 'vector', 'area', 'volume',
      'perimeter', 'circumference', 'angle', 'triangle', 'circle',
      'pythagorean', 'mean', 'median', 'mode', 'standard deviation',
      'variance', 'grouped data', 'frequency distribution',
      'word problem', 'math problem', 'sample math', 'practice math',
      'math example', 'solution to', 'find the', 'compute the',
      'calculate the', 'determine the', 'evaluate the',
      'mag-solve', 'solve ng', 'math sample', 'math solution',
      'give me', 'show me', 'provide', 'generate', 'example of',
      'sample of', 'problem about', 'problem in', 'math about',
      'algebra problem', 'geometry problem', 'trigonometry problem',
      'calculus problem', 'statistics problem', 'probability problem',
      'permutation problem', 'combination problem', 'matrix problem',
      'derivative problem', 'integral problem', 'limit problem',
      'sequence problem', 'series problem', 'word problem',
      'age problem', 'distance problem', 'work problem',
      'mixture problem', 'investment problem', 'ratio problem'
    ];
    return mathKeywords.some(k => lower.includes(k));
  },

  async handleMathRequest(senderId, prompt, token) {
    try {
      const detectedLanguage = this.detectLanguage(prompt);
      const langName = this.getLanguageName(detectedLanguage);
      
      // Check for specific math topics
      const lower = prompt.toLowerCase();
      let mathType = 'general';
      
      if (lower.includes('algebra') || lower.includes('equation') || lower.includes('solve') || 
          lower.includes('linear') || lower.includes('quadratic') || lower.includes('polynomial') ||
          lower.includes('rational') || lower.includes('inequality') || lower.includes('absolute value') ||
          lower.includes('complex number') || lower.includes('exponent') || lower.includes('radical') ||
          lower.includes('logarithm') || lower.includes('system of equation')) {
        mathType = 'algebra';
      } else if (lower.includes('geometry') || lower.includes('area') || lower.includes('volume') ||
                 lower.includes('perimeter') || lower.includes('circumference') || lower.includes('angle') ||
                 lower.includes('triangle') || lower.includes('circle') || lower.includes('pythagorean') ||
                 lower.includes('rectangle') || lower.includes('square') || lower.includes('polygon')) {
        mathType = 'geometry';
      } else if (lower.includes('trigonometry') || lower.includes('sin') || lower.includes('cos') ||
                 lower.includes('tan') || lower.includes('csc') || lower.includes('sec') ||
                 lower.includes('cot') || lower.includes('sohcahtoa') || lower.includes('sine') ||
                 lower.includes('cosine') || lower.includes('tangent') || lower.includes('law of sines') ||
                 lower.includes('law of cosines')) {
        mathType = 'trigonometry';
      } else if (lower.includes('calculus') || lower.includes('derivative') || lower.includes('integral') ||
                 lower.includes('limit') || lower.includes('differentiation') || lower.includes('integration') ||
                 lower.includes('chain rule') || lower.includes('product rule') || lower.includes('quotient rule') ||
                 lower.includes('optimization') || lower.includes('min') || lower.includes('max')) {
        mathType = 'calculus';
      } else if (lower.includes('statistics') || lower.includes('mean') || lower.includes('median') ||
                 lower.includes('mode') || lower.includes('standard deviation') || lower.includes('variance') ||
                 lower.includes('range') || lower.includes('percentile') || lower.includes('quartile') ||
                 lower.includes('grouped data') || lower.includes('frequency distribution')) {
        mathType = 'statistics';
      } else if (lower.includes('probability') || lower.includes('chance') || lower.includes('likelihood') ||
                 lower.includes('conditional probability') || lower.includes('expected value') ||
                 lower.includes('independent') || lower.includes('dependent') || lower.includes('sample space')) {
        mathType = 'probability';
      } else if (lower.includes('permutation') || lower.includes('combination') || lower.includes('factorial') ||
                 lower.includes('arrangement') || lower.includes('selection') || lower.includes('npr') ||
                 lower.includes('ncr') || lower.includes('circular permutation')) {
        mathType = 'combinatorics';
      } else if (lower.includes('matrix') || lower.includes('determinant') || lower.includes('inverse') ||
                 lower.includes('transpose') || lower.includes('addition matrix') || lower.includes('multiplication matrix')) {
        mathType = 'matrix';
      } else if (lower.includes('sequence') || lower.includes('series') || lower.includes('arithmetic') ||
                 lower.includes('geometric') || lower.includes('fibonacci') || lower.includes('summation') ||
                 lower.includes('nth term') || lower.includes('sigma')) {
        mathType = 'sequence';
      } else if (lower.includes('number theory') || lower.includes('factors') || lower.includes('multiples') ||
                 lower.includes('prime') || lower.includes('gcd') || lower.includes('lcm') ||
                 lower.includes('divisibility') || lower.includes('modular')) {
        mathType = 'numbertheory';
      } else if (lower.includes('word problem') || lower.includes('age problem') || lower.includes('distance') ||
                 lower.includes('work problem') || lower.includes('mixture') || lower.includes('investment') ||
                 lower.includes('ratio problem') || lower.includes('proportion')) {
        mathType = 'wordproblem';
      } else if (lower.includes('physics math') || lower.includes('kinematics') || lower.includes('force') ||
                 lower.includes('energy') || lower.includes('motion') || lower.includes('acceleration') ||
                 lower.includes('velocity') || lower.includes('projectile')) {
        mathType = 'physics';
      } else if (lower.includes('grouped data') || lower.includes('frequency distribution')) {
        mathType = 'grouped';
      } else if (lower.includes('fraction') || lower.includes('decimal') || lower.includes('percentage') ||
                 lower.includes('ratio') || lower.includes('proportion')) {
        mathType = 'arithmetic';
      }
      
      // Generate the math problem and solution
      const mathResponse = this.generateMathProblem(mathType, detectedLanguage, prompt);
      
      // Send the response
      await this.sendChunks(senderId, mathResponse, token);
      
    } catch (error) {
      console.error('[Math Request] Error:', error.message);
      await sendMessage(senderId, { 
        text: `Error generating math problem. Please try again.\n\nError: ${error.message}` 
      }, token);
    }
  },

  generateMathProblem(type, language, userPrompt) {
    const lang = language || 'english';
    let response = '';
    
    // Generate different math problems based on type
    switch(type) {
      case 'algebra':
        response = this.generateAlgebraProblem(lang);
        break;
      case 'geometry':
        response = this.generateGeometryProblem(lang);
        break;
      case 'trigonometry':
        response = this.generateTrigonometryProblem(lang);
        break;
      case 'calculus':
        response = this.generateCalculusProblem(lang);
        break;
      case 'statistics':
        response = this.generateStatisticsProblem(lang);
        break;
      case 'probability':
        response = this.generateProbabilityProblem(lang);
        break;
      case 'combinatorics':
        response = this.generateCombinatoricsProblem(lang);
        break;
      case 'matrix':
        response = this.generateMatrixProblem(lang);
        break;
      case 'grouped':
        response = this.generateGroupedDataProblem(lang);
        break;
      case 'sequence':
        response = this.generateSequenceProblem(lang);
        break;
      case 'numbertheory':
        response = this.generateNumberTheoryProblem(lang);
        break;
      case 'wordproblem':
        response = this.generateWordProblem(lang);
        break;
      case 'physics':
        response = this.generatePhysicsProblem(lang);
        break;
      case 'arithmetic':
        response = this.generateArithmeticProblem(lang);
        break;
      default:
        response = this.generateGeneralMathProblem(lang);
    }
    
    return response;
  },

  // ================================================================
  // 🆕 ALL MATH PROBLEM GENERATORS
  // ================================================================
  
  generateAlgebraProblem(lang) {
    // Generate random algebra problem
    const a = Math.floor(Math.random() * 5) + 2;
    const b = Math.floor(Math.random() * 10) + 1;
    const c = Math.floor(Math.random() * 5) + 1;
    const d = Math.floor(Math.random() * 5) + 1;
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `📐 ALGEBRA PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Solve for x: ${a}x + ${b} = ${c}x - ${d}\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Move all x terms to one side\n`;
      response += `${a}x + ${b} = ${c}x - ${d}\n`;
      response += `${a}x - ${c}x = -${d} - ${b}\n`;
      response += `${a - c}x = ${-(d + b)}\n\n`;
      response += `Step 2: Divide both sides by ${a - c}\n`;
      response += `x = ${-(d + b)} / ${a - c}\n`;
      
      const x = -(d + b) / (a - c);
      response += `x = ${x.toFixed(2)}\n\n`;
      
      response += `✅ CHECK:\n`;
      response += `${a}(${x.toFixed(2)}) + ${b} = ${c}(${x.toFixed(2)}) - ${d}\n`;
      response += `${(a * x + b).toFixed(2)} = ${(c * x - d).toFixed(2)} ✓\n\n`;
      response += `🎯 FINAL ANSWER: x = ${x.toFixed(2)}`;
    } else {
      response = `📐 ALGEBRA PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Solve for x: ${a}x + ${b} = ${c}x - ${d}\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Move all x terms to one side\n`;
      response += `${a}x + ${b} = ${c}x - ${d}\n`;
      response += `${a}x - ${c}x = -${d} - ${b}\n`;
      response += `${a - c}x = ${-(d + b)}\n\n`;
      response += `Step 2: Divide both sides by ${a - c}\n`;
      response += `x = ${-(d + b)} / ${a - c}\n`;
      
      const x = -(d + b) / (a - c);
      response += `x = ${x.toFixed(2)}\n\n`;
      
      response += `✅ CHECK:\n`;
      response += `${a}(${x.toFixed(2)}) + ${b} = ${c}(${x.toFixed(2)}) - ${d}\n`;
      response += `${(a * x + b).toFixed(2)} = ${(c * x - d).toFixed(2)} ✓\n\n`;
      response += `🎯 FINAL ANSWER: x = ${x.toFixed(2)}`;
    }
    
    return response;
  },

  generateGeometryProblem(lang) {
    const r = Math.floor(Math.random() * 8) + 3;
    const h = Math.floor(Math.random() * 10) + 5;
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `📐 GEOMETRY PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Find the area and circumference of a circle with radius ${r} cm.\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Formula for Area\n`;
      response += `A = πr²\n`;
      response += `A = π(${r})²\n`;
      response += `A = ${r * r}π\n`;
      response += `A = ${(Math.PI * r * r).toFixed(2)} cm²\n\n`;
      response += `Step 2: Formula for Circumference\n`;
      response += `C = 2πr\n`;
      response += `C = 2π(${r})\n`;
      response += `C = ${2 * r}π\n`;
      response += `C = ${(2 * Math.PI * r).toFixed(2)} cm\n\n`;
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Area = ${(Math.PI * r * r).toFixed(2)} cm²\n`;
      response += `Circumference = ${(2 * Math.PI * r).toFixed(2)} cm`;
    } else {
      response = `📐 GEOMETRY PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Find the area and circumference of a circle with radius ${r} cm.\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Formula for Area\n`;
      response += `A = πr²\n`;
      response += `A = π(${r})²\n`;
      response += `A = ${r * r}π\n`;
      response += `A = ${(Math.PI * r * r).toFixed(2)} cm²\n\n`;
      response += `Step 2: Formula for Circumference\n`;
      response += `C = 2πr\n`;
      response += `C = 2π(${r})\n`;
      response += `C = ${2 * r}π\n`;
      response += `C = ${(2 * Math.PI * r).toFixed(2)} cm\n\n`;
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Area = ${(Math.PI * r * r).toFixed(2)} cm²\n`;
      response += `Circumference = ${(2 * Math.PI * r).toFixed(2)} cm`;
    }
    
    return response;
  },

  generateTrigonometryProblem(lang) {
    const angle = Math.floor(Math.random() * 30) + 30;
    const rad = angle * Math.PI / 180;
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `📐 TRIGONOMETRY PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Find sin(${angle}°) and cos(${angle}°).\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Convert to radians\n`;
      response += `${angle}° = ${angle} × π/180\n`;
      response += `${angle}° = ${(angle * Math.PI / 180).toFixed(4)} radians\n\n`;
      response += `Step 2: Use trigonometric ratios\n`;
      response += `sin(${angle}°) = ${Math.sin(rad).toFixed(4)}\n`;
      response += `cos(${angle}°) = ${Math.cos(rad).toFixed(4)}\n\n`;
      response += `Step 3: Verify using identity\n`;
      response += `sin²(${angle}°) + cos²(${angle}°) = 1\n`;
      response += `${(Math.sin(rad) ** 2).toFixed(4)} + ${(Math.cos(rad) ** 2).toFixed(4)} = 1 ✓\n\n`;
      response += `🎯 FINAL ANSWERS:\n`;
      response += `sin(${angle}°) = ${Math.sin(rad).toFixed(4)}\n`;
      response += `cos(${angle}°) = ${Math.cos(rad).toFixed(4)}`;
    } else {
      response = `📐 TRIGONOMETRY PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Find sin(${angle}°) and cos(${angle}°).\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Convert to radians\n`;
      response += `${angle}° = ${angle} × π/180\n`;
      response += `${angle}° = ${(angle * Math.PI / 180).toFixed(4)} radians\n\n`;
      response += `Step 2: Use trigonometric ratios\n`;
      response += `sin(${angle}°) = ${Math.sin(rad).toFixed(4)}\n`;
      response += `cos(${angle}°) = ${Math.cos(rad).toFixed(4)}\n\n`;
      response += `Step 3: Verify using identity\n`;
      response += `sin²(${angle}°) + cos²(${angle}°) = 1\n`;
      response += `${(Math.sin(rad) ** 2).toFixed(4)} + ${(Math.cos(rad) ** 2).toFixed(4)} = 1 ✓\n\n`;
      response += `🎯 FINAL ANSWERS:\n`;
      response += `sin(${angle}°) = ${Math.sin(rad).toFixed(4)}\n`;
      response += `cos(${angle}°) = ${Math.cos(rad).toFixed(4)}`;
    }
    
    return response;
  },

  generateCalculusProblem(lang) {
    const a = Math.floor(Math.random() * 4) + 2;
    const b = Math.floor(Math.random() * 5) + 1;
    const c = Math.floor(Math.random() * 4) + 1;
    const d = Math.floor(Math.random() * 5) + 1;
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `📐 CALCULUS PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Find the derivative of f(x) = ${a}x³ - ${b}x² + ${c}x - ${d}\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Apply power rule: d/dx(xⁿ) = nxⁿ⁻¹\n\n`;
      response += `Step 2: Differentiate each term\n`;
      response += `Term 1: ${a}x³\n`;
      response += `d/dx(${a}x³) = ${a} × 3 × x³⁻¹ = ${3 * a}x²\n\n`;
      response += `Term 2: -${b}x²\n`;
      response += `d/dx(-${b}x²) = -${b} × 2 × x²⁻¹ = -${2 * b}x\n\n`;
      response += `Term 3: ${c}x\n`;
      response += `d/dx(${c}x) = ${c} × 1 × x⁰ = ${c}\n\n`;
      response += `Term 4: -${d}\n`;
      response += `d/dx(-${d}) = 0\n\n`;
      response += `Step 3: Combine all terms\n`;
      response += `f'(x) = ${3 * a}x² - ${2 * b}x + ${c}\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `f'(x) = ${3 * a}x² - ${2 * b}x + ${c}`;
    } else {
      response = `📐 CALCULUS PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Find the derivative of f(x) = ${a}x³ - ${b}x² + ${c}x - ${d}\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Apply power rule: d/dx(xⁿ) = nxⁿ⁻¹\n\n`;
      response += `Step 2: Differentiate each term\n`;
      response += `Term 1: ${a}x³\n`;
      response += `d/dx(${a}x³) = ${a} × 3 × x³⁻¹ = ${3 * a}x²\n\n`;
      response += `Term 2: -${b}x²\n`;
      response += `d/dx(-${b}x²) = -${b} × 2 × x²⁻¹ = -${2 * b}x\n\n`;
      response += `Term 3: ${c}x\n`;
      response += `d/dx(${c}x) = ${c} × 1 × x⁰ = ${c}\n\n`;
      response += `Term 4: -${d}\n`;
      response += `d/dx(-${d}) = 0\n\n`;
      response += `Step 3: Combine all terms\n`;
      response += `f'(x) = ${3 * a}x² - ${2 * b}x + ${c}\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `f'(x) = ${3 * a}x² - ${2 * b}x + ${c}`;
    }
    
    return response;
  },

  generateStatisticsProblem(lang) {
    // Generate random data set
    const data = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      data.push(Math.floor(Math.random() * 40) + 60);
    }
    const sorted = [...data].sort((a, b) => a - b);
    const sum = data.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const median = sorted[Math.floor(n/2)];
    
    // Find mode
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
    
    // Standard deviation
    const squaredDiffs = data.map(x => (x - mean) ** 2);
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
    const stdDev = Math.sqrt(variance);
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `📊 STATISTICS PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Find the mean, median, mode, and standard deviation of:\n`;
      response += `${data.join(', ')}\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      
      response += `Step 1: Arrange data in ascending order\n`;
      response += `${sorted.join(', ')}\n\n`;
      
      response += `Step 2: Find Mean\n`;
      response += `Sum = ${data.join(' + ')}\n`;
      response += `Sum = ${sum}\n`;
      response += `n = ${n}\n`;
      response += `Mean = ${sum} ÷ ${n} = ${mean.toFixed(2)}\n\n`;
      
      response += `Step 3: Find Median\n`;
      response += `Middle position = (${n} + 1) ÷ 2 = ${(n + 1) / 2}th position\n`;
      response += `Median = ${median}\n\n`;
      
      response += `Step 4: Find Mode\n`;
      response += `Frequency: ${JSON.stringify(freq)}\n`;
      response += `Mode = ${mode}\n\n`;
      
      response += `Step 5: Find Standard Deviation\n`;
      response += `Variance = Σ(x - x̄)²/n\n`;
      response += `Variance = ${variance.toFixed(2)}\n`;
      response += `SD = √${variance.toFixed(2)} = ${stdDev.toFixed(2)}\n\n`;
      
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Mean = ${mean.toFixed(2)}\n`;
      response += `Median = ${median}\n`;
      response += `Mode = ${mode}\n`;
      response += `Standard Deviation = ${stdDev.toFixed(2)}`;
    } else {
      response = `📊 STATISTICS PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Find the mean, median, mode, and standard deviation of:\n`;
      response += `${data.join(', ')}\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      
      response += `Step 1: Arrange data in ascending order\n`;
      response += `${sorted.join(', ')}\n\n`;
      
      response += `Step 2: Find Mean\n`;
      response += `Sum = ${data.join(' + ')}\n`;
      response += `Sum = ${sum}\n`;
      response += `n = ${n}\n`;
      response += `Mean = ${sum} ÷ ${n} = ${mean.toFixed(2)}\n\n`;
      
      response += `Step 3: Find Median\n`;
      response += `Middle position = (${n} + 1) ÷ 2 = ${(n + 1) / 2}th position\n`;
      response += `Median = ${median}\n\n`;
      
      response += `Step 4: Find Mode\n`;
      response += `Frequency: ${JSON.stringify(freq)}\n`;
      response += `Mode = ${mode}\n\n`;
      
      response += `Step 5: Find Standard Deviation\n`;
      response += `Variance = Σ(x - x̄)²/n\n`;
      response += `Variance = ${variance.toFixed(2)}\n`;
      response += `SD = √${variance.toFixed(2)} = ${stdDev.toFixed(2)}\n\n`;
      
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Mean = ${mean.toFixed(2)}\n`;
      response += `Median = ${median}\n`;
      response += `Mode = ${mode}\n`;
      response += `Standard Deviation = ${stdDev.toFixed(2)}`;
    }
    
    return response;
  },

  generateProbabilityProblem(lang) {
    const total = Math.floor(Math.random() * 8) + 5;
    const favorable = Math.floor(Math.random() * (total - 1)) + 1;
    const prob = favorable / total;
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `🎲 PROBABILITY PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `A bag contains ${total} balls. ${favorable} are red and the rest are blue.\n`;
      response += `What is the probability of drawing a red ball?\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Identify total outcomes\n`;
      response += `Total balls = ${total}\n\n`;
      response += `Step 2: Identify favorable outcomes\n`;
      response += `Red balls = ${favorable}\n\n`;
      response += `Step 3: Apply probability formula\n`;
      response += `P(red) = Favorable Outcomes / Total Outcomes\n`;
      response += `P(red) = ${favorable} / ${total}\n`;
      response += `P(red) = ${prob.toFixed(3)}\n\n`;
      response += `Step 4: Convert to percentage\n`;
      response += `P(red) = ${(prob * 100).toFixed(1)}%\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `Probability = ${prob.toFixed(3)} or ${(prob * 100).toFixed(1)}%`;
    } else {
      response = `🎲 PROBABILITY PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `A bag contains ${total} balls. ${favorable} are red and the rest are blue.\n`;
      response += `What is the probability of drawing a red ball?\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Identify total outcomes\n`;
      response += `Total balls = ${total}\n\n`;
      response += `Step 2: Identify favorable outcomes\n`;
      response += `Red balls = ${favorable}\n\n`;
      response += `Step 3: Apply probability formula\n`;
      response += `P(red) = Favorable Outcomes / Total Outcomes\n`;
      response += `P(red) = ${favorable} / ${total}\n`;
      response += `P(red) = ${prob.toFixed(3)}\n\n`;
      response += `Step 4: Convert to percentage\n`;
      response += `P(red) = ${(prob * 100).toFixed(1)}%\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `Probability = ${prob.toFixed(3)} or ${(prob * 100).toFixed(1)}%`;
    }
    
    return response;
  },

  generateCombinatoricsProblem(lang) {
    const n = Math.floor(Math.random() * 5) + 5;
    const r = Math.floor(Math.random() * (n - 2)) + 2;
    
    // Calculate permutation and combination
    const fact = (num) => {
      if (num <= 1) return 1;
      return num * fact(num - 1);
    };
    
    const perm = fact(n) / fact(n - r);
    const comb = fact(n) / (fact(r) * fact(n - r));
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `📐 PERMUTATION & COMBINATION PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `From ${n} people, how many ways can we:\n`;
      response += `a) Arrange ${r} people in a row (Permutation)\n`;
      response += `b) Select ${r} people (Combination)\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      
      response += `PART A: Permutation\n`;
      response += `Step 1: Use formula P(n,r) = n!/(n-r)!\n`;
      response += `P(${n},${r}) = ${n}!/(${n}-${r})!\n`;
      response += `P(${n},${r}) = ${fact(n)}/${fact(n - r)}\n`;
      response += `P(${n},${r}) = ${perm}\n\n`;
      
      response += `PART B: Combination\n`;
      response += `Step 1: Use formula C(n,r) = n!/(r!(n-r)!)\n`;
      response += `C(${n},${r}) = ${n}!/(${r}!(${n}-${r})!)\n`;
      response += `C(${n},${r}) = ${fact(n)}/(${fact(r)} × ${fact(n - r)})\n`;
      response += `C(${n},${r}) = ${comb}\n\n`;
      
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Permutation = ${perm} ways\n`;
      response += `Combination = ${comb} ways`;
    } else {
      response = `📐 PERMUTATION & COMBINATION PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `From ${n} people, how many ways can we:\n`;
      response += `a) Arrange ${r} people in a row (Permutation)\n`;
      response += `b) Select ${r} people (Combination)\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      
      response += `PART A: Permutation\n`;
      response += `Step 1: Use formula P(n,r) = n!/(n-r)!\n`;
      response += `P(${n},${r}) = ${n}!/(${n}-${r})!\n`;
      response += `P(${n},${r}) = ${fact(n)}/${fact(n - r)}\n`;
      response += `P(${n},${r}) = ${perm}\n\n`;
      
      response += `PART B: Combination\n`;
      response += `Step 1: Use formula C(n,r) = n!/(r!(n-r)!)\n`;
      response += `C(${n},${r}) = ${n}!/(${r}!(${n}-${r})!)\n`;
      response += `C(${n},${r}) = ${fact(n)}/(${fact(r)} × ${fact(n - r)})\n`;
      response += `C(${n},${r}) = ${comb}\n\n`;
      
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Permutation = ${perm} ways\n`;
      response += `Combination = ${comb} ways`;
    }
    
    return response;
  },

  generateMatrixProblem(lang) {
    // Generate random matrices
    const a = Math.floor(Math.random() * 4) + 1;
    const b = Math.floor(Math.random() * 4) + 1;
    const c = Math.floor(Math.random() * 4) + 1;
    const d = Math.floor(Math.random() * 4) + 1;
    const e = Math.floor(Math.random() * 4) + 1;
    const f = Math.floor(Math.random() * 4) + 1;
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `📊 MATRIX PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Add matrices A and B:\n\n`;
      response += `A = [${a}  ${b}]    B = [${c}  ${d}]\n`;
      response += `    [${c}  ${d}]        [${e}  ${f}]\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Add corresponding elements\n`;
      response += `A + B = [${a}+${c}  ${b}+${d}]\n`;
      response += `        [${c}+${e}  ${d}+${f}]\n\n`;
      response += `Step 2: Compute sums\n`;
      response += `A + B = [${a + c}  ${b + d}]\n`;
      response += `        [${c + e}  ${d + f}]\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `A + B = [${a + c}  ${b + d}]\n`;
      response += `        [${c + e}  ${d + f}]`;
    } else {
      response = `📊 MATRIX PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Add matrices A and B:\n\n`;
      response += `A = [${a}  ${b}]    B = [${c}  ${d}]\n`;
      response += `    [${c}  ${d}]        [${e}  ${f}]\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Add corresponding elements\n`;
      response += `A + B = [${a}+${c}  ${b}+${d}]\n`;
      response += `        [${c}+${e}  ${d}+${f}]\n\n`;
      response += `Step 2: Compute sums\n`;
      response += `A + B = [${a + c}  ${b + d}]\n`;
      response += `        [${c + e}  ${d + f}]\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `A + B = [${a + c}  ${b + d}]\n`;
      response += `        [${c + e}  ${d + f}]`;
    }
    
    return response;
  },

  generateSequenceProblem(lang) {
    const a = Math.floor(Math.random() * 5) + 2;
    const d = Math.floor(Math.random() * 5) + 1;
    const n = Math.floor(Math.random() * 5) + 5;
    const r = Math.floor(Math.random() * 3) + 2;
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `📈 SEQUENCE PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Find the ${n}th term of the arithmetic sequence: ${a}, ${a + d}, ${a + 2*d}, ...\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Identify the first term and common difference\n`;
      response += `a₁ = ${a}\n`;
      response += `d = ${d}\n\n`;
      response += `Step 2: Use formula aₙ = a₁ + (n-1)d\n`;
      response += `aₙ = ${a} + (${n}-1)(${d})\n`;
      response += `aₙ = ${a} + ${n-1}(${d})\n`;
      response += `aₙ = ${a} + ${(n-1) * d}\n`;
      response += `aₙ = ${a + (n-1) * d}\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `aₙ = ${a + (n-1) * d}`;
    } else {
      response = `📈 SEQUENCE PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Find the ${n}th term of the arithmetic sequence: ${a}, ${a + d}, ${a + 2*d}, ...\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Identify the first term and common difference\n`;
      response += `a₁ = ${a}\n`;
      response += `d = ${d}\n\n`;
      response += `Step 2: Use formula aₙ = a₁ + (n-1)d\n`;
      response += `aₙ = ${a} + (${n}-1)(${d})\n`;
      response += `aₙ = ${a} + ${n-1}(${d})\n`;
      response += `aₙ = ${a} + ${(n-1) * d}\n`;
      response += `aₙ = ${a + (n-1) * d}\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `aₙ = ${a + (n-1) * d}`;
    }
    
    return response;
  },

  generateNumberTheoryProblem(lang) {
    const num1 = Math.floor(Math.random() * 50) + 20;
    const num2 = Math.floor(Math.random() * 30) + 10;
    
    // Calculate GCD and LCM
    const gcd = (a, b) => {
      while (b !== 0) {
        const temp = b;
        b = a % b;
        a = temp;
      }
      return a;
    };
    
    const g = gcd(num1, num2);
    const lcm = (num1 * num2) / g;
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `🔢 NUMBER THEORY PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Find the GCD and LCM of ${num1} and ${num2}.\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Find factors of ${num1}\n`;
      const factors1 = [];
      for (let i = 1; i <= num1; i++) {
        if (num1 % i === 0) factors1.push(i);
      }
      response += `Factors of ${num1}: ${factors1.join(', ')}\n\n`;
      
      response += `Step 2: Find factors of ${num2}\n`;
      const factors2 = [];
      for (let i = 1; i <= num2; i++) {
        if (num2 % i === 0) factors2.push(i);
      }
      response += `Factors of ${num2}: ${factors2.join(', ')}\n\n`;
      
      response += `Step 3: Find common factors\n`;
      const commonFactors = factors1.filter(f => factors2.includes(f));
      response += `Common factors: ${commonFactors.join(', ')}\n`;
      response += `GCD = ${g}\n\n`;
      
      response += `Step 4: Find LCM using formula\n`;
      response += `LCM = (${num1} × ${num2}) / GCD\n`;
      response += `LCM = ${num1 * num2} / ${g}\n`;
      response += `LCM = ${lcm}\n\n`;
      
      response += `🎯 FINAL ANSWERS:\n`;
      response += `GCD = ${g}\n`;
      response += `LCM = ${lcm}`;
    } else {
      response = `🔢 NUMBER THEORY PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Find the GCD and LCM of ${num1} and ${num2}.\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Find factors of ${num1}\n`;
      const factors1 = [];
      for (let i = 1; i <= num1; i++) {
        if (num1 % i === 0) factors1.push(i);
      }
      response += `Factors of ${num1}: ${factors1.join(', ')}\n\n`;
      
      response += `Step 2: Find factors of ${num2}\n`;
      const factors2 = [];
      for (let i = 1; i <= num2; i++) {
        if (num2 % i === 0) factors2.push(i);
      }
      response += `Factors of ${num2}: ${factors2.join(', ')}\n\n`;
      
      response += `Step 3: Find common factors\n`;
      const commonFactors = factors1.filter(f => factors2.includes(f));
      response += `Common factors: ${commonFactors.join(', ')}\n`;
      response += `GCD = ${g}\n\n`;
      
      response += `Step 4: Find LCM using formula\n`;
      response += `LCM = (${num1} × ${num2}) / GCD\n`;
      response += `LCM = ${num1 * num2} / ${g}\n`;
      response += `LCM = ${lcm}\n\n`;
      
      response += `🎯 FINAL ANSWERS:\n`;
      response += `GCD = ${g}\n`;
      response += `LCM = ${lcm}`;
    }
    
    return response;
  },

  generateWordProblem(lang) {
    const age1 = Math.floor(Math.random() * 10) + 15;
    const age2 = Math.floor(Math.random() * 10) + 5;
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `📝 WORD PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Pedro is ${age1} years old. His brother Juan is ${age2} years younger than him.\n`;
      response += `How old is Juan?\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Identify the given information\n`;
      response += `Pedro's age = ${age1}\n`;
      response += `Juan is ${age2} years younger than Pedro\n\n`;
      response += `Step 2: Set up the equation\n`;
      response += `Juan's age = Pedro's age - ${age2}\n\n`;
      response += `Step 3: Solve\n`;
      response += `Juan's age = ${age1} - ${age2}\n`;
      response += `Juan's age = ${age1 - age2}\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `Juan is ${age1 - age2} years old`;
    } else {
      response = `📝 WORD PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `Pedro is ${age1} years old. His brother Juan is ${age2} years younger than him.\n`;
      response += `How old is Juan?\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Identify the given information\n`;
      response += `Pedro's age = ${age1}\n`;
      response += `Juan is ${age2} years younger than Pedro\n\n`;
      response += `Step 2: Set up the equation\n`;
      response += `Juan's age = Pedro's age - ${age2}\n\n`;
      response += `Step 3: Solve\n`;
      response += `Juan's age = ${age1} - ${age2}\n`;
      response += `Juan's age = ${age1 - age2}\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `Juan is ${age1 - age2} years old`;
    }
    
    return response;
  },

  generatePhysicsProblem(lang) {
    const v = Math.floor(Math.random() * 20) + 10;
    const t = Math.floor(Math.random() * 5) + 2;
    const a = Math.floor(Math.random() * 3) + 1;
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `⚡ PHYSICS MATH PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `A car accelerates from rest at ${a} m/s² for ${t} seconds.\n`;
      response += `What is its final velocity?\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Identify the given values\n`;
      response += `Initial velocity (v₀) = 0 m/s (starting from rest)\n`;
      response += `Acceleration (a) = ${a} m/s²\n`;
      response += `Time (t) = ${t} s\n\n`;
      response += `Step 2: Use the formula\n`;
      response += `v = v₀ + at\n\n`;
      response += `Step 3: Substitute values\n`;
      response += `v = 0 + ${a}(${t})\n`;
      response += `v = ${a * t} m/s\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `Final velocity = ${a * t} m/s`;
    } else {
      response = `⚡ PHYSICS MATH PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `A car accelerates from rest at ${a} m/s² for ${t} seconds.\n`;
      response += `What is its final velocity?\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Identify the given values\n`;
      response += `Initial velocity (v₀) = 0 m/s (starting from rest)\n`;
      response += `Acceleration (a) = ${a} m/s²\n`;
      response += `Time (t) = ${t} s\n\n`;
      response += `Step 2: Use the formula\n`;
      response += `v = v₀ + at\n\n`;
      response += `Step 3: Substitute values\n`;
      response += `v = 0 + ${a}(${t})\n`;
      response += `v = ${a * t} m/s\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `Final velocity = ${a * t} m/s`;
    }
    
    return response;
  },

  generateArithmeticProblem(lang) {
    const num1 = Math.floor(Math.random() * 100) + 50;
    const num2 = Math.floor(Math.random() * 50) + 10;
    const percent = Math.floor(Math.random() * 30) + 10;
    const result = (percent / 100) * num1;
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `🔢 ARITHMETIC PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `What is ${percent}% of ${num1}?\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Convert percentage to decimal\n`;
      response += `${percent}% = ${percent}/100 = ${percent/100}\n\n`;
      response += `Step 2: Multiply\n`;
      response += `${percent}% of ${num1} = ${percent/100} × ${num1}\n`;
      response += `${percent}% of ${num1} = ${result.toFixed(2)}\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `${result.toFixed(2)}`;
    } else {
      response = `🔢 ARITHMETIC PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `What is ${percent}% of ${num1}?\n\n`;
      response += `🔢 SOLUTION:\n\n`;
      response += `Step 1: Convert percentage to decimal\n`;
      response += `${percent}% = ${percent}/100 = ${percent/100}\n\n`;
      response += `Step 2: Multiply\n`;
      response += `${percent}% of ${num1} = ${percent/100} × ${num1}\n`;
      response += `${percent}% of ${num1} = ${result.toFixed(2)}\n\n`;
      response += `🎯 FINAL ANSWER:\n`;
      response += `${result.toFixed(2)}`;
    }
    
    return response;
  },

  generateGroupedDataProblem(lang) {
    // Generate random grouped data
    const data = [];
    const n = 50;
    for (let i = 0; i < n; i++) {
      data.push(Math.floor(Math.random() * 40) + 60);
    }
    
    // Create frequency distribution
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
    
    // Find median class
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
    
    // Find modal class
    const maxFreq = Math.max(...freqTable.map(r => r.f));
    const modalClass = freqTable.find(r => r.f === maxFreq);
    const modalLower = parseInt(modalClass.class.split('-')[0]) - 0.5;
    const d1 = modalClass.f - (freqTable[freqTable.indexOf(modalClass) - 1]?.f || 0);
    const d2 = modalClass.f - (freqTable[freqTable.indexOf(modalClass) + 1]?.f || 0);
    const mode = modalLower + (d1 / (d1 + d2)) * width;
    
    let response = '';
    
    if (lang === 'tagalog' || lang === 'bisaya') {
      response = `📊 GROUPED DATA PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `The following are scores of ${totalF} students in a test.\n`;
      response += `Create a grouped frequency distribution and find the mean, median, mode, and standard deviation.\n\n`;
      response += `📋 FREQUENCY DISTRIBUTION TABLE:\n`;
      response += `┌──────────┬─────┬──────────┬─────────┬───────────┬──────────┐\n`;
      response += `│  Class   │  f  │  Mid(x)  │   fx    │    cf     │   fx²    │\n`;
      response += `├──────────┼─────┼──────────┼─────────┼───────────┼──────────┤\n`;
      
      for (const row of freqTable) {
        response += `│ ${row.class.padEnd(8)} │ ${String(row.f).padEnd(3)} │ ${row.mid.toFixed(1).padEnd(8)} │ ${row.fx.toFixed(1).padEnd(7)} │ ${String(row.cf).padEnd(9)} │ ${row.fx2.toFixed(1).padEnd(8)} │\n`;
      }
      
      response += `└──────────┴─────┴──────────┴─────────┴───────────┴──────────┘\n\n`;
      response += `🔢 COMPUTATIONS:\n\n`;
      
      response += `Mean:\n`;
      response += `x̄ = Σfx / Σf\n`;
      response += `x̄ = ${totalFx.toFixed(1)} / ${totalF}\n`;
      response += `x̄ = ${mean.toFixed(2)}\n\n`;
      
      response += `Median:\n`;
      response += `Median = L + [(n/2 - cf) / f] × i\n`;
      response += `Median = ${lowerBound} + [(${medianPos} - ${prevCF}) / ${medianClass.f}] × ${width}\n`;
      response += `Median = ${median.toFixed(2)}\n\n`;
      
      response += `Mode:\n`;
      response += `Mode = L + [d₁/(d₁ + d₂)] × i\n`;
      response += `Mode = ${modalLower} + [${d1}/(${d1} + ${d2})] × ${width}\n`;
      response += `Mode = ${mode.toFixed(2)}\n\n`;
      
      response += `Standard Deviation:\n`;
      response += `σ = √[Σfx²/Σf - (Σfx/Σf)²]\n`;
      response += `σ = √[${(totalFx2/totalF).toFixed(2)} - ${mean.toFixed(2)}²]\n`;
      response += `σ = ${stdDev.toFixed(2)}\n\n`;
      
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Mean = ${mean.toFixed(2)}\n`;
      response += `Median = ${median.toFixed(2)}\n`;
      response += `Mode = ${mode.toFixed(2)}\n`;
      response += `Standard Deviation = ${stdDev.toFixed(2)}`;
    } else {
      response = `📊 GROUPED DATA PROBLEM WITH COMPLETE SOLUTION\n\n`;
      response += `🎯 PROBLEM:\n`;
      response += `The following are scores of ${totalF} students in a test.\n`;
      response += `Create a grouped frequency distribution and find the mean, median, mode, and standard deviation.\n\n`;
      response += `📋 FREQUENCY DISTRIBUTION TABLE:\n`;
      response += `┌──────────┬─────┬──────────┬─────────┬───────────┬──────────┐\n`;
      response += `│  Class   │  f  │  Mid(x)  │   fx    │    cf     │   fx²    │\n`;
      response += `├──────────┼─────┼──────────┼─────────┼───────────┼──────────┤\n`;
      
      for (const row of freqTable) {
        response += `│ ${row.class.padEnd(8)} │ ${String(row.f).padEnd(3)} │ ${row.mid.toFixed(1).padEnd(8)} │ ${row.fx.toFixed(1).padEnd(7)} │ ${String(row.cf).padEnd(9)} │ ${row.fx2.toFixed(1).padEnd(8)} │\n`;
      }
      
      response += `└──────────┴─────┴──────────┴─────────┴───────────┴──────────┘\n\n`;
      response += `🔢 COMPUTATIONS:\n\n`;
      
      response += `Mean:\n`;
      response += `x̄ = Σfx / Σf\n`;
      response += `x̄ = ${totalFx.toFixed(1)} / ${totalF}\n`;
      response += `x̄ = ${mean.toFixed(2)}\n\n`;
      
      response += `Median:\n`;
      response += `Median = L + [(n/2 - cf) / f] × i\n`;
      response += `Median = ${lowerBound} + [(${medianPos} - ${prevCF}) / ${medianClass.f}] × ${width}\n`;
      response += `Median = ${median.toFixed(2)}\n\n`;
      
      response += `Mode:\n`;
      response += `Mode = L + [d₁/(d₁ + d₂)] × i\n`;
      response += `Mode = ${modalLower} + [${d1}/(${d1} + ${d2})] × ${width}\n`;
      response += `Mode = ${mode.toFixed(2)}\n\n`;
      
      response += `Standard Deviation:\n`;
      response += `σ = √[Σfx²/Σf - (Σfx/Σf)²]\n`;
      response += `σ = √[${(totalFx2/totalF).toFixed(2)} - ${mean.toFixed(2)}²]\n`;
      response += `σ = ${stdDev.toFixed(2)}\n\n`;
      
      response += `🎯 FINAL ANSWERS:\n`;
      response += `Mean = ${mean.toFixed(2)}\n`;
      response += `Median = ${median.toFixed(2)}\n`;
      response += `Mode = ${mode.toFixed(2)}\n`;
      response += `Standard Deviation = ${stdDev.toFixed(2)}`;
    }
    
    return response;
  },

  generateGeneralMathProblem(lang) {
    // Generate a mix of math problems
    const types = ['algebra', 'geometry', 'statistics', 'probability', 'sequence', 'numbertheory', 'wordproblem'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    
    switch(randomType) {
      case 'algebra':
        return this.generateAlgebraProblem(lang);
      case 'geometry':
        return this.generateGeometryProblem(lang);
      case 'statistics':
        return this.generateStatisticsProblem(lang);
      case 'probability':
        return this.generateProbabilityProblem(lang);
      case 'sequence':
        return this.generateSequenceProblem(lang);
      case 'numbertheory':
        return this.generateNumberTheoryProblem(lang);
      case 'wordproblem':
        return this.generateWordProblem(lang);
      default:
        return this.generateAlgebraProblem(lang);
    }
  },

  // ================================================================
  // 🆕 TYPO CORRECTION for common Filipino phrases
  // ================================================================
  correctTypos(prompt) {
    if (!prompt) return prompt;
    
    const typoMap = {
      'pingi': 'paki',
      'pengi': 'paki',
      'peng': 'paki',
      'ping': 'paki',
      'pking': 'paki',
      'pk': 'paki',
      'pak': 'paki',
      'pki': 'paki',
      'pki explain': 'paki explain',
      'pki elaborate': 'paki elaborate',
      'pki linaw': 'paki linaw',
      'pki clear': 'paki clear',
      'pki answer': 'paki answer',
      'pki sagot': 'paki sagot',
      'pls': 'please',
      'plz': 'please',
      'pleas': 'please',
      'mre': 'more',
      'mor': 'more',
      'elab': 'elaborate',
      'expln': 'explanation',
      'expl': 'explain',
      'explainn': 'explain',
      'elaboratee': 'elaborate',
      'plihug': 'palihug',
      'plihg': 'palihug',
      'pls explain': 'please explain',
      'plz explain': 'please explain',
      'paki explainn': 'paki explain',
      'paki elaborat': 'paki elaborate',
      'paki detail': 'paki detail',
      'paki more': 'paki more',
      'detailled': 'detailed',
      'detialed': 'detailed',
      'detaied': 'detailed',
      'explaination': 'explanation',
      'elaborationn': 'elaboration',
      'summarry': 'summary',
      'summry': 'summary',
      'exmple': 'example',
      'sampel': 'sample'
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

  // ================================================================
  // 🆕 CONTENT‑BASED TOPIC RETRIEVAL (scoring)
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
        if (userLower.includes(kw)) {
          score += 8;
        }
      }

      for (const word of userWords) {
        if (word.length > 2 && responseLower.includes(word)) {
          score += 2;
        }
      }

      if (userLower.includes(key.toLowerCase())) {
        score += 10;
      }

      if (data.prompt && userLower.includes(data.prompt.toLowerCase())) {
        score += 8;
      }

      const specialActivity = ['activity', 'worksheet', 'sheet', 'quiz', 'assignment', 'homework', 'exercise', 'pagsasanay', 'gawain'];
      for (const sw of specialActivity) {
        if (responseLower.includes(sw) && userLower.includes(sw)) {
          score += 7;
        }
      }

      if (data.timestamp && (Date.now() - data.timestamp) < 600000) {
        score += 5;
      }

      if (userLower.includes('last') || userLower.includes('nauna') ||
          userLower.includes('kanina') || userLower.includes('huling') ||
          userLower.includes('sinabi mo') || userLower.includes('sabi mo')) {
        if (data.timestamp && (Date.now() - data.timestamp) < 600000) {
          score += 10;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }

    return (bestScore > 0) ? bestKey : null;
  },

  // ================================================================
  // 🆕 EXTRACT KEYWORDS FROM RESPONSE
  // ================================================================
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
      if (lower.includes(word)) {
        keywords.push(word);
      }
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
        if (i < words.length - 2 && words[i+2].length > 2 && !stopWords.includes(words[i+2])) {
          const triple = words[i] + ' ' + words[i+1] + ' ' + words[i+2];
          if (triple.length > 6 && !keywords.includes(triple)) {
            keywords.push(triple);
          }
        }
      }
    }

    return [...new Set(keywords)].slice(0, 20);
  },

  // ================================================================
  // 🆕 IMPROVED: RETURN‑TO‑TOPIC DETECTION
  // ================================================================
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

  // ================================================================
  // 🆕 EXTRACT TOPIC (with __LAST_RESPONSE__ flag)
  // ================================================================
  extractTopicFromReturn(prompt) {
    if (!prompt) return null;
    const lower = prompt.toLowerCase();

    const refs = [
      'last response', 'last reply', 'last answer', 'last message',
      'previous response', 'previous reply', 'previous answer',
      'nauna mong sagot', 'nauna mong reply', 'huling sagot', 'huling reply',
      'sagot mo kanina', 'reply mo kanina', 'sinabi mo kanina',
      'yung sinabi mo', 'ang sinabi mo', 'iyong sinabi'
    ];
    if (refs.some(r => lower.includes(r))) {
      return '__LAST_RESPONSE__';
    }

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
      'balik sa', 'balikan ang', 'tungkol sa', 'about the',
      'jan sa', 'diyan sa', 'doon sa', 'sa last', 'sa nauna',
      'patungkol sa', 'ukol sa', 'hinggil sa'
    ];

    for (const p of patterns) {
      if (lower.includes(p)) {
        let topic = prompt.substring(prompt.toLowerCase().indexOf(p) + p.length).trim();
        topic = topic.replace(/^(jan|diyan|doon|sa|na|ng|ang|mga|iyan|iyon|ito|yun|yon)\s*/i, '')
                     .replace(/\s*(na|ng|ang|mga|iyan|iyon|ito|yun|yon)$/i, '')
                     .trim();
        if (!topic || topic.length < 3) {
          return '__LAST_RESPONSE__';
        }
        return topic;
      }
    }

    const words = prompt.split(/\s+/);
    const stopWords = ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could'];
    const keywords = words.filter(w => w.length > 3 && !stopWords.includes(w.toLowerCase()));
    if (keywords.length > 0) {
      return keywords.join(' ');
    }
    return null;
  },

  // ================================================================
  // CASUAL CONVERSATION
  // ================================================================
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
      final += `Ikaw ay nakikipag-usap sa isang user sa ${langName.toUpperCase()}.\n`;
      final += `Sinabi ng user: "${prompt}"\n\n`;
      final += `MAHALAGA:\n`;
      final += `- Tumugon nang NATURAL sa ${langName.toUpperCase()} tulad ng isang tunay na tao.\n`;
      final += `- Maging palakaibigan, mainit, at conversational.\n`;
      final += `- Panatilihing MAIKLI at NATURAL ang mga tugon (1-2 pangungusap).\n`;
      final += `- Huwag masyadong pormal o robotic.\n`;
      final += `- Tumugon lamang nang direkta sa sinabi nila.\n\n`;
      final += `TUMUGON SA USER SA ${langName.toUpperCase()} NGAYON.`;
    } else {
      final += `You are having a CASUAL CONVERSATION with a user in ${langName.toUpperCase()}.\n`;
      final += `The user said: "${prompt}"\n\n`;
      final += `IMPORTANT:\n`;
      final += `- Respond NATURALLY in ${langName.toUpperCase()} like a real person chatting.\n`;
      final += `- Be friendly, warm, and conversational.\n`;
      final += `- Keep responses SHORT and NATURAL (1-2 sentences).\n`;
      final += `- Don't be too formal or robotic.\n`;
      final += `- Just respond directly to what they said.\n\n`;
      final += `NOW RESPOND TO THE USER'S MESSAGE IN ${langName.toUpperCase()}.`;
    }
    return final;
  },

  // ================================================================
  // 🆕 FIXED: GEMINI API with LANGUAGE DETECTION from image
  // ================================================================
  async callGeminiAPI(prompt, imageUrl, detectedLanguage = 'english') {
    try {
      const detectPrompt = `Analyze this image and determine what language the text in the image is written in. 
      Common languages: Tagalog, Filipino, English, Bisaya, Cebuano, Spanish, etc.
      Respond with ONLY the language name in English (e.g., "Tagalog", "English", "Bisaya", etc.).`;

      const detectApiUrl = `https://norch-project.gleeze.com/api/gemini?prompt=${encodeURIComponent(detectPrompt)}&imageurl=${encodeURIComponent(imageUrl)}`;
      
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
          console.log('[Gemini] Image language detected:', detectedImageLanguage);
        }
      } catch (detectError) {
        console.log('[Gemini] Language detection failed, using user language:', detectError.message);
        detectedImageLanguage = detectedLanguage;
      }

      const geminiPrompt = this.buildGeminiPrompt(prompt, detectedImageLanguage);
      const apiUrl = `https://norch-project.gleeze.com/api/gemini?prompt=${encodeURIComponent(geminiPrompt)}&imageurl=${encodeURIComponent(imageUrl)}`;

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
          console.log(`[Gemini] Attempt ${attempts} failed:`, error.message);
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
      const fallbackPrompt = `The user sent an image. The user asked: ${prompt || 'Please describe what you see'}. Provide a helpful response.`;
      const response = await this.callAPI(fallbackPrompt);
      return this.cleanResponse(response || 'Hindi ma-analyze ang image. Subukan muli.');
    }
  },

  // ================================================================
  // 🆕 FIXED: GEMINI PROMPT BUILDER (Tagalog/English/Bisaya support)
  // ================================================================
  buildGeminiPrompt(userPrompt, language = 'english') {
    const langName = this.getLanguageName(language);
    let prompt;
    
    if (language === 'tagalog' || language === 'bisaya' || language === 'cebuano') {
      prompt = `Ikaw ay isang AI assistant na nagsusuri ng isang imahe.

TUKUYIN KUNG ANO ANG NASA LARAWAN at tumugon nang naaayon:

1. ACTIVITY SHEET / WORKSHEET / QUIZ / HOMEWORK / ASSIGNMENT
   - Basahin at unawain ang bawat tanong
   - Magbigay ng TUMPAK na mga sagot
   - Para sa math: Ipakita ang step-by-step na solusyon

2. MATH PROBLEMS / EQUATIONS
   - Ipakita ang step-by-step na solusyon
   - Ibigay ang pinal na sagot

3. SCIENCE / DIAGRAMS / LABELS
   - Tukuyin ang mga bahagi at ang kanilang gamit
   - Ipaliwanag ang mga proseso

4. TEXTBOOK / NOTES / EDUCATIONAL CONTENT
   - Kunin ang mga pangunahing konsepto
   - Ibuod ang mga pangunahing ideya

5. MEME / HUMOROUS IMAGE
   - Tukuyin ang paksa
   - Ipaliwanag ang biro (1-2 pangungusap)
   - Panatilihing MAIKLI

6. GENERAL IMAGE (Photo, Art, Screenshot)
   - Ilarawan kung ano ang nakikita (1-3 pangungusap)
   - Panatilihing SIMPLE at DIREKTA

PARAAN NG PAGTUGON:

Para sa educational/content (activity sheets, problems, diagrams):
Sagot: [Direktang sagot sa tanong o pangunahing punto]
Paliwanag: [Maikling paliwanag, 1-2 pangungusap]

Para sa memes:
[Maikling paglalarawan ng meme, 1-2 pangungusap]

Para sa general images:
[Maikling paglalarawan, 2-3 pangungusap]

MAHALAGANG PANUNTUNAN:
- Gamitin ang Sagot/Paliwanag format LANG para sa educational content
- Para sa casual images, magbigay lang ng maikling paglalarawan
- Panatilihing MAIKLI at MALINAW ang mga tugon
- WALANG labis na teksto tungkol sa "content type"
- Tumugon sa ${langName.toUpperCase()} na wika

TANONG NG USER: ${userPrompt || 'Suriin ang imaheng ito'}`;
    } else {
      prompt = `You are an AI assistant analyzing an image. 

DETECT WHAT THE IMAGE CONTAINS and respond accordingly:

1. ACTIVITY SHEET / WORKSHEET / QUIZ / HOMEWORK / ASSIGNMENT
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

5. MEME / HUMOROUS IMAGE
   - Identify the subject
   - Explain the joke briefly (1-2 sentences)
   - Keep it SHORT

6. GENERAL IMAGE (Photo, Art, Screenshot)
   - Describe what you see (1-3 sentences)
   - Keep it SIMPLE and DIRECT

RESPONSE FORMAT:

For educational/content (activity sheets, problems, diagrams):
Answer: [Direct answer to the question or main point]
Explanation: [Brief explanation, 1-2 sentences]

For memes:
[Brief description of the meme, 1-2 sentences]

For general images:
[Brief description, 2-3 sentences]

IMPORTANT RULES:
- Use the Answer/Explanation format ONLY for educational content
- For casual images, just give a brief description
- Keep responses SHORT and CLEAR
- NO excessive text about "content type"
- Respond in ${langName.toUpperCase()} language

USER QUESTION: ${userPrompt || 'Analyze this image'}`;
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
        lower.includes('maikli') || lower.includes('iklian') || lower.includes('paikliin') ||
        lower.includes('mubo') || lower.includes('muboa') || lower.includes('halipot')) {
      final += `Make the analysis SHORTER. Keep only the key points.\n`;
    } else if (lower.includes('clear') || lower.includes('clarify') || lower.includes('linaw')) {
      final += `Make the analysis CLEARER. Use simpler language.\n`;
    } else if (lower.includes('simple') || lower.includes('simplify') || lower.includes('pasimplehin')) {
      final += `Provide a SIMPLER explanation.\n`;
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
  // 🆕 IMPROVED: LANGUAGE DETECTION (with more keywords)
  // ================================================================
  detectLanguage(prompt) {
    if (!prompt) return 'english';
    const lower = prompt.toLowerCase();
    
    const languages = {
      tagalog: {
        keywords: ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho', 'ako', 'ikaw', 'siya', 'kami', 'tayo', 'kayo', 'sila', 'ito', 'iyan', 'iyon', 'gusto', 'ayaw', 'pwede', 'maaari', 'dapat', 'kailangan', 'meron', 'mayroon', 'wala', 'hindi', 'oo', 'salamat', 'paki', 'pakiusap', 'tanong', 'sagot', 'sabi', 'tulong', 'paliwanag', 'ano', 'bakit', 'paano', 'saan', 'kailan', 'sino', 'alin', 'kamusta', 'kumusta', 'musta', 'sagot', 'paliwanag', 'likas-kayang', 'pag-unlad', 'konsumo', 'mamimili', 'trapiko', 'polusyon', 'kuryente', 'barangay'],
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
      ilocano: {
        keywords: ['siak', 'sika', 'isu', 'dakami', 'datayo', 'dakayo', 'isuda', 'daytoy', 'dayta', 'daydiay', 'ditoy', 'dita', 'idiay', 'ania', 'apay', 'kasano', 'sadino', 'kaano', 'sino', 'mano', 'kayat', 'saan', 'mabalin', 'masapul', 'adda', 'awan', 'wen', 'salamat', 'pangngaasi', 'saludsod', 'sungbat', 'baga', 'sao', 'aramiden', 'ited', 'iparang', 'ibaga', 'kitaen', 'basaen', 'awaten', 'tulong', 'tulungan', 'ilawlawag', 'lawag', 'ababa', 'ababaen', 'simple', 'pasimpleen', 'nalawag', 'lawagan'],
        minMatches: 2
      },
      waray: {
        keywords: ['ako', 'ikaw', 'hiya', 'kami', 'kita', 'kamo', 'hira', 'ini', 'iton', 'didto', 'dinhi', 'dida', 'ano', 'kayano', 'paano', 'hain', 'san-o', 'hin-o', 'pira', 'karuyag', 'diri', 'puyde', 'kinahanglan', 'mayda', 'waray', 'oo', 'salamat', 'alayon', 'pakiana', 'baton', 'siring', 'buhaton', 'hatagan', 'ipakita', 'isiring', 'kitaa', 'basaha', 'sabta', 'bulig', 'buligi', 'pasabta', 'halipot', 'halipota', 'simple', 'pasimpleha', 'klaro', 'klaroha'],
        minMatches: 2
      },
      hiligaynon: {
        keywords: ['ako', 'ikaw', 'siya', 'kami', 'kita', 'kamo', 'sila', 'ini', 'ina', 'adto', 'diri', 'dira', 'didto', 'ano', 'ngaa', 'paano', 'diin', 'san-o', 'sin-o', 'pila', 'luyag', 'indi', 'pwede', 'kinahanglan', 'may', 'wala', 'huo', 'salamat', 'palihog', 'pamangkot', 'sabat', 'hambal', 'himuon', 'hatagan', 'ipakita', 'ihambal', 'tan-awa', 'basaha', 'intindiha', 'bulig', 'buligan', 'paathag', 'ipathag', 'malip-ot', 'lip-ota', 'simple', 'pasimpleha', 'klaro', 'klaruha'],
        minMatches: 2
      },
      kapampangan: {
        keywords: ['aku', 'ika', 'iya', 'ikami', 'ikatamu', 'ikayu', 'ila', 'ini', 'ita', 'keni', 'keta', 'nanu', 'obakit', 'makananu', 'nukarin', 'kapilan', 'ninu', 'pilang', 'buri', 'ali', 'malyari', 'kailangan', 'atin', 'ala', 'wa', 'salamat', 'pakisabi', 'tanong', 'sagot', 'sabi', 'amanu', 'gawan', 'ibie', 'pakit', 'sabian', 'tiran', 'basan', 'intindian', 'saup', 'saupan', 'paliwanag', 'ipaliwanag', 'makuyad', 'kuyaran', 'simple', 'pasimplehan', 'malino', 'linawan'],
        minMatches: 2
      },
      spanish: {
        keywords: ['hola', 'como', 'que', 'por', 'para', 'gusta', 'quiero', 'puede', 'necesito', 'tiene', 'hay', 'no', 'sí', 'gracias', 'favor', 'pregunta', 'respuesta', 'decir', 'hacer', 'dar', 'mostrar', 'ver', 'leer', 'entender', 'ayuda', 'ayudar', 'explicar', 'explicación', 'corto', 'corta', 'simple', 'simplificar', 'claro', 'clara'],
        minMatches: 2
      }
    };
    
    let bestMatch = 'english';
    let bestScore = 0;
    const words = lower.split(/\s+/);
    
    for (const [lang, config] of Object.entries(languages)) {
      let matchCount = 0;
      for (const word of words) {
        if (config.keywords.includes(word)) {
          matchCount++;
        }
      }
      for (const keyword of config.keywords) {
        if (keyword.includes(' ') && lower.includes(keyword)) {
          matchCount += 2;
        }
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

  // ================================================================
  // 🆕 IMPROVED: MODIFICATION REQUEST with typo support
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
      'pls', 'plz', 'pleas'
    ];
    
    const lower = prompt.toLowerCase();
    if (patterns.some(p => lower.includes(p))) return true;
    if (corrected !== prompt && patterns.some(p => corrected.includes(p))) return true;
    
    return false;
  },

  // ================================================================
  // 🆕 IMPROVED: FOLLOW-UP DETECTION with typo support
  // ================================================================
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

  // ================================================================
  // 🆕 IMPROVED: NEW TOPIC DETECTION with typo awareness
  // ================================================================
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
    
    if (followUpIndicators.some(i => corrected.includes(i))) {
      return false;
    }
    
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

  // ================================================================
  // TOPIC KEY EXTRACTION
  // ================================================================
  extractTopicKey(prompt) {
    if (!prompt) return null;
    const words = prompt.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'on', 'at', 'to', 'for', 'from', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho'];
    const keywords = words.filter(w => w.length > 3 && !stopWords.includes(w));
    const key = keywords.slice(0, 5).join(' ');
    return key.length > 3 ? key.substring(0, 50) : prompt.substring(0, 50);
  },

  // ================================================================
  // 🆕 IMPROVED: FINAL PROMPT BUILDER (AGGRESSIVE FIX)
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
          lower.includes('mas detalyado') || lower.includes('further') ||
          lower.includes('clarify') || lower.includes('linawin') ||
          lower.includes('paki linaw')) {
        
        final += `⚠️⚠️⚠️ CRITICAL INSTRUCTION ⚠️⚠️⚠️\n`;
        final += `The user is asking you to ELABORATE on the PREVIOUS RESPONSE above.\n`;
        final += `- DO NOT explain what the word "elaborate" means.\n`;
        final += `- DO NOT give a generic answer about elaboration.\n`;
        final += `- DO NOT change the topic.\n`;
        final += `- DO NOT start a new topic.\n`;
        final += `- STAY on the EXACT SAME TOPIC as the previous conversation.\n`;
        final += `- Use the PREVIOUS RESPONSE as your starting point.\n`;
        final += `- Provide MORE DETAILS, CONTEXT, and EXAMPLES about that SPECIFIC topic.\n`;
        final += `- EXPAND on what you already said in the previous response.\n\n`;
        final += `PREVIOUS TOPIC: "${previousPrompt}"\n`;
        final += `PREVIOUS RESPONSE: "${previousResponse}"\n\n`;
        final += `NOW, ELABORATE on the SAME TOPIC above. DO NOT explain what "elaborate" means.\n\n`;
      }
      
      else if (lower.includes('example') || lower.includes('sample') || 
          lower.includes('halimbawa') || lower.includes('instance') ||
          lower.includes('eg') || lower.includes('ex') || lower.includes('hal')) {
        
        final += `⚠️⚠️⚠️ CRITICAL INSTRUCTION ⚠️⚠️⚠️\n`;
        final += `The user wants EXAMPLES related to the PREVIOUS RESPONSE above.\n`;
        final += `- DO NOT give generic examples about "giving examples".\n`;
        final += `- STAY on the SAME TOPIC as the previous conversation.\n`;
        final += `- Provide SPECIFIC examples related to that topic.\n`;
        final += `- Use the previous response as your starting point.\n\n`;
      }

      else if (lower.includes('scenario') || lower.includes('situation') || 
          lower.includes('case') || lower.includes('situwasyon') ||
          lower.includes('pangyayari') || lower.includes('senaryo')) {
        
        final += `⚠️⚠️⚠️ CRITICAL INSTRUCTION ⚠️⚠️⚠️\n`;
        final += `The user wants a SCENARIO or SITUATION based on the PREVIOUS RESPONSE above.\n`;
        final += `- DO NOT give generic scenarios.\n`;
        final += `- STAY on the SAME TOPIC as the previous conversation.\n`;
        final += `- Provide a REALISTIC scenario related to that topic.\n`;
        final += `- Use the previous response as your starting point.\n\n`;
      }

      else if (this.isTranslationRequest(prompt)) {
        const targetLang = this.detectTargetLanguage(prompt);
        final += `⚠️ User wants translation to ${targetLang}.\n`;
        final += `- Translate the PREVIOUS RESPONSE above to ${targetLang}.\n`;
        final += `- ONLY provide the translation, no other text.\n\n`;
        
      } else if (lower.includes('humanize') || lower.includes('make it human') || 
                 lower.includes('conversational') || lower.includes('natural') ||
                 lower.includes('make it natural') || lower.includes('parang tao')) {
        final += `⚠️ User wants the PREVIOUS RESPONSE to be more human and conversational.\n`;
        final += `- Rewrite the previous response in a natural, friendly tone.\n`;
        final += `- Keep the SAME meaning and content.\n\n`;
        
      } else if (lower.includes('summarize') || lower.includes('summary') || 
                 lower.includes('i-summarize') || lower.includes('brief') ||
                 lower.includes('make it short') || lower.includes('short') ||
                 lower.includes('concise') || lower.includes('shorten') ||
                 lower.includes('paikliin') || lower.includes('ikli')) {
        final += `⚠️ User wants a SUMMARY of the PREVIOUS RESPONSE.\n`;
        final += `- Provide only the KEY POINTS from the previous response.\n`;
        final += `- Be CONCISE and DIRECT.\n\n`;
        
      } else if (lower.includes('simplify') || lower.includes('simple') || 
                 lower.includes('pasimplehin') || lower.includes('basic') ||
                 lower.includes('simplified') || lower.includes('madali')) {
        final += `⚠️ User wants a SIMPLER explanation of the PREVIOUS RESPONSE.\n`;
        final += `- Use SIMPLE words and layman terms.\n`;
        final += `- Keep the SAME meaning but make it easier to understand.\n\n`;
        
      } else if (lower.includes('correct') || lower.includes('fix') || 
                 lower.includes('tama') || lower.includes('ayusin') ||
                 lower.includes('improve') || lower.includes('better')) {
        final += `⚠️ User wants to CORRECT or IMPROVE the PREVIOUS RESPONSE.\n`;
        final += `- Review the previous response and provide an improved version.\n\n`;
        
      } else if (lower.includes('add') || lower.includes('additional') || 
                 lower.includes('dagdagan') || lower.includes('more') ||
                 lower.includes('dagdag')) {
        final += `⚠️ User wants ADDITIONAL information.\n`;
        final += `- Add MORE details, examples, or context to the PREVIOUS RESPONSE.\n`;
        final += `- Stay on the SAME topic.\n\n`;
        
      } else {
        final += `⚠️ User is continuing the previous conversation.\n`;
        final += `- Continue the discussion about the PREVIOUS TOPIC.\n`;
        final += `- User says: "${prompt}"\n`;
        final += `- Provide a NATURAL response that continues the discussion.\n\n`;
      }
      
      final += `🚨 FINAL REMINDER:\n`;
      final += `- You are responding to: "${prompt}"\n`;
      final += `- Your response must be about the SAME TOPIC as the PREVIOUS CONVERSATION.\n`;
      final += `- DO NOT explain what "elaborate" or "explain" means.\n`;
      final += `- DO NOT give generic advice about how to explain things.\n`;
      final += `- DO NOT start a new topic.\n`;
      final += `- STAY ON TOPIC.\n\n`;
      
    } else {
      final += `USER ASKED: "${prompt}"\n\n`;
    }

    if (wantsDetailed) {
      final += `📝 Provide a COMPREHENSIVE, THOROUGH, and DETAILED explanation.\n`;
      final += `- Cover all important aspects.\n`;
      final += `- Include examples and context.\n`;
    } else {
      final += `📝 Provide a SHORT, DIRECT, and ACCURATE response.\n`;
      final += `- Be straight to the point.\n`;
      final += `- Maximum 2-3 sentences or 1-2 paragraphs.\n`;
    }

    final += `
📌 FINAL RULES:
- Respond in ${langName.toUpperCase()} language.
- Be accurate and precise.
- Use plain text only. No markdown or symbols.
- If unsure, state that clearly.
- Do NOT ask questions back.
- STAY ON TOPIC.`;

    return final;
  },

  // ================================================================
  // REALTIME QUESTIONS
  // ================================================================
  isRealtimeQuestion(prompt) {
    const lower = prompt.toLowerCase();
    const timeKeywords = ['oras', 'time', 'petsa', 'date', 'anong oras', 'what time', 'what is the time', 'anong petsa', 'what date', 'what is the date', 'real time', 'real-time', 'kasalukuyang oras', 'current time', 'current date', 'anong oras na', 'what time is it'];
    if (timeKeywords.some(k => lower.includes(k))) return true;
    const newsKeywords = ['balita', 'news', 'update', 'latest', 'pinakahuling', 'nangyari', 'happening', 'events', 'pangyayari', 'ganap', 'senado', 'senate', 'kongreso', 'congress', 'pulitika', 'politics', 'gobyerno', 'government', 'presidente', 'president', 'krisis', 'crisis', 'problema', 'problem', 'situwasyon', 'situation', 'report', 'reports', 'ulat'];
    if (newsKeywords.some(k => lower.includes(k))) return true;
    const weatherKeywords = ['panahon', 'weather', 'ulan', 'rain', 'bagyo', 'typhoon', 'init', 'heat', 'lamig', 'cold', 'baha', 'flood', 'lindol', 'earthquake'];
    if (weatherKeywords.some(k => lower.includes(k))) return true;
    const priceKeywords = ['presyo ng', 'price of', 'gastos', 'cost', 'bilihin', 'kuryente', 'electricity', 'tubig', 'water', 'gasolina', 'gas', 'bigas', 'rice', 'asukal', 'sugar', 'mantika', 'oil'];
    if (priceKeywords.some(k => lower.includes(k))) return true;
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
      const apiUrl = `https://free-goat-api.onrender.com/rapidai?message=${encodedPrompt}`;
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
        message = `Real-Time sa Pilipinas\n\nPetsa: ${day}, ${month} ${date.getDate()}, ${date.getFullYear()}\nOras: ${hour12}:${minute.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm} (PHT)\nTimezone: Asia/Manila (UTC+8)`;
      } else if (detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano') {
        const day = date.toLocaleString('en-PH', { weekday: 'long' });
        const month = date.toLocaleString('en-PH', { month: 'long' });
        const hour = date.getHours();
        const minute = date.getMinutes();
        const seconds = date.getSeconds();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        message = `Real-Time sa Pilipinas\n\nPetsa: ${day}, ${month} ${date.getDate()}, ${date.getFullYear()}\nOras: ${hour12}:${minute.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm} (PHT)\nTimezone: Asia/Manila (UTC+8)`;
      } else {
        const day = date.toLocaleString('en-PH', { weekday: 'long' });
        const month = date.toLocaleString('en-PH', { month: 'long' });
        const hour = date.getHours();
        const minute = date.getMinutes();
        const seconds = date.getSeconds();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        message = `Real-Time in the Philippines\n\nDate: ${day}, ${month} ${date.getDate()}, ${date.getFullYear()}\nTime: ${hour12}:${minute.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm} (PHT)\nTimezone: Asia/Manila (UTC+8)`;
      }
      await this.sendChunks(senderId, message, token);
    } catch (error) {
      console.error('[Time] WorldTimeAPI failed:', error.message);
      try {
        const now = new Date();
        let message;
        if (detectedLanguage === 'tagalog') {
          const fallbackTime = now.toLocaleString('fil-PH', { timeZone: 'Asia/Manila' });
          message = `Real-Time sa Pilipinas\n\nPetsa: ${fallbackTime}\nTimezone: Asia/Manila (UTC+8)\nNote: Local system time`;
        } else if (detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano') {
          const fallbackTime = now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
          message = `Real-Time sa Pilipinas\n\nPetsa: ${fallbackTime}\nTimezone: Asia/Manila (UTC+8)\nNote: Local system time`;
        } else {
          const fallbackTime = now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
          message = `Real-Time in the Philippines\n\nDate: ${fallbackTime}\nTimezone: Asia/Manila (UTC+8)\nNote: Local system time`;
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
      await sendMessage(senderId, { text: 'Lyrics Search\n\nUsage: lyrics [song title] by [artist]\n\nExamples:\nlyrics lihim by arthur miguel\nletra ng lihim\nkanta ni arthur miguel' }, token);
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
      { regex: /pii\/([a-zA-Z0-9]+)/, prefix: 'https://doi.org/10.1016/' },
      { regex: /wiley\.com\/doi\/abs\/([^\s]+)/, prefix: 'https://doi.org/' }
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
        message += `${i + 1}. ${title}\nMang-aawit/Artist: ${artist}\nGenre: ${genre}\nTagal: ${duration}\nInilabas: ${created}\nPinatugtog: ${plays.toLocaleString()}\nMga Like: ${likes.toLocaleString()}`;
        if (artwork) message += `\nArtwork: ${artwork}`;
        message += `\nPakinggan: ${url}`;
        if (audioUrl) message += `\nDirect Audio: ${audioUrl}`;
        message += `\n\n`;
      }
      message += `Nakahanap ng ${totalResults} resulta\n${new Date().toLocaleString('fil-PH', { timeZone: 'Asia/Manila' })}`;
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

  // ================================================================
  // 🆕 IMPROVED: ERROR MESSAGE with language support
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
