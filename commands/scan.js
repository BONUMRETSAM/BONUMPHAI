const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const MAX_CHUNK = 1900;
const SERPAPI_KEY = process.env.SERPAPI_KEY || '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

// ============================================
// FORCE COMPLETE DATA (FALLBACK)
// ============================================
const FORCE_COMPLETE_DATA = {
  'gmelina arborea': {
    type: 'Tree',
    partIdentified: 'Leaf',
    commonName: 'Yemane, White Teak, Gumhar',
    localNames: { tagalog: 'Gmelina', bisaya: 'Gmelina', ilocano: 'Gmelina', other: 'Yemane, White Teak, Gumhar' },
    scientificName: 'Gmelina arborea Roxb.',
    taxonomy: { kingdom: 'Plantae', phylum: 'Tracheophyta', class: 'Magnoliopsida', order: 'Lamiales', family: 'Lamiaceae', genus: 'Gmelina', species: 'G. arborea' },
    description: 'A fast-growing deciduous tree with straight trunk and greyish-brown bark. Leaves are simple, opposite, broadly ovate to cordate.',
    characteristics: { size: '15-30 cm leaf length, tree reaches 20-30 meters', color: 'Young leaves reddish-bronze, mature dark green', shape: 'Broadly ovate to cordate with acuminate apex', texture: 'Smooth and leathery upper surface', distinctiveFeatures: 'Prominent venation with reticulate pattern' },
    habitat: 'Tropical and subtropical dry deciduous forests, open woodlands, and secondary forests.',
    distribution: 'Native to India, Myanmar, Thailand, Laos, Cambodia, Vietnam, and southern China. Widely planted in the Philippines.',
    ecologicalRole: 'Fast-growing pioneer species used for reforestation and soil stabilization.',
    uses: 'Timber for furniture, plywood, construction, and carving. Medicinal for fever and indigestion. Fodder for livestock.',
    conservationStatus: 'Least Concern',
    daoGroup: 'Not Listed',
    additionalInfo: 'One of the most important plantation timber species in the Philippines.'
  },
  'pterocarpus indicus': {
    type: 'Tree',
    partIdentified: 'Whole Plant',
    commonName: 'Narra, Philippine Mahogany',
    localNames: { tagalog: 'Narra', bisaya: 'Naga', ilocano: 'Nara', other: 'Philippine Mahogany' },
    scientificName: 'Pterocarpus indicus Willd.',
    taxonomy: { kingdom: 'Plantae', phylum: 'Tracheophyta', class: 'Magnoliopsida', order: 'Fabales', family: 'Fabaceae', genus: 'Pterocarpus', species: 'P. indicus' },
    description: 'A large deciduous tree reaching 30-40 meters tall with grayish-brown fissured bark. Leaves are compound with 5-13 leaflets.',
    characteristics: { size: '30-40 meters tall, trunk diameter up to 2 meters', color: 'Grayish-brown bark, yellow-orange flowers', shape: 'Compound leaves with 5-13 leaflets', texture: 'Fissured bark, smooth leaves', distinctiveFeatures: 'Yellow-orange fragrant flowers, nitrogen-fixing' },
    habitat: 'Primary and secondary forests, near rivers and streams',
    distribution: 'Native to Southeast Asia: Philippines, Indonesia, Malaysia, Thailand, Vietnam',
    ecologicalRole: 'Nitrogen-fixing tree, provides habitat for wildlife',
    uses: 'High-quality timber for furniture and construction. Used in traditional medicine. Ornamental tree.',
    conservationStatus: 'Vulnerable',
    daoGroup: 'DAO 2017-11: Vulnerable',
    additionalInfo: 'The national tree of the Philippines. Highly valued for its durable and beautifully grained wood.'
  },
  'mangifera indica': {
    type: 'Tree',
    partIdentified: 'Fruit',
    commonName: 'Mango',
    localNames: { tagalog: 'Mangga', bisaya: 'Mangga', ilocano: 'Mangga', other: 'Mango' },
    scientificName: 'Mangifera indica L.',
    taxonomy: { kingdom: 'Plantae', phylum: 'Tracheophyta', class: 'Magnoliopsida', order: 'Sapindales', family: 'Anacardiaceae', genus: 'Mangifera', species: 'M. indica' },
    description: 'A tropical fruit tree with smooth, yellowish-green to reddish skin when ripe. Flesh is sweet, juicy, and yellow-orange.',
    characteristics: { size: '8-15 cm long', color: 'Green when unripe, yellow to reddish when ripe', shape: 'Oval to kidney-shaped', texture: 'Smooth skin, fibrous flesh', distinctiveFeatures: 'Large central seed, sweet aroma' },
    habitat: 'Tropical and subtropical regions',
    distribution: 'Native to South and Southeast Asia, widely cultivated in the Philippines',
    ecologicalRole: 'Provides food for wildlife, supports pollinators',
    uses: 'Edible fruit - fresh, dried, processed. Source of vitamins A and C. Used in traditional medicine.',
    conservationStatus: 'Least Concern',
    daoGroup: 'Not Listed',
    additionalInfo: 'National fruit of the Philippines. The Carabao mango is the most popular variety.'
  }
};

