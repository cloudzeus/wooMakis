/**
 * Storefront language.
 *
 * Two languages, matching the Polylang setup on mylens.gr: Greek is the
 * language the catalog is authored in and the default, English is the
 * translation. Product, category and brand copy already exists per locale in
 * the database; this module covers the surrounding interface text and the
 * plumbing for choosing between them.
 *
 * The locale lives in a cookie rather than in the URL. A path prefix (/en/…)
 * is the more conventional choice and better for SEO, but every product,
 * category and brand here shares one slug across languages — the Polylang
 * groups were collapsed on the way in — so a prefix would produce two URLs for
 * one page with identical slugs, which is worse for indexing than one URL. If
 * per-language slugs are ever wanted, that is the change to make first.
 */

export const LOCALES = ['el', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'el'

export const LOCALE_NAMES: Record<Locale, string> = {
  el: 'Ελληνικά',
  en: 'English',
}

/** Cookie the storefront reads on every request. */
export const LOCALE_COOKIE = 'WOOMAKIS_LOCALE'

export function isLocale(v: string | undefined | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v)
}

export function asLocale(v: string | undefined | null): Locale {
  return isLocale(v) ? v : DEFAULT_LOCALE
}

/**
 * Picks the best translation from a list that may not contain the requested
 * locale. Falls back to Greek, then to whatever exists — a product with only
 * an English translation should still render rather than showing a blank name.
 */
export function pickTranslation<T extends { locale: string }>(
  translations: T[],
  locale: Locale,
): T | undefined {
  return translations.find(t => t.locale === locale)
    ?? translations.find(t => t.locale === DEFAULT_LOCALE)
    ?? translations[0]
}

type Dict = Record<string, string>

/**
 * Interface strings. Content — product names, legal text, FAQ answers — is not
 * here; that lives in the database with its own translations.
 */
const EL: Dict = {
  'nav.products': 'Προϊόντα',
  'nav.categories': 'Κατηγορίες',
  'nav.brands': 'Μάρκες',
  'nav.cart': 'Καλάθι',
  'nav.account': 'Ο λογαριασμός μου',
  'nav.signIn': 'Σύνδεση',
  'nav.signOut': 'Αποσύνδεση',
  'nav.home': 'Αρχική',
  'nav.faq': 'Συχνές ερωτήσεις',
  'nav.language': 'Γλώσσα',

  'footer.legal': 'Νομικά',
  'footer.help': 'Βοήθεια',
  'footer.terms': 'Όροι χρήσης',
  'footer.privacy': 'Πολιτική απορρήτου',
  'footer.cookies': 'Πολιτική cookies',
  'footer.shipping': 'Αποστολές',
  'footer.returns': 'Επιστροφές',
  'footer.contact': 'Επικοινωνία',

  'cookies.title': 'Χρησιμοποιούμε cookies',
  'cookies.body':
    'Τα απαραίτητα cookies κρατούν το καλάθι και τη σύνδεσή σου και δεν απενεργοποιούνται. '
    + 'Για τα υπόλοιπα αποφασίζεις εσύ.',
  'cookies.acceptAll': 'Αποδοχή όλων',
  'cookies.rejectAll': 'Μόνο τα απαραίτητα',
  'cookies.customise': 'Ρυθμίσεις',
  'cookies.save': 'Αποθήκευση επιλογών',
  'cookies.necessary': 'Απαραίτητα',
  'cookies.necessaryHelp': 'Καλάθι, σύνδεση, ασφάλεια. Πάντα ενεργά.',
  'cookies.analytics': 'Στατιστικά',
  'cookies.analyticsHelp': 'Μας δείχνουν ποιες σελίδες χρησιμοποιούνται. Ανώνυμα.',
  'cookies.marketing': 'Διαφήμιση',
  'cookies.marketingHelp': 'Επιτρέπουν εξατομικευμένες διαφημίσεις εκτός του site.',
  'cookies.more': 'Διάβασε την πολιτική cookies',

  'account.title': 'Ο λογαριασμός μου',
  'account.orders': 'Οι παραγγελίες μου',
  'account.details': 'Τα στοιχεία μου',
  'account.overview': 'Επισκόπηση',
  'account.totalOrders': 'Παραγγελίες',
  'account.totalSpent': 'Σύνολο αγορών',
  'account.lastOrder': 'Τελευταία παραγγελία',
  'account.noOrders': 'Δεν έχεις παραγγελίες ακόμα.',
  'account.prescription': 'Συνταγή',
  'account.reorder': 'Παράγγειλέ το ξανά',
  'account.myLenses': 'Οι φακοί μου',
  'account.myLensesHelp':
    'Οι διαστάσεις από τις τελευταίες σου παραγγελίες, για να μη χρειάζεται να τις ψάχνεις.',

  'auth.signIn': 'Σύνδεση',
  'auth.register': 'Δημιουργία λογαριασμού',
  'auth.email': 'Email',
  'auth.password': 'Κωδικός',
  'auth.name': 'Ονοματεπώνυμο',
  'auth.haveAccount': 'Έχεις ήδη λογαριασμό;',
  'auth.noAccount': 'Δεν έχεις λογαριασμό;',
  'auth.lookupTitle': 'Παρακολούθηση παραγγελίας χωρίς λογαριασμό',
  'auth.lookupHelp': 'Δώσε το email και τον αριθμό της παραγγελίας.',
  'auth.orderNumber': 'Αριθμός παραγγελίας',
  'auth.lookup': 'Αναζήτηση',

  'common.back': 'Πίσω',
  'common.total': 'Σύνολο',
  'common.date': 'Ημερομηνία',
  'common.status': 'Κατάσταση',
  'common.items': 'Είδη',
  'common.quantity': 'Ποσότητα',
  'common.save': 'Αποθήκευση',
  'common.loading': 'Φόρτωση…',
  'common.updated': 'Τελευταία ενημέρωση',
}

