# Proposal 001: NieboCross Registration & Payment System

**Status:** Approved  
**Created:** 2026-01-18  
**Approved:** 2026-01-18  
**Author:** System  
**Relates to:** NieboCross charity event (April 12, 2026)

## Problem Statement

Currently, the NieboCross event page lacks a registration and payment system. Potential participants cannot register online, pay for their race entry, or purchase event t-shirts. The organization has no digital system to manage registrations, track payments, or communicate with participants.

## Proposed Solution

Implement a comprehensive registration and payment system for NieboCross that includes:
- Self-service registration with multi-participant support
- Email-based authentication for participants
- Smart form UI with autocomplete suggestions
- Integration with SIBS payment gateway
- Public registration list view
- Email notifications and payment link generation

## Detailed Design

### 1. Database Schema (Supabase)

#### Table: `niebocross_registrations`
**Purpose:** Stores the main registration record for each person who initiates a registration. One registrant can register multiple participants (themselves and/or others). This table captures who is making the registration and is responsible for payment. Only contact information is stored here - if the registrant is also participating, their full participant details go into the participants table.

**Key relationships:** One registration can have many participants. Email is used for authentication and communication.

```sql
CREATE TABLE niebocross_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_niebocross_registrations_email ON niebocross_registrations(email);
```

#### Table: `niebocross_participants`
**Purpose:** Stores actual event participants (runners/walkers). Each row represents one person who will participate in the event. A single registration can include multiple participants - for example, a parent registering their whole family.

**Key relationships:** Links to `niebocross_registrations` via `registration_id`. This is the table displayed on the public registration list.


```sql
CREATE TABLE niebocross_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL REFERENCES niebocross_registrations(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  birth_date DATE NOT NULL,
  city VARCHAR(255) NOT NULL,
  nationality VARCHAR(3) NOT NULL, -- ISO 3166-1 alpha-3
  club VARCHAR(255), -- Optional
  race_category VARCHAR(20) NOT NULL CHECK (race_category IN ('3km_run', '3km_nw', '9km_run', '9km_nw', 'kids_100m', 'kids_300m')),
  hide_name_public BOOLEAN DEFAULT FALSE,
  tshirt_size VARCHAR(10), -- NULL if no t-shirt, or 'XS', 'S', 'M', 'L', 'XL', 'XXL'
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  rodo_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_niebocross_participants_registration ON niebocross_participants(registration_id);
CREATE INDEX idx_niebocross_participants_race_category ON niebocross_participants(race_category);
```

#### Table: `niebocross_payments`

**Purpose:** Maintains a list of running/walking clubs for autocomplete functionality. As participants register and enter their club names, new clubs are automatically added. This builds a database of clubs over time, making registration faster for future participants from the same clubs.

**Key relationships:** Referenced by participants but not enforced as foreign key (club field is free text with suggestions).


```sql
CREATE TABLE niebocross_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL REFERENCES niebocross_registrations(id) ON DELETE CASCADE,
  total_amount DECIMAL(10, 2) NOT NULL,
  race_fees DECIMAL(10, 2) NOT NULL,
  tshirt_fees DECIMAL(10, 2) NOT NULL,
  charity_amount DECIMAL(10, 2) NOT NULL, -- Calculated: race_fees + (tshirt_fees * 10/80)
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_link VARCHAR(500), -- SIBS payment URL
  sibs_transaction_id VARCHAR(255),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_niebocross_payments_registration ON niebocross_payments(registration_id);
CREATE INDEX idx_niebocross_payments_status ON niebocross_payments(payment_status);
```

#### Table: `niebocross_clubs`



```sql
CREATE TABLE niebocross_clubs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_niebocross_clubs_name ON niebocross_clubs(name);
```

#### Table: `niebocross_auth_codes`

**Purpose:** Temporary storage for email verification codes. When a registrant wants to log in to their dashboard, they request a code which is sent to their email. This table stores the code and tracks whether it's been used and when it expires (10 minutes).

**Key relationships:** Links to registrants via email address. Codes are automatically cleaned up after expiration or use.

```sql
CREATE TABLE niebocross_auth_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_niebocross_auth_codes_email ON niebocross_auth_codes(email);
CREATE INDEX idx_niebocross_auth_codes_expires ON niebocross_auth_codes(expires_at);
```

### 2. API Endpoints (Vercel Functions)

#### `/api/niebocross/auth/start-registration.js`
**POST** - Create initial registration record and send verification code
```javascript
// Request body:
{
  email: "user@example.com",
  fullName: "Jan Kowalski",
  rodoAccepted: true
}

// Response:
{
  success: true,
  message: "Kod weryfikacyjny został wysłany na email."
}
```

