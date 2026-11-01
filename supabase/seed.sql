-- ============================================================================
-- NAGARIK AI - VERIFIED SCHEMES SEED DATA
-- ============================================================================

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-001', 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)', 'Government of India', 'central', 'All-India', 'farmer', '₹6,000 per year transferred in three equal 4-monthly installments of ₹2,000 directly via DBT into Aadhaar-seeded accounts.', '["Small and marginal landholder farmer families owning cultivable land", "Valid land ownership records (Pattadar Passbook / Khata)", "Aadhaar-seeded active bank account and completed eKYC", "Excludes institutional landholders and families holding constitutional or income tax payee status"]'::jsonb, '["Aadhaar Card", "Land Ownership Documents (Khata/1B)", "Bank Passbook with Aadhaar Linkage", "Active Mobile Number"]'::jsonb, 'Register online at pmkisan.gov.in (Farmers Corner) or via Common Service Centres (CSC) with Aadhaar authentication.', 'https://pmkisan.gov.in', 'Under the PM-KISAN scheme, an amount of Rs 6,000/- per year is released by the Central Government in three 4-monthly instalments of Rs 2,000/- each directly into the bank accounts of the beneficiary farmer families holding cultivable land.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-002', 'Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana (PM-JAY)', 'Government of India', 'central', 'All-India', 'healthcare', 'Cashless health cover up to ₹5,00,000 per family per year for secondary and tertiary care hospitalization in empanelled hospitals.', '["Households identified under rural/urban deprivation criteria of SECC 2011", "All senior citizens aged 70 years and above regardless of income level (2024 Union Cabinet Expansion)", "No cap on family size, gender, or age"]'::jsonb, '["Aadhaar Card", "Ration Card or PM-JAY Family ID", "Mobile Number for OTP Verification"]'::jsonb, 'Visit beneficiary.nha.gov.in, download Ayushman App, or consult the Ayushman Mitra at any empanelled hospital.', 'https://nha.gov.in/PM-JAY', 'Ayushman Bharat PM-JAY provides health assurance cover of Rs 5 lakh per family per year for secondary and tertiary healthcare hospitalisation to over 12 crore poor and vulnerable families. In 2024, coverage was extended to all senior citizens aged 70 years and above.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-003', 'Pradhan Mantri MUDRA Yojana (PMMY)', 'Government of India', 'central', 'All-India', 'msme', 'Collateral-free business loans up to ₹20 Lakhs under Shishu (up to ₹50k), Kishore (₹50k-₹5L), Tarun (₹5L-₹10L), and Tarun Plus (₹10L-₹20L).', '["Any Indian citizen planning or running a non-farm income-generating micro enterprise", "Manufacturing, processing, trading, or service sector enterprises", "Satisfactory credit track record with no bank default"]'::jsonb, '["Identity Proof (Aadhaar/PAN)", "Proof of Residence", "Business Registration / Udyam Certificate", "Last 6 Months Bank Statement", "Projected Quotations"]'::jsonb, 'Apply through any commercial bank, Regional Rural Bank (RRB), NBFC, or online through the Udyamimitra portal.', 'https://www.mudra.org.in', 'Pradhan Mantri MUDRA Yojana provides loans up to 20 lakh to non-corporate, non-farm small/micro enterprises. Loans are given by Commercial Banks, RRBs, Small Finance Banks, MFIs and NBFCs without collateral requirement.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-004', 'National Scholarship Portal - Post Matric Scholarships', 'Government of India', 'central', 'All-India', 'student', '100% compulsory non-refundable fees reimbursement plus monthly maintenance allowance directly credited via DBT.', '["Students enrolled in recognized post-matric, undergraduate, or postgraduate professional courses", "Family annual income from all sources not exceeding \u20b92.50 Lakhs per annum", "Minimum 50% marks in the qualifying previous year examination"]'::jsonb, '["Aadhaar Card", "Previous Marksheet", "Income Certificate issued by Revenue Authority", "Category Certificate", "College Bonafide Certificate", "Aadhaar-Linked Bank Passbook"]'::jsonb, 'Register online via scholarships.gov.in using Aadhaar One-Time Registration (OTR).', 'https://scholarships.gov.in', 'The Post Matric Scholarship Scheme supports meritorious students belonging to economically backward classes pursuing higher education, covering course tuition fees and maintenance expenses disbursed directly into student bank accounts.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-005', 'Pradhan Mantri Awas Yojana - Urban (PMAY-U 2.0)', 'Government of India', 'central', 'All-India', 'women', 'Interest subsidy up to ₹1.80 Lakhs on home loans for purchasing or constructing a first-time pucca house.', '["Beneficiary family must not own a pucca house in any part of India", "Mandatory female head ownership or joint ownership with spouse", "Annual income criteria: EWS (up to \u20b93L), LIG (\u20b93L-\u20b96L), MIG (\u20b96L-\u20b99L)"]'::jsonb, '["Aadhaar of all family members", "Income Proof / Salary Slip", "Property Title / Sale Deed Agreement", "Bank Account Details", "Affidavit of no other pucca house"]'::jsonb, 'Apply through the official PMAY-U portal or nearest Urban Local Body (ULB) / Municipal Ward Office.', 'https://pmay-urban.gov.in', 'PMAY-U 2.0 addresses the housing needs of urban poor and middle-class families with mandatory female ownership, granting interest subsidies on home loans to facilitate dignified pucca housing across statutory towns.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-006', 'Sukanya Samriddhi Yojana (SSY)', 'Government of India', 'central', 'All-India', 'women', 'High government-guaranteed interest rate (8.2% p.a.) with Section 80C tax exemption (EEE status) and maturity at age 21.', '["Account can be opened by parent or legal guardian for a girl child aged below 10 years", "Maximum of two accounts per family (three allowed in case of twins/triplets)", "Minimum annual deposit \u20b9250; maximum annual deposit \u20b91,50,000"]'::jsonb, '["Girl Child Birth Certificate", "Guardian Identity Proof (Aadhaar/PAN)", "Proof of Residence", "Guardian Photographs"]'::jsonb, 'Open at any branch of India Post (Post Office) or authorized public/private sector commercial banks.', 'https://www.indiapost.gov.in', 'Sukanya Samriddhi Account is a government-backed savings scheme targeted at the parents of girl children, designed to build a dedicated fund for female higher education and marriage expenses with sovereign interest rates.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-007', 'Atal Pension Yojana (APY)', 'Government of India', 'central', 'All-India', 'senior', 'Guaranteed minimum monthly pension of ₹1,000 to ₹5,000 per month starting from age 60 for lifetime, with corpus returned to nominee.', '["Indian citizen aged between 18 and 40 years holding a savings bank or post office account", "Subscriber must not be an income taxpayer", "Monthly contribution auto-debited depending on age of enrollment"]'::jsonb, '["Aadhaar Card", "Savings Bank Account Number", "Active Mobile Number", "Nominee Aadhaar Details"]'::jsonb, 'Enroll through your bank branch, NetBanking portal, or via PFRDA NPS Lite platform.', 'https://www.npscra.nsdl.co.in', 'Atal Pension Yojana is a guaranteed pension scheme administered by PFRDA focused on unorganized sector workers, providing a defined monthly pension of Rs 1,000 to Rs 5,000 from age 60 till death.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-008', 'PM Street Vendor''s AtmaNirbhar Nidhi (PM SVANidhi)', 'Government of India', 'central', 'All-India', 'msme', 'Working capital loan of ₹10,000 (1st tranche), ₹20,000 (2nd tranche), and ₹50,000 (3rd tranche) with 7% interest subsidy and cashback on digital transactions.', '["Street vendors engaged in vending in urban areas on or before March 24, 2020", "Possession of Certificate of Vending / Identity Card issued by Urban Local Body", "No requirement of collateral"]'::jsonb, '["Aadhaar Card", "Voter ID", "Vending Certificate / ULB Recommendation Letter", "Bank Account Details"]'::jsonb, 'Apply online at pmsvanidhi.mohua.gov.in or through Urban Local Bodies and CSC centers.', 'https://pmsvanidhi.mohua.gov.in', 'PM SVANidhi is a central sector scheme that facilitates affordable collateral-free working capital loans to street vendors to resume their livelihoods post-pandemic, incentivizing timely repayment and digital transactions.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-009', 'Rythu Bharosa - PM KISAN State Component', 'Government of India', 'state', 'Andhra Pradesh / Telangana', 'farmer', 'Financial assistance of ₹13,500 per farmer family per year (inclusive of Central PM-KISAN component) for agricultural input costs.', '["Landholder farmer families possessing Pattadar Passbook and active 1B records", "Eligible tenant farmers belonging to SC, ST, BC, and Minority communities with Crop Cultivator Rights Card (CCRC)", "Excludes government employees and non-farming commercial income tax payees"]'::jsonb, '["Pattadar Passbook / CCRC Card", "Aadhaar Card", "Ration Card", "NPCI-Mapped Bank Passbook"]'::jsonb, 'Register through village agriculture assistants at Rythu Bharosa Kendras (RBKs) or online state portal.', 'https://ysrrythubharosa.ap.gov.in', 'Rythu Bharosa provides direct cash assistance of Rs 13,500 per year to cultivating farmer families and eligible landless tenant farmers before crop seasons to purchase quality seeds, fertilizers, and farm equipment.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-010', 'Pradhan Mantri Ujjwala Yojana (PMUY 2.0)', 'Government of India', 'central', 'All-India', 'women', 'Deposit-free LPG connection including a free cylinder, pressure regulator, safety hose, and gas stove for adult female members of poor households.', '["Adult female citizen belonging to BPL or underprivileged household", "No member of the household must possess an existing LPG connection from any OMC", "Family listed in SECC list or under 14-point declaration categories"]'::jsonb, '["Aadhaar of female applicant", "Ration Card showing family composition", "Bank Account Passbook", "Proof of Address"]'::jsonb, 'Submit application at any authorized LPG distributor (Indane, BharatGas, HP Gas) or online via pmuy.gov.in.', 'https://www.pmuy.gov.in', 'Pradhan Mantri Ujjwala Yojana aims to safeguard the health of women and children by providing clean cooking fuel (LPG) to women from low-income households with zero upfront connection deposits.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-011', 'PM Vishwakarma Yojana', 'Government of India', 'central', 'All-India', 'msme', 'Collateral-free credit support up to ₹3 Lakhs at 5% concessional interest, ₹15,000 modern toolkit grant, PM Vishwakarma Certificate, and skill training with ₹500/day stipend.', '["Artisan or craftsperson working with hands and tools in one of 18 traditional family trades (e.g., carpenter, blacksmith, potter, mason, tailor)", "Minimum age 18 years on date of registration", "Limited to one member per family with no similar credit availed under PMEGP or MUDRA in last 5 years"]'::jsonb, '["Aadhaar Card", "Mobile Number", "Bank Details", "Ration Card"]'::jsonb, 'Biometric registration at nearest Common Services Centre (CSC) followed by 3-tier verification.', 'https://pmvishwakarma.gov.in', 'PM Vishwakarma provides end-to-end holistic support to traditional artisans and craftspersons across 18 trades, offering skill training stipends, modern toolkits, and collateral-free enterprise loans up to Rs 3 lakh.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-012', 'National Family Benefit Scheme (NFBS)', 'Government of India', 'central', 'All-India', 'senior', 'Lump-sum one-time financial assistance of ₹20,000 to the bereaved family in the event of death of the primary breadwinner.', '["Primary breadwinner must have died between the age of 18 and 59 years", "Family must belong to Below Poverty Line (BPL) category", "Deceased breadwinner''s earnings contributed the largest proportion to household income"]'::jsonb, '["Death Certificate of breadwinner", "Age Proof of deceased", "BPL Ration Card / Income Certificate", "Applicant Bank Passbook"]'::jsonb, 'Apply through the local Revenue Division Officer (RDO), Taluk Tehsildar, or Municipal Commissioner office.', 'https://nsap.nic.in', 'Under the National Social Assistance Programme (NSAP), the National Family Benefit Scheme provides a one-time cash grant of Rs 20,000 to poor households upon the natural or accidental demise of the primary earning member.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-013', 'Stand Up India Scheme', 'Government of India', 'central', 'All-India', 'women', 'Composite bank loans between ₹10 Lakhs and ₹1 Crore to SC, ST, and Women borrowers for greenfield business ventures.', '["SC/ST and/or woman entrepreneur above 18 years of age", "Loans provided only for greenfield projects in manufacturing, services, trading, or agri-allied sectors", "In non-individual enterprises, 51% shareholding must be held by SC/ST or woman"]'::jsonb, '["Aadhaar/PAN", "Proof of Category (SC/ST certificate)", "Business Plan / Project Report", "Pollution / Municipal NOC where required"]'::jsonb, 'Apply directly at any commercial bank branch or online through standupmitra.in portal.', 'https://www.standupmitra.in', 'Stand Up India facilitates bank loans between Rs 10 lakh and Rs 1 crore to at least one Scheduled Caste (SC) or Scheduled Tribe (ST) borrower and at least one woman borrower per bank branch for setting up greenfield enterprises.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-014', 'Pradhan Mantri Matru Vandana Yojana (PMMVY)', 'Government of India', 'central', 'All-India', 'women', 'Direct cash incentive of ₹5,000 in two installments for the first child, and ₹6,000 in a single installment for a second girl child.', '["Pregnant Women and Lactating Mothers (PW&LM) who are socially or economically disadvantaged", "Early registration of pregnancy (within 570 days from LMP) and at least one Antenatal Check-up (ANC)", "Excludes regular government or public sector employees"]'::jsonb, '["Mother and Father Aadhaar Cards", "Mother and Child Protection (MCP) Card", "Aadhaar-Linked Bank Passbook"]'::jsonb, 'Register at nearest Anganwadi Centre or online via pmmvy.wcd.gov.in portal.', 'https://pmmvy.wcd.gov.in', 'PMMVY provides partial compensation for wage loss in terms of cash incentive so that women can take adequate rest before and after delivery, promoting positive health practices and institutional immunization.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-015', 'National Apprenticeship Promotion Scheme (NAPS-2)', 'Government of India', 'central', 'All-India', 'student', 'Direct benefit transfer of 25% of prescribed stipend up to ₹1,500 per month per apprentice directly to the apprentice''s bank account.', '["Candidates who have attained 14 years of age (18 for designated hazardous trades)", "Possesses minimum educational/technical qualifications required for the apprenticeship trade", "Registered on the Apprenticeship portal with active e-KYC"]'::jsonb, '["Aadhaar Card", "Educational Marksheet (10th/12th/ITI/Diploma/Degree)", "Bank Passbook"]'::jsonb, 'Register online at apprenticeshipindia.gov.in and apply for vacancies posted by industry establishments.', 'https://www.apprenticeshipindia.gov.in', 'NAPS-2 promotes apprenticeship training in establishments by reimbursing stipends directly into the bank accounts of apprentices using Aadhaar-enabled Direct Benefit Transfer, enhancing youth employability.', '2026-10-30')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;

