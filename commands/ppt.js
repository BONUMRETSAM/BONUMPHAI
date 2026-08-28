const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

const SERPAPI_KEY = '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ppt', 'powerpoint', 'presentation', 'report', 'slideshow', 'slides'],
  description: 'Generate PowerPoint presentation content with academic sources',
  usage: 'ppt [topic/title]',
  version: '4.0.0',
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
      
      await sendMessage(senderId, { text: 'Researching an academic sources... Please wait.' }, token);
      
      // Kumuha ng 10 articles mula sa Google Scholar
      const scholarData = await this.fetchScholarData(prompt);
      
      if (scholarData.length === 0) {
        await sendMessage(senderId, { text: 'Walang nakitang academic sources. Try ibang topic.' }, token);
        return;
      }
      
      // Kunin ang DOI para sa bawat article
      const enrichedData = await this.enrichWithDOI(scholarData);
      
      await sendMessage(senderId, { text: 'Creating a powerpoint presentation... Please wait.' }, token);
      
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
    const doiMatch = link.match(/doi\.org\/([^\s]+)/i);
    if (doiMatch) return `https://doi.org/${doiMatch[1]}`;
    return '';
  },

  async enrichWithDOI(scholarData) {
    const enriched = [];
    for (const data of scholarData) {
      if (!data.doi && data.title) {
        const crossrefDOI = await this.fetchDOIFromCrossRef(data.title, data.authors, data.year);
        if (crossrefDOI) data.doi = crossrefDOI;
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
      if (items.length > 0 && items[0].DOI) return `https://doi.org/${items[0].DOI}`;
      return '';
    } catch (error) {
      return '';
    }
  },

  formatScholarData(scholarData) {
    if (!scholarData || scholarData.length === 0) return '';
    
    let formatted = '';
    for (const data of scholarData) {
      formatted += `STUDY ${data.number}:\n`;
      formatted += `TITLE: ${data.title}\n`;
      formatted += `AUTHORS: ${data.authors}\n`;
      formatted += `YEAR: ${data.year}\n`;
      formatted += `JOURNAL: ${data.journal}\n`;
      formatted += `DOI: ${data.doi || 'No DOI'}\n`;
      formatted += `LINK: ${data.link}\n`;
      formatted += `ABSTRACT: ${data.snippet.substring(0, 500)}\n\n`;
    }
    return formatted;
  },

  formatReferences(scholarData) {
    if (!scholarData || scholarData.length === 0) return '';
    
    return scholarData.slice(0, 5).map(data => {
      let reference = `${data.number}. ${data.authors} (${data.year}). "${data.title}." ${data.journal}.`;
      if (data.doi) reference += ` ${data.doi}`;
      else if (data.link) reference += ` ${data.link}`;
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
    return `You are an expert academic presentation creator.\n\n` +
      `TOPIC: "${topic}"\n\n` +
      `BELOW ARE THE ACADEMIC STUDIES FROM GOOGLE SCHOLAR. USE THESE AS YOUR ONLY SOURCE OF INFORMATION FOR ALL CONTENT:\n\n${scholarInfo}\n\n` +
      `CREATE A PRESENTATION USING THE FOLLOWING STRUCTURE. FILL EACH SECTION WITH CONTENT DERIVED FROM THE STUDIES ABOVE:\n\n` +
      `SLIDE 1: TITLE SLIDE\n[Create an appropriate title based on the topic and studies]\nSubmitted by: [Name placeholder]\n[Course placeholder]\n[Date placeholder]\n\n` +
      `SLIDE 2: TABLE OF CONTENTS\n01. Introduction and Objectives\n02. Main Concepts\n03. Data and Evidence\n04. Analysis and Discussion\n05. Summary and Conclusion\n06. Recommendations\n07. References\n\n` +
      `SLIDE 3: INTRODUCTION AND BACKGROUND\nDefinition: [Write the definition based on the studies]\nWhy is it important:\n- [Importance from Study 1]\n- [Importance from Study 2]\n- [Importance from Study 3]\nScope: [Describe the scope based on the studies]\n\n` +
      `SLIDE 4: OBJECTIVES\n- [Objective 1 based on studies]\n- [Objective 2 based on studies]\n- [Objective 3 based on studies]\n- [Objective 4 based on studies]\n\n` +
      `SLIDE 5: MAIN CONCEPT 1\n[First major concept title from Study 1]\n- Definition: [From Study 1]\n- Key points: [From Study 1]\n- Example: [From Study 1]\n- Takeaway: [From Study 1]\n\n` +
      `SLIDE 6: MAIN CONCEPT 2\n[Second major concept title from Study 2]\n- Explanation: [From Study 2]\n- Comparison: [Compare Study 1 and 2]\n- Sub-points: [From Studies 2 and 3]\n- Example: [From Study 2 or 3]\n\n` +
      `SLIDE 7: MAIN CONCEPT 3\n[Third major concept title from Study 4]\n- Process: [From Study 4]\n- Timeline: [From Studies 4 and 5]\n- Current impact: [From Study 5]\n\n` +
      `SLIDE 8: DATA AND STATISTICS\n- [Statistic from Study 1]\n- [Statistic from Study 2]\n- [Statistic from Study 3]\nInterpretation: [What these mean based on studies]\nSource: Google Scholar\n\n` +
      `SLIDE 9: CASE STUDY\nSITUATION: [Real case from a study]\nPROBLEM: [The issue]\nRESPONSE: [How it was addressed]\nLESSON: [What we learn]\n\n` +
      `SLIDE 10: ANALYSIS\n- Root cause: [From studies]\n- Stakeholders: [From studies]\n- Why it happens: [From studies]\n- Implications: [From studies]\nFinal observation: [Based on studies]\n\n` +
      `SLIDE 11: SUMMARY\nTOP 3 TAKEAWAYS:\n1. [From Study 1]\n2. [From Study 2]\n3. [From Study 3]\n\n` +
      `SLIDE 12: CONCLUSION\n[Conclusion based on the studies]\n[Key insight from the studies]\n[Final message]\n\n` +
      `SLIDE 13: RECOMMENDATIONS\n- Short-term: [Based on studies]\n- Medium-term: [Based on studies]\n- Long-term: [Based on studies]\nExpected impact: [Based on studies]\n\n` +
      `SLIDE 14: REFERENCES\n${references}\n\n` +
      `SLIDE 15: Q&A AND THANK YOU\nTHANK YOU FOR LISTENING!\nContact: [Email placeholder]\n[School placeholder]\n\n` +
      `CRITICAL RULES:\n` +
      `- USE ONLY INFORMATION FROM THE STUDIES ABOVE\n` +
      `- DO NOT INVENT OR FABRICATE ANY DATA\n` +
      `- EVERY SLIDE CONTENT MUST BE DERIVED FROM THE STUDIES\n` +
      `- USE PLAIN TEXT ONLY (NO BOLD, NO ITALICS, NO MARKDOWN)\n` +
      `- DO NOT USE **, ##, ###, or ---\n` +
      `- Respond in ENGLISH ONLY`;
  },

  buildTagalogPrompt(topic, scholarInfo, references) {
    return `Ikaw ay isang ekspertong tagagawa ng akademikong presentasyon.\n\n` +
      `PAKSA: "${topic}"\n\n` +
      `NASA BABA ANG MGA AKADEMIKONG PAG-AARAL MULA SA GOOGLE SCHOLAR. GAMITIN ITO BILANG TANGING SOURCE NG IMPORMASYON PARA SA LAHAT NG NILALAMAN:\n\n${scholarInfo}\n\n` +
      `GUMAWA NG PRESENTASYON GAMIT ANG SUMUSUNOD NA ESTRUKTURA. PUNAN ANG BAWAT BAHAGI NG NILALAMAN MULA SA MGA PAG-AARAL SA ITAAS:\n\n` +
      `SLIDE 1: TITLE SLIDE\n[Gumawa ng angkop na pamagat batay sa paksa at mga pag-aaral]\nIsinumite nina: [Pangalan placeholder]\n[Course placeholder]\n[Petsa placeholder]\n\n` +
      `SLIDE 2: TABLE OF CONTENTS\n01. Introduksyon at Layunin\n02. Pangunahing Konsepto\n03. Mga Datos at Ebidensya\n04. Pagsusuri at Diskusyon\n05. Buod at Konklusyon\n06. Rekomendasyon\n07. Mga Pinagkunan\n\n` +
      `SLIDE 3: INTRODUKSYON AT BACKGROUND\nKahulugan: [Isulat ang depinisyon batay sa mga pag-aaral]\nBakit mahalaga:\n- [Kahalagahan mula sa Pag-aaral 1]\n- [Kahalagahan mula sa Pag-aaral 2]\n- [Kahalagahan mula sa Pag-aaral 3]\nSaklaw: [Ilarawan ang saklaw batay sa mga pag-aaral]\n\n` +
      `SLIDE 4: LAYUNIN\n- [Layunin 1 batay sa mga pag-aaral]\n- [Layunin 2 batay sa mga pag-aaral]\n- [Layunin 3 batay sa mga pag-aaral]\n- [Layunin 4 batay sa mga pag-aaral]\n\n` +
      `SLIDE 5: PANGUNAHING KONSEPTO 1\n[Unang pangunahing konsepto mula sa Pag-aaral 1]\n- Depinisyon: [Mula sa Pag-aaral 1]\n- Mahahalagang punto: [Mula sa Pag-aaral 1]\n- Halimbawa: [Mula sa Pag-aaral 1]\n- Takeaway: [Mula sa Pag-aaral 1]\n\n` +
      `SLIDE 6: PANGUNAHING KONSEPTO 2\n[Ikalawang pangunahing konsepto mula sa Pag-aaral 2]\n- Paliwanag: [Mula sa Pag-aaral 2]\n- Paghahambing: [Ihambing ang Pag-aaral 1 at 2]\n- Sub-punto: [Mula sa Pag-aaral 2 at 3]\n- Halimbawa: [Mula sa Pag-aaral 2 o 3]\n\n` +
      `SLIDE 7: PANGUNAHING KONSEPTO 3\n[Ikatlong pangunahing konsepto mula sa Pag-aaral 4]\n- Proseso: [Mula sa Pag-aaral 4]\n- Timeline: [Mula sa Pag-aaral 4 at 5]\n- Epekto: [Mula sa Pag-aaral 5]\n\n` +
      `SLIDE 8: MGA DATOS AT ESTADISTIKA\n- [Datos mula sa Pag-aaral 1]\n- [Datos mula sa Pag-aaral 2]\n- [Datos mula sa Pag-aaral 3]\nInterpretasyon: [Ano ang ibig sabihin batay sa mga pag-aaral]\nPinagmulan: Google Scholar\n\n` +
      `SLIDE 9: CASE STUDY\nSITWASYON: [Totoong kaso mula sa isang pag-aaral]\nPROBLEMA: [Ang isyu]\nTUGON: [Paano ito hinarap]\nARAL: [Ano ang natutunan]\n\n` +
      `SLIDE 10: PAGSUSURI\n- Ugat: [Mula sa mga pag-aaral]\n- Apektado: [Mula sa mga pag-aaral]\n- Bakit: [Mula sa mga pag-aaral]\n- Implikasyon: [Mula sa mga pag-aaral]\nPinal na obserbasyon: [Batay sa mga pag-aaral]\n\n` +
      `SLIDE 11: BUOD\nTOP 3 TAKEAWAYS:\n1. [Mula sa Pag-aaral 1]\n2. [Mula sa Pag-aaral 2]\n3. [Mula sa Pag-aaral 3]\n\n` +
      `SLIDE 12: KONKLUSYON\n[Konklusyon batay sa mga pag-aaral]\n[Pangunahing insight mula sa mga pag-aaral]\n[Panghuling mensahe]\n\n` +
      `SLIDE 13: REKOMENDASYON\n- Panandalian: [Batay sa mga pag-aaral]\n- Katamtaman: [Batay sa mga pag-aaral]\n- Pangmatagalan: [Batay sa mga pag-aaral]\nInaasahang epekto: [Batay sa mga pag-aaral]\n\n` +
      `SLIDE 14: MGA PINAGKUNAN\n${references}\n\n` +
      `SLIDE 15: Q&A AT PASASALAMAT\nMARAMING SALAMAT SA INYONG PAKIKINIG!\nKontak: [Email placeholder]\n[Paaralan placeholder]\n\n` +
      `KRITIKAL NA PANUNTUNAN:\n` +
      `- GAMITIN LAMANG ANG IMPORMASYON MULA SA MGA PAG-AARAL SA ITAAS\n` +
      `- HUWAG MAG-IMBENTO O GUMAWA NG DATOS\n` +
      `- BAWAT NILALAMAN NG SLIDE AY DAPAT MULA SA MGA PAG-AARAL\n` +
      `- GUMAMIT NG PLAIN TEXT LAMANG (WALANG BOLD, WALANG ITALICS, WALANG MARKDOWN)\n` +
      `- HUWAG GUMAMIT NG **, ##, ###, o ---\n` +
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
      .replace(/^If you want.*?proceed\?/is, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/#{1,6}\s*/g, '')
      .replace(/---+/g, '')
      .replace(/```/g, '')
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
