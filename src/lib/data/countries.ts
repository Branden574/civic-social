// ═══════════════════════════════════════════════════════════════
// Civic Social — Country & Political Party Registry
// ═══════════════════════════════════════════════════════════════
//
// INVARIANT: getPartiesForCountry() must NEVER return duplicates.
//
// Dedup pipeline (deterministic):
//   1. Collect country-specific parties
//   2. Collect universal defaults (country='*')
//   3. Normalize names (trim, collapse spaces, lowercase slug)
//   4. Deduplicate by slug — country-specific wins over universal
//   5. Append any universal defaults that don't collide
//   6. Sort: regular parties alphabetically, then defaults pinned to end
//
// ═══════════════════════════════════════════════════════════════

export interface Country {
  code: string;
  name: string;
  flag: string;
}

export interface Party {
  id: string;
  name: string;
  abbreviation: string;
  country: string;        // ISO code or '*' for universal defaults
  ideology: string;
  color: string;
  isSpecial?: boolean;    // true for Independent / Undeclared / Multi-affiliation
  slug: string;           // normalized unique key: "<country>:<lowercase-name>"
  source?: 'registry' | 'default'; // origin of the record
}

// ─── Countries ───────────────────────────────────────────────

export const countries: Country[] = [
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿' },
  { code: 'AD', name: 'Andorra', flag: '🇦🇩' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴' },
  { code: 'AG', name: 'Antigua and Barbuda', flag: '🇦🇬' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'AM', name: 'Armenia', flag: '🇦🇲' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿' },
  { code: 'BS', name: 'Bahamas', flag: '🇧🇸' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'BB', name: 'Barbados', flag: '🇧🇧' },
  { code: 'BY', name: 'Belarus', flag: '🇧🇾' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'BZ', name: 'Belize', flag: '🇧🇿' },
  { code: 'BJ', name: 'Benin', flag: '🇧🇯' },
  { code: 'BT', name: 'Bhutan', flag: '🇧🇹' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
  { code: 'BA', name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'BN', name: 'Brunei', flag: '🇧🇳' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮' },
  { code: 'CV', name: 'Cabo Verde', flag: '🇨🇻' },
  { code: 'KH', name: 'Cambodia', flag: '🇰🇭' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'CF', name: 'Central African Republic', flag: '🇨🇫' },
  { code: 'TD', name: 'Chad', flag: '🇹🇩' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'KM', name: 'Comoros', flag: '🇰🇲' },
  { code: 'CG', name: 'Congo', flag: '🇨🇬' },
  { code: 'CD', name: 'Congo (DRC)', flag: '🇨🇩' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺' },
  { code: 'CY', name: 'Cyprus', flag: '🇨🇾' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'DJ', name: 'Djibouti', flag: '🇩🇯' },
  { code: 'DM', name: 'Dominica', flag: '🇩🇲' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻' },
  { code: 'GQ', name: 'Equatorial Guinea', flag: '🇬🇶' },
  { code: 'ER', name: 'Eritrea', flag: '🇪🇷' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪' },
  { code: 'SZ', name: 'Eswatini', flag: '🇸🇿' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹' },
  { code: 'FJ', name: 'Fiji', flag: '🇫🇯' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦' },
  { code: 'GM', name: 'Gambia', flag: '🇬🇲' },
  { code: 'GE', name: 'Georgia', flag: '🇬🇪' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'GD', name: 'Grenada', flag: '🇬🇩' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹' },
  { code: 'GN', name: 'Guinea', flag: '🇬🇳' },
  { code: 'GW', name: 'Guinea-Bissau', flag: '🇬🇼' },
  { code: 'GY', name: 'Guyana', flag: '🇬🇾' },
  { code: 'HT', name: 'Haiti', flag: '🇭🇹' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: 'IS', name: 'Iceland', flag: '🇮🇸' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'KI', name: 'Kiribati', flag: '🇰🇮' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'KG', name: 'Kyrgyzstan', flag: '🇰🇬' },
  { code: 'LA', name: 'Laos', flag: '🇱🇦' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧' },
  { code: 'LS', name: 'Lesotho', flag: '🇱🇸' },
  { code: 'LR', name: 'Liberia', flag: '🇱🇷' },
  { code: 'LY', name: 'Libya', flag: '🇱🇾' },
  { code: 'LI', name: 'Liechtenstein', flag: '🇱🇮' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬' },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'MV', name: 'Maldives', flag: '🇲🇻' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱' },
  { code: 'MT', name: 'Malta', flag: '🇲🇹' },
  { code: 'MH', name: 'Marshall Islands', flag: '🇲🇭' },
  { code: 'MR', name: 'Mauritania', flag: '🇲🇷' },
  { code: 'MU', name: 'Mauritius', flag: '🇲🇺' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'FM', name: 'Micronesia', flag: '🇫🇲' },
  { code: 'MD', name: 'Moldova', flag: '🇲🇩' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨' },
  { code: 'MN', name: 'Mongolia', flag: '🇲🇳' },
  { code: 'ME', name: 'Montenegro', flag: '🇲🇪' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿' },
  { code: 'MM', name: 'Myanmar', flag: '🇲🇲' },
  { code: 'NA', name: 'Namibia', flag: '🇳🇦' },
  { code: 'NR', name: 'Nauru', flag: '🇳🇷' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'KP', name: 'North Korea', flag: '🇰🇵' },
  { code: 'MK', name: 'North Macedonia', flag: '🇲🇰' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'PW', name: 'Palau', flag: '🇵🇼' },
  { code: 'PS', name: 'Palestine', flag: '🇵🇸' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦' },
  { code: 'PG', name: 'Papua New Guinea', flag: '🇵🇬' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼' },
  { code: 'KN', name: 'Saint Kitts and Nevis', flag: '🇰🇳' },
  { code: 'LC', name: 'Saint Lucia', flag: '🇱🇨' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', flag: '🇻🇨' },
  { code: 'WS', name: 'Samoa', flag: '🇼🇸' },
  { code: 'SM', name: 'San Marino', flag: '🇸🇲' },
  { code: 'ST', name: 'São Tomé and Príncipe', flag: '🇸🇹' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
  { code: 'RS', name: 'Serbia', flag: '🇷🇸' },
  { code: 'SC', name: 'Seychelles', flag: '🇸🇨' },
  { code: 'SL', name: 'Sierra Leone', flag: '🇸🇱' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰' },
  { code: 'SI', name: 'Slovenia', flag: '🇸🇮' },
  { code: 'SB', name: 'Solomon Islands', flag: '🇸🇧' },
  { code: 'SO', name: 'Somalia', flag: '🇸🇴' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'SS', name: 'South Sudan', flag: '🇸🇸' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'SD', name: 'Sudan', flag: '🇸🇩' },
  { code: 'SR', name: 'Suriname', flag: '🇸🇷' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'SY', name: 'Syria', flag: '🇸🇾' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'TJ', name: 'Tajikistan', flag: '🇹🇯' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'TL', name: 'Timor-Leste', flag: '🇹🇱' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬' },
  { code: 'TO', name: 'Tonga', flag: '🇹🇴' },
  { code: 'TT', name: 'Trinidad and Tobago', flag: '🇹🇹' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'TM', name: 'Turkmenistan', flag: '🇹🇲' },
  { code: 'TV', name: 'Tuvalu', flag: '🇹🇻' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿' },
  { code: 'VU', name: 'Vanuatu', flag: '🇻🇺' },
  { code: 'VA', name: 'Vatican City', flag: '🇻🇦' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen', flag: '🇾🇪' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼' },
];

// ─── Normalization helpers ───────────────────────────────────

/**
 * Create a deterministic slug from a party name.
 * Trims, collapses whitespace, lowercases, replaces non-alphanumeric with hyphens.
 */
function slugify(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')         // collapse multiple spaces
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // non-alphanumeric → hyphen
    .replace(/^-|-$/g, '');        // strip leading/trailing hyphens
}

/**
 * Normalize a party name for display: trim + collapse whitespace.
 */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

// ─── Raw party data (internal, not exported) ─────────────────
// Country-specific parties should NOT duplicate universal defaults.
// Only list actual political parties here; "Independent", "Undeclared",
// and "Multi-affiliation" are handled exclusively via UNIVERSAL_DEFAULTS.

interface RawParty {
  id: string;
  name: string;
  abbreviation: string;
  country: string;
  ideology: string;
  color: string;
  isSpecial?: boolean;
}

const RAW_PARTIES: RawParty[] = [
  // ── United States ──
  { id: 'us-dem', name: 'Democratic Party', abbreviation: 'DEM', country: 'US', ideology: 'center-left', color: '#3B82F6' },
  { id: 'us-rep', name: 'Republican Party', abbreviation: 'GOP', country: 'US', ideology: 'center-right', color: '#EF4444' },
  { id: 'us-lib', name: 'Libertarian Party', abbreviation: 'LIB', country: 'US', ideology: 'right', color: '#F59E0B' },
  { id: 'us-grn', name: 'Green Party', abbreviation: 'GRN', country: 'US', ideology: 'left', color: '#10B981' },

  // ── United Kingdom ──
  { id: 'gb-con', name: 'Conservative Party', abbreviation: 'CON', country: 'GB', ideology: 'center-right', color: '#3B82F6' },
  { id: 'gb-lab', name: 'Labour Party', abbreviation: 'LAB', country: 'GB', ideology: 'center-left', color: '#EF4444' },
  { id: 'gb-lib', name: 'Liberal Democrats', abbreviation: 'LD', country: 'GB', ideology: 'center', color: '#F59E0B' },
  { id: 'gb-grn', name: 'Green Party', abbreviation: 'GRN', country: 'GB', ideology: 'left', color: '#10B981' },
  { id: 'gb-ref', name: 'Reform UK', abbreviation: 'REF', country: 'GB', ideology: 'right', color: '#06B6D4' },

  // ── Canada ──
  { id: 'ca-lib', name: 'Liberal Party', abbreviation: 'LPC', country: 'CA', ideology: 'center-left', color: '#EF4444' },
  { id: 'ca-con', name: 'Conservative Party', abbreviation: 'CPC', country: 'CA', ideology: 'center-right', color: '#3B82F6' },
  { id: 'ca-ndp', name: 'New Democratic Party', abbreviation: 'NDP', country: 'CA', ideology: 'left', color: '#F97316' },
  { id: 'ca-grn', name: 'Green Party', abbreviation: 'GPC', country: 'CA', ideology: 'left', color: '#10B981' },
  { id: 'ca-bq', name: 'Bloc Québécois', abbreviation: 'BQ', country: 'CA', ideology: 'center-left', color: '#06B6D4' },

  // ── Australia ──
  { id: 'au-alp', name: 'Australian Labor Party', abbreviation: 'ALP', country: 'AU', ideology: 'center-left', color: '#EF4444' },
  { id: 'au-lib', name: 'Liberal Party', abbreviation: 'LIB', country: 'AU', ideology: 'center-right', color: '#3B82F6' },
  { id: 'au-nat', name: 'National Party', abbreviation: 'NAT', country: 'AU', ideology: 'center-right', color: '#10B981' },
  { id: 'au-grn', name: 'Australian Greens', abbreviation: 'GRN', country: 'AU', ideology: 'left', color: '#22C55E' },

  // ── Germany ──
  { id: 'de-spd', name: 'Social Democratic Party', abbreviation: 'SPD', country: 'DE', ideology: 'center-left', color: '#EF4444' },
  { id: 'de-cdu', name: 'Christian Democratic Union', abbreviation: 'CDU', country: 'DE', ideology: 'center-right', color: '#1F2937' },
  { id: 'de-grn', name: 'Alliance 90/The Greens', abbreviation: 'GRN', country: 'DE', ideology: 'left', color: '#10B981' },
  { id: 'de-fdp', name: 'Free Democratic Party', abbreviation: 'FDP', country: 'DE', ideology: 'center', color: '#F59E0B' },
  { id: 'de-afd', name: 'Alternative for Germany', abbreviation: 'AfD', country: 'DE', ideology: 'right', color: '#3B82F6' },

  // ── France ──
  { id: 'fr-ren', name: 'Renaissance', abbreviation: 'RE', country: 'FR', ideology: 'center', color: '#F59E0B' },
  { id: 'fr-rn', name: 'National Rally', abbreviation: 'RN', country: 'FR', ideology: 'right', color: '#1F2937' },
  { id: 'fr-lfi', name: 'La France Insoumise', abbreviation: 'LFI', country: 'FR', ideology: 'left', color: '#EF4444' },
  { id: 'fr-lr', name: 'Les Républicains', abbreviation: 'LR', country: 'FR', ideology: 'center-right', color: '#3B82F6' },
  { id: 'fr-eelv', name: 'Europe Ecology – The Greens', abbreviation: 'EELV', country: 'FR', ideology: 'left', color: '#10B981' },

  // ── India ──
  { id: 'in-bjp', name: 'Bharatiya Janata Party', abbreviation: 'BJP', country: 'IN', ideology: 'center-right', color: '#F97316' },
  { id: 'in-inc', name: 'Indian National Congress', abbreviation: 'INC', country: 'IN', ideology: 'center-left', color: '#06B6D4' },
  { id: 'in-aap', name: 'Aam Aadmi Party', abbreviation: 'AAP', country: 'IN', ideology: 'center', color: '#3B82F6' },

  // ── Brazil ──
  { id: 'br-pt', name: 'Workers Party', abbreviation: 'PT', country: 'BR', ideology: 'left', color: '#EF4444' },
  { id: 'br-pl', name: 'Liberal Party', abbreviation: 'PL', country: 'BR', ideology: 'right', color: '#3B82F6' },
  { id: 'br-mdb', name: 'Brazilian Democratic Movement', abbreviation: 'MDB', country: 'BR', ideology: 'center', color: '#10B981' },

  // ── Nigeria ──
  { id: 'ng-apc', name: 'All Progressives Congress', abbreviation: 'APC', country: 'NG', ideology: 'center-right', color: '#3B82F6' },
  { id: 'ng-pdp', name: "People's Democratic Party", abbreviation: 'PDP', country: 'NG', ideology: 'center-left', color: '#EF4444' },
  { id: 'ng-lp', name: 'Labour Party', abbreviation: 'LP', country: 'NG', ideology: 'left', color: '#10B981' },

  // ── Japan ──
  { id: 'jp-ldp', name: 'Liberal Democratic Party', abbreviation: 'LDP', country: 'JP', ideology: 'center-right', color: '#3B82F6' },
  { id: 'jp-cdp', name: 'Constitutional Democratic Party', abbreviation: 'CDP', country: 'JP', ideology: 'center-left', color: '#EF4444' },
  { id: 'jp-ishin', name: 'Nippon Ishin no Kai', abbreviation: 'ISHIN', country: 'JP', ideology: 'center', color: '#10B981' },

  // ── South Korea ──
  { id: 'kr-ppp', name: "People Power Party", abbreviation: 'PPP', country: 'KR', ideology: 'center-right', color: '#EF4444' },
  { id: 'kr-dpk', name: 'Democratic Party of Korea', abbreviation: 'DPK', country: 'KR', ideology: 'center-left', color: '#3B82F6' },

  // ── Mexico ──
  { id: 'mx-morena', name: 'MORENA', abbreviation: 'MORENA', country: 'MX', ideology: 'left', color: '#8B0000' },
  { id: 'mx-pan', name: 'National Action Party', abbreviation: 'PAN', country: 'MX', ideology: 'center-right', color: '#3B82F6' },
  { id: 'mx-pri', name: 'Institutional Revolutionary Party', abbreviation: 'PRI', country: 'MX', ideology: 'center', color: '#10B981' },

  // ── South Africa ──
  { id: 'za-anc', name: 'African National Congress', abbreviation: 'ANC', country: 'ZA', ideology: 'center-left', color: '#10B981' },
  { id: 'za-da', name: 'Democratic Alliance', abbreviation: 'DA', country: 'ZA', ideology: 'center', color: '#3B82F6' },
  { id: 'za-eff', name: 'Economic Freedom Fighters', abbreviation: 'EFF', country: 'ZA', ideology: 'left', color: '#EF4444' },

  // ── Kenya ──
  { id: 'ke-uda', name: 'United Democratic Alliance', abbreviation: 'UDA', country: 'KE', ideology: 'center-right', color: '#F59E0B' },
  { id: 'ke-odm', name: 'Orange Democratic Movement', abbreviation: 'ODM', country: 'KE', ideology: 'center-left', color: '#F97316' },
];

// ─── Universal defaults (always available, exactly once) ─────
// These are the ONLY source for "Independent", "Undeclared", "Multi-affiliation".
// Country-specific entries MUST NOT duplicate these names.

const UNIVERSAL_DEFAULTS: RawParty[] = [
  { id: 'gen-ind', name: 'Independent', abbreviation: 'IND', country: '*', ideology: 'center', color: '#8B5CF6', isSpecial: true },
  { id: 'gen-und', name: 'Undeclared', abbreviation: 'UND', country: '*', ideology: 'center', color: '#6B7280', isSpecial: true },
  { id: 'gen-mul', name: 'Multi-affiliation', abbreviation: 'MUL', country: '*', ideology: 'center', color: '#A78BFA', isSpecial: true },
];

// ─── Build the normalized party index ────────────────────────

function buildParty(raw: RawParty): Party {
  const name = normalizeName(raw.name);
  return {
    ...raw,
    name,
    slug: `${raw.country}:${slugify(name)}`,
    source: raw.isSpecial ? 'default' : 'registry',
  };
}

/**
 * Pre-built lookup: Map<slug, Party> for all parties.
 * Guarantees uniqueness by slug at the data layer.
 */
const PARTY_INDEX: Map<string, Party> = (() => {
  const map = new Map<string, Party>();
  for (const raw of [...RAW_PARTIES, ...UNIVERSAL_DEFAULTS]) {
    const party = buildParty(raw);
    // If slug already exists, first write wins (no silent override)
    if (!map.has(party.slug)) {
      map.set(party.slug, party);
    }
  }
  return map;
})();

/**
 * All parties (deduplicated). Exported for testing and admin views.
 */
export const parties: Party[] = Array.from(PARTY_INDEX.values());

// ═══════════════════════════════════════════════════════════════
// Public API — getPartiesForCountry
// ═══════════════════════════════════════════════════════════════
//
// Returns a DEDUPLICATED, SORTED list for a given country code.
//
// Pipeline:
//   1. Filter country-specific parties
//   2. Normalize names for collision detection
//   3. Add universal defaults IFF no country-specific party has the same name
//   4. Sort: regular parties alphabetically, defaults pinned at the end
//
// ═══════════════════════════════════════════════════════════════

export function getPartiesForCountry(countryCode: string): Party[] {
  // Step 1: Collect country-specific parties
  const countryParties = parties.filter((p) => p.country === countryCode);

  // Step 2: Build a set of normalized names already present
  const nameSet = new Set(countryParties.map((p) => slugify(p.name)));

  // Step 3: Add universal defaults that don't collide by name
  const defaults = parties.filter((p) => p.country === '*');
  const nonCollidingDefaults = defaults.filter((d) => !nameSet.has(slugify(d.name)));

  // Step 4: Merge
  const merged = [...countryParties, ...nonCollidingDefaults];

  // Step 5: Final dedup safety net — use a Map keyed on normalized name
  // This catches any edge case (e.g., API returning "independent" with different casing)
  const deduped = new Map<string, Party>();
  for (const party of merged) {
    const key = slugify(party.name);
    if (!deduped.has(key)) {
      deduped.set(key, party);
    }
    // else: skip — first occurrence wins (country-specific > universal)
  }

  // Step 6: Sort — regular parties alphabetically, then defaults pinned at end
  const result = Array.from(deduped.values());
  result.sort((a, b) => {
    // Defaults always last
    if (a.isSpecial && !b.isSpecial) return 1;
    if (!a.isSpecial && b.isSpecial) return -1;
    // Among same type, sort alphabetically
    return a.name.localeCompare(b.name);
  });

  return result;
}

// ─── Utility exports ─────────────────────────────────────────

export function getPartyById(id: string): Party | undefined {
  for (const party of PARTY_INDEX.values()) {
    if (party.id === id) return party;
  }
  return undefined;
}

export function getIdeologyColor(ideology: string): string {
  const map: Record<string, string> = {
    'left': '#60A5FA',
    'center-left': '#818CF8',
    'center': '#A78BFA',
    'center-right': '#FB923C',
    'right': '#F87171',
  };
  return map[ideology] || '#6B7280';
}

/**
 * Returns only the universal default parties.
 * Use as fallback when an API call fails.
 */
export function getDefaultParties(): Party[] {
  return UNIVERSAL_DEFAULTS.map(buildParty);
}

/**
 * Exposed for testing: the slugify function.
 */
export { slugify };
