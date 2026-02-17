// ═══════════════════════════════════════════════════════════════
// Civic Social — Mock Legislative Data
// ═══════════════════════════════════════════════════════════════
//
// Comprehensive mock data for the Live Legislative Tracker.
// All summaries and impact analyses are written in neutral,
// non-partisan language using "Supporters argue..." /
// "Critics argue..." framing.
//
// ═══════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────

export type BillStatus =
  | 'introduced'
  | 'committee'
  | 'floor'
  | 'passed_chamber'
  | 'conference'
  | 'passed_both'
  | 'signed'
  | 'vetoed'
  | 'failed';

export type Chamber = 'house' | 'senate';

export interface Legislator {
  id: string;
  name: string;
  party: 'D' | 'R' | 'I';
  state: string;
  chamber: Chamber;
  imageInitials: string;
}

export interface StatusChange {
  status: BillStatus;
  date: Date;
  description: string;
}

export interface Amendment {
  id: string;
  number: string;
  sponsor: Legislator;
  title: string;
  description: string;
  status: 'proposed' | 'adopted' | 'rejected' | 'withdrawn';
  date: Date;
}

export interface VoteTally {
  yea: number;
  nay: number;
  abstain: number;
  notVoting: number;
  total: number;
  result: 'passed' | 'failed' | 'pending';
  date: Date | null;
  partyBreakdown: {
    party: 'D' | 'R' | 'I';
    yea: number;
    nay: number;
  }[];
}

export interface ImpactCategory {
  category: string;
  icon: string; // lucide icon name
  supportersArgue: string;
  criticsArgue: string;
  potentialOutcomes: string[];
}

export interface Bill {
  id: string;
  number: string;
  title: string;
  shortTitle: string;
  session: string;
  chamber: Chamber;

  sponsor: Legislator;
  cosponsors: Legislator[];

  status: BillStatus;
  statusHistory: StatusChange[];
  introducedDate: Date;
  lastActionDate: Date;
  nextAction?: { description: string; date: Date };

  quickSummary: string;
  detailedSummary: {
    coreProvisions: string[];
    fundingImplications: string;
    changesToExistingLaw: string[];
    timeline: string;
  };
  impactAnalysis: ImpactCategory[];

  topics: string[];

  votes?: VoteTally;
  amendments: Amendment[];

  officialTextUrl: string;
  congressGovUrl: string;

  discussionCount: number;
  followersCount: number;
  isControversial: boolean;
  isHighImpact: boolean;

  relatedBillIds: string[];
}

// ─── Constants ───────────────────────────────────────────────

export const BILL_STATUS_ORDER: BillStatus[] = [
  'introduced',
  'committee',
  'floor',
  'passed_chamber',
  'conference',
  'passed_both',
  'signed',
];

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  introduced: 'Introduced',
  committee: 'In Committee',
  floor: 'Floor Vote',
  passed_chamber: 'Passed Chamber',
  conference: 'In Conference',
  passed_both: 'Passed Both Chambers',
  signed: 'Signed into Law',
  vetoed: 'Vetoed',
  failed: 'Failed',
};

export const TOPIC_FILTERS: string[] = [
  'All',
  'Healthcare',
  'Economy',
  'Climate',
  'Immigration',
  'Technology',
  'Defense',
  'Elections',
  'Education',
  'Civil Rights',
];

// ─── Mock Legislators ────────────────────────────────────────

export const mockLegislators: Legislator[] = [
  {
    id: 'leg-01',
    name: 'Maria Santos',
    party: 'D',
    state: 'CA',
    chamber: 'house',
    imageInitials: 'MS',
  },
  {
    id: 'leg-02',
    name: 'James Thornton',
    party: 'R',
    state: 'TX',
    chamber: 'senate',
    imageInitials: 'JT',
  },
  {
    id: 'leg-03',
    name: 'Amara Osei',
    party: 'D',
    state: 'GA',
    chamber: 'senate',
    imageInitials: 'AO',
  },
  {
    id: 'leg-04',
    name: 'Robert Keller',
    party: 'R',
    state: 'OH',
    chamber: 'house',
    imageInitials: 'RK',
  },
  {
    id: 'leg-05',
    name: 'Lisa Chang',
    party: 'D',
    state: 'WA',
    chamber: 'house',
    imageInitials: 'LC',
  },
  {
    id: 'leg-06',
    name: 'Samuel Whitfield',
    party: 'I',
    state: 'VT',
    chamber: 'senate',
    imageInitials: 'SW',
  },
  {
    id: 'leg-07',
    name: 'Angela Moretti',
    party: 'R',
    state: 'FL',
    chamber: 'senate',
    imageInitials: 'AM',
  },
  {
    id: 'leg-08',
    name: 'David Nakamura',
    party: 'D',
    state: 'HI',
    chamber: 'house',
    imageInitials: 'DN',
  },
];

// ─── Helper References ───────────────────────────────────────

const [santos, thornton, osei, keller, chang, whitfield, moretti, nakamura] =
  mockLegislators;

// ─── Mock Bills ──────────────────────────────────────────────

