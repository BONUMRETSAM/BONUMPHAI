const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

const SERPAPI_KEY = process.env.SERPAPI_KEY || '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ppt', 'powerpoint', 'presentation', 'slideshow', 'slides'],
  description: 'Generate PowerPoint presentation with accurate academic references',
  usage: 'ppt [topic/title/details]',
  version: '27.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 20,

  async execute(senderId, args, token, event) {
    try {
      const fullPrompt = args.join(' ').trim();
      
      if (!fullPrompt) {
        await sendMessage(senderId, {
          text: '📊 PPT GENERATOR\n\nUsage: ppt [topic]\n\nExamples:\n• ppt Climate Change\n• ppt Communication in Academic Purpose\n• ppt Integrated Pest Management'
        }, token);
        return;
      }
      
      const searchTopic = this.extractCoreTopic(fullPrompt);
      const language = this.detectLanguage(fullPrompt);
      
      console.log(`[PPT] Input: "${fullPrompt.substring(0, 50)}..."`);
      console.log(`[PPT] Extracted: "${searchTopic}"`);
      console.log(`[PPT] Detected language: ${language}`);
      
      if (!searchTopic || searchTopic.length < 2) {
        await sendMessage(senderId, {
          text: '❌ Invalid topic. Please provide a valid topic.\n\nExample: ppt Climate Change'
        }, token);
        return;
      }
      
      await sendMessage(senderId, { 
        text: `🔍 Creating ${language === 'tagalog' ? 'Tagalog' : 'English'} presentation about: "${searchTopic}"\n⏳ Generating complete 15 slides...` 
      }, token);
      
      // Get real references
      let references = await this.getRealReferences(searchTopic);
      
      if (!references || references.length === 0) {
        references = this.getFallbackReferences(searchTopic);
      }
      
      references = references.slice(0, 5);
      
      console.log(`[PPT] Using ${references.length} references`);
      
      // ========== GENERATE COMPLETE PRESENTATION (NO INCOMPLETE) ==========
      const presentation = await this.generateCompletePresentation(
        searchTopic,
        references,
        language
      );
      
      if (presentation) {
        await this.sendChunks(senderId, presentation, token);
      } else {
        // ULTIMATE FALLBACK - ALWAYS COMPLETE
        const fallback = this.generateCompleteFallback(searchTopic, references, language);
        await this.sendChunks(senderId, fallback, token);
      }
      
    } catch (error) {
      console.error('[ppt] Error:', error.message);
      const fallback = this.generateCompleteFallback(
        args.join(' ').trim() || 'Topic',
        [],
        'english'
      );
      await this.sendChunks(senderId, fallback, token);
    }
  },

  // ========== FIX: ALWAYS COMPLETE ==========
  async generateCompletePresentation(topic, references, language) {
    try {
      const formattedRefs = this.formatReferences(references);
      
      let prompt;
      if (language === 'tagalog') {
        prompt = this.buildTagalogPrompt(topic, formattedRefs);
      } else {
        prompt = this.buildEnglishPrompt(topic, formattedRefs);
      }
      
      if (prompt.length > 6000) {
        prompt = prompt.substring(0, 6000);
      }
      
      const response = await this.callAI(prompt);
      
      if (!response) {
        return this.generateCompleteFallback(topic, references, language);
      }
      
      const cleaned = this.cleanResponse(response);
      
      // ========== CHECK AND COMPLETE ==========
      const slideCount = (cleaned.match(/SLIDE \d+/gi) || []).length;
      console.log(`[PPT] Generated ${slideCount} slides`);
      
      // If less than 13 slides, complete it
      if (slideCount < 13) {
        console.log('[PPT] Incomplete, completing...');
        return this.completePresentation(cleaned, topic, references, language);
      }
      
      // Ensure references are included
      if (!cleaned.includes('REFERENCES') && !cleaned.includes('References')) {
        return cleaned + '\n\n' + formattedRefs;
      }
      
      return cleaned;
      
    } catch (error) {
      console.error('[generateCompletePresentation] Error:', error.message);
      return this.generateCompleteFallback(topic, references, language);
    }
  },

  // ========== FIX: COMPLETE MISSING SLIDES ==========
  completePresentation(partial, topic, references, language) {
    const formattedRefs = this.formatReferences(references);
    const existingSlides = (partial.match(/SLIDE \d+/gi) || []).length;
    
    if (existingSlides >= 13) {
      return partial + '\n\n' + formattedRefs;
    }
    
    // Generate missing slides
    let missing = '';
    const slideTitles = this.getSlideTitles(language);
    
    for (let i = existingSlides; i < slideTitles.length && i < 15; i++) {
      const num = i + 1;
      missing += `\nSLIDE ${num}: ${slideTitles[i]}\n`;
      if (language === 'tagalog') {
        missing += `[Detalyadong paliwanag tungkol sa ${topic}]\n\n`;
      } else {
        missing += `[Detailed explanation about ${topic}]\n\n`;
      }
    }
    
    // Add references if missing
    if (!partial.includes('REFERENCES') && !partial.includes('References')) {
      missing += `\n${formattedRefs}`;
    }
    
    return partial + '\n' + missing;
  },

  // ========== FIX: SLIDE TITLES ==========
  getSlideTitles(language) {
    if (language === 'tagalog') {
      return [
        'TITLE SLIDE',
        'TABLE OF CONTENTS',
        'INTRODUKSYON',
        'PANGUNAHING KONSEPTO',
        'MGA BAHAGI',
        'PROSESO',
        'MGA KEY PLAYERS',
        'DATOS AT EBIDENYA',
        'CASE STUDIES',
        'MGA EPEKTO',
        'PAGSUSURI',
        'KASALUKUYANG ESTADO',
        'BUOD',
        'MGA PINAGKUNAN',
        'Q&A AT PASASALAMAT'
      ];
    }
    
    return [
      'TITLE SLIDE',
      'TABLE OF CONTENTS',
      'INTRODUCTION',
      'KEY CONCEPTS',
      'MAIN COMPONENTS',
      'PROCESS',
      'KEY PLAYERS',
      'DATA AND EVIDENCE',
      'CASE STUDIES',
      'IMPACTS',
      'ANALYSIS',
      'CURRENT STATUS',
      'SUMMARY',
      'REFERENCES',
      'Q&A AND THANK YOU'
    ];
  },

  // ========== FIX: COMPLETE FALLBACK (ALWAYS COMPLETE) ==========
  generateCompleteFallback(topic, references, language) {
    const formattedRefs = this.formatReferences(references);
    const year = new Date().getFullYear();
    
    if (language === 'tagalog') {
      return `
SLIDE 1: TITLE SLIDE
${topic}

Isinumite nina: [Pangalan]
[Course]
${year}

SLIDE 2: TABLE OF CONTENTS
01. Introduksyon
02. Pangunahing Konsepto
03. Mga Bahagi
04. Proseso
05. Mga Key Players
06. Datos at Ebidenya
07. Case Studies
08. Mga Epekto
09. Pagsusuri
10. Kasalukuyang Estado
11. Buod
12. Mga Pinagkunan
13. Q&A

SLIDE 3: INTRODUKSYON
Kahulugan: ${topic}
Kahalagahan:
- Mahalaga sa akademya
- Nakakatulong sa pag-aaral
- Kailangan sa pananaliksik

SLIDE 4: PANGUNAHING KONSEPTO
[Magbigay ng 3-5 pangunahing konsepto tungkol sa ${topic}]

SLIDE 5: MGA BAHAGI
[Ilahad ang mga bahagi ng ${topic}]

SLIDE 6: PROSESO
[Ipaliwanag ang proseso ng ${topic}]

SLIDE 7: MGA KEY PLAYERS
[Tukuyin ang mga taong kasali sa ${topic}]

SLIDE 8: DATOS AT EBIDENYA
[Magbigay ng datos at estadistika tungkol sa ${topic}]

SLIDE 9: CASE STUDIES
[Magbigay ng mga tunay na halimbawa ng ${topic}]

SLIDE 10: MGA EPEKTO
[Ilahad ang mga epekto ng ${topic}]

SLIDE 11: PAGSUSURI
[Magbigay ng malalim na pagsusuri sa ${topic}]

SLIDE 12: KASALUKUYANG ESTADO
[Ilahad ang kasalukuyang kalagayan ng ${topic}]

SLIDE 13: BUOD
TOP 5 TAKEAWAYS:
1. [Pangunahing punto 1]
2. [Pangunahing punto 2]
3. [Pangunahing punto 3]
4. [Pangunahing punto 4]
5. [Pangunahing punto 5]

SLIDE 14: MGA PINAGKUNAN
${formattedRefs}

SLIDE 15: Q&A AT PASASALAMAT
Maraming salamat sa pakikinig!
`;
    }
    
    return `
SLIDE 1: TITLE SLIDE
${topic}

Submitted by: [Student Name]
[Course]
${year}

SLIDE 2: TABLE OF CONTENTS
01. Introduction
02. Key Concepts
03. Main Components
04. Process
05. Key Players
06. Data and Evidence
07. Case Studies
08. Impacts
09. Analysis
10. Current Status
11. Summary
12. References
13. Q&A

SLIDE 3: INTRODUCTION
Definition: ${topic}
Importance:
- Important in academia
- Helps in learning
- Needed for research

SLIDE 4: KEY CONCEPTS
[Provide 3-5 key concepts about ${topic}]

SLIDE 5: MAIN COMPONENTS
[Explain the components of ${topic}]

SLIDE 6: PROCESS
[Explain the process of ${topic}]

SLIDE 7: KEY PLAYERS
[Identify people involved in ${topic}]

SLIDE 8: DATA AND EVIDENCE
[Provide statistics and data about ${topic}]

SLIDE 9: CASE STUDIES
[Provide real examples of ${topic}]

SLIDE 10: IMPACTS
[Explain the impacts of ${topic}]

SLIDE 11: ANALYSIS
[Provide deep analysis of ${topic}]

SLIDE 12: CURRENT STATUS
[Explain the current status of ${topic}]

SLIDE 13: SUMMARY
TOP 5 TAKEAWAYS:
1. [Key point 1]
2. [Key point 2]
3. [Key point 3]
4. [Key point 4]
5. [Key point 5]

SLIDE 14: REFERENCES
${formattedRefs}

SLIDE 15: Q&A AND THANK YOU
Thank you for listening!
`;
  },

  // ========== DETECT LANGUAGE ==========
  detectLanguage(prompt) {
    const lower = prompt.toLowerCase();
    const tagalogWords = ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'para', 
                          'tungkol', 'epekto', 'kahalagahan', 'pag-aaral', 
                          'paano', 'bakit', 'ano', 'saan', 'kailan'];
    
    let tagalogCount = 0;
    let englishCount = 0;
    const words = lower.split(/\s+/);
    
    for (const word of words) {
      if (tagalogWords.includes(word)) {
        tagalogCount++;
      } else if (/^[a-z]{3,}$/.test(word)) {
        englishCount++;
      }
    }
    
    const total = tagalogCount + englishCount;
    if (total > 0 && (tagalogCount / total) > 0.3) {
      return 'tagalog';
    }
    return 'english';
  },

  // ========== GET REAL REFERENCES ==========
  async getRealReferences(topic) {
    let allRefs = [];
    
    try {
      const refs = await this.getGoogleScholarRefs(topic);
      if (refs && refs.length > 0) {
        allRefs = allRefs.concat(refs);
      }
    } catch (error) {
      console.log('[Google Scholar] Error:', error.message);
    }
    
    try {
      const refs = await this.getCrossRefRefs(topic);
      if (refs && refs.length > 0) {
        allRefs = allRefs.concat(refs);
      }
    } catch (error) {
      console.log('[CrossRef] Error:', error.message);
    }
    
    const uniqueRefs = this.removeDuplicateReferences(allRefs);
    const withUrls = uniqueRefs.filter(ref => ref.url && ref.url.startsWith('http'));
    
    return withUrls.slice(0, 5);
  },

  // ========== GOOGLE SCHOLAR ==========
  async getGoogleScholarRefs(topic) {
    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          engine: 'google_scholar',
          q: topic,
          api_key: SERPAPI_KEY,
          num: 5
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
          verified: true
        };
      });
    } catch (error) {
      return [];
    }
  },

  // ========== CROSSREF ==========
  async getCrossRefRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://api.crossref.org/works?query=${encoded}&rows=5&sort=relevance`,
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
          verified: true,
          doi: doi
        };
      });
    } catch (error) {
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
        verified: false
      },
      {
        title: `Academic Papers on "${topic}" - CrossRef`,
        authors: 'CrossRef',
        year: year,
        journal: 'Academic Database',
        url: `https://search.crossref.org/?q=${encoded}`,
        source: 'CrossRef',
        verified: false
      }
    ];
  },

  // ========== FORMAT REFERENCES ==========
  formatReferences(references) {
    if (!references || references.length === 0) {
      return 'No specific references found. Please search Google Scholar.';
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

  // ========== EXTRACT CORE TOPIC ==========
  extractCoreTopic(text) {
    let cleaned = text.replace(/^(ppt|report|about|presentation|slideshow|slides)\s+(of|for|on)?\s*/i, '');
    cleaned = cleaned.replace(/\([^)]*\)/g, '').trim();
    cleaned = cleaned.replace(/\b(is a|is an|refers to|means|involves|uses|includes|called|known as|for)\b/gi, '').trim();
    
    if (cleaned.length > 100) {
      const sentences = cleaned.match(/[^.!?]+[.!?]/g);
      if (sentences && sentences.length > 0) {
        let first = sentences[0].trim();
        const words = first.split(/\s+/);
        if (words.length > 10) {
          return words.slice(0, 10).join(' ');
        }
        return first;
      }
      return cleaned.substring(0, 100);
    }
    
    const words = cleaned.split(/\s+/);
    if (words.length > 10) {
      return words.slice(0, 10).join(' ');
    }
    
    return cleaned || text.substring(0, 100);
  },

  // ========== BUILD ENGLISH PROMPT ==========
  buildEnglishPrompt(topic, references) {
    return `Create a complete academic presentation in ENGLISH about: "${topic}"

${references}

IMPORTANT: Respond in ENGLISH only. ALL slides must be in ENGLISH.

Generate exactly 15 slides:
1. Title Slide
2. Table of Contents
3. Introduction - Definition, Background, Importance (3 reasons)
4. Key Concepts - 3-5 with explanations
5. Main Components - 3-4 components
6. Process/How It Works
7. Key Players/Stakeholders
8. Data and Evidence - Statistics with sources
9. Case Studies - 2-3 real examples
10. Impacts - Positive and negative
11. Analysis - Deep insights
12. Current Status and Future Trends
13. Summary - Top 5 takeaways
14. References (USE THE REFERENCES ABOVE)
15. Q&A and Thank You

COMPLETE ALL 15 SLIDES. DO NOT STOP.
Plain text only. No markdown.

START NOW IN ENGLISH:`;
  },

  // ========== BUILD TAGALOG PROMPT ==========
  buildTagalogPrompt(topic, references) {
    return `Gumawa ng kumpletong akademikong presentasyon sa TAGALOG tungkol sa: "${topic}"

${references}

MAHALAGA: Tumugon sa TAGALOG lamang. LAHAT ng slides ay dapat sa TAGALOG.

Gumawa ng eksaktong 15 slides:
1. Title Slide
2. Table of Contents
3. Introduksyon - Kahulugan, Kasaysayan, Kahalagahan (3 dahilan)
4. Pangunahing Konsepto - 3-5 na may paliwanag
5. Mga Bahagi - 3-4 na bahagi
6. Proseso - Mga hakbang
7. Mga Key Players
8. Datos at Ebidenya - Estadistika na may sources
9. Case Studies - 2-3 tunay na halimbawa
10. Mga Epekto - Positibo at negatibo
11. Pagsusuri - Malalim na insights
12. Kasalukuyang Estado at Hinaharap
13. Buod - Top 5 takeaways
14. Mga Pinagkunan (GAMITIN ANG MGA REFERENCES SA ITAAS)
15. Q&A at Pasasalamat

KUMPLETUHIN ANG LAHAT NG 15 SLIDES. HUWAG TUMIGIL.
Plain text lamang.

MAGSIMULA NA SA TAGALOG:`;
  },

  // ========== AI API CALLS ==========
  async callAI(prompt) {
    if (prompt.length > 6000) {
      prompt = prompt.substring(0, 6000);
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
      timeout: 30000,
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
      .replace(/^Please confirm.*?proceed\?/is, '')
      .replace(/^Let me know if.*?proceed\?/is, '')
      .replace(/^Would you like.*?continue\?/is, '')
      .replace(/^Shall I proceed.*?\?/is, '')
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
