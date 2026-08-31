const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const MAX_CHUNK = 1900;

module.exports = {
  name: ['scan', 'identify', 'detect', 'whatisthis', 'scanimage'],
  description: 'Scan and identify plants, trees, fruits, flowers, leaves, branches, animals, insects, and more from images',
  usage: 'Reply to an image with "scan" or "scan this image"',
  version: '4.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 10,

  async execute(senderId, args, token, event) {
    try {
      let prompt = args.join(' ').trim();
      let imageUrl = null;

      // Check if replying to an image
      if (event?.message?.reply_to?.mid) {
        const replyData = await this.getRepliedMessageData(event.message.reply_to.mid, token);
        imageUrl = replyData.imageUrl;
        if (imageUrl) {
          console.log('[scan] Image detected from reply');
        }
      }

      // Check if image is in the message
      if (!imageUrl && event?.message?.attachments) {
        for (const attachment of event.message.attachments) {
          if (attachment.type === 'image' || attachment.type === 'photo') {
            imageUrl = attachment.payload?.url || attachment.url || null;
            if (imageUrl) {
              const urlObj = new URL(imageUrl);
              urlObj.searchParams.set('access_token', token);
              imageUrl = urlObj.toString();
              console.log('[scan] Image detected from attachment');
            }
            break;
          }
        }
      }

      // Text-based search
      if (!imageUrl && prompt) {
        if (this.isTextQuery(prompt)) {
          await this.handleTextSearch(senderId, prompt, token);
          return;
        }
        await sendMessage(senderId, {
          text: 'SCAN IDENTIFIER\n\nHOW TO USE:\n1. Send an image\n2. Reply with "scan" or "scan this image"\n\nOr type: scan what is [name]'
        }, token);
        return;
      }

      // No image
      if (!imageUrl) {
        await sendMessage(senderId, {
          text: 'Send an image then reply with "scan"\n\nOr type: scan what is [name]'
        }, token);
        return;
      }

      // Scan the image
      await sendMessage(senderId, {
        text: 'Scanning image... Please wait.'
      }, token);

      const identification = await this.identifyWithGemini(imageUrl);

      if (!identification) {
        await sendMessage(senderId, {
          text: 'Unable to identify. Please try:\n- Clearer image\n- Better lighting\n- Different angle'
        }, token);
        return;
      }

      const response = this.formatResponse(identification);
      await this.sendChunks(senderId, response, token);

    } catch (error) {
      console.error('[scan] Error:', error.message);
      await sendMessage(senderId, {
        text: 'Error scanning image. Please try again.'
      }, token);
    }
  },

  // ============================================
  // IDENTIFY WITH GEMINI
  // ============================================
  async identifyWithGemini(imageUrl) {
    try {
      const geminiPrompt = this.buildGeminiPrompt();
      const apiUrl = `https://norch-project.gleeze.com/api/gemini?prompt=${encodeURIComponent(geminiPrompt)}&imageurl=${encodeURIComponent(imageUrl)}`;
      
      const response = await axios.get(apiUrl, {
        timeout: 90000,
        headers: { 'Accept': 'application/json' }
      });

      if (!response || !response.data) {
        throw new Error('No response from Gemini API');
      }

      const result = this.parseResponse(response.data.response || '');
      return result;

    } catch (error) {
      console.error('[Identify] Error:', error.message);
      return null;
    }
  },

  // ============================================
  // BUILD GEMINI PROMPT
  // ============================================
  buildGeminiPrompt() {
    return `You are an expert botanist, biologist, and taxonomist specializing in Philippine flora and fauna. Analyze the image and identify the organism with COMPLETE and ACCURATE scientific information.

RULES:
1. Identify what type of organism this is (Plant, Tree, Fruit, Flower, Leaf, Branch, Animal, Bird, Insect, Fish, Mushroom, etc.)
2. Provide COMPLETE scientific classification
3. Include Philippine local names (Tagalog, Bisaya, Ilocano) if known
4. Be SPECIFIC with scientific names
5. If unsure, write "Unknown" or "Not confirmed"
6. Respond in PLAIN ENGLISH only. NO emojis, NO special characters, NO markdown.

RESPONSE FORMAT (EXACTLY as shown - FILL ALL FIELDS):

TYPE: [Plant/Tree/Fruit/Flower/Leaf/Branch/Animal/Bird/Insect/Fish/Mushroom/Marine Life/Other]

PART IDENTIFIED: [Bunga/Fruit, Bulaklak/Flower, Puno/Tree, Dahon/Leaf, Sanga/Branch, Buto/Seed, Ugat/Root, Bark, Whole Plant, etc.]

COMMON NAME: [Common name in English]

LOCAL NAMES:
- Tagalog: [Tagalog name]
- Bisaya: [Bisaya name]
- Ilocano: [Ilocano name]
- Other: [Other local names]

SCIENTIFIC NAME: [Complete scientific name with authority]

TAXONOMY:
- Kingdom: [Kingdom]
- Phylum: [Phylum]
- Class: [Class]
- Order: [Order]
- Family: [Family]
- Genus: [Genus]
- Species: [Species]

DESCRIPTION:
[Detailed physical description based on what is visible in the image]

CHARACTERISTICS:
- Size: [Approximate size]
- Color: [Color description]
- Shape: [Shape description]
- Texture: [Texture description]
- Distinctive Features: [Unique characteristics]

HABITAT:
[Natural environment where it is commonly found]

DISTRIBUTION:
[Geographic distribution]

ECOLOGICAL ROLE:
[Role in ecosystem]

USES/BENEFITS:
[Economic, medicinal, cultural uses]

CONSERVATION STATUS:
[IUCN status]

DAO GROUP:
[DAO classification or "Not listed"]

ADDITIONAL INFO:
[Interesting facts, cultural significance]

IMPORTANT: BE SPECIFIC AND ACCURATE. Use Philippine context when applicable. NO emojis, NO special characters, NO markdown.`;
  },

  // ============================================
  // PARSE RESPONSE
  // ============================================
  parseResponse(response) {
    const result = {
      type: '',
      partIdentified: '',
      commonName: '',
      localNames: { tagalog: '', bisaya: '', ilocano: '', other: '' },
      scientificName: '',
      taxonomy: { kingdom: '', phylum: '', class: '', order: '', family: '', genus: '', species: '' },
      description: '',
      characteristics: { size: '', color: '', shape: '', texture: '', distinctiveFeatures: '' },
      habitat: '',
      distribution: '',
      ecologicalRole: '',
      uses: '',
      conservationStatus: '',
      daoGroup: '',
      additionalInfo: ''
    };

    const lines = response.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const match = trimmed.match(/^([A-Z\s\-]+):\s*(.*)/);
      if (match) {
        const key = match[1].toLowerCase().trim();
        const value = match[2].trim();

        switch (key) {
          case 'type': result.type = value; break;
          case 'part identified': result.partIdentified = value; break;
          case 'common name': result.commonName = value; break;
          case 'scientific name': result.scientificName = value; break;
          case 'kingdom': result.taxonomy.kingdom = value; break;
          case 'phylum': result.taxonomy.phylum = value; break;
          case 'class': result.taxonomy.class = value; break;
          case 'order': result.taxonomy.order = value; break;
          case 'family': result.taxonomy.family = value; break;
          case 'genus': result.taxonomy.genus = value; break;
          case 'species': result.taxonomy.species = value; break;
          case 'description': result.description = value; currentSection = 'description'; break;
          case 'size': result.characteristics.size = value; break;
          case 'color': result.characteristics.color = value; break;
          case 'shape': result.characteristics.shape = value; break;
          case 'texture': result.characteristics.texture = value; break;
          case 'distinctive features': result.characteristics.distinctiveFeatures = value; break;
          case 'habitat': result.habitat = value; currentSection = 'habitat'; break;
          case 'distribution': result.distribution = value; currentSection = 'distribution'; break;
          case 'ecological role': result.ecologicalRole = value; currentSection = 'ecological'; break;
          case 'uses/benefits': result.uses = value; currentSection = 'uses'; break;
          case 'conservation status': result.conservationStatus = value; break;
          case 'dao group': result.daoGroup = value; break;
          case 'additional info': result.additionalInfo = value; break;
          case 'tagalog': result.localNames.tagalog = value; break;
          case 'bisaya': result.localNames.bisaya = value; break;
          case 'ilocano': result.localNames.ilocano = value; break;
          case 'other': result.localNames.other = value; break;
        }
      } else {
        if (currentSection === 'description') result.description += ' ' + trimmed;
        else if (currentSection === 'habitat') result.habitat += ' ' + trimmed;
        else if (currentSection === 'distribution') result.distribution += ' ' + trimmed;
        else if (currentSection === 'ecological') result.ecologicalRole += ' ' + trimmed;
        else if (currentSection === 'uses') result.uses += ' ' + trimmed;
      }
    }

    // Clean up
    for (const key of Object.keys(result)) {
      if (typeof result[key] === 'string') {
        result[key] = result[key].trim();
      }
    }
    for (const key of Object.keys(result.taxonomy)) {
      result.taxonomy[key] = result.taxonomy[key].trim();
    }
    for (const key of Object.keys(result.localNames)) {
      result.localNames[key] = result.localNames[key].trim();
    }
    for (const key of Object.keys(result.characteristics)) {
      result.characteristics[key] = result.characteristics[key].trim();
    }

    return result;
  },

  // ============================================
  // FORMAT RESPONSE (CLEAN - NO EMOJIS)
  // ============================================
  formatResponse(data) {
    let response = 'IDENTIFICATION RESULTS\n';
    response += '========================================\n\n';

    if (data.type) response += 'TYPE: ' + data.type + '\n';
    if (data.partIdentified) response += 'PART IDENTIFIED: ' + data.partIdentified + '\n';
    if (data.commonName) response += 'COMMON NAME: ' + data.commonName + '\n';

    const hasLocal = data.localNames.tagalog || data.localNames.bisaya || 
                     data.localNames.ilocano || data.localNames.other;
    if (hasLocal) {
      response += '\nLOCAL NAMES\n';
      if (data.localNames.tagalog) response += '  Tagalog: ' + data.localNames.tagalog + '\n';
      if (data.localNames.bisaya) response += '  Bisaya: ' + data.localNames.bisaya + '\n';
      if (data.localNames.ilocano) response += '  Ilocano: ' + data.localNames.ilocano + '\n';
      if (data.localNames.other) response += '  Other: ' + data.localNames.other + '\n';
    }

    if (data.scientificName) {
      response += '\nSCIENTIFIC NAME: ' + data.scientificName + '\n';
    }

    const hasTax = data.taxonomy.kingdom || data.taxonomy.phylum || data.taxonomy.class || 
                   data.taxonomy.order || data.taxonomy.family || data.taxonomy.genus || data.taxonomy.species;
    if (hasTax) {
      response += '\nTAXONOMY\n';
      if (data.taxonomy.kingdom) response += '  Kingdom: ' + data.taxonomy.kingdom + '\n';
      if (data.taxonomy.phylum) response += '  Phylum: ' + data.taxonomy.phylum + '\n';
      if (data.taxonomy.class) response += '  Class: ' + data.taxonomy.class + '\n';
      if (data.taxonomy.order) response += '  Order: ' + data.taxonomy.order + '\n';
      if (data.taxonomy.family) response += '  Family: ' + data.taxonomy.family + '\n';
      if (data.taxonomy.genus) response += '  Genus: ' + data.taxonomy.genus + '\n';
      if (data.taxonomy.species) response += '  Species: ' + data.taxonomy.species + '\n';
    }

    if (data.description) {
      response += '\nDESCRIPTION\n' + data.description + '\n';
    }

    const hasChar = data.characteristics.size || data.characteristics.color || 
                    data.characteristics.shape || data.characteristics.texture || 
                    data.characteristics.distinctiveFeatures;
    if (hasChar) {
      response += '\nCHARACTERISTICS\n';
      if (data.characteristics.size) response += '  Size: ' + data.characteristics.size + '\n';
      if (data.characteristics.color) response += '  Color: ' + data.characteristics.color + '\n';
      if (data.characteristics.shape) response += '  Shape: ' + data.characteristics.shape + '\n';
      if (data.characteristics.texture) response += '  Texture: ' + data.characteristics.texture + '\n';
      if (data.characteristics.distinctiveFeatures) response += '  Distinctive Features: ' + data.characteristics.distinctiveFeatures + '\n';
    }

    if (data.habitat) {
      response += '\nHABITAT\n' + data.habitat + '\n';
    }

    if (data.distribution) {
      response += '\nDISTRIBUTION\n' + data.distribution + '\n';
    }

    if (data.ecologicalRole) {
      response += '\nECOLOGICAL ROLE\n' + data.ecologicalRole + '\n';
    }

    if (data.uses) {
      response += '\nUSES/BENEFITS\n' + data.uses + '\n';
    }

    if (data.conservationStatus) {
      response += '\nCONSERVATION STATUS\n' + data.conservationStatus + '\n';
    }

    if (data.daoGroup) {
      response += '\nDAO GROUP\n' + data.daoGroup + '\n';
    }

    if (data.additionalInfo) {
      response += '\nADDITIONAL INFO\n' + data.additionalInfo + '\n';
    }

    response += '\n========================================';

    return response;
  },

  // ============================================
  // TEXT SEARCH
  // ============================================
  isTextQuery(prompt) {
    const lower = prompt.toLowerCase();
    const keywords = ['what is', 'identify', 'about', 'info', 'tell me about', 
                     'ano ang', 'tungkol sa', 'scan what', 'scan about', 'scan'];
    return keywords.some(k => lower.includes(k));
  },

  async handleTextSearch(senderId, prompt, token) {
    try {
      let name = prompt;
      const remove = ['what is', 'identify', 'about', 'info', 'tell me about', 
                     'ano ang', 'tungkol sa', 'scan what', 'scan about', 'scan'];
      for (const word of remove) {
        name = name.toLowerCase().replace(word, '').trim();
      }
      if (!name) {
        await sendMessage(senderId, { text: 'Please specify what to search.' }, token);
        return;
      }

      await sendMessage(senderId, {
        text: 'Searching information about "' + name + '"...'
      }, token);

      const geminiPrompt = `You are an expert botanist and biologist. Provide COMPLETE information about "${name}".

FORMAT:
COMMON NAME: [value]
LOCAL NAMES:
- Tagalog: [Tagalog name]
- Bisaya: [Bisaya name]
- Ilocano: [Ilocano name]
- Other: [Other local names]
SCIENTIFIC NAME: [value]
TAXONOMY:
- Kingdom: [value]
- Phylum: [value]
- Class: [value]
- Order: [value]
- Family: [value]
- Genus: [value]
- Species: [value]
DESCRIPTION: [value]
CHARACTERISTICS:
- Size: [value]
- Color: [value]
- Shape: [value]
- Texture: [value]
- Distinctive Features: [value]
HABITAT: [value]
DISTRIBUTION: [value]
ECOLOGICAL ROLE: [value]
USES/BENEFITS: [value]
CONSERVATION STATUS: [value]
DAO GROUP: [value]
ADDITIONAL INFO: [value]

If unsure, write "Unknown". NO emojis, NO special characters, NO markdown.`;

      const apiUrl = `https://norch-project.gleeze.com/api/gemini?prompt=${encodeURIComponent(geminiPrompt)}`;
      const response = await axios.get(apiUrl, {
        timeout: 60000,
        headers: { 'Accept': 'application/json' }
      });

      if (!response || !response.data) {
        await sendMessage(senderId, {
          text: 'No information found for "' + name + '".\n\nTry Google: https://www.google.com/search?q=' + encodeURIComponent(name)
        }, token);
        return;
      }

      const result = this.parseResponse(response.data.response || '');
      
      if (!result.commonName && !result.scientificName) {
        await sendMessage(senderId, {
          text: 'No information found for "' + name + '".\n\nTry Google: https://www.google.com/search?q=' + encodeURIComponent(name)
        }, token);
        return;
      }

      const formatted = this.formatResponse(result);
      await this.sendChunks(senderId, formatted, token);

    } catch (error) {
      console.error('[TextSearch] Error:', error.message);
      await sendMessage(senderId, { text: 'Error searching. Please try again.' }, token);
    }
  },

  // ============================================
  // GET REPLIED MESSAGE DATA
  // ============================================
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
      return { message: data?.message || null, from: data?.from?.id || null, imageUrl };
    } catch (error) {
      console.error('[getRepliedMessageData] Error:', error.message);
      return { message: null, from: null, imageUrl: null };
    }
  },

  // ============================================
  // SEND CHUNKS
  // ============================================
  splitMessage(text) {
    const chunks = [];
    for (let i = 0; i < text.length; i += MAX_CHUNK) {
      chunks.push(text.slice(i, i + MAX_CHUNK));
    }
    return chunks;
  },

  async sendChunks(senderId, text, token) {
    if (!text) {
      await sendMessage(senderId, { text: 'No content generated.' }, token);
      return;
    }
    const chunks = this.splitMessage(text);
    for (const chunk of chunks) {
      if (chunk.trim()) {
        await sendMessage(senderId, { text: chunk }, token);
      }
    }
  }
};
