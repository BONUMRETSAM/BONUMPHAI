const fs = require('fs');
const path = require('path');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const imageCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

const loadCommands = () => {
  const commandsDir = path.join(__dirname, '../commands');
  
  for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
    delete require.cache[require.resolve(`../commands/${file}`)];
    const command = require(`../commands/${file}`);
    
    const names = Array.isArray(command.name) ? command.name : [command.name];
    names.forEach(name => {
      if (typeof name === 'string') {
        commands.set(name.toLowerCase(), command);
      }
    });
  }
};

loadCommands();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of imageCache) {
    if (now - value.timestamp > CACHE_TTL) {
      imageCache.delete(key);
    }
  }
}, CACHE_TTL);

const isMathQuery = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  const mathKeywords = [
    'solve', 'equation', 'derivative', 'integral', 'limit', 'area', 'volume',
    'sin', 'cos', 'tan', 'mean', 'median', 'mode', 'probability', 'matrix',
    'algebra', 'calculus', 'geometry', 'trigonometry', 'statistics',
    'add', 'subtract', 'multiply', 'divide', 'fraction', 'decimal', 'percent',
    'square', 'cube', 'root', 'power', 'exponent', 'factor', 'polynomial',
    'triangle', 'circle', 'rectangle', 'perimeter', 'circumference',
    'pythagorean', 'hypotenuse', 'angle', 'degree', 'radian',
    'samples', 'examples', 'sample', 'example'
  ];
  
  if (mathKeywords.some(k => lower.includes(k))) return true;
  
  const patterns = [
    /[\d\+\-\*\/\^\(\)\=]/,
    /\d+\s*[+\-*/]\s*\d+/,
    /x\s*[+\-*/=]/,
    /y\s*[+\-*/=]/,
    /[=]\s*[\d]+/
  ];
  
  return patterns.some(p => p.test(text));
};

// ========== CHECK IF SCAN COMMAND ==========
const isScanCommand = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  const scanKeywords = ['scan', 'identify', 'detect', 'whatisthis', 'scanimage', 'scan this', 'scan this image'];
  return scanKeywords.some(k => lower === k || lower.startsWith(k + ' '));
};

// ========== GET IMAGE URL FROM REPLY ==========
const getImageUrlFromReply = async (replyToMid, pageAccessToken) => {
  try {
    const url = `https://graph.facebook.com/v21.0/${replyToMid}`;
    const params = {
      access_token: pageAccessToken,
      fields: 'message,from,attachments{image_data,url,type},created_time'
    };
    
    console.log('[getImageUrlFromReply] Fetching message:', replyToMid);
    
    const response = await axios.get(url, { params });
    const data = response.data;
    
    console.log('[getImageUrlFromReply] Response received');
    
    let imageUrl = null;
    
    if (data?.attachments?.data) {
      for (const attachment of data.attachments.data) {
        if (attachment.type === 'image' || attachment.type === 'photo') {
          imageUrl = attachment?.image_data?.url || 
                    attachment?.payload?.url || 
                    attachment?.url || 
                    null;
          if (imageUrl) {
            console.log('[getImageUrlFromReply] Found image URL');
            break;
          }
        }
      }
    }
    
    return imageUrl;
  } catch (error) {
    console.error('[getImageUrlFromReply] Error:', error.message);
    return null;
  }
};