INSERT INTO public.schemes (id, name, department, level, state, category, benefit, eligibility_criteria, documents_required, how_to_apply, official_url, source_text, last_verified_date)
VALUES ('SCHEME-016', 'Thalliki Vandanam (Talliki Vandanam / తల్లికి వందనం)', 'Government of India', 'state', 'Andhra Pradesh', 'women, student, education', 'Financial assistance of ₹15,000 per year transferred directly via DBT into the Aadhaar-seeded bank account of the mother for every school-going child.', '["Mothers or recognized legal guardians residing in Andhra Pradesh whose children are studying in Classes 1 to 12 in recognized Government, Aided, or Private schools", "Student must maintain minimum 75% school attendance throughout the academic year", "Family must belong to BPL category with active White Ration Card / Rice Card", "Aadhaar-seeded bank account with active NPCI mapping required for Direct Benefit Transfer"]'::jsonb, '["Mother''s Aadhaar Card", "Child''s Aadhaar Card & Student Information System (Child Info) ID", "White Ration Card / Rice Card (Civil Supplies AP)", "Aadhaar-Seeded Bank Passbook / Account details", "School Bonafide Certificate / School Admission Proof"]'::jsonb, 'Applications are submitted through the Grama / Ward Sachivalayam (Village / Ward Secretariat) or the official School Education Portal (cse.ap.gov.in / myscheme.gov.in/schemes/tv). Verification is conducted via the Headmaster and Social Audit.', 'https://www.myscheme.gov.in/schemes/tv', 'Under the Thalliki Vandanam scheme of the Andhra Pradesh Government (successor to Amma Vodi), financial assistance of Rs 15,000/- per year is deposited directly into the bank account of eligible mothers for sending their children to school from Class 1 to Class 12, to curb school dropout rates and promote universal education.', '2026-10-31')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    benefit = EXCLUDED.benefit,
    eligibility_criteria = EXCLUDED.eligibility_criteria,
    official_url = EXCLUDED.official_url,
    state = EXCLUDED.state,
    last_verified_date = EXCLUDED.last_verified_date;
