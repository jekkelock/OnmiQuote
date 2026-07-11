# OmniQuote Multi-Tenant B2B Operating System - Architectural Analysis

**Report Date:** 2026-07-11  
**System Version:** 1.0.0  
**Classification:** Production-Grade Technical Specification

---

## 1. ARCHITECTURAL OVERVIEW & DATA FLOW

### 1.1 Multi-Tenant Isolation Model

**Database Isolation Strategy:** Physical file separation with per-tenant SQLite databases.

```
data/
└── tenants/
    ├── tenant_1.db   ← Business A
    ├── tenant_2.db   ← Business B
    └── tenant_N.db   ← Business N
```

**Tenant Resolution Flow:**

1. **Authentication** (`src/routes/auth.js`):
   - `POST /api/auth/register`: Creates `tenants` record → `users` record → calls `getTenantConnection(tenantId)` to initialize `tenant_[id].db`
   - JWT payload contains `{ user_id, tenant_id, username }`

2. **Middleware Chain** (`src/middleware/auth.js` → `src/middleware/tenant.js`):
   ```
   Request → authenticate() → attachTenantDB() → route handler → cleanupTenant()
   ```
   - `authenticate()` extracts `Bearer` token from `Authorization` header, verifies via `jwt.verify()`, attaches decoded payload to `req.user`
   - `attachTenantDB()` reads `req.user.tenant_id`, calls `getTenantConnection(tenantId)` which returns cached or new SQLite handle
   - Connection cache uses `Map<string, { db, timestamp }>` with 10-minute idle timeout, cleaned every 5 minutes via `setInterval`

3. **Connection Pool Management** (`src/config/tenant.js`):
   - `tenantConnections` Map key = stringified `tenant_id`
   - On access: timestamp updated; on idle > 10min: connection closed and removed
   - WAL mode enabled (`PRAGMA journal_mode=WAL`) for concurrent read/write safety

### 1.2 Proposal Lifecycle Data Flow

```
┌─────────────┐
│  CreateQuote│ (Step 1-2-3)
│    Step 1   │ Customer Details
│    Step 2   │ Line Items (pulls from /api/catalog/services)
│    Step 3   │ Preview & Send
└──────┬──────┘
       │ POST /api/proposals (token, line_items, total, customer_*)
       ▼
┌─────────────┐     ┌──────────┐
│   Draft     │────▶│    Sent    │ (via POST /api/proposals/:id/send)
└─────────────┘     └─────┬────┘
       ▲           ┌───────┘
       │ GET       │ GET /api/proposal/:hash_token
       │           ▼
       │     ┌─────────────┐
       └─────│   Viewed    │ (auto-update on public access)
             └─────┬───────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   ┌────────┐ ┌────────┐ ┌──────────────┐
   │Accepted │ │ Denied │ │Revision Req.│
   └────────┘ └────────┘ └──────┬───────┘
                ▲             ▲
   POST /api/proposal/:hash/accept
   GET  /api/proposal/:hash/accept
                     │
   POST /api/proposal/:hash/feedback
                        │
                        ▼
              ┌──────────────────┐
              │ ProposalAdmin      │
              │ (/proposals/:id/admin)◀── Protected route, JWT required
              └──────────────────┘
```

**Client-facing vs Sender/Owner Views:**

| Aspect | Public Client View (`/proposal/:hash_token`) | Protected Owner View (`/proposals/:id/admin`) |
|--------|------------------------------------------|---------------------------------------------|
| Authentication | None (hash token only) | JWT Bearer token required |
| Route Pattern | `/api/proposal/:hash([a-f0-9]{32})` | `/api/proposals/:id(\\d+)` |
| ID Type | `hash_token` (32-char hex) | `id` (numeric primary key) |
| Endpoints | GET, POST accept/deny/feedback | GET, POST accept/deny, DELETE |

---

## 2. DETAILED MODULE BREAKDOWN (STATE & LOOKUP)

### 2.1 Dashboard Module (`src/frontend/src/pages/Dashboard.jsx`)

**Purpose:** Central hub displaying proposal pipeline statistics and management table.

**State:**
```javascript
const [proposals, setProposals] = useState([]);  // All tenant proposals
const [loading, setLoading]     = useState(true);
const [error, setError]         = useState('');
const [expandedNotes, setExpandedNotes] = useState(null); // Accordion state
```

**Endpoints:**
- `GET /api/proposals` — Fetch all proposals (headers: `Authorization: Bearer ${token}`)
- `DELETE /api/proposals/:id` — Remove proposal

**Computed Values:**
- `sent = proposals.filter(p => p.status !== 'Draft')`
- `accepted = proposals.filter(p => p.status === 'Accepted')`
- `pipeline = sum(total)` — Total monetary value
- `conversion = accepted.length / sent.length * 100` — Win rate