const EN: Dict = {
  'nav.products': 'Products',
  'nav.categories': 'Categories',
  'nav.brands': 'Brands',
  'nav.cart': 'Cart',
  'nav.account': 'My account',
  'nav.signIn': 'Sign in',
  'nav.signOut': 'Sign out',
  'nav.home': 'Home',
  'nav.faq': 'FAQ',
  'nav.language': 'Language',

  'footer.legal': 'Legal',
  'footer.help': 'Help',
  'footer.terms': 'Terms of use',
  'footer.privacy': 'Privacy policy',
  'footer.cookies': 'Cookie policy',
  'footer.shipping': 'Shipping',
  'footer.returns': 'Returns',
  'footer.contact': 'Contact',

  'cookies.title': 'We use cookies',
  'cookies.body':
    'Necessary cookies keep your cart and your session and cannot be turned off. '
    + 'The rest are your choice.',
  'cookies.acceptAll': 'Accept all',
  'cookies.rejectAll': 'Necessary only',
  'cookies.customise': 'Settings',
  'cookies.save': 'Save choices',
  'cookies.necessary': 'Necessary',
  'cookies.necessaryHelp': 'Cart, sign-in, security. Always on.',
  'cookies.analytics': 'Analytics',
  'cookies.analyticsHelp': 'Show us which pages get used. Anonymous.',
  'cookies.marketing': 'Marketing',
  'cookies.marketingHelp': 'Allow personalised advertising off this site.',
  'cookies.more': 'Read the cookie policy',

  'account.title': 'My account',
  'account.orders': 'My orders',
  'account.details': 'My details',
  'account.overview': 'Overview',
  'account.totalOrders': 'Orders',
  'account.totalSpent': 'Total spent',
  'account.lastOrder': 'Last order',
  'account.noOrders': 'You have no orders yet.',
  'account.prescription': 'Prescription',
  'account.reorder': 'Order again',
  'account.myLenses': 'My lenses',
  'account.myLensesHelp':
    'The measurements from your recent orders, so you do not have to go looking for them.',

  'auth.signIn': 'Sign in',
  'auth.register': 'Create account',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.name': 'Full name',
  'auth.haveAccount': 'Already have an account?',
  'auth.noAccount': 'No account yet?',
  'auth.lookupTitle': 'Track an order without an account',
  'auth.lookupHelp': 'Enter the email and the order number.',
  'auth.orderNumber': 'Order number',
  'auth.lookup': 'Find order',

  'common.back': 'Back',
  'common.total': 'Total',
  'common.date': 'Date',
  'common.status': 'Status',
  'common.items': 'Items',
  'common.quantity': 'Quantity',
  'common.save': 'Save',
  'common.loading': 'Loading…',
  'common.updated': 'Last updated',
}

const DICTS: Record<Locale, Dict> = { el: EL, en: EN }

export type Translator = (key: keyof typeof EL | string) => string

/**
 * Returns a lookup for the given locale.
 *
 * A missing key returns the Greek string, then the key itself. It never throws
 * and never renders empty: a missing translation should look like an untranslated
 * label, not like a broken page.
 */
export function translator(locale: Locale): Translator {
  const dict = DICTS[locale] ?? EL
  return key => dict[key] ?? EL[key] ?? key
}

/** Order status names, shared by the account pages. */
export const ORDER_STATUS: Record<Locale, Record<string, string>> = {
  el: {
    pending: 'Εκκρεμεί πληρωμή',
    processing: 'Σε επεξεργασία',
    'on-hold': 'Σε αναμονή',
    completed: 'Ολοκληρωμένη',
    cancelled: 'Ακυρωμένη',
    refunded: 'Επιστροφή χρημάτων',
    failed: 'Απέτυχε',
    trash: 'Διαγραμμένη',
  },
  en: {
    pending: 'Awaiting payment',
    processing: 'Processing',
    'on-hold': 'On hold',
    completed: 'Completed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    failed: 'Failed',
    trash: 'Deleted',
  },
}
