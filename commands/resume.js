const { sendMessage } = require('../handles/sendMessage');

module.exports = {
  name: ['resume', 'cv', 'create resume', 'make resume', 'gawa resume', 'gumawa ng resume', 'resume for', 'make a resume', 'create a resume'],
  description: 'Generate resume templates',
  usage: 'resume [job]',
  version: '1.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 5,

  async execute(senderId, args, token, event) {
    try {
      const prompt = args.join(' ').trim().toLowerCase();
      
      if (!prompt) {
        const msg = 'RESUME GENERATOR\n\nAvailable Jobs:\ncashier, supervisor, laborer, security\n\nUsage:\nresume [job]';
        await sendMessage(senderId, { text: msg }, token);
        return;
      }
      
      let jobType = null;
      
      if (prompt.includes('cashier') || prompt.includes('kahera')) {
        jobType = 'cashier';
      } else if (prompt.includes('supervisor') || prompt.includes('manager')) {
        jobType = 'supervisor';
      } else if (prompt.includes('laborer') || prompt.includes('construction')) {
        jobType = 'laborer';
      } else if (prompt.includes('security') || prompt.includes('guard')) {
        jobType = 'security';
      }
      
      if (!jobType) {
        const msg = 'Job not found.\n\nAvailable: cashier, supervisor, laborer, security';
        await sendMessage(senderId, { text: msg }, token);
        return;
      }
      
      const resume = this.getResume(jobType);
      
      if (resume) {
        await sendMessage(senderId, { text: resume }, token);
      } else {
        await sendMessage(senderId, { text: 'No template found.' }, token);
      }
      
    } catch (error) {
      console.error('Resume Error:', error);
      await sendMessage(senderId, { text: 'Error: ' + error.message }, token);
    }
  },

  getResume(jobType) {
    const L = '───────────────────────────────────────────────────────────────';
    
    if (jobType === 'cashier') {
      return 'JUAN DELA CRUZ (example lang — palitan mo ng actual name)\n' +
        'Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines\n\n' +
        L + '\n\n' +
        'PROFESSIONAL SUMMARY\n\n' +
        'Motivated and results-driven professional with extensive experience in customer service, cash handling, and retail operations. Possesses strong communication, teamwork, and problem-solving skills, with a proven ability to thrive and maintain accuracy in fast-paced environments.\n\n' +
        L + '\n\n' +
        'PERSONAL PROFILE\n\n' +
        '· Gender: Female\n' +
        '· Nationality: Filipino\n' +
        '· Date of Birth: February 28, 1998\n' +
        '· Religion: Roman Catholic\n' +
        '· Civil Status: Single\n' +
        '· Language Spoken: English and Tagalog\n\n' +
        L + '\n\n' +
        'WORK EXPERIENCES\n\n' +
        'Cashier\n' +
        'SM Hypermarket – SM Tunasan\n\n' +
        '· Processed cash, credit, and digital payments accurately and efficiently.\n' +
        '· Greeted customers warmly, answered inquiries, and assisted with purchases.\n' +
        '· Conducted opening and closing cash counts daily.\n\n' +
        'Cashier\n' +
        'SuperCity Alabang Landmark – Alabang, Muntinlupa\n\n' +
        '· Processed cash, credit, and digital payments accurately and efficiently.\n' +
        '· Greeted customers warmly, answered inquiries, and assisted with purchases.\n' +
        '· Conducted opening and closing cash counts daily.\n\n' +
        'Service Crew (Cashier)\n' +
        'Jollibee Shell SLT Alabang\n\n' +
        '· Took accurate food and beverage orders from customers efficiently.\n' +
        '· Prepared food items according to established standard operating procedures.\n' +
        '· Maintained cleanliness and organization in dining and kitchen areas.\n\n' +
        L + '\n\n' +
        'EDUCATION\n\n' +
        'Bachelor of Science in Criminology\n' +
        'Pamantasan ng Lungsod ng Muntinlupa\n' +
        '2018\n\n' +
        'Muntinlupa National High School (MNHS)\n' +
        '2010 – 2014\n\n' +
        'Muntinlupa Elementary School (MES)\n' +
        '2004 – 2010\n\n' +
        L + '\n\n' +
        'SKILLS\n\n' +
        '· Cash Handling & POS Operation\n' +
        '· Teamwork & Collaboration\n' +
        '· Sales & Promotions\n' +
        '· Time Management & Adaptability\n' +
        '· Effective Communication\n\n' +
        L + '\n\n' +
        'REFERENCES\n\n' +
        'Angelika Mae Lopez\n' +
        'HR Assistant\n' +
        '09911451130\n\n' +
        'Czerina Mae Espenesin\n' +
        'Accounting Assistant | Mabex Manufacturing Inc.\n' +
        '09928196248\n\n' +
        'Menchie Donayre\n' +
        'Graphic Designer\n' +
        '09563892622';
    }
    
    if (jobType === 'supervisor') {
      return 'JUAN DELA CRUZ (example lang — palitan mo ng actual name)\n' +
        'Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines\n\n' +
        L + '\n\n' +
        'PROFESSIONAL SUMMARY\n\n' +
        'Results-oriented supervisor with proven leadership experience in managing teams, improving operational efficiency, and ensuring quality standards.\n\n' +
        L + '\n\n' +
        'PERSONAL PROFILE\n\n' +
        '· Gender: Male\n' +
        '· Nationality: Filipino\n' +
        '· Date of Birth: May 20, 1988\n' +
        '· Religion: Roman Catholic\n' +
        '· Civil Status: Married\n' +
        '· Language Spoken: English and Tagalog\n\n' +
        L + '\n\n' +
        'WORK EXPERIENCES\n\n' +
        'Operations Supervisor\n' +
        'Retail Store – Alabang\n\n' +
        '· Supervised daily operations and managed a team of 15+ staff members.\n' +
        '· Monitored employee performance and provided coaching and feedback.\n' +
        '· Ensured compliance with company policies and customer service standards.\n\n' +
        'Team Leader\n' +
        'BPO Company – Muntinlupa City\n\n' +
        '· Led a team of 10 customer service representatives.\n' +
        '· Conducted regular team meetings and performance reviews.\n' +
        '· Achieved monthly targets through effective team management.\n\n' +
        'Shift Supervisor\n' +
        'Fast Food Chain – Tunasan\n\n' +
        '· Managed shift schedules and assigned tasks to crew members.\n' +
        '· Handled customer complaints and resolved issues promptly.\n' +
        '· Ensured food safety and quality standards were consistently met.\n\n' +
        L + '\n\n' +
        'EDUCATION\n\n' +
        'Bachelor of Science in Business Administration\n' +
        'Pamantasan ng Lungsod ng Muntinlupa\n' +
        '2010\n\n' +
        'Muntinlupa National High School (MNHS)\n' +
        '2002 – 2006\n\n' +
        'Muntinlupa Elementary School (MES)\n' +
        '1996 – 2002\n\n' +
        L + '\n\n' +
        'SKILLS\n\n' +
        '· Team Leadership & Management\n' +
        '· Performance Monitoring & Evaluation\n' +
        '· Customer Service Excellence\n' +
        '· Problem Solving & Decision Making\n' +
        '· Time Management & Delegation\n\n' +
        L + '\n\n' +
        'REFERENCES\n\n' +
        'Ms. Grace Martinez\n' +
        'Operations Manager\n' +
        '09123456789\n\n' +
        'Mr. David Garcia\n' +
        'HR Manager\n' +
        '09234567890\n\n' +
        'Ms. Rachel Tan\n' +
        'Senior Manager\n' +
        '09345678901';
    }
    
    if (jobType === 'laborer') {
      return 'JUAN DELA CRUZ (example lang — palitan mo ng actual name)\n' +
        'Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines\n\n' +
        L + '\n\n' +
        'PROFESSIONAL SUMMARY\n\n' +
        'Hardworking and physically fit laborer with experience in construction, warehouse operations, and general labor.\n\n' +
        L + '\n\n' +
        'PERSONAL PROFILE\n\n' +
        '· Gender: Male\n' +
        '· Nationality: Filipino\n' +
        '· Date of Birth: July 15, 1992\n' +
        '· Religion: Roman Catholic\n' +
        '· Civil Status: Single\n' +
        '· Language Spoken: English and Tagalog\n\n' +
        L + '\n\n' +
        'WORK EXPERIENCES\n\n' +
        'Construction Laborer\n' +
        'Construction Site – Muntinlupa City\n\n' +
        '· Assisted in loading and unloading construction materials.\n' +
        '· Operated hand tools and equipment under supervision.\n' +
        '· Maintained cleanliness and order at the construction site.\n\n' +
        'Warehouse Helper\n' +
        'Logistics Company – Alabang\n\n' +
        '· Assisted in receiving, sorting, and organizing warehouse inventory.\n' +
        '· Loaded and unloaded goods from delivery trucks.\n' +
        '· Followed safety guidelines in handling heavy materials.\n\n' +
        'General Laborer\n' +
        'Factory – Tunasan\n\n' +
        '· Performed general labor tasks as assigned by supervisor.\n' +
        '· Maintained cleanliness of work area and equipment.\n' +
        '· Assisted in production line operations when needed.\n\n' +
        L + '\n\n' +
        'EDUCATION\n\n' +
        'High School Graduate\n' +
        'Muntinlupa National High School (MNHS)\n' +
        '2006 – 2010\n\n' +
        'Muntinlupa Elementary School (MES)\n' +
        '2000 – 2006\n\n' +
        L + '\n\n' +
        'SKILLS\n\n' +
        '· Heavy Lifting & Material Handling\n' +
        '· Hand Tool Operation\n' +
        '· Safety Awareness\n' +
        '· Teamwork & Cooperation\n' +
        '· Physical Stamina & Endurance\n\n' +
        L + '\n\n' +
        'REFERENCES\n\n' +
        'Mr. Ramon Reyes\n' +
        'Site Engineer\n' +
        '09123456789\n\n' +
        'Mr. Carlos Santos\n' +
        'Warehouse Manager\n' +
        '09234567890\n\n' +
        'Mr. Eduardo Lopez\n' +
        'Factory Supervisor\n' +
        '09345678901';
    }
    
    if (jobType === 'security') {
      return 'JUAN DELA CRUZ (example lang — palitan mo ng actual name)\n' +
        'Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines\n\n' +
        L + '\n\n' +
        'PROFESSIONAL SUMMARY\n\n' +
        'Vigilant and dependable security professional with experience in safeguarding properties, monitoring surveillance systems, and ensuring the safety of personnel and visitors.\n\n' +
        L + '\n\n' +
        'PERSONAL PROFILE\n\n' +
        '· Gender: Male\n' +
        '· Nationality: Filipino\n' +
        '· Date of Birth: September 5, 1990\n' +
        '· Religion: Roman Catholic\n' +
        '· Civil Status: Single\n' +
        '· Language Spoken: English and Tagalog\n\n' +
        L + '\n\n' +
        'WORK EXPERIENCES\n\n' +
        'Security Guard\n' +
        'SM Mall – Muntinlupa City\n\n' +
        '· Monitored CCTV cameras and conducted regular patrols of the premises.\n' +
        '· Controlled access to restricted areas and verified identification.\n' +
        '· Responded to emergencies and prepared incident reports.\n\n' +
        'Security Officer\n' +
        'Office Building – Alabang\n\n' +
        '· Greeted visitors and directed them to appropriate offices.\n' +
        '· Maintained logbooks for visitors, vehicles, and deliveries.\n' +
        '· Enforced building security policies and procedures.\n\n' +
        'Security Guard\n' +
        'Residential Subdivision – Tunasan\n\n' +
        '· Patrolled residential areas to deter criminal activity.\n' +
        '· Checked gates and perimeter fences regularly.\n' +
        '· Assisted residents with security concerns and emergencies.\n\n' +
        L + '\n\n' +
        'EDUCATION\n\n' +
        'High School Graduate\n' +
        'Muntinlupa National High School (MNHS)\n' +
        '2004 – 2008\n\n' +
        'Muntinlupa Elementary School (MES)\n' +
        '1998 – 2004\n\n' +
        L + '\n\n' +
        'SKILLS\n\n' +
        '· CCTV Monitoring & Surveillance\n' +
        '· Access Control & Visitor Management\n' +
        '· Emergency Response & First Aid\n' +
        '· Report Writing & Documentation\n' +
        '· Physical Fitness & Alertness\n\n' +
        L + '\n\n' +
        'REFERENCES\n\n' +
        'Mr. Antonio Reyes\n' +
        'Security Agency Manager\n' +
        '09123456789\n\n' +
        'Ms. Maria Garcia\n' +
        'Property Manager\n' +
        '09234567890\n\n' +
        'Mr. Jose Martinez\n' +
        'Security Supervisor\n' +
        '09345678901';
    }
    
    return null;
  }
};
