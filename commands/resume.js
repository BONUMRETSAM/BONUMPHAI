const { sendMessage } = require('../handles/sendMessage');

// ========== RESUME TEMPLATES ==========
const resumeTemplates = {
  cashier: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Motivated and results-driven professional with extensive experience in customer service, cash handling, and retail operations. Possesses strong communication, teamwork, and problem-solving skills, with a proven ability to thrive and maintain accuracy in fast-paced environments. Seeking a challenging role that offers professional growth and an opportunity to contribute effectively to team success.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: February 28, 1998
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

WORK EXPERIENCES

Cashier
SM Hypermarket – SM Tunasan

· Processed cash, credit, and digital payments accurately and efficiently.
· Greeted customers warmly, answered inquiries, and assisted with purchases to ensure a positive shopping experience.
· Conducted opening and closing cash counts daily to guarantee precise financial tracking and accountability.

Cashier
SuperCity Alabang Landmark – Alabang, Muntinlupa

· Processed cash, credit, and digital payments accurately and efficiently.
· Greeted customers warmly, answered inquiries, and assisted with purchases to ensure a positive shopping experience.
· Conducted opening and closing cash counts daily to guarantee precise financial tracking and accountability.

Service Crew (Cashier)
Jollibee Shell SLT Alabang

· Took accurate food and beverage orders from customers efficiently in a high-volume setting.
· Prepared food items according to established standard operating procedures and food safety regulations.
· Maintained cleanliness and organization in both dining and kitchen areas to ensure an inviting atmosphere.

───────────────────────────────────────────────────────────────

EDUCATION

Bachelor of Science in Criminology
Pamantasan ng Lungsod ng Muntinlupa
2018

Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2010 – 2014

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
2004 – 2010

───────────────────────────────────────────────────────────────

SKILLS

· Cash Handling & POS Operation
· Teamwork & Collaboration
· Sales & Promotions
· Time Management & Adaptability
· Effective Communication

───────────────────────────────────────────────────────────────

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

  medic: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Compassionate and dedicated healthcare professional with experience in patient care, emergency response, and medical assistance. Skilled in providing quality healthcare services, maintaining patient records, and assisting medical teams in fast-paced clinical environments. Committed to delivering excellent patient care and support.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: March 15, 1995
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English, Tagalog, and Bisaya

───────────────────────────────────────────────────────────────

WORK EXPERIENCES

Emergency Medical Technician (EMT)
Ambulance Services – Muntinlupa City

· Responded to emergency calls and provided immediate medical care to patients.
· Assessed patient conditions and administered basic life support as needed.
· Transported patients safely to medical facilities while monitoring vital signs.

Medical Assistant
Health Center – Barangay Tunasan

· Assisted physicians with patient examinations and medical procedures.
· Recorded patient vital signs, medical history, and symptoms accurately.
· Maintained cleanliness and sterilization of medical equipment and examination rooms.

First Aid Responder
Company Clinic – Alabang

· Provided first aid treatment to employees for minor injuries and illnesses.
· Conducted health awareness programs and basic first aid training.
· Maintained inventory of medical supplies and ensured availability.

───────────────────────────────────────────────────────────────

EDUCATION

Bachelor of Science in Nursing
Pamantasan ng Lungsod ng Muntinlupa
2017

Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2009 – 2013

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
2003 – 2009

───────────────────────────────────────────────────────────────

SKILLS

· Patient Care & Assessment
· Basic Life Support (BLS)
· First Aid & Emergency Response
· Medical Record Keeping
· Communication & Interpersonal Skills

───────────────────────────────────────────────────────────────

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

  janitor: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Hardworking and reliable janitorial professional with extensive experience in cleaning, sanitation, and facility maintenance. Dedicated to maintaining clean, safe, and organized environments. Skilled in operating cleaning equipment, managing cleaning supplies, and following health and safety standards.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: January 10, 1990
· Religion: Roman Catholic
· Civil Status: Married
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

WORK EXPERIENCES

Janitor / Cleaner
SM Mall – Muntinlupa City

· Performed daily cleaning and sanitation of mall common areas, restrooms, and hallways.
· Operated floor cleaning machines, vacuum cleaners, and other janitorial equipment.
· Ensured proper waste segregation and disposal according to environmental guidelines.

Building Maintenance
Office Building – Alabang

· Maintained cleanliness of office spaces, conference rooms, and break areas.
· Replenished cleaning supplies and restroom consumables regularly.
· Reported maintenance issues such as leaks, damages, or equipment malfunctions.

Utility Worker
School Campus – Tunasan

· Cleaned classrooms, corridors, and school facilities on a daily basis.
· Assisted in setting up venues for school events and activities.
· Followed safety protocols in handling cleaning chemicals and equipment.

───────────────────────────────────────────────────────────────

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2004 – 2008

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
1998 – 2004

───────────────────────────────────────────────────────────────

SKILLS

· Floor Care & Maintenance
· Cleaning Equipment Operation
· Waste Management & Segregation
· Time Management & Reliability
· Health & Safety Compliance

───────────────────────────────────────────────────────────────

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

  supervisor: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Results-oriented supervisor with proven leadership experience in managing teams, improving operational efficiency, and ensuring quality standards. Skilled in staff training, performance management, and conflict resolution. Committed to fostering a positive work environment and achieving organizational goals.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: May 20, 1988
· Religion: Roman Catholic
· Civil Status: Married
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

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
· Achieved monthly targets through effective team management and motivation.

Shift Supervisor
Fast Food Chain – Tunasan

· Managed shift schedules and assigned tasks to crew members.
· Handled customer complaints and resolved issues promptly.
· Ensured food safety and quality standards were consistently met.

───────────────────────────────────────────────────────────────

EDUCATION

Bachelor of Science in Business Administration
Pamantasan ng Lungsod ng Muntinlupa
2010

Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2002 – 2006

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
1996 – 2002

───────────────────────────────────────────────────────────────

SKILLS

· Team Leadership & Management
· Performance Monitoring & Evaluation
· Customer Service Excellence
· Problem Solving & Decision Making
· Time Management & Delegation

───────────────────────────────────────────────────────────────

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

  laborer: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Hardworking and physically fit laborer with experience in construction, warehouse operations, and general labor. Skilled in operating hand tools, lifting heavy materials, and following safety protocols. Reliable, punctual, and able to work in fast-paced environments.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: July 15, 1992
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2006 – 2010

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
2000 – 2006

───────────────────────────────────────────────────────────────

SKILLS

· Heavy Lifting & Material Handling
· Hand Tool Operation
· Safety Awareness
· Teamwork & Cooperation
· Physical Stamina & Endurance

───────────────────────────────────────────────────────────────

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

  security: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Vigilant and dependable security professional with experience in safeguarding properties, monitoring surveillance systems, and ensuring the safety of personnel and visitors. Skilled in emergency response, access control, and incident reporting. Committed to maintaining a secure environment.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: September 5, 1990
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2004 – 2008

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
1998 – 2004

───────────────────────────────────────────────────────────────

SKILLS

· CCTV Monitoring & Surveillance
· Access Control & Visitor Management
· Emergency Response & First Aid
· Report Writing & Documentation
· Physical Fitness & Alertness

───────────────────────────────────────────────────────────────

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

  teacher: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Passionate and dedicated educator with experience in teaching, curriculum development, and student assessment. Skilled in creating engaging lesson plans, managing classroom dynamics, and fostering a positive learning environment. Committed to student success and holistic development.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: November 12, 1993
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English, Tagalog, and Bisaya

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

Bachelor of Secondary Education
Pamantasan ng Lungsod ng Muntinlupa
2015

Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2007 – 2011

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
2001 – 2007

───────────────────────────────────────────────────────────────

SKILLS

· Lesson Planning & Delivery
· Classroom Management
· Student Assessment & Evaluation
· Parent Communication
· Educational Technology

───────────────────────────────────────────────────────────────

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

  driver: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Experienced and safety-conscious driver with extensive knowledge of road safety regulations and vehicle maintenance. Skilled in transporting passengers and goods, route planning, and maintaining accurate logs. Committed to providing timely and safe transportation services.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: April 8, 1988
· Religion: Roman Catholic
· Civil Status: Married
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2002 – 2006

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
1996 – 2002

───────────────────────────────────────────────────────────────

SKILLS

· Defensive Driving
· Route Planning & Navigation
· Vehicle Maintenance
· Customer Service
· Time Management

───────────────────────────────────────────────────────────────

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

  sales: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Dynamic and goal-oriented sales professional with proven track record in achieving sales targets and building strong customer relationships. Skilled in product presentation, negotiation, and customer service. Committed to driving revenue growth and exceeding expectations.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: June 25, 1995
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

Bachelor of Science in Business Administration
Pamantasan ng Lungsod ng Muntinlupa
2017

Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2009 – 2013

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
2003 – 2009

───────────────────────────────────────────────────────────────

SKILLS

· Sales & Negotiation
· Customer Relationship Management
· Product Knowledge
· Communication & Persuasion
· Goal Setting & Achievement

───────────────────────────────────────────────────────────────

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

  nurse: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Compassionate and skilled registered nurse with experience in patient care, medication administration, and health education. Dedicated to providing high-quality healthcare services and improving patient outcomes. Strong clinical skills and ability to work in fast-paced environments.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: October 3, 1994
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English, Tagalog, and Bisaya

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

Bachelor of Science in Nursing
Pamantasan ng Lungsod ng Muntinlupa
2016

Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2008 – 2012

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
2002 – 2008

───────────────────────────────────────────────────────────────

SKILLS

· Patient Care & Assessment
· Medication Administration
· IV Therapy & Wound Care
· Health Education & Counseling
· Critical Thinking & Decision Making

───────────────────────────────────────────────────────────────

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

  cook: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Skilled and creative cook with experience in food preparation, kitchen management, and menu planning. Passionate about creating delicious and visually appealing dishes. Knowledgeable in food safety standards and kitchen sanitation practices.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: August 18, 1991
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2005 – 2009

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
1999 – 2005

───────────────────────────────────────────────────────────────

SKILLS

· Food Preparation & Cooking
· Kitchen Sanitation & Safety
· Menu Planning
· Time Management
· Teamwork & Communication

───────────────────────────────────────────────────────────────

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

  engineer: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Highly skilled and detail-oriented engineer with experience in project management, design, and quality assurance. Proficient in engineering software and committed to delivering innovative solutions. Strong analytical skills and ability to work in multidisciplinary teams.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: December 12, 1990
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

Bachelor of Science in Civil Engineering
Pamantasan ng Lungsod ng Muntinlupa
2012

Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2004 – 2008

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
1998 – 2004

───────────────────────────────────────────────────────────────

SKILLS

· Project Management
· AutoCAD & Engineering Software
· Quality Assurance & Control
· Technical Drawing & Design
· Problem Solving & Analysis

───────────────────────────────────────────────────────────────

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

  accountant: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Detail-oriented and analytical accountant with experience in financial reporting, bookkeeping, and tax preparation. Proficient in accounting software and committed to maintaining accuracy and compliance. Strong organizational skills and ability to meet deadlines.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: February 14, 1993
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

Bachelor of Science in Accountancy
Pamantasan ng Lungsod ng Muntinlupa
2015

Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2007 – 2011

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
2001 – 2007

───────────────────────────────────────────────────────────────

SKILLS

· Financial Reporting & Analysis
· Bookkeeping & General Ledger
· Tax Preparation & Compliance
· Accounting Software Proficiency
· Attention to Detail & Accuracy

───────────────────────────────────────────────────────────────

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

  waiter: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Friendly and efficient waiter with experience in food service, customer relations, and order management. Skilled in providing excellent dining experiences and maintaining cleanliness standards. Committed to delivering prompt and courteous service.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: July 20, 1996
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2010 – 2014

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
2004 – 2010

───────────────────────────────────────────────────────────────

SKILLS

· Customer Service Excellence
· Order Taking & Serving
· POS System Operation
· Table Setting & Maintenance
· Communication & Teamwork

───────────────────────────────────────────────────────────────

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

  barista: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Passionate and skilled barista with experience in coffee preparation, customer service, and cafe operations. Knowledgeable in various brewing methods and committed to delivering quality beverages. Friendly and able to work in fast-paced environments.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: March 22, 1997
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

High School Graduate
Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2011 – 2015

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
2005 – 2011

───────────────────────────────────────────────────────────────

SKILLS

· Espresso Machine Operation
· Coffee Brewing Techniques
· Customer Service
· Cash Handling
· Time Management

───────────────────────────────────────────────────────────────

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

  caregiver: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Compassionate and patient caregiver with experience in providing care for elderly, children, and individuals with special needs. Skilled in assisting with daily living activities, medication reminders, and emotional support. Committed to ensuring comfort and safety.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: January 5, 1992
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

Caregiving NC II Certificate
Technical Education and Skills Development Authority (TESDA)
2018

High School Graduate
Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2006 – 2010

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
2000 – 2006

───────────────────────────────────────────────────────────────

SKILLS

· Patient Care & Assistance
· Daily Living Activities Support
· Medication Reminders
· Companionship & Emotional Support
· Safety & Emergency Response

───────────────────────────────────────────────────────────────

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

  receptionist: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Professional and friendly receptionist with experience in front desk operations, customer service, and administrative support. Skilled in handling inquiries, managing appointments, and maintaining office organization. Committed to providing a welcoming environment.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Female
· Nationality: Filipino
· Date of Birth: May 10, 1996
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

Bachelor of Science in Office Administration
Pamantasan ng Lungsod ng Muntinlupa
2018

Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2010 – 2014

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
2004 – 2010

───────────────────────────────────────────────────────────────

SKILLS

· Customer Service & Communication
· Phone Etiquette & Call Handling
· Appointment Scheduling
· Record Keeping & Data Entry
· Multitasking & Organization

───────────────────────────────────────────────────────────────

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

  technician: `JUAN DELA CRUZ (example lang — palitan mo ng actual name tapos passport size id picture sa right side)
Email: juandelacruz@gmail.com | Contact No.: 09123456789 | Address: Muntinlupa City, Philippines

───────────────────────────────────────────────────────────────

PROFESSIONAL SUMMARY

Skilled and detail-oriented technician with experience in equipment maintenance, repair, and troubleshooting. Proficient in diagnosing technical issues and implementing effective solutions. Committed to ensuring equipment reliability and safety.

───────────────────────────────────────────────────────────────

PERSONAL PROFILE

· Gender: Male
· Nationality: Filipino
· Date of Birth: September 15, 1991
· Religion: Roman Catholic
· Civil Status: Single
· Language Spoken: English and Tagalog

───────────────────────────────────────────────────────────────

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

───────────────────────────────────────────────────────────────

EDUCATION

Diploma in Industrial Technology
Technical Education and Skills Development Authority (TESDA)
2013

High School Graduate
Muntinlupa National High School (MNHS)
Muntinlupa City, Philippines
2005 – 2009

Muntinlupa Elementary School (MES)
Muntinlupa City, Philippines
1999 – 2005

───────────────────────────────────────────────────────────────

SKILLS

· Equipment Maintenance & Repair
· Troubleshooting & Diagnostics
· Preventive Maintenance
· Technical Documentation
· Safety Compliance

───────────────────────────────────────────────────────────────

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

// ========== JOB DETECTION ==========
function detectJobType(prompt) {
  if (!prompt) return null;
  const lower = prompt.toLowerCase();
  
  const jobMap = {
    cashier: ['cashier', 'kahera', 'kahero'],
    medic: ['medic', 'medical', 'healthcare assistant'],
    janitor: ['janitor', 'cleaner', 'utility'],
    supervisor: ['supervisor', 'team leader', 'manager'],
    laborer: ['laborer', 'labourer', 'construction worker'],
    security: ['security', 'guard', 'security guard'],
    teacher: ['teacher', 'educator', 'instructor', 'tutor', 'guro'],
    driver: ['driver', 'chauffeur', 'delivery driver', 'drayber'],
    sales: ['sales', 'sales associate', 'sales representative'],
    nurse: ['nurse', 'registered nurse', 'staff nurse', 'nars'],
    cook: ['cook', 'chef', 'line cook', 'kusinero'],
    engineer: ['engineer', 'site engineer', 'inhinyero'],
    accountant: ['accountant', 'bookkeeper', 'accounting'],
    waiter: ['waiter', 'server', 'food server', 'weyter'],
    barista: ['barista', 'coffee', 'cafe'],
    caregiver: ['caregiver', 'nanny', 'yaya', 'tagapag-alaga'],
    receptionist: ['receptionist', 'front desk', 'front office', 'resepsyonista'],
    technician: ['technician', 'maintenance technician', 'teknisyan']
  };
  
  for (const [job, keywords] of Object.entries(jobMap)) {
    if (keywords.some(k => lower.includes(k))) {
      return job;
    }
  }
  
  return null;
}

module.exports = {
  name: ['resume', 'cv', 'create resume', 'make resume', 'gawa resume', 'gumawa ng resume', 'resume for', 'make a resume'],
  description: 'Generate resume templates for various jobs',
  usage: 'resume [job] or make a resume for [job]',
  version: '1.0.0',
  author: 'codex',
  category: 'Utility',
  cooldown: 5,

  async execute(senderId, args, token, event) {
    try {
      const prompt = args.join(' ').trim();
      
      if (!prompt) {
        const availableJobs = Object.keys(resumeTemplates).join(', ');
        await sendMessage(senderId, { 
          text: `RESUME GENERATOR\n\nAvailable Jobs:\n${availableJobs}\n\nUsage:\n- resume [job]\n- make a resume for [job]\n- create resume for [job]\n- gawa ng resume para sa [job]\n\nExamples:\n- resume cashier\n- make a resume for nurse\n- create resume for security guard\n- gawa ng resume para sa teacher`
        }, token);
        return;
      }
      
      const jobType = detectJobType(prompt);
      
      if (!jobType) {
        const availableJobs = Object.keys(resumeTemplates).join(', ');
        await sendMessage(senderId, { 
          text: `Hindi ko mahanap ang job na hinahanap mo.\n\nAvailable Jobs:\n${availableJobs}\n\nUsage:\n- resume [job]\n- make a resume for [job]\n\nExamples:\n- resume cashier\n- make a resume for nurse`
        }, token);
        return;
      }
      
      const resume = resumeTemplates[jobType];
      
      if (resume) {
        await sendMessage(senderId, { text: resume }, token);
      } else {
        await sendMessage(senderId, { text: 'Sorry, walang available na resume template para sa job na yan.' }, token);
      }
      
    } catch (error) {
      console.error('[resume] Error:', error.message);
      await sendMessage(senderId, { text: 'Error sa pag-generate ng resume. Subukan muli.' }, token);
    }
  }
};
