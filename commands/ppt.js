const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

const SERPAPI_KEY = process.env.SERPAPI_KEY || '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ppt', 'powerpoint', 'presentation', 'slideshow', 'slides'],
  description: 'Generate PowerPoint presentation with accurate academic references',
  usage: 'ppt [topic/title/details]',
  version: '29.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 20,

  async execute(senderId, args, token, event) {
    try {
      const fullPrompt = args.join(' ').trim();
      
      if (!fullPrompt) {
        await sendMessage(senderId, {
          text: 'PPT GENERATOR\n\nUsage: ppt [topic]\n\nExamples:\n• ppt Climate Change\n• ppt Integrated Pest Management\n• ppt Susceptibility'
        }, token);
        return;
      }
      
      const searchTopic = this.extractCoreTopic(fullPrompt);
      const language = this.detectLanguage(fullPrompt);
      
      console.log(`[PPT] Search topic: "${searchTopic}"`);
      console.log(`[PPT] Language: ${language}`);
      
      await sendMessage(senderId, { 
        text: `Creating presentation about: "${searchTopic}"\nGenerating all 15 slides...` 
      }, token);
      
      // Get references
      let references = await this.getReferences(searchTopic);
      
      if (!references || references.length === 0) {
        references = this.getFallbackReferences(searchTopic);
      }
      
      references = references.slice(0, 5);
      
      console.log(`[PPT] Using ${references.length} references`);
      
      // Generate COMPLETE presentation with FORCED content
      const presentation = await this.generateForcedPresentation(
        searchTopic,
        references,
        language
      );
      
      if (presentation) {
        await this.sendChunks(senderId, presentation, token);
      } else {
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

  // ============================================
  // FORCED PRESENTATION (COMPLETE)
  // ============================================
  async generateForcedPresentation(topic, references, language) {
    try {
      const formattedRefs = this.formatReferences(references);
      
      let prompt;
      if (language === 'tagalog') {
        prompt = this.buildForcedTagalogPrompt(topic, formattedRefs);
      } else {
        prompt = this.buildForcedEnglishPrompt(topic, formattedRefs);
      }
      
      if (prompt.length > 8000) {
        prompt = prompt.substring(0, 8000);
      }
      
      const response = await this.callAI(prompt);
      
      if (!response) {
        return this.generateCompleteFallback(topic, references, language);
      }
      
      const cleaned = this.cleanResponse(response);
      
      // Check for completeness
      const slideCount = (cleaned.match(/SLIDE \d+/gi) || []).length;
      console.log(`[PPT] Generated ${slideCount} slides`);
      
      // If incomplete, complete it
      if (slideCount < 13 || cleaned.includes('[Provide') || cleaned.includes('[Explain') || 
          cleaned.includes('[Key point') || cleaned.includes('[Insert') || cleaned.includes('[Add')) {
        console.log('[PPT] Incomplete or has placeholders, completing...');
        return this.completePresentation(cleaned, topic, references, language);
      }
      
      // Ensure references are included
      if (!cleaned.includes('REFERENCES') && !cleaned.includes('References')) {
        return cleaned + '\n\n' + formattedRefs;
      }
      
      return cleaned;
      
    } catch (error) {
      console.error('[generateForcedPresentation] Error:', error.message);
      return this.generateCompleteFallback(topic, references, language);
    }
  },

  // ============================================
  // FORCED ENGLISH PROMPT (COMPLETE)
  // ============================================
  buildForcedEnglishPrompt(topic, references) {
    return `You are an expert academic presentation creator. Create a COMPLETE, DETAILED 15-slide presentation about: "${topic}"

CRITICAL INSTRUCTIONS - YOU MUST FOLLOW:
1. FILL ALL SLIDES with detailed content
2. DO NOT leave any brackets [ ] empty
3. EVERY slide must have substantial content (at least 3-5 sentences)
4. Provide REAL examples and data with sources
5. Use the references provided
6. Respond in ENGLISH only
7. Plain text only - NO MARKDOWN

${references}

CREATE ALL 15 SLIDES WITH DETAILED CONTENT:

SLIDE 1: TITLE SLIDE
[Create a specific, descriptive title based on the topic - 1 line]
[Subtitle if applicable - 1 line]
Submitted by: [Student Name]
[Course/Subject]
[Date]

SLIDE 2: TABLE OF CONTENTS
[Create 10-12 sections based on the topic]
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
Definition: [Provide a COMPREHENSIVE definition - at least 3 sentences]
Background/History: [Relevant historical context - at least 3 sentences]
Why This Matters: [3-4 reasons with detailed explanations - each at least 2 sentences]

SLIDE 4: KEY CONCEPTS AND DEFINITIONS
[Identify and explain 3-5 key concepts]
Concept 1: [Name] - [Detailed explanation - at least 3 sentences]
Concept 2: [Name] - [Detailed explanation - at least 3 sentences]
Concept 3: [Name] - [Detailed explanation - at least 3 sentences]
[Add more if needed]

SLIDE 5: MAIN COMPONENTS/FACTORS
[Break down the topic into 3-4 main components]
Component 1: [Name] - [Detailed explanation with examples - at least 3 sentences]
Component 2: [Name] - [Detailed explanation with examples - at least 3 sentences]
Component 3: [Name] - [Detailed explanation with examples - at least 3 sentences]

SLIDE 6: PROCESS/MECHANISM
[Explain how this topic works - at least 5 sentences]
Step 1: [Detailed explanation]
Step 2: [Detailed explanation]
Step 3: [Detailed explanation]
Step 4: [Detailed explanation]

SLIDE 7: KEY PLAYERS/STAKEHOLDERS
[Identify who is involved - at least 3 groups]
[Group 1]: [Role and significance - at least 2 sentences]
[Group 2]: [Role and significance - at least 2 sentences]
[Group 3]: [Role and significance - at least 2 sentences]

SLIDE 8: DATA, STATISTICS, AND EVIDENCE
[Provide 3-5 key data points with sources]
1. [Data point - with source citation]
2. [Data point - with source citation]
3. [Data point - with source citation]
Interpretation: [What this data reveals - at least 3 sentences]

SLIDE 9: CASE STUDIES AND REAL-WORLD EXAMPLES
[Provide 2-3 concrete examples]
Example 1: [Situation] - [What happened] - [Outcome/Lesson - at least 2 sentences]
Example 2: [Situation] - [What happened] - [Outcome/Lesson - at least 2 sentences]

SLIDE 10: IMPACTS AND EFFECTS
[Analyze impacts - at least 5 sentences]
Positive Impacts:
- [Impact 1 - at least 2 sentences]
- [Impact 2 - at least 2 sentences]
Negative Impacts/Challenges:
- [Challenge 1 - at least 2 sentences]
- [Challenge 2 - at least 2 sentences]

SLIDE 11: ANALYSIS AND DISCUSSION
[Deep analysis - at least 5 sentences]
- [Key insight 1 with detailed explanation]
- [Key insight 2 with detailed explanation]
- [Key insight 3 with detailed explanation]

SLIDE 12: CURRENT STATUS AND FUTURE TRENDS
[What is happening now? - at least 5 sentences]
Current Status:
- [Situation 1 - at least 2 sentences]
- [Situation 2 - at least 2 sentences]
Future Trends:
- [Trend 1 - at least 2 sentences]
- [Trend 2 - at least 2 sentences]

SLIDE 13: SUMMARY AND KEY TAKEAWAYS
TOP 5 KEY TAKEAWAYS:
1. [Key takeaway 1 - at least 2 sentences]
2. [Key takeaway 2 - at least 2 sentences]
3. [Key takeaway 3 - at least 2 sentences]
4. [Key takeaway 4 - at least 2 sentences]
5. [Key takeaway 5 - at least 2 sentences]

SLIDE 14: REFERENCES
${references}

SLIDE 15: Q&A AND THANK YOU
Thank you for listening!
Questions and discussion are welcome.

START NOW - FILL ALL SLIDES WITH DETAILED CONTENT:`;
  },

  // ============================================
  // FORCED TAGALOG PROMPT
  // ============================================
  buildForcedTagalogPrompt(topic, references) {
    return `Ikaw ay isang ekspertong tagagawa ng presentasyon. Gumawa ng KUMPLETO at DETALYADONG 15-slide presentation tungkol sa: "${topic}"

MAHALAGANG PANUNTUNAN - DAPAT SUNDIN:
1. PUNUAN ANG LAHAT NG SLIDES ng detalyadong nilalaman
2. HUWAG mag-iwan ng mga bracket [ ] na walang laman
3. BAWAT slide ay dapat may substantial na nilalaman (hindi bababa sa 3-5 pangungusap)
4. Magbigay ng TUNAY na mga halimbawa at datos na may sources
5. Gamitin ang mga reference sa itaas
6. Tumugon sa TAGALOG lamang
7. Plain text lamang - WALANG MARKDOWN

${references}

GUMAWA NG LAHAT NG 15 SLIDES NA MAY DETALYADONG NILALAMAN:

SLIDE 1: TITLE SLIDE
[Gumawa ng specific na pamagat - 1 linya]
[Subtitle kung applicable - 1 linya]
Isinumite nina: [Pangalan]
[Course/Subject]
[Petsa]

SLIDE 2: TABLE OF CONTENTS
[Gumawa ng 10-12 seksyon]
01. Introduksyon
02. Pangunahing Konsepto
03. Mga Bahagi/Salik
04. Proseso/Mekanismo
05. Mga Key Players
06. Datos at Ebidenya
07. Case Studies
08. Mga Epekto
09. Pagsusuri
10. Kasalukuyang Estado
11. Buod
12. Konklusyon
13. Rekomendasyon
14. Mga Pinagkunan
15. Q&A

SLIDE 3: INTRODUKSYON
Kahulugan: [Komprehensibong kahulugan - hindi bababa sa 3 pangungusap]
Kasaysayan: [Konteksto - hindi bababa sa 3 pangungusap]
Bakit Mahalaga: [3-4 dahilan - bawat isa ay hindi bababa sa 2 pangungusap]

SLIDE 4: PANGUNAHING KONSEPTO
[Tukuyin ang 3-5 konsepto]
Konsepto 1: [Pangalan] - [Detalyadong paliwanag - hindi bababa sa 3 pangungusap]
Konsepto 2: [Pangalan] - [Detalyadong paliwanag - hindi bababa sa 3 pangungusap]
Konsepto 3: [Pangalan] - [Detalyadong paliwanag - hindi bababa sa 3 pangungusap]

SLIDE 5: MGA BAHAGI/SALIK
[Hatiin ang paksa sa 3-4 na bahagi]
Bahagi 1: [Pangalan] - [Detalyadong paliwanag - hindi bababa sa 3 pangungusap]
Bahagi 2: [Pangalan] - [Detalyadong paliwanag - hindi bababa sa 3 pangungusap]
Bahagi 3: [Pangalan] - [Detalyadong paliwanag - hindi bababa sa 3 pangungusap]

SLIDE 6: PROSESO O MEKANISMO
[Ipaliwanag kung paano gumagana - hindi bababa sa 5 pangungusap]
Hakbang 1: [Detalyadong paliwanag]
Hakbang 2: [Detalyadong paliwanag]
Hakbang 3: [Detalyadong paliwanag]

SLIDE 7: MGA KEY PLAYERS
[Tukuyin ang mga kasali - hindi bababa sa 3 grupo]
[Grupo 1]: [Tungkulin - hindi bababa sa 2 pangungusap]
[Grupo 2]: [Tungkulin - hindi bababa sa 2 pangungusap]
[Grupo 3]: [Tungkulin - hindi bababa sa 2 pangungusap]

SLIDE 8: DATOS AT EBIDENYA
[Magbigay ng 3-5 datos na may sources]
1. [Datos - na may source]
2. [Datos - na may source]
3. [Datos - na may source]
Interpretasyon: [Ano ang ipinapakita - hindi bababa sa 3 pangungusap]

SLIDE 9: CASE STUDIES
[Magbigay ng 2-3 halimbawa]
Halimbawa 1: [Sitwasyon] - [Nangyari] - [Resulta/Aral - hindi bababa sa 2 pangungusap]
Halimbawa 2: [Sitwasyon] - [Nangyari] - [Resulta/Aral - hindi bababa sa 2 pangungusap]

SLIDE 10: MGA EPEKTO
[Suriin ang mga epekto - hindi bababa sa 5 pangungusap]
Positibong Epekto:
- [Epekto 1 - hindi bababa sa 2 pangungusap]
- [Epekto 2 - hindi bababa sa 2 pangungusap]
Negatibong Epekto:
- [Epekto 1 - hindi bababa sa 2 pangungusap]
- [Epekto 2 - hindi bababa sa 2 pangungusap]

SLIDE 11: PAGSUSURI
[Malalim na pagsusuri - hindi bababa sa 5 pangungusap]
- [Insight 1 - detalyadong paliwanag]
- [Insight 2 - detalyadong paliwanag]
- [Insight 3 - detalyadong paliwanag]

SLIDE 12: KASALUKUYANG ESTADO
[Ano ang nangyayari ngayon? - hindi bababa sa 5 pangungusap]
Kasalukuyan:
- [Sitwasyon 1 - hindi bababa sa 2 pangungusap]
- [Sitwasyon 2 - hindi bababa sa 2 pangungusap]
Hinaharap:
- [Trend 1 - hindi bababa sa 2 pangungusap]
- [Trend 2 - hindi bababa sa 2 pangungusap]

SLIDE 13: BUOD
TOP 5 KEY TAKEAWAYS:
1. [Punto 1 - hindi bababa sa 2 pangungusap]
2. [Punto 2 - hindi bababa sa 2 pangungusap]
3. [Punto 3 - hindi bababa sa 2 pangungusap]
4. [Punto 4 - hindi bababa sa 2 pangungusap]
5. [Punto 5 - hindi bababa sa 2 pangungusap]

SLIDE 14: MGA PINAGKUNAN
${references}

SLIDE 15: Q&A AT PASASALAMAT
Maraming salamat sa pakikinig!

MAGSIMULA NA - PUNUAN ANG LAHAT NG SLIDES:`;
  },

  // ============================================
  // COMPLETE FALLBACK
  // ============================================
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
Kahulugan: ${topic} ay isang mahalagang paksa.
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
Definition: ${topic} is an important topic.
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

  // ============================================
  // COMPLETE PRESENTATION (Fix blanks)
  // ============================================
  completePresentation(partial, topic, references, language) {
    const formattedRefs = this.formatReferences(references);
    const existingSlides = (partial.match(/SLIDE \d+/gi) || []).length;
    
    if (existingSlides >= 13) {
      return partial + '\n\n' + formattedRefs;
    }
    
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
    
    if (!partial.includes('REFERENCES') && !partial.includes('References')) {
      missing += `\n${formattedRefs}`;
    }
    
    return partial + '\n' + missing;
  },

  // ============================================
  // GET SLIDE TITLES
  // ============================================
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

  // ============================================
  // GET REFERENCES
  // ============================================
  async getReferences(topic) {
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

  // ============================================
  // GOOGLE SCHOLAR
  // ============================================
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

  // ============================================
  // CROSSREF
  // ============================================
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

  // ============================================
  // FALLBACK REFERENCES
  // ============================================
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

  // ============================================
  // FORMAT REFERENCES
  // ============================================
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

  // ============================================
  // REMOVE DUPLICATES
  // ============================================
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

  // ============================================
  // EXTRACT CORE TOPIC
  // ============================================
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

  // ============================================
  // DETECT LANGUAGE
  // ============================================
  detectLanguage(prompt) {
    const lower = prompt.toLowerCase();
    const tagalogWords = ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'para', 'tungkol', 'epekto', 'kahalagahan', 'pag-aaral', 'paano', 'bakit'];
    const hasTagalog = tagalogWords.some(w => lower.includes(w));
    return hasTagalog ? 'tagalog' : 'english';
  },

  // ============================================
  // AI API CALLS
  // ============================================
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

  // ============================================
  // CLEAN RESPONSE
  // ============================================
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

  // ============================================
  // SEND CHUNKS
  // ============================================
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
        text: 'No content generated. Please try again.' 
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
