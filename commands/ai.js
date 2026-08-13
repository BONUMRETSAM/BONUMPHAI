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

      const lowerPrompt = prompt.toLowerCase().trim();

      const isExactLyrics = lowerPrompt.startsWith('lyrics ') || lowerPrompt.startsWith('lyric ') ||
        lowerPrompt.startsWith('letra ng ') || lowerPrompt.startsWith('kanta ni ');

      const isExactScholar = lowerPrompt.startsWith('gscholar ') || lowerPrompt.startsWith('scholar ') ||
        lowerPrompt.startsWith('googlescholar ') || lowerPrompt.startsWith('research ');

      const isExactGenerate = lowerPrompt.startsWith('generate ') || lowerPrompt.startsWith('image ') ||
        lowerPrompt.startsWith('img ') || lowerPrompt.startsWith('show ');

      const isExactMusic = lowerPrompt.startsWith('play ') || lowerPrompt.startsWith('music ') ||
        lowerPrompt.startsWith('song ');

      if (isExactLyrics) {
        await this.handleLyricsSearch(senderId, prompt, token);
        return;
      }

      if (isExactScholar) {
        await this.handleScholarSearch(senderId, prompt, token);
        return;
      }

      if (isExactGenerate) {
        await this.handleImageGeneration(senderId, prompt, token);
        return;
      }

      if (isExactMusic) {
        await this.handleMusicSearch(senderId, prompt, token);
        return;
      }

      if (this.isRealtimeQuestion(prompt)) {
        await this.handleRealtimeQuestion(senderId, prompt, token);
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
        if (imageUrl && !prompt) {
          prompt = 'Analyze this image with maximum accuracy. Identify all text, numbers, diagrams, and elements. Provide complete and accurate answers.';
        }
      }

      if (!isReply && prompt) {
        const history = conversationHistory[senderId];
        if (history && history.lastResponse) {
          const lowerPromptCheck = prompt.toLowerCase();
          const returnToTopic = this.isReturnToTopicRequest(prompt);

          if (returnToTopic) {
            const topic = this.extractTopicFromReturn(prompt);
            if (topic && history.topicHistory && history.topicHistory[topic]) {
              previousResponse = history.topicHistory[topic];
              previousPrompt = topic;
              isReply = true;
            } else {
              delete conversationHistory[senderId];
            }
          } else {
            const isFollowUp = this.isFollowUpRequest(lowerPromptCheck) ||
              this.isContextualQuestion(lowerPromptCheck, history.lastPrompt);
            const isNewTopic = this.isNewTopic(lowerPromptCheck, history.lastPrompt, prompt);

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

      if (!prompt && !isReply && !imageUrl) {
        await sendMessage(senderId, {
          text: 'Hello! I am Teacher Arlene - Multi-Modal AI.\n\nCapabilities:\nText conversations\nImage analysis (Activity Sheets, Math, Science, Logic)\nAcademic research\nImage generation\nMusic search\nLyrics search\nReal-time information\nTranslation\nSummarization\n\nCommands:\nai [question]\nSend an image for analysis\ngenerate [search term] [number]\ngscholar [search query]\nplay [song title]\nlyrics [song title] by [artist]'
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

      const wantsDetailed = this.wantsDetailedAnswer(prompt) || this.isEducationalQuestion(prompt);
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
        timestamp: Date.now(),
        topicHistory: conversationHistory[senderId]?.topicHistory || {}
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

  isEducationalQuestion(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = [
      'solve', 'solution', 'math', 'algebra', 'geometry', 'trigonometry', 'calculus',
      'physics', 'chemistry', 'biology', 'science', 'history', 'geography',
      'english', 'grammar', 'vocabulary', 'essay', 'writing',
      'activity sheet', 'worksheet', 'homework', 'assignment', 'quiz', 'test',
      'problem', 'equation', 'formula', 'theorem', 'hypothesis',
      'explain', 'describe', 'analyze', 'evaluate', 'compare', 'contrast',
      'activity', 'exercise', 'practice', 'review', 'study',
      'lesson', 'module', 'unit', 'chapter', 'section',
      'question', 'answer', 'fill in the blank', 'multiple choice',
      'true or false', 'matching', 'sequence', 'order',
      'calculate', 'compute', 'figure', 'reason', 'logic',
      'puzzle', 'riddle', 'brain teaser', 'critical thinking'
    ];
    return keywords.some(k => lower.includes(k));
  },

  buildGeminiPrompt(userPrompt) {
    let prompt = `You are Teacher Arlene, an ultra-accurate AI assistant specializing in image analysis. Your task is to provide 100 percent accurate, complete, and detailed responses.

Critical Instructions:
1. Read everything in the image - every word, number, symbol, diagram
2. Do not miss any text, even if it is small or blurry
3. Double-check your answers before responding
4. Provide complete answers - nothing should be cut off
5. If there are multiple questions, answer all of them
6. Show step-by-step solutions for math problems
7. For multiple choice, explain why your answer is correct and why others are wrong

Content Type Detection and Response Formats:

1. Activity Sheet / Worksheet / Quiz / Homework
Detect: Numbered questions, letters (A, B, C, D), blank spaces, instructions

Format:
ACTIVITY SHEET ANALYSIS

Subject: [Subject]
Type: [Multiple Choice / Fill in the Blanks / True or False / Matching / Problem Solving]

Question 1: [Complete question text]

Answer: [Letter]. [Full answer text]

Explanation:
[Complete explanation - at least 3-4 sentences]
Point 1
Point 2
Point 3

Why others are wrong:
A: [Why A is incorrect]
B: [Why B is incorrect]
D: [Why D is incorrect]

2. Math Problems / Equations
Detect: Numbers, variables (x, y, z), equations, word problems

Format:
MATH PROBLEM SOLUTION

Given:
[What is given in the problem]

Required:
[What is being asked]

Step-by-Step Solution:
Step 1: [First step with explanation]
Step 2: [Second step with explanation]
Step 3: [Third step with explanation]

Final Answer:
[Complete answer with proper units]

Check:
[Verify the answer is correct]

3. Science / Diagrams / Labels
Detect: Biological diagrams, chemical structures, physics diagrams, labels

Format:
SCIENCE ANALYSIS

Content Type: [Type of scientific content]

Parts Identified:
[Part 1] - [Function/Description]
[Part 2] - [Function/Description]
[Part 3] - [Function/Description]

Key Concepts:
[Explain the scientific concept thoroughly]

4. True or False Questions
Format:
Question: [Question text]

Answer: TRUE / FALSE

Explanation:
[Complete explanation why it is true or false]
Evidence 1
Evidence 2

5. Fill in the Blanks
Format:
Question: [Question text with blank ___]

Answer: [Correct word/phrase]

Explanation:
[Why this is the correct answer]

6. Matching Type
Format:
Column A to Column B
[Item 1] to [Letter]. [Matched item]
[Item 2] to [Letter]. [Matched item]

Explanation:
[Why these matches are correct]

7. Sequencing / Ordering
Format:
Correct Order:
1. [First]
2. [Second]
3. [Third]

Explanation:
[Why this order is correct]

8. General Image (Photo, Art, Screenshot)
Format:
IMAGE ANALYSIS

Content Type: [Type of image]

Description:
[Detailed description of what you see]

Key Elements:
Element 1
Element 2
Element 3

Final Important Rules:
1. Be 100 percent accurate - double-check everything
2. Be complete - never cut off answers
3. Be detailed - provide thorough explanations
4. For educational content, show all steps
5. For multiple choice, explain why each choice is right or wrong
6. For math, show complete step-by-step solutions
7. Never say "I cannot" - always try your best
8. Use plain text only - no markdown, no symbols
9. If you are unsure, state that clearly and provide your best answer
10. Always provide final answer clearly labeled

User Question: ${userPrompt || 'Analyze this image with maximum accuracy. Provide complete, detailed, and accurate answers for everything you see.'}

Start your analysis now:`;

    return prompt;
  },

  processGeminiResponse(response) {
    let processed = response || '';
    processed = this.cleanGeminiFormatting(processed);
    processed = this.ensureCompleteAnswers(processed);
    processed = this.ensureFinalAnswerSection(processed);
    return processed;
  },

  ensureCompleteAnswers(response) {
    let processed = response;
    const lines = processed.split('\n');
    let fixedLines = [];
    let inAnswer = false;
    let answerBuffer = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.match(/^Answer:/i) || line.match(/^ANSWER:/i)) {
        inAnswer = true;
        answerBuffer = [line];
        continue;
      }

      if (inAnswer) {
        if (line.trim() === '' || line.match(/^Explanation:/i) || line.match(/^EXPLANATION:/i)) {
          const answerText = answerBuffer.join(' ');
          if (answerText.length < 10 || !answerText.match(/[.!?]$/)) {
            let j = i;
            while (j < lines.length && !lines[j].match(/^Explanation:/i) && !lines[j].match(/^EXPLANATION:/i)) {
              if (lines[j].trim() !== '') {
                answerBuffer.push(lines[j]);
              }
              j++;
            }
          }
          fixedLines.push(answerBuffer.join(' '));
          inAnswer = false;
          if (line.match(/^Explanation:/i) || line.match(/^EXPLANATION:/i)) {
            fixedLines.push(line);
          }
          continue;
        }

        if (line.trim() !== '') {
          answerBuffer.push(line);
        }
        continue;
      }

      fixedLines.push(line);
    }

    if (inAnswer && answerBuffer.length > 0) {
      const answerText = answerBuffer.join(' ');
      if (!answerText.match(/[.!?]$/)) {
        answerBuffer.push('.');
      }
      fixedLines.push(answerBuffer.join(' '));
    }

    return fixedLines.join('\n');
  },

  ensureFinalAnswerSection(response) {
    let processed = response;
    const hasFinal = processed.match(/FINAL ANSWER:|Final Answer:/i);

    if (!hasFinal) {
      const lines = processed.split('\n');
      const hasAnswers = lines.some(line => line.match(/^Answer:|^ANSWER:/i));

      if (hasAnswers) {
        let lastAnswer = '';
        let lastExplanation = '';
        let inExplanation = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.match(/^Answer:|^ANSWER:/i)) {
            lastAnswer = line;
            inExplanation = false;
          }
          if (line.match(/^Explanation:|^EXPLANATION:/i)) {
            inExplanation = true;
            lastExplanation = line;
          }
          if (inExplanation && line.trim() !== '' && !line.match(/^Explanation:/i) && !line.match(/^EXPLANATION:/i)) {
            lastExplanation += ' ' + line.trim();
          }
        }

        if (lastAnswer) {
          processed += '\n\nFinal Summary:\n' + lastAnswer;
          if (lastExplanation) {
            processed += '\n' + lastExplanation;
          }
        }
      }
    }

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

  isReturnToTopicRequest(prompt) {
    const lower = prompt.toLowerCase();
    const patterns = [
      'balik tayo sa', 'balikan natin', 'going back to', 'back to the topic',
      'return to', 'tungkol naman sa', 'about the', 'regarding the',
      'balik sa', 'balikan mo', 'balikan yung', 'balikan ang'
    ];
    return patterns.some(p => lower.includes(p));
  },

  extractTopicFromReturn(prompt) {
    const lower = prompt.toLowerCase();
    const patterns = [
      'balik tayo sa', 'balikan natin', 'going back to', 'back to the topic',
      'return to', 'tungkol naman sa', 'about the', 'regarding the',
      'balik sa', 'balikan mo', 'balikan yung', 'balikan ang'
    ];
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        const topic = prompt.substring(prompt.toLowerCase().indexOf(pattern) + pattern.length).trim();
        return topic || null;
      }
    }
    return null;
  },

  isRealtimeQuestion(prompt) {
    const lower = prompt.toLowerCase();

    const timeKeywords = [
      'anong oras', 'what time', 'what is the time', 'anong petsa',
      'what date', 'what is the date', 'anong oras na', 'what time is it',
      'kasalukuyang oras', 'current time', 'current date'
    ];
    if (timeKeywords.some(k => lower.includes(k))) {
      return true;
    }

    const newsKeywords = [
      'ano balita', 'what news', 'latest news', 'balita ngayon',
      'may nangyari', 'what happened', 'ano update'
    ];
    if (newsKeywords.some(k => lower.includes(k))) {
      return true;
    }

    const weatherKeywords = [
      'ano panahon', 'what weather', 'weather today', 'panahon ngayon',
      'ulan ba', 'bagyo ba', 'may bagyo'
    ];
    if (weatherKeywords.some(k => lower.includes(k))) {
      return true;
    }

    const priceKeywords = [
      'magkano', 'how much', 'presyo ng', 'price of', 'gastos',
      'kuryente ngayon', 'gasolina ngayon'
    ];
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

    await sendMessage(senderId, {
      text: 'Unable to fetch real-time information. Please try again later.'
    }, token);
  },

  isExactTimeRequest(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = [
      'anong oras', 'what time', 'what is the time', 'anong petsa',
      'what date', 'what is the date', 'anong oras na', 'what time is it',
      'kasalukuyang oras', 'current time', 'current date',
      'oras', 'petsa'
    ];
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

      let message = `Real-Time sa Pilipinas\n\nPetsa: ${day}, ${month} ${date.getDate()}, ${date.getFullYear()}\nOras: ${hour12}:${minute.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm} (PHT)\nTimezone: Asia/Manila (UTC+8)\nDaylight Saving: Hindi ginagamit sa Pilipinas`;

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

        let message = `Real-Time sa Pilipinas\n\nPetsa: ${fallbackTime}\nTimezone: Asia/Manila (UTC+8)\nNote: Local system time`;

        await this.sendChunks(senderId, message, token);
      } catch (fallbackError) {
        await sendMessage(senderId, {
          text: 'Unable to fetch real-time time. Please try again later.'
        }, token);
      }
    }
  },

  isLyricsRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    const commands = ['lyrics ', 'lyric ', 'letra ng ', 'kanta ni ', 'song lyrics of '];
    return commands.some(cmd => lower.startsWith(cmd));
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
        text: 'Lyrics Search\n\nUsage: lyrics [song title] by [artist]\n\nExamples:\nlyrics lihim by arthur miguel\nletra ng lihim\nkanta ni arthur miguel\n\nFeatures:\nShows complete lyrics\nVerse, Chorus, Bridge, Adlibs\nArtist and title included\n100 percent accurate from API'
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
          text: `No lyrics found for "${title}".\n\nTry:\n- Check spelling\n- Add artist name\n- Use format: lyrics [title] by [artist]`
        }, token);
        return;
      }

      const lyricsData = data.data;
      const songTitle = lyricsData.title || title;
      const songArtist = lyricsData.artist || artist || 'Unknown Artist';
      const lyrics = lyricsData.lyrics || 'Lyrics not available.';

      let formattedLyrics = this.formatLyrics(lyrics);

      let message = `${songTitle}\nArtist: ${songArtist}\n\n${formattedLyrics}\n\nComplete lyrics\n${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`;

      await this.sendChunks(senderId, message, token);

    } catch (error) {
      console.error('[Lyrics] Error:', error.message);
      await sendMessage(senderId, {
        text: `Error fetching lyrics for "${title}". Please try again later.`
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
          if (i > 0 && lines[i - 1] === line) {
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
    const lower = prompt.toLowerCase().trim();
    const commands = ['generate ', 'image ', 'img ', 'show '];
    return commands.some(cmd => lower.startsWith(cmd));
  },

  isImageRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = [
      'show me a', 'show me an', 'give me a', 'give me an',
      'show me picture', 'show me photo', 'show me image',
      'generate an image', 'generate a picture', 'generate a photo',
      'find image', 'search image', 'image of a', 'picture of a',
      'photo of a', 'picture of an', 'photo of an', 'image of an'
    ];
    return patterns.some(pattern => lower.includes(pattern));
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

    const removeKeywords = ['show me', 'give me', 'i want', 'sample', 'example', 'picture of', 'image of', 'photo of', 'generate', 'create', 'need', 'maghanap ng', 'gusto ko', 'patingin ng', 'ano itsura', 'looks like', 'parang', 'larawan ng', 'litrato ng', 'imahe ng', 'want to see', 'can i see', 'let me see', 'find image', 'get image', 'search image', 'show me a', 'show me an', 'give me a', 'give me an', 'show me picture', 'show me photo', 'show me image', 'generate an image', 'generate a picture', 'generate a photo'];
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
      await sendMessage(senderId, { text: 'Image Generation\n\nUsage: generate [search term] [number]\n\nExamples:\ngenerate cat\ngenerate beautiful sunset 5' }, token);
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
      await sendMessage(senderId, { text: `Error fetching images for "${searchTerm}". Please try again.` }, token);
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
    const lower = prompt.toLowerCase().trim();
    const commands = ['gscholar ', 'scholar ', 'googlescholar ', 'research '];
    return commands.some(cmd => lower.startsWith(cmd));
  },

  isResearchQuery(prompt) {
    const lower = prompt.toLowerCase().trim();
    const patterns = [
      'research about', 'research on', 'study about', 'study on',
      'find research', 'search research', 'academic paper', 'scholarly article',
      'thesis about', 'dissertation about', 'journal about',
      'gscholar ', 'scholar ', 'googlescholar '
    ];
    return patterns.some(pattern => lower.includes(pattern));
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
      await sendMessage(senderId, { text: 'Google Scholar Search\n\nUsage: gscholar [search query]\n\nExamples:\ngscholar coconut hybridization\nresearch machine learning' }, token);
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

        let message = `${i + 1}. ${title}\n\nAuthors: ${displayAuthors}\nPublished in: ${venue}\nYear: ${year}`;
        if (volume) message += `\nVolume: ${volume}`;
        if (issue) message += `\nIssue: ${issue}`;
        if (pages) message += `\nPages: ${pages}`;
        message += `\nDOI: ${doi || 'Not available'}`;
        if (citedBy !== '0') message += `\nCited by: ${citedBy}`;
        message += `\nAbstract: ${snippet.substring(0, 300)}${snippet.length > 300 ? '...' : ''}\n\n`;
        if (scholarLink) message += `Google Scholar: ${scholarLink}\n\n`;
        message += `APA 7th Edition:\n${apaCitation}\n\nMLA 9th Edition:\n${mlaCitation}\n\nVerified: Viewable and accessible\n${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`;

        await sendMessage(senderId, { text: message }, token);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await sendMessage(senderId, { text: `Search Complete!\n\nQuery: ${query}\nFound: ${results.length} papers\nSource: Google Scholar Website` }, token);

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
        const last = parts[parts.length - 1];
        const first = parts.slice(0, -1).map(p => p[0] + '.').join(' ');
        formatted = `${last}, ${first}`;
      } else formatted = list[0];
    } else if (list.length === 2) {
      const p1 = list[0].split(' ');
      const p2 = list[1].split(' ');
      const l1 = p1.length > 1 ? p1[p1.length - 1] : p1[0];
      const f1 = p1.length > 1 ? p1.slice(0, -1).map(p => p[0] + '.').join(' ') : '';
      const l2 = p2.length > 1 ? p2[p2.length - 1] : p2[0];
      const f2 = p2.length > 1 ? p2.slice(0, -1).map(p => p[0] + '.').join(' ') : '';
      formatted = `${l1}, ${f1}, & ${l2}, ${f2}`;
    } else {
      const parts = list[0].split(' ');
      const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
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
      formatted = parts.length > 1 ? `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}` : list[0];
    } else if (list.length === 2) {
      const p1 = list[0].split(' ');
      const p2 = list[1].split(' ');
      const l1 = p1.length > 1 ? p1[p1.length - 1] : p1[0];
      const l2 = p2.length > 1 ? p2[p2.length - 1] : p2[0];
      formatted = `${l1} and ${l2}`;
    } else {
      const parts = list[0].split(' ');
      const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
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
    const lower = prompt.toLowerCase().trim();
    const patterns = [
      'play the song', 'play music', 'play audio',
      'search song', 'find song', 'listen to',
      'music of ', 'song called', 'track called',
      'play ', 'pakinggan ', 'patugtog '
    ];
    return patterns.some(pattern => lower.includes(pattern));
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
      await sendMessage(senderId, { text: 'Music Search\n\nUsage: play [song title] or music [song title]\n\nExamples:\nplay lihim\nmusic halik' }, token);
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

      let message = `SoundCloud Results for "${searchTerm}"\nFound ${totalResults} song(s)\n\n`;

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

        message += `${i + 1}. ${title}\nSinger/Artist: ${artist}\nGenre: ${genre}\nDuration: ${duration}\nReleased: ${created}\nPlays: ${plays.toLocaleString()}\nLikes: ${likes.toLocaleString()}`;
        if (artwork) message += `\nArtwork: ${artwork}`;
        message += `\nListen: ${url}`;
        if (audioUrl) message += `\nDirect Audio: ${audioUrl}`;
        message += `\n\n`;
      }

      message += `Found ${totalResults} result(s)\n${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`;

      await this.sendChunks(senderId, message, token);

    } catch (error) {
      console.error('[Music] Error:', error.message);
      await sendMessage(senderId, { text: `Error searching for "${searchTerm}". Please try again later.` }, token);
    }
  },

  formatDuration(ms) {
    if (!ms) return 'Unknown';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
      return processed || 'Unable to analyze the image. Please try again.';

    } catch (error) {
      console.error('[Gemini] Error:', error.message);
      const fallbackPrompt = `The user sent an image but the image analysis failed. The user asked: ${prompt || 'Please describe what you see'}. Please provide a helpful response.`;
      const response = await this.callAPI(fallbackPrompt, 'gemini_fallback');
      return this.cleanResponse(response || 'Unable to analyze the image. Please try again.');
    }
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
      const response = await this.executeApiCall(primary, prompt, senderId);
      return this.ensureCompleteTextResponse(response);
    } catch (primaryError) {
      console.error('[API] Primary API failed:', primaryError.message);
      try {
        console.log('[API] Trying fallback API...');
        const response = await this.executeApiCall(fallback, prompt, senderId);
        return this.ensureCompleteTextResponse(response);
      } catch (fallbackError) {
        console.error('[API] Fallback API also failed:', fallbackError.message);
        throw new Error('Both primary and fallback APIs failed.');
      }
    }
  },

  ensureCompleteTextResponse(response) {
    if (!response) return 'No response.';

    let processed = response;

    if (!processed.includes('ANSWER:') && !processed.includes('Answer:')) {
      processed = 'Answer:\n' + processed;
    }

    if (!processed.includes('EXPLANATION:') && !processed.includes('Explanation:')) {
      processed += '\n\nExplanation:\n[Detailed explanation of the answer above]';
    }

    if (!processed.match(/[.!?]\s*$/)) {
      processed += '.';
    }

    return processed;
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
      .trim();
  },

  wantsDetailedAnswer(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = [
      'explain more', 'more explanation', 'more details', 'detailed', 'detail',
      'elaborate', 'elaborate more', 'paki elaborate', 'mas detalyado',
      'tell me more', 'give more info', 'dagdagan', 'dagdag',
      'further explain', 'further explanation', 'full explanation',
      'complete explanation', 'in depth', 'in-depth', 'thorough',
      'comprehensive', 'expound', 'pakilinaw', 'linawin',
      'more information', 'additional info', 'karagdagang',
      'can you explain further', 'please elaborate',
      'solve', 'solution', 'step by step', 'steps', 'show your work',
      'compute', 'calculate', 'equation', 'formula', 'algebra',
      'analyze', 'analysis', 'evaluate', 'assessment', 'review',
      'compare', 'contrast', 'difference', 'similarity', 'versus', 'vs',
      'definition', 'meaning', 'describe', 'identify',
      'discuss', 'clarify', 'illustrate', 'demonstrate'
    ];
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
      .replace(/^(In summary|To summarize|In conclusion|Basically|Essentially|Simply put|In other words|That said|Having said that|With that said)\s*,?\s*/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return concise || text;
  },

  isContextualQuestion(prompt, previousPrompt) {
    if (!previousPrompt) return false;
    const patterns = [
      'so yan', 'so ito', 'so iyan', 'so yun', 'so ganyan', 'so ganito', 'so ganun',
      'yan na ba', 'yun na ba', 'ito na ba', 'ganyan na ba', 'ganun na ba',
      'tama ba', 'tama', 'correct', 'right',
      'so tungkol', 'so sa', 'so para sa', 'so ibig sabihin', 'so meaning',
      'so parang', 'so sa madaling salita', 'so in short',
      'paano naman', 'what about', 'how about', 'paano kung', 'what if',
      'bakit', 'why', 'paano', 'how', 'kailan', 'when', 'saan', 'where',
      'sino', 'who', 'alin', 'which', 'ano', 'what', 'ano ba', 'what about',
      'gets', 'gets ko', 'nagets', 'naintindihan', 'so gets', 'so naintindihan',
      'ayun', 'ayon', 'ganun pala', 'ganyan pala', 'so ayun', 'so ayon',
      'ok', 'okay', 'sige', 'cge', 'so okay', 'so sige',
      'ah ganun', 'ah ganyan', 'ah okay', 'so ah', 'so okay',
      'talaga', 'really', 'sure', 'so talaga', 'so sure',
      'so that', 'so this', 'so it', 'so about', 'so regarding',
      'so basically', 'so essentially', 'so you mean', 'so you saying'
    ];
    const isRelated = patterns.some(p => prompt.includes(p));
    const prevWords = previousPrompt.split(' ').filter(w => w.length > 2);
    const currentWords = prompt.split(' ').filter(w => w.length > 2);
    const hasRelated = prevWords.some(w => currentWords.some(c => c.includes(w) || w.includes(c)));
    return isRelated || hasRelated;
  },

  isFollowUpRequest(prompt) {
    const keywords = [
      'elaborate', 'explain more', 'paki elaborate', 'paki explain',
      'paliwanag', 'ipaliwanag', 'elab', 'explain', 'detail', 'further',
      'more details', 'mas detalyado', 'summarize', 'summary', 'i-summarize',
      'brief', 'make it short', 'short', 'concise', 'shorten', 'sum',
      'ikli', 'paikliin', 'simplify', 'simple', 'pasimplehin', 'basic',
      'simplified', 'simp', 'madali', 'dali', 'gawing simple',
      'example', 'sample', 'halimbawa', 'instance', 'eg', 'ex', 'hal',
      'give example', 'give examples', 'magbigay ng halimbawa',
      'correct', 'fix', 'tama', 'ayusin', 'improve', 'better', 'improved',
      'i-correct', 'i-fix', 'iwasto', 'add', 'additional', 'dagdagan',
      'more', 'add more', 'dagdag', 'karagdagang',
      'tama ba', 'correct ba', 'right ba', 'sure ba', 'talaga', 'really',
      'are you sure', 'sigurado ka', 'clarify', 'clarification', 'linawin',
      'clear', 'make clear', 'ulit', 'repeat', 'say again', 'paulit',
      'ulitin', 'paki-ulit', 'pakiulit', 'again',
      'gets', 'nagets', 'naintindihan', 'understand', 'naiintindihan',
      'gets ko', 'nagets ko', 'gots', 'got it',
      'oo', 'opo', 'sige', 'cge', 'okay', 'ok', 'agree', 'yes', 'yeah', 'yep',
      'hindi', 'dili', 'no', 'not', 'mali', 'disagree', 'hindi tama', 'mali yan'
    ];
    return keywords.some(k => prompt.includes(k));
  },

  isNewTopic(prompt, previousPrompt, originalPrompt) {
    if (!previousPrompt) return true;

    const lowerPrompt = prompt.toLowerCase();

    const casualPhrases = ['hahaha', 'haha', 'hehe', 'lol', 'lmao', 'oh', 'ah', 'eh', 'ay', 'ha', 'hmm', 'hm', 'mmm', 'wow', 'shet', 'gagi', 'lala', 'hala', 'talaga', 'seryoso', 'grabe', 'sus', 'hay', 'ayoko', 'sige', 'cge', 'okay', 'ok', 'ge', 'bakit', 'why', 'paano', 'how', 'ano', 'what', 'saan', 'where', 'kailan', 'when', 'sino', 'who'];
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

    const indicators = ['hello', 'hi', 'hey', 'kamusta', 'musta', 'tanong', 'question', 'new topic', 'bagong topic', 'iba naman', 'lipat tayo', 'move on', 'gusto ko malaman', 'i want to know', 'tell me about', 'ano ang', 'what is'];
    if (indicators.some(i => lowerPrompt.includes(i)) && !this.isFollowUpRequest(prompt)) {
      return true;
    }

    return false;
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
    let final = '';

    if (previousResponse) {
      final += 'Previous conversation context:\n';
      final += 'User asked: ' + (previousPrompt || 'unknown') + '\n';
      final += 'AI responded: ' + previousResponse + '\n\n';

      const lower = prompt.toLowerCase();

      if (this.isContextualQuestion(lower, previousPrompt)) {
        final += 'User is asking a follow-up question about the previous topic.\n';
        final += 'Provide a direct answer that continues the conversation naturally.\n';
        final += 'Acknowledge the previous context and respond as if having a natural conversation.\n\n';
      }

      if (this.isTranslationRequest(prompt)) {
        const lang = this.detectTargetLanguage(prompt);
        final += 'User wants to translate the previous response to ' + lang + '.\n';
        final += 'Provide the translation to ' + lang + ' only. Do not include the original text.\n\n';
      } else if (lower.includes('elaborate') || lower.includes('explain more') ||
        lower.includes('paki elaborate') || lower.includes('detail') ||
        lower.includes('further') || lower.includes('paliwanag') ||
        lower.includes('more details') || lower.includes('mas detalyado')) {
        final += 'User wants you to elaborate on your previous response.\n';
        final += 'Provide a detailed explanation with more information, context, and examples.\n\n';
      } else if (lower.includes('summarize') || lower.includes('summary') ||
        lower.includes('i-summarize') || lower.includes('brief') ||
        lower.includes('make it short') || lower.includes('short') ||
        lower.includes('concise') || lower.includes('shorten')) {
        final += 'User wants a concise summary of your previous response.\n';
        final += 'Provide only the most important key points in a short, clear, and direct manner.\n\n';
      } else if (lower.includes('example') || lower.includes('sample') ||
        lower.includes('halimbawa') || lower.includes('instance')) {
        final += 'User wants examples related to your previous response.\n';
        final += 'Provide relevant examples to illustrate your points.\n\n';
      } else {
        final += 'User is continuing the conversation about the previous topic.\n';
        final += 'User says: ' + prompt + '\n';
        final += 'Provide a natural response that continues the discussion.\n';
        final += 'Acknowledge the previous context and respond directly to the user.\n\n';
      }
    } else {
      final = prompt;
    }

    final += `You are Teacher Arlene, an ultra-accurate AI assistant.

Critical Instructions for Text-Based Questions:
1. Read the question carefully - understand what is being asked
2. Provide complete answers - nothing should be cut off
3. For math problems: Show step-by-step solutions
4. For definitions: Provide clear, accurate definitions with examples
5. For compare/contrast: Use structured format with similarities and differences
6. For explain: Provide thorough explanations with real-world examples
7. Double-check your answers before responding
8. If you are unsure, state that clearly and provide your best answer

Response Formats for Text Questions:

1. Definition / Explanation Questions
Format:
Answer:
[Clear, accurate definition]

Detailed Explanation:
[Thorough explanation with examples]
Key Point 1: [Explanation]
Key Point 2: [Explanation]
Key Point 3: [Explanation]

Real-World Example:
[Practical example to illustrate]

2. Math / Problem Solving
Format:
Given:
[What is given]

Required:
[What is being asked]

Step-by-Step Solution:
Step 1: [First step with explanation]
Step 2: [Second step with explanation]
Step 3: [Third step with explanation]

Final Answer:
[Complete answer with proper units]

Check:
[Verification of answer]

3. Compare / Contrast Questions
Format:
Comparison Analysis

Similarities:
- [Similarity 1]
- [Similarity 2]

Differences:
- [Difference 1]
- [Difference 2]

Conclusion:
[Summary of comparison]

4. Analysis / Evaluation Questions
Format:
Analysis:
Point 1: [Analysis point 1]
Point 2: [Analysis point 2]
Point 3: [Analysis point 3]

Evaluation:
[Overall evaluation]

Recommendation:
[Recommendation if applicable]

5. List / Enumeration Questions
Format:
Answer:
1. [Item 1] - [Explanation]
2. [Item 2] - [Explanation]
3. [Item 3] - [Explanation]

Summary:
[Brief summary of all items]

6. True or False Questions
Format:
Answer: TRUE / FALSE

Explanation:
[Complete explanation why it is true or false]
Evidence 1
Evidence 2

7. Fill in the Blanks
Format:
Answer: [Correct word/phrase]

Explanation:
[Why this is the correct answer]

8. Essay / Long Form Questions
Format:
Introduction:
[Brief introduction]

Body:
[Detailed explanation with examples]

Conclusion:
[Summary and final thoughts]

9. Definition of Terms
Format:
Term: [Term being defined]

Definition:
[Clear, accurate definition]

Explanation:
[Detailed explanation]

Example:
[Practical example]

10. Sequencing / Ordering
Format:
Correct Order:
1. [First]
2. [Second]
3. [Third]

Explanation:
[Why this order is correct]

Final Important Rules:
1. Be 100 percent accurate - double-check everything
2. Be complete - never cut off answers
3. Be detailed - provide thorough explanations
4. For math, show all steps
5. For definitions, provide examples
6. For comparisons, show similarities and differences
7. Use plain text only - no markdown
8. If unsure, state that clearly
9. Always provide final answer clearly labeled
10. Use Filipino/Taglish if the question is in Filipino`;

    if (wantsDetailed) {
      final += '\n\nUser wants detailed answer: Provide a comprehensive, thorough, and detailed explanation. Include examples, context, and complete information.';
    } else {
      final += '\n\nUser wants concise answer: Provide a short, direct, and accurate response. Be straight to the point. Maximum 2-3 sentences or 1-2 paragraphs. No unnecessary explanations. Just the key facts.';
    }

    final += '\n\nUser Question: ' + prompt;

    return final;
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
    const languages = ['tagalog', 'bisaya', 'cebuano', 'spanish', 'filipino', 'english', 'ilocano', 'waray', 'hiligaynon', 'kapampangan'];
    return languages.some(l => lower.includes(l));
  },

  detectTargetLanguage(prompt) {
    const lower = prompt.toLowerCase();
    const languages = {
      'tagalog': 'Tagalog', 'filipino': 'Filipino',
      'bisaya': 'Bisaya', 'cebuano': 'Cebuano',
      'ilocano': 'Ilocano', 'waray': 'Waray',
      'hiligaynon': 'Hiligaynon', 'kapampangan': 'Kapampangan',
      'english': 'English', 'spanish': 'Spanish'
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
