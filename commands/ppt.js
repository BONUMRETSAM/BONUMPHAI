const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

const SERPAPI_KEY = '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ppt', 'powerpoint', 'presentation', 'report', 'slideshow', 'slides'],
  description: 'Generate PowerPoint presentation content with academic sources',
  usage: 'ppt [topic/title]',
  version: '3.1.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 10,

  async execute(senderId, args, token, event) {
    try {
      const prompt = args.join(' ').trim();
      
      if (!prompt) {
        await sendMessage(senderId, {
          text: 'PPT GENERATOR\n\nUsage: ppt [topic/title]\n\nExamples:\n- ppt Climate Change\n- ppt Ang Epekto ng Social Media sa mga Kabataan\n- ppt Post Harvest Practices'
        }, token);
        return;
      }
      
      const language = this.detectLanguage(prompt);
      
      await sendMessage(senderId, { text: 'Researching academic sources... Please wait.' }, token);
      
      const scholarData = await this.fetchScholarData(prompt);
      
      if (scholarData.length === 0) {
        await sendMessage(senderId, { text: 'Walang nakitang academic sources. Try ibang topic.' }, token);
        return;
      }
      
      // Kunin ang DOI para sa bawat article
      const enrichedData = await this.enrichWithDOI(scholarData);
      
      await sendMessage(senderId, { text: 'Generating presentation from academic sources... Please wait.' }, token);
      
      const presentation = await this.generatePresentation(prompt, language, enrichedData);
      
      if (presentation) {
        await this.sendChunks(senderId, presentation, token);
      } else {
        await sendMessage(senderId, { text: 'Error sa pag-generate ng presentation. Subukan muli.' }, token);
      }
      
    } catch (error) {
      console.error('[ppt] Error:', error.message);
      await sendMessage(senderId, { text: 'Error: ' + error.message }, token);
    }
  },

  detectLanguage(prompt) {
    const lower = prompt.toLowerCase();
    const tagalogWords = ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'para', 'tungkol', 'epekto', 'kahalagahan', 'pag-aaral', 'paano', 'bakit'];
    const hasTagalog = tagalogWords.some(w => lower.includes(w));
    return hasTagalog ? 'tagalog' : 'english';
  },

  async fetchScholarData(topic) {
    try {
      const cleanTopic = topic.replace(/ppt|report|about|tungkol|presentation/gi, '').trim();
      
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          engine: 'google_scholar',
          q: cleanTopic,
          api_key: SERPAPI_KEY,
          num: 10
        },
        timeout: 30000
      });
      
      const results = response.data?.organic_results || [];
      
      if (results.length === 0) return [];
      
      return results.map((paper, index) => {
        const title = paper.title || 'Untitled';
        const link = paper.link || '';
        const snippet = paper.snippet || '';
        const summary = paper.publication_info?.summary || '';
        const year = summary.match(/\b(19|20)\d{2}\b/)?.[0] || 'n.d.';
        const authors = summary.split('-')[0].trim() || 'Unknown Author';
        
        return {
          number: index + 1,
          title: title,
          authors: authors,
          year: year,
          snippet: snippet,
          link: link,
          doi: this.extractDOIFromLink(link),
          journal: summary.includes('-') ? summary.split('-')[1]?.trim() : 'Google Scholar'
        };
      });
      
    } catch (error) {
      console.error('[ppt] Scholar fetch error:', error.message);
      return [];
    }
  },

  extractDOIFromLink(link) {
    if (!link) return '';
    
    // Check for DOI in the link
    const doiMatch = link.match(/doi\.org\/([^\s]+)/i);
    if (doiMatch) {
      return `https://doi.org/${doiMatch[1]}`;
    }
    
    // Check for DOI in the URL
    const doiPattern = /(?:doi|DOI)[:\/]?\s*(10\.\d{4,9}\/[-._;()\/:A-Z0-9]+)/i;
    const doiInUrl = link.match(doiPattern);
    if (doiInUrl) {
      return `https://doi.org/${doiInUrl[1]}`;
    }
    
    return '';
  },

  async enrichWithDOI(scholarData) {
    const enriched = [];
    
    for (const data of scholarData) {
      if (!data.doi && data.title) {
        // Try to get DOI from CrossRef
        const crossrefDOI = await this.fetchDOIFromCrossRef(data.title, data.authors, data.year);
        if (crossrefDOI) {
          data.doi = crossrefDOI;
        }
      }
      enriched.push(data);
    }
    
    return enriched;
  },

  async fetchDOIFromCrossRef(title, authors, year) {
    try {
      let query = encodeURIComponent(title);
      if (authors && authors !== 'Unknown Author') {
        query += `+${encodeURIComponent(authors.split(',')[0].trim())}`;
      }
      
      const url = `https://api.crossref.org/works?query=${query}&rows=1`;
      const response = await axios.get(url, { timeout: 10000 });
      const items = response.data?.message?.items || [];
      
      if (items.length > 0 && items[0].DOI) {
        return `https://doi.org/${items[0].DOI}`;
      }
      return '';
    } catch (error) {
      return '';
    }
  },

  formatScholarData(scholarData) {
    if (!scholarData || scholarData.length === 0) return '';
    
    let formatted = '';
    for (const data of scholarData) {
      formatted += `[STUDY ${data.number}]\n`;
      formatted += `Title: ${data.title}\n`;
      formatted += `Authors: ${data.authors}\n`;
      formatted += `Year: ${data.year}\n`;
      formatted += `Journal: ${data.journal}\n`;
      formatted += `DOI: ${data.doi || 'No DOI available'}\n`;
      formatted += `Link: ${data.link}\n`;
      formatted += `Abstract: ${data.snippet.substring(0, 300)}\n\n`;
    }
    
    return formatted;
  },

  formatReferences(scholarData) {
    if (!scholarData || scholarData.length === 0) return '';
    
    return scholarData.slice(0, 5).map(data => {
      let reference = `${data.number}. ${data.authors} (${data.year}). "${data.title}." ${data.journal}.`;
      
      if (data.doi) {
        reference += ` ${data.doi}`;
      } else if (data.link) {
        reference += ` ${data.link}`;
      }
      
      return reference;
    }).join('\n');
  },

  async generatePresentation(topic, language, scholarData) {
    try {
      const scholarInfo = this.formatScholarData(scholarData);
      const formattedRefs = this.formatReferences(scholarData);
      
      let pptPrompt;
      
      if (language === 'tagalog') {
        pptPrompt = this.buildTagalogPrompt(topic, scholarInfo, formattedRefs);
      } else {
        pptPrompt = this.buildEnglishPrompt(topic, scholarInfo, formattedRefs);
      }
      
      const response = await this.callAI(pptPrompt);
      
      if (!response) return null;
      
      return this.cleanResponse(response);
      
    } catch (error) {
      console.error('[ppt] Generation error:', error.message);
      return null;
    }
  },

  buildEnglishPrompt(topic, scholarInfo, references) {
    return `You are an expert PowerPoint presentation creator.\n\n` +
      `Create a COMPLETE presentation about this topic:\n"${topic}"\n\n` +
      `Use the FOLLOWING ACADEMIC STUDIES as your source material for ALL content:\n\n${scholarInfo}\n\n` +
      `FORMAT (FOLLOW EXACTLY - Fill ALL brackets with content FROM THE STUDIES ABOVE):\n\n` +
      `SLIDE 1: TITLE SLIDE\n[REPORT TITLE based on topic]\nSubmitted by: [Your name and groupmates]\n[Subject/Course] – [Teacher's Name]\n[Date of Presentation]\n\n` +
      `---\n\n` +
      `SLIDE 2: TABLE OF CONTENTS\n01. Introduction and Objectives\n02. Main Concepts (Body Part 1)\n03. Data and Evidence (Body Part 2)\n04. Analysis and Discussion (Body Part 3)\n05. Summary and Conclusion\n06. Recommendations\n07. References\n\n` +
      `---\n\n` +
      `SLIDE 3: INTRODUCTION AND BACKGROUND\nDefinition: [Definition FROM THE STUDIES]\nWhy is it important?\n• [Reason 1 FROM STUDY]\n• [Reason 2 FROM STUDY]\n• [Reason 3 FROM STUDY]\nScope of study: [who, where, when FROM STUDIES]\n\n` +
      `---\n\n` +
      `SLIDE 4: OBJECTIVES OF THE REPORT\nBy the end of this presentation, we hope to:\n• Understand the meaning and nature of [topic]\n• Learn the main causes and effects\n• Identify real-world applications or solutions\n• Form our own perspective based on the evidence discussed\n\n` +
      `---\n\n` +
      `SLIDE 5: MAIN CONCEPT #1\n[First Major Point FROM STUDY 1]\n• Definition: [From Study 1]\n• Characteristics: [From Study 1]\n• Example: [From Study 1]\n• Key Takeaway: [Summary from Study 1]\n\n` +
      `---\n\n` +
      `SLIDE 6: MAIN CONCEPT #2\n[Second Major Point FROM STUDY 2]\n• Explanation: [From Study 2]\n• Difference from previous: [Compare Study 1 and 2]\n• Sub-categories:\n  - [From Study 2]\n  - [From Study 3]\n• Example: [From Study 2 or 3]\n\n` +
      `---\n\n` +
      `SLIDE 7: MAIN CONCEPT #3\n[Third Major Point FROM STUDY 4]\n• Process or mechanism: [From Study 4]\n• Important dates/years:\n  - [From Study 4]\n  - [From Study 5]\n• Current impact: [From Study 5]\n\n` +
      `---\n\n` +
      `SLIDE 8: DATA AND STATISTICS\n[Data from the studies]\n• [Key statistic from Study 1]\n• [Key statistic from Study 2]\n• [Key statistic from Study 3]\nInterpretation: [What these numbers mean based on studies]\nData source: Google Scholar\n\n` +
      `---\n\n` +
      `SLIDE 9: CASE STUDY / REAL EXAMPLE\nSITUATION: [Real event from Study]\nPROBLEMA: [Issue from Study]\nTUGON: [Solution from Study]\nARAL: [Lesson from Study]\n\n` +
      `---\n\n` +
      `SLIDE 10: ANALYSIS\n• What is the root cause? [From studies]\n• Who are affected? [From studies]\n• Why does this happen? [From studies]\n• Implications? [From studies]\nFinal observation: [Critical analysis from studies]\n\n` +
      `---\n\n` +
      `SLIDE 11: SUMMARY\nTOP 3 TAKEAWAYS:\n1. [From Study 1]\n2. [From Study 2]\n3. [From Study 3]\n\n` +
      `---\n\n` +
      `SLIDE 12: CONCLUSION\nIn conclusion, [topic] is [conclusion from studies].\nThis proves that [deeper meaning from studies].\nTherefore, it is important to [final message].\n\n` +
      `---\n\n` +
      `SLIDE 13: RECOMMENDATIONS\n• Short-term: [From studies]\n• Medium-term: [From studies]\n• Long-term: [From studies]\nExpected impact: [From studies]\n\n` +
      `---\n\n` +
      `SLIDE 14: REFERENCES\n[Use these EXACT references - APA 7th Edition with DOI or Link]\n${references}\n\n` +
      `---\n\n` +
      `SLIDE 15: Q&A AND THANK YOU\nTHANK YOU FOR LISTENING!\nContact: [Email address]\n[School/Organization Name]\n\n` +
      `IMPORTANT:\n` +
      `- Use ONLY information FROM THE STUDIES above\n` +
      `- DO NOT invent or make up data\n` +
      `- Fill ALL brackets with actual content from the studies\n` +
      `- Use the EXACT references provided with DOI or Link\n` +
      `- Respond in ENGLISH ONLY`;
  },

  buildTagalogPrompt(topic, scholarInfo, references) {
    return `Ikaw ay isang ekspertong tagagawa ng PowerPoint presentation.\n\n` +
      `Gumawa ng KUMPLETONG presentasyon tungkol sa paksang ito:\n"${topic}"\n\n` +
      `Gamitin ang mga SUMUSUNOD NA AKADEMIKONG PAG-AARAL bilang source material para sa LAHAT ng nilalaman:\n\n${scholarInfo}\n\n` +
      `FORMAT (SUNDIN NG EKSAKTO - Punan ang LAHAT ng brackets ng nilalaman MULA SA MGA PAG-AARAL):\n\n` +
      `SLIDE 1: TITLE SLIDE\n[PAMAGAT NG REPORT batay sa paksa]\nIsinumite nina: [Pangalan mo at mga kasama]\n[Subject/Course] – [Pangalan ng Guro]\n[Petsa ng Presentasyon]\n\n` +
      `---\n\n` +
      `SLIDE 2: TABLE OF CONTENTS\n01. Introduksyon at Layunin\n02. Pangunahing Konsepto (Body Part 1)\n03. Mga Datos at Ebidensya (Body Part 2)\n04. Pagsusuri at Diskusyon (Body Part 3)\n05. Buod at Konklusyon\n06. Rekomendasyon\n07. Mga Pinagkunan\n\n` +
      `---\n\n` +
      `SLIDE 3: INTRODUKSYON AT BACKGROUND\nKahulugan: [Depinisyon MULA SA MGA PAG-AARAL]\nBakit ito mahalaga?\n• [Dahilan 1 MULA SA PAG-AARAL]\n• [Dahilan 2 MULA SA PAG-AARAL]\n• [Dahilan 3 MULA SA PAG-AARAL]\nSaklaw ng pag-aaral: [sino, saan, kailan MULA SA MGA PAG-AARAL]\n\n` +
      `---\n\n` +
      `SLIDE 4: LAYUNIN NG REPORT\n• Maunawaan ang kahulugan at kalikasan ng [paksa]\n• Malaman ang mga pangunahing sanhi at epekto nito\n• Matukoy ang mga aplikasyon o solusyon sa totoong buhay\n• Makabuo ng sariling pananaw batay sa mga ebidensyang tinalakay\n\n` +
      `---\n\n` +
      `SLIDE 5: PANGUNAHING KONSEPTO #1\n[Unang Major Point MULA SA PAG-AARAL 1]\n• Depinisyon: [Mula sa Pag-aaral 1]\n• Katangian: [Mula sa Pag-aaral 1]\n• Halimbawa: [Mula sa Pag-aaral 1]\n• Key Takeaway: [Buod mula sa Pag-aaral 1]\n\n` +
      `---\n\n` +
      `SLIDE 6: PANGUNAHING KONSEPTO #2\n[Ikalawang Major Point MULA SA PAG-AARAL 2]\n• Ipaliwanag: [Mula sa Pag-aaral 2]\n• Pagkakaiba sa nauna: [Ihambing ang Pag-aaral 1 at 2]\n• Mga sub-kategorya:\n  - [Mula sa Pag-aaral 2]\n  - [Mula sa Pag-aaral 3]\n• Halimbawa: [Mula sa Pag-aaral 2 o 3]\n\n` +
      `---\n\n` +
      `SLIDE 7: PANGUNAHING KONSEPTO #3\n[Ikatlong Major Point MULA SA PAG-AARAL 4]\n• Proseso o mekanismo: [Mula sa Pag-aaral 4]\n• Mahahalagang petsa/taon:\n  - [Mula sa Pag-aaral 4]\n  - [Mula sa Pag-aaral 5]\n• Epekto sa kasalukuyan: [Mula sa Pag-aaral 5]\n\n` +
      `---\n\n` +
      `SLIDE 8: MGA DATOS AT ESTADISTIKA\n[Datos mula sa mga pag-aaral]\n• [Mahalagang datos mula sa Pag-aaral 1]\n• [Mahalagang datos mula sa Pag-aaral 2]\n• [Mahalagang datos mula sa Pag-aaral 3]\nInterpretasyon: [Ano ang ibig sabihin base sa mga pag-aaral]\nPinagmulan ng datos: Google Scholar\n\n` +
      `---\n\n` +
      `SLIDE 9: CASE STUDY / TUNAY NA HALIMBAWA\nSITWASYON: [Totoong pangyayari mula sa Pag-aaral]\nPROBLEMA: [Suliranin mula sa Pag-aaral]\nTUGON: [Solusyon mula sa Pag-aaral]\nARAL NA NATUTUNAN: [Aral mula sa Pag-aaral]\n\n` +
      `---\n\n` +
      `SLIDE 10: PAGSUSURI (ANALYSIS)\n• Ano ang ugat? [Mula sa mga pag-aaral]\n• Sino ang naaapektuhan? [Mula sa mga pag-aaral]\n• Bakit ito nangyayari? [Mula sa mga pag-aaral]\n• Implikasyon? [Mula sa mga pag-aaral]\nPinal na obserbasyon: [Kritikal na pagsusuri mula sa mga pag-aaral]\n\n` +
      `---\n\n` +
      `SLIDE 11: BUOD (SUMMARY)\nTOP 3 TAKEAWAYS:\n1. [Mula sa Pag-aaral 1]\n2. [Mula sa Pag-aaral 2]\n3. [Mula sa Pag-aaral 3]\n\n` +
      `---\n\n` +
      `SLIDE 12: KONKLUSYON\nSa kabuuan, ang [paksa] ay [konklusyon mula sa mga pag-aaral].\nIto ay nagpapatunay na [mas malalim na kahulugan mula sa mga pag-aaral].\nKung kaya, mahalagang [panghuling mensahe].\n\n` +
      `---\n\n` +
      `SLIDE 13: REKOMENDASYON\n• Panandalian: [Mula sa mga pag-aaral]\n• Katamtaman: [Mula sa mga pag-aaral]\n• Pangmatagalan: [Mula sa mga pag-aaral]\nInaasahang epekto: [Mula sa mga pag-aaral]\n\n` +
      `---\n\n` +
      `SLIDE 14: MGA PINAGKUNAN (REFERENCES)\n[Gamitin ang mga EKSATONG references na ito - APA 7th Edition na may DOI o Link]\n${references}\n\n` +
      `---\n\n` +
      `SLIDE 15: Q&A AT PASASALAMAT\nMARAMING SALAMAT SA INYONG PAKIKINIG!\nKontak: [Email address]\n[Pangalan ng Paaralan/Organisasyon]\n\n` +
      `MAHALAGA:\n` +
      `- Gamitin LAMANG ang impormasyon MULA SA MGA PAG-AARAL sa itaas\n` +
      `- HUWAG gumawa o mag-imbento ng datos\n` +
      `- Punan ang LAHAT ng brackets ng aktwal na nilalaman mula sa mga pag-aaral\n` +
      `- Gamitin ang EKSATONG references na binigay na may DOI o Link\n` +
      `- Tumugon sa TAGALOG LAMANG`;
  },

  async callAI(prompt) {
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
      return await this.executeAPI(primary, prompt);
    } catch (primaryError) {
      console.log('[ppt] Primary API failed, trying fallback...');
      try {
        return await this.executeAPI(fallback, prompt);
      } catch (fallbackError) {
        console.error('[ppt] Fallback also failed:', fallbackError.message);
        return null;
      }
    }
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
      .trim();
    
    return cleaned;
  },

  splitMessage(text) {
    const chunks = [];
    const MAX_CHUNK = 1900;
    for (let i = 0; i < text.length; i += MAX_CHUNK) {
      chunks.push(text.slice(i, i + MAX_CHUNK));
    }
    return chunks;
  },

  async sendChunks(senderId, text, token) {
    const chunks = this.splitMessage(text);
    for (const chunk of chunks) {
      await sendMessage(senderId, { text: chunk }, token);
    }
  }
};
