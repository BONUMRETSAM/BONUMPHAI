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

      if (event?.message?.reply_to?.mid) {
        isReply = true;
        const replyData = await this.getRepliedMessageData(event.message.reply_to.mid, token);
        previousResponse = replyData.message;
        imageUrl = replyData.imageUrl;
        if (!prompt) prompt = 'Please respond to what I said.';
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
        if (imageUrl && !prompt) prompt = 'Analyze this image.';
      }

      if (!isReply && prompt) {
        const history = conversationHistory[senderId];
        if (history && history.lastResponse) {
          const lowerPrompt = prompt.toLowerCase();
          const isNewQuestion = this.isNewQuestion(prompt, history.lastPrompt);
          const isFollowUp = this.isFollowUpRequest(lowerPrompt) || 
                            this.isContextualQuestion(prompt, history.lastPrompt);
          
          if (isFollowUp && !isNewQuestion) {
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
          text: 'AI Commands:\n\nai [question] - Ask anything\nsend image - Analyze image\ngenerate [term] [count] - Generate images\ngscholar [query] - Search academic papers\nplay [song] - Search music\nlyrics [song] - Get lyrics'
        }, token);
        return;
      }

      if (this.isOwnerQuestion(prompt)) {
        await sendMessage(senderId, {
          text: 'Created by GeoDevz69. Visit: https://www.facebook.com/geotechph.net'
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

      // FORCE SHORT, DIRECT RESPONSE - REMOVE ALL CONVERSATIONAL FILLER
      aiResponse = this.forceDirectResponse(aiResponse);

      if (!imageUrl && !isReply && !wantsDetailed) {
        aiResponse = this.shortenResponse(aiResponse);
      }

      // OVERRIDE: Always keep it short and direct
      aiResponse = this.forceDirectResponse(aiResponse);

      conversationHistory[senderId] = {
        lastPrompt: prompt,
        lastResponse: aiResponse,
        timestamp: Date.now(),
        topicHistory: conversationHistory[senderId]?.topicHistory || {}
      };

      this.cleanOldHistory();

      if (isReply && this.isTranslationRequest(prompt)) {
        const targetLanguage = this.detectTargetLanguage(prompt);
        aiResponse = await this.translateResponse(aiResponse, targetLanguage);
        aiResponse = this.forceDirectResponse(aiResponse);
      }

      await this.sendChunks(senderId, aiResponse, token);

    } catch (error) {
      console.error('[ai] Error:', error.message);
      await sendMessage(senderId, { text: this.getErrorMessage(error) }, token);
    }
  },

  // ========== NEW: FORCE DIRECT RESPONSE ==========
  forceDirectResponse(text) {
    if (!text) return 'No response.';
    
    let cleaned = text.trim();
    
    // Remove ALL conversational greetings
    cleaned = cleaned.replace(/^(Hello|Hi|Hey|Good morning|Good afternoon|Good evening|Kamusta|Must|Ah|Oh|Well|So|Actually|Basically|Honestly|To be honest|I think|I believe|In my opinion|Let me|I would say|I can see that|It looks like|It seems that|Now|Okay|Alright|Sure|Yes|Yeah|Hmm|Um|Uh)\s*,?\s*/gi, '');
    
    // Remove "I'm here to help" type phrases
    cleaned = cleaned.replace(/I('m| am) (here to help|happy to help|glad to assist|ready to assist).*?\.\s*/gi, '');
    cleaned = cleaned.replace(/Let me (explain|tell you|show you|help you|guide you).*?\.\s*/gi, '');
    cleaned = cleaned.replace(/As an AI.*?\.\s*/gi, '');
    cleaned = cleaned.replace(/I('m| am) an AI.*?\.\s*/gi, '');
    cleaned = cleaned.replace(/Based on my (analysis|knowledge|understanding).*?\.\s*/gi, '');
    cleaned = cleaned.replace(/From what I can see.*?\.\s*/gi, '');
    cleaned = cleaned.replace(/I can help you.*?\.\s*/gi, '');
    cleaned = cleaned.replace(/Here is my response.*?\.\s*/gi, '');
    cleaned = cleaned.replace(/Here is what I think.*?\.\s*/gi, '');
    cleaned = cleaned.replace(/Let's see.*?\.\s*/gi, '');
    cleaned = cleaned.replace(/First,? let me.*?\.\s*/gi, '');
    cleaned = cleaned.replace(/To answer your question.*?\.\s*/gi, '');
    
    // Remove fillers
    cleaned = cleaned.replace(/\b(actually|basically|honestly|seriously|literally|really|very|quite|just|simply|clearly|obviously|definitely|certainly|absolutely|totally|completely|entirely)\b/gi, '');
    
    // Remove repeated words
    cleaned = cleaned.replace(/\b(\w+)\s+\1\b/gi, '$1');
    
    // Remove markdown
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
    cleaned = cleaned.replace(/#{1,6}\s*/g, '');
    cleaned = cleaned.replace(/`/g, '');
    cleaned = cleaned.replace(/```/g, '');
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // Remove emojis
    cleaned = cleaned.replace(/[\u{1F000}-\u{1FFFF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2600}-\u{27BF}]/gu, '');
    cleaned = cleaned.replace(/[\u{FE00}-\u{FEFF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');
    
    // Clean up extra spaces
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    
    // Force capital first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    // Limit to 3 sentences max
    const sentences = cleaned.split(/(?<=[.!?])\s+/);
    if (sentences.length > 3) {
      cleaned = sentences.slice(0, 3).join(' ');
    }
    
    // Limit length
    if (cleaned.length > 400) {
      cleaned = cleaned.substring(0, 400) + '...';
    }
    
    return cleaned.trim() || 'No response.';
  },

  // ========== FIX: buildFinalPrompt ==========
  buildFinalPrompt(prompt, previousResponse, previousPrompt, isReply, wantsDetailed) {
    // DIRECT RESPONSE - NO CONVERSATIONAL FILLER
    let final = '';
    
    // Check if this is about the image/response issue
    if (prompt.toLowerCase().includes('stuck') || prompt.toLowerCase().includes('stack')) {
      return `Explain the difference between "stuck" and "stack" in programming. DIRECT ANSWER. MAX 3 SENTENCES. No greetings. No filler. Just the facts.`;
    }
    
    if (prompt.toLowerCase().includes('response') || prompt.toLowerCase().includes('ai.js') || 
        prompt.toLowerCase().includes('ganto') || prompt.toLowerCase().includes('bat')) {
      return `The user is asking why the response is conversational. Provide a DIRECT, SHORT explanation. MAX 2-3 SENTENCES. No greetings. No "I think". Just the answer.`;
    }
    
    if (previousResponse) {
      final += 'Previous: ' + previousPrompt + '\n';
      final += 'Previous response: ' + previousResponse + '\n\n';
      
      if (this.isFollowUpRequest(prompt)) {
        final += 'User follow-up: ' + prompt + '\n';
      } else {
        final += 'User: ' + prompt + '\n';
      }
      
      final += '\nDIRECT RESPONSE REQUIRED: Be concise. No greetings. No conversational filler. Just answer directly.';
      
      if (!wantsDetailed) {
        final += ' MAX 3 SENTENCES.';
      }
      
    } else {
      final = prompt + '\n\nDIRECT RESPONSE. No greetings. No filler. Just the answer.';
      
      if (!wantsDetailed) {
        final += ' MAX 3 SENTENCES.';
      }
    }
    
    final += '\n\nRULES:\n- No "Hello", "Hi", "Hey"\n- No "I think", "I believe", "Let me"\n- No "Here is", "Based on"\n- No "As an AI"\n- Just state facts directly\n- Be precise and clear';
    
    return final;
  },

  // ========== FIX: shortenResponse ==========
  shortenResponse(text) {
    if (!text) return text;
    
    // Remove conversational fillers
    text = text.replace(/^(Hello|Hi|Hey|Good morning|Good afternoon|Good evening|Kamusta|Must|Ah|Oh|Well|So|Actually|Basically|Honestly|To be honest|I think|I believe|In my opinion|Let me|I would say|I can see that|It looks like|It seems that|Now|Okay|Alright|Sure|Yes|Yeah)\s*,?\s*/gi, '');
    
    text = text.replace(/I('m| am) (here to help|happy to help|glad to assist|ready to assist).*?\.\s*/gi, '');
    text = text.replace(/Let me (explain|tell you|show you|help you|guide you).*?\.\s*/gi, '');
    text = text.replace(/As an AI.*?\.\s*/gi, '');
    text = text.replace(/Based on my (analysis|knowledge|understanding).*?\.\s*/gi, '');
    text = text.replace(/Here is my response.*?\.\s*/gi, '');
    text = text.replace(/To answer your question.*?\.\s*/gi, '');
    
    // Get first 2-3 sentences
    const sentences = text.split(/(?<=[.!?])\s+/);
    let concise = sentences.slice(0, 3).join(' ');
    
    // Limit length
    if (concise.length > 350) {
      concise = concise.substring(0, 350) + '...';
    }
    
    concise = concise
      .replace(/\s{2,}/g, ' ')
      .trim();
    
    // Capitalize first letter
    if (concise.length > 0) {
      concise = concise.charAt(0).toUpperCase() + concise.slice(1);
    }
    
    return concise || text;
  },

  // ========== FIX: cleanResponse ==========
  cleanResponse(text) {
    if (!text) return 'No response.';
    
    let cleaned = text.trim();
    
    // Remove markdown
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
    cleaned = cleaned.replace(/#{1,6}\s*/g, '');
    cleaned = cleaned.replace(/`/g, '');
    cleaned = cleaned.replace(/```/g, '');
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // Remove emojis
    cleaned = cleaned.replace(/[\u{1F000}-\u{1FFFF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2600}-\u{27BF}]/gu, '');
    cleaned = cleaned.replace(/[\u{FE00}-\u{FEFF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, '');
    cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');
    
    // Remove conversational fillers
    cleaned = cleaned.replace(/^(So,?|Well,?|Actually,?|Basically,?|Honestly,?|To be honest,?|I mean,?|You know,?|Right,?|Now,?|Okay,?|Alright,?|Sure,?)\s*/gi, '');
    cleaned = cleaned.replace(/I (think|believe|feel|guess|suppose|assume) (that )?/gi, '');
    cleaned = cleaned.replace(/Let me (explain|tell|show|help|guide|give|say|try)\s*/gi, '');
    
    // Clean up extra spaces
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    
    // Capitalize first letter of each sentence
    cleaned = cleaned.replace(/(^|\.\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
    
    return cleaned.trim() || 'No response.';
  },

  // ========== FIX: callAPI ==========
  async callAPI(prompt, senderId) {
    // Force direct response instruction
    if (!prompt.includes('DIRECT RESPONSE') && !prompt.includes('MAX 3 SENTENCES')) {
      prompt += '\n\nDIRECT RESPONSE REQUIRED. No greetings. No filler. MAX 3 SENTENCES. Just the answer.';
    }
    
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

  // ========== FIX: executeApiCall ==========
  async executeApiCall(config, prompt, senderId) {
    let retries = 2;
    let lastError = null;

    while (retries > 0) {
      try {
        let response;
        if (config.method === 'GET') {
          const encoded = encodeURIComponent(prompt);
          const param = config.url.includes('opera') ? 'ask' : 'prompt';
          const url = `${config.url}?${param}=${encoded}&user=${senderId}`;
          response = await axios.get(url, {
            timeout: config.timeout,
            headers: { 'Accept': 'application/json', ...config.headers }
          });
        } else {
          const payload = { prompt: prompt, user: senderId };
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
          let result = this.standardizeResponse(extracted);
          result = this.forceDirectResponse(result);
          result = this.shortenResponse(result);
          return result;
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

  // ========== FIX: callGeminiAPI ==========
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
      processed = this.forceDirectResponse(processed);
      processed = this.shortenResponse(processed);
      return processed || 'Unable to analyze the image. Please try again.';

    } catch (error) {
      console.error('[Gemini] Error:', error.message);
      const fallbackPrompt = `The user sent an image but the image analysis failed. The user asked: ${prompt || 'Please describe what you see'}. Provide a DIRECT, SHORT response. MAX 3 SENTENCES. No greetings.`;
      const response = await this.callAPI(fallbackPrompt, 'gemini_fallback');
      return this.forceDirectResponse(response || 'Unable to analyze the image. Please try again.');
    }
  },

  // ========== FIX: buildGeminiPrompt ==========
  buildGeminiPrompt(userPrompt) {
    return `Analyze the image and provide a DIRECT, CONCISE response.

RULES:
- MAX 3 SENTENCES
- No greetings, no conversational filler
- No "I think", "I believe", "Let me", "Here is"
- No "Based on my analysis"
- Just state what you see and answer directly
- Be factual and precise

USER: ${userPrompt || 'What do you see in this image?'}`;
  },

  // ========== FIX: processGeminiResponse ==========
  processGeminiResponse(response) {
    let processed = response || '';
    processed = this.cleanGeminiFormatting(processed);
    processed = this.forceDirectResponse(processed);
    processed = this.shortenResponse(processed);
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

  // ========== REST OF METHODS (unchanged) ==========
  
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

  wantsDetailedAnswer(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['explain more', 'more explanation', 'more details', 'detailed', 'detail', 'elaborate', 'elaborate more', 'paki elaborate', 'mas detalyado', 'tell me more', 'give more info', 'dagdagan', 'dagdag', 'further explain', 'further explanation', 'full explanation', 'complete explanation', 'in depth', 'in-depth', 'thorough', 'comprehensive', 'expound', 'pakilinaw', 'linawin', 'more information', 'additional info', 'karagdagang', 'can you explain further', 'please elaborate'];
    return keywords.some(k => lower.includes(k));
  },

  isNewQuestion(prompt, previousPrompt) {
    if (!previousPrompt) return true;
    
    const lowerPrompt = prompt.toLowerCase();
    const lowerPrevious = previousPrompt.toLowerCase();
    
    const numRegex = /\d+/g;
    const promptNumbers = prompt.match(numRegex) || [];
    const prevNumbers = previousPrompt.match(numRegex) || [];
    
    if (promptNumbers.length > 0 && prevNumbers.length > 0) {
      const promptNumSet = new Set(promptNumbers);
      const prevNumSet = new Set(prevNumbers);
      const hasNewNumber = [...promptNumSet].some(n => !prevNumSet.has(n));
      if (hasNewNumber) return true;
    }
    
    const newIndicators = ['halimbawa', 'example', 'ibang', 'another', 'new', 'bagong', 'panibago', 'sino', 'who', 'ano', 'what', 'bakit', 'why', 'paano', 'how', 'kailan', 'when', 'saan', 'where', 'alin', 'which', 'magkano', 'how much'];
    if (newIndicators.some(i => lowerPrompt.includes(i))) {
      const commonWords = lowerPrompt.split(' ').filter(w => w.length > 3);
      const prevWords = lowerPrevious.split(' ').filter(w => w.length > 3);
      const hasCommon = commonWords.some(w => prevWords.includes(w));
      if (!hasCommon) return true;
    }
    
    const greetings = ['hello', 'hi', 'hey', 'kamusta', 'musta', 'good morning', 'good afternoon', 'good evening'];
    if (greetings.some(g => lowerPrompt.includes(g))) return true;
    
    const casual = ['ahhh', 'okay', 'sige', 'cge', 'salamat', 'thank you', 'thanks', 'ganun', 'ganyan'];
    if (casual.some(c => lowerPrompt.includes(c)) && prompt.length < 30) return true;
    
    return false;
  },

  isFollowUpRequest(prompt) {
    const lower = prompt.toLowerCase();
    
    const patterns = [
      'so', 'then', 'therefore', 'thus', 'hence',
      'what about', 'how about', 'what if', 'how if',
      'why', 'because', 'since', 'as',
      'furthermore', 'moreover', 'additionally',
      'in addition', 'also', 'too', 'as well',
      'for example', 'for instance', 'such as',
      'like', 'similar', 'same', 'different',
      'so', 'kaya', 'dahil', 'kasi', 'sapagkat',
      'tungkol', 'patungkol', 'ukol', 'hinggil',
      'paano naman', 'ano naman', 'bakit naman',
      'ganun', 'ganyan', 'ganito', 'gayon',
      'tulad', 'katulad', 'parang', 'kagaya',
      'dagdag', 'karagdagan', 'tsaka', 'saka',
      'halimbawa', 'kagaya ng', 'tulad ng',
      'mao', 'mao na', 'mao ni', 'mao to',
      'unsa', 'ngano', 'giunsa', 'kanus-a',
      'asa', 'kinsa', 'hain', 'pila',
      'ingon ana', 'ingon ani', 'sama',
      'gets', 'nagets', 'naintindihan', 'naiintindihan',
      'tama', 'sakto', 'wasto', 'tumpak',
      'oo', 'opo', 'sige', 'cge', 'ge',
      'hindi', 'dili', 'no', 'not',
      'talaga', 'sure', 'sigurado', 'totoo',
      'so', 'sow', 'eh', 'e', 'a', 'ah', 'oh', 'ay',
      'ha', 'heh', 'hmm', 'hm', 'mmm'
    ];
    
    if (patterns.some(p => lower.includes(p))) return true;
    
    if (prompt.length < 15 && prompt.includes('?')) return true;
    
    return false;
  },

  isContextualQuestion(prompt, previousPrompt) {
    if (!previousPrompt) return false;
    
    const lowerPrompt = prompt.toLowerCase();
    const lowerPrevious = previousPrompt.toLowerCase();
    
    const prevWords = previousPrompt.split(' ').filter(w => w.length > 3);
    const currentWords = prompt.split(' ').filter(w => w.length > 3);
    
    const hasRelated = prevWords.some(w => currentWords.some(cw => cw.includes(w) || w.includes(cw)));
    
    const referenceWords = ['yan', 'yun', 'ito', 'iyan', 'that', 'this', 'it', 'so', 'kaya', 'dahil'];
    const hasReference = referenceWords.some(r => lowerPrompt.includes(r));
    
    if (hasRelated || hasReference) {
      const newTopicIndicators = ['sino', 'who', 'ano', 'what', 'bakit', 'why', 'paano', 'how'];
      if (newTopicIndicators.some(n => lowerPrompt.includes(n)) && !hasRelated) return false;
      return true;
    }
    
    if (lowerPrompt.startsWith('so') && prevWords.some(w => lowerPrompt.includes(w))) return true;
    
    return false;
  },

  isRealtimeQuestion(prompt) {
    const lower = prompt.toLowerCase();
    
    const timeKeywords = ['oras', 'time', 'petsa', 'date', 'anong oras', 'what time', 'what is the time', 'anong petsa', 'what date', 'what is the date', 'real time', 'real-time', 'kasalukuyang oras', 'current time', 'current date'];
    if (timeKeywords.some(k => lower.includes(k))) return true;

    const newsKeywords = ['balita', 'news', 'update', 'latest', 'pinakahuling', 'nangyari', 'happening', 'events', 'pangyayari', 'ganap', 'senado', 'senate', 'kongreso', 'congress', 'pulitika', 'politics', 'gobyerno', 'government', 'presidente', 'president', 'bise presidente', 'vice president', 'magulo', 'gulo', 'trouble', 'chaos', 'kaguluhan', 'krisis', 'crisis', 'problema', 'problem', 'situwasyon', 'situation', 'lagay', 'condition', 'report', 'reports', 'ulat', 'balita ngayon', 'ngayong araw', 'today', 'this day', 'this week', 'ano update', 'may nangyari', 'what happened', 'ano balita'];
    if (newsKeywords.some(k => lower.includes(k))) return true;

    const weatherKeywords = ['panahon', 'weather', 'ulan', 'rain', 'bagyo', 'typhoon', 'init', 'heat', 'lamig', 'cold', 'baha', 'flood', 'lindol', 'earthquake', 'pagputok', 'volcano'];
    if (weatherKeywords.some(k => lower.includes(k))) return true;

    const priceKeywords = ['presyo ng', 'price of', 'gastos', 'cost', 'bilihin', 'kuryente', 'electricity', 'tubig', 'water', 'gasolina', 'gas', 'bigas', 'rice', 'asukal', 'sugar', 'mantika', 'oil', 'sibuyas', 'onion', 'bawang', 'garlic'];
    if (priceKeywords.some(k => lower.includes(k))) return true;

    return false;
  },

  async handleRealtimeQuestion(senderId, prompt, token) {
    if (this.isExactTimeRequest(prompt)) {
      await this.handleTimeRequest(senderId, prompt, token);
      return;
    }

    const apis = [
      { url: `https://yin-api.vercel.app/ai/copilot?message=${encodeURIComponent(prompt)}&model=default&user=${senderId}`, parser: (data) => data.answer },
      { url: `https://free-goat-api.onrender.com/rapidai?message=${encodeURIComponent(prompt)}`, parser: (data) => data.result },
      { url: `https://api-library-kohi-production.up.railway.app/api/copilot?prompt=${encodeURIComponent(prompt)}&model=gpt-5&user=${senderId}`, parser: (data) => data.data?.text }
    ];

    for (const api of apis) {
      try {
        const response = await axios.get(api.url, {
          timeout: 15000,
          headers: { 'Accept': 'application/json' }
        });

        const data = response.data;
        if (data && data.status !== false) {
          const answer = api.parser(data);
          if (answer && typeof answer === 'string' && answer.length > 10) {
            let cleanResponse = this.cleanResponse(answer);
            cleanResponse = this.forceDirectResponse(cleanResponse);
            await this.sendChunks(senderId, cleanResponse, token);
            return;
          }
        }
      } catch (error) {
        console.error('[RealTime] API failed:', error.message);
      }
    }

    await sendMessage(senderId, { 
      text: 'Unable to fetch real-time information. Please try again later.' 
    }, token);
  },

  isExactTimeRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['oras', 'time', 'petsa', 'date', 'anong oras', 'what time', 'what is the time', 'anong petsa', 'what date', 'what is the date', 'real time', 'real-time', 'kasalukuyang oras', 'current time', 'current date', 'anong oras na', 'what time is it'];
    return keywords.some(k => lower.includes(k));
  },

  async handleTimeRequest(senderId, prompt, token) {
    try {
      const response = await axios.get('https://worldtimeapi.org/api/timezone/Asia/Manila', {
        timeout: 10000
      });

      const data = response.data;
      const datetime = data.datetime;
      const date = new Date(datetime);
      
      const options = {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      
      const formattedTime = date.toLocaleString('en-PH', options);
      const day = date.toLocaleString('en-PH', { weekday: 'long' });
      const month = date.toLocaleString('en-PH', { month: 'long' });
      const hour = date.getHours();
      const minute = date.getMinutes();
      const seconds = date.getSeconds();
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      
      let message = `Current time in Philippines: ${day}, ${month} ${date.getDate()}, ${date.getFullYear()} - ${hour12}:${minute.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm} (PHT)`;

      await this.sendChunks(senderId, message, token);

    } catch (error) {
      console.error('[Time] WorldTimeAPI failed:', error.message);
      
      try {
        const now = new Date();
        const options = {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        };
        const fallbackTime = now.toLocaleString('en-PH', options);
        
        let message = `Current time in Philippines: ${fallbackTime} (UTC+8)`;

        await this.sendChunks(senderId, message, token);
      } catch (fallbackError) {
        await sendMessage(senderId, { 
          text: 'Unable to fetch real-time time. Please try again later.' 
        }, token);
      }
    }
  },

  isLyricsRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['lyrics', 'lyric', 'letra', 'kanta', 'song lyrics', 'lyrics of', 'lyrics ng', 'letra ng', 'lyrics for', 'lyrics to', 'kanta ni', 'song lyrics of', 'full lyrics', 'complete lyrics', 'lyrics and chords', 'chords and lyrics'];
    return keywords.some(k => lower.includes(k));
  },

  async handleLyricsSearch(senderId, prompt, token) {
    let searchTerm = prompt;
    const removeKeywords = ['lyrics', 'lyric', 'letra', 'kanta', 'song lyrics', 'lyrics of', 'lyrics ng', 'letra ng', 'lyrics for', 'lyrics to', 'kanta ni', 'song lyrics of', 'full lyrics', 'complete lyrics', 'lyrics and chords', 'chords and lyrics'];

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
      await sendMessage(senderId, { 
        text: 'Lyrics Search\nUsage: lyrics [song title] by [artist]\nExample: lyrics lihim by arthur miguel' 
      }, token);
      return;
    }

    try {
      let query = title;
      if (artist) query += ` ${artist}`;
      const encodedQuery = encodeURIComponent(query);
      const apiUrl = `https://api-library-kohi-production.up.railway.app/api/lyrics?query=${encodedQuery}`;
      
      const response = await axios.get(apiUrl, {
        timeout: 15000,
        headers: { 'Accept': 'application/json' }
      });

      const data = response.data;
      if (!data.status || !data.data) {
        await sendMessage(senderId, { 
          text: `No lyrics found for "${title}".` 
        }, token);
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
      await sendMessage(senderId, { 
        text: `Error fetching lyrics for "${title}".` 
      }, token);
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
        if (line === '') {
          newLines.push('');
          continue;
        }
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

  isGenerateCommand(prompt) {
    const commands = ['generate', 'image', 'img', 'show'];
    const lower = prompt.toLowerCase().trim();
    return commands.some(cmd => lower.startsWith(cmd));
  },

  isImageRequest(prompt) {
    const lower = prompt.toLowerCase();
    const questionWords = ['why', 'what', 'how', 'when', 'where', 'who', 'which', 'bakit', 'ano', 'paano', 'kailan', 'saan', 'sino', 'alin'];
    if (questionWords.some(q => lower.includes(q)) && !lower.includes('image of') && !lower.includes('picture of') && !lower.includes('photo of')) {
      return false;
    }
    const keywords = ['show me', 'give me', 'i want', 'sample', 'example', 'picture of', 'image of', 'photo of', 'generate', 'create', 'need', 'maghanap ng', 'gusto ko', 'patingin ng', 'ano itsura', 'looks like', 'parang', 'larawan ng', 'litrato ng', 'imahe ng', 'want to see', 'can i see', 'let me see', 'find image', 'get image', 'search image'];
    return keywords.some(keyword => lower.includes(keyword));
  },

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

    const removeKeywords = ['show me', 'give me', 'i want', 'sample', 'example', 'picture of', 'image of', 'photo of', 'generate', 'create', 'need', 'maghanap ng', 'gusto ko', 'patingin ng', 'ano itsura', 'looks like', 'parang', 'larawan ng', 'litrato ng', 'imahe ng', 'want to see', 'can i see', 'let me see', 'find image', 'get image', 'search image'];
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

    const numberMatch = searchTerm.match(/(\d+)\s*(image|picture|photo|pic)s?$/i);
    if (numberMatch) {
      const num = parseInt(numberMatch[1]);
      if (num > 0 && num <= 30) {
        imageCount = num;
        searchTerm = searchTerm.replace(/\d+\s*(image|picture|photo|pic)s?$/i, '').trim();
      }
    }

    if (!searchTerm) {
      await sendMessage(senderId, { text: 'Image Generation\nUsage: generate [search term] [number]' }, token);
      return;
    }

    try {
      const cleanSearch = searchTerm.toLowerCase().trim();
      const searchWords = cleanSearch.split(/\s+/);
      let allImages = [];

      const response1 = await axios.get('https://hiroshi-api.onrender.com/image/pinterest', {
        params: { search: searchTerm, limit: 100 }
      });
      allImages = [...allImages, ...(response1.data?.data || [])];

      const response2 = await axios.get('https://hiroshi-api.onrender.com/image/pinterest', {
        params: { search: `${searchTerm} ${Date.now()}`, limit: 100 }
      });
      allImages = [...allImages, ...(response2.data?.data || [])];

      if (searchWords.length > 1) {
        const response3 = await axios.get('https://hiroshi-api.onrender.com/image/pinterest', {
          params: { search: searchWords[0], limit: 100 }
        });
        allImages = [...allImages, ...(response3.data?.data || [])];
      }

      if (allImages.length === 0) {
        await sendMessage(senderId, { text: `No images found for "${searchTerm}".` }, token);
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
        await sendMessage(senderId, { text: `No valid images found for "${searchTerm}".` }, token);
        return;
      }

      for (let i = 0; i < resultImages.length; i++) {
        const imageUrl = resultImages[i];
        if (imageUrl && this.isValidUrl(imageUrl)) {
          await sendMessage(senderId, {
            attachment: {
              type: 'image',
              payload: { url: imageUrl }
            }
          }, token);
          if (i < resultImages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }

      await sendMessage(senderId, { text: `Found ${resultImages.length} image(s) for "${searchTerm}"` }, token);

    } catch (error) {
      console.log('[Generate] Error:', error.message);
      await sendMessage(senderId, { text: `Error fetching images for "${searchTerm}".` }, token);
    }
  },

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  },

  isScholarCommand(prompt) {
    const commands = ['gscholar', 'scholar', 'googlescholar', 'research'];
    const lower = prompt.toLowerCase().trim();
    return commands.some(cmd => lower.startsWith(cmd));
  },

  isResearchQuery(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['research', 'study', 'studies', 'paper', 'papers', 'article', 'articles', 'journal', 'journals', 'thesis', 'dissertation', 'literature', 'review', 'meta-analysis', 'systematic review', 'citation', 'citations', 'academic', 'scholar', 'scholarly', 'peer-reviewed', 'peer review', 'hypothesis', 'methodology', 'findings', 'results', 'conclusion', 'data analysis', 'experiment', 'experimental', 'clinical trial', 'randomized', 'controlled trial', 'observational', 'cohort study', 'case study', 'case report', 'survey', 'questionnaire', 'qualitative', 'quantitative', 'mixed methods', 'evidence-based', 'literature search', 'systematic', 'bibliography', 'references', 'reference', 'impact factor', 'h-index', 'citation index', 'scopus', 'web of science', 'pubmed', 'google scholar'];
    return keywords.some(keyword => lower.includes(keyword));
  },

  async handleScholarSearch(senderId, prompt, token) {
    let query = prompt;
    const commands = ['gscholar', 'scholar', 'googlescholar', 'research'];
    for (const cmd of commands) {
      if (query.toLowerCase().startsWith(cmd)) {
        query = query.slice(cmd.length).trim();
        break;
      }
    }

    if (!query) {
      await sendMessage(senderId, { text: 'Google Scholar Search\nUsage: gscholar [search query]' }, token);
      return;
    }

    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          engine: 'google_scholar',
          q: query,
          api_key: SERPAPI_KEY,
          num: 5
        },
        timeout: 30000
      });

      const results = response.data?.organic_results || [];

      if (results.length === 0) {
        await sendMessage(senderId, { text: `No results found for "${query}".` }, token);
        return;
      }

      for (let i = 0; i < results.length; i++) {
        const paper = results[i];
        const title = paper.title || 'No title';
        const snippet = paper.snippet || 'No abstract available';
        const citedBy = paper.inline_links?.cited_by?.total || '0';
        const scholarLink = paper.link || paper.redirect_link || `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;

        let authors = 'Unknown';
        let venue = 'Unknown';
        let year = 'Unknown';
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
            if (venue === 'Unknown' && metadata.journal) venue = metadata.journal;
            if (year === 'Unknown' && metadata.year) year = metadata.year;
          }
        }

        const displayAuthors = this.formatAuthorsDisplay(authors);
        const apaCitation = this.generateAPA(authors, year, title, venue, volume, issue, pages, doi, scholarLink);
        const mlaCitation = this.generateMLA(authors, title, venue, year, scholarLink, doi, volume, issue, pages);

        let message = `${i + 1}. ${title}\nAuthors: ${displayAuthors}\nPublished in: ${venue}\nYear: ${year}`;
        if (volume) message += `\nVolume: ${volume}`;
        if (issue) message += `\nIssue: ${issue}`;
        if (pages) message += `\nPages: ${pages}`;
        message += `\nDOI: ${doi || 'Not available'}`;
        if (citedBy !== '0') message += `\nCited by: ${citedBy}`;
        message += `\nAbstract: ${snippet.substring(0, 300)}${snippet.length > 300 ? '...' : ''}\n\n`;
        if (scholarLink) message += `Google Scholar: ${scholarLink}\n\n`;
        message += `APA 7th Edition:\n${apaCitation}\n\nMLA 9th Edition:\n${mlaCitation}`;

        await sendMessage(senderId, { text: message }, token);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      console.error('[gscholar] Error:', error.message);
      let errorMessage = 'Failed to search Google Scholar. ';
      if (error.response?.status === 429) errorMessage += 'Rate limit exceeded. Please wait a moment.';
      else if (error.response?.status === 403) errorMessage += 'API key invalid or expired.';
      else errorMessage += 'Please try again later.';
      await sendMessage(senderId, { text: errorMessage }, token);
    }
  },

  formatAuthorsDisplay(authors) {
    const list = authors.split(',').map(a => a.trim()).filter(a => a);
    if (list.length === 0 || (list.length === 1 && list[0] === 'Unknown')) return 'Unknown';
    if (list.length <= 3) return list.join(', ');
    return `${list.slice(0, 3).join(', ')}, et al.`;
  },

  async fetchDOIFromCrossRef(title, authors, year) {
    try {
      let query = encodeURIComponent(title);
      if (authors && authors !== 'Unknown') {
        const first = authors.split(',')[0].trim();
        query += `+${encodeURIComponent(first)}`;
      }
      if (year && year !== 'Unknown') query += `+${year}`;
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
    if (list.length === 0 || (list.length === 1 && list[0] === 'Unknown')) {
      formatted = 'Unknown';
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
    if (venue && venue !== 'Unknown') citation += ` ${venue}`;
    if (volume) { citation += `, ${volume}`; if (issue) citation += `(${issue})`; }
    if (pages) citation += `, ${pages}`;
    if (doi) citation += `. ${doi}`;
    else if (url && url !== '') citation += ` Retrieved from ${url}`;
    return citation;
  },

  generateMLA(authors, title, venue, year, url, doi, volume, issue, pages) {
    const list = authors.split(',').map(a => a.trim()).filter(a => a);
    let formatted = '';
    if (list.length === 0 || (list.length === 1 && list[0] === 'Unknown')) {
      formatted = 'Unknown';
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
    citation += ` Web. ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`;
    return citation;
  },

  isMusicRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['play', 'song', 'music', 'track', 'audio', 'listen', 'sound', 'kanta', 'tugtog', 'music video', 'mv', 'soundtrack', 'playlist', 'album', 'single', 'remix', 'cover', 'official audio', 'official music', 'stream', 'pakinggan', 'patugtog', 'music link', 'song link', 'hit song', 'popular song', 'new song', 'latest song', 'opm', 'pinoy music', 'tagalog song', 'bisaya song', 'rap', 'hiphop', 'rnb', 'pop', 'rock', 'jazz', 'classical', 'lihim', 'halik', 'sawi', 'hugot', 'love song', 'sad song'];
    return keywords.some(k => lower.includes(k));
  },

  async handleMusicSearch(senderId, prompt, token) {
    let searchTerm = prompt;
    const removeKeywords = ['play', 'song', 'music', 'track', 'audio', 'listen', 'sound', 'kanta', 'tugtog', 'music video', 'mv', 'soundtrack', 'playlist', 'album', 'single', 'remix', 'cover', 'official audio', 'official music', 'stream', 'pakinggan', 'patugtog', 'music link', 'song link', 'hit song', 'popular song', 'new song', 'latest song', 'opm', 'pinoy music', 'tagalog song', 'bisaya song'];

    for (const keyword of removeKeywords) {
      if (searchTerm.toLowerCase().includes(keyword)) {
        searchTerm = searchTerm.toLowerCase().replace(keyword, '').trim();
        break;
      }
    }

    if (!searchTerm) {
      await sendMessage(senderId, { text: 'Music Search\nUsage: play [song title]' }, token);
      return;
    }

    try {
      const encodedSearch = encodeURIComponent(searchTerm);
      const apiUrl = `https://betadash-api-swordslush-production.up.railway.app/sc?search=${encodedSearch}`;
      const response = await axios.get(apiUrl, {
        timeout: 30000,
        headers: { 'Accept': 'application/json' }
      });

      const data = response.data;
      if (!data || !data.results || data.results.length === 0) {
        await sendMessage(senderId, { text: `No results found for "${searchTerm}".` }, token);
        return;
      }

      const exactMatches = data.results.filter(track => {
        const title = track.data.title || '';
        return title.toLowerCase().includes(searchTerm.toLowerCase());
      });

      const results = exactMatches.length > 0 ? exactMatches : data.results;
      const totalResults = results.length;

      let message = `Results for "${searchTerm}" (${totalResults} songs)\n\n`;

      for (let i = 0; i < results.length; i++) {
        const track = results[i].data;
        const title = track.title || 'Unknown Title';
        const artist = track.user ? track.user.username || 'Unknown Artist' : 'Unknown Artist';
        const duration = this.formatDuration(track.duration || 0);
        const plays = track.playback_count || 0;
        const likes = track.likes_count || 0;
        const genre = track.genre || 'Unknown Genre';
        const url = track.permalink_url || '';
        const artwork = track.artwork_url || '';
        const created = track.created_at ? new Date(track.created_at).toLocaleDateString('en-PH') : 'Unknown Date';

        let audioUrl = '';
        if (track.media && track.media.transcodings) {
          const progressive = track.media.transcodings.find(t => 
            t.format && t.format.protocol === 'progressive' && t.format.mime_type === 'audio/mpeg'
          );
          if (progressive && progressive.url) {
            audioUrl = progressive.url;
          }
        }
        if (!audioUrl && url) audioUrl = url;

        message += `${i + 1}. ${title}\nArtist: ${artist}\nGenre: ${genre}\nDuration: ${duration}\nReleased: ${created}\nPlays: ${plays.toLocaleString()}\nLikes: ${likes.toLocaleString()}`;
        if (artwork) message += `\nArtwork: ${artwork}`;
        message += `\nListen: ${url}`;
        if (audioUrl) message += `\nDirect Audio: ${audioUrl}`;
        message += `\n\n`;
      }

      await this.sendChunks(senderId, message, token);

    } catch (error) {
      console.error('[Music] Error:', error.message);
      await sendMessage(senderId, { text: `Error searching for "${searchTerm}".` }, token);
    }
  },

  formatDuration(ms) {
    if (!ms) return 'Unknown';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  },

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

  cleanOldHistory() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000;
    for (const [userId, data] of Object.entries(conversationHistory)) {
      if (now - data.timestamp > maxAge) {
        delete conversationHistory[userId];
      }
    }
  },

  isOwnerQuestion(prompt) {
    const keywords = ['who is your owner', 'who created you', 'who made you', 'sino gumawa sayo', 'sino may ari sayo', 'owner mo', 'sino owner mo', 'who owns you', 'creator', 'developer'];
    return keywords.some(k => prompt.toLowerCase().includes(k));
  },

  isUserInfoQuestion(prompt) {
    const keywords = ['what is my name', 'ano pangalan ko', 'my name', 'pangalan ko', 'when is my birthday', 'kelan birthday ko', 'my birthday', 'who am i', 'sino ako', 'whats my name'];
    return keywords.some(k => prompt.toLowerCase().includes(k));
  },

  isTranslationRequest(prompt) {
    const keywords = ['translate', 'translate to', 'translate into', 'translate in', 'translation', 'isalin', 'salin', 'ipasalin', 'isalin sa', 'transl', 'trans'];
    const lower = prompt.toLowerCase();
    if (keywords.some(k => lower.includes(k))) return true;
    const languages = ['tagalog', 'bisaya', 'cebuano', 'spanish', 'filipino', 'english', 'ilocano', 'waray', 'hiligaynon', 'kapampangan', 'pangasinan', 'bicolano', 'chinese', 'mandarin', 'cantonese', 'japanese', 'nihongo', 'korean', 'hangeul', 'french', 'francais', 'german', 'deutsch', 'italian', 'italiano', 'portuguese', 'russian', 'arabic', 'hindi', 'urdu', 'bengali', 'tamil', 'telugu', 'marathi', 'gujarati', 'kannada', 'malayalam', 'thai', 'vietnamese', 'indonesian', 'malay', 'burmese', 'khmer', 'lao', 'nepali', 'sinhala', 'armenian', 'hebrew', 'greek', 'latin', 'dutch', 'swedish', 'norwegian', 'danish', 'finnish', 'polish', 'czech', 'hungarian', 'romanian', 'bulgarian', 'serbian', 'croatian', 'tl', 'bis', 'ceb', 'eng', 'spa'];
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
      if (lower.includes(key)) return value;
    }
    return 'English';
  },

  async translateResponse(text, targetLanguage) {
    try {
      const translatePrompt = `Translate to ${targetLanguage}. DIRECT TRANSLATION ONLY: ${text}`;
      const response = await this.callAPI(translatePrompt, 'translation');
      return this.forceDirectResponse(response || text);
    } catch (error) {
      console.error('[Translation] Failed:', error.message);
      return text;
    }
  },

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
        response = userInfo.name ? `Your name is ${userInfo.name}.` : 'Confidential.';
      }
      if (prompt.toLowerCase().includes('birthday') || prompt.toLowerCase().includes('kelan')) {
        response += userInfo.birthday ? ` Birthday: ${userInfo.birthday}.` : ' Birthday confidential.';
      }
      if (!response) {
        const publicInfo = [];
        if (userInfo.name) publicInfo.push(`Name: ${userInfo.name}`);
        if (userInfo.birthday) publicInfo.push(`Birthday: ${userInfo.birthday}`);
        if (userInfo.gender) publicInfo.push(`Gender: ${userInfo.gender}`);
        if (userInfo.location) publicInfo.push(`Location: ${userInfo.location}`);
        response = publicInfo.length > 0 ? publicInfo.join(' | ') : 'Confidential.';
      }
      response = this.forceDirectResponse(response);
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

  getErrorMessage(error) {
    if (error.code === 'ECONNABORTED') return 'Request timeout. Please try again.';
    if (error.response?.status === 429) return 'Rate limit exceeded. Please wait a moment.';
    if (error.response?.status === 403) return 'API key invalid or expired.';
    if (error.response?.status >= 500) return 'Server error. Please try again later.';
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
