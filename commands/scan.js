const axios = require('axios');
const { sendMessage } = require('../handles/sendMessage');

const MAX_CHUNK = 1900;
const SERPAPI_KEY = process.env.SERPAPI_KEY || '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

// ============================================
// LOCAL NAMES DATABASE (PRECISE)
// ============================================
const LOCAL_NAMES_DB = {
  'Gmelina arborea': {
    tagalog: 'Gmelina',
    bisaya: 'Gmelina',
    ilocano: 'Gmelina',
    other: 'Yemane, White Teak, Gumhar'
  },
  'Pterocarpus indicus': {
    tagalog: 'Narra',
    bisaya: 'Naga',
    ilocano: 'Nara',
    other: 'Philippine Mahogany'
  },
  'Mangifera indica': {
    tagalog: 'Mangga',
    bisaya: 'Mangga',
    ilocano: 'Mangga',
    other: 'Mango'
  },
  'Barringtonia racemosa': {
    tagalog: 'Unknown',
    bisaya: 'Unknown',
    ilocano: 'Unknown',
    other: 'Powder-puff tree, Sagar tree, Fish-poison wood'
  }
};

// ============================================
// TAXONOMY DATABASE (PRECISE)
// ============================================
const TAXONOMY_DB = {
  'Gmelina arborea': {
    kingdom: 'Plantae',
    phylum: 'Tracheophyta',
    class: 'Magnoliopsida',
    order: 'Lamiales',
    family: 'Lamiaceae',
    genus: 'Gmelina',
    species: 'G. arborea'
  },
  'Pterocarpus indicus': {
    kingdom: 'Plantae',
    phylum: 'Tracheophyta',
    class: 'Magnoliopsida',
    order: 'Fabales',
    family: 'Fabaceae',
    genus: 'Pterocarpus',
    species: 'P. indicus'
  },
  'Mangifera indica': {
    kingdom: 'Plantae',
    phylum: 'Tracheophyta',
    class: 'Magnoliopsida',
    order: 'Sapindales',
    family: 'Anacardiaceae',
    genus: 'Mangifera',
    species: 'M. indica'
  },
  'Barringtonia racemosa': {
    kingdom: 'Plantae',
    phylum: 'Tracheophyta',
    class: 'Magnoliopsida',
    order: 'Ericales',
    family: 'Lecythidaceae',
    genus: 'Barringtonia',
    species: 'B. racemosa'
  }
};

// ============================================
// CONSERVATION STATUS DATABASE (PRECISE)
// ============================================
const CONSERVATION_DB = {
  'Gmelina arborea': 'Least Concern',
  'Pterocarpus indicus': 'Vulnerable',
  'Mangifera indica': 'Least Concern',
  'Barringtonia racemosa': 'Least Concern'
};

// ============================================
// DAO GROUP DATABASE (PRECISE)
// ============================================
const DAO_DB = {
  'Gmelina arborea': 'Not Listed',
  'Pterocarpus indicus': 'DAO 2017-11: Vulnerable',
  'Mangifera indica': 'Not Listed',
  'Barringtonia racemosa': 'Not Listed'
};