**Logic:**
1. Validate email format
2. Check RODO acceptance
3. Check if email already exists in registrations - if yes, return error message instructing user to log in instead
4. Create registration record (email + full_name)
5. Generate 6-digit code
6. Store in `niebocross_auth_codes` with 10-min expiry
7. Send code via email (Twilio SendGrid)
8. Return success

#### `/api/niebocross/register.js`
**POST** - Add participants and create payment (requires authentication)
```javascript
// Headers:
Authorization: Bearer <jwt-token>

// Request body:
{
  participants: [
    {
      fullName: "Jan Kowalski", // Pre-filled if registrant is participating
      birthDate: "1990-05-15",
      city: "Gliwice",
      nationality: "POL",
      club: "Zatyrani", // optional
      raceCategory: "9km_run", // '3km_run', '3km_nw', '9km_run', '9km_nw', 'kids_100m', 'kids_300m'
      hideNamePublic: false,
      tshirtSize: "L", // optional, 'XS'-'XXL'
      termsAccepted: true
    }
  ]
}

// Response:
{
  success: true,
  registrationId: "uuid",
  paymentLink: "https://...",
  message: "Rejestracja utworzona. Link do płatności został wysłany na email."
}
```

**Logic:**
1. Verify JWT token and get registration_id from token
2. Validate all required fields
3. Check age restrictions based on birthDate and raceCategory
4. Create participant records linked to registration_id
5. Calculate payment amount (race fees + t-shirt fees)
6. Create payment record with 'pending' status
7. Generate SIBS payment link
8. Send email with payment link via Twilio SendGrid
9. Return success response with payment link

#### `/api/niebocross/auth/request-code.js`
**POST** - Request email verification code (for returning users)
```javascript
// Request body:
{
  email: "user@example.com"
}

// Response:
{
  success: true,
  message: "Kod weryfikacyjny został wysłany na email."
}
```

**Logic:**
1. Validate email exists in registrations (for returning users)
2. Generate 6-digit code
3. Store in `niebocross_auth_codes` with 10-min expiry
4. Send code via email (Twilio SendGrid)
5. Return success

#### `/api/niebocross/auth/verify-code.js`
**POST** - Verify code and create session
```javascript
// Request body:
{
  email: "user@example.com",
  code: "123456"
}

// Response:
{
  success: true,
  sessionToken: "jwt-token",
  registration: {
    id: "uuid",
    email: "user@example.com",
    fullName: "Jan Kowalski"
  }
}
```

**Logic:**
1. Verify code is valid and not expired
2. Mark code as used
3. Get registration record by email
4. Generate JWT session token (valid 180 days) with registration_id in payload
5. Set HTTP-only cookie
6. Return session token and registration details

#### `/api/niebocross/auth/logout.js`
**POST** - Clear session

#### `/api/niebocross/dashboard.js`
**GET** - Get participant dashboard data (requires auth)
```javascript
// Response:
{
  registration: {
    id: "uuid",
    email: "user@example.com",
    fullName: "Jan Kowalski",
    participants: [
      {
        id: "uuid",
        fullName: "Jan Kowalski",
        birthDate: "1990-05-15",
        city: "Gliwice",
        nationality: "POL",
        club: "Zatyrani",
        raceCategory: "9km_run",
        hideNamePublic: false,
        tshirtSize: "L",
        termsAccepted: true,
        rodoAccepted: true
      }
    ],
    payment: {
      totalAmount: 140,
      raceFees: 60,
      tshirtFees: 80,
      charityAmount: 70,
      status: "pending",
      paymentLink: "https://...",
      paidAt: null
    },
    canEdit: true // false if payment.status === 'paid' OR current date >= event date (April 12, 2026)
  }
}
```

**Note:** The `canEdit` flag determines whether the user can add, edit, or delete participants. It is `false` when:
- Payment status is 'paid' (user has already completed payment)
- Event date has passed or is today (April 12, 2026)

Once payment is completed, participants must contact the organizer for any changes. All contact information is available at `/niebocross#kontakt`.

#### `/api/niebocross/update-participant.js`
**PUT** - Update participant details (requires auth)
```javascript
// Headers:
Authorization: Bearer <jwt-token>

// Request body:
{
  participantId: "uuid",
  fullName: "Jan Kowalski",
  birthDate: "1990-05-15",
  city: "Gliwice",
  nationality: "POL",
  club: "Zatyrani",
  raceCategory: "9km_run",
  hideNamePublic: false,
  tshirtSize: "XL" // Updated
}

// Response:
{
  success: true,
  participant: {...},
  payment: {
    totalAmount: 140, // Recalculated if race/tshirt changed
    paymentLink: "https://..." // New link if amount changed
  },
  message: "Dane uczestnika zaktualizowane"
}
```

