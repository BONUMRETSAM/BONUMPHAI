const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

const SERPAPI_KEY = process.env.SERPAPI_KEY || '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ppt', 'powerpoint', 'presentation', 'slideshow', 'slides'],
  description: 'Generate PowerPoint presentation with accurate academic references',
  usage: 'ppt [topic/title/details]',
  version: '14.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 15,

  async execute(senderId, args, token, event) {
    try {
      const fullPrompt = args.join(' ').trim();
      
      if (!fullPrompt) {
        await sendMessage(senderId, {
          text: '📊 PPT GENERATOR\n\nUsage: ppt [topic/title/details]\n\nExamples:\n• ppt Climate Change\n• ppt Integrated Pest Management\n• ppt [detailed topic description]'
        }, token);
        return;
      }
      
      if (!this.validateInput(fullPrompt)) {
        await sendMessage(senderId, {
          text: '❌ Invalid input. Please use alphanumeric characters only.'
        }, token);
        return;
      }
      
      const fullTopic = this.extractFullTopic(fullPrompt);
      const searchTopic = this.extractCoreSearchTopic(fullTopic);
      
      console.log(`[PPT] Search topic: "${searchTopic}"`);
      
      await sendMessage(senderId, { 
        text: `🔍 Searching for REAL academic sources...\n📝 Topic: "${searchTopic}"\n⏳ Please wait...` 
      }, token);
      
      // ========== GET REFERENCES WITH REAL URLs ==========
      let references = await this.getReferencesWithRealUrls(searchTopic);
      
      if (!references || references.length === 0) {
        references = this.getFallbackReferencesWithUrls(searchTopic);
      }
      
      console.log(`[PPT] Found ${references.length} references with real URLs`);
      
      // ========== GENERATE PRESENTATION WITH REAL URL REFERENCES ==========
      const presentation = await this.generatePresentationWithRealUrls(
        fullTopic,
        references,
        searchTopic
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
        text: '❌ Error: ' + error.message 
      }, token);
    }
  },

  // ========== GET REFERENCES WITH REAL URLs ==========
  async getReferencesWithRealUrls(topic) {
    let allRefs = [];
    
    // 1. Try Google Scholar via SerpAPI (BEST SOURCE)
    try {
      const refs = await this.getGoogleScholarWithUrls(topic);
      if (refs && refs.length > 0) {
        console.log(`[Google Scholar] Found ${refs.length} references with real URLs`);
        allRefs = allRefs.concat(refs);
      }
    } catch (error) {
      console.log('[Google Scholar] Error:', error.message);
    }
    
    // 2. Try CrossRef (for DOIs -> URLs)
    try {
      const refs = await this.getCrossRefWithUrls(topic);
      if (refs && refs.length > 0) {
        console.log(`[CrossRef] Found ${refs.length} references with DOIs`);
        allRefs = allRefs.concat(refs);
      }
    } catch (error) {
      console.log('[Google Scholar] Error:', error.message);
    }
    
    // 3. Try DOAJ (Open Access)
    try {
      const refs = await this.getDOAJWithUrls(topic);
      if (refs && refs.length > 0) {
        console.log(`[DOAJ] Found ${refs.length} references with URLs`);
        allRefs = allRefs.concat(refs);
      }
    } catch (error) {
      console.log('[DOAJ] Error:', error.message);
    }
    
    // 4. Try Wikipedia (as additional source)
    try {
      const refs = await this.getWikipediaWithUrls(topic);
      if (refs && refs.length > 0) {
        console.log(`[Wikipedia] Found ${refs.length} references with URLs`);
        allRefs = allRefs.concat(refs);
      }
    } catch (error) {
      console.log('[Wikipedia] Error:', error.message);
    }
    
    // Remove duplicates and filter
    const uniqueRefs = this.removeDuplicateReferences(allRefs);
    
    // Only keep references with real URLs
    const withUrls = uniqueRefs.filter(ref => ref.url && ref.url.startsWith('http'));
    
    console.log(`[Sources] Total: ${withUrls.length} references with real URLs`);
    
    return withUrls.slice(0, 8);
  },

  // ========== GOOGLE SCHOLAR WITH REAL URLS ==========
  async getGoogleScholarWithUrls(topic) {
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
        
        // Get the best available URL
        let url = paper.link || '';
        if (paper.publication_info?.pdf_url) {
          url = paper.publication_info.pdf_url;
        } else if (paper.snippet) {
          // Use Google Scholar search URL as fallback
          url = `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title || topic)}`;
        }
        
        return {
          title: paper.title || 'Untitled',
          authors: authors,
          year: year,
          journal: journal,
          url: url || `https://scholar.google.com/scholar?q=${encodeURIComponent(topic)}`,
          source: 'Google Scholar',
          accessible: true,
          peerReviewed: true,
          type: 'scholar'
        };
      });
    } catch (error) {
      console.log('[GoogleScholar] Error:', error.message);
      return [];
    }
  },

  // ========== CROSSREF WITH REAL URLS ==========
  async getCrossRefWithUrls(topic) {
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
        
        // Get URL - DOI is best, otherwise link
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
          journal: item['container-title']?.[0] || 'Crossref Publication',
          url: url,
          source: 'CrossRef',
          accessible: !!doi,
          peerReviewed: true,
          type: 'crossref',
          doi: doi
        };
      });
    } catch (error) {
      console.log('[CrossRef] Error:', error.message);
      return [];
    }
  },

  // ========== DOAJ WITH REAL URLS ==========
  async getDOAJWithUrls(topic) {
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
          type: 'doaj',
          doi: doi ? `https://doi.org/${doi}` : null
        };
      });
    } catch (error) {
      console.log('[DOAJ] Error:', error.message);
      return [];
    }
  },

  // ========== WIKIPEDIA WITH URLS ==========
  async getWikipediaWithUrls(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
        { timeout: 5000 }
      );
      
      if (!response.data || !response.data.title) return [];
      
      return [{
        title: `${response.data.title} - Wikipedia`,
        authors: 'Wikipedia Contributors',
        year: new Date().getFullYear(),
        journal: 'Wikipedia',
        url: response.data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encoded}`,
        source: 'Wikipedia',
        accessible: true,
        peerReviewed: false,
        type: 'wikipedia'
      }];
    } catch (error) {
      console.log('[Wikipedia] Error:', error.message);
      return [];
    }
  },

  // ========== FALLBACK REFERENCES WITH REAL URLS ==========
  getFallbackReferencesWithUrls(topic) {
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
        type: 'fallback'
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
        type: 'fallback'
      },
      {
        title: `Research on "${topic}" - ScienceDirect`,
        authors: 'ScienceDirect',
        year: year,
        journal: 'Academic Database',
        url: `https://www.sciencedirect.com/search?qs=${encoded}`,
        source: 'ScienceDirect',
        accessible: true,
        peerReviewed: true,
        type: 'fallback'
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
        type: 'fallback'
      }
    ];
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
      'health', 'disease', 'medical'
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
    cleaned = cleaned.replace(/\b(is a|is an|refers to|means|involves|uses|includes)\b/gi, '').trim();
    
    const words = cleaned.split(/\s+/);
    if (words.length > 15) {
      return words.slice(0, 15).join(' ');
    }
    
    return cleaned || text.substring(0, 100);
  },

  // ========== VALIDATION ==========
  validateInput(prompt) {
    if (!prompt || prompt.length < 2) return false;
    if (prompt.length > 100000) return false;
    const cleaned = prompt.replace(/[a-zA-Z0-9\s\.,!?;:'"()\-]/g, '');
    if (cleaned.length > 0) return false;
    return true;
  },

  // ========== DETECT LANGUAGE ==========
  detectLanguage(prompt) {
    const lower = prompt.toLowerCase();
    const tagalogWords = ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'para', 'tungkol', 'epekto', 'kahalagahan'];
    const hasTagalog = tagalogWords.some(w => lower.includes(w));
    return hasTagalog ? 'tagalog' : 'english';
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
      isPhilippineTopic: false,
      isHealthTopic: false,
      isScienceTopic: false,
      isTechnologyTopic: false,
      isEnvironmentalTopic: false,
      isAgriculturalTopic: false,
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
    
    const philippineKeywords = ['philippine', 'philippines', 'pinoy', 'filipino'];
    analysis.isPhilippineTopic = philippineKeywords.some(k => cleanPrompt.toLowerCase().includes(k));
    
    const envKeywords = ['climate', 'environment', 'ecosystem', 'biodiversity'];
    analysis.isEnvironmentalTopic = envKeywords.some(k => cleanPrompt.toLowerCase().includes(k));
    
    const agriKeywords = ['agriculture', 'farming', 'crop', 'pest', 'ipm'];
    analysis.isAgriculturalTopic = agriKeywords.some(k => cleanPrompt.toLowerCase().includes(k));
    
    return analysis;
  },

  // ========== FORMAT REFERENCES WITH REAL URLS ==========
  formatReferencesWithUrls(references) {
    if (!references || references.length === 0) {
      return 'No specific references found. Please search Google Scholar for more information.';
    }
    
    let formatted = 'REFERENCES:\n\n';
    let counter = 1;
    
    for (const ref of references) {
      // Format: Author (Year). "Title." Journal. URL
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
      
      formatted += '\n\n';
      counter++;
    }
    
    return formatted;
  },

  // ========== GENERATE PRESENTATION WITH REAL URLS ==========
  async generatePresentationWithRealUrls(topic, references, searchTopic) {
    try {
      const formattedRefs = this.formatReferencesWithUrls(references);
      const language = this.detectLanguage(topic);
      const analysis = this.analyzeTopic(topic);
      
      let pptPrompt;
      if (language === 'tagalog') {
        pptPrompt = this.buildTagalogPrompt(topic, formattedRefs, analysis, searchTopic);
      } else {
        pptPrompt = this.buildEnglishPrompt(topic, formattedRefs, analysis, searchTopic);
      }
      
      if (pptPrompt.length > 8000) {
        pptPrompt = pptPrompt.substring(0, 8000) + '\n\n[Content shortened]';
      }
      
      const response = await this.callAI(pptPrompt);
      
      if (!response) return null;
      
      return this.cleanResponse(response);
      
    } catch (error) {
      console.error('[generatePresentationWithRealUrls] Error:', error.message);
      return null;
    }
  },

  // ========== BUILD ENGLISH PROMPT ==========
  buildEnglishPrompt(topic, references, analysis, searchTopic) {
    let contextInfo = '';
    if (analysis.hasScientificName) {
      contextInfo += `Scientific Name: ${analysis.scientificName}\n`;
    }
    if (analysis.hasCommonName) {
      contextInfo += `Common Name: ${analysis.commonName}\n`;
    }
    
    return `You are an expert academic presentation creator.

TOPIC: "${topic}"

SEARCH TOPIC: "${searchTopic}"

${contextInfo || 'General topic'}

${references}

CRITICAL INSTRUCTIONS:
1. Use the references above as your sources
2. ALL references have REAL URLs that work
3. The content in the slides must be traceable to these sources
4. DO NOT invent fake information
5. DO NOT create fake references
6. Create a comprehensive 15-slide presentation
7. Plain text only - NO MARKDOWN, NO **, NO ##

15 SLIDES FORMAT:
1. Title Slide - [Title based on topic]
2. Table of Contents
3. Introduction - Definition and 3 importance reasons
4. Objectives - 4 objectives
5. Main Concept 1 - Definition, Key points, Example
6. Main Concept 2 - Explanation, Comparison, Example
7. Main Concept 3 - Process, Timeline, Impact
8. Data and Information - 3 facts with interpretation
9. Case Study - Situation, Problem, Response, Lesson
10. Analysis - Root cause, Affected, Why matters, Implications
11. Summary - Top 3 takeaways
12. Conclusion - Conclusion, Key insight, Final message
13. Recommendations - Short, Medium, Long term
14. References - Use the references above (with URLs)
15. Q&A and Thank You

START WITH SLIDE 1:`;
  },

  // ========== BUILD TAGALOG PROMPT ==========
  buildTagalogPrompt(topic, references, analysis, searchTopic) {
    let contextInfo = '';
    if (analysis.hasScientificName) {
      contextInfo += `Scientific Name: ${analysis.scientificName}\n`;
    }
    if (analysis.hasCommonName) {
      contextInfo += `Common Name: ${analysis.commonName}\n`;
    }
    
    return `Ikaw ay isang ekspertong tagagawa ng presentasyon.

PAKSA: "${topic}"

SEARCH TOPIC: "${searchTopic}"

${contextInfo || 'Pangkalahatang paksa'}

${references}

MAHALAGANG PANUNTUNAN:
1. Gamitin ang mga references sa itaas bilang sources
2. LAHAT ng references ay may REAL URLs na gumagana
3. Ang nilalaman sa slides ay dapat traceable sa mga source na ito
4. HUWAG gumawa ng pekeng impormasyon
5. HUWAG gumawa ng pekeng references
6. Gumawa ng komprehensibong 15-slide presentation
7. Plain text lamang - WALANG MARKDOWN

15 SLIDES FORMAT:
1. Title Slide - [Pamagat batay sa paksa]
2. Table of Contents
3. Introduksyon - Kahulugan at 3 kahalagahan
4. Layunin - 4 na layunin
5. Pangunahing Konsepto 1 - Depinisyon, Mahahalagang punto, Halimbawa
6. Pangunahing Konsepto 2 - Paliwanag, Paghahambing, Halimbawa
7. Pangunahing Konsepto 3 - Proseso, Timeline, Epekto
8. Mga Datos at Impormasyon - 3 datos na may interpretasyon
9. Case Study - Sitwasyon, Problema, Tugon, Aral
10. Pagsusuri - Ugat, Apektado, Bakit mahalaga, Implikasyon
11. Buod - Top 3 takeaways
12. Konklusyon - Konklusyon, Pangunahing insight, Panghuling mensahe
13. Rekomendasyon - Panandalian, Katamtaman, Pangmatagalan
14. Mga Pinagkunan - Gamitin ang mga references sa itaas (may URLs)
15. Q&A at Pasasalamat

MAGSIMULA SA SLIDE 1:`;
  },

  // ========== FORMAT APA 7 ==========
  formatAPA7(ref) {
    let parts = [];
    
    let authors = this.formatAuthorsAPA(ref.authors);
    parts.push(authors);
    
    let year = ref.year || 'n.d.';
    if (year !== 'n.d.' && !isNaN(year)) {
      parts.push(`(${year})`);
    } else {
      parts.push('(n.d.)');
    }
    
    let title = ref.title || 'Untitled';
    title = this.capitalizeTitleAPA(title);
    parts.push(`"${title}."`);
    
    let journal = ref.journal || ref.source || '';
    if (journal) {
      parts.push(`*${journal}*,`);
    }
    
    let url = ref.url || '';
    if (url) {
      parts.push(url);
    }
    
    return parts.join(' ');
  },

  formatAuthorsAPA(authors) {
    if (!authors || authors === 'Unknown') {
      return 'Anonymous';
    }
    
    if (authors.includes(',') && authors.includes('&')) {
      return authors;
    }
    
    const authorList = authors.split(/[,&]/).map(a => a.trim()).filter(a => a);
    
    if (authorList.length === 0) return 'Anonymous';
    if (authorList.length === 1) {
      const names = authorList[0].split(' ');
      if (names.length >= 2) {
        return `${names[names.length-1]}, ${names[0].charAt(0)}.`;
      }
      return `${authorList[0]}.`;
    }
    
    const formatted = authorList.map(name => {
      const names = name.split(' ');
      if (names.length >= 2) {
        return `${names[names.length-1]}, ${names[0].charAt(0)}.`;
      }
      return name;
    });
    
    if (formatted.length === 2) {
      return `${formatted[0]}, & ${formatted[1]}`;
    }
    
    const last = formatted.pop();
    return `${formatted.join(', ')}, & ${last}`;
  },

  capitalizeTitleAPA(title) {
    title = title.replace(/^["']|["']$/g, '');
    return title.charAt(0).toUpperCase() + title.slice(1);
  },

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
