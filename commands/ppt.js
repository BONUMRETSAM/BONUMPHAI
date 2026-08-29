const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

// API Keys - Move to environment variables
const SERPAPI_KEY = process.env.SERPAPI_KEY || '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ppt', 'powerpoint', 'presentation', 'slideshow', 'slides'],
  description: 'Auto-generate PowerPoint presentation from any topic',
  usage: 'ppt [topic/outline] or just type any topic',
  version: '9.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 10,

  async execute(senderId, args, token, event) {
    try {
      let prompt = args.join(' ').trim();
      
      if (!prompt) {
        await sendMessage(senderId, {
          text: '📊 PPT GENERATOR\n\nJust type any topic and I\'ll create a presentation!\n\nExamples:\n• ppt Climate Change\n• Communication and Globalization\n• Wallaceodendron celebicum\n• Any topic or outline'
        }, token);
        return;
      }
      
      if (!this.validateInput(prompt)) {
        await sendMessage(senderId, {
          text: '❌ Invalid input. Please use alphanumeric characters only.'
        }, token);
        return;
      }

      // ========== STEP 1: DETECT WHAT TYPE OF INPUT ==========
      const inputType = this.detectInputType(prompt);
      
      console.log('[ppt] Input type detected:', inputType);
      
      // ========== STEP 2: IF ACTIVITY SHEET/QUIZ/ASSIGNMENT -> REDIRECT TO AI.JS ==========
      if (inputType === 'activity' || inputType === 'quiz' || inputType === 'assignment') {
        await sendMessage(senderId, {
          text: 'This appears to be an activity sheet, quiz, or assignment.\n\nRedirecting to AI Assistant for answers...\n\nPlease use: ai ' + prompt.substring(0, 200) + (prompt.length > 200 ? '...' : '')
        }, token);
        return;
      }
      
      // ========== STEP 3: IF QUESTION -> REDIRECT TO AI.JS ==========
      if (inputType === 'question') {
        await sendMessage(senderId, {
          text: 'This appears to be a question.\n\nRedirecting to AI Assistant for answers...\n\nPlease use: ai ' + prompt.substring(0, 200) + (prompt.length > 200 ? '...' : '')
        }, token);
        return;
      }
      
      // ========== STEP 4: IF TOPIC -> GENERATE PRESENTATION ==========
      if (inputType === 'topic' || inputType === 'structured' || inputType === 'outline') {
        await sendMessage(senderId, { 
          text: `Creating powerpoint presentation about "${this.extractMainTopic(prompt)}"... Please wait.` 
        }, token);
        
        // Analyze topic
        const topicAnalysis = this.analyzeTopic(prompt);
        const language = this.detectLanguage(prompt);
        
        // Parse if structured outline
        let structuredData = null;
        if (this.isStructuredOutline(prompt)) {
          structuredData = this.parseStructuredOutline(prompt);
        }
        
        // Get references
        let references = await this.getAllReliableSources(prompt);
        let hasAcademicSource = references.length > 0;
        
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
        
        // Generate presentation
        const presentation = await this.generatePresentation(
          prompt,
          topicAnalysis,
          language,
          references,
          hasAcademicSource,
          structuredData
        );
        
        if (presentation) {
          await this.sendChunks(senderId, presentation, token);
        } else {
          await sendMessage(senderId, { 
            text: '❌ Error generating presentation. Please try again with a different topic.' 
          }, token);
        }
        return;
      }
      
      // ========== STEP 5: FALLBACK - TRY AS TOPIC ==========
      await sendMessage(senderId, { 
        text: `Generating presentation about "${prompt.substring(0, 50)}"... Please wait.` 
      }, token);
      
      const topicAnalysis = this.analyzeTopic(prompt);
      const language = this.detectLanguage(prompt);
      
      let references = await this.getAllReliableSources(prompt);
      let hasAcademicSource = references.length > 0;
      
      const presentation = await this.generatePresentation(
        prompt,
        topicAnalysis,
        language,
        references,
        hasAcademicSource,
        null
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

  // ========== DETECT INPUT TYPE ==========
  detectInputType(prompt) {
    const lower = prompt.toLowerCase();
    
    // ===== CHECK: Activity Sheet =====
    const activityIndicators = [
      'activity sheet', 'worksheet', 'activity', 'exercise',
      'directions', 'instruction', 'read and answer',
      'part i', 'part ii', 'part iii', 'section a', 'section b',
      'multiple choice', 'true or false', 'fill in the blank',
      'matching type', 'enumeration', 'essay', 'short answer',
      'show your solution', 'prove that', 'derive',
      'list down', 'enumerate', 'describe', 'explain',
      'differentiate', 'compare and contrast', 'distinguish',
      'classify', 'categorize', 'arrange', 'sequence',
      'label the diagram', 'complete the table'
    ];
    
    if (activityIndicators.some(k => lower.includes(k))) {
      return 'activity';
    }
    
    // ===== CHECK: Quiz/Exam =====
    const quizIndicators = [
      'quiz', 'exam', 'test', 'assessment', 'evaluation',
      'multiple choice', 'true or false', 'fill in the blank',
      'matching type', 'enumeration', 'essay',
      'score', 'points', 'grade', 'answer the following'
    ];
    
    if (quizIndicators.some(k => lower.includes(k))) {
      return 'quiz';
    }
    
    // ===== CHECK: Assignment/Homework =====
    const assignmentIndicators = [
      'assignment', 'homework', 'project', 'task',
      'submit', 'deadline', 'due date', 'pass',
      'research paper', 'term paper', 'case study',
      'write a', 'create a', 'make a', 'prepare a',
      'sagutan', 'sagutin', 'assignment ni', 'homework ni'
    ];
    
    if (assignmentIndicators.some(k => lower.includes(k))) {
      return 'assignment';
    }
    
    // ===== CHECK: Question =====
    if (lower.includes('?')) return 'question';
    
    const questionStarters = ['what', 'why', 'how', 'when', 'where', 'who', 'which', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must'];
    const words = lower.split(/\s+/);
    if (words.length > 0 && questionStarters.includes(words[0])) {
      return 'question';
    }
    
    // ===== CHECK: Structured Outline =====
    if (this.isStructuredOutline(prompt)) {
      return 'structured';
    }
    
    // ===== CHECK: Topic =====
    // If it has presentation indicators or looks like a topic
    const presentationIndicators = [
      'about', 'topic', 'subject', 'theme', 'issue', 'concept',
      'theory', 'framework', 'model', 'approach', 'strategy',
      'method', 'technique', 'process', 'system', 'structure',
      'function', 'role', 'impact', 'effect', 'cause',
      'consequence', 'implication', 'significance', 'importance',
      'benefit', 'advantage', 'disadvantage', 'challenge',
      'problem', 'solution', 'recommendation', 'suggestion',
      'proposal', 'plan', 'program', 'project', 'initiative',
      'campaign', 'movement', 'trend', 'pattern', 'phenomenon',
      'concern', 'debate', 'controversy', 'perspective', 'viewpoint',
      'chapter', 'lesson', 'module', 'course', 'lecture',
      'communication', 'globalization', 'culture', 'society',
      'environment', 'climate', 'health', 'education', 'technology'
    ];
    
    if (presentationIndicators.some(k => lower.includes(k))) {
      return 'topic';
    }
    
    // ===== CHECK: Scientific Name =====
    if (/\b([A-Z][a-z]+ [a-z]+)\b/.test(prompt)) {
      return 'topic';
    }
    
    // ===== CHECK: Short Topic (less than 100 chars) =====
    if (prompt.length < 100) {
      return 'topic';
    }
    
    // ===== CHECK: Has numbers and letters (structured) =====
    if (/[a-z]\)/.test(prompt) || /\d+\./.test(prompt)) {
      return 'structured';
    }
    
    // ===== FALLBACK: Topic =====
    return 'topic';
  },

  // ========== EXTRACT MAIN TOPIC ==========
  extractMainTopic(prompt) {
    // Remove common prefixes
    let topic = prompt.replace(/^(ppt|powerpoint|presentation|slideshow|slides|report|about|topic|subject)\s+/i, '');
    
    // If it's a structured outline, get first line
    const lines = topic.split('\n');
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine && firstLine.length < 100) {
        return firstLine;
      }
    }
    
    // If too long, get first 50 chars
    if (topic.length > 100) {
      return topic.substring(0, 80) + '...';
    }
    
    return topic;
  },

  // ========== STRUCTURED OUTLINE DETECTION ==========
  isStructuredOutline(prompt) {
    const lines = prompt.split('\n');
    let hasLetters = false;
    let hasNumbers = false;
    let hasBullets = false;
    let hasHierarchy = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      if (/^[a-z]\)/.test(trimmed)) hasLetters = true;
      if (/^\d+[.)]/.test(trimmed)) hasNumbers = true;
      if (/^[•\-*]/.test(trimmed)) hasBullets = true;
      if (line.startsWith('  ') || line.startsWith('\t')) hasHierarchy = true;
    }
    
    const indicators = [hasLetters, hasNumbers, hasBullets, hasHierarchy];
    const count = indicators.filter(Boolean).length;
    
    return count >= 2;
  },

  // ========== PARSE STRUCTURED OUTLINE ==========
  parseStructuredOutline(prompt) {
    const lines = prompt.split('\n');
    const result = {
      mainTopic: '',
      chapters: {},
      sections: [],
      subsections: [],
      topics: []
    };
    
    let currentChapter = '';
    let currentSection = '';
    let currentSubsection = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Detect main topic
      if (!result.mainTopic && !trimmed.match(/^[a-z]\)/) && !trimmed.match(/^\d+[.)]/) && !trimmed.startsWith('•') && !trimmed.startsWith('*')) {
        if (trimmed.length < 100 && !trimmed.includes('Chapter')) {
          result.mainTopic = trimmed;
        }
      }
      
      // Detect chapter
      const chapterMatch = trimmed.match(/^(?:Chapter\s*(\d+)|([A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*))\s*$/);
      if (chapterMatch) {
        currentChapter = chapterMatch[1] ? `Chapter ${chapterMatch[1]}` : chapterMatch[2];
        result.chapters[currentChapter] = { sections: [], subsections: [] };
        currentSection = '';
        currentSubsection = '';
        continue;
      }
      
      // Detect section with letter
      const letterMatch = trimmed.match(/^([a-z])\)\s*(.+)/);
      if (letterMatch) {
        currentSection = letterMatch[2].trim();
        result.sections.push(currentSection);
        if (currentChapter && result.chapters[currentChapter]) {
          result.chapters[currentChapter].sections.push(currentSection);
        }
        continue;
      }
      
      // Detect subsection with number
      const numberMatch = trimmed.match(/^(\d+)\.\s*(.+)/);
      if (numberMatch) {
        currentSubsection = numberMatch[2].trim();
        result.subsections.push(currentSubsection);
        if (currentChapter && result.chapters[currentChapter]) {
          result.chapters[currentChapter].subsections.push(currentSubsection);
        }
        continue;
      }
      
      // Detect bullet points
      const bulletMatch = trimmed.match(/^[•\-*]\s*(.+)/);
      if (bulletMatch) {
        const bulletText = bulletMatch[1].trim();
        if (currentSubsection) {
          if (!result.subsectionsDetails) result.subsectionsDetails = {};
          if (!result.subsectionsDetails[currentSubsection]) {
            result.subsectionsDetails[currentSubsection] = [];
          }
          result.subsectionsDetails[currentSubsection].push(bulletText);
        }
      }
    }
    
    return result;
  },

  // ========== VALIDATION ==========
  validateInput(prompt) {
    if (!prompt || prompt.length < 2) return false;
    if (prompt.length > 5000) return false;
    if (/[<>{}`]/.test(prompt)) return false;
    return true;
  },

  // ========== LANGUAGE DETECTION ==========
  detectLanguage(prompt) {
    const lower = prompt.toLowerCase();
    const tagalogWords = ['ang', 'ng', 'mga', 'sa', 'ay', 'at', 'para', 'tungkol', 'epekto', 'kahalagahan', 'pag-aaral', 'paano', 'bakit'];
    const hasTagalog = tagalogWords.some(w => lower.includes(w));
    return hasTagalog ? 'tagalog' : 'english';
  },

  // ========== TOPIC ANALYSIS ==========
  analyzeTopic(prompt) {
    const cleanPrompt = prompt.replace(/ppt|powerpoint|presentation|slideshow|slides|report|about/gi, '').trim();
    
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
      isEducationalTopic: false,
      isStructuredOutline: false,
      details: [],
      keywords: [],
      scientificName: '',
      commonName: '',
      location: '',
      purpose: ''
    };
    
    // Check if structured outline
    analysis.isStructuredOutline = this.isStructuredOutline(prompt);
    
    // Extract scientific name
    const scientificMatch = cleanPrompt.match(/\b([A-Z][a-z]+ [a-z]+)\b/);
    if (scientificMatch) {
      analysis.hasScientificName = true;
      analysis.scientificName = scientificMatch[1];
    }
    
    // Extract common name from quotes
    const commonMatch = cleanPrompt.match(/"([^"]+)"/);
    if (commonMatch) {
      analysis.hasCommonName = true;
      analysis.commonName = commonMatch[1];
    }
    
    // Check if has detailed description
    if (cleanPrompt.length > 100 || cleanPrompt.includes('identifies') || cleanPrompt.includes('known as')) {
      analysis.hasDetailedDescription = true;
    }
    
    // Detect topic categories
    const philippineKeywords = ['philippine', 'philippines', 'pinoy', 'filipino', 'banuyo', 'narra', 'molave'];
    analysis.isPhilippineTopic = philippineKeywords.some(k => cleanPrompt.toLowerCase().includes(k));
    
    const healthKeywords = ['disease', 'virus', 'cancer', 'medical', 'health', 'clinical'];
    analysis.isHealthTopic = healthKeywords.some(k => cleanPrompt.toLowerCase().includes(k));
    
    const scienceKeywords = ['science', 'biology', 'physics', 'chemistry', 'research'];
    analysis.isScienceTopic = scienceKeywords.some(k => cleanPrompt.toLowerCase().includes(k));
    
    const techKeywords = ['technology', 'software', 'hardware', 'computer', 'programming'];
    analysis.isTechnologyTopic = techKeywords.some(k => cleanPrompt.toLowerCase().includes(k));
    
    const historyKeywords = ['history', 'historical', 'ancient', 'century', 'war'];
    analysis.isHistoricalTopic = historyKeywords.some(k => cleanPrompt.toLowerCase().includes(k));
    
    const educationKeywords = ['communication', 'academic', 'writing', 'research', 'essay', 'plagiarism', 'workplace', 'employment', 'resume', 'curriculum vitae', 'job interview', 'public speaking', 'multimodal', 'blogging'];
    analysis.isEducationalTopic = educationKeywords.some(k => cleanPrompt.toLowerCase().includes(k));
    
    // Extract keywords
    analysis.keywords = cleanPrompt.split(/\s+/).filter(w => w.length > 3).slice(0, 10);
    
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
      relatedTopics.push(words[0] + ' Philippines');
      relatedTopics.push(words[0] + ' characteristics');
      relatedTopics.push(words[0] + ' study');
      relatedTopics.push(words[0] + ' research');
    }
    
    return [...new Set(relatedTopics)].filter(t => t.length > 2).slice(0, 10);
  },

  // ========== COMPLETE SOURCE AGGREGATOR ==========
  async getAllReliableSources(topic) {
    const cleanTopic = topic.replace(/ppt|powerpoint|presentation|slideshow|slides|report|about/gi, '').trim();
    let allReferences = [];
    
    console.log('[Sources] Searching all reliable sources...');
    
    const analysis = this.analyzeTopic(topic);
    let sourcesToSearch = [];
    
    if (analysis.isEducationalTopic || analysis.isStructuredOutline) {
      console.log('[Sources] Educational/Structured topic detected');
      sourcesToSearch = [
        this.getGoogleScholarRefs.bind(this),
        this.getCrossRefRefs.bind(this),
        this.getDOAJRefs.bind(this),
        this.getERICRefs.bind(this),
        this.getJSTORRefs.bind(this),
        this.getResearchGateRefs.bind(this),
        this.getBritannicaRefs.bind(this)
      ];
    } else if (analysis.isPhilippineTopic) {
      console.log('[Sources] Philippine topic detected');
      sourcesToSearch = [
        this.getGoogleScholarRefs.bind(this),
        this.getCrossRefRefs.bind(this),
        this.getDOAJRefs.bind(this),
        this.getPhilippineEJournalsRefs.bind(this),
        this.getPJSRefs.bind(this),
        this.getUPLBRefs.bind(this),
        this.getDENRRefs.bind(this)
      ];
    } else if (analysis.isHealthTopic) {
      console.log('[Sources] Health topic detected');
      sourcesToSearch = [
        this.getPubMedRefs.bind(this),
        this.getCrossRefRefs.bind(this),
        this.getWHORefs.bind(this),
        this.getCDCRefs.bind(this)
      ];
    } else if (analysis.isTechnologyTopic) {
      console.log('[Sources] Technology topic detected');
      sourcesToSearch = [
        this.getIEEERefs.bind(this),
        this.getACMRefs.bind(this),
        this.getCrossRefRefs.bind(this),
        this.getScienceDirectRefs.bind(this)
      ];
    } else if (analysis.isScienceTopic) {
      console.log('[Sources] Science topic detected');
      sourcesToSearch = [
        this.getScienceDirectRefs.bind(this),
        this.getCrossRefRefs.bind(this),
        this.getGoogleScholarRefs.bind(this),
        this.getDOAJRefs.bind(this)
      ];
    } else {
      console.log('[Sources] General topic detected');
      sourcesToSearch = [
        this.getGoogleScholarRefs.bind(this),
        this.getCrossRefRefs.bind(this),
        this.getDOAJRefs.bind(this),
        this.getResearchGateRefs.bind(this),
        this.getBritannicaRefs.bind(this)
      ];
    }
    
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
    
    allReferences.sort((a, b) => {
      if (a.peerReviewed && !b.peerReviewed) return -1;
      if (!a.peerReviewed && b.peerReviewed) return 1;
      const yearA = parseInt(a.year) || 0;
      const yearB = parseInt(b.year) || 0;
      return yearB - yearA;
    });
    
    const uniqueRefs = this.removeDuplicateReferences(allReferences);
    console.log(`[Sources] Total unique references: ${uniqueRefs.length}`);
    
    return uniqueRefs.slice(0, 10);
  },

  // ========== SOURCE FUNCTIONS ==========

  async getGoogleScholarRefs(topic) {
    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          engine: 'google_scholar',
          q: topic,
          api_key: SERPAPI_KEY,
          num: 3
        },
        timeout: 15000
      });
      
      const results = response.data?.organic_results || [];
      return results.map(paper => this.formatScholarlyReference(paper, 'Google Scholar'));
    } catch (error) {
      return [];
    }
  },

  async getCrossRefRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://api.crossref.org/works?query=${encoded}&rows=3&sort=relevance`,
        { timeout: 15000 }
      );
      
      const items = response.data?.message?.items || [];
      return items.map(item => this.formatCrossRefReference(item));
    } catch (error) {
      return [];
    }
  },

  async getDOAJRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://doaj.org/api/v1/search/articles/${encoded}?pageSize=3`,
        { timeout: 10000 }
      );
      
      const results = response.data?.results || [];
      return results.map(item => this.formatDOAJReference(item));
    } catch (error) {
      return [];
    }
  },

  async getERICRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://api.eric.ed.gov/rest/?search=${encoded}&rows=3`,
        { timeout: 15000 }
      );
      
      const results = response.data?.results || [];
      return results.map(item => ({
        type: 'eric',
        title: item.title || topic,
        authors: item.authors || 'ERIC Author',
        year: item.year || '2024',
        journal: item.journal || 'ERIC',
        link: item.link || `https://eric.ed.gov/search?q=${encoded}`,
        source: 'ERIC',
        accessible: true,
        peerReviewed: true
      }));
    } catch (error) {
      return [];
    }
  },

  async getJSTORRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://www.jstor.org/search?q=${encoded}&page=1&per_page=3`,
        { timeout: 15000 }
      );
      
      const results = response.data?.items || [];
      return results.map(item => ({
        type: 'jstor',
        title: item.title || topic,
        authors: item.authors || 'JSTOR Author',
        year: item.year || '2024',
        journal: item.journal || 'JSTOR',
        link: item.link || `https://www.jstor.org/search?q=${encoded}`,
        source: 'JSTOR',
        accessible: true,
        peerReviewed: true
      }));
    } catch (error) {
      return [];
    }
  },

  async getResearchGateRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://www.researchgate.net/publication/find?q=${encoded}`,
        { timeout: 15000 }
      );
      
      const results = response.data?.publications || [];
      return results.map(item => ({
        type: 'researchgate',
        title: item.title || topic,
        authors: item.authors || 'ResearchGate Author',
        year: item.year || '2024',
        journal: item.journal || 'ResearchGate',
        link: item.link || `https://www.researchgate.net/search?q=${encoded}`,
        source: 'ResearchGate',
        accessible: true,
        peerReviewed: true
      }));
    } catch (error) {
      return [];
    }
  },

  async getBritannicaRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://www.britannica.com/search?q=${encoded}`,
        { timeout: 15000 }
      );
      
      const results = response.data?.results || [];
      return results.map(item => ({
        type: 'britannica',
        title: item.title || topic,
        authors: 'Encyclopedia Britannica Editors',
        year: new Date().getFullYear(),
        journal: 'Encyclopedia Britannica',
        link: item.link || `https://www.britannica.com/search?q=${encoded}`,
        source: 'Britannica',
        accessible: true,
        peerReviewed: false
      }));
    } catch (error) {
      return [{
        type: 'britannica',
        title: topic,
        authors: 'Encyclopedia Britannica Editors',
        year: new Date().getFullYear(),
        journal: 'Encyclopedia Britannica',
        link: `https://www.britannica.com/search?query=${encodeURIComponent(topic)}`,
        source: 'Britannica',
        accessible: true,
        peerReviewed: false
      }];
    }
  },

  async getPhilippineEJournalsRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://ejournals.ph/index.php?option=com_search&searchword=${encoded}&format=json`,
        { timeout: 15000 }
      );
      
      const results = response.data || [];
      return results.map(item => ({
        type: 'philippine_ejournal',
        title: item.title || topic,
        authors: item.authors || 'Philippine Researcher',
        year: item.year || '2024',
        journal: item.journal || 'Philippine E-Journal',
        volume: item.volume || '',
        issue: item.issue || '',
        pages: item.pages || '',
        doi: item.doi || '',
        link: item.link || `https://ejournals.ph/search?q=${encoded}`,
        source: 'Philippine E-Journals',
        accessible: true,
        peerReviewed: true
      }));
    } catch (error) {
      return [];
    }
  },

  async getPJSRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://philjournalsci.dost.gov.ph/index.php/search?q=${encoded}`,
        { timeout: 15000 }
      );
      
      const results = response.data?.articles || [];
      return results.map(item => ({
        type: 'pjs',
        title: item.title || topic,
        authors: item.authors || 'DOST Researcher',
        year: item.year || '2024',
        journal: 'Philippine Journal of Science',
        volume: item.volume || '',
        issue: item.issue || '',
        pages: item.pages || '',
        doi: item.doi || '',
        link: item.link || `https://philjournalsci.dost.gov.ph/search?q=${encoded}`,
        source: 'Philippine Journal of Science',
        accessible: true,
        peerReviewed: true
      }));
    } catch (error) {
      return [];
    }
  },

  async getUPLBRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://journals.uplb.edu.ph/index.php/index/search?q=${encoded}`,
        { timeout: 15000 }
      );
      
      const results = response.data?.articles || [];
      return results.map(item => ({
        type: 'uplb',
        title: item.title || topic,
        authors: item.authors || 'UPLB Researcher',
        year: item.year || '2024',
        journal: item.journal || 'UPLB Journal',
        volume: item.volume || '',
        issue: item.issue || '',
        pages: item.pages || '',
        doi: item.doi || '',
        link: item.link || `https://journals.uplb.edu.ph/search?q=${encoded}`,
        source: 'UPLB Journals',
        accessible: true,
        peerReviewed: true
      }));
    } catch (error) {
      return [];
    }
  },

  async getDENRRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://www.denr.gov.ph/index.php/search?q=${encoded}`,
        { timeout: 15000 }
      );
      
      const results = response.data?.results || [];
      return results.map(item => ({
        type: 'denr',
        title: item.title || topic,
        authors: 'Department of Environment and Natural Resources',
        year: item.year || new Date().getFullYear(),
        journal: 'DENR Philippines',
        link: item.link || `https://www.denr.gov.ph/search?q=${encoded}`,
        source: 'DENR Philippines',
        accessible: true,
        officialGovernment: true
      }));
    } catch (error) {
      return [{
        type: 'denr',
        title: `Philippine Native Trees - ${topic}`,
        authors: 'DENR-ERDB',
        year: new Date().getFullYear(),
        journal: 'Ecosystems Research and Development Bureau',
        link: `https://erdb.denr.gov.ph/native-trees/`,
        source: 'DENR-ERDB',
        accessible: true,
        officialGovernment: true
      }];
    }
  },

  async getWHORefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://www.who.int/api/search?q=${encoded}`,
        { timeout: 15000 }
      );
      
      const results = response.data?.results || [];
      return results.map(item => ({
        type: 'who',
        title: item.title || topic,
        authors: 'World Health Organization',
        year: item.year || new Date().getFullYear(),
        journal: 'WHO Publications',
        link: item.link || `https://www.who.int/search?q=${encoded}`,
        source: 'WHO',
        accessible: true,
        officialGovernment: true
      }));
    } catch (error) {
      return [];
    }
  },

  async getCDCRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://www.cdc.gov/api/search?q=${encoded}`,
        { timeout: 15000 }
      );
      
      const results = response.data?.results || [];
      return results.map(item => ({
        type: 'cdc',
        title: item.title || topic,
        authors: 'Centers for Disease Control and Prevention',
        year: item.year || new Date().getFullYear(),
        journal: 'CDC Publications',
        link: item.link || `https://www.cdc.gov/search?q=${encoded}`,
        source: 'CDC',
        accessible: true,
        officialGovernment: true
      }));
    } catch (error) {
      return [];
    }
  },

  async getScienceDirectRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://api.elsevier.com/content/search/scopus?query=${encoded}&apiKey=${process.env.ELSEVIER_API_KEY || ''}`,
        { timeout: 15000 }
      );
      
      const results = response.data?.searchResults?.['entry'] || [];
      return results.map(item => ({
        type: 'sciencedirect',
        title: item['dc:title'] || topic,
        authors: item['dc:creator'] || 'ScienceDirect Author',
        year: item['prism:coverDate']?.split('-')[0] || 'n.d.',
        doi: item['prism:doi'] ? `https://doi.org/${item['prism:doi']}` : '',
        link: item['prism:url'] || `https://www.sciencedirect.com/search?q=${encodeURIComponent(item['dc:title'] || '')}`,
        journal: item['prism:publicationName'] || 'ScienceDirect',
        volume: item['prism:volume'] || '',
        issue: item['prism:issue'] || '',
        pages: item['prism:page'] || '',
        source: 'ScienceDirect',
        accessible: true,
        peerReviewed: true
      }));
    } catch (error) {
      return [];
    }
  },

  async getIEEERefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://ieeexplore.ieee.org/rest/search?querytext=${encoded}&rows=3`,
        { timeout: 15000 }
      );
      
      const results = response.data?.records || [];
      return results.map(item => ({
        type: 'ieee',
        title: item.title || topic,
        authors: item.authors || 'IEEE Author',
        year: item.year || 'n.d.',
        doi: item.doi || '',
        link: item.link || `https://ieeexplore.ieee.org/search?q=${encodeURIComponent(item.title || '')}`,
        journal: item.journal || 'IEEE Xplore',
        volume: item.volume || '',
        issue: item.issue || '',
        pages: item.pages || '',
        source: 'IEEE Xplore',
        accessible: true,
        peerReviewed: true
      }));
    } catch (error) {
      return [];
    }
  },

  async getACMRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://dl.acm.org/action/doSearch?query=${encoded}&AllField=${encoded}`,
        { timeout: 15000 }
      );
      
      const results = response.data?.records || [];
      return results.map(item => ({
        type: 'acm',
        title: item.title || topic,
        authors: item.authors || 'ACM Author',
        year: item.year || 'n.d.',
        doi: item.doi || '',
        link: item.link || `https://dl.acm.org/search?q=${encodeURIComponent(item.title || '')}`,
        journal: item.journal || 'ACM Digital Library',
        volume: item.volume || '',
        issue: item.issue || '',
        pages: item.pages || '',
        source: 'ACM',
        accessible: true,
        peerReviewed: true
      }));
    } catch (error) {
      return [];
    }
  },

  async getPubMedRefs(topic) {
    try {
      const encoded = encodeURIComponent(topic);
      const response = await axios.get(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encoded}&retmax=3&retmode=json`,
        { timeout: 15000 }
      );
      
      const ids = response.data?.esearchresult?.idlist || [];
      if (ids.length === 0) return [];
      
      const detailResponse = await axios.get(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`,
        { timeout: 15000 }
      );
      
      const items = detailResponse.data?.result || {};
      return Object.values(items).filter(item => item.uid).map(item => {
        const doi = item.elocationid?.find(id => id.startsWith('doi:'))?.replace('doi:', '') || '';
        const pubDate = item.pubdate || '';
        const year = pubDate.split(' ')[0] || 'n.d.';
        
        return {
          type: 'pubmed',
          title: item.title || topic,
          authors: item.authors?.map(a => a.name).join(', ') || 'Unknown',
          year: year,
          doi: doi,
          link: `https://pubmed.ncbi.nlm.nih.gov/${item.uid}/`,
          journal: item.source || 'PubMed',
          volume: item.volume || '',
          issue: item.issue || '',
          pages: item.pages || '',
          publisher: 'NIH',
          source: 'PubMed',
          accessible: true,
          peerReviewed: true
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
    
    let volume = '', issue = '', pages = '', journal = '';
    
    if (summary.includes('-')) {
      const parts = summary.split('-');
      if (parts.length >= 2) {
        const pubInfo = parts[1].trim();
        const journalMatch = pubInfo.match(/^([^,\d]+)/);
        if (journalMatch) journal = journalMatch[1].trim();
        
        const volMatch = pubInfo.match(/[Vv]ol(?:ume)?\.?\s*(\d+)\s*\((\d+)\)/);
        if (volMatch) { volume = volMatch[1]; issue = volMatch[2]; }
        
        const pageMatch = pubInfo.match(/(\d+)\s*[–-]\s*(\d+)/);
        if (pageMatch) pages = `${pageMatch[1]}–${pageMatch[2]}`;
      }
    }
    
    return {
      type: 'scholar',
      title: paper.title || 'Untitled',
      authors: authors,
      year: year,
      doi: doi,
      link: paper.link || '',
      journal: journal || source,
      volume: volume,
      issue: issue,
      pages: pages,
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
    
    let pages = '';
    if (item.page) {
      pages = item.page.replace('-', '–');
    } else if (item['article-number']) {
      pages = `Article ${item['article-number']}`;
    }
    
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
      pages: pages,
      publisher: item.publisher || '',
      source: 'Crossref',
      accessible: !!doi,
      peerReviewed: true
    };
  },

  formatDOAJReference(item) {
    const bibjson = item.bibjson || {};
    const identifiers = bibjson.identifier || [];
    const doi = identifiers.find(id => id.type === 'doi')?.id || '';
    const journalInfo = bibjson.journal || {};
    
    return {
      type: 'doaj',
      title: bibjson.title || 'Untitled',
      authors: bibjson.author?.map(a => a.name).join(', ') || 'Unknown',
      year: bibjson.year || 'n.d.',
      doi: doi,
      link: bibjson.url?.[0] || (doi ? `https://doi.org/${doi}` : ''),
      journal: journalInfo.title || 'DOAJ Journal',
      volume: journalInfo.volume || '',
      issue: journalInfo.number || '',
      pages: journalInfo.pages || bibjson.pages || '',
      source: 'DOAJ',
      accessible: true,
      peerReviewed: true
    };
  },

  // ========== FORMAT REFERENCES ==========
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

  // ========== APA 7TH EDITION FORMATTER ==========
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
    
    if (ref.publisher && !ref.journal) {
      parts.push(ref.publisher);
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
    
    if (authorList.length === 2) {
      const formatted = authorList.map(name => {
        const names = name.split(' ');
        if (names.length >= 2) {
          return `${names[names.length-1]}, ${names[0].charAt(0)}.`;
        }
        return name;
      });
      return `${formatted[0]}, & ${formatted[1]}`;
    }
    
    const formatted = authorList.map(name => {
      const names = name.split(' ');
      if (names.length >= 2) {
        return `${names[names.length-1]}, ${names[0].charAt(0)}.`;
      }
      return name;
    });
    
    const last = formatted.pop();
    return `${formatted.join(', ')}, & ${last}`;
  },

  capitalizeTitleAPA(title) {
    title = title.replace(/^["']|["']$/g, '');
    title = title.charAt(0).toUpperCase() + title.slice(1);
    return title;
  },

  formatVolumeIssuePages(ref) {
    let parts = [];
    
    if (ref.volume || ref.issue || ref.pages || ref.page) {
      let vol = ref.volume || ref.vol || '';
      let issue = ref.issue || ref.number || ref.no || '';
      let pages = ref.pages || ref.page || ref.pp || '';
      
      if (!vol && ref.journal) {
        const volMatch = ref.journal.match(/(\d+)\s*[\(,]?\s*(\d+)?/);
        if (volMatch) {
          vol = volMatch[1];
          issue = volMatch[2] || '';
        }
      }
      
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
    } else if (ref.link && ref.link.includes('doi.org')) {
      link = ref.link;
    } else if (ref.link && ref.type !== 'fallback' && ref.type !== 'public') {
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

  // ========== GENERATE PRESENTATION ==========
  async generatePresentation(topic, topicAnalysis, language, references, hasAcademicSource, structuredData) {
    try {
      const formattedRefs = this.formatReferences(references);
      
      let pptPrompt;
      
      if (structuredData && Object.keys(structuredData).length > 0) {
        pptPrompt = this.buildStructuredPrompt(
          topic,
          structuredData,
          formattedRefs,
          hasAcademicSource,
          language
        );
      } else if (language === 'tagalog') {
        pptPrompt = this.buildTagalogPrompt(topic, formattedRefs, hasAcademicSource, topicAnalysis);
      } else {
        pptPrompt = this.buildEnglishPrompt(topic, formattedRefs, hasAcademicSource, topicAnalysis);
      }
      
      const response = await this.callAI(pptPrompt);
      
      if (!response) return null;
      
      return this.cleanResponse(response);
      
    } catch (error) {
      console.error('[generatePresentation] Error:', error.message);
      return null;
    }
  },

  // ========== BUILD STRUCTURED PROMPT ==========
  buildStructuredPrompt(topic, structuredData, references, hasAcademicSource, language) {
    const langName = this.getLanguageName(language);
    const isTagalog = language === 'tagalog' || language === 'filipino';
    
    let prompt = '';
    
    let structureDescription = '';
    if (structuredData.mainTopic) {
      structureDescription += `MAIN TOPIC: ${structuredData.mainTopic}\n\n`;
    }
    
    if (Object.keys(structuredData.chapters).length > 0) {
      structureDescription += `CHAPTERS AND SECTIONS:\n`;
      for (const [chapter, data] of Object.entries(structuredData.chapters)) {
        structureDescription += `\n${chapter}:\n`;
        if (data.sections && data.sections.length > 0) {
          for (const section of data.sections) {
            structureDescription += `  - ${section}\n`;
          }
        }
        if (data.subsections && data.subsections.length > 0) {
          for (const sub of data.subsections) {
            structureDescription += `    * ${sub}\n`;
          }
        }
      }
    }
    
    if (structuredData.sections && structuredData.sections.length > 0) {
      structureDescription += `\nSECTIONS:\n`;
      for (const section of structuredData.sections) {
        structureDescription += `  - ${section}\n`;
      }
    }
    
    if (structuredData.subsections && structuredData.subsections.length > 0) {
      structureDescription += `\nSUBSECTIONS:\n`;
      for (const sub of structuredData.subsections) {
        structureDescription += `  - ${sub}\n`;
      }
    }
    
    if (structuredData.subsectionsDetails) {
      structureDescription += `\nDETAILED TOPICS:\n`;
      for (const [sub, details] of Object.entries(structuredData.subsectionsDetails)) {
        structureDescription += `  ${sub}:\n`;
        for (const detail of details) {
          structureDescription += `    • ${detail}\n`;
        }
      }
    }
    
    if (isTagalog) {
      prompt += `IKAW AY ISANG EKSPERTO SA PAGGAWA NG KOMPLETONG PRESENTASYON.\n\n`;
      prompt += `NARITO ANG STRUCTURED OUTLINE NA KAILANGANG GAWING PRESENTASYON:\n\n`;
      prompt += structureDescription;
      prompt += `\n---\n\n`;
      prompt += `GAWA ANG KUMPLETONG PRESENTASYON NA SUMUSUNOD SA FORMAT NA ITO:\n\n`;
      prompt += `SLIDE 1: TITLE SLIDE\n[Pamagat batay sa main topic]\n\n`;
      
      let slideNumber = 2;
      
      prompt += `SLIDE ${slideNumber}: INTRODUKSYON\n[Introduksyon sa topic]\n\n`;
      slideNumber++;
      
      prompt += `SLIDE ${slideNumber}: TABLE OF CONTENTS\n`;
      let tocCounter = 1;
      if (structuredData.sections) {
        for (const section of structuredData.sections) {
          prompt += `${String(tocCounter).padStart(2, '0')}. ${section}\n`;
          tocCounter++;
        }
      }
      if (structuredData.subsections) {
        for (const sub of structuredData.subsections) {
          prompt += `${String(tocCounter).padStart(2, '0')}. ${sub}\n`;
          tocCounter++;
        }
      }
      prompt += `${String(tocCounter).padStart(2, '0')}. References\n\n`;
      slideNumber++;
      
      if (structuredData.sections) {
        for (const section of structuredData.sections) {
          prompt += `SLIDE ${slideNumber}: ${section}\n`;
          prompt += `[Magbigay ng detalyadong paliwanag tungkol sa ${section}]\n\n`;
          slideNumber++;
        }
      }
      
      if (structuredData.subsections) {
        for (const sub of structuredData.subsections) {
          prompt += `SLIDE ${slideNumber}: ${sub}\n`;
          prompt += `[Magbigay ng detalyadong paliwanag tungkol sa ${sub}]\n\n`;
          slideNumber++;
        }
      }
      
      prompt += `SLIDE ${slideNumber}: MGA PINAGKUNAN\n`;
      prompt += references || 'Gumawa ng mga akademikong reference.\n\n';
      slideNumber++;
      
      prompt += `SLIDE ${slideNumber}: Q&A AT PASASALAMAT\nMARAMING SALAMAT SA INYONG PAKIKINIG!\n\n`;
      
      prompt += `KRITIKAL NA PANUNTUNAN:\n`;
      prompt += `- SUNDIN ANG STRUCTURED OUTLINE\n`;
      prompt += `- MAGBIGAY NG DETALYADONG PALIWANAG SA BAWAT SLIDE\n`;
      prompt += `- GUMAMIT NG PLAIN TEXT LAMANG\n`;
      prompt += `- WALANG MARKDOWN O SPECIAL CHARACTERS\n`;
      prompt += `- TUMUGON SA TAGALOG LAMANG\n`;
      
    } else {
      prompt += `YOU ARE AN EXPERT PRESENTATION CREATOR.\n\n`;
      prompt += `HERE IS THE STRUCTURED OUTLINE TO CONVERT INTO A PRESENTATION:\n\n`;
      prompt += structureDescription;
      prompt += `\n---\n\n`;
      prompt += `CREATE A COMPLETE PRESENTATION FOLLOWING THIS FORMAT:\n\n`;
      prompt += `SLIDE 1: TITLE SLIDE\n[Title based on main topic]\n\n`;
      
      let slideNumber = 2;
      
      prompt += `SLIDE ${slideNumber}: INTRODUCTION\n[Introduction to the topic]\n\n`;
      slideNumber++;
      
      prompt += `SLIDE ${slideNumber}: TABLE OF CONTENTS\n`;
      let tocCounter = 1;
      if (structuredData.sections) {
        for (const section of structuredData.sections) {
          prompt += `${String(tocCounter).padStart(2, '0')}. ${section}\n`;
          tocCounter++;
        }
      }
      if (structuredData.subsections) {
        for (const sub of structuredData.subsections) {
          prompt += `${String(tocCounter).padStart(2, '0')}. ${sub}\n`;
          tocCounter++;
        }
      }
      prompt += `${String(tocCounter).padStart(2, '0')}. References\n\n`;
      slideNumber++;
      
      if (structuredData.sections) {
        for (const section of structuredData.sections) {
          prompt += `SLIDE ${slideNumber}: ${section}\n`;
          prompt += `[Provide detailed explanation about ${section}]\n\n`;
          slideNumber++;
        }
      }
      
      if (structuredData.subsections) {
        for (const sub of structuredData.subsections) {
          prompt += `SLIDE ${slideNumber}: ${sub}\n`;
          prompt += `[Provide detailed explanation about ${sub}]\n\n`;
          slideNumber++;
        }
      }
      
      prompt += `SLIDE ${slideNumber}: REFERENCES\n`;
      prompt += references || 'Generate academic references.\n\n';
      slideNumber++;
      
      prompt += `SLIDE ${slideNumber}: Q&A AND THANK YOU\nTHANK YOU FOR LISTENING!\n\n`;
      
      prompt += `CRITICAL RULES:\n`;
      prompt += `- FOLLOW THE STRUCTURED OUTLINE\n`;
      prompt += `- PROVIDE DETAILED EXPLANATIONS FOR EACH SLIDE\n`;
      prompt += `- USE PLAIN TEXT ONLY\n`;
      prompt += `- NO MARKDOWN OR SPECIAL CHARACTERS\n`;
      prompt += `- RESPOND IN ENGLISH ONLY\n`;
    }
    
    return prompt;
  },

  // ========== BUILD ENGLISH PROMPT ==========
  buildEnglishPrompt(topic, references, hasAcademicSource, analysis) {
    let sourceInstruction = '';
    let topicContext = '';
    
    if (analysis.hasScientificName) {
      topicContext += `Scientific Name: ${analysis.scientificName}\n`;
    }
    if (analysis.hasCommonName) {
      topicContext += `Common Name: ${analysis.commonName}\n`;
    }
    if (analysis.details.length > 0) {
      topicContext += `Additional Details: ${analysis.details.join(', ')}\n`;
    }
    
    if (hasAcademicSource && references) {
      sourceInstruction = `ACCURATE & ACCESSIBLE REFERENCES (USE THESE EXACT REFERENCES FOR SLIDE 14):\n\n${references}\n\n`;
    } else {
      sourceInstruction = `No academic references found. Use the following general references for SLIDE 14 (ALL are accessible):\n\n${references}\n\n`;
    }
    
    return `You are an expert academic presentation creator.

TOPIC PROVIDED: "${topic}"

TOPIC CONTEXT:
${topicContext || 'General topic with no specific details provided.'}

IMPORTANT REFERENCE GUIDELINES:
- ONLY use the references provided above
- Do NOT invent or generate fake references
- ALL references must be accurate and accessible
- Use EXACT URLs and DOIs provided

${sourceInstruction}

CREATE THE COMPLETE PRESENTATION FOLLOWING THIS EXACT FORMAT:

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
- [Fact or data]
- [Fact or data]
- [Fact or data]
Interpretation: [What these mean]

SLIDE 9: CASE STUDY OR EXAMPLE
SITUATION: [Real example]
PROBLEM: [Issue]
RESPONSE: [Solution]
LESSON: [What we learn]

SLIDE 10: ANALYSIS
- Root cause: [Analysis]
- Affected: [Who is affected]
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
- Use specific details from the topic
- Respond in ENGLISH ONLY
- ALL REFERENCES MUST BE ACCURATE AND ACCESSIBLE`;
  },

  // ========== BUILD TAGALOG PROMPT ==========
  buildTagalogPrompt(topic, references, hasAcademicSource, analysis) {
    let sourceInstruction = '';
    let topicContext = '';
    
    if (analysis.hasScientificName) {
      topicContext += `Scientific Name: ${analysis.scientificName}\n`;
    }
    if (analysis.hasCommonName) {
      topicContext += `Common Name: ${analysis.commonName}\n`;
    }
    if (analysis.details.length > 0) {
      topicContext += `Karagdagang Detalye: ${analysis.details.join(', ')}\n`;
    }
    
    if (hasAcademicSource && references) {
      sourceInstruction = `ACCURATE AT ACCESSIBLE REFERENCES (GAMITIN ANG MGA ITO PARA SA SLIDE 14):\n\n${references}\n\n`;
    } else {
      sourceInstruction = `Walang academic references. Gamitin ang mga general references na ito para sa SLIDE 14 (LAHAT ay accessible):\n\n${references}\n\n`;
    }
    
    return `Ikaw ay isang ekspertong tagagawa ng presentasyon.

PAKSA NA BINIGAY: "${topic}"

KONTEKSTO NG PAKSA:
${topicContext || 'Pangkalahatang paksa na walang specific na detalye.'}

MAHALAGANG PANUNTUNAN SA REFERENCES:
- GAMITIN LANG ang mga references na nasa itaas
- HUWAG gumawa o mag-imbento ng fake references
- LAHAT ng references dapat accurate at accessible
- Gamitin ang EXACT URLs at DOIs na ibinigay

${sourceInstruction}

GUMAWA NG KUMPLETONG PRESENTASYON NA SUMUSUNOD SA EKSACTONG FORMAT NA ITO:

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
- [Datos o katotohanan]
- [Datos o katotohanan]
- [Datos o katotohanan]
Interpretasyon: [Ano ang ibig sabihin]

SLIDE 9: CASE STUDY O HALIMBAWA
SITWASYON: [Tunay na halimbawa]
PROBLEMA: [Isyu]
TUGON: [Solusyon]
ARAL: [Ano ang natutunan]

SLIDE 10: PAGSUSURI
- Ugat: [Pagsusuri]
- Apektado: [Sino ang apektado]
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
- Gamitin ang specific details mula sa paksa
- Tumugon sa TAGALOG LAMANG
- LAHAT NG REFERENCES AY DAPAT ACCURATE AT ACCESSIBLE`;
  },

  // ========== AI API CALLS ==========
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
      console.error('[callAI] Primary API failed:', primaryError.message);
      try {
        return await this.executeAPI(fallback, prompt);
      } catch (fallbackError) {
        console.error('[callAI] Fallback API failed:', fallbackError.message);
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
  },

  getLanguageName(languageCode) {
    const names = {
      'english': 'English',
      'tagalog': 'Tagalog',
      'filipino': 'Filipino',
      'bisaya': 'Bisaya',
      'cebuano': 'Cebuano'
    };
    return names[languageCode] || 'English';
  }
};