### 2.2 CatalogPage Module (`src/frontend/src/pages/CatalogPage.jsx`)

**Purpose:** CRUD management for the service/product catalog used in quote creation.

**State:**
```javascript
const [services, setServices] = useState([]);
const [modal, setModal]       = useState(null); // UI state: 'add' | 'edit' | null
const [form, setForm]         = useState({ item_name, description, base_price, unit_type });
```

**Endpoints:**
- `GET /api/catalog/services` — Fetch catalog
- `POST /api/catalog/services` — Create
- `PUT /api/catalog/services/:id` — Update
- `DELETE /api/catalog/services/:id` — Delete

### 2.3 CreateQuote Module (`src/frontend/src/pages/CreateQuote.jsx`)

**Purpose:** Multi-step quote builder (3-step wizard) for creating/sending proposals.

**State:**
```javascript
const [step, setStep]            = useState(1); // Wizard step
const [services, setServices]    = useState([]); // From catalog
const [customer, setCustomer]    = useState({ name, email, phone });
const [lineItems, setLineItems]  = useState([]); // Quote composition
const [customRow, setCustomRow]  = useState({...}); // Inline add form
const [saving, setSaving]        = useState(false);
const [sending, setSending]      = useState(false);
```

**Endpoints:**
- `GET /api/catalog/services` — Load catalog (useEffect on token change)
- `POST /api/proposals` — Create draft
- `POST /api/proposals/:id/send` — Send via email, transition to Sent

### 2.4 SettingsPage Module (`src/frontend/src/pages/SettingsPage.jsx`)

**Purpose:** SMTP configuration for outbound email delivery.

**State:**
```javascript
const [form, setForm]       = useState(BLANK); // SMTP fields
const [loading, setLoading] = useState(true);
const [saving, setSaving]   = useState(false);
const [testing, setTesting] = useState(false);
```

**Endpoints:**
- `GET /api/settings/smtp` — Fetch current config
- `POST /api/settings/smtp` — Save/update
- `POST /api/settings/smtp/test` — Test connection

### 2.5 ProposalAdmin Module (`src/frontend/src/pages/ProposalAdmin.jsx`)

**Purpose:** Protected view for internal proposal management with revision history display.

**State:**
```javascript
const [proposal, setProposal] = useState(null);
const [loading, setLoading]     = useState(true);
const [error, setError]       = useState('');
const [actionMsg, setActionMsg] = useState(''); // Success message
```

**Endpoints:**
- `GET /api/proposals/:id` — Fetch single proposal by numeric ID
- `POST /api/proposals/:id/accept` — Mark accepted
- `POST /api/proposals/:id/deny` — Mark denied

**Key Helper: `getRevisionHistory(feedbackStr)`**  
Parses `proposal.feedback` JSON array (format: `{ text, submitted_at }[]`) for chronological display in amber panel when status is 'Revision Requested'.

### 2.6 ProposalPage/Feedback/Action Modules (`src/frontend/src/pages/ProposalPage.jsx`, `ProposalFeedback.jsx`, `ProposalAction.jsx`)

**Purpose:** Public-facing read-only and action endpoints for client recipients.

**ProposalPage State:** `proposal, loading, error, actionDone, actionErr`

**Endoints:**
- `GET /api/proposal/:hash_token` — Fetch public proposal
- `POST /api/proposal/:hash_token/accept` — Accept (returns JSON)
- `POST /api/proposal/:hash_token/deny` — Deny (returns JSON)
- `GET /api/proposal/:hash_token/accept` — Accept via email link (renders HTML)
- `GET /api/proposal/:hash_token/deny` — Deny via email link (renders HTML)
- `POST /api/proposal/:hash_token/feedback` — Submit revision notes

---

## 3. RECENT IMPLEMENTATIONS & REFACTORINGS

### 3.1 Client vs Sender View Separation

**Change Implemented:** Protected admin route with inline middleware (`src/routes/proposal.js:262-274`)

```javascript
router.get('/:id(\\d+)', authenticate, attachTenantDB, cleanupTenant, async (req, res) => {
  const proposalId = parseInt(req.params.id, 10);
  const proposal = await req.db.get('SELECT * FROM proposals WHERE id = ?', [proposalId]);
  // ...
});
```

**Impact:**
- Public routes use regex constraint `[a-f0-9]{32}` to match hash_token exactly
- Protected routes use numeric regex `\\d+` for integer ID matching
- Prevents route collision and 404 errors on `/api/proposals/:id`

### 3.2 Revision Notes Accordion (Dashboard)