export const mockBills: Bill[] = [
  // ──────────────────────────────────────────────────────────
  // 1. H.R. 2847 — Affordable Healthcare Access Act
  // ──────────────────────────────────────────────────────────
  {
    id: 'bill-hr-2847',
    number: 'H.R. 2847',
    title: 'Affordable Healthcare Access Act',
    shortTitle: 'Healthcare Access Act',
    session: '119th Congress',
    chamber: 'house',

    sponsor: santos,
    cosponsors: [keller, chang, nakamura],

    status: 'committee',
    statusHistory: [
      {
        status: 'introduced',
        date: new Date('2024-10-15'),
        description: 'Introduced by Rep. Santos and referred to the House Committee on Energy and Commerce.',
      },
      {
        status: 'committee',
        date: new Date('2024-11-08'),
        description:
          'Referred to the Subcommittee on Health. Hearings scheduled with testimony from CBO analysts, hospital administrators, and insurance industry representatives.',
      },
    ],
    introducedDate: new Date('2024-10-15'),
    lastActionDate: new Date('2025-01-22'),
    nextAction: {
      description: 'Subcommittee markup session',
      date: new Date('2025-02-18'),
    },

    quickSummary:
      'This bill aims to expand access to affordable healthcare by creating a public option insurance plan available through the existing ACA marketplace. It includes provisions for negotiating prescription drug prices for the public plan and extends subsidies for individuals earning up to 500% of the federal poverty level. The Congressional Budget Office estimates coverage would extend to approximately 7 million additional Americans over ten years.',

    detailedSummary: {
      coreProvisions: [
        'Establishes a government-administered public health insurance option available on ACA marketplaces in all 50 states and territories.',
        'Authorizes the Secretary of HHS to negotiate prescription drug prices for the public plan, with prices capped at 120% of the average international market rate.',
        'Expands premium tax credit eligibility from 400% to 500% of the federal poverty level and eliminates the subsidy cliff.',
        'Creates a $15 billion fund over 10 years for rural hospital stabilization and telehealth infrastructure grants.',
      ],
      fundingImplications:
        'Estimated cost of $450 billion over 10 years, offset by projected savings of $200 billion from drug price negotiation, a 0.1% payroll tax increase on incomes above $400,000, and reductions in uncompensated care costs. CBO projects a net deficit impact of $120 billion over the scoring window.',
      changesToExistingLaw: [
        'Amends Title XVIII of the Social Security Act to add a new Part F for the public option.',
        'Modifies the Affordable Care Act Section 1311 to integrate the public plan into existing marketplace infrastructure.',
        'Amends the Federal Food, Drug, and Cosmetic Act to enable price negotiation for the public option formulary.',
      ],
      timeline:
        'If enacted, marketplace enrollment would begin in the third open enrollment period following passage. Drug price negotiations would commence within 18 months. Rural hospital grants would be disbursed beginning in the first fiscal year after enactment.',
    },

    impactAnalysis: [
      {
        category: 'Healthcare',
        icon: 'heart-pulse',
        supportersArgue:
          'Supporters argue the public option would increase competition, lower premiums by an estimated 7-12%, and provide coverage for millions of currently uninsured Americans, particularly in rural areas with limited insurer participation.',
        criticsArgue:
          'Critics argue a government-run plan could undercut private insurers, potentially leading to reduced competition over time, and that the drug price caps may reduce pharmaceutical investment in new treatments.',
        potentialOutcomes: [
          'An estimated 7 million additional Americans could gain health coverage within five years of implementation.',
          'Premiums in the ACA marketplace may decrease by 7-12% due to increased competition from the public option.',
          'Rural hospitals facing closure could receive stabilization funding, though the $15 billion may be insufficient for all at-risk facilities.',
          'Pharmaceutical companies may adjust R&D spending in response to price negotiation provisions.',
        ],
      },
      {
        category: 'Economy',
        icon: 'trending-up',
        supportersArgue:
          'Supporters argue reduced healthcare costs would free up household spending, boost small business formation by decoupling insurance from employment, and lower overall uncompensated care costs borne by hospitals and taxpayers.',
        criticsArgue:
          'Critics argue the payroll tax increase, even if limited to high earners, sets a precedent for further tax expansion, and that the net deficit impact of $120 billion could contribute to long-term fiscal imbalances.',
        potentialOutcomes: [
          'Household healthcare spending may decrease for families earning under $100,000 annually.',
          'Small businesses may see reduced pressure to provide health benefits, potentially shifting more workers to public and marketplace plans.',
          'Insurance industry employment could be affected in regions heavily dependent on private health plan administration.',
        ],
      },
      {
        category: 'Taxpayers',
        icon: 'receipt',
        supportersArgue:
          'Supporters argue that extending coverage reduces emergency room visits and uncompensated care, which currently cost taxpayers an estimated $42 billion annually, producing net savings despite the upfront investment.',
        criticsArgue:
          'Critics argue the $450 billion price tag represents a significant taxpayer commitment, that the projected savings from drug negotiation are uncertain, and that government programs historically exceed initial cost estimates.',
        potentialOutcomes: [
          'Federal spending on healthcare would increase, though partially offset by projected drug negotiation savings.',
          'State Medicaid budgets could be affected if enrollment patterns shift between programs.',
          'Long-term fiscal impact depends on enrollment numbers, drug negotiation outcomes, and administrative costs relative to CBO projections.',
        ],
      },
    ],

    topics: ['Healthcare', 'Economy'],

    amendments: [
      {
        id: 'amd-hr2847-01',
        number: 'H.Amdt. 114',
        sponsor: keller,
        title: 'Rural Provider Reimbursement Amendment',
        description:
          'Increases reimbursement rates for rural healthcare providers participating in the public option to 105% of Medicare rates, addressing concerns about rural provider participation.',
        status: 'proposed',
        date: new Date('2025-01-10'),
      },
      {
        id: 'amd-hr2847-02',
        number: 'H.Amdt. 115',
        sponsor: chang,
        title: 'Telehealth Expansion Provision',
        description:
          'Adds $2 billion in dedicated funding for broadband-enabled telehealth services in underserved communities, with a focus on mental health and chronic disease management.',
        status: 'proposed',
        date: new Date('2025-01-15'),
      },
    ],

    officialTextUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/2847/text',
    congressGovUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/2847',

    discussionCount: 1842,
    followersCount: 12450,
    isControversial: true,
    isHighImpact: true,

    relatedBillIds: ['bill-s-892', 'bill-hr-1876'],
  },

  // ──────────────────────────────────────────────────────────
  // 2. S. 1492 — Climate Infrastructure Investment Act
  // ──────────────────────────────────────────────────────────
  {
    id: 'bill-s-1492',
    number: 'S. 1492',
    title: 'Climate Infrastructure Investment Act',
    shortTitle: 'Climate Infrastructure Act',
    session: '119th Congress',
    chamber: 'senate',

    sponsor: osei,
    cosponsors: [whitfield, thornton, moretti],

    status: 'passed_chamber',
    statusHistory: [
      {
        status: 'introduced',
        date: new Date('2024-09-12'),
        description: 'Introduced by Sen. Osei with bipartisan cosponsors. Referred to the Senate Committee on Environment and Public Works.',
      },
      {
        status: 'committee',
        date: new Date('2024-10-03'),
        description:
          'Committee held four days of hearings with testimony from climate scientists, infrastructure engineers, labor unions, and energy industry representatives. Reported favorably with amendments.',
      },
      {
        status: 'floor',
        date: new Date('2024-12-11'),
        description: 'Placed on the Senate Legislative Calendar. Debate commenced with 30 hours allocated under a unanimous consent agreement.',
      },
      {
        status: 'passed_chamber',
        date: new Date('2025-01-09'),
        description: 'Passed the Senate by a vote of 62-38. Transmitted to the House of Representatives.',
      },
    ],
    introducedDate: new Date('2024-09-12'),
    lastActionDate: new Date('2025-01-09'),
    nextAction: {
      description: 'House Committee on Transportation and Infrastructure hearing',
      date: new Date('2025-02-25'),
    },

    quickSummary:
      'This legislation authorizes $340 billion over eight years for climate-resilient infrastructure projects, including modernizing the electrical grid, expanding renewable energy capacity, and upgrading transportation systems. It includes workforce development provisions to train workers in clean energy industries. The bill passed the Senate with bipartisan support and now awaits House consideration.',

    detailedSummary: {
      coreProvisions: [
        'Authorizes $120 billion for electrical grid modernization, including smart grid technology, energy storage systems, and transmission line upgrades to accommodate renewable energy sources.',
        'Allocates $95 billion for clean transportation infrastructure, including electric vehicle charging networks, public transit electrification, and rail system improvements.',
        'Creates a Clean Energy Workforce Program with $25 billion for job training, apprenticeship programs, and transition assistance for workers in fossil fuel industries.',
        'Establishes a Climate Resilience Fund of $100 billion for flood protection, wildfire mitigation, drought preparedness, and coastal infrastructure hardening.',
      ],
      fundingImplications:
        'Total authorization of $340 billion over 8 years. Funded through a combination of general appropriations, proceeds from federal renewable energy leasing on public lands (estimated $45 billion), a methane emissions fee on large industrial emitters (estimated $30 billion), and reallocation of $20 billion from expiring fossil fuel subsidies.',
      changesToExistingLaw: [
        'Amends the Energy Policy Act of 2005 to update grid modernization standards and add renewable integration requirements.',
        'Modifies the Clean Air Act to establish a methane emissions fee schedule for facilities emitting over 25,000 metric tons of CO2 equivalent annually.',
        'Amends the Workforce Innovation and Opportunity Act to include clean energy occupations in federal job training programs.',
      ],
      timeline:
        'Grid modernization projects would begin within 12 months of enactment with a priority on regions experiencing frequent outages. The workforce program would enroll participants within 6 months. Climate resilience grants would be distributed over a rolling 8-year period based on risk assessments by FEMA and NOAA.',
    },

    impactAnalysis: [
      {
        category: 'Climate',
        icon: 'cloud-sun',
        supportersArgue:
          'Supporters argue this represents a necessary investment in climate resilience, projecting a reduction in U.S. greenhouse gas emissions of 15-20% by 2035 while protecting communities from escalating climate-related disasters that cost an average of $150 billion annually.',
        criticsArgue:
          'Critics argue the emissions reduction projections are optimistic, that renewable energy targets may not be achievable within the stated timeline without technology that is not yet commercially viable at scale, and that the bill does not sufficiently address global emission sources.',
        potentialOutcomes: [
          'U.S. greenhouse gas emissions could decrease by 15-20% from current levels by 2035 if the bill is fully funded and implemented.',
          'Renewable energy capacity on the grid may increase from roughly 22% to 40% over the 8-year period.',
          'Communities in flood-prone and wildfire-prone regions would receive direct resilience investments, though funding may not cover all at-risk areas.',
        ],
      },
      {
        category: 'Economy',
        icon: 'briefcase',
        supportersArgue:
          'Supporters argue the bill would create an estimated 2.5 million jobs in construction, manufacturing, and clean energy, while the workforce transition program provides a pathway for displaced fossil fuel workers.',
        criticsArgue:
          'Critics argue the $340 billion cost could crowd out other priorities, that the methane emissions fee would increase energy costs for industrial users and consumers, and that projected job numbers may not materialize at the expected pace.',
        potentialOutcomes: [
          'An estimated 2.5 million jobs could be created over the 8-year authorization period, concentrated in construction, engineering, and manufacturing sectors.',
          'Energy costs may increase modestly in the short term due to the methane fee before decreasing as renewable capacity comes online.',
          'Fossil fuel-dependent communities would receive transition support, though the pace of economic change may outrun available retraining capacity.',
        ],
      },
      {
        category: 'Infrastructure',
        icon: 'building-2',
        supportersArgue:
          'Supporters argue the grid modernization and resilience investments address decades of deferred maintenance, reduce power outage frequency, and prepare infrastructure for increasing extreme weather events.',
        criticsArgue:
          'Critics argue that federal infrastructure programs historically face cost overruns and delays, that private sector investment could be more efficient, and that the 8-year timeline may be insufficient for the scope of work.',
        potentialOutcomes: [
          'Power grid reliability could improve significantly, particularly in regions prone to extreme weather-related outages.',
          'EV charging infrastructure expansion could accelerate electric vehicle adoption in rural and underserved areas.',
          'Coastal and riverine communities would receive flood mitigation investments, though sea-level rise projections may require additional future appropriations.',
        ],
      },
    ],

    topics: ['Climate', 'Economy', 'Infrastructure'],

    votes: {
      yea: 62,
      nay: 38,
      abstain: 0,
      notVoting: 0,
      total: 100,
      result: 'passed',
      date: new Date('2025-01-09'),
      partyBreakdown: [
        { party: 'D', yea: 48, nay: 1 },
        { party: 'R', yea: 11, nay: 37 },
        { party: 'I', yea: 3, nay: 0 },
      ],
    },

    amendments: [
      {
        id: 'amd-s1492-01',
        number: 'S.Amdt. 2201',
        sponsor: thornton,
        title: 'Natural Gas Transition Bridge Amendment',
        description:
          'Allows natural gas projects to qualify for a limited category of transition infrastructure funding during the first 4 years, providing a bridge fuel pathway while renewable capacity is developed.',
        status: 'adopted',
        date: new Date('2024-12-18'),
      },
      {
        id: 'amd-s1492-02',
        number: 'S.Amdt. 2202',
        sponsor: whitfield,
        title: 'Environmental Justice Priority Amendment',
        description:
          'Requires that at least 40% of Climate Resilience Fund spending be directed to environmental justice communities as defined by the EPA screening tool.',
        status: 'rejected',
        date: new Date('2024-12-19'),
      },
      {
        id: 'amd-s1492-03',
        number: 'S.Amdt. 2210',
        sponsor: moretti,
        title: 'State Flexibility Provision',
        description:
          'Allows states to apply for waivers to redirect up to 15% of their allocated climate resilience funds to locally determined infrastructure priorities, provided the projects meet minimum environmental standards.',
        status: 'proposed',
        date: new Date('2025-01-06'),
      },
    ],

    officialTextUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/1492/text',
    congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/1492',

    discussionCount: 3215,
    followersCount: 18700,
    isControversial: false,
    isHighImpact: true,

    relatedBillIds: ['bill-hr-4201', 'bill-s-3341'],
  },

  // ──────────────────────────────────────────────────────────
  // 3. H.R. 3156 — Digital Privacy Protection Act
  // ──────────────────────────────────────────────────────────
  {
    id: 'bill-hr-3156',
    number: 'H.R. 3156',
    title: 'Digital Privacy Protection Act',
    shortTitle: 'Digital Privacy Act',
    session: '119th Congress',
    chamber: 'house',

    sponsor: chang,
    cosponsors: [keller, nakamura],

    status: 'introduced',
    statusHistory: [
      {
        status: 'introduced',
        date: new Date('2025-01-06'),
        description:
          'Introduced by Rep. Chang. Referred to the House Committee on Energy and Commerce and the House Judiciary Committee.',
      },
    ],
    introducedDate: new Date('2025-01-06'),
    lastActionDate: new Date('2025-01-06'),
    nextAction: {
      description: 'Joint committee hearing on digital privacy standards',
      date: new Date('2025-03-05'),
    },

    quickSummary:
      'This bill would establish a comprehensive federal data privacy framework, giving consumers the right to access, correct, and delete their personal data held by companies. It creates data minimization requirements, mandates opt-in consent for sensitive data collection, and establishes a new bureau within the FTC dedicated to data privacy enforcement. The bill would preempt the current patchwork of state privacy laws with a uniform federal standard.',

    detailedSummary: {
      coreProvisions: [
        'Establishes consumer rights to access, correct, delete, and port personal data, with companies required to respond to requests within 30 days.',
        'Mandates data minimization — companies may collect only data reasonably necessary for the stated purpose of their service and must disclose data practices in plain language.',
        'Requires affirmative opt-in consent before collecting sensitive personal data, including biometric data, precise geolocation, health information, and financial records.',
        'Creates the Bureau of Data Privacy Protection within the FTC, authorized to enforce violations with fines up to 4% of annual global revenue.',
      ],
      fundingImplications:
        'Estimated cost of $900 million over 10 years for FTC enforcement expansion and Bureau establishment. Funded through civil penalty collections (estimated to generate $1.2 billion over the same period) and existing FTC appropriations. No new taxes or fees on consumers.',
      changesToExistingLaw: [
        'Preempts state data privacy laws (including CCPA, CPRA, and similar statutes in 15 other states) with a federal standard, while preserving state authority over data breach notification.',
        'Amends the FTC Act to expand the Commission\'s enforcement authority over data privacy and to authorize the new Bureau of Data Privacy Protection.',
        'Modifies the Children\'s Online Privacy Protection Act (COPPA) to extend protections to minors under 17, up from the current threshold of 13.',
      ],
      timeline:
        'If enacted, the consumer rights provisions would take effect 18 months after the date of enactment for companies with annual revenue over $250 million, and 30 months for smaller companies. The FTC Bureau would be established within 12 months. COPPA amendments would take effect immediately upon enactment.',
    },

    impactAnalysis: [
      {
        category: 'Civil Rights',
        icon: 'shield-check',
        supportersArgue:
          'Supporters argue the bill establishes fundamental digital rights for all Americans, replacing a confusing patchwork of state laws with clear, enforceable protections that give individuals meaningful control over their personal information.',
        criticsArgue:
          'Critics argue federal preemption could weaken protections in states like California that have enacted stronger privacy laws, and that the opt-in consent model, while protective, may degrade user experience and slow adoption of beneficial services.',
        potentialOutcomes: [
          'Over 300 million Americans would gain uniform data privacy rights regardless of their state of residence.',
          'States with stronger existing protections (notably California) may experience a reduction in certain privacy provisions upon federal preemption.',
          'Enforcement of the 4% revenue penalty could deter data misuse by major technology companies.',
        ],
      },
      {
        category: 'Technology',
        icon: 'laptop',
        supportersArgue:
          'Supporters argue a single federal standard reduces compliance costs for businesses operating across multiple states and provides regulatory certainty that encourages innovation within clear boundaries.',
        criticsArgue:
          'Critics argue data minimization requirements and opt-in consent could hamper ad-supported business models that provide free services to consumers, potentially forcing companies to adopt subscription-based models.',
        potentialOutcomes: [
          'Technology companies would face compliance costs estimated at $10-15 billion industry-wide in the first two years, though ongoing costs would decrease as systems are established.',
          'Targeted advertising revenue could decrease by 15-25% industry-wide due to opt-in consent requirements.',
          'A federal standard could simplify operations for companies currently navigating up to 16 different state privacy regimes.',
        ],
      },
      {
        category: 'Economy',
        icon: 'bar-chart-3',
        supportersArgue:
          'Supporters argue uniform privacy rules create a more predictable business environment, reduce legal exposure, and could strengthen consumer trust in digital commerce, increasing online spending over time.',
        criticsArgue:
          'Critics argue that restricting data collection may slow innovation in personalization, AI development, and digital marketing, sectors that contribute significantly to GDP growth.',
        potentialOutcomes: [
          'Digital advertising market practices would shift substantially toward contextual and first-party data models.',
          'Consumer trust in online services could increase, potentially boosting e-commerce participation by populations currently reluctant to share data.',
          'Small businesses reliant on targeted advertising may face higher customer acquisition costs during the transition period.',
        ],
      },
    ],

    topics: ['Technology', 'Civil Rights'],

    amendments: [
      {
        id: 'amd-hr3156-01',
        number: 'H.Amdt. 87',
        sponsor: nakamura,
        title: 'Algorithmic Transparency Provision',
        description:
          'Requires companies using automated decision-making systems that materially affect consumers to disclose the general logic, significance, and potential consequences of such processing.',
        status: 'proposed',
        date: new Date('2025-01-20'),
      },
    ],

    officialTextUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/3156/text',
    congressGovUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/3156',

    discussionCount: 967,
    followersCount: 8340,
    isControversial: false,
    isHighImpact: true,

    relatedBillIds: ['bill-s-3341'],
  },

  // ──────────────────────────────────────────────────────────
  // 4. S. 892 — Comprehensive Immigration Reform Act
  // ──────────────────────────────────────────────────────────
  {
    id: 'bill-s-892',
    number: 'S. 892',
    title: 'Comprehensive Immigration Reform Act',
    shortTitle: 'Immigration Reform Act',
    session: '119th Congress',
    chamber: 'senate',

    sponsor: thornton,
    cosponsors: [osei, moretti],

    status: 'committee',
    statusHistory: [
      {
        status: 'introduced',
        date: new Date('2024-11-05'),
        description:
          'Introduced by Sen. Thornton. Referred to the Senate Committee on the Judiciary.',
      },
      {
        status: 'committee',
        date: new Date('2024-12-02'),
        description:
          'Committee hearings commenced with testimony from DHS officials, immigration judges, border patrol representatives, employer groups, and immigrant advocacy organizations. Multiple hearings scheduled through February.',
      },
    ],
    introducedDate: new Date('2024-11-05'),
    lastActionDate: new Date('2025-01-28'),
    nextAction: {
      description: 'Judiciary Committee markup',
      date: new Date('2025-03-12'),
    },

    quickSummary:
      'This bill proposes a multi-part immigration reform framework that combines border security investments with changes to legal immigration pathways and provisions for certain undocumented immigrants. It increases funding for border technology and personnel, creates a new merit-based visa category, reforms the asylum processing system, and establishes a conditional legal status pathway for long-term undocumented residents who meet specific criteria.',

    detailedSummary: {
      coreProvisions: [
        'Authorizes $28 billion over 5 years for border security, including surveillance technology, ports of entry modernization, additional Border Patrol agents, and immigration judge positions to reduce court backlogs.',
        'Creates a new merit-based visa category allocating 120,000 annual visas weighted by skills, education, employment offers, and English proficiency, while maintaining existing family-based and diversity visa programs.',
        'Reforms the asylum system by establishing regional processing centers, imposing a 180-day adjudication deadline, and adding 600 new asylum officer positions.',
        'Establishes a conditional legal status pathway for undocumented immigrants who have been continuously present for 10+ years, pass background checks, pay back taxes and a fine, and demonstrate English proficiency.',
      ],
      fundingImplications:
        'Estimated cost of $85 billion over 10 years. Offset by $40 billion in projected new tax revenue from legalized workers, $12 billion in application fees and fines, and $8 billion in savings from reduced immigration court backlogs. Net estimated cost of $25 billion over the scoring window.',
      changesToExistingLaw: [
        'Amends the Immigration and Nationality Act to add the new merit-based visa category and modify asylum procedures.',
        'Revises the Secure Fence Act of 2006 to redirect remaining wall construction funding toward technology-based border security.',
        'Modifies the Immigration Reform and Control Act of 1986 to update employer verification requirements with a mandatory E-Verify system for all employers with more than 15 employees.',
      ],
      timeline:
        'Border security provisions would take effect immediately upon enactment. The merit-based visa program would begin in the first fiscal year following passage. Asylum reforms would be phased in over 24 months. The legalization pathway application period would open 18 months after enactment and remain open for 3 years.',
    },

    impactAnalysis: [
      {
        category: 'Immigration',
        icon: 'globe',
        supportersArgue:
          'Supporters argue the bill takes a balanced approach, combining security measures with humane pathways that acknowledge the reality of 11 million undocumented residents while creating an efficient legal immigration system aligned with economic needs.',
        criticsArgue:
          'Critics on one side argue the legalization pathway amounts to amnesty that rewards illegal entry, while critics on the other side argue the bill\'s enforcement measures are overly punitive and the 10-year residency requirement is too restrictive.',
        potentialOutcomes: [
          'An estimated 6-8 million undocumented immigrants could become eligible for the conditional legal status pathway based on current demographic data.',
          'Border security technology and staffing increases could reduce illegal crossings, though effectiveness depends on implementation and regional factors.',
          'The merit-based visa system would alter the composition of legal immigration, increasing skills-based admissions while maintaining family-based pathways.',
        ],
      },
      {
        category: 'Economy',
        icon: 'dollar-sign',
        supportersArgue:
          'Supporters argue that bringing undocumented workers into the formal economy would increase tax revenue by an estimated $40 billion over 10 years, reduce labor market exploitation, and fill critical workforce shortages in agriculture, construction, and healthcare.',
        criticsArgue:
          'Critics argue legalized workers could increase competition for jobs in low-wage sectors, potentially suppressing wages for existing low-income workers, and that the fiscal costs of expanded government services would exceed projected tax revenue gains.',
        potentialOutcomes: [
          'Federal tax revenue could increase by an estimated $40 billion over 10 years from newly legalized workers entering the formal economy.',
          'Labor markets in agriculture, construction, and food processing could stabilize, though wage effects in these sectors are debated among economists.',
          'Social service costs in high-immigration states could increase, though federal reimbursement provisions partially offset state and local impacts.',
        ],
      },
      {
        category: 'National Security',
        icon: 'shield',
        supportersArgue:
          'Supporters argue the $28 billion in border security investment, combined with reduced asylum backlogs and mandatory E-Verify, would improve the government\'s ability to identify and prevent genuine security threats at the border.',
        criticsArgue:
          'Critics argue that technology-based border solutions alone are insufficient, that the bill does not adequately address visa overstays (which account for roughly 40% of undocumented immigration), and that the legalization pathway could be exploited by individuals who pose security risks.',
        potentialOutcomes: [
          'Immigration court backlogs, currently exceeding 3 million pending cases, could be significantly reduced through additional judge positions and asylum reform.',
          'Mandatory E-Verify for employers could reduce unauthorized employment, though implementation challenges and costs for small businesses are expected.',
          'Visa overstay tracking and enforcement would be enhanced through improved biometric exit systems at ports of entry.',
        ],
      },
    ],

    topics: ['Immigration', 'Economy'],

    amendments: [
      {
        id: 'amd-s892-01',
        number: 'S.Amdt. 1540',
        sponsor: moretti,
        title: 'Agricultural Worker Visa Amendment',
        description:
          'Creates a separate agricultural worker visa program with 250,000 annual visas, streamlined application processes, and a 3-year pathway to permanent residency for agricultural workers meeting employment requirements.',
        status: 'proposed',
        date: new Date('2025-01-14'),
      },
      {
        id: 'amd-s892-02',
        number: 'S.Amdt. 1541',
        sponsor: osei,
        title: 'DREAM Act Integration Amendment',
        description:
          'Creates an expedited pathway to permanent residency for individuals brought to the U.S. as minors (under 16) who have graduated from U.S. educational institutions or served in the military, reducing the standard waiting period from 10 years to 5.',
        status: 'proposed',
        date: new Date('2025-01-20'),
      },
    ],

    officialTextUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/892/text',
    congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/892',

    discussionCount: 5630,
    followersCount: 22100,
    isControversial: true,
    isHighImpact: true,

    relatedBillIds: ['bill-hr-2847', 'bill-s-2103'],
  },

  // ──────────────────────────────────────────────────────────
  // 5. H.R. 4201 — Small Business Tax Relief Act
  // ──────────────────────────────────────────────────────────
  {
    id: 'bill-hr-4201',
    number: 'H.R. 4201',
    title: 'Small Business Tax Relief Act',
    shortTitle: 'Small Business Tax Relief',
    session: '119th Congress',
    chamber: 'house',

    sponsor: keller,
    cosponsors: [santos, nakamura, chang],

    status: 'signed',
    statusHistory: [
      {
        status: 'introduced',
        date: new Date('2024-08-20'),
        description:
          'Introduced by Rep. Keller with strong bipartisan support. Referred to the House Committee on Ways and Means.',
      },
      {
        status: 'committee',
        date: new Date('2024-09-10'),
        description:
          'Committee reported the bill favorably with a unanimous vote after brief hearings. No amendments offered in committee.',
      },
      {
        status: 'floor',
        date: new Date('2024-10-08'),
        description: 'Placed on the House calendar under suspension of the rules.',
      },
      {
        status: 'passed_chamber',
        date: new Date('2024-10-15'),
        description: 'Passed the House by a vote of 398-34. Transmitted to the Senate.',
      },
      {
        status: 'floor',
        date: new Date('2024-11-20'),
        description: 'Senate proceeded to consideration. Limited debate under unanimous consent.',
      },
      {
        status: 'passed_both',
        date: new Date('2024-12-05'),
        description: 'Passed the Senate by a vote of 88-12 without amendment. Enrolled and presented to the President.',
      },
      {
        status: 'signed',
        date: new Date('2024-12-18'),
        description: 'Signed into law by the President. Became Public Law No. 119-42.',
      },
    ],
    introducedDate: new Date('2024-08-20'),
    lastActionDate: new Date('2024-12-18'),

    quickSummary:
      'This law increases the Section 179 small business expensing limit from $1.16 million to $2.5 million and doubles the phase-out threshold. It also creates a new tax credit of up to $5,000 annually for small businesses providing employee health insurance for the first time and simplifies quarterly estimated tax filing for businesses with annual revenue under $1 million.',

    detailedSummary: {
      coreProvisions: [
        'Increases the Section 179 expensing limit from $1.16 million to $2.5 million and raises the phase-out threshold from $2.89 million to $5 million, allowing more small businesses to immediately deduct equipment purchases.',
        'Creates the Small Business Health Coverage Tax Credit providing up to $5,000 per year for up to 3 years for small businesses (under 50 employees) that offer employer-sponsored health insurance for the first time.',
        'Simplifies estimated tax payment schedules for businesses with annual gross receipts under $1 million, reducing filing from quarterly to semi-annually with a safe harbor provision.',
        'Establishes a Small Business Startup Deduction allowing new businesses to deduct up to $25,000 in startup costs in their first year, up from the current $5,000.',
      ],
      fundingImplications:
        'Estimated cost of $48 billion over 10 years. The Joint Committee on Taxation projects that increased small business activity and formation will generate $18 billion in additional tax revenue from higher employment and economic growth, for a net cost of approximately $30 billion over the scoring window.',
      changesToExistingLaw: [
        'Amends Internal Revenue Code Section 179 to increase expensing limits and phase-out thresholds.',
        'Adds a new Section 45U to the Internal Revenue Code establishing the Small Business Health Coverage Tax Credit.',
        'Modifies IRC Section 6654 to create simplified estimated tax procedures for qualifying small businesses.',
      ],
      timeline:
        'Section 179 changes are effective for tax years beginning after December 31, 2024. The health coverage credit is available for tax years 2025 through 2027. Simplified filing provisions take effect for the first quarter of 2025.',
    },

    impactAnalysis: [
      {
        category: 'Economy',
        icon: 'store',
        supportersArgue:
          'Supporters argue the expanded deductions and credits directly benefit the 33 million small businesses that employ nearly half of the private workforce, encouraging capital investment, hiring, and new business formation.',
        criticsArgue:
          'Critics argue the $48 billion cost adds to the deficit, that the benefits disproportionately favor higher-income small business owners who can afford large equipment purchases, and that targeted credits are less efficient than broader tax reform.',
        potentialOutcomes: [
          'Small business capital expenditures could increase by 8-12% as more businesses take advantage of the higher Section 179 limits.',
          'New business formation rates may increase modestly due to the enhanced startup deduction.',
          'An estimated 400,000 small business employees could gain employer-sponsored health insurance through the new tax credit.',
        ],
      },
      {
        category: 'Healthcare',
        icon: 'heart',
        supportersArgue:
          'Supporters argue the health coverage credit addresses a persistent gap where small business employees are the least likely to have employer-sponsored insurance, and providing a 3-year incentive helps businesses establish coverage as an ongoing benefit.',
        criticsArgue:
          'Critics argue a 3-year credit is too short to create lasting changes in employer behavior, that many small businesses will still find insurance unaffordable even with the credit, and that the money would be better directed toward expanding public coverage options.',
        potentialOutcomes: [
          'Small businesses offering health insurance for the first time could increase by 12-15% during the credit period.',
          'Employee retention at small businesses may improve in sectors where benefits are a key competitive disadvantage.',
          'Some businesses may discontinue coverage after the 3-year credit period expires, limiting long-term impact.',
        ],
      },
      {
        category: 'Taxpayers',
        icon: 'calculator',
        supportersArgue:
          'Supporters argue the simplified filing provisions reduce compliance burdens for the smallest businesses, saving an estimated 120 million hours of paperwork annually and reducing errors that lead to penalties and audits.',
        criticsArgue:
          'Critics argue semi-annual estimated tax payments could lead to cash flow management issues for businesses that do not set aside funds, and that the safe harbor provision may reduce revenue collections in the short term.',
        potentialOutcomes: [
          'Tax compliance costs for qualifying small businesses could decrease by $2,000-$4,000 annually.',
          'IRS processing workload for estimated tax payments would decrease, though the impact on IRS staffing needs is modest.',
          'The safe harbor provision may result in slightly lower timely collections, balanced by reduced penalty and audit costs.',
        ],
      },
    ],

    topics: ['Economy', 'Healthcare'],

    votes: {
      yea: 398,
      nay: 34,
      abstain: 0,
      notVoting: 3,
      total: 435,
      result: 'passed',
      date: new Date('2024-10-15'),
      partyBreakdown: [
        { party: 'D', yea: 198, nay: 14 },
        { party: 'R', yea: 200, nay: 20 },
        { party: 'I', yea: 0, nay: 0 },
      ],
    },

    amendments: [],

    officialTextUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/4201/text',
    congressGovUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/4201',

    discussionCount: 1105,
    followersCount: 9870,
    isControversial: false,
    isHighImpact: false,

    relatedBillIds: ['bill-s-1492', 'bill-hr-2847'],
  },

  // ──────────────────────────────────────────────────────────
  // 6. S. 2103 — Election Security and Transparency Act
  // ──────────────────────────────────────────────────────────
  {
    id: 'bill-s-2103',
    number: 'S. 2103',
    title: 'Election Security and Transparency Act',
    shortTitle: 'Election Security Act',
    session: '119th Congress',
    chamber: 'senate',

    sponsor: whitfield,
    cosponsors: [osei, thornton],

    status: 'floor',
    statusHistory: [
      {
        status: 'introduced',
        date: new Date('2024-10-01'),
        description:
          'Introduced by Sen. Whitfield with bipartisan cosponsors. Referred to the Senate Committee on Rules and Administration.',
      },
      {
        status: 'committee',
        date: new Date('2024-11-12'),
        description:
          'Committee held hearings with testimony from state election officials, cybersecurity experts, campaign finance attorneys, and representatives from election technology vendors. Reported with amendments on a 10-8 party-line vote.',
      },
      {
        status: 'floor',
        date: new Date('2025-01-15'),
        description:
          'Cloture motion filed. Debate ongoing with significant floor amendments expected. 30 hours of debate time allocated.',
      },
    ],
    introducedDate: new Date('2024-10-01'),
    lastActionDate: new Date('2025-02-03'),
    nextAction: {
      description: 'Cloture vote',
      date: new Date('2025-02-20'),
    },

    quickSummary:
      'This bill addresses election security and campaign finance transparency through a three-part framework. It mandates paper ballot backups and post-election audits for all federal elections, establishes cybersecurity standards for election infrastructure, and requires disclosure of donors contributing over $10,000 to organizations engaged in election-related spending. The bill also creates a federal grant program for states to upgrade voting systems.',

    detailedSummary: {
      coreProvisions: [
        'Mandates voter-verified paper audit trails for all voting systems used in federal elections and requires risk-limiting post-election audits in every state within 30 days of certification.',
        'Establishes binding cybersecurity standards for election infrastructure developed by CISA in consultation with NIST, including mandatory penetration testing, network monitoring, and incident response plans.',
        'Requires organizations spending over $50,000 on election-related communications to disclose all donors contributing $10,000 or more, including through intermediary organizations, closing the "dark money" disclosure gap.',
        'Creates a $3 billion Election Security Grant Program over 5 years for states to replace outdated voting equipment, hire cybersecurity personnel, and implement the required audit procedures.',
      ],
      fundingImplications:
        'Estimated cost of $4.5 billion over 10 years, primarily for the state grant program ($3 billion), CISA staffing and standards development ($800 million), and FEC enforcement expansion ($700 million). Funded through general appropriations with a mandatory spending designation.',
      changesToExistingLaw: [
        'Amends the Help America Vote Act of 2002 to require paper audit trails and risk-limiting audits as conditions of federal election funding.',
        'Modifies the Federal Election Campaign Act to expand disclosure requirements to include organizations making independent expenditures or electioneering communications, regardless of their tax-exempt status.',
        'Amends the Homeland Security Act of 2002 to formally designate election infrastructure as critical infrastructure with mandatory (rather than voluntary) security standards.',
      ],
      timeline:
        'Paper audit trail requirements would take effect for the first federal election occurring at least 24 months after enactment. Cybersecurity standards would be promulgated within 18 months. Disclosure requirements would take effect 90 days after enactment. Grants would be distributed beginning in the first fiscal year following passage.',
    },

    impactAnalysis: [
      {
        category: 'Elections',
        icon: 'vote',
        supportersArgue:
          'Supporters argue the bill strengthens public confidence in elections by ensuring every vote has a verifiable paper trail, that mandatory audits provide transparent verification of results, and that the grant program helps under-resourced states modernize aging election infrastructure.',
        criticsArgue:
          'Critics argue the bill imposes unfunded federal mandates on state election administration, violating the traditional state role in managing elections, and that the 24-month implementation timeline is insufficient for many jurisdictions to procure and deploy new equipment.',
        potentialOutcomes: [
          'All federal elections would have verifiable paper audit trails, providing a mechanism to confirm electronic vote counts.',
          'States currently using paperless voting systems (affecting approximately 16 million voters) would need to transition to paper-verified systems.',
          'Election cybersecurity practices would become standardized, reducing vulnerability to foreign interference and technical failures.',
        ],
      },
      {
        category: 'Civil Rights',
        icon: 'scale',
        supportersArgue:
          'Supporters argue donor transparency strengthens democratic accountability, allowing voters to know who funds political messaging, and that the bill protects voting rights by ensuring secure, auditable elections for all citizens.',
        criticsArgue:
          'Critics argue mandatory donor disclosure for organizations engaged in issue advocacy could chill First Amendment-protected speech, that individuals may face harassment for their political contributions, and that the bill does not adequately distinguish between election-related and issue-related spending.',
        potentialOutcomes: [
          'Dark money spending in federal elections, estimated at over $1 billion in recent cycles, would become subject to public disclosure.',
          'Some organizations may restructure their spending to avoid disclosure thresholds, potentially creating new avenues for undisclosed spending.',
          'Voter confidence in election integrity could increase if paper audits consistently confirm electronic results.',
        ],
      },
      {
        category: 'Technology',
        icon: 'monitor',
        supportersArgue:
          'Supporters argue mandatory cybersecurity standards bring election infrastructure in line with protections required for other critical infrastructure sectors, and that federal investment in election technology modernization is overdue.',
        criticsArgue:
          'Critics argue that mandatory federal cybersecurity standards may not account for the diverse technology environments across 50 states and thousands of local jurisdictions, and that compliance costs could strain local budgets even with federal grants.',
        potentialOutcomes: [
          'Election infrastructure cybersecurity would be standardized across all states, reducing the most vulnerable points of entry.',
          'Election technology vendors would need to meet new federal security certification requirements, potentially increasing costs and reducing the number of qualified vendors.',
          'CISA\'s role in election security would expand from advisory to regulatory, representing a significant shift in federal authority.',
        ],
      },
    ],

    topics: ['Elections', 'Civil Rights', 'Technology'],

    amendments: [
      {
        id: 'amd-s2103-01',
        number: 'S.Amdt. 1890',
        sponsor: thornton,
        title: 'State Implementation Flexibility Amendment',
        description:
          'Extends the paper audit trail implementation deadline from 24 months to 36 months and allows states to apply for additional extensions of up to 12 months upon demonstrating good-faith procurement efforts.',
        status: 'proposed',
        date: new Date('2025-01-25'),
      },
    ],

    officialTextUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/2103/text',
    congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/2103',

    discussionCount: 2890,
    followersCount: 14200,
    isControversial: true,
    isHighImpact: false,

    relatedBillIds: ['bill-s-892', 'bill-hr-3156'],
  },

  // ──────────────────────────────────────────────────────────
  // 7. H.R. 1876 — Veterans Mental Health Access Act
  // ──────────────────────────────────────────────────────────
  {
    id: 'bill-hr-1876',
    number: 'H.R. 1876',
    title: 'Veterans Mental Health Access Act',
    shortTitle: 'Vets Mental Health Act',
    session: '119th Congress',
    chamber: 'house',

    sponsor: nakamura,
    cosponsors: [santos, keller, moretti, chang],

    status: 'passed_chamber',
    statusHistory: [
      {
        status: 'introduced',
        date: new Date('2024-09-05'),
        description:
          'Introduced by Rep. Nakamura with broad bipartisan support. Referred to the House Committee on Veterans\' Affairs.',
      },
      {
        status: 'committee',
        date: new Date('2024-09-25'),
        description:
          'Committee held hearings with testimony from VA officials, veterans service organizations, mental health professionals, and veterans. Reported favorably by unanimous vote.',
      },
      {
        status: 'floor',
        date: new Date('2024-11-04'),
        description: 'Considered under suspension of the rules in the House.',
      },
      {
        status: 'passed_chamber',
        date: new Date('2024-11-06'),
        description:
          'Passed the House by a vote of 390-42. Transmitted to the Senate and referred to the Senate Committee on Veterans\' Affairs.',
      },
    ],
    introducedDate: new Date('2024-09-05'),
    lastActionDate: new Date('2025-01-30'),
    nextAction: {
      description: 'Senate Veterans\' Affairs Committee hearing',
      date: new Date('2025-02-27'),
    },

    quickSummary:
      'This bill expands mental health services for veterans by increasing VA mental health staffing, extending eligibility for VA mental health care to veterans with other-than-honorable discharges, and creating a grant program for community-based veteran mental health services. It also establishes a peer support specialist program and mandates same-day mental health screening at all VA facilities for veterans in crisis.',

    detailedSummary: {
      coreProvisions: [
        'Requires the VA to hire at least 2,000 additional mental health professionals (psychiatrists, psychologists, social workers, and counselors) over 3 years and establishes recruitment incentives including student loan repayment of up to $100,000.',
        'Extends VA mental health care eligibility to veterans with other-than-honorable discharges for a period of 5 years following separation, removing a barrier that currently prevents an estimated 500,000 veterans from accessing VA mental health services.',
        'Creates a $500 million Community Veteran Mental Health Grant Program for nonprofit organizations and state agencies to provide mental health services in areas underserved by VA facilities.',
        'Establishes a national Veteran Peer Support Specialist Program, training and hiring 5,000 veteran peer counselors to provide support in VA facilities, community organizations, and through a 24/7 crisis text line.',
      ],
      fundingImplications:
        'Estimated cost of $8.2 billion over 5 years. Funded through existing VA appropriations plus $3.5 billion in new mandatory spending. CBO projects potential savings of $1.2 billion over 10 years from reduced emergency department visits, hospitalizations, and disability claims through early mental health intervention.',
      changesToExistingLaw: [
        'Amends Title 38, United States Code, to expand mental health care eligibility for veterans with other-than-honorable discharges.',
        'Modifies the VA MISSION Act to include mental health peer support services in the community care network.',
        'Amends the Veterans Health Care Eligibility Reform Act to mandate same-day mental health crisis screening at all VA medical centers and community-based outpatient clinics.',
      ],
      timeline:
        'Same-day crisis screening would be implemented within 6 months of enactment. Staffing increases would occur over a 3-year hiring period. The peer support program would begin enrollment within 12 months. Community grants would be distributed in the first fiscal year after passage.',
    },

    impactAnalysis: [
      {
        category: 'Healthcare',
        icon: 'brain',
        supportersArgue:
          'Supporters argue the bill addresses a mental health crisis among veterans — with an average of 17 veterans dying by suicide per day — by removing barriers to care, expanding capacity, and meeting veterans where they are through peer support and community-based services.',
        criticsArgue:
          'Critics argue the VA already struggles to deliver timely care with current staffing, that hiring 2,000 providers may not be achievable given national mental health workforce shortages, and that expanding eligibility could overwhelm an already strained system.',
        potentialOutcomes: [
          'An estimated 500,000 additional veterans with other-than-honorable discharges would become eligible for VA mental health services.',
          'Wait times for mental health appointments at VA facilities could decrease if hiring targets are met, though workforce shortages may slow recruitment.',
          'Peer support services could reach veterans who are reluctant to engage with traditional clinical settings, an underserved population in veteran care.',
        ],
      },
      {
        category: 'Defense',
        icon: 'shield-alert',
        supportersArgue:
          'Supporters argue that investing in veteran mental health fulfills the nation\'s obligation to those who served, improves long-term outcomes for service members transitioning to civilian life, and can positively affect military recruitment by demonstrating commitment to post-service care.',
        criticsArgue:
          'Critics argue that extending benefits to other-than-honorable discharges could undermine military discipline, that the distinction in discharge status exists for valid reasons, and that resources should be focused on veterans who completed honorable service.',
        potentialOutcomes: [
          'Military recruitment and retention could benefit from improved perceptions of post-service mental health support.',
          'The expansion to other-than-honorable discharges would require the VA to develop new eligibility verification and intake procedures.',
          'Community-based services could improve mental health outcomes in rural areas where VA facilities are distant or unavailable.',
        ],
      },
      {
        category: 'Economy',
        icon: 'wallet',
        supportersArgue:
          'Supporters argue that early mental health intervention reduces long-term costs associated with veteran homelessness, incarceration, emergency care, and disability benefits, with CBO projecting $1.2 billion in savings over 10 years.',
        criticsArgue:
          'Critics argue the $8.2 billion cost is substantial, that projected savings are speculative, and that the community grant program lacks sufficient oversight mechanisms to ensure funds are used effectively.',
        potentialOutcomes: [
          'Veteran homelessness, which affects approximately 33,000 veterans nightly, could decrease through improved mental health support and community services.',
          'Emergency department utilization by veterans in mental health crisis could decrease, reducing costs for both the VA and community hospitals.',
          'The peer support specialist program could create a new career pathway for veterans, providing employment along with therapeutic value.',
        ],
      },
    ],

    topics: ['Healthcare', 'Defense'],

    votes: {
      yea: 390,
      nay: 42,
      abstain: 0,
      notVoting: 3,
      total: 435,
      result: 'passed',
      date: new Date('2024-11-06'),
      partyBreakdown: [
        { party: 'D', yea: 210, nay: 2 },
        { party: 'R', yea: 180, nay: 40 },
        { party: 'I', yea: 0, nay: 0 },
      ],
    },

    amendments: [],

    officialTextUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/1876/text',
    congressGovUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/1876',

    discussionCount: 1450,
    followersCount: 11350,
    isControversial: false,
    isHighImpact: true,

    relatedBillIds: ['bill-hr-2847', 'bill-hr-4201'],
  },

  // ──────────────────────────────────────────────────────────
  // 8. S. 3341 — AI Regulation Framework Act
  // ──────────────────────────────────────────────────────────
  {
    id: 'bill-s-3341',
    number: 'S. 3341',
    title: 'AI Regulation Framework Act',
    shortTitle: 'AI Regulation Act',
    session: '119th Congress',
    chamber: 'senate',

    sponsor: moretti,
    cosponsors: [whitfield, osei],

    status: 'introduced',
    statusHistory: [
      {
        status: 'introduced',
        date: new Date('2025-01-14'),
        description:
          'Introduced by Sen. Moretti. Referred jointly to the Senate Committee on Commerce, Science, and Transportation and the Senate Judiciary Committee.',
      },
    ],
    introducedDate: new Date('2025-01-14'),
    lastActionDate: new Date('2025-01-14'),
    nextAction: {
      description: 'Joint committee hearing on AI governance frameworks',
      date: new Date('2025-03-20'),
    },

    quickSummary:
      'This bill proposes a risk-based regulatory framework for artificial intelligence systems deployed in the United States. It categorizes AI applications into risk tiers with corresponding requirements, creates an Office of AI Policy within the Department of Commerce, mandates transparency and impact assessments for high-risk AI systems, and establishes liability rules for AI-caused harms. The bill includes provisions for protecting innovation while addressing safety concerns.',

    detailedSummary: {
      coreProvisions: [
        'Establishes a four-tier risk classification system (minimal, limited, high, unacceptable) for AI applications, with regulatory requirements proportional to risk level. Unacceptable-risk uses — including real-time mass biometric surveillance and social scoring systems — would be prohibited.',
        'Creates the Office of AI Policy within the Department of Commerce, staffed with technical experts and tasked with developing standards, reviewing high-risk AI deployments, and coordinating federal AI governance across agencies.',
        'Mandates algorithmic impact assessments for high-risk AI systems used in employment decisions, credit determinations, healthcare diagnostics, criminal justice, and critical infrastructure. Assessments must be updated annually and made publicly available.',
        'Establishes a liability framework holding developers and deployers of high-risk AI systems jointly responsible for foreseeable harms, with a safe harbor for systems that have completed and passed required impact assessments.',
      ],
      fundingImplications:
        'Estimated cost of $1.8 billion over 10 years for the Office of AI Policy ($1.2 billion), NIST AI standards development ($400 million), and agency coordination and enforcement ($200 million). Partially offset by registration fees for high-risk AI systems and civil penalties for non-compliance.',
      changesToExistingLaw: [
        'Amends the National Institute of Standards and Technology Act to direct NIST to develop binding (rather than voluntary) technical standards for high-risk AI systems.',
        'Modifies the Federal Trade Commission Act to designate deceptive AI practices — including undisclosed synthetic media and AI-generated impersonation — as unfair or deceptive acts.',
        'Amends Title VII of the Civil Rights Act and the Equal Credit Opportunity Act to explicitly include algorithmic discrimination in the definition of prohibited practices.',
      ],
      timeline:
        'The Office of AI Policy would be established within 12 months of enactment. Risk classification rules would be promulgated within 18 months. High-risk AI systems in deployment at the time of enactment would have 24 months to complete required impact assessments. The liability framework would take effect 30 months after enactment.',
    },

    impactAnalysis: [
      {
        category: 'Technology',
        icon: 'cpu',
        supportersArgue:
          'Supporters argue a clear regulatory framework provides the certainty the AI industry needs to invest and grow responsibly, that the risk-based approach avoids over-regulating low-risk applications, and that U.S. leadership in AI governance could set global standards.',
        criticsArgue:
          'Critics argue prescriptive regulation could slow AI innovation and development at a time when the U.S. is in competition with countries investing heavily in AI, that the technology is evolving faster than regulations can keep pace, and that the liability framework could deter startups and smaller developers.',
        potentialOutcomes: [
          'AI companies would face new compliance requirements for high-risk applications, with costs varying significantly by company size and application type.',
          'The U.S. could establish international AI governance norms, or alternatively, could push AI development to jurisdictions with fewer restrictions.',
          'A clear regulatory framework could increase enterprise AI adoption by reducing legal uncertainty around deployment of AI tools.',
        ],
      },
      {
        category: 'Civil Rights',
        icon: 'fingerprint',
        supportersArgue:
          'Supporters argue mandatory impact assessments and the prohibition on social scoring and mass surveillance protect civil liberties, that algorithmic discrimination provisions address documented bias in hiring, lending, and criminal justice AI tools, and that transparency requirements empower affected individuals.',
        criticsArgue:
          'Critics argue the definition of algorithmic discrimination is vague and could lead to excessive litigation, that impact assessments may not effectively detect subtle bias in complex AI systems, and that prohibiting certain AI uses could impede legitimate law enforcement and security applications.',
        potentialOutcomes: [
          'AI-assisted hiring tools, credit scoring systems, and criminal risk assessments would be subject to mandatory bias auditing and public transparency requirements.',
          'Real-time biometric surveillance would be prohibited for mass population monitoring, though targeted law enforcement uses under judicial authorization may be permitted.',
          'Individuals affected by high-risk AI decisions would gain the right to explanation and to contest automated determinations.',
        ],
      },
      {
        category: 'Economy',
        icon: 'line-chart',
        supportersArgue:
          'Supporters argue regulatory clarity accelerates responsible AI adoption across industries, that the safe harbor provision rewards companies that invest in safety, and that trust in AI systems is a prerequisite for the large-scale economic benefits AI promises.',
        criticsArgue:
          'Critics argue the compliance costs — including impact assessments, registration fees, and legal exposure — would disproportionately burden small and mid-size AI companies, consolidating market power among large incumbents that can more easily absorb regulatory costs.',
        potentialOutcomes: [
          'Compliance costs for high-risk AI systems could range from $50,000 to $500,000 per system for initial impact assessments, depending on complexity.',
          'The AI governance industry (auditing, compliance, consulting) could emerge as a significant economic sector.',
          'Venture capital investment in AI may shift toward applications classified as lower risk to avoid regulatory burden.',
        ],
      },
    ],

    topics: ['Technology', 'Economy', 'Civil Rights'],

    amendments: [],

    officialTextUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/3341/text',
    congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/3341',

    discussionCount: 2100,
    followersCount: 15600,
    isControversial: true,
    isHighImpact: false,

    relatedBillIds: ['bill-hr-3156', 'bill-s-1492'],
  },
];

// ─── Helper Functions ────────────────────────────────────────

/**
 * Retrieves a single bill by its unique ID.
 */
export function getBillById(id: string): Bill | undefined {
  return mockBills.find((bill) => bill.id === id);
}

/**
 * Returns all bills matching a given topic.
 * If the topic is "All" or empty, returns the full list.
 */
export function getBillsByTopic(topic: string): Bill[] {
  if (!topic || topic === 'All') {
    return mockBills;
  }
  return mockBills.filter((bill) =>
    bill.topics.some((t) => t.toLowerCase() === topic.toLowerCase()),
  );
}

/**
 * Returns all bills with the given status.
 */
export function getBillsByStatus(status: BillStatus): Bill[] {
  return mockBills.filter((bill) => bill.status === status);
}

/**
 * Returns bills sorted by most recently updated (lastActionDate descending).
 */
export function getRecentlyUpdatedBills(): Bill[] {
  return [...mockBills].sort(
    (a, b) => b.lastActionDate.getTime() - a.lastActionDate.getTime(),
  );
}
