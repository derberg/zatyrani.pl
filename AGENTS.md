<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## Project Guidelines

### Database Schema

See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) for the complete NieboCross database structure.

**Key points:**
- `niebocross_registrations` stores contact info with `contact_person` column (not `full_name`)
- `niebocross_participants` stores individual participant data with `full_name` column
- One registration can have multiple participants
- One payment per registration (unique constraint)

### Internationalization (i18n)

Follow the patterns documented in [I18N_GUIDE.md](I18N_GUIDE.md) for all translation work:
- Use `t()` function from `src/utils/i18n.ts` for build-time translations
- Polish pages at root level, English pages under `/en/`
- Keep translation keys in sync between `public/locales/pl/translation.json` and `public/locales/en/translation.json`
- For client-side scripts, use Astro's `define:vars` to pass translations at build time
- Create shared content components for pages with identical structure:
  - Component receives `t` function as prop: `interface Props { t: (key: string) => string; }`
  - Polish page passes `t` directly, English page wraps it: `const t = (key: string) => tBase(key, 'en');`
  - This reduces duplication and maintains a single source of truth for HTML/CSS