/**
 * Smart Natural Sorting helper for file names, titles, and season numbers.
 * Ensures 1, 2, 3... 9, 10, 11 order instead of alphabetical 1, 10, 2.
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function naturalCompare(a: string = '', b: string = ''): number {
  return collator.compare(a, b);
}

/**
 * Normalizes Arabic text for flexible searching:
 * - Removes Arabic diacritics/tashkeel
 * - Unifies all Hamzas (أ, إ, آ, ٱ) to plain Alef (ا)
 * - Normalizes Hamza on Ya (ئ) to (ي) and Waw (ؤ) to (و)
 * - Normalizes Taa Marbouta (ة) to Haa (ه) so "مدرسة" matches "مدرسه"
 * - Normalizes Alef Maqsoora (ى) to Ya (ي) so "على" matches "علي"
 */
export function normalizeArabicText(text: string = ''): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

/**
 * Sorts an array of items (files or season objects) intelligently by season and episode names/numbers.
 */
export function sortSmartMediaFiles<T extends { name?: string; title?: string; webkitRelativePath?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const nameA = a.webkitRelativePath || a.name || a.title || '';
    const nameB = b.webkitRelativePath || b.name || b.title || '';
    return naturalCompare(nameA, nameB);
  });
}

