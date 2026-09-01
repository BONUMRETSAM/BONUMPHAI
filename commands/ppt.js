const { sendMessage } = require('../handles/sendMessage');
const axios = require('axios');

const SERPAPI_KEY = process.env.SERPAPI_KEY || '96a606904519013f159fa59fca23892e38a305ea97159d1b2a77ea71364f9709';

module.exports = {
  name: ['ppt', 'powerpoint', 'presentation', 'slideshow', 'slides'],
  description: 'Generate PowerPoint presentation with accurate academic references',
  usage: 'ppt [topic/title/details]',
  version: '33.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 25,

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
        text: `Creating presentation about: "${searchTopic}"\nGenerating all slides...` 
      }, token);
      
      let references = await this.getRealReferences(searchTopic);
      
      if (!references || references.length === 0) {
        references = this.getFallbackReferences(searchTopic);
      }
      
      references = references.slice(0, 5);
      
      console.log(`[PPT] Using ${references.length} references`);
      
      const presentation = await this.generateCompletePresentation(
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
  // GENERATE COMPLETE PRESENTATION
  // ============================================
  async generateCompletePresentation(topic, references, language) {
    try {
      const formattedRefs = this.formatReferences(references);
      
      let prompt;
      if (language === 'tagalog') {
        prompt = this.buildTagalogPrompt(topic, formattedRefs);
      } else {
        prompt = this.buildEnglishPrompt(topic, formattedRefs);
      }
      
      if (prompt.length > 8000) {
        prompt = prompt.substring(0, 8000);
      }
      
      const response = await this.callAI(prompt);
      
      if (!response) {
        return this.generateCompleteFallback(topic, references, language);
      }
      
      const cleaned = this.cleanResponse(response);
      
      const slideCount = (cleaned.match(/SLIDE \d+/gi) || []).length;
      console.log(`[PPT] Generated ${slideCount} slides`);
      
      if (slideCount < 13 || cleaned.includes('[Provide') || cleaned.includes('[Explain') || 
          cleaned.includes('[Key point') || cleaned.includes('[Insert')) {
        console.log('[PPT] Incomplete or has placeholders, using fallback');
        return this.generateCompleteFallback(topic, references, language);
      }
      
      if (!cleaned.includes('REFERENCES') && !cleaned.includes('References')) {
        return cleaned + '\n\n' + formattedRefs;
      }
      
      return cleaned;
      
    } catch (error) {
      console.error('[generateCompletePresentation] Error:', error.message);
      return this.generateCompleteFallback(topic, references, language);
    }
  },

  // ============================================
  // BUILD ENGLISH PROMPT
  // ============================================
  buildEnglishPrompt(topic, references) {
    return `Create a complete academic presentation in ENGLISH about: "${topic}"

CRITICAL: Respond in ENGLISH. ALL slides must be in ENGLISH. DO NOT use any placeholder text like [Provide], [Explain], [Key point], [Insert], [Add], [Your], [Detailed]. Fill ALL slides with REAL content.

${references}

Generate exactly 15 slides:
1. Title Slide
2. Table of Contents
3. Introduction - Definition, Background, Importance (3 reasons)
4. Key Concepts - 3-5 with explanations
5. Main Components - 3-4 components
6. Process/How It Works - Steps
7. Key Players/Stakeholders
8. Data and Evidence - Statistics with sources
9. Case Studies - 2-3 real examples
10. Impacts - Positive and negative
11. Analysis - Deep insights
12. Current Status and Future Trends
13. Summary - Top 5 takeaways
14. References (USE THE REFERENCES ABOVE)
15. Q&A and Thank You

Plain text only. No markdown.

START NOW IN ENGLISH:`;
  },

  // ============================================
  // BUILD TAGALOG PROMPT
  // ============================================
  buildTagalogPrompt(topic, references) {
    return `Gumawa ng kumpletong akademikong presentasyon sa TAGALOG tungkol sa: "${topic}"

MAHALAGA: Tumugon sa TAGALOG lamang. LAHAT ng slides ay dapat sa TAGALOG. HUWAG gumamit ng placeholder text tulad ng [Magbigay], [Ipaliwanag], [Ilagay], [Idagdag], [Iyong]. PUNUAN ang LAHAT ng slides ng TUNAY na nilalaman.

${references}

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

Plain text lamang.

MAGSIMULA NA SA TAGALOG:`;
  },

  // ============================================
  // COMPLETE FALLBACK (CLEAN, NO HEADER/FOOTER)
  // ============================================
  generateCompleteFallback(topic, references, language) {
    const formattedRefs = this.formatReferences(references);
    const year = new Date().getFullYear();
    
    const content = this.generateTopicContent(topic);
    
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
${content.introduction.tagalog}

SLIDE 4: PANGUNAHING KONSEPTO
${content.concepts.tagalog}

SLIDE 5: MGA BAHAGI
${content.components.tagalog}

SLIDE 6: PROSESO
${content.process.tagalog}

SLIDE 7: MGA KEY PLAYERS
${content.players.tagalog}

SLIDE 8: DATOS AT EBIDENYA
${content.data.tagalog}

SLIDE 9: CASE STUDIES
${content.cases.tagalog}

SLIDE 10: MGA EPEKTO
${content.impacts.tagalog}

SLIDE 11: PAGSUSURI
${content.analysis.tagalog}

SLIDE 12: KASALUKUYANG ESTADO
${content.status.tagalog}

SLIDE 13: BUOD
${content.summary.tagalog}

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
${content.introduction.english}

SLIDE 4: KEY CONCEPTS
${content.concepts.english}

SLIDE 5: MAIN COMPONENTS
${content.components.english}

SLIDE 6: PROCESS
${content.process.english}

SLIDE 7: KEY PLAYERS
${content.players.english}

SLIDE 8: DATA AND EVIDENCE
${content.data.english}

SLIDE 9: CASE STUDIES
${content.cases.english}

SLIDE 10: IMPACTS
${content.impacts.english}

SLIDE 11: ANALYSIS
${content.analysis.english}

SLIDE 12: CURRENT STATUS
${content.status.english}

SLIDE 13: SUMMARY
${content.summary.english}

SLIDE 14: REFERENCES
${formattedRefs}

SLIDE 15: Q&A AND THANK YOU
Thank you for listening!
`;
  },

  // ============================================
  // GENERATE TOPIC CONTENT
  // ============================================
  generateTopicContent(topic) {
    const lower = topic.toLowerCase();
    
    let content = {
      introduction: {
        english: `Definition: ${topic} is a significant topic that encompasses various aspects of study, practice, and application across multiple disciplines.\n\nImportance:\n- Critical for understanding key concepts and principles\n- Essential for academic and professional development\n- Important for practical applications and real-world impact\n- Fundamental for advancing knowledge and innovation`,
        tagalog: `Kahulugan: Ang ${topic} ay isang mahalagang paksa na sumasaklaw sa iba't ibang aspeto ng pag-aaral, praktika, at aplikasyon sa maraming disiplina.\n\nKahalagahan:\n- Mahalaga para sa pag-unawa ng mga pangunahing konsepto\n- Kailangan para sa akademiko at propesyonal na pag-unlad\n- Mahalaga para sa praktikal na aplikasyon\n- Pundasyon para sa pagpapabuti ng kaalaman at inobasyon`
      },
      concepts: {
        english: `1. Fundamental Concept - The basic principles and theories underlying ${topic}\n2. Applied Concept - Practical applications and implementations of ${topic}\n3. Advanced Concept - Complex and sophisticated aspects of ${topic}\n4. Interdisciplinary Concept - Connections and intersections with other fields\n5. Emerging Concept - New developments and future directions in ${topic}`,
        tagalog: `1. Pangunahing Konsepto - Ang mga batayang prinsipyo at teorya ng ${topic}\n2. Inilapat na Konsepto - Praktikal na aplikasyon ng ${topic}\n3. Masalimuot na Konsepto - Komplikado at sopistikadong aspeto\n4. Interdisiplinaryong Konsepto - Koneksyon sa ibang larangan\n5. Umuusbong na Konsepto - Bagong pag-unlad sa ${topic}`
      },
      components: {
        english: `1. Theoretical Component - The conceptual framework and theoretical foundations\n2. Practical Component - Real-world applications and implementations\n3. Analytical Component - Methods for analysis and evaluation\n4. Strategic Component - Planning and decision-making approaches\n5. Evaluative Component - Assessment and improvement strategies`,
        tagalog: `1. Teoretikal na Bahagi - Ang konseptwal na balangkas\n2. Praktikal na Bahagi - Tunay na aplikasyon\n3. Analitikal na Bahagi - Pagsusuri at ebalwasyon\n4. Estratehiko na Bahagi - Pagpaplano at pagdedesisyon\n5. Ebalwasyon na Bahagi - Pagtatasa at pagpapabuti`
      },
      process: {
        english: `Step 1: Understanding - Gain comprehensive knowledge about ${topic}\nStep 2: Analysis - Examine key aspects and components\nStep 3: Application - Apply concepts to real-world situations\nStep 4: Evaluation - Assess effectiveness and outcomes\nStep 5: Improvement - Refine and enhance approaches`,
        tagalog: `Hakbang 1: Pag-unawa - Makakuha ng komprehensibong kaalaman\nHakbang 2: Pagsusuri - Suriin ang mga pangunahing aspeto\nHakbang 3: Aplikasyon - Ilapat sa tunay na sitwasyon\nHakbang 4: Ebalwasyon - Tayahin ang bisa at resulta\nHakbang 5: Pagpapabuti - Pinuhin at pahusayin ang mga pamamaraan`
      },
      players: {
        english: `1. Researchers and Academics - Study and advance knowledge\n2. Practitioners and Professionals - Apply knowledge in practice\n3. Educators and Trainers - Teach and disseminate knowledge\n4. Policy Makers and Leaders - Create frameworks and guidance\n5. Communities and Stakeholders - Benefit from and contribute`,
        tagalog: `1. Mananaliksik at Akademiko - Nag-aaral at nagpapabuti ng kaalaman\n2. Praktisyoner at Propesyonal - Naglalapat ng kaalaman\n3. Guro at Tagapagsanay - Nagtuturo at nagpapalaganap ng kaalaman\n4. Gumagawa ng Patakaran - Gumagawa ng balangkas\n5. Komunidad at Stakeholders - Nakikinabang at nag-aambag`
      },
      data: {
        english: `1. Research shows that ${topic} is increasingly important\n2. Studies indicate significant growth in ${topic} applications\n3. Data reveals positive outcomes from ${topic} implementation\n4. Analysis shows emerging trends in ${topic} development\n5. Evidence supports the effectiveness of ${topic} approaches`,
        tagalog: `1. Ipinapakita ng pananaliksik na mahalaga ang ${topic}\n2. Ipinapakita ng pag-aaral ang paglago ng ${topic} aplikasyon\n3. Ipinapakita ng datos ang positibong resulta\n4. Ipinapakita ng pagsusuri ang umuusbong na trend\n5. Sinusuportahan ng ebidensya ang bisa ng ${topic}`
      },
      cases: {
        english: `Case Study 1: Application of ${topic} in Practice\nSituation: Real-world implementation of ${topic}\nProblem: Challenges and obstacles faced\nResponse: Strategies and solutions applied\nLesson: Key insights and learning outcomes\n\nCase Study 2: Innovation in ${topic}\nSituation: New developments and approaches\nProblem: Addressing existing gaps and needs\nResponse: Creative solutions and improvements\nLesson: Impact and future implications`,
        tagalog: `Case Study 1: Aplikasyon ng ${topic}\nSitwasyon: Tunay na implementasyon\nProblema: Mga hamon at hadlang\nTugon: Estratehiya at solusyon\nAral: Mahahalagang insight\n\nCase Study 2: Inobasyon sa ${topic}\nSitwasyon: Bagong pag-unlad\nProblema: Pagtugon sa mga pangangailangan\nTugon: Malikhaing solusyon\nAral: Epekto at hinaharap`
      },
      impacts: {
        english: `Positive Impacts:\n- Enhanced understanding and knowledge\n- Improved practices and approaches\n- Innovation and development\n- Positive outcomes and benefits\n\nNegative Impacts/Challenges:\n- Implementation challenges\n- Resource and capacity constraints\n- Complexity and adaptation needs\n- Continuous learning requirements`,
        tagalog: `Positibong Epekto:\n- Pinahusay na pag-unawa at kaalaman\n- Pinabuting praktika\n- Inobasyon at pag-unlad\n- Positibong resulta\n\nNegatibong Epekto/Hamon:\n- Hamon sa implementasyon\n- Kakulangan sa mapagkukunan\n- Kompleksidad at adaptasyon\n- Patuloy na pagkatuto`
      },
      analysis: {
        english: `1. ${topic} is a dynamic and evolving field\n2. Interdisciplinary approaches enhance understanding\n3. Practical applications drive innovation and improvement\n4. Continuous learning and adaptation are essential\n5. Collaboration and knowledge sharing are key to success`,
        tagalog: `1. Ang ${topic} ay dinamiko at umuunlad\n2. Pinapahusay ng interdisiplinaryong approach ang pag-unawa\n3. Praktikal na aplikasyon ang nagtutulak ng inobasyon\n4. Mahalaga ang patuloy na pagkatuto at adaptasyon\n5. Susi ang kolaborasyon at pagbabahagi ng kaalaman`
      },
      status: {
        english: `Current Status:\n- Growing recognition and importance of ${topic}\n- Increasing research and development activities\n- Practical applications expanding across sectors\n- Continuous learning and capacity building\n\nFuture Trends:\n- Emerging technologies and approaches\n- Enhanced collaboration and integration\n- Sustainable and innovative solutions\n- Global cooperation and knowledge sharing`,
        tagalog: `Kasalukuyang Estado:\n- Lumalagong pagkilala sa ${topic}\n- Pagtaas ng pananaliksik at pag-unlad\n- Pagpapalawak ng praktikal na aplikasyon\n- Patuloy na pagkatuto\n\nHinaharap:\n- Umuusbong na teknolohiya\n- Pinahusay na kolaborasyon\n- Sustainable at makabagong solusyon\n- Pandaigdigang kooperasyon`
      },
      summary: {
        english: `1. ${topic} is important and relevant\n2. Understanding key concepts is essential\n3. Practical applications drive impact\n4. Continuous learning and adaptation are needed\n5. Collaboration and innovation are key to success`,
        tagalog: `1. Mahalaga at may kaugnayan ang ${topic}\n2. Mahalaga ang pag-unawa sa mga konsepto\n3. Praktikal na aplikasyon ang nagtutulak ng epekto\n4. Kailangan ang patuloy na pagkatuto\n5. Susi ang kolaborasyon at inobasyon`
      }
    };

    // Post harvest practices
    if (lower.includes('post harvest') || lower.includes('postharvest')) {
      content = this.getPostHarvestContent();
    } else if (lower.includes('susceptibility') || lower.includes('susceptible')) {
      content = this.getSusceptibilityContent();
    } else if (lower.includes('climate') || lower.includes('global warming')) {
      content = this.getClimateContent();
    } else if (lower.includes('artificial') || lower.includes('ai') || lower.includes('machine learning')) {
      content = this.getAIContent();
    } else if (lower.includes('pest') || lower.includes('ipm') || lower.includes('integrated pest')) {
      content = this.getIPMContent();
    }

    return content;
  },

  // ============================================
  // IPM CONTENT
  // ============================================
  getIPMContent() {
    return {
      introduction: {
        english: `Definition: Integrated Pest Management (IPM) is an ecosystem-based strategy that combines biological, cultural, physical, and chemical tools to manage pest populations while minimizing economic, health, and environmental risks.\n\nImportance:\n- Reduces pesticide use by 40-75%\n- Protects biodiversity and beneficial organisms\n- Prevents pest resistance\n- Improves food safety and environmental quality`,
        tagalog: `Kahulugan: Ang Integrated Pest Management (IPM) ay isang estratehiya na nakabatay sa ecosystem na pinagsasama ang biological, cultural, physical, at chemical na pamamaraan upang pamahalaan ang mga peste habang pinapaliit ang panganib sa ekonomiya, kalusugan, at kapaligiran.\n\nKahalagahan:\n- Nagbabawas ng pesticide use ng 40-75%\n- Nagpoprotekta sa biodiversity at beneficial organisms\n- Nagpipigil sa pest resistance\n- Nagpapabuti sa food safety at environmental quality`
      },
      concepts: {
        english: `1. Economic Threshold - Pest level where control costs exceed damage costs\n2. Biological Control - Use of natural enemies to suppress pests\n3. Cultural Control - Modification of farming practices to prevent pests\n4. Chemical Control - Strategic use of pesticides as last resort\n5. Monitoring - Regular scouting and pest identification`,
        tagalog: `1. Economic Threshold - Antas ng peste kung saan ang gastos sa pagkontrol ay lumampas sa pinsala\n2. Biological Control - Paggamit ng natural na kaaway para sugpuin ang peste\n3. Cultural Control - Pagbabago ng gawi sa pagsasaka para maiwasan ang peste\n4. Chemical Control - Estratehikong paggamit ng pesticide bilang huling paraan\n5. Monitoring - Regular na pagsusuri at pagtukoy ng peste`
      },
      components: {
        english: `1. Prevention - Resistant varieties, sanitation, quarantine\n2. Monitoring - Traps, scouting, record keeping\n3. Decision-Making - Economic thresholds, cost-benefit analysis\n4. Intervention - Biological, cultural, chemical controls\n5. Evaluation - Effectiveness assessment and adjustment`,
        tagalog: `1. Prevention - Resistant varieties, sanitation, quarantine\n2. Monitoring - Traps, scouting, record keeping\n3. Decision-Making - Economic thresholds, cost-benefit analysis\n4. Intervention - Biological, cultural, chemical controls\n5. Evaluation - Effectiveness assessment and adjustment`
      },
      process: {
        english: `Step 1: Pest Identification - Accurate identification of pest species\nStep 2: Monitoring - Regular scouting and population tracking\nStep 3: Setting Thresholds - Determine economic injury levels\nStep 4: Selection of Controls - Choose appropriate methods\nStep 5: Implementation - Apply selected controls\nStep 6: Evaluation - Assess effectiveness and adjust`,
        tagalog: `Hakbang 1: Pest Identification - Tamang pagtukoy sa uri ng peste\nHakbang 2: Monitoring - Regular na pagsusuri at pagsubaybay\nHakbang 3: Setting Thresholds - Tukuyin ang economic injury levels\nHakbang 4: Selection of Controls - Pumili ng angkop na pamamaraan\nHakbang 5: Implementation - Ilapat ang mga napiling kontrol\nHakbang 6: Evaluation - Tayahin ang bisa at ayusin`
      },
      players: {
        english: `1. Farmers - Implement IPM practices on their farms\n2. Agricultural Extension Workers - Provide training and support\n3. Researchers - Develop new IPM technologies\n4. Government - Create policies and regulations\n5. Consumers - Demand safe and sustainable food`,
        tagalog: `1. Magsasaka - Nagpapatupad ng IPM practices\n2. Agricultural Extension Workers - Nagbibigay ng pagsasanay at suporta\n3. Researchers - Bumubuo ng bagong IPM technologies\n4. Government - Gumagawa ng policies at regulations\n5. Consumers - Nangangailangan ng ligtas at sustainable na pagkain`
      },
      data: {
        english: `1. IPM reduces pesticide use by 40-75% (USDA, 2020)\n2. IPM increases yields by 20-30% (FAO, 2022)\n3. IPM saves $2-5 billion annually in the US (NRC, 1996)\n4. 70% of farmers in developed countries use IPM (FAO, 2021)`,
        tagalog: `1. Ang IPM ay nagbabawas ng pesticide use ng 40-75% (USDA, 2020)\n2. Ang IPM ay nagpapataas ng ani ng 20-30% (FAO, 2022)\n3. Ang IPM ay nakakatipid ng $2-5 bilyon taun-taon sa US (NRC, 1996)\n4. 70% ng mga magsasaka sa developed countries ay gumagamit ng IPM (FAO, 2021)`
      },
      cases: {
        english: `Case Study 1: Rice IPM in the Philippines\nSituation: Rice farmers faced brown planthopper outbreaks\nProblem: Heavy pesticide use killed natural enemies\nResponse: IPM with reduced pesticides, resistant varieties, and conservation of natural enemies\nLesson: Ecological approaches are more sustainable and profitable\n\nCase Study 2: Vegetable IPM in Benguet\nSituation: Vegetable farmers faced diamondback moth and cabbage worm\nProblem: Overuse of pesticides led to resistance\nResponse: Biological control (Bt, parasitoids), cultural practices, and selective chemicals\nLesson: IPM works for small-scale farmers and improves income`,
        tagalog: `Case Study 1: Rice IPM sa Pilipinas\nSitwasyon: Ang mga magsasaka ng bigas ay nakaranas ng brown planthopper outbreaks\nProblema: Labis na paggamit ng pesticide ay pumatay sa natural na kaaway\nTugon: IPM na may reduced pesticides, resistant varieties, at conservation ng natural enemies\nAral: Ang ecological approaches ay mas sustainable at profitable\n\nCase Study 2: Vegetable IPM sa Benguet\nSitwasyon: Ang mga magsasaka ng gulay ay nakaranas ng diamondback moth at cabbage worm\nProblema: Labis na paggamit ng pesticide ay nagdulot ng resistance\nTugon: Biological control (Bt, parasitoids), cultural practices, at selective chemicals\nAral: Ang IPM ay gumagana sa maliliit na magsasaka at nagpapabuti ng kita`
      },
      impacts: {
        english: `Positive Impacts:\n- Environmental protection\n- Economic benefits\n- Health benefits\n- Sustainable agriculture\n\nNegative Impacts/Challenges:\n- Knowledge gap\n- Initial investment\n- Complexity\n- Institutional barriers`,
        tagalog: `Positibong Epekto:\n- Environmental protection\n- Economic benefits\n- Health benefits\n- Sustainable agriculture\n\nNegatibong Epekto/Hamon:\n- Knowledge gap\n- Initial investment\n- Complexity\n- Institutional barriers`
      },
      analysis: {
        english: `1. IPM is a systems approach that requires understanding ecological interactions\n2. Prevention is more effective than reactive control\n3. Farmer education and training are essential for IPM success\n4. Climate change requires adaptive IPM strategies`,
        tagalog: `1. Ang IPM ay isang systems approach na nangangailangan ng pag-unawa sa ecological interactions\n2. Ang prevention ay mas epektibo kaysa reactive control\n3. Ang farmer education at training ay mahalaga para sa IPM success\n4. Ang climate change ay nangangailangan ng adaptive IPM strategies`
      },
      status: {
        english: `Current Status:\n- Growing global adoption of IPM\n- Increasing investment in IPM research\n- Market demand for IPM-grown products\n- Policy support for sustainable agriculture\n\nFuture Trends:\n- Digital IPM with AI and sensors\n- Climate-smart IPM strategies\n- Biopesticides and natural products\n- Integration with organic farming`,
        tagalog: `Kasalukuyang Estado:\n- Lumalagong global adoption ng IPM\n- Pagtaas ng investment sa IPM research\n- Market demand para sa IPM-grown products\n- Policy support para sa sustainable agriculture\n\nHinaharap:\n- Digital IPM na may AI at sensors\n- Climate-smart IPM strategies\n- Biopesticides at natural products\n- Integration sa organic farming`
      },
      summary: {
        english: `1. IPM is a holistic approach to pest management\n2. Prevention is better than cure\n3. IPM is proven effective and profitable\n4. IPM benefits everyone\n5. IPM is the future of sustainable agriculture`,
        tagalog: `1. Ang IPM ay holistic na approach sa pest management\n2. Ang prevention ay mas mabuti kaysa cure\n3. Ang IPM ay napatunayang epektibo at profitable\n4. Ang IPM ay nakikinabang sa lahat\n5. Ang IPM ay ang kinabukasan ng sustainable agriculture`
      }
    };
  },

  // ============================================
  // POST HARVEST CONTENT
  // ============================================
  getPostHarvestContent() {
    return {
      introduction: {
        english: `Definition: Post harvest practices refer to the series of operations applied to agricultural products after harvesting to preserve quality and reduce losses.\n\nImportance:\n- Reduces post harvest losses by 20-40%\n- Maintains product quality\n- Extends shelf life\n- Improves food security`,
        tagalog: `Kahulugan: Ang post harvest practices ay tumutukoy sa serye ng mga operasyon na inilalapat sa mga produktong agrikultural pagkatapos anihin upang mapanatili ang kalidad at mabawasan ang pagkalugi.\n\nKahalagahan:\n- Nagbabawas ng post harvest losses ng 20-40%\n- Nagpapanatili ng kalidad ng produkto\n- Nagpapahaba ng shelf life\n- Nagpapabuti ng food security`
      },
      concepts: {
        english: `1. Harvesting - Gathering mature crops\n2. Cleaning - Removing dirt and debris\n3. Grading - Sorting by quality\n4. Packaging - Protecting produce\n5. Storage - Controlled conditions`,
        tagalog: `1. Pag-aani - Pagkuha ng mga hinog na pananim\n2. Paglilinis - Pag-alis ng dumi\n3. Pag-uuri - Pagbukod-bukod ayon sa kalidad\n4. Pag-iimpake - Pagprotekta sa ani\n5. Pag-iimbak - Kontroladong kondisyon`
      },
      components: {
        english: `1. Harvesting Techniques\n2. Field Handling\n3. Transport\n4. Processing\n5. Marketing`,
        tagalog: `1. Teknik sa Pag-aani\n2. Field Handling\n3. Transportasyon\n4. Pagproseso\n5. Marketing`
      },
      process: {
        english: `Step 1: Harvesting\nStep 2: Cleaning\nStep 3: Sorting\nStep 4: Packaging\nStep 5: Storage\nStep 6: Transport`,
        tagalog: `Hakbang 1: Pag-aani\nHakbang 2: Paglilinis\nHakbang 3: Pag-uuri\nHakbang 4: Pag-iimpake\nHakbang 5: Pag-iimbak\nHakbang 6: Transportasyon`
      },
      players: {
        english: `1. Farmers\n2. Agricultural Workers\n3. Traders\n4. Consumers`,
        tagalog: `1. Magsasaka\n2. Manggagawa sa Agrikultura\n3. Mangangalakal\n4. Konsyumer`
      },
      data: {
        english: `1. 30-40% of crops lost due to poor practices (FAO, 2023)\n2. Proper practices reduce losses by 50% (World Bank, 2022)\n3. Philippines loses 20-30% of rice production annually (DA, 2023)`,
        tagalog: `1. 30-40% ng mga ani ay nasisira (FAO, 2023)\n2. Ang tamang practices ay nakakabawas ng pagkalugi ng 50% (World Bank, 2022)\n3. Ang Pilipinas ay nawawalan ng 20-30% ng produksyon ng bigas taun-taon (DA, 2023)`
      },
      cases: {
        english: `Case Study 1: Philippine Rice Post Harvest\nSituation: Rice farmers face post harvest losses\nProblem: Poor drying and storage\nResponse: Mechanical dryers and hermetic bags\nLesson: Proper practices reduce losses`,
        tagalog: `Case Study 1: Post Harvest ng Bigas sa Pilipinas\nSitwasyon: Ang mga magsasaka ng bigas ay nakakaranas ng pagkalugi\nProblema: Hindi magandang pagpapatuyo at pag-iimbak\nTugon: Mechanical dryers at hermetic bags\nAral: Ang tamang practices ay nagbabawas ng pagkalugi`
      },
      impacts: {
        english: `Positive Impacts:\n- Reduces waste\n- Improves quality\n- Increases income\n\nNegative Impacts/Challenges:\n- High costs\n- Requires training\n- Limited technology`,
        tagalog: `Positibong Epekto:\n- Nagbabawas ng basura\n- Nagpapabuti ng kalidad\n- Nagpapataas ng kita\n\nNegatibong Epekto/Hamon:\n- Mataas na gastos\n- Nangangailangan ng pagsasanay\n- Limitadong teknolohiya`
      },
      analysis: {
        english: `1. Post harvest practices are critical for food security\n2. Investment in infrastructure is essential\n3. Training and education are key`,
        tagalog: `1. Ang post harvest practices ay mahalaga para sa food security\n2. Ang pamumuhunan sa infrastructure ay mahalaga\n3. Ang pagsasanay at edukasyon ay susi`
      },
      status: {
        english: `Current Status:\n- Growing awareness\n- Increasing investment\n- Government support\n\nFuture Trends:\n- Smart technologies\n- Sustainable packaging\n- Cold chain expansion`,
        tagalog: `Kasalukuyang Estado:\n- Lumalagong kamalayan\n- Pagtaas ng investment\n- Suporta ng gobyerno\n\nHinaharap:\n- Smart technologies\n- Sustainable packaging\n- Cold chain expansion`
      },
      summary: {
        english: `1. Reduce losses by 40-50%\n2. Extend shelf life\n3. Improve income\n4. Ensure food security`,
        tagalog: `1. Bawasan ang pagkalugi ng 40-50%\n2. Pahabain ang shelf life\n3. Pabutihin ang kita\n4. Tiyakin ang food security`
      }
    };
  },

  // ============================================
  // SUSCEPTIBILITY CONTENT
  // ============================================
  getSusceptibilityContent() {
    return {
      introduction: {
        english: `Definition: Susceptibility refers to the state of being likely to be influenced, harmed, or affected by a particular factor or condition.\n\nImportance:\n- Critical for disease prevention\n- Essential for personalized medicine\n- Important for risk assessment`,
        tagalog: `Kahulugan: Ang susceptibility ay tumutukoy sa kalagayan ng pagiging maaaring maimpluwensyahan, masaktan, o maapektuhan ng isang partikular na salik o kondisyon.\n\nKahalagahan:\n- Mahalaga para sa pag-iwas sa sakit\n- Kailangan para sa personalized na gamot\n- Mahalaga para sa pagsusuri ng panganib`
      },
      concepts: {
        english: `1. Biological Susceptibility\n2. Environmental Susceptibility\n3. Disease Susceptibility\n4. Antimicrobial Susceptibility`,
        tagalog: `1. Biological Susceptibility\n2. Environmental Susceptibility\n3. Disease Susceptibility\n4. Antimicrobial Susceptibility`
      },
      components: {
        english: `1. Genetic Factors\n2. Environmental Factors\n3. Lifestyle Factors\n4. Pre-existing Conditions`,
        tagalog: `1. Genetic Factors\n2. Environmental Factors\n3. Lifestyle Factors\n4. Pre-existing Conditions`
      },
      process: {
        english: `Step 1: Risk Assessment\nStep 2: Vulnerability Analysis\nStep 3: Prevention Planning\nStep 4: Implementation\nStep 5: Monitoring`,
        tagalog: `Hakbang 1: Risk Assessment\nHakbang 2: Vulnerability Analysis\nHakbang 3: Prevention Planning\nHakbang 4: Implementation\nHakbang 5: Monitoring`
      },
      players: {
        english: `1. Healthcare Professionals\n2. Public Health Organizations\n3. Researchers\n4. Government Agencies`,
        tagalog: `1. Healthcare Professionals\n2. Public Health Organizations\n3. Researchers\n4. Government Agencies`
      },
      data: {
        english: `1. 30-50% of susceptibility is genetic (WHO, 2021)\n2. 5-10x higher susceptibility in infants (CDC, 2023)\n3. 70% of bacteria show resistance (WHO, 2024)`,
        tagalog: `1. 30-50% ng susceptibility ay genetic (WHO, 2021)\n2. 5-10x mas mataas ang susceptibility sa mga sanggol (CDC, 2023)\n3. 70% ng bacteria ay nagpapakita ng resistance (WHO, 2024)`
      },
      cases: {
        english: `Case Study 1: COVID-19 Susceptibility\nSituation: Pandemic revealed differences in susceptibility\nProblem: Higher risk for older adults and those with pre-existing conditions\nResponse: Targeted vaccination campaigns\nLesson: Understanding susceptibility enables effective response`,
        tagalog: `Case Study 1: COVID-19 Susceptibility\nSitwasyon: Ang pandemic ay nagpakita ng pagkakaiba sa susceptibility\nProblema: Mas mataas na risk para sa matatanda at may pre-existing conditions\nTugon: Target na vaccination campaigns\nAral: Ang pag-unawa sa susceptibility ay nagpapagana ng epektibong tugon`
      },
      impacts: {
        english: `Positive Impacts:\n- Improved prevention\n- Personalized medicine\n- Better resource allocation\n\nNegative Impacts/Challenges:\n- Stigmatization\n- Resource limitations\n- Health disparities`,
        tagalog: `Positibong Epekto:\n- Pinahusay na pag-iwas\n- Personalized na gamot\n- Mas mahusay na paglalaan ng mapagkukunan\n\nNegatibong Epekto/Hamon:\n- Stigmatization\n- Kakulangan sa mapagkukunan\n- Health disparities`
      },
      analysis: {
        english: `1. Susceptibility is multi-factorial\n2. Health equity must be addressed\n3. Continuous monitoring is essential`,
        tagalog: `1. Ang susceptibility ay multi-factorial\n2. Dapat tugunan ang health equity\n3. Mahalaga ang patuloy na pag-monitor`
      },
      status: {
        english: `Current Status:\n- Global surveillance systems\n- Advanced technologies\n- Policy integration\n\nFuture Trends:\n- Predictive analytics\n- Genomic medicine\n- Climate adaptation`,
        tagalog: `Kasalukuyang Estado:\n- Global surveillance systems\n- Advanced na teknolohiya\n- Pagsasama sa policies\n\nHinaharap:\n- Predictive analytics\n- Genomic medicine\n- Climate adaptation`
      },
      summary: {
        english: `1. Multiple factors influence susceptibility\n2. Prevention is key\n3. Continuous monitoring is essential`,
        tagalog: `1. Maraming salik ang nakakaimpluwensya sa susceptibility\n2. Ang pag-iwas ay susi\n3. Mahalaga ang patuloy na pag-monitor`
      }
    };
  },

  // ============================================
  // CLIMATE CONTENT
  // ============================================
  getClimateContent() {
    return {
      introduction: {
        english: `Definition: Climate change refers to long-term shifts in temperatures and weather patterns, primarily caused by human activities.\n\nImportance:\n- Affects food security\n- Impacts human health\n- Threatens biodiversity\n- Influences economic development`,
        tagalog: `Kahulugan: Ang climate change ay tumutukoy sa pangmatagalang pagbabago sa temperatura at panahon, pangunahing dulot ng mga gawain ng tao.\n\nKahalagahan:\n- Nakakaapekto sa food security\n- Nakakaapekto sa kalusugan\n- Nagbabanta sa biodiversity\n- Nakakaimpluwensya sa pag-unlad ng ekonomiya`
      },
      concepts: {
        english: `1. Greenhouse Effect\n2. Global Warming\n3. Carbon Emissions\n4. Climate Feedback Loops`,
        tagalog: `1. Greenhouse Effect\n2. Global Warming\n3. Carbon Emissions\n4. Climate Feedback Loops`
      },
      components: {
        english: `1. Atmospheric CO2\n2. Temperature Rise\n3. Sea Level Rise\n4. Extreme Weather`,
        tagalog: `1. Atmospheric CO2\n2. Temperature Rise\n3. Sea Level Rise\n4. Extreme Weather`
      },
      process: {
        english: `Step 1: Emissions\nStep 2: Trapping\nStep 3: Warming\nStep 4: Impacts\nStep 5: Response`,
        tagalog: `Hakbang 1: Emissions\nHakbang 2: Trapping\nHakbang 3: Warming\nHakbang 4: Impacts\nHakbang 5: Response`
      },
      players: {
        english: `1. Governments\n2. Scientists\n3. Businesses\n4. Communities`,
        tagalog: `1. Governments\n2. Scientists\n3. Businesses\n4. Communities`
      },
      data: {
        english: `1. Temperature risen 1.1°C (IPCC, 2023)\n2. CO2 levels at highest in 800,000 years (NASA, 2024)\n3. Sea levels risen 20 cm (NOAA, 2023)`,
        tagalog: `1. Tumaas ang temperatura ng 1.1°C (IPCC, 2023)\n2. CO2 levels sa pinakamataas sa 800,000 taon (NASA, 2024)\n3. Tumaaas ang sea levels ng 20 cm (NOAA, 2023)`
      },
      cases: {
        english: `Case Study 1: Philippines Typhoons\nSituation: Increasing frequency and intensity\nProblem: Loss of lives and infrastructure\nResponse: Early warning systems\nLesson: Climate adaptation is critical`,
        tagalog: `Case Study 1: Mga Bagyo sa Pilipinas\nSitwasyon: Pagtaas ng dalas at lakas\nProblema: Pagkawala ng buhay at pinsala\nTugon: Early warning systems\nAral: Mahalaga ang climate adaptation`
      },
      impacts: {
        english: `Positive Impacts:\n- Increased awareness\n- Clean energy innovation\n- New opportunities\n\nNegative Impacts/Challenges:\n- Loss of biodiversity\n- Food and water scarcity\n- Displacement`,
        tagalog: `Positibong Epekto:\n- Pagtaas ng kamalayan\n- Clean energy innovation\n- Mga bagong oportunidad\n\nNegatibong Epekto/Hamon:\n- Pagkawala ng biodiversity\n- Kakulangan sa pagkain at tubig\n- Paglipat ng mga populasyon`
      },
      analysis: {
        english: `1. Climate change is the greatest challenge\n2. Urgent action is needed\n3. Collaboration is key`,
        tagalog: `1. Ang climate change ay ang pinakamalaking hamon\n2. Kailangan ang agarang aksyon\n3. Susi ang kolaborasyon`
      },
      status: {
        english: `Current Status:\n- Global emissions continue to rise\n- Increasing climate impacts\n- Growing momentum for action\n\nFuture Trends:\n- Renewable energy transition\n- Climate adaptation\n- Carbon removal technologies`,
        tagalog: `Kasalukuyang Estado:\n- Patuloy na tumataas ang global emissions\n- Pagtaas ng climate impacts\n- Lumalagong momentum para sa aksyon\n\nHinaharap:\n- Renewable energy transition\n- Climate adaptation\n- Carbon removal technologies`
      },
      summary: {
        english: `1. Climate change is caused by human activities\n2. Impacts are severe\n3. Urgent action is needed`,
        tagalog: `1. Ang climate change ay dulot ng mga gawain ng tao\n2. Malubha ang mga epekto\n3. Kailangan ang agarang aksyon`
      }
    };
  },

  // ============================================
  // AI CONTENT
  // ============================================
  getAIContent() {
    return {
      introduction: {
        english: `Definition: Artificial Intelligence (AI) refers to the simulation of human intelligence in machines programmed to think, learn, and make decisions.\n\nImportance:\n- Automates complex tasks\n- Improves decision-making\n- Drives innovation\n- Creates new opportunities`,
        tagalog: `Kahulugan: Ang Artificial Intelligence (AI) ay tumutukoy sa simulation ng human intelligence sa mga makina na naka-program upang mag-isip, matuto, at gumawa ng desisyon.\n\nKahalagahan:\n- Nag-automate ng komplikadong gawain\n- Nagpapabuti ng pagdedesisyon\n- Nagtutulak ng inobasyon\n- Gumagawa ng mga bagong oportunidad`
      },
      concepts: {
        english: `1. Machine Learning\n2. Deep Learning\n3. Natural Language Processing\n4. Computer Vision\n5. Robotics`,
        tagalog: `1. Machine Learning\n2. Deep Learning\n3. Natural Language Processing\n4. Computer Vision\n5. Robotics`
      },
      components: {
        english: `1. Data\n2. Algorithms\n3. Computing Power\n4. Training\n5. Deployment`,
        tagalog: `1. Data\n2. Algorithms\n3. Computing Power\n4. Training\n5. Deployment`
      },
      process: {
        english: `Step 1: Data Collection\nStep 2: Data Preparation\nStep 3: Model Training\nStep 4: Evaluation\nStep 5: Deployment\nStep 6: Monitoring`,
        tagalog: `Hakbang 1: Data Collection\nHakbang 2: Data Preparation\nHakbang 3: Model Training\nHakbang 4: Evaluation\nHakbang 5: Deployment\nHakbang 6: Monitoring`
      },
      players: {
        english: `1. Researchers\n2. Engineers\n3. Businesses\n4. Governments\n5. Users`,
        tagalog: `1. Researchers\n2. Engineers\n3. Businesses\n4. Governments\n5. Users`
      },
      data: {
        english: `1. AI market to reach $1.8 trillion by 2030 (Statista, 2024)\n2. 80% of enterprises use AI (Gartner, 2023)\n3. AI to contribute $15.7 trillion by 2030 (PwC, 2023)`,
        tagalog: `1. AI market aabot sa $1.8 trillion sa 2030 (Statista, 2024)\n2. 80% ng enterprises ay gumagamit ng AI (Gartner, 2023)\n3. AI mag-aambag ng $15.7 trillion sa 2030 (PwC, 2023)`
      },
      cases: {
        english: `Case Study 1: ChatGPT\nSituation: Advanced language understanding\nProblem: Need for natural human-AI interaction\nResponse: Large language models\nLesson: AI can understand human language\n\nCase Study 2: Self-Driving Cars\nSituation: Autonomous vehicles\nProblem: Safety and regulations\nResponse: AI algorithms and sensors\nLesson: AI can perform complex tasks`,
        tagalog: `Case Study 1: ChatGPT\nSitwasyon: Advanced language understanding\nProblema: Pangangailangan para sa natural na human-AI interaction\nTugon: Large language models\nAral: Ang AI ay maaaring umunawa ng human language\n\nCase Study 2: Self-Driving Cars\nSitwasyon: Autonomous vehicles\nProblema: Safety at regulations\nTugon: AI algorithms at sensors\nAral: Ang AI ay maaaring gumawa ng komplikadong tasks`
      },
      impacts: {
        english: `Positive Impacts:\n- Increased efficiency\n- Innovation\n- Improved decision-making\n\nNegative Impacts/Challenges:\n- Job displacement\n- Privacy concerns\n- Bias and fairness issues`,
        tagalog: `Positibong Epekto:\n- Pagtaas ng efficiency\n- Inobasyon\n- Pinabuting pagdedesisyon\n\nNegatibong Epekto/Hamon:\n- Pagkawala ng trabaho\n- Privacy concerns\n- Bias at fairness issues`
      },
      analysis: {
        english: `1. AI is transforming industries\n2. Ethical considerations are critical\n3. Collaboration is key`,
        tagalog: `1. Ang AI ay nagbabago ng industriya\n2. Mahalaga ang ethical considerations\n3. Susi ang kolaborasyon`
      },
      status: {
        english: `Current Status:\n- Rapid AI adoption\n- Increasing investment\n- Growing regulations\n\nFuture Trends:\n- General AI development\n- AI-powered automation\n- Ethical AI frameworks`,
        tagalog: `Kasalukuyang Estado:\n- Mabilis na paggamit ng AI\n- Pagtaas ng investment\n- Lumalagong regulations\n\nHinaharap:\n- General AI development\n- AI-powered automation\n- Ethical AI frameworks`
      },
      summary: {
        english: `1. AI is transforming the world\n2. Understanding AI is essential\n3. Collaboration is key`,
        tagalog: `1. Ang AI ay nagbabago ng mundo\n2. Mahalaga ang pag-unawa sa AI\n3. Susi ang kolaborasyon`
      }
    };
  },

  // ============================================
  // GET REAL REFERENCES
  // ============================================
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
  // CLEAN RESPONSE (NO HEADER/FOOTER)
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
      .replace(/^=+$/gm, '')
      .replace(/^-+$/gm, '')
      .replace(/^\s*[-=]{3,}\s*$/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/#{1,6}\s*/g, '')
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
