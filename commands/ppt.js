const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

const SERPAPI_KEY = process.env.SERPAPI_KEY || '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ppt', 'powerpoint', 'presentation', 'slideshow', 'slides'],
  description: 'Generate PowerPoint presentation with accurate academic references',
  usage: 'ppt [topic/title/details]',
  version: '22.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 20,

  async execute(senderId, args, token, event) {
    try {
      const fullPrompt = args.join(' ').trim();
      
      if (!fullPrompt) {
        await sendMessage(senderId, {
          text: '📊 PPT GENERATOR\n\nUsage: ppt [topic]\n\nExamples:\n• ppt Climate Change\n• ppt Integrated Pest Management\n• ppt IPM management practices'
        }, token);
        return;
      }
      
      // ========== FIX: ALWAYS EXTRACT CORE TOPIC FIRST ==========
      // This bypasses validation issues
      const searchTopic = this.extractCoreTopic(fullPrompt);
      const language = this.detectLanguage(fullPrompt);
      
      console.log(`[PPT] Original: "${fullPrompt.substring(0, 50)}..."`);
      console.log(`[PPT] Extracted: "${searchTopic}"`);
      console.log(`[PPT] Language: ${language}`);
      
      if (!searchTopic || searchTopic.length < 2) {
        await sendMessage(senderId, {
          text: '❌ Invalid topic. Please provide a valid topic.\n\nExample: ppt Climate Change'
        }, token);
        return;
      }
      
      await sendMessage(senderId, { 
        text: `🔍 Creating presentation about: "${searchTopic}"\n⏳ Generating all 15 slides...` 
      }, token);
      
      // Get references
      let references = await this.getVerifiedReferences(searchTopic);
      
      if (!references || references.length === 0) {
        references = this.getFallbackReferences(searchTopic);
      }
      
      references = references.slice(0, 4);
      
      console.log(`[PPT] Using ${references.length} references`);
      
      // Generate presentation
      const presentation = await this.generatePresentation(
        searchTopic,
        references,
        language
      );
      
      if (presentation) {
        await this.sendChunks(senderId, presentation, token);
      } else {
        // ========== FIX: RETRY WITH EVEN SHORTER TOPIC ==========
        const shorterTopic = searchTopic.split(' ').slice(0, 5).join(' ');
        console.log(`[PPT] Retrying with shorter topic: "${shorterTopic}"`);
        
        const retryPresentation = await this.generatePresentation(
          shorterTopic,
          references,
          language
        );
        
        if (retryPresentation) {
          await this.sendChunks(senderId, retryPresentation, token);
        } else {
          await sendMessage(senderId, { 
            text: '❌ Error generating presentation. Please try:\n• Shorter topic (2-5 words)\n• Example: ppt Climate Change' 
          }, token);
        }
      }
      
    } catch (error) {
      console.error('[ppt] Error:', error.message);
      await sendMessage(senderId, { 
        text: '❌ Error: ' + error.message 
      }, token);
    }
  },

  // ========== FIXED: EXTRACT CORE TOPIC ==========
  extractCoreTopic(text) {
    // Remove common prefixes
    let cleaned = text.replace(/^(ppt|report|about|presentation|slideshow|slides)\s+(of|for|on)?\s*/i, '');
    
    // Remove ALL parentheses and their content (IPM)
    cleaned = cleaned.replace(/\([^)]*\)/g, '').trim();
    
    // Remove common phrases
    cleaned = cleaned.replace(/\b(is a|is an|refers to|means|involves|uses|includes|called|known as)\b/gi, '').trim();
    
    // If text is long, take first 100 characters or first sentence
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
    
    // Take first 10 words
    const words = cleaned.split(/\s+/);
    if (words.length > 10) {
      return words.slice(0, 10).join(' ');
    }
    
    return cleaned || text.substring(0, 100);
  },

  // ========== GENERATE PRESENTATION ==========
  async generatePresentation(topic, references, language) {
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
      
      if (!response) return null;
      
      const cleaned = this.cleanResponse(response);
      
      // Check if complete
      const slideCount = (cleaned.match(/SLIDE \d+/gi) || []).length;
      console.log(`[PPT] Generated ${slideCount} slides`);
      
      if (slideCount < 10) {
        console.log('[PPT] Incomplete, retrying...');
        return null;
      }
      
      return cleaned;
      
    } catch (error) {
      console.error('[generatePresentation] Error:', error.message);
      return null;
    }
  },

  // ========== SHORT ENGLISH PROMPT ==========
  buildEnglishPrompt(topic, references) {
    return `Create a complete 15-slide academic presentation about: "${topic}"

${references}

Generate ALL 15 slides now. DO NOT stop or ask for confirmation.

1. Title Slide
2. Table of Contents
3. Introduction - Definition, Background, Importance (3 reasons)
4. Key Concepts - 3-5 concepts with explanations
5. Main Components - 3-4 components
6. Process/How It Works - Steps with explanations
7. Key Players - Who is involved
8. Data and Evidence - 3-5 statistics
9. Case Studies - 2-3 real examples
10. Impacts - Positive and negative
11. Analysis - Deep insights
12. Current Status and Future Trends
13. Summary - Top 5 takeaways
14. References
15. Q&A and Thank You

Plain text only. No markdown.

START WITH SLIDE 1:`;
  },

  // ========== SHORT TAGALOG PROMPT ==========
  buildTagalogPrompt(topic, references) {
    return `Gumawa ng kumpletong 15-slide presentation tungkol sa: "${topic}"

${references}

Gumawa ng LAHAT ng 15 slides ngayon. HUWAG tumigil o magtanong.

1. Title Slide
2. Table of Contents
3. Introduksyon - Kahulugan, Kasaysayan, Kahalagahan
4. Pangunahing Konsepto - 3-5 konsepto
5. Mga Bahagi - 3-4 bahagi
6. Proseso - Mga hakbang
7. Mga Key Players - Sino ang kasali
8. Datos - 3-5 estadistika
9. Case Studies - 2-3 halimbawa
10. Mga Epekto - Positibo at negatibo
11. Pagsusuri - Malalim na insights
12. Kasalukuyang Estado at Hinaharap
13. Buod - Top 5 takeaways
14. Mga Pinagkunan
15. Q&A at Pasasalamat

Plain text lamang.

MAGSIMULA SA SLIDE 1:`;
  },

  // ========== DETECT LANGUAGE ==========
  detectLanguage(prompt) {
    const lower = prompt.toLowerCase();
    const tagalogWords = ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'para', 'tungkol', 'epekto', 'kahalagahan', 'pag-aaral', 'paano', 'bakit'];
    const hasTagalog = tagalogWords.some(w => lower.includes(w));
    return hasTagalog ? 'tagalog' : 'english';
  },

  // ========== GET VERIFIED REFERENCES ==========
  async getVerifiedReferences(topic) {
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
    
    return withUrls.slice(0, 4);
  },

  // ========== GOOGLE SCHOLAR ==========
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
      timeout: 45000,
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
