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

      // Detect language of the prompt
      const detectedLanguage = this.detectLanguage(prompt);
      
      // Check if this is a casual conversation
      const isCasualConversation = this.isCasualConversation(prompt);

      // Check for lyrics request FIRST (more specific)
      if (this.isLyricsRequest(prompt)) {
        await this.handleLyricsSearch(senderId, prompt, token);
        return;
      }

      // Check for realtime questions
      if (this.isRealtimeQuestion(prompt)) {
        await this.handleRealtimeQuestion(senderId, prompt, token);
        return;
      }

      // Check for generate command (only if starts with command)
      if (this.isGenerateCommand(prompt)) {
        await this.handleImageGeneration(senderId, prompt, token);
        return;
      }

      // Check for image request (more specific patterns)
      if (this.isImageRequest(prompt)) {
        await this.handleImageGeneration(senderId, prompt, token);
        return;
      }

      // Check for music request
      if (this.isMusicRequest(prompt)) {
        await this.handleMusicSearch(senderId, prompt, token);
        return;
      }

      // Check for scholar command (only if starts with command)
      if (this.isScholarCommand(prompt)) {
        await this.handleScholarSearch(senderId, prompt, token);
        return;
      }

      // Check for research query (more specific patterns)
      if (this.isResearchQuery(prompt)) {
        await this.handleScholarSearch(senderId, prompt, token);
        return;
      }

      // Check for return to topic BEFORE processing as new topic
      if (this.isReturnToTopicRequest(prompt)) {
        const history = conversationHistory[senderId];
        const topic = this.extractTopicFromReturn(prompt);
        
        if (history && topic && history.topicHistory && history.topicHistory[topic]) {
          previousResponse = history.topicHistory[topic];
          previousPrompt = topic;
          isReply = true;
        } else if (history && history.lastResponse) {
          previousResponse = history.lastResponse;
          previousPrompt = history.lastPrompt;
          isReply = true;
        }
      }

      // Check if user replied to a message
      if (event?.message?.reply_to?.mid) {
        isReply = true;
        const replyData = await this.getRepliedMessageData(event.message.reply_to.mid, token);
        previousResponse = replyData.message;
        imageUrl = replyData.imageUrl;
        if (!prompt) prompt = 'Please respond to what I said.';
      }

      // Check for image attachments
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

      // Process conversation context - IMPROVED
      if (!isReply && prompt && !imageUrl) {
        const history = conversationHistory[senderId];
        if (history && history.lastResponse) {
          const lowerPrompt = prompt.toLowerCase();
          
          // Check if this is a modification request (like "make it short")
          const isModification = this.isModificationRequest(lowerPrompt);
          
          // Check if this is a follow-up question
          const isFollowUp = this.isFollowUpRequest(lowerPrompt) || 
                            this.isContextualQuestion(lowerPrompt, history.lastPrompt) ||
                            isModification;
          
          const isNewTopic = this.isNewTopic(lowerPrompt, history.lastPrompt, prompt);
          
          // IMPORTANT: For modification requests, always use previous context
          if (isModification && !isNewTopic) {
            previousResponse = history.lastResponse;
            previousPrompt = history.lastPrompt || 'image analysis';
            isReply = true;
          } else if (isFollowUp && !isNewTopic) {
            previousResponse = history.lastResponse;
            previousPrompt = history.lastPrompt || 'image analysis';
            isReply = true;
          } else if (!isNewTopic && history.hasImageContext) {
            // If we have image context and user is asking follow-up
            previousResponse = history.lastResponse;
            previousPrompt = history.lastPrompt || 'image analysis';
            isReply = true;
          }
        }
      }

      if (!prompt && !isReply && !imageUrl) {
        await sendMessage(senderId, {
          text: 'Hello! Ako si Teacher Arlene - Multi-Modal AI.\n\nMga Kakayahan:\nText conversations\nImage analysis\nAcademic research\nImage generation\nMusic search\nLyrics search\nReal-life situations\nTranslation\nSummarization\n\nMga Commands:\nai [tanong]\nMag-send ng image para ma-analyze\ngenerate [search term] [number]\ngscholar [search query]\nplay [song title]\nlyrics [song title] by [artist]\n\nKaya kong makipag-usap sa Tagalog, Bisaya, English, at iba pang wika.'
        }, token);
        return;
      }

      if (this.isOwnerQuestion(prompt)) {
        await sendMessage(senderId, {
          text: 'Ako ay ginawa ni GeoDevz69. Bisitahin dito para sa karagdagang impormasyon:\nhttps://www.facebook.com/geotechph.net'
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
        // New image analysis
        aiResponse = await this.callGeminiAPI(prompt, imageUrl, detectedLanguage);
        
        conversationHistory[senderId] = {
          lastPrompt: prompt || 'Image analysis',
          lastResponse: aiResponse,
          lastImageUrl: imageUrl,
          hasImageContext: true,
          language: detectedLanguage,
          timestamp: Date.now(),
          topicHistory: conversationHistory[senderId]?.topicHistory || {}
        };
        
        const topicKey = this.extractTopicKey(prompt || 'image');
        if (topicKey) {
          conversationHistory[senderId].topicHistory[topicKey] = aiResponse;
        }
        
      } else if (isReply && previousResponse) {
        const history = conversationHistory[senderId];
        const responseLanguage = history?.language || detectedLanguage;
        
        // IMPORTANT: If this is a modification to image analysis
        if (history?.hasImageContext && this.isModificationRequest(prompt.toLowerCase())) {
          // Build special prompt for modifying image analysis
          const finalPrompt = this.buildImageModificationPrompt(prompt, previousResponse, wantsDetailed, responseLanguage);
          const response = await this.callAPI(finalPrompt, senderId);
          aiResponse = this.cleanResponse(response || 'No response from API.');
        } else if (history?.hasImageContext && !imageUrl) {
          const finalPrompt = this.buildImageFollowUpPrompt(prompt, previousResponse, previousPrompt, wantsDetailed, responseLanguage);
          const response = await this.callAPI(finalPrompt, senderId);
          aiResponse = this.cleanResponse(response || 'No response from API.');
        } else {
          const finalPrompt = this.buildFinalPrompt(prompt, previousResponse, previousPrompt, isReply, wantsDetailed, responseLanguage);
          const response = await this.callAPI(finalPrompt, senderId);
          aiResponse = this.cleanResponse(response || 'No response from API.');
        }
        
        if (!wantsDetailed && !this.isModificationRequest(prompt.toLowerCase())) {
          aiResponse = this.shortenResponse(aiResponse);
        }
        
        conversationHistory[senderId] = {
          lastPrompt: prompt,
          lastResponse: aiResponse,
          lastImageUrl: history?.lastImageUrl || null,
          hasImageContext: history?.hasImageContext || false,
          language: responseLanguage || detectedLanguage,
          timestamp: Date.now(),
          topicHistory: conversationHistory[senderId]?.topicHistory || {}
        };
        
      } else {
        // For casual conversations, use a more natural prompt
        if (isCasualConversation) {
          const finalPrompt = this.buildCasualPrompt(prompt, detectedLanguage);
          const response = await this.callAPI(finalPrompt, senderId);
          aiResponse = this.cleanResponse(response || 'No response from API.');
        } else {
          const finalPrompt = this.buildFinalPrompt(prompt, null, null, false, wantsDetailed, detectedLanguage);
          const response = await this.callAPI(finalPrompt, senderId);
          aiResponse = this.cleanResponse(response || 'No response from API.');
        }
        
        if (!wantsDetailed && !isCasualConversation) {
          aiResponse = this.shortenResponse(aiResponse);
        }
        
        conversationHistory[senderId] = {
          lastPrompt: prompt,
          lastResponse: aiResponse,
          lastImageUrl: null,
          hasImageContext: false,
          language: detectedLanguage,
          timestamp: Date.now(),
          topicHistory: conversationHistory[senderId]?.topicHistory || {}
        };
        
        const topicKey = this.extractTopicKey(prompt);
        if (topicKey) {
          conversationHistory[senderId].topicHistory[topicKey] = aiResponse;
        }
      }

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

  // New method to detect casual conversation
  isCasualConversation(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    
    const casualPatterns = [
      // Tagalog casual
      'kamusta', 'kumusta', 'musta', 'msta', 'kamusta ka', 'kumusta ka',
      'ano ginagawa mo', 'anong ginagawa mo', 'ano gawa mo', 'anong gawa mo',
      'ano balita', 'anong balita', 'kamusta na', 'kumusta na',
      'ayos lang', 'ok lang', 'buti naman', 'mabuti naman',
      'salamat', 'sige', 'cge', 'ge', 'ok', 'okay',
      'hehe', 'haha', 'hahaha', 'lol', 'hmm', 'ah', 'oh',
      'nice', 'galing', 'astig', 'ayos', 'magaling',
      'ikaw', 'ikaw ba', 'ikaw naman', 'eh ikaw',
      // Bisaya casual
      'kumusta', 'kamusta', 'musta', 'unsa ka', 'unsa man',
      'naunsa ka', 'unsa imong gibuhat', 'unsa gibuhat nimo',
      'unsa balita', 'kumusta na', 'ok ra', 'maayo ra',
      'salamat', 'sige', 'cge', 'ge', 'ok', 'okay',
      'ikaw', 'ikaw ba', 'ikaw sad', 'ikaw pud',
      // English casual
      'how are you', 'hows it going', 'whats up', 'what are you doing',
      'how you doing', 'how are ya', 'sup', 'yo',
      'thanks', 'thank you', 'ok', 'okay', 'nice', 'cool',
      'hows your day', 'how is your day', 'whats new'
    ];
    
    return casualPatterns.some(p => lower.includes(p));
  },

  // New method to build casual conversation prompt
  buildCasualPrompt(prompt, language) {
    const langName = this.getLanguageName(language);
    let final = '';
    
    final += `You are having a CASUAL CONVERSATION with a user in ${langName.toUpperCase()}.\n`;
    final += `The user said: "${prompt}"\n\n`;
    final += `IMPORTANT INSTRUCTIONS:\n`;
    final += `- Respond NATURALLY in ${langName.toUpperCase()} like a real person chatting.\n`;
    final += `- Do NOT translate the user's message back to them.\n`;
    final += `- Do NOT say "You asked..." or "This means...".\n`;
    final += `- Just respond directly to what they said.\n`;
    final += `- Be friendly, warm, and conversational.\n`;
    final += `- Use appropriate casual language for ${langName.toUpperCase()}.\n`;
    final += `- If they ask how you are, respond naturally (like "Okay lang ako, ikaw?" in Tagalog or "OK ra ko, ikaw?" in Bisaya).\n`;
    final += `- Keep responses SHORT and NATURAL (1-2 sentences).\n`;
    final += `- Don't be too formal or robotic.\n`;
    final += `- If they say thanks, respond with "Walang anuman!" (Tagalog), "Way sapayan!" (Bisaya), or "You're welcome!" (English).\n\n`;
    final += `EXAMPLES:\n`;
    
    if (language === 'tagalog') {
      final += `User: "Kamusta ka?"\n`;
      final += `AI: "Okay lang ako, salamat sa pagtanong! Ikaw, kamusta ka naman?"\n\n`;
      final += `User: "Ano ginagawa mo?"\n`;
      final += `AI: "Nandito lang ako, handang tumulong sa'yo! May kailangan ka ba?"\n\n`;
    } else if (language === 'bisaya' || language === 'cebuano') {
      final += `User: "Kumusta ka?"\n`;
      final += `AI: "OK ra ko, salamat sa pagpangutana! Ikaw, kumusta ka?"\n\n`;
      final += `User: "Unsa imong gibuhat?"\n`;
      final += `AI: "Ania ra ko, andam motabang nimo! Naay kinahanglan?"\n\n`;
    } else {
      final += `User: "How are you?"\n`;
      final += `AI: "I'm doing well, thanks for asking! How about you?"\n\n`;
      final += `User: "What are you doing?"\n`;
      final += `AI: "Just here, ready to help! What do you need?"\n\n`;
    }
    
    final += `NOW RESPOND TO THE USER'S MESSAGE IN ${langName.toUpperCase()}.`;
    
    return final;
  },

  // New method for image modification (like "make it short")
  buildImageModificationPrompt(prompt, previousResponse, wantsDetailed, language) {
    const langName = this.getLanguageName(language);
    let final = '';
    
    final += `PREVIOUS IMAGE ANALYSIS:\n`;
    final += previousResponse + '\n\n';
    final += `USER REQUEST: "${prompt}"\n\n`;
    
    const lower = prompt.toLowerCase();
    
    if (lower.includes('short') || lower.includes('concise') || lower.includes('brief') || 
        lower.includes('maikli') || lower.includes('iklian') || lower.includes('paikliin') ||
        lower.includes('ikli') || lower.includes('mubo') || lower.includes('muboa') ||
        lower.includes('halipot') || lower.includes('halipota') || lower.includes('malip-ot') ||
        lower.includes('lip-ota') || lower.includes('makuyad') || lower.includes('kuyaran') ||
        lower.includes('ababa') || lower.includes('ababaen') || lower.includes('corto') ||
        lower.includes('corta') || lower.includes('court') || lower.includes('courte') ||
        lower.includes('kurz') || lower.includes('pakiikli') || lower.includes('gawing maikli')) {
      final += `Make the previous image analysis SHORTER and more CONCISE.\n`;
      final += `Extract only the KEY POINTS in a brief format.\n`;
      final += `Remove all unnecessary explanations and keep only the essential information.\n`;
      final += `Maximum 3-5 bullet points or 2-3 sentences.\n\n`;
    } else if (lower.includes('clear') || lower.includes('clarify') || lower.includes('linaw') ||
               lower.includes('malinaw') || lower.includes('ilinaw') || lower.includes('linawin') ||
               lower.includes('klaro') || lower.includes('klaruha') || lower.includes('nalawag') ||
               lower.includes('lawagan') || lower.includes('malino') || lower.includes('linawan') ||
               lower.includes('claro') || lower.includes('clara') || lower.includes('clair') ||
               lower.includes('claire') || lower.includes('klar')) {
      final += `Make the previous image analysis CLEARER and easier to understand.\n`;
      final += `Rephrase it in simpler terms and provide a clearer explanation.\n\n`;
    } else if (lower.includes('simple') || lower.includes('simplify') || lower.includes('pasimplehin') ||
               lower.includes('simplehan') || lower.includes('pasimplehon') ||
               lower.includes('pasimpleha') || lower.includes('pasimpleen') ||
               lower.includes('pasimplehan') || lower.includes('simplificar') ||
               lower.includes('simplifier') || lower.includes('einfach')) {
      final += `Provide a SIMPLER explanation of the previous image analysis.\n`;
      final += `Use basic language and avoid technical terms.\n\n`;
    } else if (lower.includes('detail') || lower.includes('elaborate') || lower.includes('explain more') ||
               lower.includes('detalyado') || lower.includes('mas detalyado') || lower.includes('dagdagan') ||
               lower.includes('dagdag') || lower.includes('karagdagang') || lower.includes('additional') ||
               lower.includes('more') || lower.includes('expand') || lower.includes('paliwanag') ||
               lower.includes('ipaliwanag') || lower.includes('explain') || lower.includes('paki explain') ||
               lower.includes('paki elaborate')) {
      final += `Provide MORE DETAILS about the previous image analysis.\n`;
      final += `Expand on each point with additional information.\n\n`;
    } else if (lower.includes('summar') || lower.includes('summary') || lower.includes('buod') ||
               lower.includes('paki summarize') || lower.includes('i-summarize')) {
      final += `Provide a SUMMARY of the previous image analysis.\n`;
      final += `Give only the most important points in a brief format.\n\n`;
    } else {
      final += `The user wants you to modify the previous image analysis as requested.\n`;
      final += `Apply the user's request to the previous analysis.\n\n`;
    }
    
    final += `IMPORTANT:\n`;
    final += `- This is based on the PREVIOUS IMAGE ANALYSIS.\n`;
    final += `- Do NOT ask the user to upload the image again.\n`;
    final += `- Do NOT say you cannot see the image.\n`;
    final += `- Use the previous analysis as your reference.\n`;
    final += `- Respond in ${langName.toUpperCase()}.\n`;
    final += `- Provide the modified version directly.\n`;
    
    return final;
  },

  // Multi-language detection method
  detectLanguage(prompt) {
    if (!prompt) return 'english';
    const lower = prompt.toLowerCase();
    
    const languages = {
      tagalog: {
        keywords: ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho', 'ako', 'ikaw', 'siya', 'kami', 'tayo', 'kayo', 'sila', 'ito', 'iyan', 'iyon', 'nito', 'niyan', 'niyon', 'dito', 'diyan', 'doon', 'ganito', 'ganyan', 'ganoon', 'gusto', 'ayaw', 'pwede', 'maaari', 'dapat', 'kailangan', 'meron', 'mayroon', 'wala', 'hindi', 'oo', 'salamat', 'paki', 'pakiusap', 'mangyaring', 'tungkol', 'ukol', 'hinggil', 'patungkol', 'tanong', 'sagot', 'sabi', 'salita', 'kwento', 'gumawa', 'gawin', 'magbigay', 'ipakita', 'sabihin', 'tingnan', 'basahin', 'unawain', 'intindihin', 'intindi', 'tulong', 'tulungan', 'paliwanag', 'ipaliwanag', 'linawin', 'ikli', 'iklian', 'simplehan', 'pasimplehin', 'paikliin', 'ano', 'bakit', 'paano', 'saan', 'kailan', 'sino', 'alin', 'magkano', 'kamusta', 'kumusta', 'musta', 'ginagawa', 'gawa', 'balita', 'ayos', 'buti', 'mabuti'],
        minMatches: 2
      },
      bisaya: {
        keywords: ['ako', 'ikaw', 'siya', 'kami', 'kita', 'kamo', 'sila', 'kini', 'kana', 'kadto', 'dinhi', 'diha', 'didto', 'unsa', 'ngano', 'giunsa', 'asa', 'kanus-a', 'kinsa', 'pila', 'gusto', 'ayaw', 'pwede', 'mahimo', 'kinahanglan', 'naa', 'wala', 'dili', 'oo', 'salamat', 'palihug', 'bahin', 'pangutana', 'tubag', 'sulti', 'pulong', 'istorya', 'buhaton', 'hatagan', 'ipakita', 'isulti', 'tan-awa', 'basaha', 'sabta', 'tabang', 'tabangi', 'pasabta', 'pasabton', 'mubo', 'muboa', 'simple', 'pasimplehon', 'klaro', 'klaruha', 'kumusta', 'kamusta', 'naunsa', 'gibuhat', 'balita', 'maayo', 'ok'],
        minMatches: 2
      },
      cebuano: {
        keywords: ['ako', 'ikaw', 'siya', 'kami', 'kita', 'kamo', 'sila', 'kini', 'kana', 'kadto', 'dinhi', 'diha', 'didto', 'unsa', 'ngano', 'giunsa', 'asa', 'kanus-a', 'kinsa', 'pila', 'gusto', 'ayaw', 'pwede', 'mahimo', 'kinahanglan', 'naa', 'wala', 'dili', 'oo', 'salamat', 'palihug', 'bahin', 'pangutana', 'tubag', 'sulti', 'pulong', 'istorya', 'buhaton', 'hatagan', 'ipakita', 'isulti', 'tan-awa', 'basaha', 'sabta', 'tabang', 'tabangi', 'pasabta', 'pasabton', 'mubo', 'muboa', 'simple', 'pasimplehon', 'klaro', 'klaruha', 'kumusta', 'kamusta', 'naunsa', 'gibuhat', 'balita', 'maayo', 'ok'],
        minMatches: 2
      },
      ilocano: {
        keywords: ['siak', 'sika', 'isu', 'dakami', 'datayo', 'dakayo', 'isuda', 'daytoy', 'dayta', 'daydiay', 'ditoy', 'dita', 'idiay', 'ania', 'apay', 'kasano', 'sadino', 'kaano', 'sino', 'mano', 'kayat', 'saan', 'mabalin', 'masapul', 'adda', 'awan', 'wen', 'salamat', 'pangngaasi', 'maipanggep', 'saludsod', 'sungbat', 'baga', 'sao', 'aramiden', 'ited', 'iparang', 'ibaga', 'kitaen', 'basaen', 'awaten', 'tulong', 'tulungan', 'ilawlawag', 'lawag', 'ababa', 'ababaen', 'simple', 'pasimpleen', 'nalawag', 'lawagan'],
        minMatches: 2
      },
      waray: {
        keywords: ['ako', 'ikaw', 'hiya', 'kami', 'kita', 'kamo', 'hira', 'ini', 'iton', 'didto', 'dinhi', 'dida', 'ano', 'kayano', 'paano', 'hain', 'san-o', 'hin-o', 'pira', 'karuyag', 'diri', 'puyde', 'kinahanglan', 'mayda', 'waray', 'oo', 'salamat', 'alayon', 'mahitungod', 'pakiana', 'baton', 'siring', 'pulong', 'buhaton', 'hatagan', 'ipakita', 'isiring', 'kitaa', 'basaha', 'sabta', 'bulig', 'buligi', 'pasabta', 'halipot', 'halipota', 'simple', 'pasimpleha', 'klaro', 'klaroha'],
        minMatches: 2
      },
      hiligaynon: {
        keywords: ['ako', 'ikaw', 'siya', 'kami', 'kita', 'kamo', 'sila', 'ini', 'ina', 'adto', 'diri', 'dira', 'didto', 'ano', 'ngaa', 'paano', 'diin', 'san-o', 'sin-o', 'pila', 'luyag', 'indi', 'pwede', 'kinahanglan', 'may', 'wala', 'huo', 'salamat', 'palihog', 'nahanungod', 'pamangkot', 'sabat', 'hambal', 'pulong', 'himuon', 'hatagan', 'ipakita', 'ihambal', 'tan-awa', 'basaha', 'intindiha', 'bulig', 'buligan', 'paathag', 'ipathag', 'malip-ot', 'lip-ota', 'simple', 'pasimpleha', 'klaro', 'klaruha'],
        minMatches: 2
      },
      kapampangan: {
        keywords: ['aku', 'ika', 'iya', 'ikami', 'ikatamu', 'ikayu', 'ila', 'ini', 'ita', 'keni', 'keta', 'keta', 'nanu', 'obakit', 'makananu', 'nukarin', 'kapilan', 'ninu', 'pilang', 'buri', 'ali', 'malyari', 'kailangan', 'atin', 'ala', 'wa', 'salamat', 'pakisabi', 'tungkul', 'tanong', 'sagot', 'sabi', 'amanu', 'gawan', 'ibie', 'pakit', 'sabian', 'tiran', 'basan', 'intindian', 'saup', 'saupan', 'paliwanag', 'ipaliwanag', 'makuyad', 'kuyaran', 'simple', 'pasimplehan', 'malino', 'linawan'],
        minMatches: 2
      },
      spanish: {
        keywords: ['hola', 'como', 'que', 'por', 'para', 'gusta', 'quiero', 'puede', 'necesito', 'tiene', 'hay', 'no', 'sí', 'gracias', 'favor', 'sobre', 'pregunta', 'respuesta', 'decir', 'palabra', 'hacer', 'dar', 'mostrar', 'ver', 'leer', 'entender', 'ayuda', 'ayudar', 'explicar', 'explicación', 'corto', 'corta', 'simple', 'simplificar', 'claro', 'clara', 'aclarar'],
        minMatches: 2
      },
      japanese: {
        keywords: ['こんにちは', 'ありがとう', 'ください', 'です', 'ます', '何', 'なぜ', 'どうやって', 'どこ', 'いつ', '誰', 'いくら', '欲しい', 'できる', '必要', 'ある', 'ない', 'はい', 'いいえ', 'お願い', 'ついて', '質問', '答え', '言う', '言葉', '作る', '与える', '見せる', '見る', '読む', '理解', '助け', '助ける', '説明', '短い', 'シンプル', '明確'],
        minMatches: 1
      },
      korean: {
        keywords: ['안녕하세요', '감사합니다', '주세요', '입니다', '습니다', '무엇', '왜', '어떻게', '어디', '언제', '누구', '얼마', '원해요', '할수있다', '필요', '있다', '없다', '네', '아니요', '부탁', '대해', '질문', '대답', '말', '단어', '만들다', '주다', '보여주다', '보다', '읽다', '이해', '도움', '돕다', '설명', '짧은', '간단', '명확'],
        minMatches: 1
      },
      chinese: {
        keywords: ['你好', '谢谢', '请', '是', '什么', '为什么', '怎么', '哪里', '什么时候', '谁', '多少', '想要', '可以', '需要', '有', '没有', '对', '不', '关于', '问题', '回答', '说', '词', '做', '给', '显示', '看', '读', '理解', '帮助', '解释', '短', '简单', '清楚'],
        minMatches: 1
      },
      french: {
        keywords: ['bonjour', 'merci', 'sil', 'plaît', 'est', 'quoi', 'pourquoi', 'comment', 'où', 'quand', 'qui', 'combien', 'veux', 'peux', 'besoin', 'avoir', 'pas', 'oui', 'non', 'sur', 'question', 'réponse', 'dire', 'mot', 'faire', 'donner', 'montrer', 'voir', 'lire', 'comprendre', 'aide', 'aider', 'expliquer', 'explication', 'court', 'courte', 'simple', 'simplifier', 'clair', 'claire'],
        minMatches: 2
      },
      german: {
        keywords: ['hallo', 'danke', 'bitte', 'ist', 'was', 'warum', 'wie', 'wo', 'wann', 'wer', 'wieviel', 'möchte', 'kann', 'brauche', 'haben', 'nicht', 'ja', 'nein', 'über', 'frage', 'antwort', 'sagen', 'wort', 'machen', 'geben', 'zeigen', 'sehen', 'lesen', 'verstehen', 'hilfe', 'helfen', 'erklären', 'erklärung', 'kurz', 'einfach', 'klar'],
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
      
      // Check for multi-word phrases
      for (const keyword of config.keywords) {
        if (keyword.includes(' ') && lower.includes(keyword)) {
          matchCount += 2; // Give more weight to phrases
        }
      }
      
      if (matchCount >= config.minMatches && matchCount > bestScore) {
        bestMatch = lang;
        bestScore = matchCount;
      }
    }
    
    return bestMatch;
  },

  // Get language name from code
  getLanguageName(languageCode) {
    const languageNames = {
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
    return languageNames[languageCode] || 'English';
  },

  // Updated isModificationRequest method (more comprehensive)
  isModificationRequest(prompt) {
    const lower = prompt.toLowerCase();
    const patterns = [
      'make it short', 'make it shorter', 'make it concise', 'make it brief',
      'make it simple', 'make it simpler', 'make it clear', 'make it clearer',
      'shorten it', 'simplify it', 'clarify it', 'explain more',
      'explain further', 'elaborate', 'more details', 'more information',
      'tell me more', 'expand', 'summarize', 'summary', 'brief', 'concise',
      'short', 'simple', 'clear', 'detailed', 'detail', 'in depth',
      'in-depth', 'thorough', 'comprehensive', 'translate', 'translation',
      'explain', 'explanation', 'what do you mean', 'what does it mean',
      'what is that', 'what is this', 'can you explain', 'can you clarify',
      'can you elaborate', 'can you simplify', 'can you summarize',
      'paki explain', 'paki linaw', 'paki elaborate', 'paki summarize',
      'paki simplify', 'pakiikli', 'paikliin', 'pasimplehin', 'paliwanag',
      'ipaliwanag', 'ilinaw', 'linawin', 'ikli', 'iklian', 'simplehan',
      'gawing simple', 'gawing maikli', 'gawing malinaw', 'mas detalyado',
      'mas malinaw', 'mas maikli', 'mas simple', 'mas madali', 'dagdagan',
      'dagdag', 'karagdagang', 'additional', 'add more', 'more examples',
      'give examples', 'halimbawa', 'example', 'examples', 'sample',
      'samples', 'for example', 'like what', 'such as', 'what about',
      'how about', 'what if', 'why', 'how', 'when', 'where', 'who',
      'which', 'what', 'ano', 'bakit', 'paano', 'kailan', 'saan',
      'sino', 'alin', 'pakiusap', 'mangyaring', 'paki',
      'unsa', 'ngano', 'giunsa', 'asa', 'kanus-a', 'kinsa', 'pila',
      'palihug', 'palihog', 'pangngaasi', 'alayon',
      'mubo', 'muboa', 'halipot', 'halipota', 'malip-ot', 'lip-ota',
      'makuyad', 'kuyaran', 'ababa', 'ababaen', 'corto', 'corta',
      'court', 'courte', 'kurz', 'paiklian', 'paikliin mo'
    ];
    
    return patterns.some(p => lower.includes(p));
  },

  extractTopicKey(prompt) {
    if (!prompt) return null;
    const words = prompt.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'on', 'at', 'to', 'for', 'from', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'ang', 'ng', 'mga', 'sa', 'ay', 'at', 'si', 'sina', 'ni', 'nina', 'kay', 'kina', 'para', 'dahil', 'kasi', 'kaya', 'ba', 'na', 'pa', 'lang', 'lamang', 'daw', 'raw', 'po', 'opo', 'ho', 'oho'];
    
    const keywords = words.filter(w => w.length > 3 && !stopWords.includes(w));
    const key = keywords.slice(0, 5).join(' ');
    return key.length > 3 ? key.substring(0, 50) : prompt.substring(0, 50);
  },

  isReturnToTopicRequest(prompt) {
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
      'padayon ta sa', 'padayon sa', 'ipadayon ang'
    ];
    
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return true;
      }
    }
    
    if (lower.startsWith('balik tayo') || lower.startsWith('balikan natin') ||
        lower.startsWith('balik ta') || lower.startsWith('balikan nato')) {
      return true;
    }
    
    return false;
  },

  extractTopicFromReturn(prompt) {
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
      'padayon ta sa', 'padayon sa', 'ipadayon ang'
    ];
    
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        const topic = prompt.substring(prompt.toLowerCase().indexOf(pattern) + pattern.length).trim();
        if (topic) {
          return topic;
        }
      }
    }
    
    return null;
  },

  isNewTopic(prompt, previousPrompt, originalPrompt) {
    if (!previousPrompt) return true;
    
    const lowerPrompt = prompt.toLowerCase();
    
    const casualPhrases = ['hahaha', 'haha', 'hehe', 'lol', 'lmao', 'oh', 'ah', 'eh', 'ay', 'ha', 'hmm', 'hm', 'mmm', 'wow', 'shet', 'gagi', 'lala', 'hala', 'talaga', 'seryoso', 'grabe', 'sus', 'hay', 'ayoko', 'sige', 'cge', 'okay', 'ok', 'ge'];
    if (casualPhrases.some(p => lowerPrompt.includes(p)) && originalPrompt.length < 20) {
      return true;
    }
    
    if (originalPrompt.length < 10 && !this.isFollowUpRequest(prompt)) {
      return true;
    }
    
    const prevWords = previousPrompt.split(' ').filter(w => w.length > 3);
    const currentWords = prompt.split(' ').filter(w => w.length > 3);
    const hasRelatedWords = prevWords.some(w => 
      currentWords.some(cw => cw.includes(w) || w.includes(cw))
    );
    
    if (!hasRelatedWords && originalPrompt.length > 5) {
      return true;
    }
    
    const indicators = ['hello', 'hi', 'hey', 'kamusta', 'musta', 'tanong', 'question', 'new topic', 'bagong topic', 'iba naman', 'lipat tayo', 'move on', 'gusto ko malaman', 'i want to know', 'tell me about', 'ano ang', 'what is', 'unsa ang', 'unsa man'];
    if (indicators.some(i => lowerPrompt.includes(i)) && !this.isFollowUpRequest(prompt)) {
      return true;
    }
    
    return false;
  },

  isRealtimeQuestion(prompt) {
    const lower = prompt.toLowerCase();
    
    const timeKeywords = ['oras', 'time', 'petsa', 'date', 'anong oras', 'what time', 'what is the time', 'anong petsa', 'what date', 'what is the date', 'real time', 'real-time', 'kasalukuyang oras', 'current time', 'current date', 'anong oras na', 'what time is it', 'unsa oras', 'unsa nga oras'];
    if (timeKeywords.some(k => lower.includes(k))) {
      return true;
    }

    const newsKeywords = ['balita', 'news', 'update', 'latest', 'pinakahuling', 'nangyari', 'happening', 'events', 'pangyayari', 'ganap', 'senado', 'senate', 'kongreso', 'congress', 'pulitika', 'politics', 'gobyerno', 'government', 'presidente', 'president', 'bise presidente', 'vice president', 'magulo', 'gulo', 'trouble', 'chaos', 'kaguluhan', 'krisis', 'crisis', 'problema', 'problem', 'situwasyon', 'situation', 'lagay', 'condition', 'report', 'reports', 'ulat', 'balita ngayon', 'ngayong araw', 'today', 'this day', 'this week', 'ano update', 'may nangyari', 'what happened', 'ano balita', 'unsa balita', 'unsa update'];
    if (newsKeywords.some(k => lower.includes(k))) {
      return true;
    }

    const weatherKeywords = ['panahon', 'weather', 'ulan', 'rain', 'bagyo', 'typhoon', 'init', 'heat', 'lamig', 'cold', 'baha', 'flood', 'lindol', 'earthquake', 'pagputok', 'volcano', 'climate', 'klima'];
    if (weatherKeywords.some(k => lower.includes(k))) {
      return true;
    }

    const priceKeywords = ['presyo ng', 'price of', 'gastos', 'cost', 'bilihin', 'kuryente', 'electricity', 'tubig', 'water', 'gasolina', 'gas', 'bigas', 'rice', 'asukal', 'sugar', 'mantika', 'oil', 'sibuyas', 'onion', 'bawang', 'garlic', 'presyo sa', 'pila ang presyo'];
    if (priceKeywords.some(k => lower.includes(k))) {
      return true;
    }

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
      const response = await axios.get(apiUrl, {
        timeout: 30000,
        headers: { 'Accept': 'application/json' }
      });

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
      const response = await axios.get(apiUrl, {
        timeout: 30000,
        headers: { 'Accept': 'application/json' }
      });

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
    if (detectedLanguage === 'tagalog') {
      errorMessage = 'Hindi makuha ang real-time na impormasyon. Subukan muli mamaya.';
    } else if (detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano') {
      errorMessage = 'Dili makuha ang real-time nga impormasyon. Sulayi pag-usab.';
    }
    await sendMessage(senderId, { text: errorMessage }, token);
  },

  isExactTimeRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['oras', 'time', 'petsa', 'date', 'anong oras', 'what time', 'what is the time', 'anong petsa', 'what date', 'what is the date', 'real time', 'real-time', 'kasalukuyang oras', 'current time', 'current date', 'anong oras na', 'what time is it', 'unsa oras', 'unsa nga oras'];
    return keywords.some(k => lower.includes(k));
  },

  async handleTimeRequest(senderId, prompt, token) {
    const detectedLanguage = this.detectLanguage(prompt);
    
    try {
      const response = await axios.get('https://worldtimeapi.org/api/timezone/Asia/Manila', {
        timeout: 10000
      });

      const data = response.data;
      const datetime = data.datetime;
      const date = new Date(datetime);
      
      let message;
      
      if (detectedLanguage === 'tagalog') {
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
        
        const formattedTime = date.toLocaleString('fil-PH', options);
        const day = date.toLocaleString('fil-PH', { weekday: 'long' });
        const month = date.toLocaleString('fil-PH', { month: 'long' });
        const hour = date.getHours();
        const minute = date.getMinutes();
        const seconds = date.getSeconds();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        
        message = `Real-Time sa Pilipinas\n\nPetsa: ${day}, ${month} ${date.getDate()}, ${date.getFullYear()}\nOras: ${hour12}:${minute.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm} (PHT)\nTimezone: Asia/Manila (UTC+8)\nDaylight Saving: Hindi ginagamit sa Pilipinas`;
      } else if (detectedLanguage === 'bisaya' || detectedLanguage === 'cebuano') {
        const day = date.toLocaleString('en-PH', { weekday: 'long' });
        const month = date.toLocaleString('en-PH', { month: 'long' });
        const hour = date.getHours();
        const minute = date.getMinutes();
        const seconds = date.getSeconds();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        
        message = `Real-Time sa Pilipinas\n\nPetsa: ${day}, ${month} ${date.getDate()}, ${date.getFullYear()}\nOras: ${hour12}:${minute.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm} (PHT)\nTimezone: Asia/Manila (UTC+8)\nDaylight Saving: Dili ginagamit sa Pilipinas`;
      } else {
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
        
        message = `Real-Time in the Philippines\n\nDate: ${day}, ${month} ${date.getDate()}, ${date.getFullYear()}\nTime: ${hour12}:${minute.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm} (PHT)\nTimezone: Asia/Manila (UTC+8)\nDaylight Saving: Not used in the Philippines`;
      }

      await this.sendChunks(senderId, message, token);

    } catch (error) {
      console.error('[Time] WorldTimeAPI failed:', error.message);
      
      try {
        const now = new Date();
        let message;
        
        if (detectedLanguage === 'tagalog') {
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
          const fallbackTime = now.toLocaleString('fil-PH', options);
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

  isLyricsRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['lyrics', 'lyric', 'letra', 'song lyrics', 'lyrics of', 'lyrics ng', 'letra ng', 'lyrics for', 'lyrics to', 'full lyrics', 'complete lyrics', 'lyrics and chords', 'chords and lyrics', 'kanta', 'awit', 'awitin'];
    return keywords.some(k => lower.includes(k));
  },

  async handleLyricsSearch(senderId, prompt, token) {
    let searchTerm = prompt;
    const removeKeywords = ['lyrics', 'lyric', 'letra', 'song lyrics', 'lyrics of', 'lyrics ng', 'letra ng', 'lyrics for', 'lyrics to', 'full lyrics', 'complete lyrics', 'lyrics and chords', 'chords and lyrics', 'kanta', 'awit', 'awitin'];

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
        text: 'Lyrics Search\n\nUsage: lyrics [song title] by [artist]\n\nExamples:\nlyrics lihim by arthur miguel\nletra ng lihim\nkanta ni arthur miguel\n\nFeatures:\nShows complete lyrics\nVerse, Chorus, Bridge, Adlibs\nArtist and title included\n100% accurate from API' 
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
          text: `Walang nakitang lyrics para sa "${title}".\n\nSubukan:\n- Tingnan ang spelling\n- Magdagdag ng pangalan ng artist\n- Gamitin ang format: lyrics [title] by [artist]` 
        }, token);
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
      await sendMessage(senderId, { 
        text: `Error sa pagkuha ng lyrics para sa "${title}". Subukan muli mamaya.` 
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
      'gusto kong makita ang imahe', 'pahanap ng larawan',
      'pahanap ng litrato', 'pahanap ng imahe'
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
      await sendMessage(senderId, { text: 'Image Generation\n\nUsage: generate [search term] [number]\n\nExamples:\ngenerate cat\ngenerate beautiful sunset 5\nshow me image of dog\n\nTagalog:\ngumawa ng larawan ng pusa\nipakita ang larawan ng aso' }, token);
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

      await sendMessage(senderId, { text: `Nakahanap ng ${resultImages.length} larawan para sa "${searchTerm}"` }, token);

    } catch (error) {
      console.log('[Generate] Error:', error.message);
      await sendMessage(senderId, { text: `Error sa pagkuha ng mga larawan para sa "${searchTerm}". Subukan muli.` }, token);
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
    const commands = ['gscholar', 'scholar', 'googlescholar', 'research', 'pananaliksik', 'saliksik'];
    const lower = prompt.toLowerCase().trim();
    return commands.some(cmd => lower.startsWith(cmd + ' ') || lower === cmd);
  },

  isResearchQuery(prompt) {
    const lower = prompt.toLowerCase();
    const patterns = [
      'find research', 'find study', 'find studies', 'find paper',
      'find papers', 'find article', 'find articles', 'find journal',
      'find journals', 'search research', 'search study', 'search studies',
      'search paper', 'search papers', 'search article', 'search articles',
      'search journal', 'search journals', 'research about', 'research on',
      'research paper about', 'research paper on', 'study about', 'study on',
      'studies about', 'studies on', 'academic paper', 'academic article',
      'academic journal', 'scholarly article', 'scholarly paper',
      'peer-reviewed article', 'peer-reviewed paper', 'literature review',
      'systematic review', 'meta-analysis', 'clinical trial',
      'randomized controlled trial', 'cohort study', 'case study',
      'case report', 'citation index', 'impact factor', 'h-index',
      'google scholar search', 'scholar search', 'find academic',
      'find scholarly', 'find peer-reviewed',
      'maghanap ng pananaliksik', 'maghanap ng pag-aaral',
      'maghanap ng research', 'maghanap ng study',
      'pananaliksik tungkol sa', 'pag-aaral tungkol sa',
      'research paper tungkol sa', 'akademikong papel',
      'akademikong artikulo', 'akademikong journal',
      'scholarly na artikulo', 'scholarly na papel',
      'peer-reviewed na artikulo', 'peer-reviewed na papel',
      'literature review', 'systematic review', 'meta-analysis',
      'clinical trial', 'randomized controlled trial',
      'cohort study', 'case study', 'case report'
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
      await sendMessage(senderId, { text: 'Google Scholar Search\n\nUsage: gscholar [search query]\n\nExamples:\ngscholar coconut hybridization\nresearch machine learning\npananaliksik tungkol sa niyog' }, token);
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

  isMusicRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['play', 'song', 'music', 'track', 'audio', 'listen', 'sound', 'kanta', 'tugtog', 'music video', 'mv', 'soundtrack', 'playlist', 'album', 'single', 'remix', 'cover', 'official audio', 'official music', 'stream', 'pakinggan', 'patugtog', 'music link', 'song link', 'hit song', 'popular song', 'new song', 'latest song', 'opm', 'pinoy music', 'tagalog song', 'bisaya song', 'rap', 'hiphop', 'rnb', 'pop', 'rock', 'jazz', 'classical', 'lihim', 'halik', 'sawi', 'hugot', 'love song', 'sad song', 'awit', 'awitin', 'kantahin'];
    return keywords.some(k => lower.includes(k));
  },

  async handleMusicSearch(senderId, prompt, token) {
    let searchTerm = prompt;
    const removeKeywords = ['play', 'song', 'music', 'track', 'audio', 'listen', 'sound', 'kanta', 'tugtog', 'music video', 'mv', 'soundtrack', 'playlist', 'album', 'single', 'remix', 'cover', 'official audio', 'official music', 'stream', 'pakinggan', 'patugtog', 'music link', 'song link', 'hit song', 'popular song', 'new song', 'latest song', 'opm', 'pinoy music', 'tagalog song', 'bisaya song', 'awit', 'awitin', 'kantahin'];

    for (const keyword of removeKeywords) {
      if (searchTerm.toLowerCase().includes(keyword)) {
        searchTerm = searchTerm.toLowerCase().replace(keyword, '').trim();
        break;
      }
    }

    if (!searchTerm) {
      await sendMessage(senderId, { text: 'Music Search\n\nUsage: play [song title] or music [song title]\n\nExamples:\nplay lihim\nmusic halik\nplay love song\npakinggan ang liwanag' }, token);
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
          const progressive = track.media.transcodings.find(t => 
            t.format && t.format.protocol === 'progressive' && t.format.mime_type === 'audio/mpeg'
          );
          if (progressive && progressive.url) {
            audioUrl = progressive.url;
          }
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

  async callGeminiAPI(prompt, imageUrl, language = 'english') {
    try {
      const geminiPrompt = this.buildGeminiPrompt(prompt, language);
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
      const fallbackPrompt = `The user sent an image but the image analysis failed. The user asked: ${prompt || 'Please describe what you see'}. Please provide a helpful response.`;
      const response = await this.callAPI(fallbackPrompt, 'gemini_fallback');
      return this.cleanResponse(response || 'Hindi ma-analyze ang image. Subukan muli.');
    }
  },

  buildGeminiPrompt(userPrompt, language = 'english') {
    const langName = this.getLanguageName(language);
    let prompt;
    
    prompt = `You are an advanced AI assistant analyzing an image. Your task is to DETECT the content type and respond accordingly with the APPROPRIATE format.

CONTENT TYPE DETECTION & RESPONSE FORMATS:

1. ACTIVITY SHEET / WORKSHEET / QUIZ / HOMEWORK / ASSIGNMENT
   - Identify the subject (Math, Science, English, TLE, etc.)
   - Identify the type (Multiple Choice, Fill in the Blanks, Sequencing, True/False, Essay, Problem Solving)
   - Read and understand each question carefully
   - Provide ACCURATE answers based on the content
   - For sequencing: Arrange in correct order
   - For true/false: Mark ✓ or ✗ with brief explanation
   - For explain why: Provide clear 1-2 sentences
   - For math: Show step-by-step solution
   - FORMAT: Use structured format with "CONTENT TYPE:", "ANSWERS:", "EXPLANATIONS:"

2. MATH PROBLEMS / EQUATIONS
   - Read the problem carefully
   - Show step-by-step solution
   - Provide final answer with proper units
   - FORMAT: Use "CONTENT TYPE:", "SOLUTION:", "FINAL ANSWER:"

3. SCIENCE / DIAGRAMS / LABELS
   - Identify parts and their functions
   - Explain processes
   - Provide definitions and key concepts
   - FORMAT: Use "CONTENT TYPE:", "PARTS/FUNCTIONS:", "KEY CONCEPTS:"

4. TEXTBOOK / NOTES / EDUCATIONAL CONTENT
   - Extract key concepts
   - Summarize main ideas
   - Provide examples and applications
   - FORMAT: Use "CONTENT TYPE:", "KEY CONCEPTS:", "SUMMARY:"

5. MEME / HUMOROUS IMAGE
   - Identify the meme or subject
   - Extract any text present
   - Explain the joke or context briefly (1-2 sentences)
   - Keep it SHORT and DIRECT
   - FORMAT: "CONTENT TYPE: Meme" then brief description

6. GENERAL IMAGE (Photo, Art, Screenshot)
   - Identify what is shown (person, place, object, event)
   - Briefly describe what you see (2-3 sentences)
   - Extract text if present
   - Keep it SIMPLE and DIRECT
   - FORMAT: "CONTENT TYPE: General" then brief description

7. SCREENSHOT / UI / WEBSITE
   - Identify what is shown (app, website, game)
   - Extract text if present
   - Brief description of what is happening
   - FORMAT: "CONTENT TYPE: Screenshot" then brief description

8. PERSON / PORTRAIT
   - Identify the person if known
   - Brief description
   - FORMAT: "CONTENT TYPE: Portrait" then brief description

IMPORTANT RULES:
- DETECT the content type FIRST before responding
- Use the APPROPRIATE format based on content type
- For MEME and GENERAL images: KEEP IT SHORT and DIRECT
- For ACTIVITY SHEETS and MATH: Provide detailed answers
- DO NOT use the same format for all images
- Use plain text only. No symbols, no markdown.
- RESPOND IN ${langName.toUpperCase()} LANGUAGE.

USER QUESTION: ${userPrompt || 'Analyze this image and provide a comprehensive response.'}`;

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
      .replace(/^Ako ay si Gemini.*?\n/i, '')
      .replace(/^Narito ang aking analysis.*?\n/i, '')
      .replace(/^Hayaan mong i-analyze ko.*?\n/i, '')
      .replace(/^Ang larawan ay tila.*?\n/i, '')
      .replace(/^Batay sa aking analysis.*?\n/i, '')
      .replace(/^Nakikita ko na.*?\n/i, '')
      .replace(/^Mukhang ganito.*?\n/i, '')
      .trim();
    return cleaned;
  },

  ensureThereforeSection(response) {
    let withTherefore = response;
    const lower = response.toLowerCase();
    const has = lower.includes('therefore') || lower.includes('core point') ||
                lower.includes('main takeaway') || lower.includes('final answer') ||
                lower.includes('key insight') || lower.includes('kaya') ||
                lower.includes('samakatuwid') || lower.includes('pangunahing punto') ||
                lower.includes('pinal na sagot') || lower.includes('mahalagang insight');

    if (!has) {
      const lines = response.split('\n');
      let end = 0;
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes('analysis:') || lines[i].toLowerCase().includes('analysis') ||
            lines[i].toLowerCase().includes('pagsusuri:')) {
          found = true;
          continue;
        }
        if (found && lines[i].trim() === '') {
          end = i;
          break;
        }
      }
      if (end > 0) {
        const before = lines.slice(0, end).join('\n');
        const after = lines.slice(end).join('\n');
        withTherefore = before + '\n\nKAYA:\n[Pangunahing insight batay sa pagsusuri sa itaas]\n\n' + after;
      } else {
        withTherefore = 'KAYA:\n[Pangunahing konklusyon mula sa larawan]\n\n' + response;
      }
    }
    return withTherefore;
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
          response = await axios.get(url, {
            timeout: config.timeout,
            headers: { 'Accept': 'application/json', ...config.headers }
          });
        } else {
          response = await axios.post(config.url, { prompt }, {
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
      .replace(/^Ako ay isang AI.*?\n\n?/i, '')
      .replace(/^Bilang isang AI.*?\n\n?/i, '')
      .replace(/^Narito ang aking tugon.*?\n/i, '')
      .replace(/^Hayaan mong sagutin ko.*?\n/i, '')
      .replace(/^Batay sa aking kaalaman.*?\n/i, '')
      .replace(/^Maaari kitang tulungan.*?\n/i, '')
      .trim();
  },

  wantsDetailedAnswer(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['explain more', 'more explanation', 'more details', 'detailed', 'detail', 'elaborate', 'elaborate more', 'paki elaborate', 'mas detalyado', 'tell me more', 'give more info', 'dagdagan', 'dagdag', 'further explain', 'further explanation', 'full explanation', 'complete explanation', 'in depth', 'in-depth', 'thorough', 'comprehensive', 'expound', 'pakilinaw', 'linawin', 'more information', 'additional info', 'karagdagang', 'can you explain further', 'please elaborate', 'paki explain', 'paliwanag', 'ipaliwanag', 'mas malalim', 'mas malawak'];
    return keywords.some(k => lower.includes(k));
  },

  shortenResponse(text) {
    if (!text) return text;
    const sentences = text.split(/(?<=[.!?])\s+/);
    let concise = sentences.slice(0, 3).join(' ');
    if (concise.length > 400) {
      concise = concise.substring(0, 400) + '...';
    }
    concise = concise
      .replace(/^(In summary|To summarize|In conclusion|Basically|Essentially|Simply put|In other words|That said|Having said that|With that said|Sa buod|Upang ibuod|Sa konklusyon|Karaniwan|Sa madaling salita|Sa ibang salita|Iyon ay|Sa pagkakaroon ng sinabi|Sa nasabing iyon)\s*,?\s*/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return concise || text;
  },

  isContextualQuestion(prompt, previousPrompt) {
    if (!previousPrompt) return false;
    const patterns = ['so yan', 'so ito', 'so iyan', 'so yun', 'so ganyan', 'so ganito', 'so ganun', 'yan na ba', 'yun na ba', 'ito na ba', 'ganyan na ba', 'ganun na ba', 'tama ba', 'tama', 'correct', 'right', 'so tungkol', 'so sa', 'so para sa', 'so ibig sabihin', 'so meaning', 'so parang', 'so sa madaling salita', 'so in short', 'paano naman', 'what about', 'how about', 'paano kung', 'what if', 'bakit', 'why', 'paano', 'how', 'kailan', 'when', 'saan', 'where', 'sino', 'who', 'alin', 'which', 'ano', 'what', 'ano ba', 'what about', 'gets', 'gets ko', 'nagets', 'naintindihan', 'so gets', 'so naintindihan', 'ayun', 'ayon', 'ganun pala', 'ganyan pala', 'so ayun', 'so ayon', 'ok', 'okay', 'sige', 'cge', 'so okay', 'so sige', 'ah ganun', 'ah ganyan', 'ah okay', 'so ah', 'so okay', 'talaga', 'really', 'sure', 'so talaga', 'so sure', 'so that', 'so this', 'so it', 'so about', 'so regarding', 'so basically', 'so essentially', 'so you mean', 'so you saying', 'mao na', 'mao ni', 'mao to', 'mao diay', 'mao ba', 'mao jud', 'mao gyud', 'so mao', 'so mao na', 'sakto ba', 'sakto', 'ingon ana', 'ingon ani', 'so ingon', 'so ingon ana', 'unsa man', 'unsa', 'na gets', 'nakasabot', 'nasabtan', 'so nakasabot', 'so nasabtan', 'aw', 'aw okay', 'ah okay', 'so', 'sow', 'eh', 'e', 'a', 'ah', 'oh', 'ay', 'ha', 'heh', 'hmm', 'hm', 'mmm'];
    const isRelated = patterns.some(p => prompt.includes(p));
    const prevWords = previousPrompt.split(' ').filter(w => w.length > 2);
    const currentWords = prompt.split(' ').filter(w => w.length > 2);
    const hasRelated = prevWords.some(w => currentWords.some(c => c.includes(w) || w.includes(c)));
    return isRelated || hasRelated;
  },

  isFollowUpRequest(prompt) {
    const keywords = ['translate', 'translate to', 'translate into', 'translate in', 'translation', 'isalin', 'salin', 'ipasalin', 'isalin sa', 'transl', 'trans', 'tl', 'bis', 'ceb', 'eng', 'spa', 'tagalog', 'bisaya', 'cebuano', 'spanish', 'filipino', 'english', 'ilocano', 'waray', 'hiligaynon', 'kapampangan', 'elaborate', 'elaborate further', 'explain more', 'paki elaborate', 'paki explain', 'paliwanag', 'ipaliwanag', 'elab', 'explain', 'detail', 'further', 'more details', 'mas detalyado', 'summarize', 'summary', 'i-summarize', 'brief', 'make it short', 'short', 'concise', 'shorten', 'sum', 'ikli', 'paikliin', 'simplify', 'simple', 'pasimplehin', 'basic', 'simplified', 'simp', 'madali', 'dali', 'gawing simple', 'example', 'sample', 'halimbawa', 'instance', 'eg', 'ex', 'hal', 'give example', 'give examples', 'magbigay ng halimbawa', 'correct', 'fix', 'tama', 'ayusin', 'improve', 'better', 'improved', 'i-correct', 'i-fix', 'iwasto', 'add', 'additional', 'dagdagan', 'more', 'add more', 'dagdag', 'karagdagang', 'humanize', 'make it human', 'conversational', 'natural', 'make it natural', 'parang tao', 'human-like', 'human', 'gawing natural', 'gawing tao', 'tama ba', 'correct ba', 'right ba', 'sure ba', 'talaga', 'really', 'are you sure', 'sigurado ka', 'clarify', 'clarification', 'linawin', 'clear', 'make clear', 'ulit', 'repeat', 'say again', 'paulit', 'ulitin', 'paki-ulit', 'pakiulit', 'again', 'gets', 'nagets', 'naintindihan', 'understand', 'naiintindihan', 'gets ko', 'nagets ko', 'gots', 'got it', 'oo', 'opo', 'sige', 'cge', 'okay', 'ok', 'agree', 'yes', 'yeah', 'yep', 'hindi', 'dili', 'no', 'not', 'mali', 'disagree', 'hindi tama', 'mali yan', 'what', 'why', 'how', 'when', 'where', 'who', 'which', 'ano', 'bakit', 'paano', 'kailan', 'saan', 'sino', 'alin', 'wut', 'y', 'hau', 'wen', 'wer', 'hu', 'wich', 'anu', 'bkt', 'pano', 'klan', 'san', 'sinu', 'aln', 'kasi', 'dahil', 'kaya', 'nga', 'na', 'pa', 'ba', 'din', 'rin', 'lang', 'lng', 'naman', 'nman', 'nmn', 'talaga', 'tlga', 'tlag', 'sabi mo', 'sbi mo'];
    return keywords.some(k => prompt.includes(k));
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

  buildFinalPrompt(prompt, previousResponse, previousPrompt, isReply, wantsDetailed, language = 'english') {
    const langName = this.getLanguageName(language);
    let final = '';
    
    final += `IMPORTANT: Respond in ${langName.toUpperCase()} language.\n\n`;

    if (previousResponse) {
      final += `Previous conversation context (${langName}):\n`;
      final += 'User asked: ' + (previousPrompt || 'unknown') + '\n';
      final += 'AI responded: ' + previousResponse + '\n\n';
      
      const lower = prompt.toLowerCase();

      if (this.isContextualQuestion(lower, previousPrompt)) {
        final += 'User is asking a follow-up question about the previous topic.\n';
        final += 'The user wants to clarify, confirm, or continue the discussion about the previous response.\n';
        final += 'Provide a direct answer that continues the conversation naturally.\n\n';
      }

      if (this.isTranslationRequest(prompt)) {
        const targetLang = this.detectTargetLanguage(prompt);
        final += `User wants to translate the previous response to ${targetLang}.\n`;
        final += `Provide the translation to ${targetLang} only. Do not include the original text.\n\n`;
      } else if (lower.includes('humanize') || lower.includes('make it human') || 
                 lower.includes('conversational') || lower.includes('natural') ||
                 lower.includes('make it natural') || lower.includes('parang tao') ||
                 lower.includes('human-like') || lower.includes('human')) {
        final += 'User wants you to make your previous response more human and conversational.\n';
        final += 'Rewrite it in a natural, friendly, and engaging tone.\n\n';
      } else if (lower.includes('elaborate') || lower.includes('explain more') || 
                 lower.includes('paki elaborate') || lower.includes('detail') ||
                 lower.includes('further') || lower.includes('paliwanag') ||
                 lower.includes('ipaliwanag') || lower.includes('elab') ||
                 lower.includes('more details') || lower.includes('mas detalyado')) {
        final += 'User wants you to elaborate on your previous response.\n';
        final += 'Provide a detailed explanation with more information, context, and examples.\n\n';
      } else if (lower.includes('summarize') || lower.includes('summary') || 
                 lower.includes('i-summarize') || lower.includes('brief') ||
                 lower.includes('make it short') || lower.includes('short') ||
                 lower.includes('concise') || lower.includes('shorten') ||
                 lower.includes('paikliin') || lower.includes('ikli') ||
                 lower.includes('sum')) {
        final += 'User wants a concise summary of your previous response.\n';
        final += 'Provide only the most important key points in a short, clear, and direct manner.\n\n';
      } else if (lower.includes('simplify') || lower.includes('simple') || 
                 lower.includes('pasimplehin') || lower.includes('basic') ||
                 lower.includes('simplified') || lower.includes('madali') ||
                 lower.includes('simp')) {
        final += 'User wants a simpler explanation.\n';
        final += 'Explain using simple words and layman terms.\n\n';
      } else if (lower.includes('example') || lower.includes('sample') || 
                 lower.includes('halimbawa') || lower.includes('instance') ||
                 lower.includes('eg') || lower.includes('ex') || lower.includes('hal')) {
        final += 'User wants examples related to your previous response.\n';
        final += 'Provide relevant examples to illustrate your points.\n\n';
      } else if (lower.includes('correct') || lower.includes('fix') || 
                 lower.includes('tama') || lower.includes('ayusin') ||
                 lower.includes('improve') || lower.includes('better')) {
        final += 'User wants you to correct or improve your previous response.\n';
        final += 'Review and provide an improved version.\n\n';
      } else if (lower.includes('add') || lower.includes('additional') || 
                 lower.includes('dagdagan') || lower.includes('more') ||
                 lower.includes('dagdag')) {
        final += 'User wants additional information.\n';
        final += 'Add more details, examples, or context.\n\n';
      } else {
        final += 'User is continuing the conversation about the previous topic.\n';
        final += 'User says: ' + prompt + '\n';
        final += 'Provide a natural response that continues the discussion.\n\n';
      }
    } else {
      final = prompt;
    }

    if (wantsDetailed) {
      final += 'USER WANTS DETAILED ANSWER: Provide a comprehensive, thorough, and detailed explanation.\n\n';
    } else {
      final += 'USER WANTS CONCISE ANSWER: Provide a SHORT, DIRECT, and ACCURATE response.\n';
      final += 'Be straight to the point. Maximum 2-3 sentences or 1-2 paragraphs.\n\n';
    }

    final += 'IMPORTANT GUIDELINES:\n';
    final += `- Respond in ${langName.toUpperCase()}.\n`;
    final += '- Be accurate and precise in your response.\n';
    final += '- For math problems, show step-by-step solution.\n';
    final += '- For analysis, provide clear description.\n';
    final += '- Use plain text only. No symbols or markdown.\n';
    final += '- If unsure, state that clearly.\n';
    final += '- Do not ask questions back. Just provide the complete response.\n';
    final += '- Continue the conversation naturally.\n';
    final += '- Be friendly and engaging.\n';

    return final;
  },

  isOwnerQuestion(prompt) {
    const keywords = ['who is your owner', 'who created you', 'who made you', 'sino gumawa sayo', 'sino may ari sayo', 'owner mo', 'sino owner mo', 'who owns you', 'creator', 'developer', 'sino gumawa sa iyo', 'sino may-ari sa iyo'];
    return keywords.some(k => prompt.toLowerCase().includes(k));
  },

  isUserInfoQuestion(prompt) {
    const keywords = ['what is my name', 'ano pangalan ko', 'my name', 'pangalan ko', 'when is my birthday', 'kelan birthday ko', 'my birthday', 'who am i', 'sino ako', 'whats my name', 'ano ang pangalan ko', 'kailan ang birthday ko'];
    return keywords.some(k => prompt.toLowerCase().includes(k));
  },

  isTranslationRequest(prompt) {
    const keywords = ['translate', 'translate to', 'translate into', 'translate in', 'translation', 'isalin', 'salin', 'ipasalin', 'isalin sa', 'transl', 'trans', 'i-translate', 'isalin mo'];
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
      const translatePrompt = `Translate this text to ${targetLanguage}. Only provide the translation, no other text. Do not include the original text. Here is the text to translate: ${text}`;
      const response = await this.callAPI(translatePrompt, 'translation');
      return response || text;
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
        response = userInfo.name ? `Ang pangalan mo ay ${userInfo.name}.` : 'Hindi ko masasabi iyan dahil ito ay kompidensyal.';
      }
      if (prompt.toLowerCase().includes('birthday') || prompt.toLowerCase().includes('kelan')) {
        response += userInfo.birthday ? `\nAng birthday mo ay ${userInfo.birthday}.` : '\nHindi ko masasabi iyan dahil ito ay kompidensyal.';
      }
      if (!response) {
        const publicInfo = [];
        if (userInfo.name) publicInfo.push(`Pangalan: ${userInfo.name}`);
        if (userInfo.birthday) publicInfo.push(`Birthday: ${userInfo.birthday}`);
        if (userInfo.gender) publicInfo.push(`Kasarian: ${userInfo.gender}`);
        if (userInfo.location) publicInfo.push(`Lokasyon: ${userInfo.location}`);
        response = publicInfo.length > 0
          ? `Narito ang iyong pampublikong impormasyon:\n${publicInfo.join('\n')}`
          : 'Hindi ko masasabi iyan dahil ito ay kompidensyal.';
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

  getErrorMessage(error) {
    if (error.code === 'ECONNABORTED') return 'Nag-timeout ang request. Subukan muli.';
    if (error.response?.status === 429) return 'Naabot ang rate limit. Maghintay sandali.';
    if (error.response?.status === 403) return 'Hindi valid o expired ang API key.';
    if (error.response?.status >= 500) return 'Server error. Subukan muli mamaya.';
    return 'Error sa pagproseso ng request. Subukan muli.';
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