**Logic:**
1. Verify JWT token and get registration_id
2. Verify participant belongs to this registration
3. Check payment status - if payment is 'paid', return error with link to contact section (see translation key: `edit_blocked_payment_completed`)
4. Check if event has started - if yes, return error: "Nie możesz edytować uczestnika po rozpoczęciu wydarzenia."
5. Validate all fields (age restrictions, required fields)
6. Update participant record
7. Recalculate payment amount if race category or t-shirt changed
8. If payment amount changed and payment is pending:
   - Update payment record
   - Generate new payment link
   - Send email with updated payment link
9. Return success with updated data

#### `/api/niebocross/delete-participant.js`
**DELETE** - Remove participant from registration (requires auth)
```javascript
// Headers:
Authorization: Bearer <jwt-token>

// Request body:
{
  participantId: "uuid"
}

// Response:
{
  success: true,
  payment: {
    totalAmount: 80, // Recalculated
    paymentLink: "https://..." // New link
  },
  message: "Uczestnik usunięty"
}
```

**Logic:**
1. Verify JWT token and get registration_id
2. Verify participant belongs to this registration
3. Check payment status - if payment is 'paid', return error with link to contact section (see translation key: `delete_blocked_payment_completed`)
4. Check if event has started - if yes, return error: "Nie możesz usunąć uczestnika po rozpoczęciu wydarzenia."
5. Check minimum 1 participant remains after deletion
6. Delete participant record (CASCADE from database)
7. Recalculate payment amount
8. Update payment record and generate new link
9. Send email with updated payment link
10. Return success

#### `/api/niebocross/registrations/list.js`
**GET** - Public list of registrations
```javascript
// Response:
{
  registrations: [
    {
      fullName: "Jan Kowalski", // or "Anonim" if hideNamePublic
      city: "Gliwice",
      nationality: "POL",
      club: "Zatyrani",
      raceCategory: "9km_run"
    }
  ]
}
```

#### `/api/niebocross/clubs/search.js`
**GET** - Search clubs by name
```javascript
// Query: ?q=zaty

// Response:
{
  clubs: ["Zatyrani", "Zatyrani Gratisownia.pl"]
}
```

#### `/api/niebocross/payment/webhook.js`
**POST** - SIBS payment webhook
- Verify webhook signature
- Update payment status
- Send confirmation email

### 3. Frontend Pages

#### `/src/pages/niebocross/rejestracja.astro`
**New Page** - Registration form

**Features:**
- **Auth check:** If user already has valid JWT session token (is logged in), redirect to `/niebocross/panel` instead of showing registration form
- Page header section:
  - NieboCross logo/title
  - Event date: "12 kwietnia 2026"
  - Event location: "Nieborowice"
  - Brief tagline: "Bieg Charytatywny / Charity Run"
  - Breadcrumb or back link to main NieboCross page
- Multi-step wizard UI
- Step 1: Authentication (email verification first)
  - Email address
  - Full name
  - RODO acceptance checkbox
  - Button: "Dołącz do wydarzenia" (Join the event)
  - On click → Send verification code via email
  - Code input field appears
  - "Didn't receive code? Resend" button (enabled after 1 minute)
  - Enter code → Authenticated for 180 days
- Step 2: Participant selection
  - Question: "Are you registering yourself or someone else?"
    - If "Myself" → first participant form pre-fills full name
    - If "Someone else" → first participant form is blank
- Step 3: Add participants (repeatable form)
  - Full name (pre-filled if registrant is participating)
  - Birth date (date picker with age validation)
  - City (autocomplete using REST Countries API or manual entry)
  - Nationality (dropdown with POL default, searchable)
  - Club (autocomplete from database)
  - Race category selector (3km Run, 3km NW, 9km Run, 9km NW, Kids 100m, Kids 300m)
  - T-shirt size selector (optional)
  - Privacy checkbox (hide name from public list)
  - Terms acceptance checkbox
  - Button at bottom: "Add another participant"
- Step 4: Summary with total cost breakdown
- Form validation with clear error messages
- Responsive mobile design
- Can save and return later (already authenticated)

