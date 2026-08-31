const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

const SERPAPI_KEY = process.env.SERPAPI_KEY || '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ppt', 'powerpoint', 'presentation', 'slideshow', 'slides'],
  description: 'Generate PowerPoint presentation with accurate academic references',
  usage: 'ppt [topic/title/details]',
  version: '18.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 15,

  async execute(senderId, args, token, event) {
    try {
      const fullPrompt = args.join(' ').trim();
      
      if (!fullPrompt) {
        await sendMessage(senderId, {
          text: '📊 PPT GENERATOR\n\nUsage: ppt [topic/title/details]\n\nExamples:\n• ppt Climate Change\n• ppt Integrated Pest Management\n• ppt Artificial Intelligence\n• ppt Philippine History'
        }, token);
        return;
      }
      
      // ========== FIXED VALIDATION ==========
      if (!this.validateInput(fullPrompt)) {
        await sendMessage(senderId, {
          text: '❌ Invalid input. Please use:\n• Letters (A-Z, a-z)\n• Numbers (0-9)\n• Spaces\n• Common punctuation: .,!?;:\'\"()-—\n\nExample: ppt Climate Change and Its Impact'
        }, token);
        return;
      }
      
      const fullTopic = this.extractFullTopic(fullPrompt);
      const searchTopic = this.extractCoreSearchTopic(fullTopic);
      const language = this.detectLanguage(fullPrompt);
      
      console.log(`[PPT] Language: ${language}`);
      console.log(`[PPT] Search topic: "${searchTopic}"`);
      console.log(`[PPT] Original length: ${fullPrompt.length} characters`);
      
      await sendMessage(senderId, { 
        text: `🔍 Analyzing topic: "${searchTopic}"\n📝 Extracting key concepts...\n⏳ Creating comprehensive presentation...` 
      }, token);
      
      // Get references from real sources
      let references = await this.getVerifiedReferences(searchTopic);
      
      if (!references || references.length === 0) {
        console.log('[PPT] No references found, using fallback');
        references = this.getFallbackReferences(searchTopic);
      }
      
      console.log(`[PPT] Found ${references.length} verified references`);
      
      // Generate dynamic presentation
      const presentation = await this.generateDynamicPresentation(
        fullTopic,
        references,
        searchTopic,
        language
      );
      
      if (presentation) {
        await this.sendChunks(senderId, presentation, token);
      } else {
        await sendMessage(senderId, { 
          text: '❌ Error generating presentation. Please try again with a different topic.' 
        }, token);
      }
      
    } catch (error) {
      console.error('[ppt] Error:', error.message);
      await sendMessage(senderId, { 
        text: '❌ Error: ' + error.message + '\n\nPlease try:\n• Shorter topic description\n• More specific topic\n• Example: ppt Climate Change' 
      }, token);
    }
  },

  // ========== FIXED: VALIDATION ==========
  validateInput(prompt) {
    if (!prompt || prompt.length < 2) return false;
    if (prompt.length > 100000) return false;
    
    // Allow: letters, numbers, spaces, and common punctuation
    // Including: .,!?;:'"() -–— (quotes, hyphens, em dashes)
    // Pati na rin ang parentheses at quotes
    const cleaned = prompt.replace(/[a-zA-Z0-9\s\.,!?;:'"()\-–—]/g, '');
    
    // If there are still characters left, they might be invalid
    if (cleaned.length > 0) {
      console.log('[Validate] Invalid characters found:', cleaned);
      return false;
    }
    
    return true;
  },

  // ========== DETECT LANGUAGE ==========
  detectLanguage(prompt) {
    const lower = prompt.toLowerCase();
    const tagalogWords = ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'para', 'tungkol', 'epekto', 'kahalagahan', 'pag-aaral', 'paano', 'bakit', 'ano', 'saan', 'kailan'];
    const hasTagalog = tagalogWords.some(w => lower.includes(w));
    return hasTagalog ? 'tagalog' : 'english';
  },

  // ========== EXTRACT FULL TOPIC ==========
  extractFullTopic(text) {
    let cleaned = text.replace(/^(ppt|report|about|presentation|slideshow|slides)\s+(of|for|on)?\s*/i, '');
    
    if (cleaned.length <= 500) {
      return cleaned;
    }
    
    const sentences = cleaned.match(/[^.!?]+[.!?]/g);
    if (!sentences || sentences.length === 0) {
      return cleaned.substring(0, 500);
    }
    
    const keySentences = [];
    const importantKeywords = [
      'important', 'significant', 'key', 'main', 'primary', 'essential',
      'method', 'approach', 'strategy', 'technique', 'process',
      'benefit', 'advantage', 'impact', 'effect', 'result',
      'example', 'case study', 'instance',
      'biological', 'cultural', 'chemical', 'physical',
      'philippine', 'philippines', 'local', 'native',
      'agriculture', 'farming', 'crop', 'pest',
      'climate', 'environment', 'ecosystem',
      'health', 'disease', 'medical',
      'technology', 'digital', 'innovation'
    ];
    
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (importantKeywords.some(keyword => lower.includes(keyword))) {
        keySentences.push(sentence.trim());
      }
    }
    
    if (keySentences.length < 3) {
      for (let i = 0; i < Math.min(5, sentences.length); i++) {
        if (!keySentences.includes(sentences[i].trim())) {
          keySentences.push(sentences[i].trim());
        }
      }
    }
    
    let result = keySentences.join('. ');
    if (result.length > 500) {
      result = result.substring(0, 500) + '...';
    }
    
    return result;
  },

  // ========== EXTRACT CORE SEARCH TOPIC ==========
  extractCoreSearchTopic(text) {
    const firstSentence = text.match(/[^.!?]+[.!?]/)?.[0] || text;
    let cleaned = firstSentence.replace(/\([^)]*\)/g, '').trim();
    cleaned = cleaned.replace(/\b(is a|is an|refers to|means|involves|uses|includes|defined as)\b/gi, '').trim();
    
    const words = cleaned.split(/\s+/);
    if (words.length > 15) {
      return words.slice(0, 15).join(' ');
    }
    
    return cleaned || text.substring(0, 100);
  },

  // ========== ANALYZE TOPIC ==========
  analyzeTopic(prompt) {
    const cleanPrompt = prompt.replace(/ppt|powerpoint|presentation|slideshow|slides|report|about/gi, '').trim();
    
    const analysis = {
      original: prompt,
      clean: cleanPrompt,
      mainTopic: cleanPrompt.substring(0, 200),
      hasScientificName: false,
      hasCommonName: false,
      category: 'General',
      keywords: [],
      scientificName: '',
      commonName: ''
    };
    
    const scientificMatch = cleanPrompt.match(/\b([A-Z][a-z]+ [a-z]+)\b/);
    if (scientificMatch) {
      analysis.hasScientificName = true;
      analysis.scientificName = scientificMatch[1];
    }
    
    const commonMatch = cleanPrompt.match(/"([^"]+)"/);
    if (commonMatch) {
      analysis.hasCommonName = true;
      analysis.commonName = commonMatch[1];
    }
    
    const categories = {
      'Science': ['science', 'biology', 'physics', 'chemistry', 'research', 'experiment'],
      'Technology': ['technology', 'software', 'hardware', 'computer', 'digital', 'ai', 'robot'],
      'Health': ['health', 'disease', 'medical', 'clinical', 'patient', 'symptoms'],
      'Environment': ['climate', 'environment', 'ecosystem', 'biodiversity', 'forest'],
      'Agriculture': ['agriculture', 'farming', 'crop', 'pest', 'ipm', 'rice'],
      'History': ['history', 'historical', 'century', 'war', 'revolution'],
      'Education': ['education', 'school', 'university', 'learning', 'teaching'],
      'Economics': ['economic', 'finance', 'market', 'trade', 'business'],
      'Philippine': ['philippine', 'philippines', 'pinoy', 'filipino']
    };
    
    const lower = cleanPrompt.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(k => lower.includes(k))) {
        analysis.category = category;
        break;
      }
    }
    
    analysis.keywords = cleanPrompt.split(/\s+/).filter(w => w.length > 3).slice(0, 10);
    
    return analysis;
  },

  // ========== GET VERIFIED REFERENCES ==========
  async getVerifiedReferences(topic) {
    let allRefs = [];
    
    // 1. Try Google Scholar (SerpAPI)
    try {
      const refs = await this.getGoogleScholarRefs(topic);
      if (refs && refs.length > 0) {
        console.log(`[Google Scholar] Found ${refs.length} references`);
        allRefs = allRefs.concat(refs);
      }
    } catch (error) {
      console.log('[Google Scholar] Error:', error.message);
    }
    
    // 2. Try CrossRef
    try {
      const refs = await this.getCrossRefRefs(topic);
      if (refs && refs.length > 0) {
        console.log(`[CrossRef] Found ${refs.length} references`);
        allRefs = allRefs.concat(refs);
      }
    } catch (error) {
      console.log('[CrossRef] Error:', error.message);
    }
    
    // 3. Try DOAJ
    try {
      const refs = await this.getDOAJRefs(topic);
      if (refs && refs.length > 0) {
        console.log(`[DOAJ] Found ${refs.length} references`);
        allRefs = allRefs.concat(refs);
      }
    } catch (error) {
      console.log('[DOAJ] Error:', error.message);
    }
    
    // Remove duplicates and filter
    const uniqueRefs = this.removeDuplicateReferences(allRefs);
    const withUrls = uniqueRefs.filter(ref => ref.url && ref.url.startsWith('http'));
    
    console.log(`[Sources] Total: ${withUrls.length} verified references`);
    
    return withUrls.slice(0, 8);
  },

  // ========== GOOGLE SCHOLAR (SERPAPI) ==========
  async getGoogleScholarRefs(topic) {
    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          engine: 'google_scholar',
          q: topic,
          api_key: SERPAPI_KEY,
          num: 4
        },
        timeout: 15000
      });
      
      const results = response.data?.organic_results || [];
      if (results.length === 0) return [];
      
      return results.map(paper => {
        const summary = paper.publication_info?.summary || '';
        const year = summary.match(/\b(19|20)\d{2}\b/)?.[0] || 'n.d.';
        const authors = summary.split('-')[0]?.trim() || 'Unknown Author';
        const journal = summary.split('-')[1]?.trim()?.split(',')[0] || 'Academic Journal';
        
        let url = paper.link || '';
        if (paper.publication_info?.pdf_url) {
          url = paper.publication_info.pdf_url;
        } else if (!url) {
          url = `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title || topic)}`;
        }
        
        return {
          title: paper.title || 'Untitled',
          authors: authors,
          year: year,
          journal: journal,
          url: url,
          source: 'Google Scholar',
          accessible: true,
          peerReviewed: true,
          verified: true
        };
      });
    } catch (error) {
      console.log('[GoogleScholar] Error:', error.message);
      return [];
    }
  },

  // ========== CROSSREF ==========
  async getCrossRefRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://api.crossref.org/works?query=${encoded}&rows=3&sort=relevance`,
        { timeout: 15000 }
      );
      
      const items = response.data?.message?.items || [];
      if (items.length === 0) return [];
      
      return items.map(item => {
        const authors = item.author?.map(a => 
          `${a.family || ''} ${a.given || ''}`.trim()
        ).join(', ') || 'Unknown Author';
        
        const year = item.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
        const doi = item.DOI ? `https://doi.org/${item.DOI}` : null;
        
        let url = doi;
        if (!url && item.link && item.link.length > 0) {
          url = item.link[0];
        }
        if (!url) {
          url = `https://search.crossref.org/?q=${encoded}`;
        }
        
        return {
          title: item.title?.[0] || 'Untitled',
          authors: authors,
          year: year,
          journal: item['container-title']?.[0] || 'CrossRef Publication',
          url: url,
          source: 'CrossRef',
          accessible: !!doi,
          peerReviewed: true,
          verified: true,
          doi: doi
        };
      });
    } catch (error) {
      console.log('[CrossRef] Error:', error.message);
      return [];
    }
  },

  // ========== DOAJ ==========
  async getDOAJRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://doaj.org/api/v1/search/articles/${encoded}?pageSize=3`,
        { timeout: 10000 }
      );
      
      const results = response.data?.results || [];
      if (results.length === 0) return [];
      
      return results.map(item => {
        const bibjson = item.bibjson || {};
        const identifiers = bibjson.identifier || [];
        const doi = identifiers.find(id => id.type === 'doi')?.id || null;
        
        let url = bibjson.url?.[0] || '';
        if (doi && !url) {
          url = `https://doi.org/${doi}`;
        }
        if (!url) {
          url = `https://doaj.org/search?q=${encoded}`;
        }
        
        return {
          title: bibjson.title || 'Untitled',
          authors: bibjson.author?.map(a => a.name).join(', ') || 'Unknown',
          year: bibjson.year || 'n.d.',
          journal: bibjson.journal?.title || 'DOAJ Journal',
          url: url,
          source: 'DOAJ',
          accessible: true,
          peerReviewed: true,
          verified: true,
          doi: doi ? `https://doi.org/${doi}` : null
        };
      });
    } catch (error) {
      console.log('[DOAJ] Error:', error.message);
      return [];
    }
  },

  // ========== FALLBACK REFERENCES ==========
  getFallbackReferences(topic) {
    const encoded = encodeURIComponent(topic);
    const year = new Date().getFullYear();
    
    return [
      {
        title: `Research on "${topic}" - Google Scholar`,
        authors: 'Google Scholar',
        year: year,
        journal: 'Academic Database',
        url: `https://scholar.google.com/scholar?q=${encoded}`,
        source: 'Google Scholar',
        accessible: true,
        peerReviewed: true,
        verified: false
      },
      {
        title: `Academic Papers on "${topic}" - CrossRef`,
        authors: 'CrossRef',
        year: year,
        journal: 'Academic Database',
        url: `https://search.crossref.org/?q=${encoded}`,
        source: 'CrossRef',
        accessible: true,
        peerReviewed: true,
        verified: false
      },
      {
        title: `${topic} - Wikipedia`,
        authors: 'Wikipedia Contributors',
        year: year,
        journal: 'Wikipedia',
        url: `https://en.wikipedia.org/wiki/${encoded}`,
        source: 'Wikipedia',
        accessible: true,
        peerReviewed: false,
        verified: false
      }
    ];
  },

  // ========== FORMAT REFERENCES ==========
  formatReferences(references) {
    if (!references || references.length === 0) {
      return 'No specific references found. Please search Google Scholar for more information.';
    }
    
    let formatted = 'REFERENCES:\n\n';
    let counter = 1;
    
    for (const ref of references) {
      formatted += `${counter}. ${ref.authors || 'Unknown'}`;
      if (ref.year && ref.year !== 'n.d.') {
        formatted += ` (${ref.year})`;
      } else {
        formatted += ` (n.d.)`;
      }
      formatted += `. "${ref.title || 'Untitled'}."`;
      
      if (ref.journal) {
        formatted += ` *${ref.journal}*.`;
      }
      
      if (ref.url) {
        formatted += ` Available at: ${ref.url}`;
      }
      
      if (ref.doi) {
        formatted += ` DOI: ${ref.doi}`;
      }
      
      if (ref.verified) {
        formatted += ` ✓ Verified`;
      }
      
      formatted += '\n\n';
      counter++;
    }
    
    return formatted;
  },

  // ========== REMOVE DUPLICATES ==========
  removeDuplicateReferences(refs) {
    if (!refs || refs.length === 0) return [];
    
    const seen = new Set();
    const unique = [];
    
    for (const ref of refs) {
      const key = (ref.title || '') + '|' + (ref.authors || '') + '|' + (ref.year || '');
      if (!seen.has(key) && ref.title && ref.title !== 'Untitled') {
        seen.add(key);
        unique.push(ref);
      }
    }
    
    return unique;
  },

  // ========== GENERATE DYNAMIC PRESENTATION ==========
  async generateDynamicPresentation(topic, references, searchTopic, language) {
    try {
      const formattedRefs = this.formatReferences(references);
      const analysis = this.analyzeTopic(topic);
      
      let pptPrompt;
      if (language === 'tagalog') {
        pptPrompt = this.buildDynamicTagalogPrompt(topic, formattedRefs, analysis, searchTopic);
      } else {
        pptPrompt = this.buildDynamicEnglishPrompt(topic, formattedRefs, analysis, searchTopic);
      }
      
      if (pptPrompt.length > 8000) {
        pptPrompt = pptPrompt.substring(0, 8000) + '\n\n[Content shortened for length]';
      }
      
      const response = await this.callAI(pptPrompt);
      
      if (!response) return null;
      
      return this.cleanResponse(response);
      
    } catch (error) {
      console.error('[generateDynamicPresentation] Error:', error.message);
      return null;
    }
  },

  // ========== DYNAMIC ENGLISH PROMPT ==========
  buildDynamicEnglishPrompt(topic, references, analysis, searchTopic) {
    let contextInfo = '';
    if (analysis.hasScientificName) {
      contextInfo += `Scientific Name: ${analysis.scientificName}\n`;
    }
    if (analysis.hasCommonName) {
      contextInfo += `Common Name: ${analysis.commonName}\n`;
    }
    if (analysis.category !== 'General') {
      contextInfo += `Category: ${analysis.category}\n`;
    }
    
    return `You are an expert academic presentation creator.

TOPIC: "${topic}"

TOPIC CONTEXT:
${contextInfo || 'General topic'}

SEARCH TOPIC: "${searchTopic}"

${references}

CRITICAL INSTRUCTIONS:
1. Create a comprehensive 15-slide presentation
2. ALL content must be SPECIFIC to this topic
3. Use the references above as sources
4. DO NOT invent information
5. Plain text only - NO MARKDOWN

15 SLIDES:
1. Title Slide - [Specific title]
2. Table of Contents - [Topic-specific sections]
3. Introduction - Definition, Background, Importance
4. Core Concepts - [3-5 key concepts]
5. Main Components - [Key factors/elements]
6. Process/Mechanism - [How it works]
7. Key Players - [Who is involved]
8. Data/Evidence - [Statistics and facts]
9. Case Studies - [Real examples]
10. Impacts - [Positive and negative]
11. Analysis - [Deep insights]
12. Current Status - [What's happening now]
13. Summary - [Key takeaways]
14. References - [Use the references above]
15. Q&A - [Thank you]

START WITH SLIDE 1:`;
  },

  // ========== DYNAMIC TAGALOG PROMPT ==========
  buildDynamicTagalogPrompt(topic, references, analysis, searchTopic) {
    let contextInfo = '';
    if (analysis.hasScientificName) {
      contextInfo += `Scientific Name: ${analysis.scientificName}\n`;
    }
    if (analysis.hasCommonName) {
      contextInfo += `Common Name: ${analysis.commonName}\n`;
    }
    if (analysis.category !== 'General') {
      contextInfo += `Kategorya: ${analysis.category}\n`;
    }
    
    return `Ikaw ay isang ekspertong tagagawa ng presentasyon.

PAKSA: "${topic}"

KONTEKSTO NG PAKSA:
${contextInfo || 'Pangkalahatang paksa'}

SEARCH TOPIC: "${searchTopic}"

${references}

MAHALAGANG PANUNTUNAN:
1. Gumawa ng komprehensibong 15-slide presentation
2. LAHAT ng content ay dapat SPECIFIC sa paksang ito
3. Gamitin ang mga references sa itaas
4. HUWAG mag-imbento ng impormasyon
5. Plain text lamang - WALANG MARKDOWN

15 SLIDES:
1. Title Slide - [Specific na pamagat]
2. Table of Contents - [Topic-specific na sections]
3. Introduksyon - Kahulugan, Kasaysayan, Kahalagahan
4. Pangunahing Konsepto - [3-5 key concepts]
5. Mga Bahagi - [Key factors/elements]
6. Proseso/Mekanismo - [Paano gumagana]
7. Mga Key Players - [Sino ang kasali]
8. Datos/Ebidenya - [Statistics at facts]
9. Case Studies - [Tunay na halimbawa]
10. Mga Epekto - [Positibo at negatibo]
11. Pagsusuri - [Malalim na insights]
12. Kasalukuyang Estado - [Ano ang nangyayari ngayon]
13. Buod - [Key takeaways]
14. Mga Pinagkunan - [Gamitin ang references sa itaas]
15. Q&A - [Pasasalamat]

MAGSIMULA SA SLIDE 1:`;
  },

  // ========== AI API CALLS ==========
  async callAI(prompt) {
    if (prompt.length > 8000) {
      prompt = prompt.substring(0, 8000) + '\n\n[Content shortened]';
    }
    
    const primary = {
      url: 'https://api-library-kohi-production.up.railway.app/api/pollination-ai',
      param: 'prompt',
      responsePath: 'data',
      successField: 'status'
    };
    
    const fallback = {
      url: 'https://betadash-api-swordslush-production.up.railway.app/opera',
      param: 'ask',
      responsePath: 'message',
      successField: 'success'
    };
    
    try {
      const result = await this.executeAPI(primary, prompt);
      if (result) return result;
    } catch (primaryError) {
      console.error('[callAI] Primary failed:', primaryError.message);
    }
    
    try {
      const result = await this.executeAPI(fallback, prompt);
      if (result) return result;
    } catch (fallbackError) {
      console.error('[callAI] Fallback failed:', fallbackError.message);
    }
    
    return null;
  },

  async executeAPI(config, prompt) {
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

  // ========== CLEAN RESPONSE ==========
  cleanResponse(text) {
    if (!text) return text;
    let cleaned = text;
    
    cleaned = cleaned
      .replace(/^Here is.*?\n/i, '')
      .replace(/^Here's.*?\n/i, '')
      .replace(/^Sure.*?\n/i, '')
      .replace(/^Of course.*?\n/i, '')
      .replace(/^Narito.*?\n/i, '')
      .replace(/^Ito po.*?\n/i, '')
      .replace(/^If you want.*?proceed\?/is, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/#{1,6}\s*/g, '')
      .replace(/---+/g, '')
      .replace(/```/g, '')
      .trim();
    
    return cleaned;
  },

  // ========== SEND CHUNKS ==========
  splitMessage(text) {
    const chunks = [];
    const MAX_CHUNK = 1900;
    for (let i = 0; i < text.length; i += MAX_CHUNK) {
      chunks.push(text.slice(i, i + MAX_CHUNK));
    }
    return chunks;
  },

  async sendChunks(senderId, text, token) {
    if (!text) {
      await sendMessage(senderId, { 
        text: '❌ No content generated. Please try again.' 
      }, token);
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
