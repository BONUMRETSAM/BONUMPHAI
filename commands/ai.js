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

      // Fix typos
      const correctedPrompt = this.correctTypos(prompt);
      if (correctedPrompt !== prompt) {
        prompt = correctedPrompt;
      }

      // Detect language
      const detectedLanguage = this.detectLanguage(prompt);
      const isCasualConversation = this.isCasualConversation(prompt);

      // Check if this is a math problem
      const isMath = this.isMathProblem(prompt);
      const isExampleReq = this.isExampleRequest(prompt);

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

      // ===== RETURN TO TOPIC =====
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
          text: 'Hello! Ako si Teacher Arlene - Multi-Modal AI.\n\nMga Kakayahan:\nText conversations\nImage analysis\nAcademic research\nImage generation\nMusic search\nLyrics search\nMath problem solving with step-by-step solutions\nReal-life situations\nTranslation\nSummarization\n\nMga Commands:\nai [tanong]\nMag-send ng image para ma-analyze\ngenerate [search term] [number]\ngscholar [search query]\nplay [song title]\nlyrics [song title] by [artist]\n\nKaya kong makipag-usap sa Tagalog, Bisaya, English, at iba pang wika.'
        }, token);
        return;
      }

      // ===== OWNER QUESTION =====
      if (this.isOwnerQuestion(prompt)) {
        const lang = this.getLanguageName(detectedLanguage);
        const response = lang === 'Tagalog' ? 'Ako ay ginawa ni GeoDevz69. Bisitahin dito para sa karagdagang impormasyon:\nhttps://www.facebook.com/geotechph.net' :
                          lang === 'Bisaya' ? 'Ako gihimo ni GeoDevz69. Bisitaha diri para sa dugang impormasyon:\nhttps://www.facebook.com/geotechph.net' :
                          'I was created by GeoDevz69. Visit here for more information:\nhttps://www.facebook.com/geotechph.net';
        await sendMessage(senderId, { text: response }, token);
        return;
      }

      // ===== USER INFO =====
      if (this.isUserInfoQuestion(prompt)) {
        await this.handleUserInfo(senderId, prompt, token);
        return;
      }

      const wantsDetailed = this.wantsDetailedAnswer(prompt);
      let aiResponse = '';

      // ===== IMAGE ANALYSIS =====
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
      // ===== MATH PROBLEMS =====
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
      // ===== REPLY / FOLLOW-UP =====
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
      // ===== NEW CONVERSATION =====
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

  // ========== TYPO CORRECTION ==========
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

  // ========== MATH DETECTION ==========
  isMathProblem(prompt) {
    if (!prompt) return false;
    
    const lower = prompt.toLowerCase();
    
    const mathPatterns = [
      // Basic Arithmetic
      /\d+\s*[\+\-\*\/\×\÷]\s*\d+/,
      /\d+\s*\+\s*\d+/,
      /\d+\s*\-\s*\d+/,
      /\d+\s*\*\s*\d+/,
      /\d+\s*\/\s*\d+/,
      /addition/i, /subtraction/i, /multiplication/i, /division/i,
      /arithmetic/i, /fraction/i, /decimal/i, /percentage/i, /percent/i,
      /add/i, /subtract/i, /multiply/i, /divide/i,
      
      // Algebra
      /solve\s+for\s+[a-z]/i,
      /find\s+[a-z]/i,
      /[a-z]\s*=\s*[\d\s\+\-\*\/]+/i,
      /equation/i, /linear\s+equation/i, /quadratic/i,
      /polynomial/i, /simplify/i, /factor/i, /expand/i,
      /algebra/i, /variable/i, /expression/i,
      /inequality/i, /system\s+of\s+equations/i,
      
      // Geometry
      /area\s+of/i, /perimeter\s+of/i, /volume\s+of/i,
      /circumference/i, /triangle/i, /rectangle/i,
      /circle/i, /square/i, /angle/i, /geometry/i,
      /pythagorean/i, /theorem/i, /coordinate/i,
      /slope/i, /distance\s+formula/i, /midpoint/i,
      
      // Trigonometry
      /trigonometry/i, /sine/i, /cosine/i, /tangent/i,
      /sin/i, /cos/i, /tan/i, /angle\s+of\s+elevation/i,
      /angle\s+of\s+depression/i, /right\s+triangle/i,
      
      // Calculus
      /calculus/i, /derivative/i, /integral/i,
      /differentiation/i, /integration/i, /limit/i,
      /function/i, /domain/i,
      
      // Statistics
      /statistics/i, /probability/i, /mean/i, /median/i,
      /mode/i, /standard\s+deviation/i, /variance/i,
      /range/i, /quartile/i, /decile/i, /percentile/i,
      /frequency\s+distribution/i, /grouped\s+data/i,
      /ungrouped\s+data/i, /data\s+set/i, /dataset/i,
      /correlation/i, /regression/i, /hypothesis/i,
      /normal\s+distribution/i, /z-score/i, /t-test/i,
      
      // Word Problems
      /word\s+problem/i, /math\s+problem/i, /worded\s+problem/i,
      /problem\s+solving/i,
      
      // Filipino math terms
      /math/i, /matematika/i, /sagutin/i, /kompyut/i,
      /solve/i, /sulbad/i, /kuwenta/i, /kwenta/i,
      /tuos/i, /ihap/i, /bilang/i, /halimbawa/i,
      
      // Specific math topics
      /number\s+theory/i, /set\s+theory/i, /logic/i,
      /matrix/i, /matrices/i, /determinant/i,
      /vector/i, /sequence/i, /series/i,
      /combination/i, /permutation/i, /binomial/i,
      /logarithm/i, /exponent/i, /radical/i,
      /absolute\s+value/i, /graph/i, /plot/i,
      
      // Financial Math
      /interest/i, /compound\s+interest/i, /simple\s+interest/i,
      /annuity/i, /amortization/i, /investment/i,
      /loan/i, /mortgage/i, /depreciation/i,
      
      // Measurement
      /conversion/i, /convert/i, /unit/i,
      /kilometer/i, /meter/i, /centimeter/i,
      /kilogram/i, /gram/i, /liter/i,
      /measurement/i, /distance/i, /weight/i, /mass/i,
      
      // Additional topics
      /combinatorics/i, /factorial/i,
      /conic/i, /parabola/i, /ellipse/i, /hyperbola/i,
      /complex\s+number/i, /imaginary/i,
      /differential\s+equation/i,
      /optimization/i, /maximization/i, /minimization/i
    ];
    
    return mathPatterns.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(prompt);
      }
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
      'sample problems', 'example problem', 'example problems',
      'worked example', 'worked examples', 'demonstrate',
      'show me how', 'how to solve', 'can you show',
      'example with solution', 'examples with solutions',
      'give me sample', 'provide sample', 'show sample',
      'halimbawa', 'mga halimbawa', 'magbigay ng halimbawa',
      'pananglitan', 'mga pananglitan'
    ];
    
    return exampleKeywords.some(keyword => lower.includes(keyword));
  },

  detectMathTopic(prompt) {
    if (!prompt) return 'general';
    
    const lower = prompt.toLowerCase();
    
    const topics = {
      arithmetic: [
        'addition', 'subtraction', 'multiplication', 'division',
        'add', 'subtract', 'multiply', 'divide', 'plus', 'minus',
        'times', 'sum', 'difference', 'product', 'quotient',
        'fraction', 'fractions', 'decimal', 'decimals',
        'percentage', 'percent', 'ratio', 'proportion',
        'arithmetic', 'basic math', 'basic operations'
      ],
      algebra: [
        'algebra', 'equation', 'equations', 'linear equation',
        'quadratic equation', 'polynomial', 'simplify', 'factor',
        'expand', 'variable', 'variables', 'expression',
        'inequality', 'system of equations', 'solve for',
        'find x', 'find y', 'linear', 'quadratic'
      ],
      geometry: [
        'geometry', 'area', 'perimeter', 'volume', 'circumference',
        'triangle', 'rectangle', 'square', 'circle', 'angle',
        'length', 'width', 'height', 'radius', 'diameter',
        'surface area', 'polygon', 'pythagorean', 'coordinate',
        'slope', 'distance formula', 'midpoint'
      ],
      trigonometry: [
        'trigonometry', 'sine', 'cosine', 'tangent', 'sin', 'cos', 'tan',
        'angle of elevation', 'angle of depression', 'right triangle',
        'trigonometric', 'unit circle', 'radian', 'degree'
      ],
      calculus: [
        'calculus', 'derivative', 'derivatives', 'integral', 'integrals',
        'differentiation', 'integration', 'limit', 'limits',
        'function', 'functions', 'domain', 'continuity',
        'differential', 'antiderivative', 'rate of change',
        'optimization', 'related rates'
      ],
      statistics: [
        'statistics', 'probability', 'mean', 'median', 'mode',
        'standard deviation', 'variance', 'range', 'quartile',
        'decile', 'percentile', 'frequency distribution',
        'grouped data', 'ungrouped data', 'data set', 'dataset',
        'correlation', 'regression', 'hypothesis',
        'normal distribution', 'z-score', 't-test',
        'central tendency', 'dispersion', 'histogram'
      ],
      numberTheory: [
        'number theory', 'prime number', 'composite',
        'factor', 'factors', 'multiple', 'multiples',
        'gcd', 'lcm', 'divisibility', 'integer'
      ],
      financialMath: [
        'interest', 'compound interest', 'simple interest',
        'annuity', 'amortization', 'investment', 'loan',
        'mortgage', 'depreciation', 'principal', 'rate',
        'profit', 'loss', 'discount', 'commission', 'tax'
      ],
      measurement: [
        'conversion', 'convert', 'unit', 'units',
        'kilometer', 'meter', 'centimeter', 'kilogram',
        'gram', 'liter', 'measurement', 'distance',
        'weight', 'mass', 'temperature'
      ],
      setTheory: [
        'set theory', 'set', 'sets', 'subset', 'union',
        'intersection', 'complement', 'venn diagram',
        'universal set', 'empty set'
      ],
      matrices: [
        'matrix', 'matrices', 'determinant', 'vector',
        'eigenvalue', 'eigenvector', 'transpose',
        'inverse matrix', 'dot product', 'cross product'
      ],
      sequences: [
        'sequence', 'sequences', 'series',
        'arithmetic sequence', 'geometric sequence',
        'convergent', 'divergent', 'summation',
        'sigma notation', 'pattern', 'nth term'
      ],
      combinatorics: [
        'combination', 'combinations', 'permutation',
        'permutations', 'binomial theorem', 'factorial',
        'counting', 'arrangement', 'selection'
      ],
      logarithms: [
        'logarithm', 'logarithms', 'log', 'ln',
        'exponent', 'exponents', 'exponential',
        'radical', 'root', 'square root', 'cube root'
      ]
    };
    
    for (const [topic, keywords] of Object.entries(topics)) {
      if (keywords.some(keyword => lower.includes(keyword))) {
        return topic;
      }
    }
    
    return 'general';
  },

  getTopicSpecificInstructions(topic, language) {
    const isTagalog = language === 'tagalog' || language === 'bisaya' || language === 'cebuano';
    
    const instructions = {
      arithmetic: {
        english: 'Focus ONLY on basic arithmetic operations. Show each operation step clearly. For word problems, identify the operation needed first.',
        tagalog: 'Tumutok LAMANG sa basic arithmetic operations. Ipakita ang bawat operation nang malinaw. Para sa word problems, tukuyin muna ang operation na kailangan.'
      },
      algebra: {
        english: 'Focus ONLY on algebraic concepts. Show each algebraic manipulation step. Explain the rules of algebra being applied.',
        tagalog: 'Tumutok LAMANG sa algebraic concepts. Ipakita ang bawat algebraic manipulation step. Ipaliwanag ang rules ng algebra na ginagamit.'
      },
      geometry: {
        english: 'Focus ONLY on geometric concepts. Identify the shape first. Show the correct formula. Include units in all measurements.',
        tagalog: 'Tumutok LAMANG sa geometric concepts. Tukuyin muna ang shape. Ipakita ang tamang formula. Isama ang units sa lahat ng measurements.'
      },
      trigonometry: {
        english: 'Focus ONLY on trigonometric concepts. Identify the triangle type first. Show which trigonometric ratio to use.',
        tagalog: 'Tumutok LAMANG sa trigonometric concepts. Tukuyin muna ang triangle type. Ipakita kung aling trigonometric ratio ang gagamitin.'
      },
      calculus: {
        english: 'Focus ONLY on calculus concepts. Show each calculus operation step. Explain the rules being applied.',
        tagalog: 'Tumutok LAMANG sa calculus concepts. Ipakita ang bawat calculus operation step. Ipaliwanag ang rules na ginagamit.'
      },
      statistics: {
        english: 'Focus ONLY on statistical concepts. Identify the data type first. Show the correct formula. Organize data in tables when applicable.',
        tagalog: 'Tumutok LAMANG sa statistical concepts. Tukuyin muna ang data type. Ipakita ang tamang formula. I-organize ang data sa tables when applicable.'
      },
      numberTheory: {
        english: 'Focus ONLY on number theory concepts. Show the factorization process. Explain the properties of numbers being used.',
        tagalog: 'Tumutok LAMANG sa number theory concepts. Ipakita ang factorization process. Ipaliwanag ang properties ng numbers na ginagamit.'
      },
      financialMath: {
        english: 'Focus ONLY on financial math concepts. Identify the financial problem type. Show the correct formula. Use realistic monetary values.',
        tagalog: 'Tumutok LAMANG sa financial math concepts. Tukuyin ang financial problem type. Ipakita ang tamang formula. Gumamit ng realistic monetary values.'
      },
      measurement: {
        english: 'Focus ONLY on measurement and conversion concepts. Show the conversion factor clearly. Include units throughout.',
        tagalog: 'Tumutok LAMANG sa measurement at conversion concepts. Ipakita ang conversion factor nang malinaw. Isama ang units sa buong calculation.'
      },
      setTheory: {
        english: 'Focus ONLY on set theory concepts. Define the sets clearly. Show set operations using proper notation.',
        tagalog: 'Tumutok LAMANG sa set theory concepts. I-define ang sets nang malinaw. Ipakita ang set operations gamit ang proper notation.'
      },
      matrices: {
        english: 'Focus ONLY on matrix operations. Write matrices in proper notation. Show each operation step.',
        tagalog: 'Tumutok LAMANG sa matrix operations. Isulat ang matrices sa proper notation. Ipakita ang bawat operation step.'
      },
      sequences: {
        english: 'Focus ONLY on sequences and series. Identify the sequence type first. Show the nth term formula.',
        tagalog: 'Tumutok LAMANG sa sequences at series. Tukuyin muna ang sequence type. Ipakita ang nth term formula.'
      },
      combinatorics: {
        english: 'Focus ONLY on permutations and combinations. Identify if order matters. Show the correct formula.',
        tagalog: 'Tumutok LAMANG sa permutations at combinations. Tukuyin kung order matters. Ipakita ang tamang formula.'
      },
      logarithms: {
        english: 'Focus ONLY on logarithms and exponents. Show the logarithm properties. Explain the relationship between logs and exponents.',
        tagalog: 'Tumutok LAMANG sa logarithms at exponents. Ipakita ang logarithm properties. Ipaliwanag ang relationship ng logs at exponents.'
      },
      general: {
        english: 'Focus on the specific mathematical concept being asked. Show each step clearly. Explain the reasoning.',
        tagalog: 'Tumutok sa specific mathematical concept na tinatanong. Ipakita ang bawat step nang malinaw. Ipaliwanag ang reasoning.'
      }
    };
    
    const topicInstructions = instructions[topic] || instructions.general;
    return isTagalog ? topicInstructions.tagalog : topicInstructions.english;
  },

  buildMathSolutionPrompt(prompt, language) {
    const langName = this.getLanguageName(language);
    const topic = this.detectMathTopic(prompt);
    const wantsExamples = this.isExampleRequest(prompt);
    const topicInstructions = this.getTopicSpecificInstructions(topic, language);
    
    const isTagalog = language === 'tagalog' || language === 'bisaya' || language === 'cebuano';
    
    let final = '';
    
    if (isTagalog) {
      final += `IKAW AY ISANG MATH TUTOR NA EKSPERTO SA ${topic.toUpperCase()}.\n\n`;
      final += `TANONG NG USER: "${prompt}"\n\n`;
      final += `MAHALAGANG INSTRUKSYON:\n${topicInstructions}\n\n`;
      
      if (wantsExamples) {
        final += `MAGBIGAY NG MGA HALIMBAWA NA TUNGKOL LAMANG SA ${topic.toUpperCase()}.\n`;
        final += `HUWAG magbigay ng halimbawa mula sa ibang topic.\n`;
        final += `Kung grouped data ang hinihingi, grouped data LANG ang ibigay.\n`;
        final += `Kung arithmetic ang hinihingi, arithmetic LANG ang ibigay.\n\n`;
        final += `MAGBIGAY NG 2-3 HALIMBAWA na may:\n`;
        final += `1. Ang problema\n`;
        final += `2. Ang mga given values\n`;
        final += `3. Ang pormula (kung applicable)\n`;
        final += `4. Hakbang-hakbang na solusyon\n`;
        final += `5. Ang pinal na sagot\n\n`;
      } else {
        final += `MAGBIGAY NG KUMPLETONG SOLUSYON na may:\n`;
        final += `1. Hakbang-hakbang na solusyon\n`;
        final += `2. Paliwanag sa bawat hakbang\n`;
        final += `3. Lahat ng kalkulasyon\n`;
        final += `4. Pinal na sagot\n\n`;
      }
      
      final += `FORMAT (WALANG EMOJIS AT WALANG MAKAKAPAL NA LINYA):\n`;
      final += `Problema: [Ang problema]\n\n`;
      final += `Datos: [Ang mga given values]\n\n`;
      if (topic !== 'arithmetic') {
        final += `Pormula: [Ang pormula na ginamit]\n\n`;
      }
      final += `Hakbang-hakbang na Solusyon:\n`;
      final += `Hakbang 1: [Unang hakbang]\n`;
      final += `Paliwanag: [Bakit ginawa ito]\n`;
      final += `Kalkulasyon: [Ang kalkulasyon]\n\n`;
      final += `Hakbang 2: [Pangalawang hakbang]\n`;
      final += `Paliwanag: [Bakit ginawa ito]\n`;
      final += `Kalkulasyon: [Ang kalkulasyon]\n\n`;
      final += `Hakbang 3: [Pangatlong hakbang]\n`;
      final += `Paliwanag: [Bakit ginawa ito]\n`;
      final += `Kalkulasyon: [Ang kalkulasyon]\n\n`;
      final += `Pinal na Sagot: [Ang sagot na may tamang unit]\n\n`;
      final += `MAHALAGA: Tumugon LAMANG tungkol sa ${topic.toUpperCase()}. WALANG ibang topic.\n`;
      final += `Tumugon sa ${langName.toUpperCase()}.\n`;
      
    } else {
      final += `YOU ARE A MATH TUTOR SPECIALIZING IN ${topic.toUpperCase()}.\n\n`;
      final += `USER QUESTION: "${prompt}"\n\n`;
      final += `IMPORTANT INSTRUCTIONS:\n${topicInstructions}\n\n`;
      
      if (wantsExamples) {
        final += `PROVIDE EXAMPLES ONLY ABOUT ${topic.toUpperCase()}.\n`;
        final += `DO NOT provide examples from other topics.\n`;
        final += `If grouped data is requested, provide ONLY grouped data examples.\n`;
        final += `If arithmetic is requested, provide ONLY arithmetic examples.\n\n`;
        final += `PROVIDE 2-3 EXAMPLES with:\n`;
        final += `1. The problem\n`;
        final += `2. The given values\n`;
        final += `3. The formula (if applicable)\n`;
        final += `4. Step-by-step solution\n`;
        final += `5. The final answer\n\n`;
      } else {
        final += `PROVIDE COMPLETE SOLUTION with:\n`;
        final += `1. Step-by-step solution\n`;
        final += `2. Explanation for each step\n`;
        final += `3. All calculations\n`;
        final += `4. Final answer\n\n`;
      }
      
      final += `FORMAT (NO EMOJIS AND NO THICK LINES):\n`;
      final += `Problem: [The problem]\n\n`;
      final += `Data: [The given values]\n\n`;
      if (topic !== 'arithmetic') {
        final += `Formula: [The formula used]\n\n`;
      }
      final += `Step-by-step Solution:\n`;
      final += `Step 1: [First step]\n`;
      final += `Explanation: [Why this is done]\n`;
      final += `Calculation: [The calculation]\n\n`;
      final += `Step 2: [Second step]\n`;
      final += `Explanation: [Why this is done]\n`;
      final += `Calculation: [The calculation]\n\n`;
      final += `Step 3: [Third step]\n`;
      final += `Explanation: [Why this is done]\n`;
      final += `Calculation: [The calculation]\n\n`;
      final += `Final Answer: [The answer with correct unit]\n\n`;
      final += `IMPORTANT: Respond ONLY about ${topic.toUpperCase()}. NO other topics.\n`;
      final += `Respond in ${langName.toUpperCase()}.\n`;
    }
    
    return final;
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

      if (data.timestamp && (Date.now() - data.timestamp) < 600000) {
        score += 5;
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

  // ========== LANGUAGE DETECTION ==========
  detectLanguage(prompt) {
    if (!prompt) return 'english';
    const lower = prompt.toLowerCase();
    
    const languages = {
      tagalog: {
        keywords: ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho', 'ako', 'ikaw', 'siya', 'kami', 'tayo', 'kayo', 'sila', 'ito', 'iyan', 'iyon', 'gusto', 'ayaw', 'pwede', 'maaari', 'dapat', 'kailangan', 'meron', 'mayroon', 'wala', 'hindi', 'oo', 'salamat', 'paki', 'pakiusap', 'tanong', 'sagot', 'sabi', 'tulong', 'paliwanag', 'ano', 'bakit', 'paano', 'saan', 'kailan', 'sino', 'alin', 'kamusta', 'kumusta', 'halimbawa'],
        minMatches: 2
      },
      bisaya: {
        keywords: ['ako', 'ikaw', 'siya', 'kami', 'kita', 'kamo', 'sila', 'kini', 'kana', 'kadto', 'dinhi', 'diha', 'didto', 'unsa', 'ngano', 'giunsa', 'asa', 'kanus-a', 'kinsa', 'pila', 'gusto', 'ayaw', 'pwede', 'mahimo', 'kinahanglan', 'naa', 'wala', 'dili', 'oo', 'salamat', 'palihug', 'pangutana', 'tubag', 'sulti', 'buhaton', 'hatagan', 'ipakita', 'isulti', 'tan-awa', 'basaha', 'sabta', 'tabang', 'tabangi', 'pasabta', 'pasabton', 'pananglitan'],
        minMatches: 2
      },
      cebuano: {
        keywords: ['ako', 'ikaw', 'siya', 'kami', 'kita', 'kamo', 'sila', 'kini', 'kana', 'kadto', 'dinhi', 'diha', 'didto', 'unsa', 'ngano', 'giunsa', 'asa', 'kanus-a', 'kinsa', 'pila', 'gusto', 'ayaw', 'pwede', 'mahimo', 'kinahanglan', 'naa', 'wala', 'dili', 'oo', 'salamat', 'palihug', 'pangutana', 'tubag', 'sulti', 'buhaton', 'hatagan', 'ipakita', 'isulti', 'tan-awa', 'basaha', 'sabta', 'tabang', 'tabangi', 'pasabta', 'pasabton', 'pananglitan'],
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

  // ========== CASUAL CONVERSATION ==========
  isCasualConversation(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    const casualPatterns = [
      'kamusta', 'kumusta', 'musta', 'kamusta ka', 'kumusta ka',
      'ano ginagawa mo', 'anong ginagawa mo', 'ano gawa mo',
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

  // ========== IMAGE ANALYSIS ==========
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
          } else {
            detectedImageLanguage = 'english';
          }
        }
      } catch (detectError) {
        console.log('[Gemini] Language detection failed:', detectError.message);
      }

      const geminiPrompt = this.buildGeminiPrompt(prompt, detectedImageLanguage);
      const apiUrl = `https://norch-project.gleeze.com/api/gemini?prompt=${encodeURIComponent(geminiPrompt)}&imageurl=${encodeURIComponent(imageUrl)}`;

      const response = await axios.get(apiUrl, {
        timeout: 90000,
        headers: { 'Accept': 'application/json' }
      });

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
        lower.includes('maikli') || lower.includes('iklian') || lower.includes('paikliin')) {
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

  // ========== MODIFICATION & FOLLOW-UP ==========
  isModificationRequest(prompt) {
    const patterns = [
      'make it short', 'make it shorter', 'make it concise', 'make it brief',
      'make it simple', 'make it simpler', 'make it clear', 'make it clearer',
      'shorten it', 'simplify it', 'clarify it', 'explain more',
      'explain further', 'elaborate', 'more details', 'more information',
      'tell me more', 'expand', 'summarize', 'summary', 'brief', 'concise',
      'short', 'simple', 'clear', 'detailed', 'detail', 'in depth',
      'thorough', 'comprehensive', 'translate', 'translation',
      'explain', 'explanation', 'can you explain', 'can you clarify',
      'can you elaborate', 'can you simplify', 'can you summarize',
      'paki explain', 'paki linaw', 'paki elaborate', 'paki summarize',
      'paki simplify', 'pakiikli', 'paikliin', 'pasimplehin', 'paliwanag',
      'ipaliwanag', 'ilinaw', 'linawin', 'ikli', 'iklian', 'simplehan',
      'gawing simple', 'gawing maikli', 'gawing malinaw', 'mas detalyado',
      'mas malinaw', 'mas maikli', 'mas simple', 'dagdagan', 'dagdag',
      'karagdagang', 'additional', 'add more', 'more examples',
      'give examples', 'halimbawa', 'example', 'examples', 'sample',
      'pki', 'pls', 'plz'
    ];
    
    const lower = prompt.toLowerCase();
    return patterns.some(p => lower.includes(p));
  },

  isFollowUpRequest(prompt) {
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
      'pki', 'pls', 'plz'
    ];
    
    const lower = prompt.toLowerCase();
    return keywords.some(k => lower.includes(k));
  },

  isNewTopic(prompt, previousPrompt, originalPrompt) {
    if (!previousPrompt) return true;
    
    const corrected = this.correctTypos(prompt);
    const followUpIndicators = [
      'paki', 'please', 'elaborate', 'explain', 'more', 'detail',
      'paliwanag', 'linaw', 'clear', 'example', 'sample',
      'halimbawa', 'summarize', 'summary', 'short', 'simple',
      'translate', 'isalin', 'dagdag', 'add', 'correct', 'fix'
    ];
    
    if (followUpIndicators.some(i => corrected.includes(i))) {
      return false;
    }
    
    const lowerPrompt = prompt.toLowerCase();
    const casualPhrases = ['hahaha', 'haha', 'hehe', 'lol', 'oh', 'ah', 'eh', 'ay', 'ha', 'hmm', 'wow', 'shet', 'gagi', 'lala', 'hala', 'talaga', 'seryoso', 'grabe', 'sus', 'hay', 'ayoko', 'sige', 'cge', 'okay', 'ok', 'ge'];
    if (casualPhrases.some(p => lowerPrompt.includes(p)) && originalPrompt.length < 20) return true;
    
    if (originalPrompt.length < 10 && !this.isFollowUpRequest(prompt)) return true;
    
    const prevWords = previousPrompt.split(' ').filter(w => w.length > 3);
    const currentWords = prompt.split(' ').filter(w => w.length > 3);
    const hasRelatedWords = prevWords.some(w => currentWords.some(cw => cw.includes(w) || w.includes(cw)));
    if (!hasRelatedWords && originalPrompt.length > 5) return true;
    
    return false;
  },

  isContextualQuestion(prompt, previousPrompt) {
    if (!previousPrompt) return false;
    const patterns = ['so yan', 'so ito', 'so iyan', 'so yun', 'so ganyan', 'so ganito', 'so ganun', 'yan na ba', 'yun na ba', 'ito na ba', 'tama ba', 'tama', 'correct', 'right', 'so tungkol', 'so sa', 'so para sa', 'so ibig sabihin', 'so meaning', 'so parang', 'paano naman', 'what about', 'how about', 'paano kung', 'what if', 'bakit', 'why', 'paano', 'how', 'kailan', 'when', 'saan', 'where', 'sino', 'who', 'alin', 'which', 'ano', 'what', 'gets', 'gets ko', 'nagets', 'naintindihan', 'ayun', 'ayon', 'ganun pala', 'ganyan pala', 'so ayun', 'so ayon', 'ok', 'okay', 'sige', 'cge', 'talaga', 'really', 'sure'];
    const isRelated = patterns.some(p => prompt.includes(p));
    const prevWords = previousPrompt.split(' ').filter(w => w.length > 2);
    const currentWords = prompt.split(' ').filter(w => w.length > 2);
    const hasRelated = prevWords.some(w => currentWords.some(c => c.includes(w) || w.includes(c)));
    return isRelated || hasRelated;
  },

  // ========== PROMPT BUILDERS ==========
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
      
      if (lower.includes('elaborate') || lower.includes('explain more') || 
          lower.includes('more explanation') || lower.includes('paliwanag') ||
          lower.includes('detail') || lower.includes('more details') ||
          lower.includes('clarify') || lower.includes('linawin')) {
        
        final += `CRITICAL INSTRUCTION:\n`;
        final += `The user is asking you to ELABORATE on the PREVIOUS RESPONSE above.\n`;
        final += `- DO NOT explain what the word "elaborate" means.\n`;
        final += `- DO NOT change the topic.\n`;
        final += `- STAY on the EXACT SAME TOPIC as the previous conversation.\n`;
        final += `- Provide MORE DETAILS, CONTEXT, and EXAMPLES about that SPECIFIC topic.\n\n`;
      }
      else if (lower.includes('example') || lower.includes('sample') || 
          lower.includes('halimbawa')) {
        
        final += `CRITICAL INSTRUCTION:\n`;
        final += `The user wants EXAMPLES related to the PREVIOUS RESPONSE above.\n`;
        final += `- STAY on the SAME TOPIC as the previous conversation.\n`;
        final += `- Provide SPECIFIC examples related to that topic.\n\n`;
      }
      else if (this.isTranslationRequest(prompt)) {
        const targetLang = this.detectTargetLanguage(prompt);
        final += `User wants translation to ${targetLang}.\n`;
        final += `- Translate the PREVIOUS RESPONSE above to ${targetLang}.\n`;
        final += `- ONLY provide the translation, no other text.\n\n`;
      }
      else if (lower.includes('summarize') || lower.includes('summary') || 
               lower.includes('make it short') || lower.includes('short') ||
               lower.includes('concise')) {
        final += `User wants a SUMMARY of the PREVIOUS RESPONSE.\n`;
        final += `- Provide only the KEY POINTS from the previous response.\n`;
        final += `- Be CONCISE and DIRECT.\n\n`;
      }
      else {
        final += `User is continuing the previous conversation.\n`;
        final += `- Continue the discussion about the PREVIOUS TOPIC.\n`;
        final += `- Provide a NATURAL response that continues the discussion.\n\n`;
      }
      
      final += `FINAL REMINDER:\n`;
      final += `- Your response must be about the SAME TOPIC as the PREVIOUS CONVERSATION.\n`;
      final += `- DO NOT start a new topic.\n`;
      final += `- STAY ON TOPIC.\n\n`;
      
    } else {
      final += `USER ASKED: "${prompt}"\n\n`;
    }

    if (wantsDetailed) {
      final += `Provide a COMPREHENSIVE, THOROUGH, and DETAILED explanation.\n`;
      final += `- Cover all important aspects.\n`;
      final += `- Include examples and context.\n`;
    } else {
      final += `Provide a SHORT, DIRECT, and ACCURATE response.\n`;
      final += `- Be straight to the point.\n`;
      final += `- Maximum 2-3 sentences or 1-2 paragraphs.\n`;
    }

    final += `\nFINAL RULES:\n`;
    final += `- Respond in ${langName.toUpperCase()} language.\n`;
    final += `- Be accurate and precise.\n`;
    final += `- Use plain text only. No markdown or symbols.\n`;
    final += `- If unsure, state that clearly.\n`;
    final += `- Do NOT ask questions back.\n`;
    final += `- STAY ON TOPIC.`;

    return final;
  },

  // ========== REALTIME QUESTIONS ==========
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

  // ========== LYRICS ==========
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

  // ========== IMAGE GENERATION ==========
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
      
      if (allImages.length === 0) {
        await sendMessage(senderId, { text: `Walang nakitang mga larawan para sa "${searchTerm}".` }, token);
        return;
      }
      
      const uniqueImages = [...new Set(allImages)].filter(url => this.isValidUrl(url));
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

  // ========== SCHOLAR ==========
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
        
        if (paper.publication_info?.summary) {
          const summary = paper.publication_info.summary;
          const authorMatch = summary.match(/^([^-]+?)(?=\s*[,-]|\s*$)/);
          if (authorMatch) authors = authorMatch[1].trim();
          const venueMatch = summary.match(/[,-]\s*([^,]+?)(?=\s*[,-]|\s*$)/);
          if (venueMatch) venue = venueMatch[1].trim();
          const yearMatch = summary.match(/\b(19|20)\d{2}\b/);
          if (yearMatch) year = yearMatch[0];
        }
        
        const displayAuthors = this.formatAuthorsDisplay(authors);
        const apaCitation = this.generateAPA(authors, year, title, venue, '', '', '', '', scholarLink);
        const mlaCitation = this.generateMLA(authors, title, venue, year, scholarLink, '', '', '', '');
        
        let message = `${i + 1}. ${title}\n\nMga May-akda: ${displayAuthors}\nNalathala sa: ${venue}\nTaon: ${year}`;
        message += `\nSinipi ng: ${citedBy}`;
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

  // ========== MUSIC ==========
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
        
        message += `${i + 1}. ${title}\nMang-aawit/Artist: ${artist}\nGenre: ${genre}\nTagal: ${duration}\nInilabas: ${created}\nPinatugtog: ${plays.toLocaleString()}\nMga Like: ${likes.toLocaleString()}`;
        if (artwork) message += `\nArtwork: ${artwork}`;
        message += `\nPakinggan: ${url}`;
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

  // ========== API CALLS ==========
  async callAPI(prompt) {
    const primary = {
      url: 'https://api-library-kohi-production.up.railway.app/api/pollination-ai',
      method: 'GET',
      responsePath: 'data',
      successField: 'status',
      timeout: 60000
    };
    
    const fallback = {
      url: 'https://betadash-api-swordslush-production.up.railway.app/opera',
      method: 'GET',
      responsePath: 'message',
      successField: 'success',
      timeout: 30000
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
    let retries = 2;
    let lastError = null;
    
    while (retries > 0) {
      try {
        let response;
        const encoded = encodeURIComponent(prompt);
        const param = config.url.includes('opera') ? 'ask' : 'prompt';
        const url = `${config.url}?${param}=${encoded}`;
        
        response = await axios.get(url, {
          timeout: config.timeout,
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
        
        if (typeof value === 'string' && value.trim()) {
          return value;
        }
        
        throw new Error('Empty response');
      } catch (error) {
        lastError = error;
        retries--;
        if (retries > 0) {
          const delay = error.response?.status === 429 ? 5000 : 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  },

  // ========== MISC HELPERS ==========
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
      .replace(/^(In summary|To summarize|In conclusion|Basically|Essentially|Simply put|In other words|Sa buod|Upang ibuod|Sa konklusyon|Karaniwan|Sa madaling salita|Sa ibang salita)\s*,?\s*/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return concise || text;
  },

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

  cleanOldHistory() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000;
    for (const [userId, data] of Object.entries(conversationHistory)) {
      if (now - data.timestamp > maxAge) delete conversationHistory[userId];
    }
  },

  // ========== USER INFO ==========
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
        response = lang === 'tagalog' ? 'Hindi ko masasabi iyan dahil ito ay kompidensyal.' :
                  lang === 'bisaya' ? 'Dili nako masulti kana kay kompidensyal.' :
                  'I cannot say that because it is confidential.';
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

  // ========== TRANSLATION ==========
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
      'chinese': 'Chinese', 'mandarin': 'Mandarin',
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
      const response = await this.callAPI(translatePrompt);
      return response || text;
    } catch (error) {
      console.error('[Translation] Failed:', error.message);
      return text;
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

  getErrorMessage(error, detectedLanguage = 'english') {
    if (error.code === 'ECONNABORTED') {
      return detectedLanguage === 'tagalog' ? 'Nag-timeout ang request. Subukan muli.' :
             detectedLanguage === 'bisaya' ? 'Nag-timeout ang request. Sulayi pag-usab.' :
             'Request timed out. Please try again.';
    }
    if (error.response?.status === 429) {
      return detectedLanguage === 'tagalog' ? 'Naabot ang rate limit. Maghintay sandali.' :
             detectedLanguage === 'bisaya' ? 'Naabot ang rate limit. Paghulat ug balik.' :
             'Rate limit reached. Please wait.';
    }
    if (error.response?.status === 403) {
      return detectedLanguage === 'tagalog' ? 'Hindi valid o expired ang API key.' :
             detectedLanguage === 'bisaya' ? 'Dili valid o expired ang API key.' :
             'Invalid or expired API key.';
    }
    if (error.response?.status >= 500) {
      return detectedLanguage === 'tagalog' ? 'Server error. Subukan muli mamaya.' :
             detectedLanguage === 'bisaya' ? 'Server error. Sulayi pag-usab.' :
             'Server error. Please try again later.';
    }
    return detectedLanguage === 'tagalog' ? 'Error sa pagproseso ng request. Subukan muli.' :
           detectedLanguage === 'bisaya' ? 'Error sa pagproseso sa request. Sulayi pag-usab.' :
           'Error processing request. Please try again.';
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
