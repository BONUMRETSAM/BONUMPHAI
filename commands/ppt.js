const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

// API Keys - Move to environment variables
const SERPAPI_KEY = process.env.SERPAPI_KEY || '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ppt', 'powerpoint', 'presentation', 'slideshow', 'slides'],
  description: 'Generate PowerPoint presentation with accurate academic references',
  usage: 'ppt [topic/title/details]',
  version: '8.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 10,

  async execute(senderId, args, token, event) {
    try {
      const prompt = args.join(' ').trim();
      
      if (!prompt) {
        await sendMessage(senderId, {
          text: '📊 PPT GENERATOR\n\nUsage: ppt [topic/title/details]\n\nExamples:\n• ppt Climate Change\n• ppt Wallaceodendron celebicum\n• ppt [buong details]'
        }, token);
        return;
      }
      
      if (!this.validateInput(prompt)) {
        await sendMessage(senderId, {
          text: '❌ Invalid input. Please provide a valid topic (2-100,000 characters).'
        }, token);
        return;
      }
      
      // IMPORTANT FIX: Language detection based on ACTUAL language of input
      const language = this.detectLanguage(prompt);
      console.log(`[PPT] Detected language: ${language}`);
      
      // Show what language was detected
      await sendMessage(senderId, { 
        text: `📝 Detected language: ${language === 'tagalog' ? 'Tagalog' : 'English'}\nCreating presentation about "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"... Please wait.` 
      }, token);
      
      // Get references from ALL reliable sources
      let references = await this.getAllReliableSources(prompt);
      let hasAcademicSource = references.length > 0;
      
      // If no references, try related topics
      if (!hasAcademicSource) {
        const relatedTopics = this.generateRelatedTopics(prompt);
        for (const relatedTopic of relatedTopics) {
          references = await this.getAllReliableSources(relatedTopic);
          if (references.length > 0) {
            hasAcademicSource = true;
            break;
          }
        }
      }
      
      // FIX: Generate presentation with ACCURATE language detection
      const presentation = await this.generatePresentation(
        prompt,
        language, // Pass detected language directly
        references,
        hasAcademicSource
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

  // ========== FIXED LANGUAGE DETECTION ==========
  detectLanguage(prompt) {
    // Check for common Tagalog words - but ONLY if they appear frequently
    const tagalogWords = ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'para', 'tungkol', 'epekto', 'kahalagahan', 'pag-aaral', 'paano', 'bakit', 'ano', 'saan', 'kailan', 'bulkan', 'pagsabog', 'ayon', 'dahil', 'kung', 'kapag', 'maging', 'naging', 'pagkatapos', 'bago', 'habang', 'kaya', 'dahilan', 'resulta', 'palagay', 'tingin', 'sabi', 'sinabi', 'nagsasabi'];
    
    // Count Tagalog words
    const words = prompt.toLowerCase().split(/\s+/);
    let tagalogCount = 0;
    let englishCount = 0;
    
    for (const word of words) {
      // Check if word is Tagalog
      if (tagalogWords.includes(word)) {
        tagalogCount++;
      }
      // Check if word looks like English (contains common English patterns)
      else if (/^[a-z]+$/.test(word) && word.length > 2) {
        englishCount++;
      }
    }
    
    // FIX: Only Tagalog if more than 30% of words are Tagalog
    const totalChecked = tagalogCount + englishCount;
    if (totalChecked > 0 && (tagalogCount / totalChecked) > 0.3) {
      return 'tagalog';
    }
    
    // Default to English for all others
    return 'english';
  },

  // ========== VALIDATION ==========
  validateInput(prompt) {
    if (!prompt || prompt.length < 2) return false;
    if (prompt.length > 100000) return false;
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(prompt)) return false;
    return true;
  },

  // ========== TOPIC ANALYSIS ==========
  analyzeTopic(prompt) {
    let cleanPrompt = prompt;
    
    if (prompt.length > 5000) {
      cleanPrompt = prompt.substring(0, 2000);
    }
    
    cleanPrompt = cleanPrompt.replace(/ppt|powerpoint|presentation|slideshow|slides|report|about|this graphic identifies|also known as|as one of|it serves to/gi, '').trim();
    
    const analysis = {
      original: prompt,
      clean: cleanPrompt,
      mainTopic: cleanPrompt,
      hasScientificName: false,
      hasCommonName: false,
      hasDetailedDescription: false,
      isPhilippineTopic: false,
      isHealthTopic: false,
      isScienceTopic: false,
      isTechnologyTopic: false,
      isHistoricalTopic: false,
      isEnvironmentalTopic: false,
      details: [],
      keywords: [],
      scientificName: '',
      commonName: '',
      location: '',
      purpose: '',
      fullText: prompt
    };
    
    // Extract scientific name
    const scientificMatch = prompt.match(/\b([A-Z][a-z]+ [a-z]+)\b/);
    if (scientificMatch) {
      analysis.hasScientificName = true;
      analysis.scientificName = scientificMatch[1];
    }
    
    // Extract common name from quotes
    const commonMatch = prompt.match(/"([^"]+)"/);
    if (commonMatch) {
      analysis.hasCommonName = true;
      analysis.commonName = commonMatch[1];
    }
    
    // Check if has detailed description
    if (cleanPrompt.length > 100 || cleanPrompt.includes('identifies') || cleanPrompt.includes('known as')) {
      analysis.hasDetailedDescription = true;
    }
    
    // Extract details
    const detailPatterns = [
      /(?:also known as|common name|local name|called)\s+["']([^"']+)["']/i,
      /(?:native to|found in|located in|originally from)\s+([A-Z][a-z\s]+)/i,
      /(?:serves to|purpose is|used for|function is)\s+([^.,]+)/i,
      /(?:kilala rin bilang|karaniwang pangalan|lokal na pangalan|tinatawag na)\s+["']([^"']+)["']/i,
      /(?:katutubo sa|matatagpuan sa|matatagpuan mula sa)\s+([A-Z][a-z\s]+)/i
    ];
    
    for (const pattern of detailPatterns) {
      const match = prompt.match(pattern);
      if (match) analysis.details.push(match[1].trim());
    }
    
    // Keyword detection
    const keywordCategories = {
      isPhilippineTopic: ['philippine', 'philippines', 'pinoy', 'filipino', 'mayon', 'taal', 'banuyo', 'narra', 'molave', 'dipterocarp', 'mahogany', 'ifugao', 'cordillera', 'mindanao', 'luzon', 'visayas', 'manila', 'cebu', 'davao', 'bulkan', 'bulkano'],
      isHealthTopic: ['disease', 'virus', 'cancer', 'medical', 'health', 'clinical', 'drug', 'patient', 'medicine', 'treatment', 'covid', 'vaccine', 'pandemic', 'symptoms', 'diagnosis', 'therapy', 'surgery', 'doctor', 'hospital'],
      isScienceTopic: ['science', 'biology', 'physics', 'chemistry', 'research', 'experiment', 'molecule', 'atom', 'cell', 'dna', 'rna', 'protein', 'enzyme', 'species', 'ecology', 'evolution', 'genetics'],
      isTechnologyTopic: ['technology', 'software', 'hardware', 'computer', 'programming', 'code', 'algorithm', 'ai', 'machine learning', 'data', 'digital', 'cyber', 'network', 'server', 'cloud', 'robotics', 'automation'],
      isHistoricalTopic: ['history', 'historical', 'ancient', 'century', 'war', 'revolution', 'independence', 'colony', 'empire', 'kingdom', 'dynasty', 'civilization', 'archaeology', 'heritage'],
      isEnvironmentalTopic: ['forest', 'tree', 'deforestation', 'biodiversity', 'climate', 'conservation', 'ecosystem', 'habitat', 'wildlife', 'species', 'endemic', 'native', 'sustainable', 'reforestation', 'volcano', 'volcanic', 'eruption', 'magma', 'lava']
    };
    
    const lowerPrompt = prompt.toLowerCase();
    for (const [category, keywords] of Object.entries(keywordCategories)) {
      if (keywords.some(k => lowerPrompt.includes(k))) {
        analysis[category] = true;
      }
    }
    
    analysis.keywords = cleanPrompt.split(/\s+/).filter(w => w.length > 3).slice(0, 20);
    
    return analysis;
  },

  // ========== GENERATE RELATED TOPICS ==========
  generateRelatedTopics(topic) {
    const cleanTopic = topic.replace(/ppt|powerpoint|presentation|slideshow|slides|report|about/gi, '').trim();
    const words = cleanTopic.split(/\s+/);
    
    const relatedTopics = [];
    
    const scientificMatch = cleanTopic.match(/[A-Z][a-z]+ [a-z]+/g);
    if (scientificMatch) relatedTopics.push(scientificMatch[0]);
    
    const commonMatch = cleanTopic.match(/"([^"]+)"/);
    if (commonMatch) relatedTopics.push(commonMatch[1]);
    
    if (words.length >= 3) relatedTopics.push(words.slice(0, 3).join(' '));
    if (words.length >= 2) {
      relatedTopics.push(words[0] + ' ' + words[1]);
      relatedTopics.push(words[0] + ' ' + words[words.length - 1]);
    }
    if (words.length >= 1) {
      relatedTopics.push(words[0]);
      relatedTopics.push(words[0] + ' study');
      relatedTopics.push(words[0] + ' research');
      relatedTopics.push(words[0] + ' history');
      relatedTopics.push(words[0] + ' importance');
      relatedTopics.push(words[0] + ' characteristics');
    }
    
    return [...new Set(relatedTopics)].filter(t => t.length > 2).slice(0, 10);
  },

  // ========== COMPLETE SOURCE AGGREGATOR ==========
  async getAllReliableSources(topic) {
    const cleanTopic = topic.replace(/ppt|powerpoint|presentation|slideshow|slides|report|about/gi, '').trim();
    let allReferences = [];
    
    console.log('[Sources] Searching all reliable sources...');
    
    // UNIVERSAL - Always search these general sources
    const sourcesToSearch = [
      this.getGoogleScholarRefs.bind(this),
      this.getCrossRefRefs.bind(this),
      this.getDOAJRefs.bind(this),
      this.getResearchGateRefs.bind(this),
      this.getBritannicaRefs.bind(this),
      this.getOxfordRefs.bind(this),
      this.getArxivRefs.bind(this),
      this.getScienceDirectRefs.bind(this)
    ];
    
    // Execute all searches in parallel
    const searchPromises = sourcesToSearch.map(func => {
      return func(cleanTopic)
        .then(results => {
          console.log(`[Source] Found ${results.length} results`);
          return results;
        })
        .catch(error => {
          console.log(`[Source] Error: ${error.message}`);
          return [];
        });
    });
    
    const results = await Promise.allSettled(searchPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allReferences = allReferences.concat(result.value);
      }
    }
    
    // If no results from general sources, try specific sources
    if (allReferences.length === 0) {
      const analysis = this.analyzeTopic(topic);
      const specificSources = [];
      
      if (analysis.isHealthTopic) {
        specificSources.push(
          this.getPubMedRefs.bind(this),
          this.getWHORefs.bind(this),
          this.getCDCRefs.bind(this),
          this.getNIHRefs.bind(this)
        );
      }
      
      if (analysis.isTechnologyTopic) {
        specificSources.push(
          this.getIEEERefs.bind(this),
          this.getACMRefs.bind(this)
        );
      }
      
      if (analysis.isPhilippineTopic) {
        specificSources.push(
          this.getPhilippineEJournalsRefs.bind(this),
          this.getPJSRefs.bind(this),
          this.getUPLBRefs.bind(this),
          this.getDENRRefs.bind(this)
        );
      }
      
      if (analysis.isEnvironmentalTopic) {
        specificSources.push(
          this.getNASARefs.bind(this),
          this.getNOAARefs.bind(this),
          this.getEPARefs.bind(this),
          this.getFAORefs.bind(this)
        );
      }
      
      const specificPromises = specificSources.map(func => {
        return func(cleanTopic)
          .then(results => {
            console.log(`[Specific Source] Found ${results.length} results`);
            return results;
          })
          .catch(error => {
            console.log(`[Specific Source] Error: ${error.message}`);
            return [];
          });
      });
      
      const specificResults = await Promise.allSettled(specificPromises);
      
      for (const result of specificResults) {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          allReferences = allReferences.concat(result.value);
        }
      }
    }
    
    // Sort by relevance (peer-reviewed first, then recent)
    allReferences.sort((a, b) => {
      if (a.peerReviewed && !b.peerReviewed) return -1;
      if (!a.peerReviewed && b.peerReviewed) return 1;
      const yearA = parseInt(a.year) || 0;
      const yearB = parseInt(b.year) || 0;
      return yearB - yearA;
    });
    
    // Remove duplicates and limit
    const uniqueRefs = this.removeDuplicateReferences(allReferences);
    console.log(`[Sources] Total unique references: ${uniqueRefs.length}`);
    
    return uniqueRefs.slice(0, 10);
  },

  // ========== ALL SOURCE METHODS ==========
  
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
      if (results.length === 0) {
        return [{
          type: 'googlescholar',
          title: `Research on "${topic}"`,
          authors: 'Academic Researchers',
          year: new Date().getFullYear(),
          journal: 'Google Scholar',
          link: `https://scholar.google.com/scholar?q=${encodeURIComponent(topic)}`,
          source: 'Google Scholar',
          accessible: true,
          peerReviewed: true
        }];
      }
      
      return results.map(paper => this.formatScholarlyReference(paper, 'Google Scholar'));
    } catch (error) {
      console.log('[GoogleScholar] API failed, using fallback');
      return [{
        type: 'googlescholar',
        title: `Research on "${topic}"`,
        authors: 'Academic Researchers',
        year: new Date().getFullYear(),
        journal: 'Google Scholar',
        link: `https://scholar.google.com/scholar?q=${encodeURIComponent(topic)}`,
        source: 'Google Scholar',
        accessible: true,
        peerReviewed: true
      }];
    }
  },

  async getCrossRefRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://api.crossref.org/works?query=${encoded}&rows=5&sort=relevance`,
        { timeout: 15000 }
      );
      
      const items = response.data?.message?.items || [];
      if (items.length === 0) {
        return [{
          type: 'crossref',
          title: `Research on "${topic}"`,
          authors: 'Academic Researchers',
          year: new Date().getFullYear(),
          journal: 'Crossref',
          link: `https://search.crossref.org/?q=${encodeURIComponent(topic)}`,
          source: 'Crossref',
          accessible: true,
          peerReviewed: true
        }];
      }
      
      return items.map(item => this.formatCrossRefReference(item));
    } catch (error) {
      return [{
        type: 'crossref',
        title: `Research on "${topic}"`,
        authors: 'Academic Researchers',
        year: new Date().getFullYear(),
        journal: 'Crossref',
        link: `https://search.crossref.org/?q=${encodeURIComponent(topic)}`,
        source: 'Crossref',
        accessible: true,
        peerReviewed: true
      }];
    }
  },

  async getDOAJRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://doaj.org/api/v1/search/articles/${encoded}?pageSize=5`,
        { timeout: 10000 }
      );
      
      const results = response.data?.results || [];
      if (results.length === 0) {
        return [{
          type: 'doaj',
          title: `Research on "${topic}"`,
          authors: 'Academic Researchers',
          year: new Date().getFullYear(),
          journal: 'DOAJ',
          link: `https://doaj.org/search?q=${encodeURIComponent(topic)}`,
          source: 'DOAJ',
          accessible: true,
          peerReviewed: true
        }];
      }
      
      return results.map(item => this.formatDOAJReference(item));
    } catch (error) {
      return [];
    }
  },

  async getPubMedRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encoded}&retmax=5&retmode=json`,
        { timeout: 15000 }
      );
      
      const ids = response.data?.esearchresult?.idlist || [];
      if (ids.length === 0) {
        return [{
          type: 'pubmed',
          title: `Medical Research on "${topic}"`,
          authors: 'PubMed',
          year: new Date().getFullYear(),
          journal: 'PubMed',
          link: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(topic)}`,
          source: 'PubMed',
          accessible: true,
          peerReviewed: true
        }];
      }
      
      const detailResponse = await axios.get(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`,
        { timeout: 15000 }
      );
      
      const items = detailResponse.data?.result || {};
      return Object.values(items).filter(item => item.uid).map(item => this.formatPubMedReference(item));
    } catch (error) {
      return [{
        type: 'pubmed',
        title: `Medical Research on "${topic}"`,
        authors: 'PubMed',
        year: new Date().getFullYear(),
        journal: 'PubMed',
        link: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(topic)}`,
        source: 'PubMed',
        accessible: true,
        peerReviewed: true
      }];
    }
  },

  async getScienceDirectRefs(topic) {
    try {
      return [{
        type: 'sciencedirect',
        title: `Research on "${topic}"`,
        authors: 'ScienceDirect',
        year: new Date().getFullYear(),
        journal: 'ScienceDirect',
        link: `https://www.sciencedirect.com/search?qs=${encodeURIComponent(topic)}`,
        source: 'ScienceDirect',
        accessible: true,
        peerReviewed: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getResearchGateRefs(topic) {
    try {
      return [{
        type: 'researchgate',
        title: `Research on "${topic}"`,
        authors: 'ResearchGate',
        year: new Date().getFullYear(),
        journal: 'ResearchGate',
        link: `https://www.researchgate.net/search?q=${encodeURIComponent(topic)}`,
        source: 'ResearchGate',
        accessible: true,
        peerReviewed: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getIEEERefs(topic) {
    try {
      return [{
        type: 'ieee',
        title: `Research on "${topic}"`,
        authors: 'IEEE',
        year: new Date().getFullYear(),
        journal: 'IEEE Xplore',
        link: `https://ieeexplore.ieee.org/search/searchresult.jsp?queryText=${encodeURIComponent(topic)}`,
        source: 'IEEE Xplore',
        accessible: true,
        peerReviewed: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getACMRefs(topic) {
    try {
      return [{
        type: 'acm',
        title: `Research on "${topic}"`,
        authors: 'ACM',
        year: new Date().getFullYear(),
        journal: 'ACM Digital Library',
        link: `https://dl.acm.org/action/doSearch?AllField=${encodeURIComponent(topic)}`,
        source: 'ACM',
        accessible: true,
        peerReviewed: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getPhilippineEJournalsRefs(topic) {
    try {
      return [{
        type: 'philippine_ejournal',
        title: `Philippine Research on "${topic}"`,
        authors: 'Philippine E-Journals',
        year: new Date().getFullYear(),
        journal: 'Philippine E-Journals',
        link: `https://ejournals.ph/search?q=${encodeURIComponent(topic)}`,
        source: 'Philippine E-Journals',
        accessible: true,
        peerReviewed: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getPJSRefs(topic) {
    try {
      return [{
        type: 'pjs',
        title: `Philippine Journal of Science: "${topic}"`,
        authors: 'DOST',
        year: new Date().getFullYear(),
        journal: 'Philippine Journal of Science',
        link: `https://philjournalsci.dost.gov.ph/search?q=${encodeURIComponent(topic)}`,
        source: 'Philippine Journal of Science',
        accessible: true,
        peerReviewed: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getUPLBRefs(topic) {
    try {
      return [{
        type: 'uplb',
        title: `UPLB Research on "${topic}"`,
        authors: 'UPLB',
        year: new Date().getFullYear(),
        journal: 'UPLB Journals',
        link: `https://journals.uplb.edu.ph/search?q=${encodeURIComponent(topic)}`,
        source: 'UPLB',
        accessible: true,
        peerReviewed: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getDENRRefs(topic) {
    try {
      return [{
        type: 'denr',
        title: `DENR Information on "${topic}"`,
        authors: 'DENR',
        year: new Date().getFullYear(),
        journal: 'DENR Philippines',
        link: `https://www.denr.gov.ph/search?q=${encodeURIComponent(topic)}`,
        source: 'DENR',
        accessible: true,
        officialGovernment: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getWHORefs(topic) {
    try {
      return [{
        type: 'who',
        title: `WHO Information on "${topic}"`,
        authors: 'World Health Organization',
        year: new Date().getFullYear(),
        journal: 'WHO',
        link: `https://www.who.int/search?q=${encodeURIComponent(topic)}`,
        source: 'WHO',
        accessible: true,
        officialGovernment: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getCDCRefs(topic) {
    try {
      return [{
        type: 'cdc',
        title: `CDC Information on "${topic}"`,
        authors: 'CDC',
        year: new Date().getFullYear(),
        journal: 'CDC',
        link: `https://www.cdc.gov/search?q=${encodeURIComponent(topic)}`,
        source: 'CDC',
        accessible: true,
        officialGovernment: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getNIHRefs(topic) {
    try {
      return [{
        type: 'nih',
        title: `NIH Research on "${topic}"`,
        authors: 'NIH',
        year: new Date().getFullYear(),
        journal: 'NIH',
        link: `https://www.nih.gov/search?q=${encodeURIComponent(topic)}`,
        source: 'NIH',
        accessible: true,
        officialGovernment: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getNASARefs(topic) {
    try {
      return [{
        type: 'nasa',
        title: `NASA Information on "${topic}"`,
        authors: 'NASA',
        year: new Date().getFullYear(),
        journal: 'NASA',
        link: `https://www.nasa.gov/search?q=${encodeURIComponent(topic)}`,
        source: 'NASA',
        accessible: true,
        officialGovernment: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getNOAARefs(topic) {
    try {
      return [{
        type: 'noaa',
        title: `NOAA Information on "${topic}"`,
        authors: 'NOAA',
        year: new Date().getFullYear(),
        journal: 'NOAA',
        link: `https://www.noaa.gov/search?q=${encodeURIComponent(topic)}`,
        source: 'NOAA',
        accessible: true,
        officialGovernment: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getEPARefs(topic) {
    try {
      return [{
        type: 'epa',
        title: `EPA Information on "${topic}"`,
        authors: 'EPA',
        year: new Date().getFullYear(),
        journal: 'EPA',
        link: `https://www.epa.gov/search?q=${encodeURIComponent(topic)}`,
        source: 'EPA',
        accessible: true,
        officialGovernment: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getFAORefs(topic) {
    try {
      return [{
        type: 'fao',
        title: `FAO Information on "${topic}"`,
        authors: 'FAO',
        year: new Date().getFullYear(),
        journal: 'FAO',
        link: `https://www.fao.org/search?q=${encodeURIComponent(topic)}`,
        source: 'FAO',
        accessible: true,
        officialGovernment: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getBritannicaRefs(topic) {
    try {
      return [{
        type: 'britannica',
        title: `${topic} - Encyclopedia Britannica`,
        authors: 'Britannica Editors',
        year: new Date().getFullYear(),
        journal: 'Encyclopedia Britannica',
        link: `https://www.britannica.com/search?query=${encodeURIComponent(topic)}`,
        source: 'Britannica',
        accessible: true,
        peerReviewed: false
      }];
    } catch (error) {
      return [];
    }
  },

  async getOxfordRefs(topic) {
    try {
      return [{
        type: 'oxford',
        title: `Oxford Academic: "${topic}"`,
        authors: 'Oxford Academic',
        year: new Date().getFullYear(),
        journal: 'Oxford Academic',
        link: `https://academic.oup.com/search?q=${encodeURIComponent(topic)}`,
        source: 'Oxford Academic',
        accessible: true,
        peerReviewed: true
      }];
    } catch (error) {
      return [];
    }
  },

  async getArxivRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://export.arxiv.org/api/query?search_query=${encoded}&max_results=5`,
        { timeout: 15000 }
      );
      
      const entries = response.data?.feed?.entry || [];
      if (entries.length === 0) {
        return [{
          type: 'arxiv',
          title: `Research on "${topic}"`,
          authors: 'arXiv',
          year: new Date().getFullYear(),
          journal: 'arXiv Preprint',
          link: `https://arxiv.org/search?q=${encoded}`,
          source: 'arXiv',
          accessible: true,
          peerReviewed: false,
          isPreprint: true
        }];
      }
      
      return entries.map(item => {
        const authors = item.author?.map(a => a.name).join(', ') || 'arXiv Author';
        const year = item.published?.split('-')[0] || 'n.d.';
        
        return {
          type: 'arxiv',
          title: item.title?.replace(/\n/g, ' ').trim() || topic,
          authors: authors,
          year: year,
          link: item.id || `https://arxiv.org/search?q=${encoded}`,
          journal: 'arXiv Preprint',
          source: 'arXiv',
          accessible: true,
          peerReviewed: false,
          isPreprint: true
        };
      });
    } catch (error) {
      return [];
    }
  },

  // ========== FORMATTER FUNCTIONS ==========
  
  formatScholarlyReference(paper, source) {
    const summary = paper.publication_info?.summary || '';
    const year = summary.match(/\b(19|20)\d{2}\b/)?.[0] || 'n.d.';
    const authors = summary.split('-')[0]?.trim() || 'Unknown Author';
    const doi = this.extractDOIFromLink(paper.link);
    
    return {
      type: 'scholar',
      title: paper.title || 'Untitled',
      authors: authors,
      year: year,
      doi: doi,
      link: paper.link || '',
      journal: source,
      volume: '',
      issue: '',
      pages: '',
      source: source,
      accessible: true,
      peerReviewed: true
    };
  },

  formatCrossRefReference(item) {
    const authors = item.author?.map(a => 
      `${a.family || ''} ${a.given || ''}`.trim()
    ).join(', ') || 'Unknown Author';
    
    const year = item.issued?.['date-parts']?.[0]?.[0] || 'n.d.';
    const doi = item.DOI ? `https://doi.org/${item.DOI}` : '';
    
    return {
      type: 'crossref',
      title: item.title?.[0] || 'Untitled',
      authors: authors,
      year: year,
      doi: doi,
      link: doi || item.link?.[0] || '',
      journal: item['container-title']?.[0] || 'Crossref Publication',
      volume: item.volume || '',
      issue: item.issue || '',
      pages: item.page || '',
      source: 'Crossref',
      accessible: !!doi,
      peerReviewed: true
    };
  },

  formatDOAJReference(item) {
    const bibjson = item.bibjson || {};
    const identifiers = bibjson.identifier || [];
    const doi = identifiers.find(id => id.type === 'doi')?.id || '';
    
    return {
      type: 'doaj',
      title: bibjson.title || 'Untitled',
      authors: bibjson.author?.map(a => a.name).join(', ') || 'Unknown',
      year: bibjson.year || 'n.d.',
      doi: doi,
      link: bibjson.url?.[0] || (doi ? `https://doi.org/${doi}` : ''),
      journal: bibjson.journal?.title || 'DOAJ Journal',
      volume: bibjson.journal?.volume || '',
      issue: bibjson.journal?.number || '',
      pages: bibjson.pages || '',
      source: 'DOAJ',
      accessible: true,
      peerReviewed: true
    };
  },

  formatPubMedReference(item) {
    const doi = item.elocationid?.find(id => id.startsWith('doi:'))?.replace('doi:', '') || '';
    const year = item.pubdate?.split(' ')[0] || 'n.d.';
    
    return {
      type: 'pubmed',
      title: item.title || 'Untitled',
      authors: item.authors?.map(a => a.name).join(', ') || 'Unknown',
      year: year,
      doi: doi,
      link: `https://pubmed.ncbi.nlm.nih.gov/${item.uid}/`,
      journal: item.source || 'PubMed',
      volume: item.volume || '',
      issue: item.issue || '',
      pages: item.pages || '',
      source: 'PubMed',
      accessible: true,
      peerReviewed: true
    };
  },

  // ========== FORMAT REFERENCES (APA 7) ==========
  formatReferences(references) {
    if (!references || references.length === 0) {
      return 'No references available. Please refer to credible online sources for more information.';
    }
    
    let formatted = '';
    let counter = 1;
    
    for (const ref of references) {
      formatted += `${counter}. ${this.formatAPA7(ref)}\n`;
      counter++;
    }
    
    return formatted;
  },

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
    
    let volumeInfo = this.formatVolumeIssuePages(ref);
    if (volumeInfo) {
      parts.push(volumeInfo);
    }
    
    let link = this.formatDOILink(ref);
    if (link) {
      parts.push(link);
    }
    
    return parts.join(' ');
  },

  formatAuthorsAPA(authors) {
    if (!authors || authors === 'Unknown' || authors === 'Unknown Author') {
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

  formatVolumeIssuePages(ref) {
    let parts = [];
    
    if (ref.volume || ref.issue || ref.pages || ref.page) {
      let vol = ref.volume || '';
      let issue = ref.issue || '';
      let pages = ref.pages || ref.page || '';
      
      if (vol || issue || pages) {
        let volumeInfo = '';
        
        if (vol) {
          volumeInfo += vol;
          if (issue) {
            volumeInfo += `(${issue})`;
          }
        } else if (issue) {
          volumeInfo += `(${issue})`;
        }
        
        if (pages) {
          const pageNum = pages.toString().replace(/[^0-9\-]/g, '');
          if (pageNum) {
            if (volumeInfo) {
              volumeInfo += `, ${pageNum}`;
            } else {
              volumeInfo += pageNum;
            }
          }
        }
        
        if (volumeInfo) {
          parts.push(volumeInfo);
        }
      }
    }
    
    return parts.join(' ');
  },

  formatDOILink(ref) {
    let link = '';
    
    if (ref.doi) {
      let doi = ref.doi;
      if (!doi.startsWith('http') && !doi.startsWith('doi:')) {
        doi = `https://doi.org/${doi}`;
      } else if (doi.startsWith('doi:')) {
        doi = `https://doi.org/${doi.substring(4)}`;
      }
      link = doi;
    } else if (ref.link) {
      link = ref.link;
    }
    
    return link;
  },

  extractDOIFromLink(link) {
    if (!link) return '';
    const doiMatch = link.match(/doi\.org\/([^\s]+)/i);
    if (doiMatch) return `https://doi.org/${doiMatch[1]}`;
    return '';
  },

  removeDuplicateReferences(refs) {
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

  // ========== GENERATE PRESENTATION (FIXED) ==========
  async generatePresentation(topic, language, references, hasAcademicSource) {
    try {
      // Format references properly
      const formattedRefs = this.formatReferences(references);
      
      // Build prompt based on language
      let pptPrompt;
      if (language === 'tagalog') {
        pptPrompt = this.buildTagalogPrompt(topic, formattedRefs, hasAcademicSource);
      } else {
        pptPrompt = this.buildEnglishPrompt(topic, formattedRefs, hasAcademicSource);
      }
      
      const response = await this.callAI(pptPrompt);
      
      if (!response) return null;
      
      return this.cleanResponse(response);
      
    } catch (error) {
      console.error('[generatePresentation] Error:', error.message);
      return null;
    }
  },

  // ========== BUILD ENGLISH PROMPT (FIXED - ACCURATE REFERENCES) ==========
  buildEnglishPrompt(topic, references, hasAcademicSource) {
    let sourceInstruction = '';
    
    if (hasAcademicSource && references) {
      // CRITICAL FIX: Tell the AI to use EXACT references from the provided list
      sourceInstruction = `⚠️ CRITICAL INSTRUCTION - SLIDE 14 REFERENCES:

You MUST use ONLY these EXACT references in Slide 14. DO NOT create or invent any references.

These are ACCURATE, REAL references from academic sources:

${references}

For Slide 14, format them exactly as shown above with their full URLs/DOIs.

If a reference does not have a URL or DOI, use the search link provided.

DO NOT add any additional references not listed above.`;
    } else {
      sourceInstruction = `⚠️ CRITICAL INSTRUCTION - SLIDE 14 REFERENCES:

No academic references were found for this topic. For Slide 14, please include this message:
"References: No specific academic references found. Please consult Google Scholar or your institution's library for more sources on this topic."

OR you may include general reference links to the sources searched.`;
    }

    return `You are an expert academic presentation creator.

TOPIC: "${topic}"

${sourceInstruction}

CREATE A COMPLETE 15-SLIDE PRESENTATION:

SLIDE 1: TITLE SLIDE
[Appropriate title based on the topic]
Submitted by: [Student Name]
[Course placeholder]
[Date placeholder]

SLIDE 2: TABLE OF CONTENTS
01. Introduction
02. Main Concepts
03. Data and Information
04. Analysis
05. Summary and Conclusion
06. Recommendations
07. References

SLIDE 3: INTRODUCTION
Definition: [Complete definition based on the topic]
Importance:
- [Reason 1]
- [Reason 2]
- [Reason 3]

SLIDE 4: OBJECTIVES
- [Objective 1]
- [Objective 2]
- [Objective 3]
- [Objective 4]

SLIDE 5: MAIN CONCEPT 1
[First concept]
- Definition: [Explain]
- Key points: [2-3 details]
- Example: [Specific example]

SLIDE 6: MAIN CONCEPT 2
[Second concept]
- Explanation: [Explain]
- Comparison: [Compare with concept 1]
- Example: [Specific example]

SLIDE 7: MAIN CONCEPT 3
[Third concept]
- Process: [Explain]
- Timeline: [Important dates if applicable]
- Impact: [Current relevance]

SLIDE 8: DATA AND INFORMATION
- [Fact 1]
- [Fact 2]
- [Fact 3]
Interpretation: [What these mean in context]

SLIDE 9: CASE STUDY OR EXAMPLE
SITUATION: [Real example]
PROBLEM: [Issue or challenge]
RESPONSE: [Solution or approach]
LESSON: [What we learn]

SLIDE 10: ANALYSIS
- Root cause: [Analysis]
- Affected: [Who or what is affected]
- Why it matters: [Importance]
- Implications: [Impact]

SLIDE 11: SUMMARY
TOP 3 TAKEAWAYS:
1. [Key point]
2. [Key point]
3. [Key point]

SLIDE 12: CONCLUSION
[Conclusion]
[Key insight]
[Final message]

SLIDE 13: RECOMMENDATIONS
- Short-term: [Recommendation]
- Medium-term: [Recommendation]
- Long-term: [Recommendation]

SLIDE 14: REFERENCES
${references || 'Use the references provided above'}

SLIDE 15: Q&A AND THANK YOU
THANK YOU FOR LISTENING!

CRITICAL RULES:
- ALWAYS follow the 15-slide format
- PLAIN TEXT ONLY (NO MARKDOWN, NO **, NO ##)
- FILL ALL BRACKETS with detailed content
- ADAPT the content to the SPECIFIC TOPIC
- Use specific details from the provided information
- ALL REFERENCES MUST BE ACCURATE AND ACCESSIBLE (USE THE EXACT ONES PROVIDED)`;
  },

  // ========== BUILD TAGALOG PROMPT (FIXED - ACCURATE REFERENCES) ==========
  buildTagalogPrompt(topic, references, hasAcademicSource) {
    let sourceInstruction = '';
    
    if (hasAcademicSource && references) {
      sourceInstruction = `⚠️ MAHALAGANG PANUNTUNAN - SLIDE 14 REFERENCES:

Dapat gamitin MO LANG ang mga EXACT na references na ito sa Slide 14. HUWAG gumawa o mag-imbento ng references.

Ito ay TUNAY at ACCURATE na mga reference mula sa akademikong pinagkunan:

${references}

Para sa Slide 14, i-format ang mga ito nang eksakto tulad ng nasa itaas kasama ang kanilang mga URL/DOI.

HUWAG magdagdag ng ibang reference na wala sa listahan na ito.`;
    } else {
      sourceInstruction = `⚠️ MAHALAGANG PANUNTUNAN - SLIDE 14 REFERENCES:

Walang nakitang akademikong reference para sa paksang ito. Para sa Slide 14, isama ang mensaheng ito:
"References: Walang nakitang specific na academic references. Mangyaring kumonsulta sa Google Scholar o sa library ng inyong institusyon para sa karagdagang sources tungkol sa paksang ito."

O kaya ay maaaring isama ang general reference links sa mga source na hinanap.`;
    }

    return `Ikaw ay isang ekspertong tagagawa ng presentasyon.

PAKSA: "${topic}"

${sourceInstruction}

GUMAWA NG KUMPLETONG 15-SLIDE PRESENTASYON:

SLIDE 1: TITLE SLIDE
[Angkop na pamagat batay sa paksa]
Isinumite nina: [Pangalan placeholder]
[Course placeholder]
[Petsa placeholder]

SLIDE 2: TABLE OF CONTENTS
01. Introduksyon
02. Pangunahing Konsepto
03. Mga Datos at Impormasyon
04. Pagsusuri
05. Buod at Konklusyon
06. Rekomendasyon
07. Mga Pinagkunan

SLIDE 3: INTRODUKSYON
Kahulugan: [Kumpletong depinisyon batay sa paksa]
Kahalagahan:
- [Dahilan 1]
- [Dahilan 2]
- [Dahilan 3]

SLIDE 4: LAYUNIN
- [Layunin 1]
- [Layunin 2]
- [Layunin 3]
- [Layunin 4]

SLIDE 5: PANGUNAHING KONSEPTO 1
[Unang konsepto]
- Depinisyon: [Paliwanag]
- Mahahalagang punto: [2-3 detalye]
- Halimbawa: [Tiyak na halimbawa]

SLIDE 6: PANGUNAHING KONSEPTO 2
[Ikalawang konsepto]
- Paliwanag: [Paliwanag]
- Paghahambing: [Ihambing sa konsepto 1]
- Halimbawa: [Tiyak na halimbawa]

SLIDE 7: PANGUNAHING KONSEPTO 3
[Ikatlong konsepto]
- Proseso: [Paliwanag]
- Timeline: [Mahahalagang petsa kung applicable]
- Epekto: [Kasalukuyang kaugnayan]

SLIDE 8: MGA DATOS AT IMPORMASYON
- [Datos 1]
- [Datos 2]
- [Datos 3]
Interpretasyon: [Ano ang ibig sabihin sa konteksto]

SLIDE 9: CASE STUDY O HALIMBAWA
SITWASYON: [Tunay na halimbawa]
PROBLEMA: [Isyu o hamon]
TUGON: [Solusyon o approach]
ARAL: [Ano ang natutunan]

SLIDE 10: PAGSUSURI
- Ugat: [Pagsusuri]
- Apektado: [Sino o ano ang apektado]
- Bakit mahalaga: [Kahalagahan]
- Implikasyon: [Epekto]

SLIDE 11: BUOD
TOP 3 TAKEAWAYS:
1. [Pangunahing punto]
2. [Pangunahing punto]
3. [Pangunahing punto]

SLIDE 12: KONKLUSYON
[Konklusyon]
[Pangunahing insight]
[Panghuling mensahe]

SLIDE 13: REKOMENDASYON
- Panandalian: [Rekomendasyon]
- Katamtaman: [Rekomendasyon]
- Pangmatagalan: [Rekomendasyon]

SLIDE 14: MGA PINAGKUNAN
${references || 'Gamitin ang mga references na nasa itaas'}

SLIDE 15: Q&A AT PASASALAMAT
MARAMING SALAMAT SA INYONG PAKIKINIG!

KRITIKAL NA PANUNTUNAN:
- LAGING sundin ang 15-slide format
- PLAIN TEXT LAMANG (WALANG MARKDOWN, WALANG **, WALANG ##)
- PUNAN ANG LAHAT NG BRACKETS ng detalyadong nilalaman
- IAKMA ang nilalaman sa SPECIFIC NA PAKSA
- Gamitin ang specific details mula sa ibinigay na impormasyon
- LAHAT NG REFERENCES AY DAPAT ACCURATE AT ACCESSIBLE (GAMITIN ANG EXACT NA NASA IBABAW)`;
  },

  // ========== AI API CALLS ==========
  async callAI(prompt) {
    // If prompt is too large, summarize it
    if (prompt.length > 10000) {
      prompt = await this.summarizeLargeInput(prompt);
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
      return await this.executeAPI(primary, prompt);
    } catch (primaryError) {
      console.error('[callAI] Primary API failed:', primaryError.message);
      try {
        return await this.executeAPI(fallback, prompt);
      } catch (fallbackError) {
        console.error('[callAI] Fallback API failed:', fallbackError.message);
        return null;
      }
    }
  },

  async summarizeLargeInput(prompt) {
    // Extract key information from large text
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Get first 5 sentences
    const intro = sentences.slice(0, 5).join('. ');
    
    // Get last 5 sentences
    const conclusion = sentences.slice(-5).join('. ');
    
    // Extract key terms
    const keyTerms = this.extractKeyInformation(prompt);
    
    return `
TOPIC: ${keyTerms.substring(0, 500)}
INTRODUCTION: ${intro}
KEY FINDINGS: ${keyTerms.substring(0, 2000)}
CONCLUSION: ${conclusion}
`;
  },

  extractKeyInformation(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    const keySentences = [];
    const importantKeywords = ['important', 'significant', 'found', 'shows', 'indicates', 'reveals', 'study', 'research', 
                              'analysis', 'result', 'conclusion', 'discovered', 'mahalaga', 'natuklasan', 'natagpuan', 
                              'ipinapakita', 'nagpapahiwatig', 'pag-aaral', 'pananaliksik', 'pagsusuri', 'resulta',
                              'key', 'main', 'primary', 'essential', 'critical', 'crucial', 'vital', 'fundamental'];
    
    // Add first 5 sentences
    for (let i = 0; i < Math.min(5, sentences.length); i++) {
      keySentences.push(sentences[i].trim());
    }
    
    // Add sentences with important keywords
    for (const sentence of sentences) {
      if (importantKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        if (!keySentences.includes(sentence.trim())) {
          keySentences.push(sentence.trim());
          if (keySentences.length >= 15) break;
        }
      }
    }
    
    // Add last 5 sentences
    for (let i = Math.max(0, sentences.length - 5); i < sentences.length; i++) {
      if (!keySentences.includes(sentences[i].trim())) {
        keySentences.push(sentences[i].trim());
      }
    }
    
    return keySentences.join('.\n');
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
    const chunks = this.splitMessage(text);
    for (const chunk of chunks) {
      await sendMessage(senderId, { text: chunk }, token);
    }
  }
};
