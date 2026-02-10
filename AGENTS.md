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
- `niebocross_registrations` stores contact info with `contact_person` column
- `niebocross_participants_v2` stores individual participant data with `first_name` and `last_name` columns
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

## Project-Specific Patterns

### Authentication Confirmation

This project uses a dual-layer authentication system for the NieboCross feature:

1. **Client-Side Cookie Check**: A `niebocross_auth_status=true` cookie is set upon successful login (via `/api/niebocross/auth/verify-code`). This cookie is used for quick client-side checks to avoid unnecessary API calls and provide immediate UI feedback.

2. **Server-Side JWT Verification**: The actual authentication is handled via JWT tokens stored in an HttpOnly `niebocross_session` cookie. Server endpoints (like `/api/niebocross/dashboard`) use `verifyToken()` from `api/niebocross/utils/auth.js` to validate the JWT and extract the `registration_id`.

3. **Dashboard API Verification**: Protected endpoints like `/api/niebocross/dashboard` perform JWT verification server-side. If the token is invalid, they return 401, triggering a redirect to login.

**Usage Guidelines**:
- Use the cookie for initial UI state checks and quick redirects.
- Protected API endpoints handle JWT verification automatically.
- No separate status endpoint is needed since dashboard APIs verify tokens.

**Security Note**: The `niebocross_auth_status` cookie is not HttpOnly and can be manipulated client-side, so always rely on server-side JWT verification for sensitive operations.

### More files to follow

[openspec/AGENTS.md](openspec/AGENTS.md)

## Deployment Architecture

This project uses **Static Site Generation (SSG) only** with ZERO Server-Side Rendering:

- **Frontend**: Astro v4.15.3 with static generation
- **Deployment**: Vercel static hosting + Vercel API functions
- **No SSR**: All pages must be pre-rendered at build time
- **API**: Serverless functions in `/api/` directory handle backend operations
- **Client-side only**: No `export const prerender = false;` allowed

**Critical Constraint**: Never add SSR dependencies or configurations. All dynamic functionality must work within static generation paradigm using client-side JavaScript and API calls.