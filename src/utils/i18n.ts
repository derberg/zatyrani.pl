import plTranslations from '../../public/locales/pl/translation.json';
import enTranslations from '../../public/locales/en/translation.json';

const translations = {
  pl: plTranslations,
  en: enTranslations,
};

export function t(key: string, lang: 'pl' | 'en' = 'pl'): string {
  const keys = key.split('.');
  let value: Record<string, unknown> | string = translations[lang];
  
  for (const k of keys) {
    if (typeof value === 'object' && value !== null) {
      value = value[k] as Record<string, unknown> | string;
    }
  }
  
  return typeof value === 'string' ? value : key;
}