**Change Implemented:** Inline accordion UI with `expandedNotes` state (`src/frontend/src/pages/Dashboard.jsx:156-171`)

```javascript
{expandedNotes === p.id && (
  <div className="mt-2 p-3 bg-amber-50 ... max-w-xs">
    <p className="text-xs font-semibold ...">Client Notes:</p>
    <p className="text-sm ...">{getRevisionNotes(p.feedback)}</p>
  </div>
)}
```

**Helper Function:** `getRevisionNotes(feedbackStr)` extracts the last entry from the submission history array for preview.

### 3.3 AuthContext Performance Optimization

**Change Implemented:** React memoization (`src/frontend/src/context/AuthContext.jsx`)

**Before:**
```javascript
const login = (newToken) => { setToken(newToken); ... };
const logout = () => { setToken(null); ... };
return <AuthContext.Provider value={{ token, user, login, logout }}>;
```

**After:**
```javascript
const login = useCallback((newToken) => { ... }, []);
const logout = useCallback(() => { ... }, []);
const value = useMemo(() => ({ token, user, login, logout }), [token, user, login, logout]);
return <AuthContext.Provider value={value}>;
```

**Impact:** Eliminates unnecessary re-renders across 6 major component families (Sidebar, Settings, Catalog, CreateQuote, Dashboard, ProposalAdmin, PrivateRoute).

---

## 4. CURRENT ACTIVE COUPLING & KNOWN FRICTION POINTS

### 4.1 Cross-Community Bottlenecks

| Component | Coupled To | Risk Level | Notes |
|-----------|------------|------------|-------|
| `useAuth()` | Communities 2, 8, 10, 11, 12, 13, 14 | **MEDIUM** | Context value changes trigger re-renders in all consuming components |
| Sidebar | useAuth.user | **LOW** | Only re-renders on user change (business name display) |
| PrivateRoute | useAuth.token | **HIGH** | Guards all protected routes; any token change rerenders the guard |

### 4.2 Potential Race Conditions

**Tenant Connection Pool (`src/config/tenant.js`):**
- Concurrent requests within 5-minute cleanup window both check `date - timestamp < IDLE_TIMEOUT_MS` (line 28)
- If both requests trigger between timestamp check and update (lines 28-31), one may get stale connection
- **Mitigation:** SQLite's `PRAGMA busy_timeout=5000` provides 5-second lock wait

**Missing explicit connection scoping:** The `cleanupTenant` middleware (line 20-22 in tenant.js) is a no-op — cleanup relies on interval-based closing, risking stale handles during rapid tenant switching.

### 4.3 Routing Gaps

| Gap | Location | Impact |
|-----|----------|--------|
| Public `/:hash_token/accept` and `/:hash_token/deny` | `proposal.js:186-223` | Missing authentication allows anyone with hash to accept/deny — intentional for public workflow but undocumented |
| No rate limiting on public endpoints | All `/proposal/:hash*` routes | Vulnerable to brute-force hash_token enumeration |
| Missing `/api/proposals/:id/edit` | ProposalAdmin navigation uses client-side edit | Edit flow redirects to `/create-quote?edit=${id}` but no backend endpoint exists |

### 4.4 Technical Debt Items

1. **41 isolated nodes** (per graphify report) — Utilities like `SALT_ROUNDS`, `__dirname`, `tenantConnections` have no incoming edges, suggesting unused or orphaned code paths.

2. **Inline HTML generation** (`proposal.js:226-244`) — Mixed concerns between API and view layer; should be extracted to template service.

3. **No request-scoped DB teardown** — `cleanupTenant` is intentionally empty; connections rely on background timeout only, leading to potential resource exhaustion under high load.

4. **Public routes lack validation** — `ProposalAction.jsx`, `ProposalFeedback.jsx` accept any hash_token without verification if it exists, allowing enumeration attacks.

---

## APPENDIX: API ENDPOINT MATRIX

| Method | Path | Auth | Tenant DB | Purpose |
|--------|------|------|-----------|---------|
| POST | `/api/auth/register` | No | Main DB | Create tenant + user |
| POST | `/api/auth/login` | No | Main DB | Issue JWT |
| GET | `/api/tenant/info` | Yes | Main DB | Get business name |
| GET/POST/PUT/DELETE | `/api/catalog/*` | Yes | Tenant DB | Services/templates CRUD |
| GET/POST/DELETE | `/api/proposals/*` | Yes | Tenant DB | Admin proposal mgmt |
| GET/POST | `/api/proposal/:hash_token/*` | No | Scans all tenants | Public client actions |
| GET/POST | `/proposal/:hash_token/*` | No | Scans all tenants | Email link handlers |
| GET/POST | `/api/settings/*` | Yes | Tenant DB | SMTP configuration |