**Translation Keys:**
```json
{
  "niebocross_common": {
    "header_title": "NieboCross 2026",
    "header_subtitle": "Bieg Charytatywny",
    "event_date": "12 kwietnia 2026",
    "event_location": "Nieborowice",
    "back_to_event": "Wróć do strony wydarzenia"
  },
  "niebocross_contact": {
    "section_title": "Kontakt",
    "email_label": "Email",
    "phone_label": "Telefon",
    "response_time": "Odpowiadamy w ciągu 24 godzin",
    "questions_title": "Pytania dotyczące rejestracji?",
    "payment_questions": "Problemy z płatnością?",
    "changes_after_payment": "Zmiany po opłaceniu rejestracji wymagają kontaktu z organizatorem",
    "contact_us": "Skontaktuj się z nami"
  },
  "niebocross_registration": {
    "page_title": "Rejestracja - NieboCross 2026",
    "already_registered_redirect": "Jesteś już zarejestrowany. Przekierowywanie do panelu...",
    "title": "Rejestracja na NieboCross 2026",
    "step1_title": "Dołącz do wydarzenia",
    "step2_title": "Wybierz uczestników",
    "step3_title": "Szczegóły uczestników",
    "step4_title": "Podsumowanie",
    "join_button": "Dołącz do wydarzenia",
    "join_explanation": "Otrzymasz kod weryfikacyjny na podany email",
    "email_already_exists": "Ten email jest już zarejestrowany. Użyj przycisku 'Zaloguj się' aby uzyskać dostęp do swojej rejestracji.",
    "code_label": "Kod weryfikacyjny",
    "code_sent": "Kod został wysłany na {email}",
    "verify_button": "Potwierdź kod",
    "resend_code": "Nie otrzymałeś kodu? Wyślij ponownie",
    "resend_code_wait": "Możesz wysłać ponownie za {seconds} sekund",
    "code_resent": "Kod został wysłany ponownie",
    "registering_who_question": "Kogo rejestrujesz?",
    "registering_myself": "Siebie",
    "registering_others": "Kogoś innego",
    "add_participant": "Dodaj kolejnego uczestnika",
    "email_label": "Adres email",
    "full_name_label": "Imię i nazwisko",
    "city_label": "Miasto",
    "nationality_label": "Narodowość",
    "club_label": "Klub (opcjonalne)",
    "birth_date_label": "Data urodzenia",
    "race_category_label": "Wybierz kategorię",
    "race_3km_run": "3+ km - Bieg (60 zł)",
    "race_3km_nw": "3+ km - Nordic Walking (60 zł)",
    "race_9km_run": "9+ km - Bieg (60 zł)",
    "race_9km_nw": "9+ km - Nordic Walking (60 zł)",
    "race_kids_100m": "Bieg dzieci 100m (20 zł)",
    "race_kids_300m": "Bieg dzieci 300m (20 zł)",
    "tshirt_label": "Koszulka pamiątkowa (opcjonalnie)",
    "tshirt_price": "80 zł (70 zł koszt produkcji + 10 zł na cel charytatywny)",
    "hide_name_label": "Nie publikuj mojego nazwiska na liście uczestników",
    "terms_label": "Akceptuję regulamin wydarzenia",
    "rodo_label": "Wyrażam zgodę na przetwarzanie danych osobowych (RODO)",
    "charity_note": "100% wpłat za starty trafia na cel charytatywny",
    "summary_total": "Do zapłaty łącznie",
    "summary_charity": "W tym na cel charytatywny",
    "submit": "Zarejestruj i otrzymaj link do płatności",
    "age_restriction_adult": "Minimalny wiek dla tras 3km i 9km to 16 lat",
    "age_restriction_kids": "Biegi dzieci dla uczestników do 14 lat"
  },
  "niebocross_login": {
    "page_title": "Logowanie - NieboCross 2026",
    "title": "Zaloguj się do panelu",
    "description": "Panel dla zarejestrowanych uczestników",
    "new_user_prompt": "Nie masz jeszcze konta?",
    "register_link": "Zarejestruj się na wydarzenie"
  },
  "niebocross_list": {
    "page_title": "Lista Uczestników - NieboCross 2026",
    "title": "Lista Zarejestrowanych Uczestników",
    "total_participants": "Łącznie uczestników",
    "filter_by_category": "Filtruj według kategorii",
    "search_placeholder": "Szukaj po nazwisku, mieście lub klubie",
    "no_results": "Brak wyników"
  },
  "niebocross_dashboard": {
    "title": "Moja Rejestracja - NieboCross 2026",
    "registration_details": "Szczegóły rejestracji",
    "registrant_email": "Email",
    "registrant_name": "Imię i nazwisko",
    "participants_title": "Zarejestrowani uczestnicy",
    "participant_details": "Szczegóły uczestnika",
    "edit_participant": "Edytuj",
    "delete_participant": "Usuń",
    "add_participant": "Dodaj kolejnego uczestnika",
    "confirm_delete": "Czy na pewno chcesz usunąć tego uczestnika? Kwota płatności zostanie przeliczona.",
    "payment_section": "Płatność",
    "payment_status_pending": "Oczekuje na płatność",
    "payment_status_paid": "Opłacone",
    "payment_status_failed": "Płatność nieudana",
    "payment_total": "Łącznie do zapłaty",
    "payment_race_fees": "Wpis startowy",
    "payment_tshirt_fees": "Koszulki",
    "payment_charity": "Przekazane na cel charytatywny",
    "payment_date": "Data płatności",
    "pay_now_button": "Przejdź do płatności",
    "download_receipt": "Pobierz potwierdzenie",
    "editing_disabled_paid": "Edycja niemożliwa - płatność została już zrealizowana. W razie potrzeby zmian <a href='/niebocross#kontakt'>skontaktuj się z organizatorem</a>.",
    "editing_disabled_event": "Edycja niemożliwa - wydarzenie już się rozpoczęło.",
    "logout": "Wyloguj",
    "update_success": "Dane uczestnika zaktualizowane",
    "delete_success": "Uczestnik usunięty",
    "payment_recalculated": "Kwota płatności została przeliczona. Nowy link został wysłany na email.",
    "minimum_participant_error": "Nie możesz usunąć ostatniego uczestnika. Rejestracja musi zawierać co najmniej jednego uczestnika.",
    "edit_blocked_payment_completed": "Nie możesz edytować uczestnika po opłaceniu rejestracji. <a href='/niebocross#kontakt'>Skontaktuj się z organizatorem</a>.",
    "delete_blocked_payment_completed": "Nie możesz usunąć uczestnika po opłaceniu rejestracji. <a href='/niebocross#kontakt'>Skontaktuj się z organizatorem</a>.",
    "edit_blocked_event_started": "Nie możesz edytować uczestnika po rozpoczęciu wydarzenia.",
    "delete_blocked_event_started": "Nie możesz usunąć uczestnika po rozpoczęciu wydarzenia."
  }
}
```

