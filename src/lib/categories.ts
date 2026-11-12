export const CATEGORIES = [
  { id: 'groceries', label: 'Groceries', emoji: '🛒', color: '#22C55E', keywords: ['grocery', 'groceries', 'supermarket', 'food city', 'keells', 'cargills', 'arpico', 'glomark', 'spar', 'walmart', 'tesco', 'lidl', 'aldi', 'vegetables', 'fruit', 'milk', 'market'] },
  { id: 'food', label: 'Food & Dining', emoji: '🍔', color: '#F97316', keywords: ['lunch', 'dinner', 'breakfast', 'coffee', 'cafe', 'restaurant', 'pizza', 'burger', 'kfc', 'mcdonald', 'food', 'snack', 'tea', 'meal', 'bakery', 'pickme food', 'uber eats', 'ubereats', 'swiggy', 'zomato', 'domino', 'starbucks', 'rice', 'kottu'] },
  { id: 'transport', label: 'Transport', emoji: '🚕', color: '#3B82F6', keywords: ['uber', 'pickme', 'taxi', 'cab', 'bus', 'train', 'tuk', 'lyft', 'grab', 'ola', 'metro', 'parking', 'toll', 'highway', 'transport', 'ride'] },
  { id: 'fuel', label: 'Fuel', emoji: '⛽', color: '#EAB308', keywords: ['fuel', 'petrol', 'diesel', 'gas station', 'ceypetco', 'ioc', 'shell', 'filling station', 'lanka ioc'] },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️', color: '#EC4899', keywords: ['shopping', 'amazon', 'daraz', 'aliexpress', 'ebay', 'clothes', 'shoes', 'fashion', 'mall', 'odel', 'nolimit', 'store', 'shop'] },
  { id: 'bills', label: 'Bills & Utilities', emoji: '💡', color: '#8B5CF6', keywords: ['bill', 'electricity', 'ceb', 'leco', 'water', 'internet', 'wifi', 'dialog', 'mobitel', 'slt', 'hutch', 'airtel', 'reload', 'recharge', 'phone', 'mobile', 'rent', 'insurance', 'utility', 'subscription', 'netflix', 'spotify', 'youtube premium', 'icloud', 'google one'] },
  { id: 'health', label: 'Health', emoji: '💊', color: '#EF4444', keywords: ['pharmacy', 'medicine', 'doctor', 'hospital', 'clinic', 'channel', 'lab', 'dental', 'health', 'gym', 'osu sala', 'healthguard'] },
  { id: 'entertainment', label: 'Entertainment', emoji: '🎬', color: '#14B8A6', keywords: ['movie', 'cinema', 'film', 'game', 'concert', 'party', 'scope', 'pvr', 'steam', 'playstation', 'fun', 'trip', 'hotel', 'travel'] },
  { id: 'education', label: 'Education', emoji: '📚', color: '#0EA5E9', keywords: ['book', 'course', 'class', 'tuition', 'school', 'university', 'exam', 'udemy', 'coursera', 'fees', 'stationery'] },
  { id: 'other', label: 'Other', emoji: '📦', color: '#64748B', keywords: [] as string[] },
] as const;

/** Cash-in categories. Checked in order; "income" is the fallback. */
export const INCOME_CATEGORIES = [
  { id: 'salary', label: 'Salary', emoji: '💼', color: '#16A34A', keywords: ['salary', 'sal ', 'payroll', 'wages', 'pay day', 'payday', 'bonus', 'allowance'] },
  { id: 'business', label: 'Business / Freelance', emoji: '💰', color: '#0D9488', keywords: ['freelance', 'client', 'invoice', 'business', 'sale', 'sold', 'commission', 'project', 'upwork', 'fiverr', 'payoneer'] },
  { id: 'refund', label: 'Refund', emoji: '↩️', color: '#0EA5E9', keywords: ['refund', 'reversal', 'reversed', 'cashback', 'cash back'] },
  { id: 'interest', label: 'Interest', emoji: '🏦', color: '#65A30D', keywords: ['interest', 'dividend'] },
  { id: 'gift', label: 'Gift', emoji: '🎁', color: '#DB2777', keywords: ['gift', 'present'] },
  { id: 'income', label: 'Other income', emoji: '➕', color: '#22C55E', keywords: [] as string[] },
] as const;

export type EntryType = 'expense' | 'income';
export type ExpenseCategoryId = (typeof CATEGORIES)[number]['id'];
export type IncomeCategoryId = (typeof INCOME_CATEGORIES)[number]['id'];
export type CategoryId = ExpenseCategoryId | IncomeCategoryId;
export type Category = (typeof CATEGORIES)[number] | (typeof INCOME_CATEGORIES)[number];

const BY_ID = new Map<string, Category>([...CATEGORIES, ...INCOME_CATEGORIES].map((c) => [c.id, c]));
const INCOME_IDS = new Set<string>(INCOME_CATEGORIES.map((c) => c.id));

export function categoriesFor(type: EntryType): readonly Category[] {
  return type === 'income' ? INCOME_CATEGORIES : CATEGORIES;
}

export function isIncomeCategory(id: string): boolean {
  return INCOME_IDS.has(id);
}

export function isCategoryId(id: string): id is CategoryId {
  return BY_ID.has(id);
}

export function getCategory(id: string): Category {
  return BY_ID.get(id) ?? BY_ID.get('other')!;
}

/** Best-effort category from free text, falling back to "other" (cash out) or "income" (cash in). */
export function guessCategory(text: string, type: EntryType = 'expense'): CategoryId {
  const t = ` ${text.toLowerCase()} `;
  for (const c of categoriesFor(type)) {
    for (const k of c.keywords) {
      // Word-boundary-ish match so "tea" doesn't match "steam".
      const re = new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      if (re.test(t)) return c.id;
    }
  }
  return type === 'income' ? 'income' : 'other';
}
