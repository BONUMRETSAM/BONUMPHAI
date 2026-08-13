const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const MAX_CHUNK = 1900;
const conversationHistory = {};
const SERPAPI_KEY = '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

// More reliable API endpoints
const API_ENDPOINTS = {
  // Primary AI - Multiple fallbacks
  primary: [
    {
      url: 'https://api.kenliejugarap.com/gpt4o/?question=',
      method: 'GET',
      responsePath: 'response',
      timeout: 30000
    },
    {
      url: 'https://openaikey-x20f.onrender.com/api',
      method: 'POST',
      responsePath: 'response',
      timeout: 30000
    },
    {
      url: 'https://ai-tools.replit.app/api/gpt4?prompt=',
      method: 'GET',
      responsePath: 'response',
      timeout: 30000
    }
  ],
  // Image Generation
  image: [
    'https://hiroshi-api.onrender.com/image/pinterest',
    'https://api.kenliejugarap.com/pinterest/?search='
  ],
  // Lyrics
  lyrics: 'https://api.kenliejugarap.com/lyrics/?title=',
  // Music
  music: 'https://api.kenliejugarap.com/soundcloud/?search=',
  // Real-time info
  realtime: [
    'https://api.kenliejugarap.com/gpt4o/?question=',
    'https://openaikey-x20f.onrender.com/api'
  ]
};

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

      // ========== STRICT COMMAND DETECTION ==========
      // Must start with command prefix
      const lowerPrompt = prompt.toLowerCase().trim();
      
      // 1. Lyrics Command - must start with 'lyrics' or 'letra'
      if (lowerPrompt.startsWith('lyrics') || lowerPrompt.startsWith('letra') || lowerPrompt.startsWith('song lyrics')) {
        await this.handleLyricsSearch(senderId, prompt, token);
        return;
      }

      // 2. Music Command - must start with 'play' or 'music' and not be a question
      if ((lowerPrompt.startsWith('play') || lowerPrompt.startsWith('music') || lowerPrompt.startsWith('pakinggan')) && 
          !this.isQuestion(prompt)) {
        await this.handleMusicSearch(senderId, prompt, token);
        return;
      }

      // 3. Generate/Image Command - must start with 'generate', 'image', 'img', 'show'
      if (lowerPrompt.startsWith('generate') || lowerPrompt.startsWith('image') || 
          lowerPrompt.startsWith('img') || lowerPrompt.startsWith('show')) {
        await this.handleImageGeneration(senderId, prompt, token);
        return;
      }

      // 4. Scholar Command - must start with 'gscholar', 'scholar', 'googlescholar', or 'research' as command
      if (lowerPrompt.startsWith('gscholar') || lowerPrompt.startsWith('scholar') || 
          lowerPrompt.startsWith('googlescholar') || lowerPrompt.startsWith('research ')) {
        await this.handleScholarSearch(senderId, prompt, token);
        return;
      }

      // 5. Real-time Questions - only for explicit time/date/news/weather
      if (this.isExplicitRealtimeQuestion(prompt)) {
        await this.handleRealtimeQuestion(senderId, prompt, token);
        return;
      }

      // ========== HANDLE REPLY/IMAGE ATTACHMENT ==========
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

      // ========== HANDLE CONVERSATION HISTORY ==========
      if (!isReply && prompt) {
        const history = conversationHistory[senderId];
        if (history && history.lastResponse) {
          // Only return to topic if explicitly stated
          if (this.isExplicitReturnToTopic(prompt)) {
            const topic = this.extractTopicFromReturn(prompt);
            if (topic && history.topicHistory && history.topicHistory[topic]) {
              previousResponse = history.topicHistory[topic];
              previousPrompt = topic;
              isReply = true;
            } else {
              delete conversationHistory[senderId];
            }
          } else {
            const isFollowUp = this.isFollowUpRequest(prompt) || 
                              this.isContextualQuestion(prompt, history.lastPrompt);
            const isNewTopic = this.isNewTopic(prompt, history.lastPrompt);
            
            if (isFollowUp && !isNewTopic) {
              previousResponse = history.lastResponse;
              previousPrompt = history.lastPrompt;
              isReply = true;
            } else {
              if (history.lastPrompt && history.lastResponse) {
                if (!history.topicHistory) history.topicHistory = {};
                const topicKey = history.lastPrompt.substring(0, 50);
                history.topicHistory[topicKey] = history.lastResponse;
              }
              delete conversationHistory[senderId];
            }
          }
        }
      }

      // ========== EMPTY PROMPT ==========
      if (!prompt && !isReply && !imageUrl) {
        await sendMessage(senderId, {
          text: '🤖 **Teacher Arlene - Multi-Modal AI**\n\n📌 **Capabilities:**\n• Text conversations\n• Image analysis\n• Academic research\n• Image generation\n• Music search\n• Lyrics search\n• Real-time info\n• Translation\n• Summarization\n\n📝 **Commands:**\n`ai [question]` - Ask anything\n`generate [query]` - Generate images\n`gscholar [query]` - Academic search\n`play [song]` - Find music\n`lyrics [song]` - Get lyrics'
        }, token);
        return;
      }

      // ========== SPECIAL QUESTIONS ==========
      if (this.isOwnerQuestion(prompt)) {
        await sendMessage(senderId, {
          text: '👨‍💻 I was created by **GeoDevz69**.\n\n📱 Visit: https://www.facebook.com/geotechph.net'
        }, token);
        return;
      }

      if (this.isUserInfoQuestion(prompt)) {
        await this.handleUserInfo(senderId, prompt, token);
        return;
      }

      // ========== MAIN AI RESPONSE ==========
      const wantsDetailed = this.wantsDetailedAnswer(prompt);
      let aiResponse = '';

      if (imageUrl) {
        aiResponse = await this.callGeminiAPI(prompt, imageUrl);
      } else {
        const finalPrompt = this.buildFinalPrompt(prompt, previousResponse, previousPrompt, isReply, wantsDetailed);
        const response = await this.callAIAPI(finalPrompt, senderId);
        aiResponse = this.cleanResponse(response || 'No response from API.');
      }

      if (!imageUrl && !isReply && !wantsDetailed) {
        aiResponse = this.shortenResponse(aiResponse);
      }

      // ========== SAVE HISTORY ==========
      conversationHistory[senderId] = {
        lastPrompt: prompt,
        lastResponse: aiResponse,
        timestamp: Date.now(),
        topicHistory: conversationHistory[senderId]?.topicHistory || {}
      };

      this.cleanOldHistory();

      // ========== TRANSLATION ==========
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

  // ========== HELPER: Check if prompt is a question ==========
  isQuestion(prompt) {
    const questionWords = ['what', 'why', 'how', 'when', 'where', 'who', 'which', 
                          'ano', 'bakit', 'paano', 'kailan', 'saan', 'sino', 'alin',
                          '?', 'is', 'are', 'am', 'do', 'does', 'did', 'can', 'will'];
    const lower = prompt.toLowerCase();
    return questionWords.some(w => lower.includes(w)) || prompt.includes('?');
  },

  // ========== STRICT COMMAND CHECKS ==========
  isExplicitReturnToTopic(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = ['balik tayo sa topic', 'balik sa topic', 'balikan natin', 
                      'going back to the topic', 'back to the topic', 'return to the topic'];
    return patterns.some(p => lower.includes(p));
  },

  isExplicitRealtimeQuestion(prompt) {
    const lower = prompt.toLowerCase();
    
    // Time requests
    const timeKeywords = ['anong oras', 'what time', 'what is the time', 'anong petsa', 
                         'what date', 'current time', 'current date', 'anong oras na'];
    if (timeKeywords.some(k => lower.includes(k))) return true;

    // News requests
    const newsKeywords = ['ano balita', 'what\'s the news', 'what is the news', 
                         'news today', 'balita ngayon', 'latest news'];
    if (newsKeywords.some(k => lower.includes(k))) return true;

    // Weather requests
    const weatherKeywords = ['weather today', 'panahon ngayon', 'anong panahon', 
                            'will it rain', 'temperature today'];
    if (weatherKeywords.some(k => lower.includes(k))) return true;

    // Price requests
    const priceKeywords = ['magkano', 'how much', 'price of', 'presyo ng'];
    if (priceKeywords.some(k => lower.includes(k))) return true;

    return false;
  },

  extractTopicFromReturn(prompt) {
    const lower = prompt.toLowerCase();
    const patterns = ['balik tayo sa topic', 'balik sa topic', 'balikan natin', 
                      'going back to the topic', 'back to the topic', 'return to the topic'];
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        const topic = prompt.substring(prompt.toLowerCase().indexOf(pattern) + pattern.length).trim();
        return topic || null;
      }
    }
    return null;
  },

  isNewTopic(prompt, previousPrompt) {
    if (!previousPrompt) return true;
    
    const lowerPrompt = prompt.toLowerCase();
    
    // Very short messages are often new topics
    if (prompt.length < 15 && !this.isFollowUpRequest(prompt)) return true;
    
    // Check for topic change indicators
    const indicators = ['hello', 'hi', 'hey', 'kamusta', 'musta', 'tanong', 'question',
                       'new topic', 'bagong topic', 'iba naman', 'lipat tayo', 'move on',
                       'gusto ko malaman', 'i want to know', 'tell me about'];
    if (indicators.some(i => lowerPrompt.includes(i)) && !this.isFollowUpRequest(prompt)) {
      return true;
    }
    
    // Check if words are related
    const prevWords = previousPrompt.split(' ').filter(w => w.length > 3);
    const currentWords = prompt.split(' ').filter(w => w.length > 3);
    const hasRelatedWords = prevWords.some(w => 
      currentWords.some(cw => cw.includes(w) || w.includes(cw))
    );
    
    return !hasRelatedWords && prompt.length > 5;
  },

  // ========== AI API CALLS ==========
  async callAIAPI(prompt, senderId) {
    const endpoints = API_ENDPOINTS.primary;
    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`[AI] Trying: ${endpoint.url}`);
        let response;
        
        if (endpoint.method === 'GET') {
          const url = endpoint.url + encodeURIComponent(prompt);
          response = await axios.get(url, {
            timeout: endpoint.timeout,
            headers: { 'Accept': 'application/json' }
          });
        } else {
          response = await axios.post(endpoint.url, { 
            prompt: prompt,
            question: prompt,
            message: prompt
          }, {
            timeout: endpoint.timeout,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Extract response
        let result = this.extractResponseData(response.data, endpoint.responsePath);
        if (result && result.trim().length > 0) {
          return result.trim();
        }
      } catch (error) {
        console.error(`[AI] Endpoint failed:`, error.message);
        lastError = error;
        continue;
      }
    }

    throw lastError || new Error('All AI endpoints failed');
  },

  extractResponseData(data, path) {
    if (!data) return null;
    
    // Try direct path
    if (path) {
      const parts = path.split('.');
      let value = data;
      for (const key of parts) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          value = null;
          break;
        }
      }
      if (value && typeof value === 'string' && value.trim()) return value;
    }

    // Try common response formats
    const formats = ['response', 'result', 'answer', 'message', 'text', 'content', 'data', 'reply'];
    for (const format of formats) {
      if (data[format] && typeof data[format] === 'string' && data[format].trim()) {
        return data[format];
      }
    }

    // If data is a string
    if (typeof data === 'string' && data.trim()) return data;

    return null;
  },

  // ========== GEMINI API ==========
  async callGeminiAPI(prompt, imageUrl) {
    try {
      const geminiPrompt = this.buildGeminiPrompt(prompt);
      const apiUrl = `https://norch-project.gleeze.com/api/gemini?prompt=${encodeURIComponent(geminiPrompt)}&imageurl=${encodeURIComponent(imageUrl)}`;

      let response = await axios.get(apiUrl, {
        timeout: 90000,
        headers: { 'Accept': 'application/json' }
      });

      if (response.data && response.data.response) {
        let processed = this.processGeminiResponse(response.data.response);
        return processed || 'Unable to analyze the image. Please try again.';
      }
      
      throw new Error('No response from Gemini API');
    } catch (error) {
      console.error('[Gemini] Error:', error.message);
      // Fallback: Use regular AI for image context
      const fallbackPrompt = `The user sent an image. The user asked: ${prompt || 'Please describe what you see in this image'}. Please provide a helpful response based on the image context.`;
      const response = await this.callAIAPI(fallbackPrompt, 'gemini_fallback');
      return this.cleanResponse(response || 'Unable to analyze the image. Please try again.');
    }
  },

  buildGeminiPrompt(userPrompt) {
    return `You are analyzing an image. DETECT the content type FIRST then respond accordingly:

CONTENT TYPES:
1. ACTIVITY SHEET/WORKSHEET/QUIZ - Provide accurate answers with explanations
2. MATH PROBLEMS - Show step-by-step solution
3. SCIENCE/DIAGRAMS - Identify parts and functions
4. TEXTBOOK/NOTES - Extract key concepts and summarize
5. MEME - Brief description and context
6. GENERAL IMAGE - Brief description

USER QUESTION: ${userPrompt || 'Analyze this image'}

Respond in plain text with clear structure.`;
  },

  processGeminiResponse(response) {
    let processed = response || '';
    processed = processed.replace(/\*\*/g, '').replace(/\*/g, '');
    processed = processed.replace(/#{1,6}\s/g, '');
    processed = processed.replace(/`/g, '');
    processed = processed.replace(/\n{3,}/g, '\n\n');
    return processed.trim();
  },

  // ========== IMAGE GENERATION ==========
  async handleImageGeneration(senderId, prompt, token) {
    let searchTerm = prompt;
    let imageCount = 10;

    // Remove command prefixes
    const commands = ['generate', 'image', 'img', 'show'];
    for (const cmd of commands) {
      if (searchTerm.toLowerCase().startsWith(cmd)) {
        searchTerm = searchTerm.slice(cmd.length).trim();
        break;
      }
    }

    // Remove common phrases
    const removePhrases = ['show me', 'give me', 'i want', 'sample', 'example', 
                          'picture of', 'image of', 'photo of', 'create', 'need',
                          'maghanap ng', 'gusto ko', 'patingin ng', 'ano itsura'];
    for (const phrase of removePhrases) {
      if (searchTerm.toLowerCase().includes(phrase)) {
        searchTerm = searchTerm.toLowerCase().replace(phrase, '').trim();
        break;
      }
    }

    // Extract number
    const args = searchTerm.split(' ');
    const lastArg = args[args.length - 1];
    if (!isNaN(lastArg) && lastArg > 0 && lastArg <= 30) {
      imageCount = parseInt(lastArg);
      searchTerm = args.slice(0, -1).join(' ');
    }

    if (!searchTerm) {
      await sendMessage(senderId, { 
        text: '🖼️ **Image Generation**\n\nUsage: `generate [search term] [number]`\n\nExamples:\n`generate cat`\n`generate beautiful sunset 5`' 
      }, token);
      return;
    }

    try {
      let allImages = [];
      
      // Try multiple endpoints
      const endpoints = API_ENDPOINTS.image;
      for (const endpoint of endpoints) {
        try {
          let url;
          if (endpoint.includes('pinterest')) {
            url = `${endpoint}?search=${encodeURIComponent(searchTerm)}&limit=100`;
          } else {
            url = `${endpoint}${encodeURIComponent(searchTerm)}`;
          }
          
          const response = await axios.get(url, { timeout: 15000 });
          const images = response.data?.data || response.data?.images || response.data?.results || [];
          if (Array.isArray(images)) {
            allImages = [...allImages, ...images];
          }
        } catch (e) {
          console.log('[Image] Endpoint failed:', e.message);
        }
      }

      // Remove duplicates and invalid URLs
      const validImages = [];
      const seen = new Set();
      for (const img of allImages) {
        const url = typeof img === 'string' ? img : img.url || img.image || img.link;
        if (url && this.isValidUrl(url) && !seen.has(url)) {
          validImages.push(url);
          seen.add(url);
        }
      }

      if (validImages.length === 0) {
        await sendMessage(senderId, { text: `❌ No images found for "${searchTerm}".` }, token);
        return;
      }

      // Shuffle and limit
      const shuffled = validImages.sort(() => Math.random() - 0.5);
      const resultImages = shuffled.slice(0, Math.min(imageCount, shuffled.length));

      // Send images
      for (let i = 0; i < resultImages.length; i++) {
        await sendMessage(senderId, {
          attachment: {
            type: 'image',
            payload: { url: resultImages[i] }
          }
        }, token);
        if (i < resultImages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      await sendMessage(senderId, { 
        text: `✅ Found ${resultImages.length} image(s) for "${searchTerm}"` 
      }, token);

    } catch (error) {
      console.error('[Image] Error:', error.message);
      await sendMessage(senderId, { 
        text: `❌ Error fetching images for "${searchTerm}". Please try again.` 
      }, token);
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

  // ========== MUSIC SEARCH ==========
  async handleMusicSearch(senderId, prompt, token) {
    let searchTerm = prompt;
    
    // Remove command prefixes
    const prefixes = ['play', 'music', 'pakinggan', 'patugtog'];
    for (const prefix of prefixes) {
      if (searchTerm.toLowerCase().startsWith(prefix)) {
        searchTerm = searchTerm.slice(prefix.length).trim();
        break;
      }
    }

    if (!searchTerm) {
      await sendMessage(senderId, { 
        text: '🎵 **Music Search**\n\nUsage: `play [song title]`\n\nExamples:\n`play lihim`\n`music halik`' 
      }, token);
      return;
    }

    try {
      const url = API_ENDPOINTS.music + encodeURIComponent(searchTerm);
      const response = await axios.get(url, { timeout: 20000 });
      
      const results = response.data?.data || response.data?.results || response.data || [];
      const tracks = Array.isArray(results) ? results : [];

      if (tracks.length === 0) {
        await sendMessage(senderId, { text: `❌ No music found for "${searchTerm}".` }, token);
        return;
      }

      let message = `🎵 **SoundCloud Results**\nSearch: "${searchTerm}"\nFound: ${tracks.length} song(s)\n\n`;

      for (let i = 0; i < Math.min(tracks.length, 5); i++) {
        const track = tracks[i];
        const title = track.title || track.name || 'Unknown Title';
        const artist = track.artist || track.user?.username || track.uploader || 'Unknown Artist';
        const duration = this.formatDuration(track.duration || track.duration_ms || 0);
        const url = track.url || track.permalink_url || track.link || '';
        const artwork = track.artwork_url || track.thumbnail || track.cover || '';

        message += `${i + 1}. **${title}**\n`;
        message += `Artist: ${artist}\n`;
        message += `Duration: ${duration}\n`;
        if (artwork) message += `Artwork: ${artwork}\n`;
        if (url) message += `Listen: ${url}\n`;
        message += '\n';
      }

      await this.sendChunks(senderId, message, token);

    } catch (error) {
      console.error('[Music] Error:', error.message);
      await sendMessage(senderId, { 
        text: `❌ Error searching for "${searchTerm}". Please try again later.` 
      }, token);
    }
  },

  formatDuration(ms) {
    if (!ms) return 'Unknown';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  },

  // ========== LYRICS SEARCH ==========
  async handleLyricsSearch(senderId, prompt, token) {
    let searchTerm = prompt;
    
    // Remove command prefixes
    const prefixes = ['lyrics', 'lyric', 'letra', 'song lyrics'];
    for (const prefix of prefixes) {
      if (searchTerm.toLowerCase().startsWith(prefix)) {
        searchTerm = searchTerm.slice(prefix.length).trim();
        break;
      }
    }

    // Extract title and artist
    let title = searchTerm;
    let artist = '';
    const parts = searchTerm.split(/\s+by\s+|\s+-\s+|\s+of\s+|\s+ng\s+|\s+ni\s+/i);
    if (parts.length > 1) {
      title = parts[0].trim();
      artist = parts[1].trim();
    }

    if (!title) {
      await sendMessage(senderId, { 
        text: '📝 **Lyrics Search**\n\nUsage: `lyrics [song title] by [artist]`\n\nExamples:\n`lyrics lihim by arthur miguel`\n`letra ng lihim`' 
      }, token);
      return;
    }

    try {
      let query = title;
      if (artist) query += ` ${artist}`;
      
      const url = API_ENDPOINTS.lyrics + encodeURIComponent(query);
      const response = await axios.get(url, { timeout: 15000 });
      
      const data = response.data;
      const lyricsData = data?.data || data?.result || data;

      if (!lyricsData || !lyricsData.lyrics) {
        await sendMessage(senderId, { 
          text: `❌ No lyrics found for "${title}".\n\nTry adding the artist name.` 
        }, token);
        return;
      }

      const songTitle = lyricsData.title || title;
      const songArtist = lyricsData.artist || artist || 'Unknown Artist';
      const lyrics = lyricsData.lyrics;

      let message = `📝 **${songTitle}**\nArtist: ${songArtist}\n\n${lyrics}`;

      await this.sendChunks(senderId, message, token);

    } catch (error) {
      console.error('[Lyrics] Error:', error.message);
      await sendMessage(senderId, { 
        text: `❌ Error fetching lyrics for "${title}". Please try again later.` 
      }, token);
    }
  },

  // ========== SCHOLAR SEARCH ==========
  async handleScholarSearch(senderId, prompt, token) {
    let query = prompt;
    
    // Remove command prefixes
    const prefixes = ['gscholar', 'scholar', 'googlescholar', 'research'];
    for (const prefix of prefixes) {
      if (query.toLowerCase().startsWith(prefix)) {
        query = query.slice(prefix.length).trim();
        break;
      }
    }

    if (!query) {
      await sendMessage(senderId, { 
        text: '📚 **Google Scholar Search**\n\nUsage: `gscholar [search query]`\n\nExamples:\n`gscholar coconut hybridization`\n`research machine learning`' 
      }, token);
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
        await sendMessage(senderId, { text: `❌ No results found for "${query}".` }, token);
        return;
      }

      for (let i = 0; i < results.length; i++) {
        const paper = results[i];
        const title = paper.title || 'No title';
        const snippet = paper.snippet || 'No abstract available';
        const citedBy = paper.inline_links?.cited_by?.total || '0';
        const scholarLink = paper.link || paper.redirect_link || '';

        let authors = 'Unknown';
        let venue = 'Unknown';
        let year = 'Unknown';
        
        if (paper.publication_info?.summary) {
          const summary = paper.publication_info.summary;
          const authorMatch = summary.match(/^([^-]+?)(?=\s*[,-]|\s*$)/);
          if (authorMatch) authors = authorMatch[1].trim();
          const venueMatch = summary.match(/[,-]\s*([^,]+?)(?=\s*[,-]|\s*$)/);
          if (venueMatch) venue = venueMatch[1].trim();
          const yearMatch = summary.match(/\b(19|20)\d{2}\b/);
          if (yearMatch) year = yearMatch[0];
        }

        let message = `${i + 1}. **${title}**\n\n`;
        message += `Authors: ${authors}\n`;
        message += `Published in: ${venue}\n`;
        message += `Year: ${year}\n`;
        message += `Cited by: ${citedBy}\n`;
        message += `\nAbstract: ${snippet.substring(0, 300)}${snippet.length > 300 ? '...' : ''}\n`;
        if (scholarLink) message += `\nLink: ${scholarLink}`;

        await sendMessage(senderId, { text: message }, token);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await sendMessage(senderId, { 
        text: `✅ Search Complete!\nQuery: "${query}"\nFound: ${results.length} papers` 
      }, token);

    } catch (error) {
      console.error('[Scholar] Error:', error.message);
      let errorMessage = '❌ Failed to search Google Scholar. ';
      if (error.response?.status === 429) {
        errorMessage += 'Rate limit exceeded. Please wait a moment.';
      } else if (error.response?.status === 403) {
        errorMessage += 'API key invalid or expired.';
      } else {
        errorMessage += 'Please try again later.';
      }
      await sendMessage(senderId, { text: errorMessage }, token);
    }
  },

  // ========== REAL-TIME INFO ==========
  async handleRealtimeQuestion(senderId, prompt, token) {
    // Check for time request first
    const timeKeywords = ['anong oras', 'what time', 'what is the time', 'anong petsa', 
                         'what date', 'current time', 'current date', 'anong oras na'];
    if (timeKeywords.some(k => prompt.toLowerCase().includes(k))) {
      await this.handleTimeRequest(senderId, token);
      return;
    }

    try {
      // Try real-time APIs
      const endpoints = API_ENDPOINTS.realtime;
      for (const endpoint of endpoints) {
        try {
          const url = endpoint + encodeURIComponent(prompt);
          const response = await axios.get(url, { timeout: 15000 });
          
          let result = this.extractResponseData(response.data, 'response');
          if (result && result.trim().length > 0) {
            await this.sendChunks(senderId, result, token);
            return;
          }
        } catch (e) {
          console.log('[Realtime] Endpoint failed:', e.message);
        }
      }
      
      // Fallback to regular AI
      const response = await this.callAIAPI(prompt, 'realtime_fallback');
      await this.sendChunks(senderId, response, token);

    } catch (error) {
      console.error('[Realtime] Error:', error.message);
      await sendMessage(senderId, { 
        text: '❌ Unable to fetch real-time information. Please try again later.' 
      }, token);
    }
  },

  async handleTimeRequest(senderId, token) {
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
      
      let message = `🕐 **Real-Time sa Pilipinas**\n\n${formattedTime}\n\nTimezone: Asia/Manila (UTC+8)`;

      await this.sendChunks(senderId, message, token);

    } catch (error) {
      console.error('[Time] Error:', error.message);
      
      // Fallback: Local time
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
      
      await sendMessage(senderId, { 
        text: `🕐 **Real-Time sa Pilipinas**\n\n${fallbackTime}\n\nTimezone: Asia/Manila (UTC+8)\nNote: Local system time` 
      }, token);
    }
  },

  // ========== USER INFO ==========
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
          ? `📋 **Your Public Information:**\n${publicInfo.join('\n')}`
          : 'I cannot tell you that because it is confidential.';
      }
      
      await sendMessage(senderId, { text: response }, token);
    } catch (error) {
      console.error('[User Info] Error:', error.message);
      await sendMessage(senderId, { text: '❌ Error fetching user info.' }, token);
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

  // ========== TRANSLATION ==========
  isTranslationRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['translate', 'translate to', 'translate into', 'translate in', 
                     'translation', 'isalin', 'salin', 'ipasalin', 'isalin sa'];
    if (keywords.some(k => lower.includes(k))) return true;
    
    const languages = ['tagalog', 'bisaya', 'cebuano', 'spanish', 'filipino', 'english', 
                      'ilocano', 'waray', 'hiligaynon', 'kapampangan', 'chinese', 'japanese',
                      'korean', 'french', 'german', 'italian', 'portuguese', 'russian'];
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
      'portuguese': 'Portuguese', 'russian': 'Russian'
    };
    for (const [key, value] of Object.entries(languages)) {
      if (lower.includes(key)) return value;
    }
    return 'English';
  },

  async translateResponse(text, targetLanguage) {
    try {
      const translatePrompt = `Translate this text to ${targetLanguage}. Only provide the translation, no other text: ${text}`;
      const response = await this.callAIAPI(translatePrompt, 'translation');
      return response || text;
    } catch (error) {
      console.error('[Translation] Failed:', error.message);
      return text;
    }
  },

  // ========== CONVERSATION HELPERS ==========
  isFollowUpRequest(prompt) {
    const keywords = ['translate', 'elaborate', 'explain more', 'paki elaborate', 'paliwanag',
                     'summarize', 'summary', 'shorten', 'simplify', 'example', 'sample',
                     'halimbawa', 'correct', 'fix', 'improve', 'add', 'additional',
                     'dagdagan', 'ulit', 'repeat', 'again', 'gets', 'nagets', 'understand',
                     'tama ba', 'correct ba', 'sure ba', 'talaga', 'really', 'clarify',
                     'linawin', 'humanize', 'make it human', 'conversational'];
    return keywords.some(k => prompt.toLowerCase().includes(k));
  },

  isContextualQuestion(prompt, previousPrompt) {
    if (!previousPrompt) return false;
    
    const patterns = ['so yan', 'so ito', 'so iyan', 'so yun', 'so ganyan', 'so ganito',
                     'tama ba', 'tama', 'correct', 'right', 'so tungkol', 'so sa',
                     'so para sa', 'paano naman', 'what about', 'how about', 'paano kung',
                     'what if', 'bakit', 'why', 'paano', 'how', 'kailan', 'when',
                     'saan', 'where', 'sino', 'who', 'alin', 'which', 'ano', 'what',
                     'gets', 'nagets', 'naintindihan', 'okay', 'sige', 'cge'];
    
    const isRelated = patterns.some(p => prompt.toLowerCase().includes(p));
    const prevWords = previousPrompt.split(' ').filter(w => w.length > 2);
    const currentWords = prompt.split(' ').filter(w => w.length > 2);
    const hasRelated = prevWords.some(w => currentWords.some(c => c.includes(w) || w.includes(c)));
    
    return isRelated || hasRelated;
  },

  wantsDetailedAnswer(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['explain more', 'more explanation', 'more details', 'detailed', 
                     'elaborate', 'paki elaborate', 'mas detalyado', 'tell me more',
                     'give more info', 'dagdagan', 'dagdag', 'further explain',
                     'full explanation', 'complete explanation', 'in depth', 'in-depth',
                     'thorough', 'comprehensive', 'expound', 'pakilinaw', 'linawin',
                     'more information', 'additional info', 'karagdagang'];
    return keywords.some(k => lower.includes(k));
  },

  shortenResponse(text) {
    if (!text) return text;
    const sentences = text.split(/(?<=[.!?])\s+/);
    let concise = sentences.slice(0, 3).join(' ');
    if (concise.length > 400) {
      concise = concise.substring(0, 400) + '...';
    }
    concise = concise.replace(/^(In summary|To summarize|In conclusion|Basically|Essentially|Simply put)\s*,?\s*/i, '')
                     .replace(/\s{2,}/g, ' ')
                     .trim();
    return concise || text;
  },

  isOwnerQuestion(prompt) {
    const keywords = ['who is your owner', 'who created you', 'who made you', 
                     'sino gumawa sayo', 'sino may ari sayo', 'owner mo', 
                     'sino owner mo', 'who owns you', 'creator', 'developer'];
    return keywords.some(k => prompt.toLowerCase().includes(k));
  },

  isUserInfoQuestion(prompt) {
    const keywords = ['what is my name', 'ano pangalan ko', 'my name', 'pangalan ko',
                     'when is my birthday', 'kelan birthday ko', 'my birthday',
                     'who am i', 'sino ako', 'whats my name'];
    return keywords.some(k => prompt.toLowerCase().includes(k));
  },

  // ========== RESPONSE CLEANING ==========
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
    // Remove emojis (optional - keep if you want to keep emojis, remove if not)
    // cleaned = cleaned.replace(/[\u{1F000}-\u{1FFFF}]/gu, '');
    return cleaned.trim() || 'No response.';
  },

  buildFinalPrompt(prompt, previousResponse, previousPrompt, isReply, wantsDetailed) {
    let final = '';

    if (previousResponse) {
      final += 'Previous conversation context:\n';
      final += 'User asked: ' + (previousPrompt || 'unknown') + '\n';
      final += 'AI responded: ' + previousResponse + '\n\n';
      final += 'User now says: ' + prompt + '\n\n';
    } else {
      final = prompt;
    }

    if (wantsDetailed) {
      final += '\nProvide a detailed and thorough explanation.';
    } else {
      final += '\nProvide a concise and direct answer.';
    }

    final += '\nBe accurate and helpful. Respond in plain text.';

    return final;
  },

  // ========== UTILITY FUNCTIONS ==========
  getErrorMessage(error) {
    if (error.code === 'ECONNABORTED') return '⏱️ Request timeout. Please try again.';
    if (error.response?.status === 429) return '⏳ Rate limit exceeded. Please wait a moment.';
    if (error.response?.status === 403) return '🔑 API key invalid or expired.';
    if (error.response?.status >= 500) return '🔧 Server error. Please try again later.';
    return '❌ Error processing request. Please try again.';
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
  },

  cleanOldHistory() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    for (const [userId, data] of Object.entries(conversationHistory)) {
      if (now - data.timestamp > maxAge) {
        delete conversationHistory[userId];
      }
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
  }
};