const handleMessage = async (event, pageAccessToken) => {
  const senderId = event?.sender?.id;
  if (!senderId) return;
  
  const messageText = event?.message?.text?.trim();
  const attachments = event?.message?.attachments || [];
  const isReply = !!event?.message?.reply_to?.mid;
  const replyToMid = event?.message?.reply_to?.mid;
  
  let imageUrl = null;
  let hasImage = false;
  
  for (const attachment of attachments) {
    if (attachment.type === 'image' || attachment.type === 'photo') {
      imageUrl = attachment.payload?.url || attachment.url || null;
      hasImage = true;
      if (imageUrl) {
        imageCache.set(senderId, {
          url: imageUrl,
          timestamp: Date.now()
        });
        break;
      }
    }
  }

  // ============================================
  // SCENARIO 1: REPLY TO IMAGE WITH SCAN COMMAND (FIXED)
  // ============================================
  if (isReply && messageText && isScanCommand(messageText)) {
    console.log('[handleMessage] Scan command detected on reply');
    
    // ========== FIX: Get image URL from the replied message ==========
    let replyImageUrl = null;
    if (replyToMid) {
      replyImageUrl = await getImageUrlFromReply(replyToMid, pageAccessToken);
    }
    
    // If we got an image from the reply, attach it to the event
    if (replyImageUrl) {
      // Create a modified event with the image URL
      const modifiedEvent = {
        ...event,
        message: {
          ...event.message,
          attachments: [
            {
              type: 'image',
              payload: { url: replyImageUrl }
            }
          ]
        },
        _scanImageUrl: replyImageUrl // Also add as custom property
      };
      
      const scanCommand = commands.get('scan');
      if (scanCommand) {
        const words = messageText.split(' ');
        const args = words.slice(1);
        await scanCommand.execute(senderId, args, pageAccessToken, modifiedEvent);
        return;
      }
    } else {
      // If no image found in reply, check cache
      const cachedImage = imageCache.get(senderId);
      if (cachedImage && cachedImage.url) {
        const modifiedEvent = {
          ...event,
          message: {
            ...event.message,
            attachments: [
              {
                type: 'image',
                payload: { url: cachedImage.url }
              }
            ]
          },
          _scanImageUrl: cachedImage.url
        };
        
        const scanCommand = commands.get('scan');
        if (scanCommand) {
          const words = messageText.split(' ');
          const args = words.slice(1);
          await scanCommand.execute(senderId, args, pageAccessToken, modifiedEvent);
          return;
        }
      }
      
      // If still no image, proceed normally
      const scanCommand = commands.get('scan');
      if (scanCommand) {
        const words = messageText.split(' ');
        const args = words.slice(1);
        await scanCommand.execute(senderId, args, pageAccessToken, event);
        return;
      }
    }
  }

  // ============================================
  // SCENARIO 2: HAS IMAGE WITH TEXT
  // ============================================
  if (hasImage && imageUrl && messageText) {
    const words = messageText.split(' ');
    const firstWord = words[0].toLowerCase();
    const command = commands.get(firstWord);
    
    if (command) {
      const args = words.slice(1);
      await command.execute(senderId, args, pageAccessToken, event);
      return;
    }
    
    if (isScanCommand(messageText)) {
      const scanCommand = commands.get('scan');
      if (scanCommand) {
        await scanCommand.execute(senderId, [], pageAccessToken, event);
        return;
      }
    }
    
    console.log('[handleMessage] Auto-analyzing image with caption...');
    const geminiCommand = commands.get('gemini');
    if (geminiCommand) {
      await geminiCommand.execute(senderId, [], pageAccessToken, event);
      return;
    }
  }

  // ============================================
  // SCENARIO 3: HAS IMAGE BUT NO TEXT (AUTO)
  // ============================================
  if (hasImage && imageUrl && !messageText) {
    console.log('[handleMessage] Auto-analyzing image with gemini...');
    const geminiCommand = commands.get('gemini');
    if (geminiCommand) {
      await geminiCommand.execute(senderId, [], pageAccessToken, event);
      return;
    }
  }

  // ============================================
  // SCENARIO 4: NO IMAGE, TEXT ONLY
  // ============================================
  if (!messageText) return;
  
  const words = messageText.split(' ');
  const firstWord = words[0].toLowerCase();
  const args = words.slice(1);
  
  try {
    const command = commands.get(firstWord);
    
    if (command) {
      await command.execute(senderId, args, pageAccessToken, event);
      return;
    }
    
    if (isMathQuery(messageText)) {
      const mathCommand = commands.get('math');
      if (mathCommand) {
        await mathCommand.execute(senderId, [messageText], pageAccessToken, event);
        return;
      }
    }
    
    if (commands.has('ai')) {
      await commands.get('ai').execute(senderId, [messageText], pageAccessToken, event);
      return;
    }
    
    await sendMessage(senderId, {
      text: 'Unknown command. Available commands: ' + Array.from(commands.keys()).join(', ')
    }, pageAccessToken);
    
  } catch (error) {
    console.error('Command execution error:', error.message);
    await sendMessage(senderId, { text: 'Command execution failed.' }, pageAccessToken);
  }
};

module.exports = { handleMessage };
