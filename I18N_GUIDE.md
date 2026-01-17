# i18n Implementation Guide

## ✅ What's been set up:

1. **Translation files**: 
   - `/public/locales/pl/translation.json` (Polish - default)
   - `/public/locales/en/translation.json` (English)
2. **Translation helper**: 
   - `/src/utils/i18n.ts` - Simple build-time translation function
3. **Components**:
   - `LanguageSwitcher.astro` - PL/EN toggle in header (with localStorage)
4. **Page structure**:
   - Polish pages: `/src/pages/*.astro` (e.g., `/niebocross`)
   - English pages: `/src/pages/en/*.astro` (e.g., `/en/niebocross`)

## 🚀 How to use in your pages:

### 1. For Polish pages (root level):

```astro
---
import Layout from "../layouts/Layout.astro";
import { t } from "../utils/i18n";

// t() defaults to Polish
---

<Layout title={t("page.title")} description={t("page.description")}>
  <h1>{t("page.heading")}</h1>
  <p>{t("page.content")}</p>
</Layout>
```

### 2. For English pages (/en/ folder):

```astro
---
import Layout from "../../layouts/Layout.astro";
import { t as tBase } from "../../utils/i18n";

// Helper that defaults to English
const t = (key: string) => tBase(key, 'en');
---

<Layout title={t("page.title")} description={t("page.description")}>
  <h1>{t("page.heading")}</h1>
  <p>{t("page.content")}</p>
</Layout>
```

### 3. Using shared content components (DRY pattern):

For pages with identical structure in both languages, create a shared content component:

```astro
// src/components/PageContent.astro
---
interface Props {
  t: (key: string) => string;
}
const { t } = Astro.props;
---

<section>
  <h1>{t("page.title")}</h1>
  <p>{t("page.description")}</p>
  <!-- All your page HTML here -->
</section>
```

Then use it in both language versions:

```astro
// Polish: src/pages/page.astro
---
import Layout from "../layouts/Layout.astro";
import PageContent from "../components/PageContent.astro";
import { t } from "../utils/i18n";
---
<Layout title={t("page.title")}>
  <PageContent t={t} />
</Layout>

// English: src/pages/en/page.astro
---
import Layout from "../../layouts/Layout.astro";
import PageContent from "../../components/PageContent.astro";
import { t as tBase } from "../../utils/i18n";
const t = (key: string) => tBase(key, 'en');
---
<Layout title={t("page.title")}>
  <PageContent t={t} />
</Layout>
```

**Benefits:**
- ✅ Single source of truth for HTML/CSS
- ✅ Easy maintenance - update once, applies everywhere
- ✅ Reduces duplication from ~400 lines to ~10 per page
- ✅ Type-safe with TypeScript Props

### 4. How it works:

- **Build time translation**: The `t()` function loads translations from JSON files during Astro's SSG build
- **No runtime dependencies**: All text is baked into static HTML
- **Language switcher**: Automatically detects language from URL path (`/en/*` = English, everything else = Polish)
- **localStorage**: Remembers user's language preference across visits

## 📁 File Structure:

```
/public/locales/
  pl/
    translation.json    # Polish translations
  en/
    translation.json    # English translations
/src/
  utils/
    i18n.ts            # Build-time translation helper
  components/
    LanguageSwitcher.astro  # PL/EN switcher in header
  pages/
    niebocross.astro   # Polish version
    en/
      niebocross.astro # English version
```

## 🔑 Translation Keys Structure:

Organize keys by namespace for better maintainability:

```json
{
  "nav": {
    "home": "Home",
    "about": "About"
  },
  "common": {
    "register": "Register",
    "email": "email@example.com"
  },
  "pagename": {
    "title": "Page Title",
    "description": "Page description"
  }
}
```

## 🎯 Best Practices:

1. **Keep structure identical** in pl and en JSON files
2. **Use meaningful key names** like `niebocross.charity_goal` not `text1`
3. **Namespace by page/section** to avoid conflicts
4. **Test both languages** during development

## ⚠️ Important Notes:

- This is a **static site** - translations happen at build time, not runtime
- Each language needs its own page file (e.g., `page.astro` and `en/page.astro`)
- The `LanguageSwitcher` is in the main Layout header, visible on all pages
- Language detection is URL-based: `/en/*` = English, everything else = Polish

```
src/pages/
  index.astro              (Polish - root level)
  niebocross.astro         (Polish - root level)
  wilczy-polmaraton.astro  (Polish - root level)
  en/
    index.astro            (English)
    niebocross.astro       (English)
    wolf-half-marathon.astro (English - custom route name)
```

## 🌐 How it works:

- **Polish (default)**: No prefix in URL → `zatyrani.pl/niebocross`
- **English**: `/en/` prefix → `zatyrani.pl/en/niebocross`
- **Browser detection**: Automatically redirects based on browser language preferences
- **Language switcher**: Users can manually switch between PL and EN

## 📝 Adding new translations:

Add keys to both translation files:

**`public/locales/pl/translation.json`:**
```json
{
  "your_section": {
    "title": "Twój tytuł",
    "description": "Twój opis"
  }
}
```

**`public/locales/en/translation.json`:**
```json
{
  "your_section": {
    "title": "Your title",
    "description": "Your description"
  }
}
```