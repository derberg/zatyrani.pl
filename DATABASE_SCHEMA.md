# NieboCross Database Schema

## Tables

### niebocross_registrations
Stores the main registration records with contact information.

```sql
CREATE TABLE niebocross_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  contact_person VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique identifier for the registration
- `email` - Contact email (unique)
- `contact_person` - Full name of the contact person for this registration
- `created_at` - Registration creation timestamp
- `updated_at` - Last update timestamp

---

### niebocross_auth_codes
Stores temporary authentication codes for email verification.

```sql
CREATE TABLE niebocross_auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique identifier for the auth code
- `email` - Email address the code was sent to
- `code` - 6-digit verification code
- `used` - Whether the code has been used
- `expires_at` - Expiration timestamp
- `created_at` - Code generation timestamp

---

### niebocross_participants
Stores individual participant information for each registration.

```sql
CREATE TABLE niebocross_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES niebocross_registrations(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  birth_date DATE NOT NULL,
  city VARCHAR(255) NOT NULL,
  nationality VARCHAR(100) NOT NULL,
  club VARCHAR(255),
  race_category VARCHAR(50) NOT NULL CHECK (race_category IN ('3km_run', '3km_nw', '9km_run', '9km_nw', 'kids_run')),
  tshirt_size VARCHAR(10) CHECK (tshirt_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  hide_name_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique identifier for the participant
- `registration_id` - Foreign key to niebocross_registrations
- `full_name` - Participant's full name
- `birth_date` - Participant's date of birth
- `city` - Participant's city
- `nationality` - Participant's nationality
- `club` - Optional club/team name
- `race_category` - Race category: `3km_run`, `3km_nw`, `9km_run`, `9km_nw`, `kids_run` (for kids, specific distance will be assigned on event day based on age)
- `tshirt_size` - Optional t-shirt size: `XS`, `S`, `M`, `L`, `XL`, `XXL`
- `hide_name_public` - Whether to hide the name on public participant lists
- `created_at` - Participant creation timestamp
- `updated_at` - Last update timestamp

---

### niebocross_payments
Stores payment information for each registration.

```sql
CREATE TABLE niebocross_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES niebocross_registrations(id) ON DELETE CASCADE,
  race_fees DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tshirt_fees DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  charity_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled')),
  payment_link TEXT,
  transaction_id VARCHAR(255),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique identifier for the payment
- `registration_id` - Foreign key to niebocross_registrations (multiple payments allowed per registration)
- `race_fees` - Total fees for race entries
- `tshirt_fees` - Total fees for t-shirts
- `total_amount` - Total amount to pay
- `charity_amount` - Amount that goes to charity
- `payment_status` - Status: `pending`, `paid`, `failed`, `cancelled`
- `payment_link` - URL to payment gateway
- `transaction_id` - Payment provider transaction ID
- `paid_at` - Payment completion timestamp
- `created_at` - Payment record creation timestamp
- `updated_at` - Last update timestamp

---

### niebocross_clubs
Stores club/team names for reference.

```sql
CREATE TABLE niebocross_clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique identifier for the club
- `name` - Club/team name (unique)
- `created_at` - Club creation timestamp

---

## Security

Row Level Security (RLS) is disabled for all tables to allow API access:

```sql
ALTER TABLE niebocross_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE niebocross_auth_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE niebocross_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE niebocross_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE niebocross_clubs DISABLE ROW LEVEL SECURITY;
```

## Relationships

- `niebocross_participants.registration_id` → `niebocross_registrations.id` (CASCADE DELETE)
- `niebocross_payments.registration_id` → `niebocross_registrations.id` (CASCADE DELETE)

## Important Notes

- **contact_person vs full_name**: The `niebocross_registrations` table uses `contact_person` for the main contact name, while `niebocross_participants` uses `full_name` for individual participant names.
- **Multiple payments per registration**: A registration can have multiple payments (e.g., initial payment, then additional payment after adding more participants). Only one 'pending' payment per registration at a time - if pending exists, update it; if paid, create new pending.
- **Cascade deletes**: Deleting a registration will automatically delete associated participants and payment records.
