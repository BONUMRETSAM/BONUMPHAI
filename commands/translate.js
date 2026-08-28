const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

const MAX_CHUNK = 1900;

module.exports = {
  name: ['translate', 'translator', 'isalin', 'salin', 'i-translate', 'translate to', 'isalin sa'],
  description: 'Translate text to different languages',
  usage: 'translate [target language]: [text] or reply to a message with translate [language]',
  version: '3.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 3,

  async execute(senderId, args, token, event) {
    try {
      const prompt = args.join(' ').trim();
      
      if (!prompt) {
        await sendMessage(senderId, { 
          text: 'TRANSLATOR\n\nUsage:\ntranslate to tagalog: [text]\nisalin sa english: [text]\ntranslate to bisaya: [text]\n\nOr reply to a message:\ntranslate to tagalog\nisalin sa english'
        }, token);
        return;
      }
      
      let textToTranslate = '';
      let targetLanguage = '';
      
      if (event?.message?.reply_to?.mid) {
        const replyData = await this.getRepliedMessageData(event.message.reply_to.mid, token);
        textToTranslate = replyData.message || '';
        targetLanguage = this.detectTargetLanguage(prompt);
      } else {
        const result = this.parseTranslationRequest(prompt);
        textToTranslate = result.text;
        targetLanguage = result.targetLanguage;
      }
      
      if (!textToTranslate) {
        await sendMessage(senderId, { text: 'Walang text na i-translate.\n\nUsage:\ntranslate to tagalog: [text]\nisalin sa english: [text]\n\nOr reply to a message:\ntranslate to tagalog' }, token);
        return;
      }
      
      if (!targetLanguage) {
        targetLanguage = 'English';
      }
      
      await sendMessage(senderId, { text: `Translating to ${targetLanguage}...` }, token);
      
      const translated = await this.translateText(textToTranslate, targetLanguage);
      
      await this.sendChunks(senderId, translated, token);
      
    } catch (error) {
      console.error('[translate] Error:', error.message);
      await sendMessage(senderId, { text: 'Error: ' + error.message }, token);
    }
  },

  parseTranslationRequest(prompt) {
    let targetLanguage = this.detectTargetLanguage(prompt);
    let text = '';
    
    const colonMatch = prompt.match(/[:：]\s*([\s\S]+)$/);
    if (colonMatch && colonMatch[1]) {
      text = colonMatch[1].trim();
    } else {
      const langWords = ['tagalog', 'filipino', 'bisaya', 'cebuano', 'english', 'spanish', 'japanese', 'korean', 'chinese', 'french', 'german', 'italian', 'portuguese', 'russian', 'arabic', 'hindi', 'vietnamese', 'thai', 'indonesian', 'malay', 'ilocano', 'waray', 'hiligaynon', 'kapampangan'];
      
      for (const lang of langWords) {
        const pattern = new RegExp(lang + '\\s+(.+)$', 'i');
        const match = prompt.match(pattern);
        if (match && match[1]) {
          text = match[1].trim();
          break;
        }
      }
    }
    
    return { text, targetLanguage };
  },

  detectTargetLanguage(prompt) {
    const lower = prompt.toLowerCase();
    const languages = {
      'tagalog': 'Tagalog', 'filipino': 'Filipino',
      'bisaya': 'Bisaya', 'cebuano': 'Cebuano',
      'ilocano': 'Ilocano', 'waray': 'Waray',
      'hiligaynon': 'Hiligaynon', 'kapampangan': 'Kapampangan',
      'english': 'English', 'spanish': 'Spanish',
      'japanese': 'Japanese', 'korean': 'Korean',
      'chinese': 'Chinese', 'mandarin': 'Mandarin',
      'french': 'French', 'german': 'German',
      'italian': 'Italian', 'portuguese': 'Portuguese',
      'russian': 'Russian', 'arabic': 'Arabic',
      'hindi': 'Hindi', 'vietnamese': 'Vietnamese',
      'thai': 'Thai', 'indonesian': 'Indonesian',
      'malay': 'Malay'
    };
    for (const [key, value] of Object.entries(languages)) {
      if (lower.includes(key)) return value;
    }
    return '';
  },

  async translateText(text, targetLanguage) {
    try {
      const translatePrompt = `You are a professional translator.\n\n` +
        `Translate the TEXT CONTENT to ${targetLanguage}.\n\n` +
        `ABSOLUTE PRESERVATION RULES:\n\n` +
        `1. PRESERVE ALL SPECIAL CHARACTERS:\n` +
        `   - Separator lines: ─────\n` +
        `   - Bullet points: · • ● ○ ▪ ▫\n` +
        `   - Dashes: – — ―\n` +
        `   - Arrows: → ← ↑ ↓ ↔ ⇒ ⇐ ⇔\n` +
        `   - Checkmarks: ✓ ✔ ☑\n` +
        `   - X marks: X ✗ ✘\n` +
        `   - Stars: * ★ ☆\n` +
        `   - Hearts: ♥ ❤\n` +
        `   - Currency: ₱ $ € £ ¥\n` +
        `   - Math: + - = × ÷ %\n` +
        `   - Parentheses: ( ) [ ] { }\n` +
        `   - Quotes: " " ' '\n` +
        `   - Ampersand: &\n` +
        `   - At sign: @\n` +
        `   - Hash: #\n` +
        `   - Slash: / \\\n\n` +
        `2. PRESERVE ALL FORMATTING:\n` +
        `   - Line breaks (\\n)\n` +
        `   - Blank lines between sections\n` +
        `   - UPPERCASE text\n` +
        `   - lowercase text\n` +
        `   - Capitalized Words\n` +
        `   - Indentation (spaces at start of line)\n` +
        `   - Tab characters\n` +
        `   - Multiple spaces\n\n` +
        `3. PRESERVE ALL STRUCTURAL ELEMENTS:\n` +
        `   - Section headers\n` +
        `   - Sub-headers\n` +
        `   - Numbered lists (1. 2. 3.)\n` +
        `   - Bulleted lists\n` +
        `   - Tables (if any)\n` +
        `   - Columns (if any)\n\n` +
        `4. DO NOT CHANGE:\n` +
        `   - Names of people\n` +
        `   - Company names\n` +
        `   - School names\n` +
        `   - Organization names\n` +
        `   - Email addresses\n` +
        `   - Phone numbers\n` +
        `   - Dates (January 15, 1992)\n` +
        `   - Years (2010 – 2014)\n` +
        `   - Addresses\n` +
        `   - URLs\n` +
        `   - Abbreviations (MNHS, MES, TESDA)\n` +
        `   - Acronyms\n` +
        `   - Job titles (if proper noun)\n\n` +
        `5. DO NOT SKIP ANY CONTENT:\n` +
        `   - Translate EVERY section\n` +
        `   - Translate EVERY bullet point\n` +
        `   - Complete ALL paragraphs\n` +
        `   - Do NOT use "..." to truncate\n` +
        `   - Do NOT skip sections\n` +
        `   - Do NOT summarize\n\n` +
        `6. TRANSLATE ONLY:\n` +
        `   - Body text\n` +
        `   - Descriptions\n` +
        `   - Explanations\n` +
        `   - Section headers (if they are common words)\n` +
        `   - Job descriptions\n` +
        `   - Skills descriptions\n\n` +
        `7. OUTPUT FORMAT:\n` +
        `   - Return ONLY the translated text\n` +
        `   - NO introduction\n` +
        `   - NO explanation\n` +
        `   - NO notes\n` +
        `   - Just the translated text with exact formatting\n\n` +
        `TEXT TO TRANSLATE:\n${text}`;
      
      let response = null;
      try {
        response = await this.callAPI(translatePrompt, 'primary');
      } catch (error) {
        console.log('[translate] Primary API failed, trying fallback...');
        try {
          response = await this.callAPI(translatePrompt, 'fallback');
        } catch (fallbackError) {
          console.error('[translate] Fallback also failed:', fallbackError.message);
        }
      }
      
      if (!response) return text;
      
      return this.cleanTranslatedResponse(response);
      
    } catch (error) {
      console.error('[translate] Failed:', error.message);
      return text;
    }
  },

  async callAPI(prompt, apiType = 'primary') {
    const configs = {
      primary: {
        url: 'https://api-library-kohi-production.up.railway.app/api/pollination-ai',
        param: 'prompt',
        responsePath: 'data',
        successField: 'status'
      },
      fallback: {
        url: 'https://betadash-api-swordslush-production.up.railway.app/opera',
        param: 'ask',
        responsePath: 'message',
        successField: 'success'
      }
    };
    
    const config = configs[apiType];
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

  cleanTranslatedResponse(text) {
    if (!text) return text;
    
    let cleaned = text;
    
    // Remove common AI introductions
    cleaned = cleaned
      .replace(/^Here is the translation.*?\n/i, '')
      .replace(/^Translation:.*?\n/i, '')
      .replace(/^Here's the translation.*?\n/i, '')
      .replace(/^Narito ang salin.*?\n/i, '')
      .replace(/^Ito ang salin.*?\n/i, '')
      .replace(/^Here is the translated text.*?\n/i, '')
      .replace(/^The translation is.*?\n/i, '')
      .replace(/^Sure! Here.*?\n/i, '')
      .replace(/^Of course! Here.*?\n/i, '')
      .replace(/^Here you go.*?\n/i, '')
      .replace(/^I have translated.*?\n/i, '')
      .replace(/^Here is my translation.*?\n/i, '')
      .replace(/^Here is the translation of.*?\n/i, '')
      .replace(/^Here is the text translated.*?\n/i, '')
      .replace(/^I've translated.*?\n/i, '')
      .trim();
    
    return cleaned;
  },

  async getRepliedMessageData(mid, token) {
    try {
      const url = `https://graph.facebook.com/v21.0/${mid}`;
      const params = { access_token: token, fields: 'message,from,attachments' };
      const { data } = await axios.get(url, { params });
      return { message: data?.message || '' };
    } catch (error) {
      return { message: '' };
    }
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
