/**
 * Localization constants for language, country, and timezone selection
 */

// Common languages for AI Coach voice/text (ISO 639-1 codes)
// These are the most commonly supported languages in major apps
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "pt", name: "Português" },
  { code: "it", name: "Italiano" },
  { code: "nl", name: "Nederlands" }
];

// All countries (ISO 3166-1 alpha-2)
export const COUNTRIES = [
  { code: "AF", name: "Afghanistan" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AS", name: "American Samoa" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AI", name: "Anguilla" },
  { code: "AQ", name: "Antarctica" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" },
  { code: "AW", name: "Aruba" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BM", name: "Bermuda" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" },
  { code: "BR", name: "Brazil" },
  { code: "IO", name: "British Indian Ocean Territory" },
  { code: "VG", name: "British Virgin Islands" },
  { code: "BN", name: "Brunei" },
  { code: "BG", name: "Bulgaria" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "CV", name: "Cabo Verde" },
  { code: "KH", name: "Cambodia" },
  { code: "CM", name: "Cameroon" },
  { code: "CA", name: "Canada" },
  { code: "KY", name: "Cayman Islands" },
  { code: "CF", name: "Central African Republic" },
  { code: "TD", name: "Chad" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CX", name: "Christmas Island" },
  { code: "CC", name: "Cocos (Keeling) Islands" },
  { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoros" },
  { code: "CG", name: "Congo" },
  { code: "CD", name: "Congo (Democratic Republic)" },
  { code: "CK", name: "Cook Islands" },
  { code: "CR", name: "Costa Rica" },
  { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" },
  { code: "CW", name: "Curaçao" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estonia" },
  { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "Ethiopia" },
  { code: "FK", name: "Falkland Islands" },
  { code: "FO", name: "Faroe Islands" },
  { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GF", name: "French Guiana" },
  { code: "PF", name: "French Polynesia" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" },
  { code: "GI", name: "Gibraltar" },
  { code: "GR", name: "Greece" },
  { code: "GL", name: "Greenland" },
  { code: "GD", name: "Grenada" },
  { code: "GP", name: "Guadeloupe" },
  { code: "GU", name: "Guam" },
  { code: "GT", name: "Guatemala" },
  { code: "GG", name: "Guernsey" },
  { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" },
  { code: "HN", name: "Honduras" },
  { code: "HK", name: "Hong Kong" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland" },
  { code: "IM", name: "Isle of Man" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan" },
  { code: "JE", name: "Jersey" },
  { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" },
  { code: "KW", name: "Kuwait" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Laos" },
  { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MO", name: "Macao" },
  { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MQ", name: "Martinique" },
  { code: "MR", name: "Mauritania" },
  { code: "MU", name: "Mauritius" },
  { code: "YT", name: "Mayotte" },
  { code: "MX", name: "Mexico" },
  { code: "FM", name: "Micronesia" },
  { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" },
  { code: "ME", name: "Montenegro" },
  { code: "MS", name: "Montserrat" },
  { code: "MA", name: "Morocco" },
  { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" },
  { code: "NA", name: "Namibia" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands" },
  { code: "NC", name: "New Caledonia" },
  { code: "NZ", name: "New Zealand" },
  { code: "NI", name: "Nicaragua" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "NU", name: "Niue" },
  { code: "NF", name: "Norfolk Island" },
  { code: "KP", name: "North Korea" },
  { code: "MK", name: "North Macedonia" },
  { code: "MP", name: "Northern Mariana Islands" },
  { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" },
  { code: "PS", name: "Palestine" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PN", name: "Pitcairn Islands" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "PR", name: "Puerto Rico" },
  { code: "QA", name: "Qatar" },
  { code: "RE", name: "Réunion" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "RW", name: "Rwanda" },
  { code: "BL", name: "Saint Barthélemy" },
  { code: "SH", name: "Saint Helena" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "LC", name: "Saint Lucia" },
  { code: "MF", name: "Saint Martin" },
  { code: "PM", name: "Saint Pierre and Miquelon" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" },
  { code: "ST", name: "São Tomé and Príncipe" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbia" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" },
  { code: "SX", name: "Sint Maarten" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SO", name: "Somalia" },
  { code: "ZA", name: "South Africa" },
  { code: "GS", name: "South Georgia" },
  { code: "KR", name: "South Korea" },
  { code: "SS", name: "South Sudan" },
  { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" },
  { code: "SJ", name: "Svalbard and Jan Mayen" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "SY", name: "Syria" },
  { code: "TW", name: "Taiwan" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TZ", name: "Tanzania" },
  { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TG", name: "Togo" },
  { code: "TK", name: "Tokelau" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Turkey" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TC", name: "Turks and Caicos Islands" },
  { code: "TV", name: "Tuvalu" },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "UM", name: "United States Minor Outlying Islands" },
  { code: "VI", name: "United States Virgin Islands" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VU", name: "Vanuatu" },
  { code: "VA", name: "Vatican City" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Vietnam" },
  { code: "WF", name: "Wallis and Futuna" },
  { code: "EH", name: "Western Sahara" },
  { code: "YE", name: "Yemen" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
  { code: "AX", name: "Åland Islands" }
];

// Comprehensive IANA timezones with UTC offsets (standard time)
// Note: Offsets shown are standard time; some locations observe daylight saving
export const TIMEZONES = [
  // UTC
  { code: "UTC", offset: "UTC +00:00", name: "Coordinated Universal Time" },

  // UTC-11 to UTC-9
  { code: "Pacific/Samoa", offset: "UTC -11:00", name: "Samoa" },
  { code: "Pacific/Honolulu", offset: "UTC -10:00", name: "Honolulu, Hawaii" },
  { code: "Pacific/Tahiti", offset: "UTC -10:00", name: "Tahiti" },
  { code: "America/Anchorage", offset: "UTC -09:00", name: "Anchorage, Alaska" },

  // UTC-8 Pacific
  { code: "America/Los_Angeles", offset: "UTC -08:00", name: "Los Angeles, Pacific Time" },
  { code: "America/Tijuana", offset: "UTC -08:00", name: "Tijuana" },
  { code: "America/Vancouver", offset: "UTC -08:00", name: "Vancouver" },

  // UTC-7 Mountain
  { code: "America/Denver", offset: "UTC -07:00", name: "Denver, Mountain Time" },
  { code: "America/Edmonton", offset: "UTC -07:00", name: "Edmonton" },
  { code: "America/Phoenix", offset: "UTC -07:00", name: "Phoenix, Arizona" },

  // UTC-6 Central
  { code: "America/Chicago", offset: "UTC -06:00", name: "Chicago, Central Time" },
  { code: "America/Guatemala", offset: "UTC -06:00", name: "Guatemala" },
  { code: "America/Mexico_City", offset: "UTC -06:00", name: "Mexico City" },
  { code: "America/Winnipeg", offset: "UTC -06:00", name: "Winnipeg" },

  // UTC-5 Eastern
  { code: "America/Bogota", offset: "UTC -05:00", name: "Bogota" },
  { code: "America/Cancun", offset: "UTC -05:00", name: "Cancun" },
  { code: "America/Havana", offset: "UTC -05:00", name: "Havana" },
  { code: "America/Jamaica", offset: "UTC -05:00", name: "Jamaica" },
  { code: "America/Lima", offset: "UTC -05:00", name: "Lima" },
  { code: "America/New_York", offset: "UTC -05:00", name: "New York, Eastern Time" },
  { code: "America/Panama", offset: "UTC -05:00", name: "Panama" },
  { code: "America/Toronto", offset: "UTC -05:00", name: "Toronto" },

  // UTC-4:30
  { code: "America/Caracas", offset: "UTC -04:30", name: "Caracas" },

  // UTC-4 Atlantic
  { code: "America/Halifax", offset: "UTC -04:00", name: "Halifax, Atlantic Time" },
  { code: "America/Puerto_Rico", offset: "UTC -04:00", name: "Puerto Rico" },
  { code: "America/Santiago", offset: "UTC -04:00", name: "Santiago" },
  { code: "Atlantic/Bermuda", offset: "UTC -04:00", name: "Bermuda" },

  // UTC-3:30
  { code: "America/St_Johns", offset: "UTC -03:30", name: "St. John's, Newfoundland" },

  // UTC-3
  { code: "America/Buenos_Aires", offset: "UTC -03:00", name: "Buenos Aires" },
  { code: "America/Sao_Paulo", offset: "UTC -03:00", name: "São Paulo" },
  { code: "Antarctica/Palmer", offset: "UTC -03:00", name: "Palmer, Antarctica" },

  // UTC-2
  { code: "America/Noronha", offset: "UTC -02:00", name: "Fernando de Noronha" },
  { code: "Atlantic/South_Georgia", offset: "UTC -02:00", name: "South Georgia" },

  // UTC-1
  { code: "Atlantic/Azores", offset: "UTC -01:00", name: "Azores" },
  { code: "Atlantic/Cape_Verde", offset: "UTC -01:00", name: "Cape Verde" },

  // UTC±0
  { code: "Africa/Abidjan", offset: "UTC +00:00", name: "Abidjan" },
  { code: "Africa/Accra", offset: "UTC +00:00", name: "Accra" },
  { code: "Africa/Casablanca", offset: "UTC +00:00", name: "Casablanca" },
  { code: "Atlantic/Reykjavik", offset: "UTC +00:00", name: "Reykjavik" },
  { code: "Europe/Dublin", offset: "UTC +00:00", name: "Dublin" },
  { code: "Europe/Lisbon", offset: "UTC +00:00", name: "Lisbon" },
  { code: "Europe/London", offset: "UTC +00:00", name: "London" },

  // UTC+1 Central European
  { code: "Africa/Algiers", offset: "UTC +01:00", name: "Algiers" },
  { code: "Africa/Lagos", offset: "UTC +01:00", name: "Lagos" },
  { code: "Africa/Tunis", offset: "UTC +01:00", name: "Tunis" },
  { code: "Atlantic/Canary", offset: "UTC +01:00", name: "Canary Islands" },
  { code: "Europe/Amsterdam", offset: "UTC +01:00", name: "Amsterdam" },
  { code: "Europe/Belgrade", offset: "UTC +01:00", name: "Belgrade" },
  { code: "Europe/Berlin", offset: "UTC +01:00", name: "Berlin" },
  { code: "Europe/Brussels", offset: "UTC +01:00", name: "Brussels" },
  { code: "Europe/Budapest", offset: "UTC +01:00", name: "Budapest" },
  { code: "Europe/Copenhagen", offset: "UTC +01:00", name: "Copenhagen" },
  { code: "Europe/Madrid", offset: "UTC +01:00", name: "Madrid" },
  { code: "Europe/Milan", offset: "UTC +01:00", name: "Milan" },
  { code: "Europe/Oslo", offset: "UTC +01:00", name: "Oslo" },
  { code: "Europe/Paris", offset: "UTC +01:00", name: "Paris" },
  { code: "Europe/Prague", offset: "UTC +01:00", name: "Prague" },
  { code: "Europe/Rome", offset: "UTC +01:00", name: "Rome" },
  { code: "Europe/Stockholm", offset: "UTC +01:00", name: "Stockholm" },
  { code: "Europe/Vienna", offset: "UTC +01:00", name: "Vienna" },
  { code: "Europe/Warsaw", offset: "UTC +01:00", name: "Warsaw" },
  { code: "Europe/Zurich", offset: "UTC +01:00", name: "Zurich" },

  // UTC+2 Eastern European
  { code: "Africa/Cairo", offset: "UTC +02:00", name: "Cairo" },
  { code: "Africa/Johannesburg", offset: "UTC +02:00", name: "Johannesburg" },
  { code: "Asia/Amman", offset: "UTC +02:00", name: "Amman" },
  { code: "Asia/Beirut", offset: "UTC +02:00", name: "Beirut" },
  { code: "Asia/Jerusalem", offset: "UTC +02:00", name: "Jerusalem" },
  { code: "Europe/Athens", offset: "UTC +02:00", name: "Athens" },
  { code: "Europe/Bucharest", offset: "UTC +02:00", name: "Bucharest" },
  { code: "Europe/Helsinki", offset: "UTC +02:00", name: "Helsinki" },
  { code: "Europe/Kiev", offset: "UTC +02:00", name: "Kyiv" },
  { code: "Europe/Riga", offset: "UTC +02:00", name: "Riga" },
  { code: "Europe/Sofia", offset: "UTC +02:00", name: "Sofia" },

  // UTC+3
  { code: "Africa/Addis_Ababa", offset: "UTC +03:00", name: "Addis Ababa" },
  { code: "Africa/Nairobi", offset: "UTC +03:00", name: "Nairobi" },
  { code: "Asia/Baghdad", offset: "UTC +03:00", name: "Baghdad" },
  { code: "Asia/Istanbul", offset: "UTC +03:00", name: "Istanbul" },
  { code: "Asia/Kuwait", offset: "UTC +03:00", name: "Kuwait" },
  { code: "Asia/Qatar", offset: "UTC +03:00", name: "Qatar" },
  { code: "Asia/Riyadh", offset: "UTC +03:00", name: "Riyadh" },
  { code: "Europe/Moscow", offset: "UTC +03:00", name: "Moscow" },

  // UTC+3:30
  { code: "Asia/Tehran", offset: "UTC +03:30", name: "Tehran" },

  // UTC+4
  { code: "Asia/Baku", offset: "UTC +04:00", name: "Baku" },
  { code: "Asia/Dubai", offset: "UTC +04:00", name: "Dubai" },
  { code: "Indian/Mauritius", offset: "UTC +04:00", name: "Mauritius" },

  // UTC+4:30
  { code: "Asia/Kabul", offset: "UTC +04:30", name: "Kabul" },

  // UTC+5
  { code: "Asia/Karachi", offset: "UTC +05:00", name: "Karachi" },
  { code: "Asia/Tashkent", offset: "UTC +05:00", name: "Tashkent" },
  { code: "Indian/Maldives", offset: "UTC +05:00", name: "Maldives" },

  // UTC+5:30
  { code: "Asia/Kolkata", offset: "UTC +05:30", name: "Kolkata, Mumbai, New Delhi" },

  // UTC+5:45
  { code: "Asia/Kathmandu", offset: "UTC +05:45", name: "Kathmandu" },

  // UTC+6
  { code: "Asia/Almaty", offset: "UTC +06:00", name: "Almaty" },
  { code: "Asia/Dhaka", offset: "UTC +06:00", name: "Dhaka" },

  // UTC+6:30
  { code: "Asia/Yangon", offset: "UTC +06:30", name: "Yangon" },

  // UTC+7
  { code: "Asia/Bangkok", offset: "UTC +07:00", name: "Bangkok" },
  { code: "Asia/Ho_Chi_Minh", offset: "UTC +07:00", name: "Ho Chi Minh City" },
  { code: "Asia/Jakarta", offset: "UTC +07:00", name: "Jakarta" },

  // UTC+8
  { code: "Asia/Hong_Kong", offset: "UTC +08:00", name: "Hong Kong" },
  { code: "Asia/Kuala_Lumpur", offset: "UTC +08:00", name: "Kuala Lumpur" },
  { code: "Asia/Manila", offset: "UTC +08:00", name: "Manila" },
  { code: "Asia/Shanghai", offset: "UTC +08:00", name: "Shanghai, Beijing" },
  { code: "Asia/Singapore", offset: "UTC +08:00", name: "Singapore" },
  { code: "Asia/Taipei", offset: "UTC +08:00", name: "Taipei" },
  { code: "Australia/Perth", offset: "UTC +08:00", name: "Perth" },

  // UTC+9
  { code: "Asia/Seoul", offset: "UTC +09:00", name: "Seoul" },
  { code: "Asia/Tokyo", offset: "UTC +09:00", name: "Tokyo" },

  // UTC+9:30
  { code: "Australia/Adelaide", offset: "UTC +09:30", name: "Adelaide" },
  { code: "Australia/Darwin", offset: "UTC +09:30", name: "Darwin" },

  // UTC+10
  { code: "Australia/Brisbane", offset: "UTC +10:00", name: "Brisbane" },
  { code: "Australia/Hobart", offset: "UTC +10:00", name: "Hobart" },
  { code: "Australia/Melbourne", offset: "UTC +10:00", name: "Melbourne" },
  { code: "Australia/Sydney", offset: "UTC +10:00", name: "Sydney" },
  { code: "Pacific/Guam", offset: "UTC +10:00", name: "Guam" },

  // UTC+11
  { code: "Pacific/Noumea", offset: "UTC +11:00", name: "Noumea" },

  // UTC+12
  { code: "Antarctica/McMurdo", offset: "UTC +12:00", name: "McMurdo, Antarctica" },
  { code: "Pacific/Auckland", offset: "UTC +12:00", name: "Auckland" },
  { code: "Pacific/Fiji", offset: "UTC +12:00", name: "Fiji" },

  // UTC+13
  { code: "Pacific/Tongatapu", offset: "UTC +13:00", name: "Tongatapu" }
];

// Type definitions
export type Language = (typeof LANGUAGES)[number];
export type Country = (typeof COUNTRIES)[number];
export type Timezone = (typeof TIMEZONES)[number];

// Helper functions
export const getLanguageByCode = (code: string): Language | undefined => {
  return LANGUAGES.find((lang) => lang.code === code);
};

export const getCountryByCode = (code: string): Country | undefined => {
  return COUNTRIES.find((country) => country.code === code);
};

export const getTimezoneByCode = (code: string): Timezone | undefined => {
  return TIMEZONES.find((tz) => tz.code === code);
};

// Format timezone for display: "UTC -05:00 — New York, Eastern Time"
export const formatTimezoneDisplay = (tz: Timezone): string => {
  return `${tz.offset} — ${tz.name}`;
};
