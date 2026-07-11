# Graph Report - src  (2026-07-11)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 127 nodes · 199 edges · 19 communities (18 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b807a5eb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 17 edges
2. `authenticate()` - 6 edges
3. `attachTenantDB()` - 6 edges
4. `getTenantDB()` - 5 edges
5. `getTenantConnection()` - 5 edges
6. `cleanupTenant()` - 5 edges
7. `verifyToken()` - 4 edges
8. `scripts` - 4 edges
9. `decrypt()` - 4 edges
10. `getMainDB()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `withProposalDB()` --calls--> `getTenantDB()`  [EXTRACTED]
  routes/proposal.js → config/db.js
- `attachTenantDB()` --calls--> `getTenantConnection()`  [EXTRACTED]
  middleware/tenant.js → config/tenant.js
- `authenticate()` --calls--> `verifyToken()`  [EXTRACTED]
  middleware/auth.js → config/auth.js
- `Sidebar()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/components/Sidebar.jsx → frontend/src/context/AuthContext.jsx
- `CatalogPage()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/pages/CatalogPage.jsx → frontend/src/context/AuthContext.jsx

## Import Cycles
- None detected.

## Communities (19 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (20): allowScripts, esbuild@0.21.5, dependencies, autoprefixer, react, react-dom, react-markdown, react-router-dom (+12 more)

### Community 1 - "Community 1"
Cohesion: 0.36
Nodes (7): verifyToken(), authenticate(), attachTenantDB(), cleanupTenant(), router, router, router

### Community 2 - "Community 2"
Cohesion: 0.20
Nodes (3): STATUS_STYLES, TERMINAL, PrivateRoute()

### Community 3 - "Community 3"
Cohesion: 0.33
Nodes (8): buildEmailHtml(), escHtml(), getTransporter(), sendProposalEmail(), decrypt(), encrypt(), getKey(), KEY_CACHE

### Community 4 - "Community 4"
Cohesion: 0.28
Nodes (5): generateToken(), hashPassword(), SALT_ROUNDS, getMainDB(), router

### Community 5 - "Community 5"
Cohesion: 0.32
Nodes (4): ThemeToggle(), ThemeContext, ThemeProvider(), useTheme()

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (4): getTenantDB(), closeTenantConnection(), getTenantConnection(), tenantConnections

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (4): __dirname, router, TENANTS_DIR, withProposalDB()

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (4): NAV_ITEMS, Sidebar(), AuthContext, AuthProvider()

### Community 9 - "Community 9"
Cohesion: 0.40
Nodes (4): __dirname, __filename, initMainDB(), app

### Community 10 - "Community 10"
Cohesion: 0.47
Nodes (4): useAuth(), AuthPage(), BLANK, SettingsPage()

### Community 11 - "Community 11"
Cohesion: 0.40
Nodes (3): BLANK, CatalogPage(), UNITS

### Community 12 - "Community 12"
Cohesion: 0.40
Nodes (3): CreateQuote(), STEP_LABELS, UNIT_TYPES

### Community 14 - "Community 14"
Cohesion: 0.50
Nodes (3): getRevisionHistory(), ProposalAdmin(), STATUS_STYLES

## Knowledge Gaps
- **41 isolated node(s):** `SALT_ROUNDS`, `__filename`, `__dirname`, `tenantConnections`, `name` (+36 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `Community 10` to `Community 2`, `Community 8`, `Community 11`, `Community 12`, `Community 13`, `Community 14`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `SALT_ROUNDS`, `__filename`, `__dirname` to the rest of the system?**
  _41 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._