module.exports = {
  name: ['scan', 'identify', 'detect', 'whatisthis', 'scanimage'],
  description: 'Scan and identify plants, trees, fruits, flowers, leaves, branches, animals, insects, and more from images',
  usage: 'Reply to an image with "scan" or send "scan [image]"',
  version: '11.0.0',
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

      // STEP 2: Get precise data from databases
      const preciseData = this.getPreciseData(identification);

      // STEP 3: Get additional details from SerpAPI
      let serpData = {};
      if (identification.scientificName || identification.commonName) {
        const searchTerm = identification.scientificName || identification.commonName;
        console.log('[scan] Getting additional details for:', searchTerm);
        serpData = await this.getAdditionalDetails(searchTerm);
      }

      // STEP 4: Merge all data
      const mergedData = this.mergeAllData(identification, preciseData, serpData);

      // STEP 5: Clean and format
      const cleanedData = this.cleanData(mergedData);

      const response = this.formatResponse(cleanedData);
      await this.sendChunks(senderId, response, token);

    } catch (error) {
      console.error('[scan] Error:', error.message);
      await sendMessage(senderId, {
        text: 'Error scanning image. Please try again.'
      }, token);
    }
  },

  // ============================================
  // GET PRECISE DATA FROM DATABASES
  // ============================================
  getPreciseData(identification) {
    const result = {
      localNames: { tagalog: '', bisaya: '', ilocano: '', other: '' },
      taxonomy: { kingdom: '', phylum: '', class: '', order: '', family: '', genus: '', species: '' },
      conservationStatus: '',
      daoGroup: ''
    };

    // Get scientific name key
    let key = '';
    if (identification.scientificName) {
      const parts = identification.scientificName.split(' ');
      if (parts.length >= 2) {
        key = parts[0] + ' ' + parts[1];
      } else {
        key = identification.scientificName;
      }
    }

    // Find matching data
    let foundKey = null;
    for (const dbKey of Object.keys(LOCAL_NAMES_DB)) {
      if (key.toLowerCase().includes(dbKey.toLowerCase()) || dbKey.toLowerCase().includes(key.toLowerCase())) {
        foundKey = dbKey;
        break;
      }
    }

    if (foundKey) {
      // Local names
      if (LOCAL_NAMES_DB[foundKey]) {
        result.localNames = LOCAL_NAMES_DB[foundKey];
      }

      // Taxonomy
      if (TAXONOMY_DB[foundKey]) {
        result.taxonomy = TAXONOMY_DB[foundKey];
      }

      // Conservation status
      if (CONSERVATION_DB[foundKey]) {
        result.conservationStatus = CONSERVATION_DB[foundKey];
      }

      // DAO Group
      if (DAO_DB[foundKey]) {
        result.daoGroup = DAO_DB[foundKey];
      }
    }

    return result;
  },

  // ============================================
  // GET ADDITIONAL DETAILS FROM SERPAPI
  // ============================================
  async getAdditionalDetails(searchTerm) {
    try {
      const encoded = encodeURIComponent(searchTerm);
      
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          engine: 'google_scholar',
          q: searchTerm,
          api_key: SERPAPI_KEY,
          num: 2
        },
        timeout: 15000
      });

      const results = response.data?.organic_results || [];
      
      let details = {
        additionalInfo: []
      };

      for (const result of results) {
        const snippet = result.snippet || '';
        const title = result.title || '';
        
        // Collect additional info
        if (snippet && snippet.length > 20) {
          details.additionalInfo.push(snippet.substring(0, 300));
        }
      }

      return details;

    } catch (error) {
      console.error('[getAdditionalDetails] Error:', error.message);
      return {};
    }
  },

  // ============================================
  // MERGE ALL DATA
  // ============================================
  mergeAllData(geminiData, preciseData, serpData) {
    const merged = {
      type: geminiData.type || '',
      partIdentified: geminiData.partIdentified || '',
      commonName: geminiData.commonName || '',
      localNames: {
        tagalog: preciseData.localNames.tagalog || geminiData.localNames?.tagalog || '',
        bisaya: preciseData.localNames.bisaya || geminiData.localNames?.bisaya || '',
        ilocano: preciseData.localNames.ilocano || geminiData.localNames?.ilocano || '',
        other: preciseData.localNames.other || geminiData.localNames?.other || ''
      },
      scientificName: geminiData.scientificName || '',
      taxonomy: {
        kingdom: preciseData.taxonomy.kingdom || geminiData.taxonomy?.kingdom || '',
        phylum: preciseData.taxonomy.phylum || geminiData.taxonomy?.phylum || '',
        class: preciseData.taxonomy.class || geminiData.taxonomy?.class || '',
        order: preciseData.taxonomy.order || geminiData.taxonomy?.order || '',
        family: preciseData.taxonomy.family || geminiData.taxonomy?.family || '',
        genus: preciseData.taxonomy.genus || geminiData.taxonomy?.genus || '',
        species: preciseData.taxonomy.species || geminiData.taxonomy?.species || ''
      },
      description: geminiData.description || '',
      characteristics: {
        size: geminiData.characteristics?.size || '',
        color: geminiData.characteristics?.color || '',
        shape: geminiData.characteristics?.shape || '',
        texture: geminiData.characteristics?.texture || '',
        distinctiveFeatures: geminiData.characteristics?.distinctiveFeatures || ''
      },
      habitat: geminiData.habitat || '',
      distribution: geminiData.distribution || '',
      ecologicalRole: geminiData.ecologicalRole || '',
      uses: geminiData.uses || '',
      conservationStatus: preciseData.conservationStatus || geminiData.conservationStatus || '',
      daoGroup: preciseData.daoGroup || geminiData.daoGroup || '',
      additionalInfo: geminiData.additionalInfo || (serpData.additionalInfo ? serpData.additionalInfo.join(' ') : '')
    };

    return merged;
  },

  // ============================================
  // CLEAN DATA
  // ============================================
  cleanData(data) {
    const cleaned = { ...data };

    // Clean scientific name
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

    // Clean common name
    if (cleaned.commonName) {
      cleaned.commonName = cleaned.commonName
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0)
        .map(name => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase())
        .join(', ');
    }

    // Clean taxonomy
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

    // Clean conservation status
    if (cleaned.conservationStatus) {
      const statusMap = {
        'lc': 'Least Concern',
        'least concern': 'Least Concern',
        'vu': 'Vulnerable',
        'vulnerable': 'Vulnerable',
        'en': 'Endangered',
        'endangered': 'Endangered',
        'cr': 'Critically Endangered',
        'critically endangered': 'Critically Endangered',
        'nt': 'Near Threatened',
        'near threatened': 'Near Threatened',
        'dd': 'Data Deficient',
        'data deficient': 'Data Deficient',
        'ne': 'Not Evaluated',
        'not evaluated': 'Not Evaluated'
      };
      
      const lower = cleaned.conservationStatus.toLowerCase();
      if (statusMap[lower]) {
        cleaned.conservationStatus = statusMap[lower];
      } else {
        cleaned.conservationStatus = cleaned.conservationStatus.charAt(0).toUpperCase() + cleaned.conservationStatus.slice(1).toLowerCase();
      }
    }

    return cleaned;
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
            imageUrl = attachment?.image_data?.url || 
                      attachment?.payload?.url || 
                      attachment?.url || 
                      null;
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
                const imageUrl = attachment?.image_data?.url || 
                                attachment?.payload?.url || 
                                attachment?.url || 
                                null;
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

