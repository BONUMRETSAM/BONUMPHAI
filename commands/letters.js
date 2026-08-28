const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: ['letters', 'letter', 'sulat', 'gawa ng sulat', 'gumawa ng sulat', 'make a letter', 'create letter'],
  description: 'Generate letter templates with proper paragraph structure',
  usage: 'letters [type]',
  version: '5.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 5,

  async execute(senderId, args, token, event) {
    try {
      const prompt = args.join(' ').trim().toLowerCase();
      
      if (!prompt) {
        const types = this.getAllTypes();
        await sendMessage(senderId, { text: 'LETTER GENERATOR\n\nAvailable Types:\n' + types.join(', ') + '\n\nUsage:\nletters [type]\nmake a letter for [type]' }, token);
        return;
      }
      
      const letterType = this.detectLetterType(prompt);
      
      if (!letterType) {
        const types = this.getAllTypes();
        await sendMessage(senderId, { text: 'Letter type not found.\n\nAvailable Types:\n' + types.join(', ') }, token);
        return;
      }
      
      const letter = this.getLetter(letterType);
      
      if (letter) {
        await sendMessage(senderId, { text: letter }, token);
      } else {
        await sendMessage(senderId, { text: 'No template found for this letter type.' }, token);
      }
      
    } catch (error) {
      console.error('[letters] Error:', error.message);
      await sendMessage(senderId, { text: 'Error: ' + error.message }, token);
    }
  },

  getAllTypes() {
    return [
      'resignation', 'application', 'excuse', 'complaint', 'request',
      'invitation', 'recommendation', 'thankyou', 'apology', 'permission',
      'business', 'love', 'condolence', 'congratulation',
      'authorization', 'cover', 'certification', 'borrowing', 'donation',
      'sponsorship', 'scholarship', 'promotion', 'salaryincrease', 'transfer',
      'termination', 'warning', 'appointment', 'meeting', 'followup',
      'introduction', 'notice', 'inquiry', 'order', 'refund',
      'cancellation', 'rental', 'leasetermination', 'employeeverification',
      'reference', 'appeal', 'solicitation', 'nomination', 'acceptance',
      'rejection'
    ];
  },

  detectLetterType(prompt) {
    const types = [
      { key: 'resignation', keywords: ['resignation', 'resign', 'magreresign', 'pagbibitiw'] },
      { key: 'application', keywords: ['application', 'apply', 'aplay', 'pag-aaplay'] },
      { key: 'excuse', keywords: ['excuse', 'absent', 'paalam', 'liban', 'dahilan'] },
      { key: 'complaint', keywords: ['complaint', 'reklamo', 'ireklamo'] },
      { key: 'request', keywords: ['request', 'hiling', 'kahilingan', 'pakiusap'] },
      { key: 'invitation', keywords: ['invitation', 'invite', 'imbita', 'paanyaya'] },
      { key: 'recommendation', keywords: ['recommendation', 'recommend', 'rekomendasyon'] },
      { key: 'thankyou', keywords: ['thank you', 'salamat', 'pasasalamat'] },
      { key: 'apology', keywords: ['apology', 'sorry', 'paumanhin', 'hingi ng pasensya'] },
      { key: 'permission', keywords: ['permission', 'permiso', 'pahintulot'] },
      { key: 'business', keywords: ['business', 'negosyo'] },
      { key: 'love', keywords: ['love', 'mahal', 'pag-ibig', 'love letter'] },
      { key: 'condolence', keywords: ['condolence', 'pakikiramay', 'nakikiramay'] },
      { key: 'congratulation', keywords: ['congratulation', 'congrats', 'bati', 'pagbati'] },
      { key: 'authorization', keywords: ['authorization', 'authorize', 'otorisasyon'] },
      { key: 'cover', keywords: ['cover letter', 'cover'] },
      { key: 'certification', keywords: ['certification', 'certificate', 'sertipikasyon'] },
      { key: 'borrowing', keywords: ['borrowing', 'borrow', 'hiram', 'humiram'] },
      { key: 'donation', keywords: ['donation', 'donate', 'donasyon'] },
      { key: 'sponsorship', keywords: ['sponsorship', 'sponsor', 'isponsor'] },
      { key: 'scholarship', keywords: ['scholarship', 'iskolar', 'scholar'] },
      { key: 'promotion', keywords: ['promotion', 'promote', 'promosyon'] },
      { key: 'salaryincrease', keywords: ['salary increase', 'increase salary', 'taas ng sahod'] },
      { key: 'transfer', keywords: ['transfer', 'lipat', 'ilipat'] },
      { key: 'termination', keywords: ['termination', 'terminate', 'tanggal'] },
      { key: 'warning', keywords: ['warning', 'babala'] },
      { key: 'appointment', keywords: ['appointment', 'appoint', 'tatalaga'] },
      { key: 'meeting', keywords: ['meeting', 'pupulong', 'pagpupulong'] },
      { key: 'followup', keywords: ['follow up', 'follow-up', 'followup'] },
      { key: 'introduction', keywords: ['introduction', 'introduce', 'pakilala'] },
      { key: 'notice', keywords: ['notice', 'abiso', 'paunawa'] },
      { key: 'inquiry', keywords: ['inquiry', 'inquire', 'tanong', 'pagtatanong'] },
      { key: 'order', keywords: ['order', 'order letter', 'pag-order'] },
      { key: 'refund', keywords: ['refund', 'ibalik ang bayad'] },
      { key: 'cancellation', keywords: ['cancellation', 'cancel', 'kansela'] },
      { key: 'rental', keywords: ['rental', 'rent', 'renta', 'upa'] },
      { key: 'leasetermination', keywords: ['lease termination', 'end lease', 'tapos ng lease'] },
      { key: 'employeeverification', keywords: ['employee verification', 'employment verification', 'verify employment'] },
      { key: 'reference', keywords: ['reference letter', 'character reference'] },
      { key: 'appeal', keywords: ['appeal', 'apela'] },
      { key: 'solicitation', keywords: ['solicitation', 'solicit'] },
      { key: 'nomination', keywords: ['nomination', 'nominate', 'nominasyon'] },
      { key: 'acceptance', keywords: ['acceptance', 'accept', 'tanggap'] },
      { key: 'rejection', keywords: ['rejection', 'reject', 'tumanggi'] }
    ];
    
    for (const type of types) {
      if (type.keywords.some(k => prompt.includes(k))) return type.key;
    }
    return null;
  },

  getLetter(letterType) {
    const date = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const templates = {};
    
    // ========== 3-PARAGRAPH LETTERS ==========
    
    templates.resignation = date + '\n\n' +
      'Mr. Roberto Gomez\nOperations Manager\nSM Hypermarket\nSM Tunasan, Muntinlupa City\n\n' +
      'Dear Mr. Gomez,\n\n' +
      'Please accept this letter as formal notification of my resignation from my position as Cashier at SM Hypermarket, effective [LAST DAY OF WORK]. I have enjoyed my time working here.\n\n' +
      'I would like to express my sincere gratitude for the opportunities and experiences I have gained during my time with the company. The support and guidance I received have been invaluable to my professional growth.\n\n' +
      'During my remaining time, I am committed to ensuring a smooth transition of my responsibilities. Thank you for the opportunity to be part of this organization.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.excuse = date + '\n\n' +
      'Ms. Maria Santos\nClass Adviser\nMuntinlupa National High School\nMuntinlupa City\n\n' +
      'Dear Ms. Santos,\n\n' +
      'I am writing to excuse my son, Juan Dela Cruz Jr., for his absence from school on [DATE].\n\n' +
      'He was unable to attend due to fever. Attached is the medical certificate for your reference.\n\n' +
      'Rest assured that he will catch up on all missed lessons. Thank you for your understanding.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nParent/Guardian Signature';

    templates.request = date + '\n\n' +
      'Mr. David Garcia\nBarangay Captain\nBarangay Tunasan\nMuntinlupa City\n\n' +
      'Dear Mr. Garcia,\n\n' +
      'I am writing to request a Barangay Clearance for employment purposes.\n\n' +
      'I need this document as a requirement for my job application.\n\n' +
      'I would greatly appreciate your approval. Thank you for your time and attention.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.invitation = date + '\n\n' +
      'Dear Mr. Martinez,\n\n' +
      'I would like to invite you to my Birthday Celebration on [DATE] at 6:00 PM at our residence in Muntinlupa City.\n\n' +
      'The celebration will include dinner, games, and entertainment.\n\n' +
      'Please RSVP by [DATE] so we can finalize the arrangements. We look forward to seeing you there!\n\n' +
      'Warm regards,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.apology = date + '\n\n' +
      'Dear Ms. Santos,\n\n' +
      'I am writing to sincerely apologize for missing the parent-teacher conference last week.\n\n' +
      'My absence was due to an emergency at work. I take full responsibility.\n\n' +
      'I will inform you in advance in the future. Please accept my sincere apologies.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.permission = date + '\n\n' +
      'Mr. Roberto Gomez\nOperations Manager\nSM Hypermarket\nSM Tunasan, Muntinlupa City\n\n' +
      'Dear Mr. Gomez,\n\n' +
      'I am writing to request permission to leave early on [DATE] at 3:00 PM.\n\n' +
      'I need to attend to a family matter that requires my immediate attention.\n\n' +
      'I assure you that all my tasks will be completed before I leave. Thank you for your consideration.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.cover = date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\nMuntinlupa City\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am writing to apply for the Sales Associate position at SM Department Store.\n\n' +
      'I have 3 years of retail experience with strong skills in customer service and sales.\n\n' +
      'I would welcome the opportunity for an interview. Please contact me at 09123456789.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.borrowing = date + '\n\n' +
      'Mr. Roberto Gomez\nOperations Manager\nSM Hypermarket\n\n' +
      'Dear Mr. Gomez,\n\n' +
      'I am writing to request permission to borrow the company projector from [DATE] to [DATE].\n\n' +
      'I need it for my son\'s school project presentation.\n\n' +
      'I will take full responsibility and will return it in good condition. Thank you.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.scholarship = 'JUAN DELA CRUZ\n123 Purok 5, Barangay Tunasan\nMuntinlupa City, Philippines\n09123456789\njuandelacruz@gmail.com\n\n' + date + '\n\n' +
      'Scholarship Committee\nPamantasan ng Lungsod ng Muntinlupa\nMuntinlupa City\n\n' +
      'Dear Scholarship Committee,\n\n' +
      'I am writing to apply for the [SCHOLARSHIP NAME] for the academic year [YEAR].\n\n' +
      'I am a [YEAR LEVEL] student with a GPA of [GPA]. I have been active in [EXTRA-CURRICULAR ACTIVITIES].\n\n' +
      'My family\'s financial situation makes it challenging to support my education. I am confident that I am deserving of this scholarship.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.promotion = date + '\n\n' +
      'Mr. Roberto Gomez\nOperations Manager\nSM Hypermarket\n\n' +
      'Dear Mr. Gomez,\n\n' +
      'I am writing to formally request consideration for the position of Senior Cashier.\n\n' +
      'I have been with SM Hypermarket for 3 years and have consistently exceeded performance expectations.\n\n' +
      'I believe my experience and dedication make me a strong candidate. Thank you for your consideration.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.salaryincrease = date + '\n\n' +
      'Mr. Roberto Gomez\nOperations Manager\nSM Hypermarket\n\n' +
      'Dear Mr. Gomez,\n\n' +
      'I am writing to request a review of my current salary.\n\n' +
      'I have been with the company for 3 years and have taken on additional responsibilities.\n\n' +
      'I would appreciate the opportunity to discuss this matter. Thank you.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.transfer = date + '\n\n' +
      'Mr. Roberto Gomez\nOperations Manager\nSM Hypermarket\n\n' +
      'Dear Mr. Gomez,\n\n' +
      'I am writing to request a transfer to the SM Mall of Asia branch.\n\n' +
      'The reason for this request is [REASON FOR TRANSFER].\n\n' +
      'I believe this transfer would be beneficial for both my growth and the company. Thank you.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.termination = date + '\n\n' +
      'JUAN DELA CRUZ JR.\n123 Purok 5, Barangay Tunasan\nMuntinlupa City\n\n' +
      'Dear Mr. Dela Cruz Jr.,\n\n' +
      'This letter is to inform you that your employment with SM Hypermarket will be terminated effective [DATE].\n\n' +
      'Reason: [REASON FOR TERMINATION]\n\n' +
      'Please return all company property and complete the exit process with HR.\n\n' +
      'Sincerely,\n\n\nROBERTO GOMEZ\nOperations Manager\n_________________\nSignature';

    templates.meeting = date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am writing to request a meeting on [DATE] at [TIME] to discuss [TOPIC].\n\n' +
      'Agenda: [AGENDA ITEMS]\n\n' +
      'Please confirm your availability. Thank you.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.introduction = date + '\n\n' +
      'Mr. Jose Martinez\n123 Main Street\nMuntinlupa City\n\n' +
      'Dear Mr. Martinez,\n\n' +
      'I am writing to introduce my colleague, [NAME OF PERSON].\n\n' +
      '[NAME] has extensive experience in [FIELD] and will be handling [PROJECT/MATTER].\n\n' +
      'Please extend your usual courtesy to [him/her]. Thank you.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.inquiry = date + '\n\n' +
      'Ms. Rachel Tan\nPurchasing Manager\nABC Corporation\nAlabang, Muntinlupa City\n\n' +
      'Dear Ms. Tan,\n\n' +
      'I am writing to inquire about your product pricing and availability.\n\n' +
      'I need this information for our upcoming project planning.\n\n' +
      'I look forward to your response. Thank you.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.order = date + '\n\n' +
      'Ms. Rachel Tan\nPurchasing Manager\nABC Corporation\nAlabang, Muntinlupa City\n\n' +
      'Dear Ms. Tan,\n\n' +
      'I would like to place an order for the following items: 100 units of Product A, 50 units of Product B.\n\n' +
      'Please provide your best price and delivery schedule.\n\n' +
      'Payment will be made upon delivery. Thank you.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.refund = date + '\n\n' +
      'Customer Service Manager\nSM Hypermarket\nSM Tunasan, Muntinlupa City\n\n' +
      'Dear Sir/Madam,\n\n' +
      'I am writing to request a refund for a defective electric fan purchased on [DATE].\n\n' +
      'Receipt No.: 123456, Amount: P1,500. The product stopped working after 3 days.\n\n' +
      'Please process my refund as soon as possible. Thank you.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.cancellation = date + '\n\n' +
      'Customer Service\nFitness Gym\nMuntinlupa City\n\n' +
      'Dear Sir/Madam,\n\n' +
      'I am writing to cancel my gym membership effective [DATE].\n\n' +
      'Membership No.: [NUMBER]. Reason: [REASON].\n\n' +
      'Please process my cancellation and confirm. Thank you.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.rental = date + '\n\n' +
      'Mr. Jose Martinez\nProperty Owner\n123 Main Street\nMuntinlupa City\n\n' +
      'Dear Mr. Martinez,\n\n' +
      'I am writing to inquire about the property for rent at [ADDRESS].\n\n' +
      'I am interested in a 1-year lease starting [DATE].\n\n' +
      'Please provide the rental terms and conditions. Thank you.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.leasetermination = date + '\n\n' +
      'Mr. Jose Martinez\nProperty Owner\n123 Main Street\nMuntinlupa City\n\n' +
      'Dear Mr. Martinez,\n\n' +
      'I am writing to inform you that I will be terminating my lease at [ADDRESS] effective [DATE].\n\n' +
      'I will ensure the property is clean and in good condition.\n\n' +
      'Please advise on the return of my security deposit. Thank you.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.reference = date + '\n\n' +
      'To Whom It May Concern,\n\n' +
      'I am writing to provide a character reference for JUAN DELA CRUZ JR.\n\n' +
      'I have known Juan for 5 years. He is honest, reliable, and hardworking.\n\n' +
      'I highly recommend Juan for any endeavor he chooses to pursue.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.nomination = date + '\n\n' +
      'Selection Committee\n[AWARD/ORGANIZATION NAME]\nMuntinlupa City\n\n' +
      'Dear Selection Committee,\n\n' +
      'I am writing to nominate [NAME OF NOMINEE] for [AWARD/POSITION].\n\n' +
      '[NAME] has demonstrated excellence in [FIELD/AREA].\n\n' +
      'I believe [NAME] is highly deserving of this recognition.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.love = date + '\n\n' +
      'Dear Maria,\n\n' +
      'I have been meaning to tell you something for a long time. You are the most amazing person I have ever met.\n\n' +
      'Your smile brightens my day, and your presence makes everything better. I love how you care for others and how you make me feel.\n\n' +
      'I am so grateful to have you in my life. I love you more than words can express.\n\n' +
      'Always yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 2-PARAGRAPH LETTERS ==========
    
    templates.thankyou = date + '\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am writing to express my heartfelt gratitude for the opportunity to work at SM Hypermarket for the past 3 years.\n\n' +
      'Your support and guidance have helped me grow both personally and professionally. Thank you once again for everything.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.congratulation = date + '\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'Congratulations on your promotion to Operations Manager!\n\n' +
      'Your hard work and dedication have truly paid off. I wish you continued success in your future endeavors.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.authorization = date + '\n\n' +
      'To Whom It May Concern,\n\n' +
      'I, JUAN DELA CRUZ, hereby authorize [NAME OF AUTHORIZED PERSON] to act on my behalf in processing [WHAT THEY ARE AUTHORIZED TO DO].\n\n' +
      'This authorization is valid from [START DATE] to [END DATE]. For verification, contact me at 09123456789.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.certification = date + '\n\n' +
      'To Whom It May Concern,\n\n' +
      'This is to certify that JUAN DELA CRUZ has been employed as a Cashier at SM Hypermarket from January 2020 to present.\n\n' +
      'This certification is issued upon the request of the employee for [PURPOSE].\n\n' +
      'Sincerely,\n\n\nGRACE MARTINEZ\nHR Manager\n_________________\nSignature';

    templates.warning = date + '\n\n' +
      'JUAN DELA CRUZ JR.\n123 Purok 5, Barangay Tunasan\nMuntinlupa City\n\n' +
      'Dear Mr. Dela Cruz Jr.,\n\n' +
      'This letter serves as a written warning regarding your attendance record. You have been absent for [NUMBER] days without prior notice.\n\n' +
      'Continued violation may result in disciplinary action. Please improve your attendance immediately.\n\n' +
      'Sincerely,\n\n\nROBERTO GOMEZ\nOperations Manager\n_________________\nSignature';

    templates.appointment = date + '\n\n' +
      'JUAN DELA CRUZ JR.\n123 Purok 5, Barangay Tunasan\nMuntinlupa City\n\n' +
      'Dear Mr. Dela Cruz Jr.,\n\n' +
      'We are pleased to inform you that you have been appointed as Senior Cashier at SM Hypermarket effective [DATE].\n\n' +
      'Your new responsibilities include supervising junior cashiers and handling daily cash deposits. Congratulations!\n\n' +
      'Sincerely,\n\n\nROBERTO GOMEZ\nOperations Manager\n_________________\nSignature';

    templates.followup = date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am writing to follow up on my application for the Sales Associate position submitted on [DATE].\n\n' +
      'I remain very interested in the position and would appreciate an update on the status of my application.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.notice = date + '\n\n' +
      'To All Employees,\n\n' +
      'Please be advised that there will be a [EVENT/MEETING/CHANGE] on [DATE].\n\n' +
      'Your cooperation is appreciated.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.employeeverification = date + '\n\n' +
      'To Whom It May Concern,\n\n' +
      'This letter is to verify that JUAN DELA CRUZ has been employed at SM Hypermarket from January 2020 to present.\n\n' +
      'Position: Cashier. Employment Status: Full-time.\n\n' +
      'Sincerely,\n\n\nGRACE MARTINEZ\nHR Manager\n_________________\nSignature';

    templates.acceptance = date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am pleased to accept the Sales Associate position at SM Department Store.\n\n' +
      'My start date will be on [DATE]. Thank you for this opportunity.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.rejection = date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'Thank you for offering me the Sales Associate position at SM Department Store.\n\n' +
      'After careful consideration, I have decided to decline the offer as I have accepted another opportunity. Thank you for your time.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 4-PARAGRAPH LETTERS ==========
    
    templates.application = 'JUAN DELA CRUZ\n123 Purok 5, Barangay Tunasan\nMuntinlupa City, Philippines\n09123456789\njuandelacruz@gmail.com\n\n' + date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\nMuntinlupa City\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am writing to express my interest in the Sales Associate position at SM Department Store, as advertised on JobStreet.\n\n' +
      'I am a graduate of Bachelor of Science in Business Administration from Pamantasan ng Lungsod ng Muntinlupa.\n\n' +
      'I have 3 years of retail experience with strong skills in customer service, sales, and POS operations.\n\n' +
      'I would welcome the opportunity for an interview. Please contact me at 09123456789.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.complaint = 'JUAN DELA CRUZ\n123 Purok 5, Barangay Tunasan\nMuntinlupa City, Philippines\n09123456789\n\n' + date + '\n\n' +
      'Customer Service Manager\nSM Hypermarket\nSM Tunasan, Muntinlupa City\n\n' +
      'Dear Sir/Madam,\n\n' +
      'I am writing to file a formal complaint regarding a defective electric fan I purchased from your store.\n\n' +
      'The electric fan (Receipt No.: 123456) stopped working after only 3 days of use.\n\n' +
      'This has caused great inconvenience to my family.\n\n' +
      'I respectfully request a full refund or replacement. I can be reached at 09123456789.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.recommendation = date + '\n\n' +
      'To Whom It May Concern,\n\n' +
      'I am writing to recommend Juan Dela Cruz Jr. for the position of Sales Associate.\n\n' +
      'I have had the pleasure of working with Juan for 2 years at SM Hypermarket.\n\n' +
      'Juan consistently demonstrated excellent customer service skills, strong work ethic, and reliability.\n\n' +
      'I highly recommend Juan without reservation. Please contact me at 09123456789 for further information.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\nOperations Supervisor\n_________________\nSignature';

    templates.business = 'JUAN DELA CRUZ\nDela Cruz Trading\n123 Purok 5, Barangay Tunasan\nMuntinlupa City, Philippines\n09123456789\njuandelacruz@gmail.com\n\n' + date + '\n\n' +
      'Ms. Rachel Tan\nPurchasing Manager\nABC Corporation\nAlabang, Muntinlupa City\n\n' +
      'Dear Ms. Tan,\n\n' +
      'Subject: Product Quotation Request\n\n' +
      'I am writing to request a quotation for the following products.\n\n' +
      'We are interested in 100 units of Product A, 50 units of Product B, and 200 units of Product C.\n\n' +
      'Please provide your best price, delivery terms, and payment conditions.\n\n' +
      'I look forward to your response. Thank you.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\nProprietor\nDela Cruz Trading\n_________________\nSignature';

    templates.donation = date + '\n\n' +
      'Ms. Rachel Tan\nExecutive Director\nABC Foundation\nMuntinlupa City\n\n' +
      'Dear Ms. Tan,\n\n' +
      'I am writing to request a donation for our community outreach program at Barangay Tunasan.\n\n' +
      'The program aims to provide food and school supplies to 100 underprivileged children.\n\n' +
      'We are in need of [AMOUNT/ITEMS NEEDED].\n\n' +
      'Any donation you can provide will be greatly appreciated. Thank you for your generosity.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.sponsorship = date + '\n\n' +
      'Ms. Rachel Tan\nMarketing Manager\nABC Corporation\nAlabang, Muntinlupa City\n\n' +
      'Dear Ms. Tan,\n\n' +
      'I am writing to request sponsorship for our upcoming event, [EVENT NAME], on [DATE].\n\n' +
      'As a sponsor, your company will receive prominent branding and recognition during the event.\n\n' +
      'We are in need of [AMOUNT/ITEMS NEEDED].\n\n' +
      'Thank you for considering our request. We look forward to partnering with you.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.appeal = date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am writing to appeal the decision regarding [WHAT YOU ARE APPEALING].\n\n' +
      'I believe there may have been a misunderstanding regarding the situation.\n\n' +
      'Attached are documents supporting my appeal.\n\n' +
      'I respectfully request reconsideration of this decision. Thank you.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.solicitation = date + '\n\n' +
      'Ms. Rachel Tan\nMarketing Manager\nABC Corporation\n\n' +
      'Dear Ms. Tan,\n\n' +
      'I am writing to solicit your support for our community feeding program.\n\n' +
      'The program aims to feed 200 underprivileged families in our barangay.\n\n' +
      'We are in need of [AMOUNT/ITEMS NEEDED].\n\n' +
      'Any contribution you can provide will make a significant difference. Thank you.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    templates.condolence = date + '\n\n' +
      'Dear Mr. Martinez,\n\n' +
      'I was deeply saddened to hear about the passing of your mother.\n\n' +
      'She was a wonderful person who always welcomed me warmly into your home.\n\n' +
      'Please accept my heartfelt condolences. May you find comfort in the love and support of family and friends.\n\n' +
      'With deepest sympathy,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    return templates[letterType] || null;
  }
};
