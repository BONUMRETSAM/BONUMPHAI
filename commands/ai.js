const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const MAX_CHUNK = 1900;
const conversationHistory = {};

module.exports = {
  name: ['ai', 'opera', 'ask', 'gemini', 'vision'],
  description: 'Multi-modal AI with text, image analysis, and conversational memory',
  usage: 'ai [message] or send/reply to image',
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

      
      if (event?.message?.reply_to?.mid) {
        isReply = true;
        const replyData = await this.getRepliedMessageData(event.message.reply_to.mid, token);
        previousResponse = replyData.message;
        imageUrl = replyData.imageUrl;
        if (!prompt) {
          prompt = 'Please respond to what I said.';
        }
      }

      
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
        if (imageUrl && !prompt) {
          prompt = 'Analyze this image.';
        }
      }

      
      if (!isReply && prompt) {
        const history = conversationHistory[senderId];
        if (history && history.lastResponse) {
          const lowerPrompt = prompt.toLowerCase();
          const isFollowUp = this.isFollowUpRequest(lowerPrompt) || 
                            this.isContextualQuestion(lowerPrompt, history.lastPrompt);
          const isNewTopic = this.isNewTopic(lowerPrompt, history.lastPrompt);
          
          if (isFollowUp && !isNewTopic) {
            previousResponse = history.lastResponse;
            previousPrompt = history.lastPrompt;
            isReply = true;
          } else {
            delete conversationHistory[senderId];
          }
        }
      }

      
      if (!prompt && !isReply && !imageUrl) {
        await sendMessage(senderId, {
          text: 'Hello! I am Teacher Arlene - Multi-Modal AI.\n\nCapabilities:\n• Text conversations\n• Image analysis\n• Translation\n• Summarization\n\nCommands:\n• ai [question]\n• Send an image for analysis\n• Reply to an image for analysis'
        }, token);
        return;
      }

      
      if (this.isOwnerQuestion(prompt)) {
        await sendMessage(senderId, {
          text: 'I was created by GeoDevz69. Visit here for more clarifications:\nhttps://www.facebook.com/geotechph.net'
        }, token);
        return;
      }

      
      if (this.isUserInfoQuestion(prompt)) {
        await this.handleUserInfo(senderId, prompt, token);
        return;
      }

      const wantsDetailed = this.wantsDetailedAnswer(prompt);
      let aiResponse = '';

      
      if (imageUrl) {
        aiResponse = await this.callGeminiAPI(prompt, imageUrl);
      } else {
        
        const finalPrompt = this.buildFinalPrompt(prompt, previousResponse, previousPrompt, isReply, wantsDetailed);
        const response = await this.callAPI(finalPrompt, senderId);
        aiResponse = this.cleanResponse(response || 'No response from API.');
      }

      
      if (!imageUrl && !isReply && !wantsDetailed) {
        aiResponse = this.shortenResponse(aiResponse);
      }

      
      conversationHistory[senderId] = {
        lastPrompt: prompt,
        lastResponse: aiResponse,
        timestamp: Date.now()
      };

      this.cleanOldHistory();

      
      if (isReply && this.isTranslationRequest(prompt)) {
        const targetLanguage = this.detectTargetLanguage(prompt);
        aiResponse = await this.translateResponse(aiResponse, targetLanguage);
      }

      await this.sendChunks(senderId, aiResponse, token);

    } catch (error) {
      console.error('[ai] Error:', error.message);
      await sendMessage(senderId, { text: this.getErrorMessage(error) }, token);
    }
  },



  async callGeminiAPI(prompt, imageUrl) {
    try {
      const geminiPrompt = this.buildGeminiPrompt(prompt);
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

          if (response.status === 200 && response.data) {
            break;
          }
        } catch (error) {
          console.log(`[Gemini] Attempt ${attempts} failed:`, error.message);
          if (attempts >= maxAttempts) throw error;
          const delay = error.response?.status === 429 ? 10000 : error.response?.status >= 500 ? 5000 : 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!response || !response.data) {
        throw new Error('No response from Gemini API');
      }

      let processed = this.processGeminiResponse(response.data.response || '');
      return processed || 'Unable to analyze the image. Please try again.';

    } catch (error) {
      console.error('[Gemini] Error:', error.message);
      
      const fallbackPrompt = `The user sent an image but the image analysis failed. The user asked: ${prompt || 'Please describe what you see'}. Please provide a helpful response.`;
      const response = await this.callAPI(fallbackPrompt, 'gemini_fallback');
      return this.cleanResponse(response || 'Unable to analyze the image. Please try again.');
    }
  },

  buildGeminiPrompt(userPrompt) {
    let prompt = `Analyze this image and provide a comprehensive response.

DETECT THE CONTENT TYPE and respond accordingly:

CONTENT TYPES:
- Educational: Provide analysis, learning tips, study strategies, real-world examples
- Career/Professional: Provide career advice, skills needed, industry insights, growth strategies
- Math/Science: Solve problems step-by-step, explain concepts, provide practice examples
- Business/Marketing: Provide business insights, marketing strategies, growth tips
- Health/Medical: Provide health tips, wellness advice, medical information
- Technology: Provide tech insights, trends, learning resources
- Arts/Creative: Provide creative tips, techniques, inspiration
- General: Provide analysis, observations, helpful suggestions

For EVERY response, include this structure:

1. ANALYSIS - Detailed analysis of what you see
2. THEREFORE / CORE POINT - The main conclusion, key insight, or final answer
3. TIPS WITH EXAMPLES - Practical suggestions with specific examples
4. NEXT STEPS - Actionable steps to take

IMPORTANT RULES:
- State the main takeaway clearly in THEREFORE
- For problems: State the final answer
- For analysis: State the core insight
- For questions: State the direct answer
- Use plain text only. No symbols, no markdown.

RESPONSE FORMAT:
ANALYSIS:
[Detailed analysis of the image]

THEREFORE:
[The main conclusion, core point, final answer, or key insight]

TIPS WITH EXAMPLES:
1. [Tip] - Example: [Specific example]
2. [Tip] - Example: [Specific example]

NEXT STEPS:
1. [Actionable step]
2. [Actionable step]`;

    if (userPrompt && !userPrompt.includes('Analyze this image')) {
      prompt += `\n\nUSER QUESTION: ${userPrompt}`;
    }

    return prompt;
  },

  processGeminiResponse(response) {
    let processed = response || '';
    processed = this.cleanGeminiFormatting(processed);
    processed = this.ensureThereforeSection(processed);
    return processed;
  },

  cleanGeminiFormatting(response) {
    let cleaned = response;
    cleaned = cleaned
      .replace(/\$/g, '')
      .replace(/\\[a-zA-Z]+/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/`/g, '')
      .replace(/_/g, '')
      .replace(/~{2}/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^I'?m?\s+a?\s*Gemini.*?model.*?\n\n?/i, '')
      .replace(/^Here is my analysis.*?\n/i, '')
      .replace(/^Let me analyze.*?\n/i, '')
      .replace(/^The image appears to be.*?\n/i, '')
      .replace(/^Based on my analysis.*?\n/i, '')
      .replace(/^I can see that.*?\n/i, '')
      .replace(/^This looks like.*?\n/i, '')
      .trim();
    return cleaned;
  },

  ensureThereforeSection(response) {
    let withTherefore = response;
    const lowerResponse = response.toLowerCase();
    const hasTherefore = lowerResponse.includes('therefore') || 
                         lowerResponse.includes('core point') ||
                         lowerResponse.includes('main takeaway') ||
                         lowerResponse.includes('final answer') ||
                         lowerResponse.includes('key insight');

    if (!hasTherefore) {
      const lines = response.split('\n');
      let analysisEnd = 0;
      let foundAnalysis = false;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes('analysis:') || 
            lines[i].toLowerCase().includes('analysis')) {
          foundAnalysis = true;
          continue;
        }
        if (foundAnalysis && lines[i].trim() === '') {
          analysisEnd = i;
          break;
        }
      }

      if (analysisEnd > 0) {
        const before = lines.slice(0, analysisEnd).join('\n');
        const after = lines.slice(analysisEnd).join('\n');
        withTherefore = before + '\n\nTHEREFORE:\n[Core insight based on the analysis above]\n\n' + after;
      } else {
        withTherefore = 'THEREFORE:\n[Main conclusion from the image]\n\n' + response;
      }
    }
    return withTherefore;
  },

  // ==================== TEXT API WITH FALLBACK ====================

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
    const primaryConfig = this.getApiConfig();
    const fallbackConfig = this.getFallbackApiConfig();

    try {
      console.log('[API] Trying primary API...');
      const response = await this.executeApiCall(primaryConfig, prompt, senderId);
      return response;
    } catch (primaryError) {
      console.error('[API] Primary API failed:', primaryError.message);
      try {
        console.log('[API] Trying fallback API...');
        const response = await this.executeApiCall(fallbackConfig, prompt, senderId);
        return response;
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
          const encodedPrompt = encodeURIComponent(prompt);
          const paramName = config.url.includes('opera') ? 'ask' : 'prompt';
          const apiUrl = `${config.url}?${paramName}=${encodedPrompt}`;
          
          response = await axios.get(apiUrl, {
            timeout: config.timeout,
            headers: { 'Accept': 'application/json', ...config.headers }
          });
        } else {
          const payload = { prompt: prompt };
          response = await axios.post(config.url, payload, {
            timeout: config.timeout,
            headers: { 'Content-Type': 'application/json', ...config.headers }
          });
        }

        const data = response.data;
        if (data[config.successField] !== true) {
          throw new Error(`API returned ${config.successField}: false`);
        }

        const extracted = this.extractResponse(data, config);
        if (extracted) {
          return this.standardizeResponse(extracted);
        } else {
          throw new Error('API returned empty response');
        }
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
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return null;
        }
      }
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    const formats = ['data', 'result', 'response', 'message', 'text', 'content'];
    for (const format of formats) {
      const path = format.split('.');
      let value = data;
      for (const key of path) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          value = null;
          break;
        }
      }
      if (value && typeof value === 'string' && value.trim()) {
        return value;
      }
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
      .trim();
  },

  // ==================== CONVERSATIONAL FUNCTIONS ====================

  wantsDetailedAnswer(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    const detailedKeywords = [
      'explain more', 'more explanation', 'more details', 'detailed', 'detail',
      'elaborate', 'elaborate more', 'paki elaborate', 'mas detalyado',
      'tell me more', 'give more info', 'dagdagan', 'dagdag',
      'further explain', 'further explanation', 'full explanation',
      'complete explanation', 'in depth', 'in-depth', 'thorough',
      'comprehensive', 'expound', 'pakilinaw', 'linawin',
      'more information', 'additional info', 'karagdagang',
      'can you explain further', 'please elaborate'
    ];
    return detailedKeywords.some(keyword => lowerPrompt.includes(keyword));
  },

  shortenResponse(text) {
    if (!text) return text;
    const sentences = text.split(/(?<=[.!?])\s+/);
    let concise = sentences.slice(0, 3).join(' ');
    if (concise.length > 400) {
      concise = concise.substring(0, 400) + '...';
    }
    concise = concise
      .replace(/^(In summary|To summarize|In conclusion|Basically|Essentially|Simply put|In other words|That said|Having said that|With that said)\s*,?\s*/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return concise || text;
  },

  isContextualQuestion(prompt, previousPrompt) {
    if (!previousPrompt) return false;
    const contextualPatterns = [
      'so yan', 'so ito', 'so iyan', 'so yun', 'so ganyan', 'so ganito', 'so ganun',
      'yan na ba', 'yun na ba', 'ito na ba', 'ganyan na ba', 'ganun na ba',
      'tama ba', 'tama', 'correct', 'right',
      'so tungkol', 'so sa', 'so para sa',
      'so ibig sabihin', 'so meaning', 'so parang',
      'so sa madaling salita', 'so in short',
      'paano naman', 'what about', 'how about',
      'paano kung', 'what if',
      'bakit', 'why', 'paano', 'how', 'kailan', 'when', 'saan', 'where', 'sino', 'who', 'alin', 'which',
      'ano', 'what', 'ano ba', 'what about',
      'gets', 'gets ko', 'nagets', 'naintindihan',
      'so gets', 'so naintindihan',
      'ayun', 'ayon', 'ganun pala', 'ganyan pala',
      'so ayun', 'so ayon',
      'ok', 'okay', 'sige', 'cge',
      'so okay', 'so sige',
      'ah ganun', 'ah ganyan', 'ah okay',
      'so ah', 'so okay',
      'talaga', 'really', 'sure',
      'so talaga', 'so sure',
      'so that', 'so this', 'so it',
      'so about', 'so regarding',
      'so basically', 'so essentially',
      'so you mean', 'so you saying',
      'mao na', 'mao ni', 'mao to', 'mao diay',
      'mao ba', 'mao jud', 'mao gyud',
      'so mao', 'so mao na',
      'sakto ba', 'sakto',
      'ingon ana', 'ingon ani',
      'so ingon', 'so ingon ana',
      'unsa man', 'unsa',
      'na gets', 'nakasabot', 'nasabtan',
      'so nakasabot', 'so nasabtan',
      'aw', 'aw okay', 'ah okay',
      'so', 'sow', 'eh', 'e', 'a', 'ah', 'oh', 'ay',
      'ha', 'heh', 'hmm', 'hm', 'mmm'
    ];
    const isRelated = contextualPatterns.some(pattern => prompt.includes(pattern));
    const prevWords = previousPrompt.split(' ').filter(w => w.length > 2);
    const currentWords = prompt.split(' ').filter(w => w.length > 2);
    const hasRelatedWords = prevWords.some(w => currentWords.some(cw => cw.includes(w) || w.includes(cw)));
    return isRelated || hasRelatedWords;
  },

  isFollowUpRequest(prompt) {
    const keywords = [
      'translate', 'translate to', 'translate into', 'translate in',
      'translation', 'isalin', 'salin', 'ipasalin', 'isalin sa',
      'transl', 'trans', 'tl', 'bis', 'ceb', 'eng', 'spa',
      'tagalog', 'bisaya', 'cebuano', 'spanish', 'filipino',
      'english', 'ilocano', 'waray', 'hiligaynon', 'kapampangan',
      'elaborate', 'elaborate further', 'explain more', 'paki elaborate',
      'paki explain', 'paliwanag', 'ipaliwanag', 'elab', 'explain',
      'detail', 'further', 'more details', 'mas detalyado',
      'summarize', 'summary', 'i-summarize', 'brief', 'make it short',
      'short', 'concise', 'shorten', 'sum', 'ikli', 'paikliin',
      'simplify', 'simple', 'pasimplehin', 'basic', 'simplified',
      'simp', 'madali', 'dali', 'gawing simple',
      'example', 'sample', 'halimbawa', 'instance', 'eg', 'ex', 'hal',
      'give example', 'give examples', 'magbigay ng halimbawa',
      'correct', 'fix', 'tama', 'ayusin', 'improve', 'better',
      'improved', 'i-correct', 'i-fix', 'iwasto',
      'add', 'additional', 'dagdagan', 'more', 'add more',
      'dagdag', 'karagdagang',
      'humanize', 'make it human', 'conversational', 'natural',
      'make it natural', 'parang tao', 'human-like', 'human',
      'gawing natural', 'gawing tao',
      'tama ba', 'correct ba', 'right ba', 'sure ba', 'talaga',
      'really', 'are you sure', 'sigurado ka',
      'clarify', 'clarification', 'linawin', 'clear', 'make clear',
      'ulit', 'repeat', 'say again', 'paulit', 'ulitin',
      'paki-ulit', 'pakiulit', 'again',
      'gets', 'nagets', 'naintindihan', 'understand',
      'naiintindihan', 'gets ko', 'nagets ko', 'gots', 'got it',
      'oo', 'opo', 'sige', 'cge', 'okay', 'ok',
      'agree', 'yes', 'yeah', 'yep',
      'hindi', 'dili', 'no', 'not', 'mali',
      'disagree', 'hindi tama', 'mali yan',
      'what', 'why', 'how', 'when', 'where', 'who', 'which',
      'ano', 'bakit', 'paano', 'kailan', 'saan', 'sino', 'alin',
      'wut', 'y', 'hau', 'wen', 'wer', 'hu', 'wich',
      'anu', 'bkt', 'pano', 'klan', 'san', 'sinu', 'aln',
      'kasi', 'dahil', 'kaya', 'nga', 'na', 'pa', 'ba',
      'din', 'rin', 'lang', 'lng', 'naman', 'nman', 'nmn',
      'talaga', 'tlga', 'tlag', 'sabi mo', 'sbi mo'
    ];
    return keywords.some(keyword => prompt.includes(keyword));
  },

  isNewTopic(prompt, previousPrompt) {
    if (!previousPrompt) return true;
    const newTopicIndicators = [
      'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
      'kamusta', 'musta', 'kumusta', 'musta na', 'kumusta ka',
      'oy', 'oi', 'hoy', 'ei', 'ey',
      'good day', 'greetings', 'sup', 'whats up', 'whassup',
      'magandang umaga', 'magandang tanghali', 'magandang hapon', 'magandang gabi',
      'maayong buntag', 'maayong udto', 'maayong hapon', 'maayong gabii',
      'ask', 'tanong', 'question', 'tungkol sa',
      'about', 'regarding', 'sa', 'about sa',
      'i want to ask', 'gusto kong itanong',
      'can i ask', 'pwede magtanong',
      'new topic', 'bagong topic',
      'change topic', 'change subject', 'ibang topic', 'iba naman',
      'next topic', 'lipat tayo', 'move on',
      'what is', 'what are', 'what does', 'what do',
      'ano ang', 'ano ba', 'ano yung', 'ano iyong',
      'sino ang', 'sino ba', 'sino yung', 'sino iyong',
      'bakit', 'paano', 'kailan', 'saan',
      'why', 'how', 'when', 'where', 'who', 'which',
      'tell me about', 'tell me', 'tell about',
      'explain', 'define', 'describe',
      'give me', 'give', 'show me',
      'can you tell', 'could you tell',
      'please explain', 'please tell',
      'do you know', 'did you know',
      'have you heard', 'have you seen',
      'is it true', 'is that true',
      'really', 'seriously',
      'today', 'now', 'currently',
      'recently', 'lately',
      'nowadays', 'these days',
      'this time', 'this day'
    ];
    if (prompt.length < 10 && !this.isFollowUpRequest(prompt)) {
      return true;
    }
    return newTopicIndicators.some(indicator => prompt.includes(indicator));
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

  buildFinalPrompt(prompt, previousResponse, previousPrompt, isReply, wantsDetailed) {
    let finalPrompt = '';

    if (previousResponse) {
      finalPrompt += 'Previous conversation context:\n';
      finalPrompt += 'User asked: ' + (previousPrompt || 'unknown') + '\n';
      finalPrompt += 'AI responded: ' + previousResponse + '\n\n';
      
      const lowerPrompt = prompt.toLowerCase();

      if (this.isContextualQuestion(lowerPrompt, previousPrompt)) {
        finalPrompt += 'User is asking a follow-up question about the previous topic.\n';
        finalPrompt += 'The user wants to clarify, confirm, or continue the discussion about the previous response.\n';
        finalPrompt += 'Provide a direct answer that continues the conversation naturally.\n';
        finalPrompt += 'Acknowledge the previous context and respond as if having a natural conversation.\n\n';
      }

      if (this.isTranslationRequest(prompt)) {
        const lang = this.detectTargetLanguage(prompt);
        finalPrompt += 'User wants to translate the previous response to ' + lang + '.\n';
        finalPrompt += 'Provide the translation to ' + lang + ' only. Do not include the original text.\n\n';
      } else if (lowerPrompt.includes('humanize') || lowerPrompt.includes('make it human') || 
                 lowerPrompt.includes('conversational') || lowerPrompt.includes('natural') ||
                 lowerPrompt.includes('make it natural') || lowerPrompt.includes('parang tao') ||
                 lowerPrompt.includes('human-like') || lowerPrompt.includes('human')) {
        finalPrompt += 'User wants you to make your previous response more human and conversational.\n';
        finalPrompt += 'Rewrite it in a natural, friendly, and engaging tone.\n';
        finalPrompt += 'Use simple language, add personality, and make it sound like a real person talking.\n\n';
      } else if (lowerPrompt.includes('elaborate') || lowerPrompt.includes('explain more') || 
                 lowerPrompt.includes('paki elaborate') || lowerPrompt.includes('detail') ||
                 lowerPrompt.includes('further') || lowerPrompt.includes('paliwanag') ||
                 lowerPrompt.includes('ipaliwanag') || lowerPrompt.includes('elab') ||
                 lowerPrompt.includes('more details') || lowerPrompt.includes('mas detalyado')) {
        finalPrompt += 'User wants you to elaborate on your previous response.\n';
        finalPrompt += 'Provide a detailed explanation with more information, context, and examples.\n';
        finalPrompt += 'Expand on each point thoroughly.\n\n';
      } else if (lowerPrompt.includes('summarize') || lowerPrompt.includes('summary') || 
                 lowerPrompt.includes('i-summarize') || lowerPrompt.includes('brief') ||
                 lowerPrompt.includes('make it short') || lowerPrompt.includes('short') ||
                 lowerPrompt.includes('concise') || lowerPrompt.includes('shorten') ||
                 lowerPrompt.includes('paikliin') || lowerPrompt.includes('ikli') ||
                 lowerPrompt.includes('sum')) {
        finalPrompt += 'User wants a concise summary of your previous response.\n';
        finalPrompt += 'Provide only the most important key points in a short, clear, and direct manner.\n\n';
      } else if (lowerPrompt.includes('simplify') || lowerPrompt.includes('simple') || 
                 lowerPrompt.includes('pasimplehin') || lowerPrompt.includes('basic') ||
                 lowerPrompt.includes('simplified') || lowerPrompt.includes('madali') ||
                 lowerPrompt.includes('simp')) {
        finalPrompt += 'User wants a simpler explanation.\n';
        finalPrompt += 'Explain using simple words and layman terms.\n\n';
      } else if (lowerPrompt.includes('example') || lowerPrompt.includes('sample') || 
                 lowerPrompt.includes('halimbawa') || lowerPrompt.includes('instance') ||
                 lowerPrompt.includes('eg') || lowerPrompt.includes('ex') || lowerPrompt.includes('hal')) {
        finalPrompt += 'User wants examples related to your previous response.\n';
        finalPrompt += 'Provide relevant examples to illustrate your points.\n\n';
      } else if (lowerPrompt.includes('correct') || lowerPrompt.includes('fix') || 
                 lowerPrompt.includes('tama') || lowerPrompt.includes('ayusin') ||
                 lowerPrompt.includes('improve') || lowerPrompt.includes('better')) {
        finalPrompt += 'User wants you to correct or improve your previous response.\n';
        finalPrompt += 'Review and provide an improved version.\n\n';
      } else if (lowerPrompt.includes('add') || lowerPrompt.includes('additional') || 
                 lowerPrompt.includes('dagdagan') || lowerPrompt.includes('more') ||
                 lowerPrompt.includes('dagdag')) {
        finalPrompt += 'User wants additional information.\n';
        finalPrompt += 'Add more details, examples, or context.\n\n';
      } else if (lowerPrompt.includes('ulit') || lowerPrompt.includes('repeat') || 
                 lowerPrompt.includes('again') || lowerPrompt.includes('paki-ulit')) {
        finalPrompt += 'User wants you to repeat or re-explain your previous response.\n';
        finalPrompt += 'Provide the same information but in a clearer way.\n\n';
      } else if (lowerPrompt.includes('gets') || lowerPrompt.includes('nagets') || 
                 lowerPrompt.includes('naintindihan') || lowerPrompt.includes('understand') ||
                 lowerPrompt.includes('gots')) {
        finalPrompt += 'User is acknowledging understanding of your previous response.\n';
        finalPrompt += 'Respond positively and offer to provide more information if needed.\n\n';
      } else if (lowerPrompt.includes('tama ba') || lowerPrompt.includes('correct ba') || 
                 lowerPrompt.includes('sure ba') || lowerPrompt.includes('talaga') ||
                 lowerPrompt.includes('really')) {
        finalPrompt += 'User is asking for confirmation about your previous response.\n';
        finalPrompt += 'Confirm if your previous response is accurate and provide additional proof if needed.\n\n';
      } else if (lowerPrompt.includes('oo') || lowerPrompt.includes('opo') || 
                 lowerPrompt.includes('sige') || lowerPrompt.includes('cge') ||
                 lowerPrompt.includes('okay') || lowerPrompt.includes('yes') ||
                 lowerPrompt.includes('agree')) {
        finalPrompt += 'User is agreeing with your previous response.\n';
        finalPrompt += 'Acknowledge the agreement and offer to provide more information.\n\n';
      } else if (lowerPrompt.includes('hindi') || lowerPrompt.includes('dili') || 
                 lowerPrompt.includes('no') || lowerPrompt.includes('not') ||
                 lowerPrompt.includes('mali') || lowerPrompt.includes('disagree')) {
        finalPrompt += 'User is disagreeing or questioning your previous response.\n';
        finalPrompt += 'Acknowledge the disagreement and provide clarification or additional evidence.\n\n';
      } else {
        finalPrompt += 'User is continuing the conversation about the previous topic.\n';
        finalPrompt += 'User says: ' + prompt + '\n';
        finalPrompt += 'Provide a natural response that continues the discussion.\n';
        finalPrompt += 'Acknowledge the previous context and respond directly to the user.\n\n';
      }
    } else {
      finalPrompt = prompt;
    }

    if (wantsDetailed) {
      finalPrompt += 'USER WANTS DETAILED ANSWER: Provide a comprehensive, thorough, and detailed explanation.\n';
      finalPrompt += 'Include examples, context, and complete information.\n\n';
    } else {
      finalPrompt += 'USER WANTS CONCISE ANSWER: Provide a SHORT, DIRECT, and ACCURATE response.\n';
      finalPrompt += 'Be straight to the point. Maximum 2-3 sentences or 1-2 paragraphs.\n';
      finalPrompt += 'No unnecessary explanations. Just the key facts.\n\n';
    }

    finalPrompt += 'IMPORTANT GUIDELINES:\n';
    finalPrompt += '- Be accurate and precise in your response.\n';
    finalPrompt += '- For math problems, show step-by-step solution.\n';
    finalPrompt += '- For analysis, provide clear description.\n';
    finalPrompt += '- Use plain text only. No symbols or markdown.\n';
    finalPrompt += '- If unsure, state that clearly.\n';
    finalPrompt += '- Do not ask questions back. Just provide the complete response.\n';
    finalPrompt += '- Continue the conversation naturally.\n';
    finalPrompt += '- Be friendly and engaging.\n';

    return finalPrompt;
  },

  isOwnerQuestion(prompt) {
    const keywords = [
      'who is your owner', 'who created you', 'who made you',
      'sino gumawa sayo', 'sino may ari sayo', 'owner mo',
      'sino owner mo', 'who owns you', 'creator', 'developer'
    ];
    return keywords.some(keyword => prompt.toLowerCase().includes(keyword.toLowerCase()));
  },

  isUserInfoQuestion(prompt) {
    const keywords = [
      'what is my name', 'ano pangalan ko', 'my name', 'pangalan ko',
      'when is my birthday', 'kelan birthday ko', 'my birthday',
      'who am i', 'sino ako', 'whats my name'
    ];
    return keywords.some(keyword => prompt.toLowerCase().includes(keyword.toLowerCase()));
  },

  isTranslationRequest(prompt) {
    const keywords = [
      'translate', 'translate to', 'translate into', 'translate in',
      'translation', 'isalin', 'salin', 'ipasalin', 'isalin sa',
      'transl', 'trans'
    ];
    const promptLower = prompt.toLowerCase();
    if (keywords.some(keyword => promptLower.includes(keyword))) {
      return true;
    }
    const languages = [
      'tagalog', 'bisaya', 'cebuano', 'spanish', 'filipino',
      'english', 'ilocano', 'waray', 'hiligaynon', 'kapampangan',
      'pangasinan', 'bicolano', 'chinese', 'mandarin', 'cantonese',
      'japanese', 'nihongo', 'korean', 'hangeul', 'french',
      'francais', 'german', 'deutsch', 'italian', 'italiano',
      'portuguese', 'russian', 'arabic', 'hindi', 'urdu',
      'bengali', 'tamil', 'telugu', 'marathi', 'gujarati',
      'kannada', 'malayalam', 'thai', 'vietnamese', 'indonesian',
      'malay', 'burmese', 'khmer', 'lao', 'nepali', 'sinhala',
      'armenian', 'hebrew', 'greek', 'latin', 'dutch', 'swedish',
      'norwegian', 'danish', 'finnish', 'polish', 'czech',
      'hungarian', 'romanian', 'bulgarian', 'serbian', 'croatian',
      'tl', 'bis', 'ceb', 'eng', 'spa'
    ];
    return languages.some(lang => promptLower.includes(lang));
  },

  detectTargetLanguage(prompt) {
    const promptLower = prompt.toLowerCase();
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
      'burmese': 'Burmese', 'khmer': 'Khmer',
      'lao': 'Lao', 'nepali': 'Nepali',
      'sinhala': 'Sinhala', 'armenian': 'Armenian',
      'hebrew': 'Hebrew', 'arabic': 'Arabic',
      'hindi': 'Hindi', 'urdu': 'Urdu',
      'bengali': 'Bengali', 'tamil': 'Tamil',
      'telugu': 'Telugu', 'marathi': 'Marathi',
      'gujarati': 'Gujarati', 'kannada': 'Kannada',
      'malayalam': 'Malayalam', 'english': 'English',
      'spanish': 'Spanish', 'french': 'French',
      'francais': 'French', 'german': 'German',
      'deutsch': 'German', 'italian': 'Italian',
      'italiano': 'Italian', 'portuguese': 'Portuguese',
      'russian': 'Russian', 'greek': 'Greek',
      'latin': 'Latin', 'dutch': 'Dutch',
      'swedish': 'Swedish', 'norwegian': 'Norwegian',
      'danish': 'Danish', 'finnish': 'Finnish',
      'polish': 'Polish', 'czech': 'Czech',
      'hungarian': 'Hungarian', 'romanian': 'Romanian',
      'bulgarian': 'Bulgarian', 'serbian': 'Serbian',
      'croatian': 'Croatian'
    };
    for (const [key, value] of Object.entries(languages)) {
      if (promptLower.includes(key)) {
        return value;
      }
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

  // ==================== HELPER FUNCTIONS ====================

  async getRepliedMessageData(mid, token) {
    try {
      const url = `https://graph.facebook.com/v21.0/${mid}`;
      const params = {
        access_token: token,
        fields: 'message,from,attachments'
      };
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
      
      return {
        message: data?.message || null,
        from: data?.from?.id || null,
        imageUrl: imageUrl
      };
    } catch (error) {
      console.error('[Get Replied Message] Failed:', error.message);
      return { message: null, from: null, imageUrl: null };
    }
  },

  async handleUserInfo(senderId, prompt, token) {
    try {
      const userInfo = await this.getUserInfo(senderId, token);
      let response = '';
      if (prompt.toLowerCase().includes('name') || prompt.toLowerCase().includes('pangalan')) {
        response = userInfo.name ? `Your name is ${userInfo.name}.` : 'I cannot tell you that because it is confidential.';
      }
      if (prompt.toLowerCase().includes('birthday') || prompt.toLowerCase().includes('kelan')) {
        response += userInfo.birthday ? `\nYour birthday is ${userInfo.birthday}.` : '\nI cannot tell you that because it is confidential.';
      }
      if (!response) {
        const publicInfo = [];
        if (userInfo.name) publicInfo.push(`Name: ${userInfo.name}`);
        if (userInfo.birthday) publicInfo.push(`Birthday: ${userInfo.birthday}`);
        if (userInfo.gender) publicInfo.push(`Gender: ${userInfo.gender}`);
        if (userInfo.location) publicInfo.push(`Location: ${userInfo.location}`);
        response = publicInfo.length > 0
          ? `Here is your public information:\n${publicInfo.join('\n')}`
          : 'I cannot tell you that because it is confidential.';
      }
      await sendMessage(senderId, { text: response }, token);
    } catch (error) {
      console.error('[User Info] Failed:', error.message);
      await sendMessage(senderId, { text: 'Error fetching user info.' }, token);
    }
  },

  async getUserInfo(senderId, token) {
    try {
      const url = `https://graph.facebook.com/${senderId}`;
      const params = {
        access_token: token,
        fields: 'id,name,first_name,last_name,birthday,gender,location,email'
      };
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

  cleanResponse(text) {
    if (!text) return 'No response.';
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
    return cleaned.trim() || 'No response.';
  },

  getErrorMessage(error) {
    if (error.code === 'ECONNABORTED') {
      return 'Request timeout. Please try again.';
    }
    if (error.response?.status === 429) {
      return 'Rate limit exceeded. Please wait a moment.';
    }
    if (error.response?.status === 403) {
      return 'API key invalid or expired.';
    }
    if (error.response?.status >= 500) {
      return 'Server error. Please try again later.';
    }
    return 'Error processing request. Please try again.';
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