Analyze the image and identify the organism with COMPLETE and ACCURATE scientific information.

RESPONSE FORMAT - EXACTLY as shown:

TYPE: [Plant/Tree/Fruit/Flower/Leaf/Branch/Animal/Bird/Insect/Fish/Mushroom/Marine Life/Other]

PART IDENTIFIED: [Bunga/Fruit, Bulaklak/Flower, Puno/Tree, Dahon/Leaf, Sanga/Branch, Buto/Seed, Ugat/Root, Bark, Whole Plant, etc.]

COMMON NAME: [Common name in English]

SCIENTIFIC NAME: [Complete scientific name - Genus species Author]

DESCRIPTION:
[Detailed physical description based on the image]

CHARACTERISTICS:
Size: [Approximate size]
Color: [Color description]
Shape: [Shape description]
Texture: [Texture description]
Distinctive Features: [Unique characteristics]

HABITAT:
[Natural environment where it is commonly found]

DISTRIBUTION:
[Geographic distribution]

ECOLOGICAL ROLE:
[Role in ecosystem]

USES/BENEFITS:
[Economic, medicinal, cultural uses]

ADDITIONAL INFO:
[Interesting facts]

Write "Unknown" if you don't know.`;
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
  // FORMAT RESPONSE - CLEAN, PRECISE
  // ============================================
  formatResponse(data) {
    let response = 'IDENTIFICATION RESULTS\n';
    response += '----------------------------------------\n\n';

    if (data.type) response += 'Type: ' + data.type + '\n';
    if (data.partIdentified) response += 'Part Identified: ' + data.partIdentified + '\n';
    if (data.commonName) response += 'Common Name: ' + data.commonName + '\n';

    // Local Names
    const hasLocal = data.localNames.tagalog || data.localNames.bisaya || 
                     data.localNames.ilocano || data.localNames.other;
    if (hasLocal) {
      response += '\nLocal Names\n';
      if (data.localNames.tagalog) response += '  Tagalog: ' + data.localNames.tagalog + '\n';
      if (data.localNames.bisaya) response += '  Bisaya: ' + data.localNames.bisaya + '\n';
      if (data.localNames.ilocano) response += '  Ilocano: ' + data.localNames.ilocano + '\n';
      if (data.localNames.other) response += '  Other: ' + data.localNames.other + '\n';
    }

    if (data.scientificName) {
      response += '\nScientific Name: ' + data.scientificName + '\n';
    }

    // Taxonomy
    const hasTax = data.taxonomy.kingdom || data.taxonomy.phylum || data.taxonomy.class || 
                   data.taxonomy.order || data.taxonomy.family || data.taxonomy.genus || data.taxonomy.species;
    if (hasTax) {
      response += '\nTaxonomy\n';
      if (data.taxonomy.kingdom) response += '  Kingdom: ' + data.taxonomy.kingdom + '\n';
      if (data.taxonomy.phylum) response += '  Phylum: ' + data.taxonomy.phylum + '\n';
      if (data.taxonomy.class) response += '  Class: ' + data.taxonomy.class + '\n';
      if (data.taxonomy.order) response += '  Order: ' + data.taxonomy.order + '\n';
      if (data.taxonomy.family) response += '  Family: ' + data.taxonomy.family + '\n';
      if (data.taxonomy.genus) response += '  Genus: ' + data.taxonomy.genus + '\n';
      if (data.taxonomy.species) response += '  Species: ' + data.taxonomy.species + '\n';
    }

    if (data.description) {
      response += '\nDescription\n' + data.description + '\n';
    }

    // Characteristics
    const hasChar = data.characteristics.size || data.characteristics.color || 
                    data.characteristics.shape || data.characteristics.texture || 
                    data.characteristics.distinctiveFeatures;
    if (hasChar) {
      response += '\nCharacteristics\n';
      if (data.characteristics.size) response += '  Size: ' + data.characteristics.size + '\n';
      if (data.characteristics.color) response += '  Color: ' + data.characteristics.color + '\n';
      if (data.characteristics.shape) response += '  Shape: ' + data.characteristics.shape + '\n';
      if (data.characteristics.texture) response += '  Texture: ' + data.characteristics.texture + '\n';
      if (data.characteristics.distinctiveFeatures) response += '  Distinctive Features: ' + data.characteristics.distinctiveFeatures + '\n';
    }

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

    if (data.conservationStatus) {
      response += '\nConservation Status\n' + data.conservationStatus + '\n';
    }

    if (data.daoGroup) {
      response += '\nDAO Group\n' + data.daoGroup + '\n';
    }

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

FORMAT:

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
      const formatted = this.formatResponse(cleaned);
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