#### `/src/pages/niebocross/zaloguj.astro`
**New Page** - Participant login

**Features:**
- Page header section:
  - NieboCross logo/title
  - Event date: "12 kwietnia 2026"
  - Event location: "Nieborowice"
  - Brief tagline: "Bieg Charytatywny / Charity Run"
  - Breadcrumb or back link to main NieboCross page
- Email input
- Code verification (similar to existing member login)
- Clear indication this is for registered participants only
- Link to registration page for new users

#### `/src/pages/niebocross/panel.astro`
**New Page** - Participant dashboard (requires auth)

**Features:**
- Page header section:
  - NieboCross logo/title
  - Event date: "12 kwietnia 2026"
  - Event location: "Nieborowice"
  - Brief tagline: "Bieg Charytatywny / Charity Run"
  - Breadcrumb or back link to main NieboCross page
- Display registration details (email, registrant name)
- List all participants with full details
- Edit participant button for each participant (only visible if canEdit=true)
- Delete participant button (only visible if canEdit=true and >1 participant)
- Add another participant button (only visible if canEdit=true)
- Payment status indicator with details:
  - Total amount breakdown (race fees, t-shirt fees, charity amount)
  - Payment status (pending/paid/failed)
  - Payment link button (if pending)
  - Payment date (if paid)
- Download receipt button (if paid)
- Warning message if editing disabled (payment completed or event started)
- Logout button
- Responsive design with expandable participant cards on mobile

#### `/src/pages/niebocross/lista-uczestnikow.astro`
**New Page** - Public registration list

**Features:**
- Page header section:
  - NieboCross logo/title
  - Event date: "12 kwietnia 2026"
  - Event location: "Nieborowice"
  - Brief tagline: "Bieg Charytatywny / Charity Run"
  - Breadcrumb or back link to main NieboCross page
- Table/card view of registered participants
- Columns: Name (or "Anonim"), City, Nationality, Club, Race Category
- Filter by race category
- Search functionality
- Counter: total registrations and by race category
- Responsive design
- Real-time updates (fetch on load)

#### `/src/components/NieboCrossHeader.astro`
**New Component** - Shared header for all NieboCross subpages

