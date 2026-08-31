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

// ========== NEW: CHECK IF SCAN COMMAND ==========
const isScanCommand = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  const scanKeywords = ['scan', 'identify', 'detect', 'whatisthis', 'scanimage', 'scan this', 'scan this image'];
  return scanKeywords.some(k => lower === k || lower.startsWith(k + ' '));
};

const handleMessage = async (event, pageAccessToken) => {
  const senderId = event?.sender?.id;
  if (!senderId) return;
  
  const messageText = event?.message?.text?.trim();
  const attachments = event?.message?.attachments || [];
  const isReply = !!event?.message?.reply_to?.mid;
  
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
  // SCENARIO 1: REPLY TO IMAGE WITH SCAN COMMAND (NEW)
  // ============================================
  if (isReply && messageText && isScanCommand(messageText)) {
    console.log('[handleMessage] Scan command detected on reply');
    const scanCommand = commands.get('scan');
    if (scanCommand) {
      const words = messageText.split(' ');
      const args = words.slice(1);
      await scanCommand.execute(senderId, args, pageAccessToken, event);
      return;
    }
  }

  // ============================================
  // SCENARIO 2: HAS IMAGE WITH TEXT
  // ============================================
  if (hasImage && imageUrl && messageText) {
    const words = messageText.split(' ');
    const firstWord = words[0].toLowerCase();
    const command = commands.get(firstWord);
    
    // If it's a specific command, execute it
    if (command) {
      const args = words.slice(1);
      await command.execute(senderId, args, pageAccessToken, event);
      return;
    }
    
    // ========== NEW: Check if the whole text is a scan command ==========
    if (isScanCommand(messageText)) {
      const scanCommand = commands.get('scan');
      if (scanCommand) {
        await scanCommand.execute(senderId, [], pageAccessToken, event);
        return;
      }
    }
    
    // ========== AUTO-IMAGE ANALYSIS (ai.js) - RETAINED ==========
    console.log('[handleMessage] Auto-analyzing image with caption...');
    const geminiCommand = commands.get('gemini');
    if (geminiCommand) {
      await geminiCommand.execute(senderId, [], pageAccessToken, event);
      return;
    }
  }

  // ============================================
  // SCENARIO 3: HAS IMAGE BUT NO TEXT (AUTO) - RETAINED
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
