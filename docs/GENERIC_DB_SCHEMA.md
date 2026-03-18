# Generic Competition Database Schema

This schema supports any competition event organized by Zatyrani. All tables use an `event_id` column to scope records to a specific event, enabling multiple events to share the same tables.

**Note:** The existing `niebocross_*` tables remain untouched and continue to serve NieboCross 2026 independently.

## Tables

### registrations
Stores the main registration records with contact information, scoped by event.

```sql
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, email)
);
```

**Columns:**
- `id` — Unique identifier
- `event_id` — Event identifier (e.g. `wilczypolmaraton-2026`)
- `email` — Contact email (unique per event)
- `contact_person` — Full name of contact person
- `created_at`, `updated_at` — Timestamps

---

### auth_codes
Temporary email verification codes, scoped by event.

```sql
CREATE TABLE auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `event_id` — Scopes the code to a specific event
- `email` — Email the code was sent to
- `code` — 6-digit verification code
- `used` — Whether already consumed
- `expires_at` — 10-minute expiry

---

### participants
Individual participant data linked to a registration.

```sql
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  birth_date DATE NOT NULL,
  city VARCHAR(255) NOT NULL,
  nationality VARCHAR(100) NOT NULL,
  club VARCHAR(255),
  race_category VARCHAR(50) NOT NULL,
  food_preference VARCHAR(20),
  tshirt_size VARCHAR(10),
  hide_name_public BOOLEAN NOT NULL DEFAULT false,
  phone_number VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `registration_id` — FK to registrations (CASCADE DELETE)
- `race_category` — No DB CHECK constraint; validated by event config at API level
- `food_preference` — Optional; only collected when `eventConfig.foodEnabled = true`
- `tshirt_size` — Optional; only collected when `eventConfig.tshirtEnabled = true`
- `hide_name_public` — Hides name on public participant list

---

### payments
Payment records linked to a registration.

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  race_fees DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tshirt_fees DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  charity_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled')),
  payment_link TEXT,
  transaction_id VARCHAR(255),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `registration_id` — FK to registrations (CASCADE DELETE)
- `payment_status` — `pending`, `paid`, `failed`, `cancelled`
- `payment_link` — SIBS hosted checkout URL
- `transaction_id` — SIBS transaction ID

---

### clubs
Shared club/team name registry across all events.

```sql
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Security

RLS disabled for all tables (API access via service key):

```sql
ALTER TABLE registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE clubs DISABLE ROW LEVEL SECURITY;
```

## Relationships

- `participants.registration_id` → `registrations.id` (CASCADE DELETE)
- `payments.registration_id` → `registrations.id` (CASCADE DELETE)

## Notes

- Email uniqueness is per-event: the same email can register for different events
- `clubs` table is shared across events (no `event_id` column)
- Multiple payments per registration are allowed; only one `pending` at a time
