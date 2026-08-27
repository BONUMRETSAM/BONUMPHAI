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
        const jobs = 'cashier, medic, janitor, supervisor, laborer, security, teacher, driver, sales, nurse, cook, engineer, accountant, waiter, barista, caregiver, receptionist, technician';
        await sendMessage(senderId, { text: `RESUME GENERATOR\n\nAvailable Jobs:\n${jobs}\n\nUsage:\n- resume [job]\n- make a resume for [job]\n- create resume for [job]\n- gawa ng resume para sa [job]` }, token);
        return;
      }
      
      const jobType = this.detectJob(prompt);
      
      if (!jobType) {
        const jobs = 'cashier, medic, janitor, supervisor, laborer, security, teacher, driver, sales, nurse, cook, engineer, accountant, waiter, barista, caregiver, receptionist, technician';
        await sendMessage(senderId, { text: `Job not found.\n\nAvailable Jobs:\n${jobs}` }, token);
        return;
      }
      
      const resume = this.getResume(jobType);
      
      if (resume) {
        await sendMessage(senderId, { text: resume }, token);
      }
      
    } catch (error) {
      console.error('[resume] Error:', error.message);
      await sendMessage(senderId, { text: 'Error sa pag-generate ng resume.' }, token);
    }
  },

  detectJob(prompt) {
    const jobs = [
      { key: 'cashier', keywords: ['cashier', 'kahera', 'kahero'] },
      { key: 'medic', keywords: ['medic', 'medical'] },
      { key: 'janitor', keywords: ['janitor', 'cleaner'] },
      { key: 'supervisor', keywords: ['supervisor', 'team leader', 'manager'] },
      { key: 'laborer', keywords: ['laborer', 'labourer', 'construction'] },
      { key: 'security', keywords: ['security', 'guard'] },
      { key: 'teacher', keywords: ['teacher', 'educator', 'tutor', 'guro'] },
      { key: 'driver', keywords: ['driver', 'drayber'] },
      { key: 'sales', keywords: ['sales'] },
      { key: 'nurse', keywords: ['nurse', 'nars'] },
      { key: 'cook', keywords: ['cook', 'chef', 'kusinero'] },
      { key: 'engineer', keywords: ['engineer', 'inhinyero'] },
      { key: 'accountant', keywords: ['accountant', 'bookkeeper', 'accounting'] },
      { key: 'waiter', keywords: ['waiter', 'server', 'weyter'] },
      { key: 'barista', keywords: ['barista', 'coffee', 'cafe'] },
      { key: 'caregiver', keywords: ['caregiver', 'nanny', 'yaya'] },
      { key: 'receptionist', keywords: ['receptionist', 'front desk'] },
      { key: 'technician', keywords: ['technician', 'teknisyan'] }
    ];
    
    for (const job of jobs) {
      if (job.keywords.some(k => prompt.includes(k))) return job.key;
    }
    return null;
  },

  getResume(jobType) {
    const L = '───────────────────────────────────────────────────────────────';
    
    const templates = {
      cashier: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Motivated and results-driven professional with extensive experience in customer service, cash handling, and retail operations. Possesses strong communication, teamwork, and problem-solving skills, with a proven ability to thrive and maintain accuracy in fast-paced environments.

${L}

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: February 28, 1998
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Cashier
SM Hypermarket – SM Tunasan

· Processed cash, credit, and digital payments accurately and efficiently.
· Greeted customers warmly, answered inquiries, and assisted with purchases.
· Conducted opening and closing cash counts daily.

Cashier
SuperCity Alabang Landmark – Alabang, Muntinlupa

· Processed cash, credit, and digital payments accurately and efficiently.
· Greeted customers warmly, answered inquiries, and assisted with purchases.
· Conducted opening and closing cash counts daily.

Service Crew (Cashier)
Jollibee Shell SLT Alabang

· Took accurate food and beverage orders from customers efficiently.
· Prepared food items according to established standard operating procedures.
· Maintained cleanliness and organization in dining and kitchen areas.

${L}

EDUCATION

Bachelor of Science in Criminology
Pamantasan ng Lungsod ng Muntinlupa
2018

Muntinlupa National High School (MNHS)
2010 – 2014

Muntinlupa Elementary School (MES)
2004 – 2010

${L}

SKILLS

· Cash Handling & POS Operation
· Teamwork & Collaboration
· Sales & Promotions
· Time Management & Adaptability
· Effective Communication

${L}

REFERENCES

Angelika Mae Lopez
HR Assistant
09911451130

Czerina Mae Espenesin
Accounting Assistant | Mabex Manufacturing Inc.
09928196248

Menchie Donayre
Graphic Designer
09563892622`,

      medic: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Compassionate and dedicated healthcare professional with experience in patient care, emergency response, and medical assistance. Skilled in providing quality healthcare services, maintaining patient records, and assisting medical teams in fast-paced clinical environments.

${L}

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: March 15, 1995
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English, Tagalog, and Bisaya

${L}

WORK EXPERIENCES

Emergency Medical Technician (EMT)
Ambulance Services – Muntinlupa City

· Responded to emergency calls and provided immediate medical care.
· Assessed patient conditions and administered basic life support.
· Transported patients safely to medical facilities.

Medical Assistant
Health Center – Barangay Tunasan

· Assisted physicians with patient examinations and procedures.
· Recorded patient vital signs and medical history accurately.
· Maintained cleanliness and sterilization of medical equipment.

First Aid Responder
Company Clinic – Alabang

· Provided first aid treatment to employees for minor injuries.
· Conducted health awareness programs and first aid training.
· Maintained inventory of medical supplies.

${L}

EDUCATION

Bachelor of Science in Nursing
Pamantasan ng Lungsod ng Muntinlupa
2017

Muntinlupa National High School (MNHS)
2009 – 2013

Muntinlupa Elementary School (MES)
2003 – 2009

${L}

SKILLS

· Patient Care & Assessment
· Basic Life Support (BLS)
· First Aid & Emergency Response
· Medical Record Keeping
· Communication & Interpersonal Skills

${L}

REFERENCES

Dr. Maria Santos
Medical Director
09987654321

Dr. Jose Reyes
ER Physician
09876543210

Nurse Ana Lopez
Head Nurse
09765432109`,

      janitor: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Hardworking and reliable janitorial professional with extensive experience in cleaning, sanitation, and facility maintenance. Dedicated to maintaining clean, safe, and organized environments.

${L}

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: January 10, 1990
· Religion: Roman Catholic
· Civil Status: Married
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Janitor / Cleaner
SM Mall – Muntinlupa City

· Performed daily cleaning and sanitation of mall common areas.
· Operated floor cleaning machines and janitorial equipment.
· Ensured proper waste segregation and disposal.

Building Maintenance
Office Building – Alabang

· Maintained cleanliness of office spaces and conference rooms.
· Replenished cleaning supplies and restroom consumables.
· Reported maintenance issues such as leaks and damages.

Utility Worker
School Campus – Tunasan

· Cleaned classrooms, corridors, and school facilities daily.
· Assisted in setting up venues for school events.
· Followed safety protocols in handling cleaning chemicals.

${L}

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
2004 – 2008

Muntinlupa Elementary School (MES)
1998 – 2004

${L}

SKILLS

· Floor Care & Maintenance
· Cleaning Equipment Operation
· Waste Management & Segregation
· Time Management & Reliability
· Health & Safety Compliance

${L}

REFERENCES

Mr. Roberto Gomez
Facilities Manager
09123456789

Ms. Linda Cruz
Admin Supervisor
09234567890

Mr. Mario Diaz
Operations Head
09345678901`,

      supervisor: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Results-oriented supervisor with proven leadership experience in managing teams, improving operational efficiency, and ensuring quality standards. Skilled in staff training, performance management, and conflict resolution.

${L}

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: May 20, 1988
· Religion: Roman Catholic
· Civil Status: Married
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Operations Supervisor
Retail Store – Alabang

· Supervised daily operations and managed a team of 15+ staff members.
· Monitored employee performance and provided coaching and feedback.
· Ensured compliance with company policies and customer service standards.

Team Leader
BPO Company – Muntinlupa City

· Led a team of 10 customer service representatives.
· Conducted regular team meetings and performance reviews.
· Achieved monthly targets through effective team management.

Shift Supervisor
Fast Food Chain – Tunasan

· Managed shift schedules and assigned tasks to crew members.
· Handled customer complaints and resolved issues promptly.
· Ensured food safety and quality standards were consistently met.

${L}

EDUCATION

Bachelor of Science in Business Administration
Pamantasan ng Lungsod ng Muntinlupa
2010

Muntinlupa National High School (MNHS)
2002 – 2006

Muntinlupa Elementary School (MES)
1996 – 2002

${L}

SKILLS

· Team Leadership & Management
· Performance Monitoring & Evaluation
· Customer Service Excellence
· Problem Solving & Decision Making
· Time Management & Delegation

${L}

REFERENCES

Ms. Grace Martinez
Operations Manager
09123456789

Mr. David Garcia
HR Manager
09234567890

Ms. Rachel Tan
Senior Manager
09345678901`,

      laborer: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Hardworking and physically fit laborer with experience in construction, warehouse operations, and general labor. Skilled in operating hand tools, lifting heavy materials, and following safety protocols.

${L}

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: July 15, 1992
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Construction Laborer
Construction Site – Muntinlupa City

· Assisted in loading and unloading construction materials.
· Operated hand tools and equipment under supervision.
· Maintained cleanliness and order at the construction site.

Warehouse Helper
Logistics Company – Alabang

· Assisted in receiving, sorting, and organizing warehouse inventory.
· Loaded and unloaded goods from delivery trucks.
· Followed safety guidelines in handling heavy materials.

General Laborer
Factory – Tunasan

· Performed general labor tasks as assigned by supervisor.
· Maintained cleanliness of work area and equipment.
· Assisted in production line operations when needed.

${L}

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
2006 – 2010

Muntinlupa Elementary School (MES)
2000 – 2006

${L}

SKILLS

· Heavy Lifting & Material Handling
· Hand Tool Operation
· Safety Awareness
· Teamwork & Cooperation
· Physical Stamina & Endurance

${L}

REFERENCES

Mr. Ramon Reyes
Site Engineer
09123456789

Mr. Carlos Santos
Warehouse Manager
09234567890

Mr. Eduardo Lopez
Factory Supervisor
09345678901`,

      security: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Vigilant and dependable security professional with experience in safeguarding properties, monitoring surveillance systems, and ensuring the safety of personnel and visitors.

${L}

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: September 5, 1990
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Security Guard
SM Mall – Muntinlupa City

· Monitored CCTV cameras and conducted regular patrols of the premises.
· Controlled access to restricted areas and verified identification.
· Responded to emergencies and prepared incident reports.

Security Officer
Office Building – Alabang

· Greeted visitors and directed them to appropriate offices.
· Maintained logbooks for visitors, vehicles, and deliveries.
· Enforced building security policies and procedures.

Security Guard
Residential Subdivision – Tunasan

· Patrolled residential areas to deter criminal activity.
· Checked gates and perimeter fences regularly.
· Assisted residents with security concerns and emergencies.

${L}

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
2004 – 2008

Muntinlupa Elementary School (MES)
1998 – 2004

${L}

SKILLS

· CCTV Monitoring & Surveillance
· Access Control & Visitor Management
· Emergency Response & First Aid
· Report Writing & Documentation
· Physical Fitness & Alertness

${L}

REFERENCES

Mr. Antonio Reyes
Security Agency Manager
09123456789

Ms. Maria Garcia
Property Manager
09234567890

Mr. Jose Martinez
Security Supervisor
09345678901`,

      teacher: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Passionate and dedicated educator with experience in teaching, curriculum development, and student assessment. Skilled in creating engaging lesson plans, managing classroom dynamics, and fostering a positive learning environment.

${L}

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: November 12, 1993
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English, Tagalog, and Bisaya

${L}

WORK EXPERIENCES

Teacher I
Muntinlupa National High School

· Developed and implemented lesson plans aligned with curriculum standards.
· Assessed student performance through quizzes, exams, and projects.
· Maintained effective communication with parents regarding student progress.

Substitute Teacher
Muntinlupa Elementary School

· Taught various subjects including English, Math, and Science.
· Managed classroom behavior and ensured a conducive learning environment.
· Provided additional support to students with learning difficulties.

Tutor
Private Tutorial Center – Alabang

· Conducted one-on-one tutoring sessions for elementary and high school students.
· Developed personalized learning materials based on student needs.
· Tracked student improvement and adjusted teaching methods accordingly.

${L}

EDUCATION

Bachelor of Secondary Education
Pamantasan ng Lungsod ng Muntinlupa
2015

Muntinlupa National High School (MNHS)
2007 – 2011

Muntinlupa Elementary School (MES)
2001 – 2007

${L}

SKILLS

· Lesson Planning & Delivery
· Classroom Management
· Student Assessment & Evaluation
· Parent Communication
· Educational Technology

${L}

REFERENCES

Dr. Maria Santos
School Principal
09123456789

Ms. Ana Reyes
Department Head
09234567890

Mr. Jose Garcia
Master Teacher
09345678901`,

      driver: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Experienced and safety-conscious driver with extensive knowledge of road safety regulations and vehicle maintenance. Skilled in transporting passengers and goods, route planning, and maintaining accurate logs.

${L}

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: April 8, 1988
· Religion: Roman Catholic
· Civil Status: Married
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Company Driver
Logistics Company – Muntinlupa City

· Transported goods and materials to various destinations.
· Maintained vehicle cleanliness and performed basic maintenance checks.
· Kept accurate records of trips, fuel consumption, and deliveries.

Delivery Driver
Food Delivery Service – Alabang

· Delivered food orders to customers in a timely manner.
· Ensured customer satisfaction through professional service.
· Managed cash and digital payments from customers.

Shuttle Driver
Office Building – Tunasan

· Transported employees to and from designated locations.
· Followed scheduled routes and maintained punctuality.
· Assisted passengers with loading and unloading luggage.

${L}

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
2002 – 2006

Muntinlupa Elementary School (MES)
1996 – 2002

${L}

SKILLS

· Defensive Driving
· Route Planning & Navigation
· Vehicle Maintenance
· Customer Service
· Time Management

${L}

REFERENCES

Mr. Roberto Gomez
Operations Manager
09123456789

Ms. Linda Cruz
HR Supervisor
09234567890

Mr. Mario Diaz
Logistics Head
09345678901`,

      sales: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Dynamic and goal-oriented sales professional with proven track record in achieving sales targets and building strong customer relationships. Skilled in product presentation, negotiation, and customer service.

${L}

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: June 25, 1995
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Sales Associate
SM Department Store – Muntinlupa City

· Assisted customers in finding products and making purchase decisions.
· Achieved monthly sales targets through effective selling techniques.
· Maintained product displays and ensured stock availability.

Sales Representative
Retail Store – Alabang

· Promoted products and services to potential customers.
· Built and maintained relationships with regular clients.
· Processed sales transactions and handled customer inquiries.

Sales Clerk
Boutique – Tunasan

· Provided personalized customer service to shoppers.
· Managed inventory and restocked shelves regularly.
· Handled cash register and credit card transactions.

${L}

EDUCATION

Bachelor of Science in Business Administration
Pamantasan ng Lungsod ng Muntinlupa
2017

Muntinlupa National High School (MNHS)
2009 – 2013

Muntinlupa Elementary School (MES)
2003 – 2009

${L}

SKILLS

· Sales & Negotiation
· Customer Relationship Management
· Product Knowledge
· Communication & Persuasion
· Goal Setting & Achievement

${L}

REFERENCES

Ms. Grace Martinez
Store Manager
09123456789

Mr. David Garcia
Sales Supervisor
09234567890

Ms. Rachel Tan
Regional Manager
09345678901`,

      nurse: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Compassionate and skilled registered nurse with experience in patient care, medication administration, and health education. Dedicated to providing high-quality healthcare services and improving patient outcomes.

${L}

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: October 3, 1994
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English, Tagalog, and Bisaya

${L}

WORK EXPERIENCES

Staff Nurse
Muntinlupa City Hospital

· Provided direct patient care including medication administration and vital signs monitoring.
· Collaborated with physicians and healthcare team in developing care plans.
· Educated patients and families on health management and preventive care.

Clinic Nurse
Company Clinic – Alabang

· Conducted health assessments and provided first aid treatment.
· Maintained accurate patient records and documentation.
· Administered vaccinations and conducted health screenings.

Private Duty Nurse
Home Care – Tunasan

· Provided personalized nursing care to patients in home settings.
· Monitored patient conditions and reported changes to physicians.
· Assisted with activities of daily living and medication management.

${L}

EDUCATION

Bachelor of Science in Nursing
Pamantasan ng Lungsod ng Muntinlupa
2016

Muntinlupa National High School (MNHS)
2008 – 2012

Muntinlupa Elementary School (MES)
2002 – 2008

${L}

SKILLS

· Patient Care & Assessment
· Medication Administration
· IV Therapy & Wound Care
· Health Education & Counseling
· Critical Thinking & Decision Making

${L}

REFERENCES

Dr. Maria Santos
Chief Nurse
09123456789

Dr. Jose Reyes
Medical Director
09234567890

Nurse Ana Lopez
Nurse Supervisor
09345678901`,

      cook: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Skilled and creative cook with experience in food preparation, kitchen management, and menu planning. Passionate about creating delicious and visually appealing dishes.

${L}

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: August 18, 1991
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Cook
Restaurant – Alabang

· Prepared and cooked menu items according to recipes and standards.
· Maintained cleanliness and organization of kitchen workstations.
· Assisted in menu planning and food cost management.

Line Cook
Fast Food Chain – Muntinlupa City

· Prepared food items quickly and accurately during peak hours.
· Followed food safety and sanitation guidelines strictly.
· Collaborated with kitchen team to ensure efficient service.

Kitchen Helper
Hotel – Tunasan

· Assisted chefs in food preparation and plating.
· Maintained inventory of kitchen supplies and ingredients.
· Cleaned and sanitized kitchen equipment and utensils.

${L}

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
2005 – 2009

Muntinlupa Elementary School (MES)
1999 – 2005

${L}

SKILLS

· Food Preparation & Cooking
· Kitchen Sanitation & Safety
· Menu Planning
· Time Management
· Teamwork & Communication

${L}

REFERENCES

Chef Roberto Gomez
Executive Chef
09123456789

Ms. Linda Cruz
Restaurant Manager
09234567890

Mr. Mario Diaz
Kitchen Supervisor
09345678901`,

      engineer: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Highly skilled and detail-oriented engineer with experience in project management, design, and quality assurance. Proficient in engineering software and committed to delivering innovative solutions.

${L}

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: December 12, 1990
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Site Engineer
Construction Company – Muntinlupa City

· Supervised construction activities and ensured compliance with specifications.
· Coordinated with contractors and suppliers for project requirements.
· Prepared progress reports and maintained project documentation.

Project Engineer
Engineering Firm – Alabang

· Assisted in project planning, design, and implementation.
· Conducted site inspections and quality control checks.
· Prepared technical drawings and specifications.

CAD Engineer
Design Office – Tunasan

· Created detailed engineering drawings using CAD software.
· Reviewed and revised designs based on client feedback.
· Collaborated with design team to meet project deadlines.

${L}

EDUCATION

Bachelor of Science in Civil Engineering
Pamantasan ng Lungsod ng Muntinlupa
2012

Muntinlupa National High School (MNHS)
2004 – 2008

Muntinlupa Elementary School (MES)
1998 – 2004

${L}

SKILLS

· Project Management
· AutoCAD & Engineering Software
· Quality Assurance & Control
· Technical Drawing & Design
· Problem Solving & Analysis

${L}

REFERENCES

Engr. Ramon Reyes
Project Manager
09123456789

Engr. Carlos Santos
Engineering Head
09234567890

Engr. Eduardo Lopez
Senior Engineer
09345678901`,

      accountant: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Detail-oriented and analytical accountant with experience in financial reporting, bookkeeping, and tax preparation. Proficient in accounting software and committed to maintaining accuracy and compliance.

${L}

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: February 14, 1993
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Accountant
Accounting Firm – Muntinlupa City

· Prepared financial statements and reports for clients.
· Managed accounts payable and receivable.
· Conducted bank reconciliations and general ledger maintenance.

Bookkeeper
Retail Company – Alabang

· Recorded daily financial transactions accurately.
· Prepared monthly financial summaries and reports.
· Assisted in payroll processing and tax filing.

Accounting Assistant
Manufacturing Company – Tunasan

· Assisted in preparing budgets and financial forecasts.
· Processed invoices and expense reports.
· Maintained organized financial records and documentation.

${L}

EDUCATION

Bachelor of Science in Accountancy
Pamantasan ng Lungsod ng Muntinlupa
2015

Muntinlupa National High School (MNHS)
2007 – 2011

Muntinlupa Elementary School (MES)
2001 – 2007

${L}

SKILLS

· Financial Reporting & Analysis
· Bookkeeping & General Ledger
· Tax Preparation & Compliance
· Accounting Software Proficiency
· Attention to Detail & Accuracy

${L}

REFERENCES

Ms. Grace Martinez
Accounting Manager
09123456789

Mr. David Garcia
Finance Director
09234567890

Ms. Rachel Tan
Senior Accountant
09345678901`,

      waiter: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Friendly and efficient waiter with experience in food service, customer relations, and order management. Skilled in providing excellent dining experiences and maintaining cleanliness standards.

${L}

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: July 20, 1996
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Waiter
Restaurant – Alabang

· Greeted customers and presented menus with recommendations.
· Took accurate food and beverage orders.
· Served food and drinks promptly and professionally.

Server
Cafe – Muntinlupa City

· Prepared and served coffee and food items to customers.
· Maintained cleanliness of dining area and service stations.
· Processed payments using POS system.

Food Server
Hotel Restaurant – Tunasan

· Provided quality dining service to hotel guests.
· Set up dining tables and maintained table cleanliness.
· Assisted in banquet and event services.

${L}

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
2010 – 2014

Muntinlupa Elementary School (MES)
2004 – 2010

${L}

SKILLS

· Customer Service Excellence
· Order Taking & Serving
· POS System Operation
· Table Setting & Maintenance
· Communication & Teamwork

${L}

REFERENCES

Mr. Roberto Gomez
Restaurant Manager
09123456789

Ms. Linda Cruz
Shift Supervisor
09234567890

Mr. Mario Diaz
Food & Beverage Head
09345678901`,

      barista: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Passionate and skilled barista with experience in coffee preparation, customer service, and cafe operations. Knowledgeable in various brewing methods and committed to delivering quality beverages.

${L}

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: March 22, 1997
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Barista
Coffee Shop – Alabang

· Prepared and served coffee beverages according to standards.
· Operated espresso machines and coffee brewing equipment.
· Provided excellent customer service and product recommendations.

Cafe Staff
Cafe – Muntinlupa City

· Prepared food and beverage orders accurately.
· Maintained cleanliness of cafe area and equipment.
· Handled cash and digital payments.

Coffee Attendant
Hotel Lobby Cafe – Tunasan

· Served coffee and refreshments to hotel guests.
· Managed inventory of coffee beans and supplies.
· Ensured quality and consistency of beverages.

${L}

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
2011 – 2015

Muntinlupa Elementary School (MES)
2005 – 2011

${L}

SKILLS

· Espresso Machine Operation
· Coffee Brewing Techniques
· Customer Service
· Cash Handling
· Time Management

${L}

REFERENCES

Ms. Grace Martinez
Cafe Manager
09123456789

Mr. David Garcia
Operations Head
09234567890

Ms. Rachel Tan
Senior Barista
09345678901`,

      caregiver: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Compassionate and patient caregiver with experience in providing care for elderly, children, and individuals with special needs. Skilled in assisting with daily living activities, medication reminders, and emotional support.

${L}

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: January 5, 1992
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Caregiver
Elderly Care Facility – Muntinlupa City

· Assisted residents with activities of daily living including bathing, dressing, and feeding.
· Monitored health conditions and reported changes to nursing staff.
· Provided companionship and emotional support to residents.

Home Caregiver
Private Home – Alabang

· Provided personalized care to an elderly client in home setting.
· Assisted with medication reminders and meal preparation.
· Maintained a clean and safe living environment.

Child Caregiver
Family Residence – Tunasan

· Cared for children including feeding, bathing, and playtime.
· Assisted with homework and educational activities.
· Ensured children's safety and well-being at all times.

${L}

EDUCATION

Caregiving NC II Certificate
Technical Education and Skills Development Authority (TESDA)
2018

High School Graduate
Muntinlupa National High School (MNHS)
2006 – 2010

Muntinlupa Elementary School (MES)
2000 – 2006

${L}

SKILLS

· Patient Care & Assistance
· Daily Living Activities Support
· Medication Reminders
· Companionship & Emotional Support
· Safety & Emergency Response

${L}

REFERENCES

Ms. Maria Santos
Care Facility Manager
09123456789

Ms. Ana Reyes
Nurse Supervisor
09234567890

Mr. Jose Garcia
Client Family Member
09345678901`,

      receptionist: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Professional and friendly receptionist with experience in front desk operations, customer service, and administrative support. Skilled in handling inquiries, managing appointments, and maintaining office organization.

${L}

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: May 10, 1996
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Receptionist
Office Building – Alabang

· Greeted visitors and directed them to appropriate offices.
· Answered and transferred phone calls professionally.
· Managed appointment scheduling and meeting room bookings.

Front Desk Associate
Hotel – Muntinlupa City

· Checked in and checked out guests efficiently.
· Handled guest inquiries and complaints promptly.
· Processed payments and maintained guest records.

Administrative Assistant
Company – Tunasan

· Managed front desk operations and visitor logs.
· Assisted with filing, data entry, and correspondence.
· Ordered and maintained office supplies inventory.

${L}

EDUCATION

Bachelor of Science in Office Administration
Pamantasan ng Lungsod ng Muntinlupa
2018

Muntinlupa National High School (MNHS)
2010 – 2014

Muntinlupa Elementary School (MES)
2004 – 2010

${L}

SKILLS· Customer Service & Communication
· Phone Etiquette & Call Handling
· Appointment Scheduling
· Record Keeping & Data Entry
· Multitasking & Organization

${L}

REFERENCES

Ms. Grace Martinez
Office Manager
09123456789

Mr. David Garcia
HR Supervisor
09234567890

Ms. Rachel Tan
Operations Head
09345678901`,

      technician: `JUAN DELA CRUZ (example lang — palitan mo ng actual name)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

${L}

PROFESSIONAL SUMMARY

Skilled and detail-oriented technician with experience in equipment maintenance, repair, and troubleshooting. Proficient in diagnosing technical issues and implementing effective solutions.

${L}

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: September 15, 1991
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

${L}

WORK EXPERIENCES

Maintenance Technician
Manufacturing Company – Muntinlupa City

· Performed preventive maintenance on production equipment.
· Diagnosed and repaired mechanical and electrical issues.
· Maintained accurate maintenance logs and documentation.

Service Technician
Electronics Company – Alabang

· Installed, tested, and repaired electronic equipment.
· Provided technical support to customers.
· Documented service calls and repair reports.

IT Technician
Office Building – Tunasan

· Maintained computer systems and network infrastructure.
· Troubleshot hardware and software issues.
· Installed and configured software applications.

${L}

EDUCATION

Diploma in Industrial Technology
Technical Education and Skills Development Authority (TESDA)
2013

High School Graduate
Muntinlupa National High School (MNHS)
2005 – 2009

Muntinlupa Elementary School (MES)
1999 – 2005

${L}

SKILLS

· Equipment Maintenance & Repair
· Troubleshooting & Diagnostics
· Preventive Maintenance
· Technical Documentation
· Safety Compliance

${L}

REFERENCES

Engr. Ramon Reyes
Maintenance Manager
09123456789

Engr. Carlos Santos
Technical Head
09234567890

Engr. Eduardo Lopez
Senior Technician
09345678901`
    };

    return templates[jobType] || null;
  }
};