**Features:**
- NieboCross logo/title with link to main event page
- Event date: "12 kwietnia 2026"
- Event location: "Nieborowice" 
- Brief tagline: "Bieg Charytatywny / Charity Run"
- Breadcrumb navigation
- Responsive design
- Translation support

**Usage:** Import and use in rejestracja.astro, zaloguj.astro, panel.astro, lista-uczestnikow.astro

#### `/src/components/NieboCrossRegistrationButton.astro`
**New Component** - Replace "Zapisz się (wkrótce)" button

**Features:**
- Link to `/niebocross/rejestracja`
- Prominent CTA styling
- Translation support

#### Update `/src/pages/niebocross.astro`
**Modifications:**
- **Feature Flag Implementation:** All new registration-related UI elements should only be visible when URL contains query parameter `?registration=true`
  - Check in Astro component: `const showRegistration = Astro.url.searchParams.get('registration') === 'true'`
  - When flag is false: show original "Zapisz się (wkrótce)" button
  - When flag is true: show active registration functionality
- **Registration button** (visible only if `showRegistration=true`):
  - If user NOT logged in: "Dołącz do wydarzenia" button linking to `/niebocross/rejestracja`
  - If user IS logged in: "Mój Panel" button linking to `/niebocross/panel`
- **Login/Logout button** (visible only if `showRegistration=true`):
  - If user NOT logged in: "Zaloguj się" button linking to `/niebocross/zaloguj`
  - If user IS logged in: "Wyloguj" button
- **Add link to public registration list** (visible only if `showRegistration=true`):
  - "Lista uczestników" linking to `/niebocross/lista-uczestnikow`
- Update registration info section
- **Add new section at bottom:** Contact section (`id="kontakt"`)
  - Section title: "Kontakt"
  - Organizer contact information:
    - Email: zatyrani@zatyrani.pl (or specific event email)
    - Phone: [phone number]
    - Response time: "Odpowiadamy w ciągu 24 godzin"
  - Social media links (if applicable)
  - Contact form option (optional)
  - Common questions with contact instructions

**Feature Flag Usage:**
- Testing URL: `https://zatyrani.pl/niebocross?registration=true`
- Production URL (after launch): `https://zatyrani.pl/niebocross` (remove flag or set to true by default in code)
- The registration pages (`/rejestracja`, `/zaloguj`, `/panel`, `/lista-uczestnikow`) are directly accessible regardless of flag - only the buttons on main page are controlled by the flag

### 4. UI Components

#### `CityAutocomplete.astro` / `CityAutocomplete.js`
- Client-side autocomplete
- Use REST Countries API or GeoNames API
- Fallback to manual entry
- Polish cities prioritized

#### `NationalitySelect.astro`
- Searchable dropdown
- POL as default/first option
- Use ISO 3166-1 alpha-3 codes
- Country flags (optional)

#### `ClubAutocomplete.astro` / `ClubAutocomplete.js`
- Client-side autocomplete
- Fetch from `/api/niebocross/clubs/search.js`
- Debounced search
- Add new club on-the-fly

#### `DatePicker.astro` / `DatePicker.js`
- Native date input with fallback
- Age validation logic
- Clear error messages

#### `RaceCategorySelector.astro`
- Radio buttons or dropdown for race category selection
- Six options: 3km Run, 3km NW, 9km Run, 9km NW, Kids 100m, Kids 300m
- Price display for each option
- Visual distinction between adult/kids races
- Charity note

#### `RegistrationSummary.astro`
- Breakdown of costs
- Total calculation
- Charity amount highlighting

### 5. Email Templates (Twilio SendGrid)

#### Registration Confirmation Email
```
Temat: Potwierdzenie rejestracji - NieboCross 2026

Witaj [Imię],

Dziękujemy za rejestrację na wydarzenie NieboCross 2026!

Zarejestrowani uczestnicy:
- [Imię Nazwisko 1] - [Dystans]
- [Imię Nazwisko 2] - [Dystans]

Do zapłaty: [Kwota] zł
(w tym [Kwota charytatywna] zł na cel charytatywny)

Aby dokończyć rejestrację, opłać udział klikając poniższy link:
[Link do płatności]

Link jest ważny przez 48 godzin.

Możesz sprawdzić status płatności i pobrać potwierdzenie logując się na:
https://zatyrani.pl/niebocross/panel

Do zobaczenia w Nieborowicach 12 kwietnia 2026!

--
Stowarzyszenie ZATYRANI
www.zatyrani.pl
```

#### Verification Code Email
```
Temat: Kod weryfikacyjny - NieboCross Panel

Twój kod weryfikacyjny: [123456]

Kod jest ważny przez 10 minut.

Jeśli nie próbowałeś się zalogować, zignoruj tę wiadomość.

--
Stowarzyszenie ZATYRANI
```