module.exports = {
  name: ['scan', 'identify', 'detect', 'whatisthis', 'scanimage'],
  description: 'Scan and identify plants, trees, fruits, flowers, leaves, branches, animals, insects, and more from images',
  usage: 'Reply to an image with "scan" or send "scan [image]"',
  version: '13.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 10,

  async execute(senderId, args, token, event) {
    try {
      let prompt = args.join(' ').trim();
      let imageUrl = null;

      console.log('[scan] Executing scan command...');

      // Check image sources
      if (event && event._scanImageUrl) {
        imageUrl = event._scanImageUrl;
      }

      if (!imageUrl && event?.message?.attachments) {
        for (const attachment of event.message.attachments) {
          if (attachment.type === 'image' || attachment.type === 'photo') {
            imageUrl = attachment.payload?.url || attachment.url || null;
            if (imageUrl) break;
          }
        }
      }

      if (!imageUrl && event?.message?.reply_to?.mid) {
        try {
          const replyData = await this.getRepliedMessageData(event.message.reply_to.mid, token);
          if (replyData && replyData.imageUrl) {
            imageUrl = replyData.imageUrl;
          }
        } catch (error) {
          console.error('[scan] Error getting reply data:', error.message);
        }
      }

      if (!imageUrl) {
        const cachedImage = await this.getCachedImage(senderId, token);
        if (cachedImage) {
          imageUrl = cachedImage;
        }
      }

      // Text query
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

      if (!imageUrl) {
        await sendMessage(senderId, {
          text: 'Please send an image first, then reply with "scan".\n\nOr type: scan what is [name]'
        }, token);
        return;
      }

      // Scan the image
      await sendMessage(senderId, {
        text: 'Scanning image... Please wait.'
      }, token);

      // STEP 1: Get identification from Gemini
      const identification = await this.identifyWithGemini(imageUrl);

      if (!identification) {
        await sendMessage(senderId, {
          text: 'Unable to identify. Please try:\n- Clearer image\n- Better lighting\n- Different angle'
        }, token);
        return;
      }

      // STEP 2: Get fallback data if Gemini incomplete
      let finalData = identification;

      // If Gemini didn't provide taxonomy, try fallback
      const hasTaxonomy = identification.taxonomy?.kingdom && identification.taxonomy?.family;
      if (!hasTaxonomy && identification.scientificName) {
        const fallbackData = this.getFallbackData(identification.scientificName);
        if (fallbackData) {
          // Merge fallback data with Gemini data
          finalData = {
            ...identification,
            type: identification.type || fallbackData.type || '',
            partIdentified: identification.partIdentified || fallbackData.partIdentified || '',
            commonName: identification.commonName || fallbackData.commonName || '',
            localNames: identification.localNames || fallbackData.localNames || { tagalog: '', bisaya: '', ilocano: '', other: '' },
            scientificName: identification.scientificName || fallbackData.scientificName || '',
            taxonomy: fallbackData.taxonomy || identification.taxonomy || { kingdom: '', phylum: '', class: '', order: '', family: '', genus: '', species: '' },
            description: identification.description || fallbackData.description || '',
            characteristics: identification.characteristics || fallbackData.characteristics || { size: '', color: '', shape: '', texture: '', distinctiveFeatures: '' },
            habitat: identification.habitat || fallbackData.habitat || '',
            distribution: identification.distribution || fallbackData.distribution || '',
            ecologicalRole: identification.ecologicalRole || fallbackData.ecologicalRole || '',
            uses: identification.uses || fallbackData.uses || '',
            conservationStatus: identification.conservationStatus || fallbackData.conservationStatus || '',
            daoGroup: identification.daoGroup || fallbackData.daoGroup || '',
            additionalInfo: identification.additionalInfo || fallbackData.additionalInfo || ''
          };
        }
      }

      // STEP 3: Clean and format
      const cleanedData = this.cleanData(finalData);

      const response = this.formatCompleteResponse(cleanedData);
      await this.sendChunks(senderId, response, token);

    } catch (error) {
      console.error('[scan] Error:', error.message);
      await sendMessage(senderId, {
        text: 'Error scanning image. Please try again.'
      }, token);
    }
  },

  // ============================================
  // GET FALLBACK DATA
  // ============================================
  getFallbackData(scientificName) {
    let key = '';
    if (scientificName) {
      const parts = scientificName.split(' ');
      if (parts.length >= 2) {
        key = (parts[0] + ' ' + parts[1]).toLowerCase();
      } else {
        key = scientificName.toLowerCase();
      }
    }

    for (const [dbKey, data] of Object.entries(FORCE_COMPLETE_DATA)) {
      if (key.includes(dbKey.toLowerCase()) || dbKey.toLowerCase().includes(key)) {
        return data;
      }
    }

    return null;
  },

  // ============================================
  // GET REPLIED MESSAGE DATA
  // ============================================
  async getRepliedMessageData(mid, token) {
    try {
      const url = `https://graph.facebook.com/v21.0/${mid}`;
      const params = {
        access_token: token,
        fields: 'message,from,attachments{image_data,url,type}'
      };
      const response = await axios.get(url, { params });
      const data = response.data;
      let imageUrl = null;
      if (data?.attachments?.data) {
        for (const attachment of data.attachments.data) {
          if (attachment.type === 'image' || attachment.type === 'photo') {
            imageUrl = attachment?.image_data?.url || attachment?.payload?.url || attachment?.url || null;
            if (imageUrl) break;
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
  // GET CACHED IMAGE
  // ============================================
  async getCachedImage(senderId, token) {
    try {
      const url = `https://graph.facebook.com/v21.0/${senderId}/messages`;
      const params = {
        access_token: token,
        limit: 5,
        fields: 'message,attachments{image_data,url,type}'
      };
      const response = await axios.get(url, { params });
      const data = response.data;
      if (data?.data) {
        for (const msg of data.data) {
          if (msg?.attachments?.data) {
            for (const attachment of msg.attachments.data) {
              if (attachment.type === 'image' || attachment.type === 'photo') {
                const imageUrl = attachment?.image_data?.url || attachment?.payload?.url || attachment?.url || null;
                if (imageUrl) return imageUrl;
              }
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error('[getCachedImage] Error:', error.message);
      return null;
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
      console.error('[identifyWithGemini] Error:', error.message);
      return null;
    }
  },

  // ============================================
  // BUILD GEMINI PROMPT
  // ============================================
  buildGeminiPrompt() {
    return `You are an expert botanist, biologist, and taxonomist.

CRITICAL INSTRUCTION: You MUST provide ALL fields below. DO NOT skip any field.
If you don't know, write "Unknown". Keep descriptions SHORT (2-3 sentences only).

Analyze the image and identify the organism.

RESPONSE FORMAT - EXACTLY as shown, FILL ALL FIELDS:

TYPE: [Plant/Tree/Fruit/Flower/Leaf/Branch/Animal/Bird/Insect/Fish/Mushroom/Marine Life/Other]

PART IDENTIFIED: [Bunga/Fruit, Bulaklak/Flower, Puno/Tree, Dahon/Leaf, Sanga/Branch, Buto/Seed, Ugat/Root, Bark, Whole Plant, etc.]

COMMON NAME: [Common name in English]

LOCAL NAMES:
- Tagalog: [Tagalog name]
- Bisaya: [Bisaya name]
- Ilocano: [Ilocano name]
- Other: [Other local names]

SCIENTIFIC NAME: [Complete scientific name - Genus species Author]

TAXONOMY:
- Kingdom: [Kingdom - REQUIRED]
- Phylum: [Phylum - REQUIRED]
- Class: [Class - REQUIRED]
- Order: [Order - REQUIRED]
- Family: [Family - REQUIRED]
- Genus: [Genus - REQUIRED]
- Species: [Species - REQUIRED]

DESCRIPTION:
[SHORT description - 2-3 sentences only]

CHARACTERISTICS:
- Size: [Approximate size - REQUIRED]
- Color: [Color description - REQUIRED]
- Shape: [Shape description - REQUIRED]
- Texture: [Texture description - REQUIRED]
- Distinctive Features: [Unique characteristics - REQUIRED]

HABITAT:
[Natural environment - REQUIRED]

DISTRIBUTION:
[Geographic distribution - REQUIRED]

ECOLOGICAL ROLE:
[Role in ecosystem - REQUIRED]

USES/BENEFITS:
[Economic, medicinal, cultural uses - REQUIRED]

CONSERVATION STATUS:
[IUCN status - REQUIRED]

DAO GROUP:
[DAO classification or "Not Listed" - REQUIRED]

ADDITIONAL INFO:
[Interesting facts - REQUIRED]

REMEMBER: FILL ALL FIELDS. If unsure, write "Unknown". Keep DESCRIPTION SHORT (2-3 sentences).`;
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
  // CLEAN DATA
  // ============================================
  cleanData(data) {
    const cleaned = { ...data };

    if (cleaned.scientificName) {
      let sciName = cleaned.scientificName;
      sciName = sciName.replace(/\s+/g, ' ').trim();
      const parts = sciName.split(' ');
      if (parts.length >= 2) {
        parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
        for (let i = 1; i < parts.length; i++) {
          if (!parts[i].includes('.')) {
            parts[i] = parts[i].toLowerCase();
          }
        }
        cleaned.scientificName = parts.join(' ');
      }
    }

    if (cleaned.commonName) {
      cleaned.commonName = cleaned.commonName
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0)
        .map(name => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase())
        .join(', ');
    }

    const taxonomyOrder = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
    for (const key of taxonomyOrder) {
      if (cleaned.taxonomy && cleaned.taxonomy[key]) {
        if (key === 'kingdom' || key === 'phylum' || key === 'class' || key === 'order' || key === 'family') {
          cleaned.taxonomy[key] = cleaned.taxonomy[key].charAt(0).toUpperCase() + cleaned.taxonomy[key].slice(1).toLowerCase();
        } else if (key === 'genus') {
          cleaned.taxonomy[key] = cleaned.taxonomy[key].charAt(0).toUpperCase() + cleaned.taxonomy[key].slice(1).toLowerCase();
        } else if (key === 'species') {
          cleaned.taxonomy[key] = cleaned.taxonomy[key].toLowerCase();
        }
      }
    }

    return cleaned;
  },

  // ============================================
  // FORMAT COMPLETE RESPONSE
  // ============================================
  formatCompleteResponse(data) {
    let response = 'IDENTIFICATION RESULTS\n';
    response += '----------------------------------------\n\n';

    response += 'Type: ' + (data.type || 'Unknown') + '\n';
    response += 'Part Identified: ' + (data.partIdentified || 'Unknown') + '\n';
    response += 'Common Name: ' + (data.commonName || 'Unknown') + '\n';

    const hasLocal = data.localNames?.tagalog || data.localNames?.bisaya || 
                     data.localNames?.ilocano || data.localNames?.other;
    if (hasLocal) {
      response += '\nLocal Names\n';
      if (data.localNames.tagalog) response += '  Tagalog: ' + data.localNames.tagalog + '\n';
      if (data.localNames.bisaya) response += '  Bisaya: ' + data.localNames.bisaya + '\n';
      if (data.localNames.ilocano) response += '  Ilocano: ' + data.localNames.ilocano + '\n';
      if (data.localNames.other) response += '  Other: ' + data.localNames.other + '\n';
    }

    response += '\nScientific Name: ' + (data.scientificName || 'Unknown') + '\n';

    response += '\nTaxonomy\n';
    response += '  Kingdom: ' + (data.taxonomy?.kingdom || 'Unknown') + '\n';
    response += '  Phylum: ' + (data.taxonomy?.phylum || 'Unknown') + '\n';
    response += '  Class: ' + (data.taxonomy?.class || 'Unknown') + '\n';
    response += '  Order: ' + (data.taxonomy?.order || 'Unknown') + '\n';
    response += '  Family: ' + (data.taxonomy?.family || 'Unknown') + '\n';
    response += '  Genus: ' + (data.taxonomy?.genus || 'Unknown') + '\n';
    response += '  Species: ' + (data.taxonomy?.species || 'Unknown') + '\n';

    if (data.description) {
      response += '\nDescription\n' + data.description + '\n';
    }

    response += '\nCharacteristics\n';
    response += '  Size: ' + (data.characteristics?.size || 'Unknown') + '\n';
    response += '  Color: ' + (data.characteristics?.color || 'Unknown') + '\n';
    response += '  Shape: ' + (data.characteristics?.shape || 'Unknown') + '\n';
    response += '  Texture: ' + (data.characteristics?.texture || 'Unknown') + '\n';
    response += '  Distinctive Features: ' + (data.characteristics?.distinctiveFeatures || 'Unknown') + '\n';

    if (data.habitat) {
      response += '\nHabitat\n' + data.habitat + '\n';
    }

    if (data.distribution) {
      response += '\nDistribution\n' + data.distribution + '\n';
    }

    if (data.ecologicalRole) {
      response += '\nEcological Role\n' + data.ecologicalRole + '\n';
    }

    if (data.uses) {
      response += '\nUses/Benefits\n' + data.uses + '\n';
    }

    response += '\nConservation Status\n' + (data.conservationStatus || 'Unknown') + '\n';

    response += '\nDAO Group\n' + (data.daoGroup || 'Not Listed') + '\n';

    if (data.additionalInfo) {
      response += '\nAdditional Info\n' + data.additionalInfo + '\n';
    }

    response += '\n----------------------------------------';

    return response;
  },

  // ============================================
  // TEXT SEARCH
  // ============================================
  isTextQuery(prompt) {
    if (!prompt) return false;
    const lower = prompt.toLowerCase();
    const keywords = ['what is', 'identify', 'about', 'info', 'tell me about', 
                     'ano ang', 'tungkol sa', 'scan what', 'scan about'];
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

FORMAT - FILL ALL FIELDS:

COMMON NAME: [value]
SCIENTIFIC NAME: [value]
TAXONOMY:
- Kingdom: [value]
- Phylum: [value]
- Class: [value]
- Order: [value]
- Family: [value]
- Genus: [value]
- Species: [value]
DESCRIPTION: [SHORT - 2-3 sentences]
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

If unsure, write "Unknown".`;

      const apiUrl = `https://norch-project.gleeze.com/api/gemini?prompt=${encodeURIComponent(geminiPrompt)}`;
      const response = await axios.get(apiUrl, {
        timeout: 60000,
        headers: { 'Accept': 'application/json' }
      });

      if (!response || !response.data) {
        await sendMessage(senderId, {
          text: 'No information found for "' + name + '".'
        }, token);
        return;
      }

      const result = this.parseResponse(response.data.response || '');
      if (!result.commonName && !result.scientificName) {
        await sendMessage(senderId, {
          text: 'No information found for "' + name + '".'
        }, token);
        return;
      }

      const cleaned = this.cleanData(result);
      const formatted = this.formatCompleteResponse(cleaned);
      await this.sendChunks(senderId, formatted, token);

    } catch (error) {
      console.error('[TextSearch] Error:', error.message);
      await sendMessage(senderId, { text: 'Error searching. Please try again.' }, token);
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
