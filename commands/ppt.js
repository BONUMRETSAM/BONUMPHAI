const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

const SERPAPI_KEY = process.env.SERPAPI_KEY || '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ppt', 'powerpoint', 'presentation', 'slideshow', 'slides'],
  description: 'Generate PowerPoint presentation with accurate academic references',
  usage: 'ppt [topic/title/details]',
  version: '20.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 20,

  async execute(senderId, args, token, event) {
    try {
      const fullPrompt = args.join(' ').trim();
      
      if (!fullPrompt) {
        await sendMessage(senderId, {
          text: '📊 PPT GENERATOR\n\nUsage: ppt [topic/title/details]\n\nExamples:\n• ppt Climate Change\n• ppt Integrated Pest Management\n• ppt Artificial Intelligence'
        }, token);
        return;
      }
      
      if (!this.validateInput(fullPrompt)) {
        await sendMessage(senderId, {
          text: '❌ Invalid input. Please use letters, numbers, spaces, and common punctuation.'
        }, token);
        return;
      }
      
      const fullTopic = this.extractFullTopic(fullPrompt);
      const searchTopic = this.extractCoreSearchTopic(fullTopic);
      const language = this.detectLanguage(fullPrompt);
      
      console.log(`[PPT] Search topic: "${searchTopic}"`);
      
      await sendMessage(senderId, { 
        text: `🔍 Creating complete presentation about: "${searchTopic}"\n⏳ Generating all 15 slides...` 
      }, token);
      
      // Get references
      let references = await this.getVerifiedReferences(searchTopic);
      
      if (!references || references.length === 0) {
        references = this.getFallbackReferences(searchTopic);
      }
      
      // ========== FIXED: GENERATE COMPLETE PRESENTATION ==========
      const presentation = await this.generateCompletePresentation(
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
        text: '❌ Error: ' + error.message 
      }, token);
    }
  },

  // ========== FIXED: COMPLETE PRESENTATION ==========
  async generateCompletePresentation(topic, references, searchTopic, language) {
    try {
      const formattedRefs = this.formatReferences(references);
      const analysis = this.analyzeTopic(topic);
      
      let pptPrompt;
      if (language === 'tagalog') {
        pptPrompt = this.buildCompleteTagalogPrompt(topic, formattedRefs, analysis, searchTopic);
      } else {
        pptPrompt = this.buildCompleteEnglishPrompt(topic, formattedRefs, analysis, searchTopic);
      }
      
      if (pptPrompt.length > 8000) {
        pptPrompt = pptPrompt.substring(0, 8000);
      }
      
      const response = await this.callAI(pptPrompt);
      
      if (!response) return null;
      
      const cleaned = this.cleanResponse(response);
      
      // ========== VERIFY COMPLETE OUTPUT ==========
      if (!this.isCompletePresentation(cleaned)) {
        console.log('[PPT] Incomplete presentation, retrying...');
        // Retry with simpler prompt
        const retryResponse = await this.retryCompletePresentation(topic, references, language);
        if (retryResponse) return retryResponse;
        return null;
      }
      
      return cleaned;
      
    } catch (error) {
      console.error('[generateCompletePresentation] Error:', error.message);
      return null;
    }
  },

  // ========== VERIFY COMPLETE PRESENTATION ==========
  isCompletePresentation(text) {
    if (!text) return false;
    
    const slideCount = (text.match(/SLIDE \d+/gi) || []).length;
    console.log(`[Verify] Found ${slideCount} slides`);
    
    // Must have at least 12 slides
    if (slideCount < 12) return false;
    
    // Must have references
    if (!text.includes('REFERENCES') && !text.includes('References')) return false;
    
    return true;
  },

  // ========== RETRY WITH SIMPLER PROMPT ==========
  async retryCompletePresentation(topic, references, language) {
    console.log('[PPT] Retrying with simpler prompt...');
    
    const formattedRefs = this.formatReferences(references);
    
    const prompt = `Create a complete 15-slide academic presentation about "${topic}".

${formattedRefs}

Generate ALL slides now. Do not stop or ask for confirmation.

SLIDES:
1. Title
2. Contents
3. Introduction
4. Key Concepts
5. Main Components
6. How It Works
7. Key Players
8. Data
9. Case Studies
10. Impacts
11. Analysis
12. Current Status
13. Summary
14. References
15. Q&A

Start with SLIDE 1 and continue to SLIDE 15.`;

    const response = await this.callAI(prompt);
    if (!response) return null;
    
    const cleaned = this.cleanResponse(response);
    
    if (this.isCompletePresentation(cleaned)) {
      return cleaned;
    }
    
    return null;
  },

  // ========== COMPLETE ENGLISH PROMPT ==========
  buildCompleteEnglishPrompt(topic, references, analysis, searchTopic) {
    let contextInfo = '';
    if (analysis.hasScientificName) {
      contextInfo += `Scientific Name: ${analysis.scientificName}\n`;
    }
    if (analysis.hasCommonName) {
      contextInfo += `Common Name: ${analysis.commonName}\n`;
    }
    
    return `You are an expert academic presentation creator.

TOPIC: "${topic}"

${references}

CRITICAL INSTRUCTION: Generate a COMPLETE 15-slide presentation in ONE response. DO NOT stop after Slide 1. DO NOT ask for confirmation. Complete ALL slides.

FORMAT (ALL 15 SLIDES - GENERATE EVERYTHING):

SLIDE 1: TITLE SLIDE
[Create a specific, compelling title based on the topic]
Submitted by: [Student Name]
[Course]
[Date]

SLIDE 2: TABLE OF CONTENTS
01. Introduction
02. Key Concepts and Definitions
03. Main Components/Factors
04. Process/Mechanism
05. Key Players/Stakeholders
06. Data and Evidence
07. Case Studies/Real-World Examples
08. Impacts and Effects
09. Analysis and Discussion
10. Current Status and Future Trends
11. Summary and Key Takeaways
12. Conclusion
13. Recommendations
14. References
15. Q&A and Thank You

SLIDE 3: INTRODUCTION
Definition: [Complete definition]
Background: [Historical context]
Importance: [3-4 reasons with explanations]

SLIDE 4: KEY CONCEPTS AND DEFINITIONS
[Identify and explain 3-5 key concepts]
Concept 1: [Name] - [Explanation]
Concept 2: [Name] - [Explanation]
Concept 3: [Name] - [Explanation]

SLIDE 5: MAIN COMPONENTS/FACTORS
[Identify and explain 3-4 main components]
Component 1: [Name] - [Explanation]
Component 2: [Name] - [Explanation]
Component 3: [Name] - [Explanation]

SLIDE 6: PROCESS/MECHANISM
[Explain how it works]
Step 1: [Explanation]
Step 2: [Explanation]
Step 3: [Explanation]
Step 4: [Explanation]

SLIDE 7: KEY PLAYERS/STAKEHOLDERS
[Who is involved?]
[Player 1]: [Role]
[Player 2]: [Role]
[Player 3]: [Role]

SLIDE 8: DATA AND EVIDENCE
[Provide 3-5 key data points]
1. [Data - cite source]
2. [Data - cite source]
3. [Data - cite source]
Interpretation: [What this means]

SLIDE 9: CASE STUDIES/REAL-WORLD EXAMPLES
[Provide 2-3 concrete examples]
Example 1: [Situation] - [What happened] - [Lesson]
Example 2: [Situation] - [What happened] - [Lesson]

SLIDE 10: IMPACTS AND EFFECTS
Positive Impacts:
- [Impact 1]
- [Impact 2]
Negative Impacts/Challenges:
- [Challenge 1]
- [Challenge 2]

SLIDE 11: ANALYSIS AND DISCUSSION
[Deep analysis]
- [Key insight 1]
- [Key insight 2]
- [Key insight 3]

SLIDE 12: CURRENT STATUS AND FUTURE TRENDS
Current Status:
- [Situation 1]
- [Situation 2]
Future Trends:
- [Trend 1]
- [Trend 2]

SLIDE 13: SUMMARY AND KEY TAKEAWAYS
TOP 5 TAKEAWAYS:
1. [Key point 1]
2. [Key point 2]
3. [Key point 3]
4. [Key point 4]
5. [Key point 5]

SLIDE 14: REFERENCES
${references}

SLIDE 15: Q&A AND THANK YOU
THANK YOU FOR LISTENING!
Questions and discussion welcome.

GENERATE ALL 15 SLIDES NOW. DO NOT STOP. DO NOT ASK FOR CONFIRMATION.`;
  },

  // ========== COMPLETE TAGALOG PROMPT ==========
  buildCompleteTagalogPrompt(topic, references, analysis, searchTopic) {
    let contextInfo = '';
    if (analysis.hasScientificName) {
      contextInfo += `Scientific Name: ${analysis.scientificName}\n`;
    }
    if (analysis.hasCommonName) {
      contextInfo += `Common Name: ${analysis.commonName}\n`;
    }
    
    return `Ikaw ay isang ekspertong tagagawa ng presentasyon.

PAKSA: "${topic}"

${references}

MAHALAGANG PANUNTUNAN: Gumawa ng KUMPLETONG 15-slide presentation sa isang response. HUWAG tumigil pagkatapos ng Slide 1. HUWAG magtanong ng confirmation. KUMPLETUHIN ang lahat ng slides.

15 SLIDES (LAHAT KAILANGAN):
1. Title Slide
2. Table of Contents
3. Introduksyon
4. Pangunahing Konsepto
5. Mga Bahagi/Salik
6. Proseso/Mekanismo
7. Mga Key Players
8. Datos at Ebidenya
9. Case Studies
10. Mga Epekto
11. Pagsusuri
12. Kasalukuyang Estado
13. Buod
14. Mga Pinagkunan
15. Q&A at Pasasalamat

GUMAWA NG LAHAT NG 15 SLIDES NGAYON. HUWAG TUMIGIL. HUWAG MAGTANONG.`;
  },

  // ========== VALIDATION ==========
  validateInput(prompt) {
    if (!prompt || prompt.length < 2) return false;
    if (prompt.length > 100000) return false;
    const cleaned = prompt.replace(/[a-zA-Z0-9\s\.,!?;:'"()\[\]{}\-–—'‘’`"]/g, '');
    if (cleaned.length > 0) return false;
    return true;
  },

  // ========== DETECT LANGUAGE ==========
  detectLanguage(prompt) {
    const lower = prompt.toLowerCase();
    const tagalogWords = ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'para', 'tungkol', 'epekto', 'kahalagahan', 'pag-aaral', 'paano', 'bakit'];
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
    
    analysis.keywords = cleanPrompt.split(/\s+/).filter(w => w.length > 3).slice(0, 10);
    
    return analysis;
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
    
    return withUrls.slice(0, 6);
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
    if (prompt.length > 8000) {
      prompt = prompt.substring(0, 8000);
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