#### Payment Confirmation Email
```
Temat: Płatność potwierdzona - NieboCross 2026

Witaj [Imię],

Otrzymaliśmy Twoją płatność za rejestrację na NieboCross 2026!

Kwota: [Kwota] zł
Na cel charytatywny przekazano: [Kwota] zł

Dane uczestników:
- [Imię Nazwisko 1] - [Dystans]

Pobierz potwierdzenie: [Link]

Do zobaczenia w Nieborowicach!

--
Stowarzyszenie ZATYRANI
```

### 6. Integration: SIBS Payment Gateway

**Configuration:**
- API endpoint: `https://api.sibs.com` (production)
- Authentication: API key + merchant ID
- Integration type: Hosted payment page
- Webhook URL: `https://zatyrani.pl/api/niebocross/payment/webhook`

**Flow:**
1. Generate payment link via SIBS API
2. Store transaction ID in database
3. Redirect user to SIBS payment page
4. SIBS sends webhook on payment completion
5. Verify webhook signature
6. Update payment status
7. Send confirmation email

**Implementation notes:**
- Use `/api/niebocross/payment/create.js` to generate payment links
- Handle webhook in `/api/niebocross/payment/webhook.js`
- Store SIBS credentials in Vercel environment variables
- Implement retry logic for webhook failures

### 7. Security & Validation

**Age Restrictions:**
- Adult races (3km, 9km): Minimum age 16 years on event date (April 12, 2026)
- Kids races (100m, 300m): Maximum age 14 years on event date

**Email Verification:**
- Code expires after 10 minutes
- Rate limiting: Max 3 codes per email per hour (includes initial send and resends)
- Resend button enabled after 1 minute wait
- Mark codes as used after successful verification
- Email uniqueness enforced: one registration per email address
- Users with existing email must use login flow instead of creating new registration

**Session Management:**
- JWT tokens valid for 180 days
- HTTP-only secure cookies
- CSRF protection

**Input Validation:**
- Email format validation
- Date format validation
- Age range validation
- Required field checks
- SQL injection prevention (parameterized queries)

**Payment Security:**
- HTTPS only
- SIBS webhook signature verification
- Transaction ID validation
- Idempotency for webhook processing

### 8. Middleware Updates

Update `/middleware.ts` to protect participant dashboard:
```javascript
const participantProtectedPaths = [
  '/niebocross/panel',
];

// Check for niebocross session token
if (participantProtectedPaths.some(path => pathname.startsWith(path))) {
  // Verify JWT token from cookie
  // Redirect to /niebocross/zaloguj if invalid
}
```

### 9. Translation Updates

Add comprehensive translation keys to both:
- `/public/locales/pl/translation.json`
- `/public/locales/en/translation.json`

**New sections:**
- `niebocross_common.*` - Shared header and common elements
- `niebocross_contact.*` - Contact section
- `niebocross_registration.*` - Registration form
- `niebocross_login.*` - Participant login
- `niebocross_dashboard.*` - Participant dashboard
- `niebocross_list.*` - Public registration list
- `niebocross_email.*` - Email templates

## Implementation Plan

### Phase 1: Database & API Foundation (Week 1)
- [ ] Create Supabase migration scripts
- [ ] Implement API endpoints (register, auth, dashboard)
- [ ] Set up Twilio SendGrid for emails
- [ ] Create basic tests for API functions

### Phase 2: Registration Form UI (Week 2)
- [ ] Build multi-step registration form
- [ ] Implement city/nationality/club autocomplete
- [ ] Add date picker with age validation
- [ ] Create responsive design
- [ ] Add translation keys

### Phase 3: Authentication & Dashboard (Week 3)
- [ ] Build participant login page
- [ ] Implement email-based auth with codes
- [ ] Create participant dashboard
- [ ] Add payment link generation

### Phase 4: SIBS Payment Integration (Week 4)
- [ ] Integrate SIBS API
- [ ] Implement payment link generation
- [ ] Set up webhook handling
- [ ] Test payment flow end-to-end

### Phase 5: Public List & Polish (Week 5)
- [ ] Build public registration list page
- [ ] Add filtering and search
- [ ] Update NieboCross main page with new buttons
- [ ] UI/UX refinements
- [ ] Mobile testing

### Phase 6: Testing & Launch (Week 6)
- [ ] End-to-end testing
- [ ] Load testing
- [ ] Email template testing
- [ ] Security audit
- [ ] Soft launch with test registrations
- [ ] Public announcement

