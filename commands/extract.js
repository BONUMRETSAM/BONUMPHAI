const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

module.exports = {
  name: ['extract', 'extract text', 'kunin ang text', 'kuha text', 'basahin ang image', 'read image'],
  description: 'Extract text from image preserving ALL symbols and details',
  usage: 'extract [reply to image]',
  version: '4.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 3,

  async execute(senderId, args, token, event) {
    try {
      let imageUrl = null;
      
      if (event?.message?.reply_to?.mid) {
        const replyData = await this.getRepliedMessageData(event.message.reply_to.mid, token);
        imageUrl = replyData.imageUrl;
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
      }
      
      if (!imageUrl) {
        await sendMessage(senderId, {
          text: 'EXTRACT TEXT\n\nPara gamitin:\n1. Mag-send ng image\n2. I-reply ang "extract" sa image'
        }, token);
        return;
      }
      
      await sendMessage(senderId, { text: 'Extracting text from image... Please wait.' }, token);
      
      const extractedText = await this.extractTextFromImage(imageUrl);
      
      if (extractedText) {
        await this.sendChunks(senderId, extractedText, token);
      } else {
        await sendMessage(senderId, { text: 'Walang nakitang text sa image.' }, token);
      }
      
    } catch (error) {
      console.error('[extract] Error:', error.message);
      await sendMessage(senderId, { text: 'Error: ' + error.message }, token);
    }
  },

  async extractTextFromImage(imageUrl) {
    try {
      const extractPrompt = `You are an OCR specialist with PERFECT LAYOUT AND SYMBOL PRESERVATION capability.\n\n` +
        `Your task: EXTRACT ALL TEXT AND SYMBOLS from this image with ZERO LOSS.\n\n` +
        `ABSOLUTE PRESERVATION RULES:\n\n` +
        `1. TEXT CONTENT:\n` +
        `   - Extract EVERY character, letter, number, and word\n` +
        `   - Do NOT skip any text\n` +
        `   - Do NOT abbreviate or shorten\n` +
        `   - Do NOT rephrase or summarize\n` +
        `   - Do NOT translate\n\n` +
        `2. SYMBOLS:\n` +
        `   - ✓ ✔ ☑ - Preserve checkmarks\n` +
        `   - ✗ ✘ X - Preserve X marks\n` +
        `   - → ← ↑ ↓ - Preserve arrows\n` +
        `   - • ● ○ ▪ ▫ - Preserve bullet points\n` +
        `   - ★ ☆ - Preserve stars\n` +
        `   - ♥ ❤ - Preserve hearts\n` +
        `   - © ® ™ - Preserve copyright/trademark\n` +
        `   - ° ± × ÷ = ≠ ≈ - Preserve math symbols\n` +
        `   - $ € £ ¥ ₱ - Preserve currency symbols\n` +
        `   - % @ # & * ( ) [ ] { } - Preserve special characters\n` +
        `   - - – — - Preserve dashes\n\n` +
        `3. FORMATTING:\n` +
        `   - BOLD text: Use *text*\n` +
        `   - ITALIC text: Use _text_\n` +
        `   - UNDERLINED: Note as [UNDERLINED: text]\n` +
        `   - HIGHLIGHTED: Note as [HIGHLIGHTED: text]\n` +
        `   - COLORED text: Note as [COLOR name: text]\n` +
        `   - FONT SIZE large: Note as [LARGE: text]\n` +
        `   - FONT SIZE small: Note as [SMALL: text]\n\n` +
        `4. LAYOUT:\n` +
        `   - Preserve left, center, right alignment\n` +
        `   - Preserve indentation\n` +
        `   - Preserve line spacing\n` +
        `   - Preserve paragraph breaks\n\n` +
        `5. TABLES:\n` +
        `   - Preserve exact table structure\n` +
        `   - Use | for column separators\n` +
        `   - Preserve ALL cell contents\n\n` +
        `6. DIAGRAMS:\n` +
        `   - Venn Diagram: [LEFT], [RIGHT], [OVERLAP]\n` +
        `   - Flowchart: [START] → [STEP] → [END]\n` +
        `   - Pyramid: [TOP] → [MIDDLE] → [BOTTOM]\n` +
        `   - Timeline: [YEAR] → [EVENT]\n` +
        `   - Mind Map: [CENTER] → [BRANCHES]\n` +
        `   - Pie Chart: [SLICE] (PERCENTAGE%): [LABEL]\n` +
        `   - Bar Graph: [BAR]: [LABEL] ([VALUE])\n\n` +
        `7. HANDWRITING:\n` +
        `   - Read as accurately as possible\n` +
        `   - Preserve the writing style if possible\n` +
        `   - If uncertain, use [HANDWRITING: text]\n\n` +
        `8. HEADERS AND TITLES:\n` +
        `   - Preserve exact wording\n` +
        `   - Preserve capitalization\n` +
        `   - Preserve font emphasis\n\n` +
        `9. CRITICAL:\n` +
        `   - DO NOT add ANY explanation\n` +
        `   - DO NOT add your own words\n` +
        `   - DO NOT describe the image\n` +
        `   - DO NOT skip ANY text or symbol\n` +
        `   - JUST OUTPUT WHAT YOU SEE\n\n` +
        `OUTPUT THE EXTRACTED TEXT WITH ALL SYMBOLS AND FORMATTING PRESERVED:`;
      
      const apiUrl = `https://norch-project.gleeze.com/api/gemini?prompt=${encodeURIComponent(extractPrompt)}&imageurl=${encodeURIComponent(imageUrl)}`;
      
      const response = await axios.get(apiUrl, {
        timeout: 90000,
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response || !response.data) throw new Error('No response from Gemini API');
      
      return this.cleanExtractedText(response.data.response || '');
      
    } catch (error) {
      console.error('[extract] Gemini Error:', error.message);
      return '';
    }
  },

  cleanExtractedText(text) {
    if (!text) return '';
    let cleaned = text;
    
    cleaned = cleaned
      .replace(/^Here is.*?\n/i, '')
      .replace(/^Here's.*?\n/i, '')
      .replace(/^The text.*?\n/i, '')
      .replace(/^I can see.*?\n/i, '')
      .replace(/^Narito.*?\n/i, '')
      .replace(/^Ito.*?\n/i, '')
      .replace(/^Extracted text.*?\n/i, '')
      .replace(/^The following.*?\n/i, '')
      .replace(/^Sure.*?\n/i, '')
      .replace(/^Of course.*?\n/i, '')
      .trim();
    
    return cleaned;
  },

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

  splitMessage(text) {
    const chunks = [];
    const MAX_CHUNK = 1900;
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
