# Instructions for Claude AI Assistant

⚠️ **IMPORTANT: Read this file at the start of every conversation and before making significant changes.**

## Project Guidelines

All project-specific guidelines, patterns, and conventions are documented in:

**[AGENTS.md](AGENTS.md)**

This file contains:
- Database schema references
- Code organization patterns
- Authentication patterns
- Internationalization (i18n) guidelines
- Project-specific conventions

## Key Reminders

1. **Always check AGENTS.md** before:
   - Making database changes
   - Implementing new features
   - Refactoring existing code
   - Working with authentication
   - Adding translations

2. **Avoid code duplication**:
   - Look for existing utilities and helpers
   - Extract shared logic into utility files
   - Reuse existing components and patterns

3. **Follow existing patterns**:
   - Match the coding style of the file you're editing
   - Use the same naming conventions
   - Follow the established project structure

4. **Database Schema**:
   - Always reference [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)
   - Use correct column names (e.g., `contact_person` not `full_name` in registrations table)
   - Respect foreign key relationships and constraints

5. **Internationalization**:
   - Follow [I18N_GUIDE.md](I18N_GUIDE.md)
   - Keep Polish (pl) and English (en) translations in sync
   - Use shared content components when possible

## Before Starting Any Task

1. ✅ Read AGENTS.md
2. ✅ Check relevant schema/guide files
3. ✅ Look for existing similar code to reuse
4. ✅ Understand the existing patterns
5. ✅ Plan before implementing

## Questions?

If unsure about:
- Project conventions → Check AGENTS.md
- Database structure → Check DATABASE_SCHEMA.md
- Translation patterns → Check I18N_GUIDE.md
- Anything else → Ask the user before proceeding