## Technical Considerations

**External APIs:**
- **REST Countries API** (`https://restcountries.com/v3.1/all`) - Free, no auth required
- **GeoNames** (optional fallback for cities) - Requires free account
- **Twilio SendGrid** - Already in use for SMS, add email support
- **SIBS Pay** - Payment gateway (pending access)

**Performance:**
- Cache nationality list in localStorage
- Debounce autocomplete searches (300ms)
- Lazy load registration list (pagination for 1000+ entries)
- Optimize SQL queries with proper indexes

**Accessibility:**
- ARIA labels for form fields
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support

**Mobile Experience:**
- Touch-friendly form controls
- Native date picker on mobile
- Simplified multi-step flow
- Payment link SMS option (in addition to email)

## Testing Strategy

### Manual Testing Only
All testing will be performed manually in production environment with feature flag enabled.

**Testing Checklist:**

**Registration Flow:**
- [ ] Complete new registration (single participant)
- [ ] Multi-participant registration (2-3 people)
- [ ] Email verification code received and works
- [ ] Resend code functionality
- [ ] Duplicate email prevention
- [ ] Age validation (adult races, kids races)
- [ ] Payment calculation correct
- [ ] Registration confirmation email received
- [ ] Payment link received and functional

**Dashboard & Editing:**
- [ ] Login with existing registration
- [ ] View dashboard with participants and payment status
- [ ] Edit participant details before payment
- [ ] Delete participant (with >1 participant)
- [ ] Cannot edit after payment completed
- [ ] Contact link works when editing disabled

**Public Features:**
- [ ] Public registration list displays correctly
- [ ] Filter by race category works
- [ ] Search functionality works
- [ ] Hidden names show as "Anonim"

**Mobile & Browser Testing:**
- [ ] Chrome desktop
- [ ] Safari iOS
- [ ] Chrome Android
- [ ] Mobile responsive (forms usable, buttons accessible)
- [ ] Email rendering on Gmail, Apple Mail

**Edge Cases:**
- [ ] Special characters in names (ąćęłńóśźż)
- [ ] Long names/club names
- [ ] Browser back button during registration
- [ ] Network interruption handling

## Rollback Plan

If critical issues arise post-launch:
1. Disable registration button (revert to "wkrótce")
2. Contact registered participants via email
3. Process registrations manually via database
4. Fix issues in development
5. Re-enable registration

## Success Metrics

- **Registration completion rate:** >80% (users who start form complete it)
- **Payment conversion rate:** >90% (registered users who pay within 48h)
- **Mobile usage:** Expect 60%+ registrations from mobile
- **Support tickets:** <5% of registrations require support
- **Page load time:** <3s for registration form
- **API response time:** <500ms for all endpoints

## Open Questions

1. **Age restrictions specifics:** Confirm exact age limits for each race category
2. **T-shirt sizes:** Final list of available sizes?
3. **SIBS account:** When will API access be available for integration?
4. **Registration deadline:** Last day to register before event?
5. **Refund policy:** How to handle cancellations/refunds?
6. **Maximum participants:** Is there a cap on total registrations?
7. **Group discounts:** Any special pricing for clubs/groups?

## Dependencies

**External Services:**
- Twilio SendGrid account with email sending enabled
- SIBS merchant account with API credentials
- Vercel environment variables for secrets

**Development Dependencies:**
```json
{
  "@sendgrid/mail": "^7.7.0",
  "jsonwebtoken": "^9.0.2",
  "country-list": "^2.3.0"
}
```

## Risks & Mitigations

**Risk:** SIBS API access delayed
**Mitigation:** Implement manual payment tracking; generate payment links manually; send invoices via email

**Risk:** Email deliverability issues
**Mitigation:** Configure SPF/DKIM records; use SendGrid's domain authentication; monitor bounce rates

**Risk:** High traffic during registration opening
**Mitigation:** Vercel auto-scaling; database connection pooling; rate limiting on API endpoints

**Risk:** Spam registrations
**Mitigation:** Email verification required; reCAPTCHA on form; monitor for suspicious patterns

## Future Enhancements (Post-Launch)

- SMS notifications option (in addition to email)
- QR codes for check-in at event
- Results publication system
- Photo gallery per participant (bib number matching)
- Integration with timing systems
- Export registrations to CSV/Excel
- Admin panel for manual registration management
- Statistics dashboard for organizers

---

## Approval

- [ ] Technical review approved
- [ ] UX/UI review approved
- [ ] Budget approved
- [ ] Timeline approved
- [ ] Ready for implementation
