const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: ['letters', 'letter', 'sulat', 'gawa ng sulat', 'gumawa ng sulat', 'make a letter', 'create letter'],
  description: 'Generate letter templates',
  usage: 'letters [type]',
  version: '4.0.0',
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
      { key: 'authorization', keywords: ['authorization', 'authorize', 'otorisasyon', 'nagpapahintulot'] },
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
      { key: 'solicitation', keywords: ['solicitation', 'solicit', 'solicit'] },
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
    
    // ========== 1. RESIGNATION ==========
    templates.resignation = date + '\n\n' +
      'Mr. Roberto Gomez\nOperations Manager\nSM Hypermarket\nSM Tunasan, Muntinlupa City\n\n' +
      'Dear Mr. Gomez,\n\n' +
      'Please accept this letter as formal notification of my resignation from my position as Cashier at SM Hypermarket, effective [LAST DAY OF WORK].\n\n' +
      'I would like to express my sincere gratitude for the opportunities and experiences I have gained during my time with the company. The support and guidance I received have been invaluable to my professional growth.\n\n' +
      'During my remaining time, I am committed to ensuring a smooth transition of my responsibilities. I am willing to assist in training my replacement and completing any pending tasks.\n\n' +
      'Thank you for the opportunity to be part of this organization. I wish the company continued success in the future.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 2. APPLICATION ==========
    templates.application = 'JUAN DELA CRUZ\n123 Purok 5, Barangay Tunasan\nMuntinlupa City, Philippines\n09123456789\njuandelacruz@gmail.com\n\n' + date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\nMuntinlupa City\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am writing to express my interest in the Sales Associate position at SM Department Store, as advertised on JobStreet.\n\n' +
      'With 3 years of experience in retail and customer service, I have developed strong skills in sales, customer relations, and POS operations. I am confident that my background and expertise make me an excellent candidate for this position.\n\n' +
      'Key qualifications that I would bring to this role include:\n\n- Excellent customer service skills\n- Experience with cash handling and POS systems\n- Strong teamwork and communication abilities\n\n' +
      'I am eager to contribute to the success of SM Department Store and would welcome the opportunity to discuss how my skills align with your needs.\n\n' +
      'Thank you for considering my application. I look forward to hearing from you soon.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 3. EXCUSE ==========
    templates.excuse = date + '\n\n' +
      'Ms. Maria Santos\nClass Adviser\nMuntinlupa National High School\nMuntinlupa City\n\n' +
      'Dear Ms. Santos,\n\n' +
      'I am writing to excuse my son, Juan Dela Cruz Jr., for his absence on [DATE].\n\n' +
      'He was unable to attend due to fever. He is now feeling better and ready to return to school.\n\n' +
      'Attached is the medical certificate for your reference.\n\n' +
      'Thank you for your understanding.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nParent/Guardian Signature';

    // ========== 4. COMPLAINT ==========
    templates.complaint = 'JUAN DELA CRUZ\n123 Purok 5, Barangay Tunasan\nMuntinlupa City, Philippines\n09123456789\n\n' + date + '\n\n' +
      'Customer Service Manager\nSM Hypermarket\nSM Tunasan, Muntinlupa City\n\n' +
      'Dear Sir/Madam,\n\n' +
      'I am writing to express my dissatisfaction regarding a defective product I purchased on [DATE] from your store.\n\n' +
      'Details of the issue:\n\n- Defective electric fan (Brand: XYZ)\n- Receipt No.: 123456\n- Already returned to customer service but no resolution\n\n' +
      'I would appreciate it if you could replace the product or provide a full refund. I can be reached at 09123456789.\n\n' +
      'I look forward to your prompt response.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 5. REQUEST ==========
    templates.request = date + '\n\n' +
      'Mr. David Garcia\nBarangay Captain\nBarangay Tunasan\nMuntinlupa City\n\n' +
      'Dear Mr. Garcia,\n\n' +
      'I am writing to request a Barangay Clearance for employment purposes.\n\n' +
      'I would greatly appreciate your consideration and approval of this request. Please let me know if you need any additional information.\n\n' +
      'Thank you for your time and attention.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 6. INVITATION ==========
    templates.invitation = date + '\n\n' +
      'Dear Mr. Martinez,\n\n' +
      'I would like to invite you to my Birthday Celebration on [DATE] at 6:00 PM. The event will be held at our residence in Muntinlupa City.\n\n' +
      'Highlights of the event include:\n\n- Dinner and refreshments\n- Games and entertainment\n- Music and dancing\n\n' +
      'Your presence would make this event more special. Please RSVP by [DATE] so we can finalize the arrangements.\n\n' +
      'We look forward to seeing you there!\n\n' +
      'Warm regards,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 7. RECOMMENDATION ==========
    templates.recommendation = date + '\n\n' +
      'To Whom It May Concern,\n\n' +
      'I am writing to recommend Juan Dela Cruz Jr. for the position of Sales Associate. I have had the pleasure of working with him for 2 years at SM Hypermarket.\n\n' +
      'During his time with us, Juan consistently demonstrated:\n\n- Excellent customer service skills\n- Strong work ethic and reliability\n- Ability to work well in a team\n\n' +
      'Juan would be a valuable asset to any organization. I highly recommend him without reservation.\n\n' +
      'Please feel free to contact me if you need further information.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\nOperations Supervisor\n_________________\nSignature';

    // ========== 8. THANK YOU ==========
    templates.thankyou = date + '\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am writing to express my heartfelt gratitude for the opportunity to work at SM Hypermarket for the past 3 years.\n\n' +
      'Your support and guidance have helped me grow both personally and professionally. I am truly grateful for everything.\n\n' +
      'Thank you once again for everything.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 9. APOLOGY ==========
    templates.apology = date + '\n\n' +
      'Dear Ms. Santos,\n\n' +
      'I am writing to sincerely apologize for missing the parent-teacher conference last week.\n\n' +
      'My absence was due to an emergency at work. I take full responsibility and deeply regret any inconvenience this may have caused.\n\n' +
      'Moving forward, I will inform you in advance if I cannot attend any meeting.\n\n' +
      'Please accept my sincere apologies.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 10. PERMISSION ==========
    templates.permission = date + '\n\n' +
      'Mr. Roberto Gomez\nOperations Manager\nSM Hypermarket\nSM Tunasan, Muntinlupa City\n\n' +
      'Dear Mr. Gomez,\n\n' +
      'I am writing to request permission to leave early on [DATE] due to a family emergency.\n\n' +
      'I assure you that all my tasks for the day will be completed before I leave.\n\n' +
      'Thank you for your consideration.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 11. BUSINESS ==========
    templates.business = 'JUAN DELA CRUZ\nDela Cruz Trading\n123 Purok 5, Barangay Tunasan\nMuntinlupa City, Philippines\n09123456789\njuandelacruz@gmail.com\n\n' + date + '\n\n' +
      'Ms. Rachel Tan\nPurchasing Manager\nABC Corporation\nAlabang, Muntinlupa City\n\n' +
      'Dear Ms. Tan,\n\n' +
      'Subject: Product Quotation Request\n\n' +
      'I am writing to request a quotation for the following products:\n\n- 100 units of Product A\n- 50 units of Product B\n- 200 units of Product C\n\n' +
      'I look forward to your response and further discussion.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\nProprietor\nDela Cruz Trading\n_________________\nSignature';

    // ========== 12. LOVE ==========
    templates.love = date + '\n\n' +
      'Dear Maria,\n\n' +
      'I have been meaning to tell you something for a long time. You are the most amazing person I have ever met.\n\n' +
      'Every moment with you feels like a beautiful dream. Your smile brightens my day, and your presence makes everything better.\n\n' +
      'I am so grateful to have you in my life. You make me a better person, and I cannot imagine my world without you.\n\n' +
      'I love you more than words can express.\n\n' +
      'Always yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 13. CONDOLENCE ==========
    templates.condolence = date + '\n\n' +
      'Dear Mr. Martinez,\n\n' +
      'I was deeply saddened to hear about the passing of your mother.\n\n' +
      'Please accept my heartfelt condolences during this difficult time. She was a wonderful person who touched many lives, and she will be greatly missed.\n\n' +
      'May you find comfort in the love and support of family and friends. My thoughts and prayers are with you.\n\n' +
      'With deepest sympathy,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 14. CONGRATULATION ==========
    templates.congratulation = date + '\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'Congratulations on your promotion to Operations Manager!\n\n' +
      'I am so happy to hear about your success. Your hard work, dedication, and perseverance have truly paid off.\n\n' +
      'This is just the beginning of even greater things to come. I wish you continued success in all your future endeavors.\n\n' +
      'Well done!\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 15. AUTHORIZATION ==========
    templates.authorization = date + '\n\n' +
      'To Whom It May Concern,\n\n' +
      'I, JUAN DELA CRUZ, hereby authorize [NAME OF AUTHORIZED PERSON] to act on my behalf in processing [WHAT THEY ARE AUTHORIZED TO DO].\n\n' +
      'This authorization is valid from [START DATE] to [END DATE].\n\n' +
      'For any verification, you may contact me at 09123456789.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 16. COVER LETTER ==========
    templates.cover = 'JUAN DELA CRUZ\n123 Purok 5, Barangay Tunasan\nMuntinlupa City, Philippines\n09123456789\njuandelacruz@gmail.com\n\n' + date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\nMuntinlupa City\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am writing to apply for the Sales Associate position at SM Department Store. I believe my skills and experience make me an ideal candidate for this role.\n\n' +
      'With 3 years of retail experience, I have developed strong customer service skills, cash handling expertise, and the ability to work effectively in fast-paced environments.\n\n' +
      'I am excited about the opportunity to contribute to your team and would welcome the chance to discuss my qualifications in an interview.\n\n' +
      'Thank you for your consideration.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 17. CERTIFICATION ==========
    templates.certification = date + '\n\n' +
      'To Whom It May Concern,\n\n' +
      'This is to certify that JUAN DELA CRUZ has been employed as a Cashier at SM Hypermarket from January 2020 to present.\n\n' +
      'During his employment, he has demonstrated excellent work performance and professional conduct.\n\n' +
      'This certification is issued upon the request of the employee for [PURPOSE].\n\n' +
      'Sincerely,\n\n\nGRACE MARTINEZ\nHR Manager\n_________________\nSignature';

    // ========== 18. BORROWING ==========
    templates.borrowing = date + '\n\n' +
      'Mr. Roberto Gomez\nOperations Manager\nSM Hypermarket\n\n' +
      'Dear Mr. Gomez,\n\n' +
      'I am writing to request permission to borrow [ITEM TO BORROW] from [DATE] to [DATE].\n\n' +
      'I will take full responsibility for the item and will return it in good condition.\n\n' +
      'Thank you for your consideration.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 19. DONATION ==========
    templates.donation = date + '\n\n' +
      'Ms. Rachel Tan\nExecutive Director\nABC Foundation\nMuntinlupa City\n\n' +
      'Dear Ms. Tan,\n\n' +
      'I am writing to request a donation for our community outreach program at Barangay Tunasan.\n\n' +
      'The program aims to provide food and school supplies to 100 underprivileged children in our community.\n\n' +
      'Any donation you can provide will be greatly appreciated and will make a significant difference.\n\n' +
      'Thank you for your generosity.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 20. SPONSORSHIP ==========
    templates.sponsorship = date + '\n\n' +
      'Ms. Rachel Tan\nMarketing Manager\nABC Corporation\nAlabang, Muntinlupa City\n\n' +
      'Dear Ms. Tan,\n\n' +
      'I am writing to request sponsorship for our upcoming event, [EVENT NAME], on [DATE].\n\n' +
      'The event will benefit [BENEFICIARIES] and expects to draw [NUMBER] participants.\n\n' +
      'We believe that ABC Corporation\'s involvement would greatly enhance the event\'s success and provide valuable exposure for your company.\n\n' +
      'Thank you for considering our request.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 21. SCHOLARSHIP ==========
    templates.scholarship = 'JUAN DELA CRUZ\n123 Purok 5, Barangay Tunasan\nMuntinlupa City, Philippines\n09123456789\njuandelacruz@gmail.com\n\n' + date + '\n\n' +
      'Scholarship Committee\nPamantasan ng Lungsod ng Muntinlupa\nMuntinlupa City\n\n' +
      'Dear Scholarship Committee,\n\n' +
      'I am writing to apply for the [SCHOLARSHIP NAME] for the academic year [YEAR].\n\n' +
      'I am currently a [YEAR LEVEL] student taking up [COURSE]. My family\'s financial situation makes it challenging to support my education.\n\n' +
      'Attached are my academic records and other supporting documents for your review.\n\n' +
      'Thank you for considering my application.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 22. PROMOTION ==========
    templates.promotion = date + '\n\n' +
      'Mr. Roberto Gomez\nOperations Manager\nSM Hypermarket\n\n' +
      'Dear Mr. Gomez,\n\n' +
      'I am writing to formally request consideration for the position of Senior Cashier.\n\n' +
      'I have been with SM Hypermarket for 3 years and have consistently exceeded performance expectations. I have also completed additional training and taken on extra responsibilities.\n\n' +
      'I believe my experience and dedication make me a strong candidate for this promotion.\n\n' +
      'Thank you for your consideration.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 23. SALARY INCREASE ==========
    templates.salaryincrease = date + '\n\n' +
      'Mr. Roberto Gomez\nOperations Manager\nSM Hypermarket\n\n' +
      'Dear Mr. Gomez,\n\n' +
      'I am writing to request a review of my current salary.\n\n' +
      'I have been with the company for 3 years and have taken on additional responsibilities. I believe my performance and contributions merit a salary increase.\n\n' +
      'I would appreciate the opportunity to discuss this matter at your earliest convenience.\n\n' +
      'Thank you for your consideration.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 24. TRANSFER ==========
    templates.transfer = date + '\n\n' +
      'Mr. Roberto Gomez\nOperations Manager\nSM Hypermarket\n\n' +
      'Dear Mr. Gomez,\n\n' +
      'I am writing to request a transfer to the SM Mall of Asia branch.\n\n' +
      'The reason for this request is [REASON FOR TRANSFER].\n\n' +
      'I believe this transfer would be beneficial for both my professional growth and the company.\n\n' +
      'Thank you for your consideration.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 25. TERMINATION ==========
    templates.termination = date + '\n\n' +
      'JUAN DELA CRUZ JR.\n123 Purok 5, Barangay Tunasan\nMuntinlupa City\n\n' +
      'Dear Mr. Dela Cruz Jr.,\n\n' +
      'This letter is to inform you that your employment with SM Hypermarket will be terminated effective [DATE].\n\n' +
      'Reason: [REASON FOR TERMINATION]\n\n' +
      'Please return all company property and complete the exit process with HR.\n\n' +
      'Sincerely,\n\n\nROBERTO GOMEZ\nOperations Manager\n_________________\nSignature';

    // ========== 26. WARNING ==========
    templates.warning = date + '\n\n' +
      'JUAN DELA CRUZ JR.\n123 Purok 5, Barangay Tunasan\nMuntinlupa City\n\n' +
      'Dear Mr. Dela Cruz Jr.,\n\n' +
      'This letter serves as a written warning regarding your attendance record.\n\n' +
      'You have been absent for [NUMBER] days without prior notice. Continued violation may result in disciplinary action.\n\n' +
      'Please improve your attendance immediately.\n\n' +
      'Sincerely,\n\n\nROBERTO GOMEZ\nOperations Manager\n_________________\nSignature';

    // ========== 27. APPOINTMENT ==========
    templates.appointment = date + '\n\n' +
      'JUAN DELA CRUZ JR.\n123 Purok 5, Barangay Tunasan\nMuntinlupa City\n\n' +
      'Dear Mr. Dela Cruz Jr.,\n\n' +
      'We are pleased to inform you that you have been appointed as Senior Cashier at SM Hypermarket effective [DATE].\n\n' +
      'Your new responsibilities include supervising junior cashiers and handling daily cash deposits.\n\n' +
      'Congratulations on your appointment!\n\n' +
      'Sincerely,\n\n\nROBERTO GOMEZ\nOperations Manager\n_________________\nSignature';

    // ========== 28. MEETING ==========
    templates.meeting = date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am writing to request a meeting with you on [DATE] at [TIME] to discuss [TOPIC].\n\n' +
      'The meeting is important because [REASON].\n\n' +
      'Please let me know if the proposed schedule works for you.\n\n' +
      'Thank you for your time.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 29. FOLLOW-UP ==========
    templates.followup = date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am writing to follow up on my application for the Sales Associate position submitted on [DATE].\n\n' +
      'I remain very interested in the position and would appreciate an update on the status of my application.\n\n' +
      'Thank you for your time.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 30. INTRODUCTION ==========
    templates.introduction = date + '\n\n' +
      'Mr. Jose Martinez\n123 Main Street\nMuntinlupa City\n\n' +
      'Dear Mr. Martinez,\n\n' +
      'I am writing to introduce to you my colleague, [NAME OF PERSON], who will be handling [PROJECT/MATTER].\n\n' +
      '[NAME] has extensive experience and I am confident in their ability to assist you.\n\n' +
      'Please do not hesitate to contact me if you need further information.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 31. NOTICE ==========
    templates.notice = date + '\n\n' +
      'To All Employees,\n\n' +
      'Please be advised that there will be a [EVENT/MEETING/CHANGE] on [DATE].\n\n' +
      'Details:\n\n- [DETAIL 1]\n- [DETAIL 2]\n- [DETAIL 3]\n\n' +
      'Your cooperation is appreciated.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 32. INQUIRY ==========
    templates.inquiry = date + '\n\n' +
      'Ms. Rachel Tan\nPurchasing Manager\nABC Corporation\nAlabang, Muntinlupa City\n\n' +
      'Dear Ms. Tan,\n\n' +
      'I am writing to inquire about [PRODUCT/SERVICE].\n\n' +
      'Specifically, I would like to know:\n\n- [QUESTION 1]\n- [QUESTION 2]\n- [QUESTION 3]\n\n' +
      'I look forward to your response.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 33. ORDER ==========
    templates.order = date + '\n\n' +
      'Ms. Rachel Tan\nPurchasing Manager\nABC Corporation\nAlabang, Muntinlupa City\n\n' +
      'Dear Ms. Tan,\n\n' +
      'I would like to place an order for the following items:\n\n- 100 units of Product A\n- 50 units of Product B\n- 200 units of Product C\n\n' +
      'Please deliver to our office at [ADDRESS] by [DATE].\n\n' +
      'Thank you.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 34. REFUND ==========
    templates.refund = date + '\n\n' +
      'Customer Service Manager\nSM Hypermarket\nSM Tunasan, Muntinlupa City\n\n' +
      'Dear Sir/Madam,\n\n' +
      'I am writing to request a refund for [PRODUCT/SERVICE] purchased on [DATE].\n\n' +
      'Details:\n\n- Receipt No.: [RECEIPT NUMBER]\n- Amount: [AMOUNT]\n- Reason: [REASON FOR REFUND]\n\n' +
      'Attached is the receipt and product for your reference.\n\n' +
      'I look forward to your prompt resolution.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 35. CANCELLATION ==========
    templates.cancellation = date + '\n\n' +
      'Customer Service\nGym Membership Department\nFitness Gym\nMuntinlupa City\n\n' +
      'Dear Sir/Madam,\n\n' +
      'I am writing to cancel my gym membership effective [DATE].\n\n' +
      'Membership Details:\n\n- Name: JUAN DELA CRUZ\n- Membership No.: [NUMBER]\n- Reason: [REASON]\n\n' +
      'Please process my cancellation and confirm.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 36. RENTAL ==========
    templates.rental = date + '\n\n' +
      'Mr. Jose Martinez\nProperty Owner\n123 Main Street\nMuntinlupa City\n\n' +
      'Dear Mr. Martinez,\n\n' +
      'I am writing to inquire about the property for rent at [ADDRESS].\n\n' +
      'I am interested in renting the property and would like to know:\n\n- Monthly rental rate\n- Terms and conditions\n- Move-in date\n\n' +
      'I look forward to your response.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 37. LEASE TERMINATION ==========
    templates.leasetermination = date + '\n\n' +
      'Mr. Jose Martinez\nProperty Owner\n123 Main Street\nMuntinlupa City\n\n' +
      'Dear Mr. Martinez,\n\n' +
      'I am writing to inform you that I will be terminating my lease at [ADDRESS] effective [DATE].\n\n' +
      'I will ensure the property is clean and in good condition before my departure.\n\n' +
      'Please let me know the procedure for the return of my security deposit.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 38. EMPLOYEE VERIFICATION ==========
    templates.employeeverification = date + '\n\n' +
      'To Whom It May Concern,\n\n' +
      'This letter is to verify that JUAN DELA CRUZ has been employed at SM Hypermarket from January 2020 to present.\n\n' +
      'Details:\n\n- Position: Cashier\n- Employment Status: Full-time\n- Last Salary: [AMOUNT]\n\n' +
      'For further verification, please contact HR at [CONTACT].\n\n' +
      'Sincerely,\n\n\nGRACE MARTINEZ\nHR Manager\n_________________\nSignature';

    // ========== 39. REFERENCE ==========
    templates.reference = date + '\n\n' +
      'To Whom It May Concern,\n\n' +
      'I am writing to provide a character reference for JUAN DELA CRUZ JR.\n\n' +
      'I have known Juan for 5 years. During this time, he has demonstrated:\n\n- Honesty and integrity\n- Strong work ethic\n- Reliability and punctuality\n\n' +
      'I highly recommend Juan for any endeavor he chooses to pursue.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 40. APPEAL ==========
    templates.appeal = date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am writing to appeal the decision regarding [WHAT YOU ARE APPEALING].\n\n' +
      'I believe there may have been a misunderstanding. [BRIEF EXPLANATION].\n\n' +
      'I respectfully request reconsideration of this decision.\n\n' +
      'Thank you for your time.\n\n' +
      'Respectfully yours,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 41. SOLICITATION ==========
    templates.solicitation = date + '\n\n' +
      'Ms. Rachel Tan\nMarketing Manager\nABC Corporation\n\n' +
      'Dear Ms. Tan,\n\n' +
      'I am writing to solicit your support for [EVENT/CAUSE].\n\n' +
      'This initiative aims to help [BENEFICIARIES]. Any contribution you can provide will make a significant difference.\n\n' +
      'Thank you for your generosity and support.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 42. NOMINATION ==========
    templates.nomination = date + '\n\n' +
      'Selection Committee\n[AWARD/ORGANIZATION NAME]\nMuntinlupa City\n\n' +
      'Dear Selection Committee,\n\n' +
      'I am writing to nominate [NAME OF NOMINEE] for [AWARD/POSITION].\n\n' +
      'Reasons for nomination:\n\n- [REASON 1]\n- [REASON 2]\n- [REASON 3]\n\n' +
      'I believe [NAME] is highly deserving of this recognition.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 43. ACCEPTANCE ==========
    templates.acceptance = date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'I am pleased to accept the Sales Associate position at SM Department Store.\n\n' +
      'As discussed, my start date will be on [DATE]. I look forward to joining the team.\n\n' +
      'Thank you for this opportunity.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    // ========== 44. REJECTION ==========
    templates.rejection = date + '\n\n' +
      'Ms. Grace Martinez\nHR Manager\nSM Department Store\n\n' +
      'Dear Ms. Martinez,\n\n' +
      'Thank you for offering me the Sales Associate position at SM Department Store.\n\n' +
      'After careful consideration, I have decided to decline the offer as I have accepted another opportunity.\n\n' +
      'I appreciate your time and consideration.\n\n' +
      'Sincerely,\n\n\nJUAN DELA CRUZ\n_________________\nSignature';

    return templates[letterType] || null;
  }
};
