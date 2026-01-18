# Project Context

## Purpose
Website for ZATYRANI GRATISOWNIA.PL GMINA PILCHOWICE - a running and Nordic Walking association in Poland. The site serves as:
- Information hub for trainings, events, and initiatives
- Member registration and authentication system
- Event management platform for organizers
- Charity event promotion (NieboCross, Wilczy Półmaraton)
- Community showcase and news updates

## Tech Stack
- **Frontend Framework**: Astro v4.15.3 (Static Site Generation)
- **Styling**: Tailwind CSS v3.4.1
- **Language**: TypeScript with strict mode
- **Package Manager**: npm
- **Runtime**: Node.js
- **Deployment**: Vercel (with serverless functions in `/api`)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Custom SMS-based auth with Twilio
- **Testing**: Vitest v4.0.2
- **Linting**: ESLint v9 with TypeScript & Astro plugins
- **Formatting**: Prettier with Astro plugin
- **Git Hooks**: Husky + lint-staged
- **Additional Libraries**:
  - Octokit (GitHub API for fetching Facebook events)
  - Satori + @resvg/resvg-js (OG image generation)
  - React v19 (for OG image generation only)

## Project Conventions

### Code Style
- **Formatting**: Prettier with automatic formatting on commit
- **Linting**: ESLint with TypeScript and Astro rules
- **Component Naming**: 
  - Import components with `Content` suffix to avoid Astro implicit naming conflicts (e.g., `import NieboCrossContent from "../components/content/NieboCross.astro"`)
  - Component files use PascalCase (e.g., `EventCard.astro`, `TrainingForm.astro`)
- **File Organization**:
  - Page components in `/src/pages/` with bilingual support (`/en/` subdirectory for English)
  - Reusable components in `/src/components/`
  - Content-specific components in `/src/components/content/`
  - API endpoints in `/api/` (Vercel serverless functions)
  - Scripts in `/scripts/`
  - Utilities in `/src/utils/`
- **No trailing slashes**: URLs configured with `trailingSlash: "never"` in Astro config
- **Type Safety**: TypeScript strict mode, no `any` types where possible

### Architecture Patterns
- **Static Site Generation (SSG)**: Build-time rendering for performance
- **Islands Architecture**: Astro's partial hydration approach
- **Component-Based**: Reusable Astro components with props
- **Serverless API**: Vercel functions for backend operations (CRUD for events/trainings)
- **Authentication Middleware**: Route protection via custom middleware at `/middleware.ts`
- **Translation System**: Build-time i18n with JSON files in `/public/locales/{pl,en}/translation.json`
- **Protected Routes**: 
  - `/trening-dodaj`, `/wydarzenia-dodaj` (add forms)
  - `/trening-edytuj/*`, `/wydarzenia-edytuj/*` (edit forms)
  - Authentication required via session cookies
- **DRY Principle**: Shared components extracted to avoid duplication

### Testing Strategy
- **Framework**: Vitest v4.0.2
- **Test Files**: Located in `/test/` directory
- **Tested Areas**: API endpoints (add-event, add-training, delete-event, update-event)
- **Commands**: 
  - `npm test` - run once
  - `npm run test:watch` - watch mode
- **Coverage**: Focus on serverless API functions

### Git Workflow
- **Pre-commit Hooks**: Husky + lint-staged
  - Auto-run ESLint fix
  - Auto-run Prettier
  - Stage fixed files
- **Commit Pattern**: Standard git workflow
- **Branch Strategy**: Feature branches (e.g., `opisleczenia` for content updates)
- **Ignored Files**: `dist/`, `src/pages/rajdnw.astro` (parsing issues)

## Domain Context
- **Association Name**: Stowarzyszenie ZATYRANI GRATISOWNIA.PL GMINA PILCHOWICE
- **Primary Activities**: 
  - Running trainings (bieg)
  - Nordic Walking (kije/kijki)
  - Ice swimming (morsowanie)
- **Key Events**:
  - **NieboCross**: Charity run/Nordic Walk in Nieborowice (April 12, 2026) - 3+ km and 9+ km routes, 100% proceeds to OTOZ Animals Inspektorat Gliwice
  - **Wilczy Półmaraton**: Half marathon in Wilcza (October) - ~22km forest trails
  - Kids championship in Pilchowice (September)
- **Target Audience**: Local community in Gmina Pilchowice, runners, Nordic Walking enthusiasts
- **Bilingual**: Polish (primary) and English
- **Member Management**: PostgreSQL database with scripts for add/remove/list
- **Charity Focus**: Animal rescue through OTOZ Animals (NieboCross event)

## Important Constraints
- **SEO**: Trailing slash redirect handled via Vercel config
- **Mobile-First**: Tailwind responsive design (grid-cols-1 sm:grid-cols-2 pattern)
- **Performance**: Static generation for fast load times
- **Translation Keys**: Must be added to both `/public/locales/pl/translation.json` and `/public/locales/en/translation.json`
- **Component Naming**: Import names must differ from Astro's implicit declarations to avoid TypeScript conflicts
- **Session Management**: Cookie-based sessions for authenticated routes
- **Content Warnings**: Sensitive images (e.g., animal rescue photos) require blur effect with click-to-reveal
- **Responsive Images**: Use `grid-cols-1 sm:grid-cols-2` for mobile stacking, side-by-side on desktop

## External Dependencies
- **Supabase**: PostgreSQL database for members, events, trainings
- **Twilio**: SMS-based authentication (code verification)
- **GitHub API**: Fetch Facebook event data via Octokit
- **Vercel**: Hosting and serverless functions
- **OTOZ Animals Inspektorat Gliwice**: Charity partner for NieboCross event
- **External Images**: Animal rescue photos in `/public/niebocross/`
- **Facebook Events**: Archived in `/public/facebook/{timestamp}/` directories
- **Social Links**: Facebook, YouTube channels for association
- **External Links**: TVN program links, partner website (Gratisownia.pl)
