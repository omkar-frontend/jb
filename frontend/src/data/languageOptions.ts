export type LanguageOption = {
    value: string
    label: string
}

/** Spoken languages for CV / profile (sorted). */
const SPOKEN_LANGUAGE_NAMES: string[] = [
    'Afrikaans',
    'Albanian',
    'Amharic',
    'Arabic',
    'Armenian',
    'Assamese',
    'Azerbaijani',
    'Basque',
    'Belarusian',
    'Bengali',
    'Bosnian',
    'Bulgarian',
    'Burmese',
    'Cantonese',
    'Catalan',
    'Cebuano',
    'Chinese (Mandarin)',
    'Croatian',
    'Czech',
    'Danish',
    'Dutch',
    'English',
    'Estonian',
    'Filipino',
    'Finnish',
    'French',
    'Galician',
    'Georgian',
    'German',
    'Greek',
    'Gujarati',
    'Haitian Creole',
    'Hausa',
    'Hebrew',
    'Hindi',
    'Hmong',
    'Hungarian',
    'Icelandic',
    'Igbo',
    'Indonesian',
    'Irish',
    'Italian',
    'Japanese',
    'Javanese',
    'Kannada',
    'Kazakh',
    'Khmer',
    'Korean',
    'Kurdish',
    'Kyrgyz',
    'Lao',
    'Latvian',
    'Lithuanian',
    'Macedonian',
    'Malay',
    'Malayalam',
    'Maltese',
    'Maori',
    'Marathi',
    'Mongolian',
    'Nepali',
    'Norwegian',
    'Odia',
    'Pashto',
    'Persian (Farsi)',
    'Polish',
    'Portuguese',
    'Punjabi',
    'Romanian',
    'Russian',
    'Samoan',
    'Scottish Gaelic',
    'Serbian',
    'Sinhala',
    'Slovak',
    'Slovenian',
    'Somali',
    'Spanish',
    'Swahili',
    'Swedish',
    'Tagalog',
    'Tajik',
    'Tamil',
    'Telugu',
    'Thai',
    'Turkish',
    'Ukrainian',
    'Urdu',
    'Uzbek',
    'Vietnamese',
    'Welsh',
    'Xhosa',
    'Yiddish',
    'Yoruba',
    'Zulu',
    'American Sign Language',
    'British Sign Language',
]

function toOption(name: string): LanguageOption {
    return { value: name, label: name }
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [...new Set(SPOKEN_LANGUAGE_NAMES)]
    .sort((a, b) => a.localeCompare(b))
    .map(toOption)

/** Keep CV languages that are not in the master list. */
export function mergeLanguageOptions(selected: string[]): LanguageOption[] {
    const known = new Set(
        LANGUAGE_OPTIONS.map((option) => option.value.toLowerCase())
    )
    const extras = selected
        .map((name) => name.trim())
        .filter((name) => name && !known.has(name.toLowerCase()))
        .map(toOption)

    return [...LANGUAGE_OPTIONS, ...extras]
}

export function languagesToSelectValue(languages: string[]): LanguageOption[] {
    return languages.map((name) => toOption(name))
}
