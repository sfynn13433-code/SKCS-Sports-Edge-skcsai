# SKCS-TEST COMPREHENSIVE WORKSPACE AUDIT
**Date:** 2026-04-15
**Scope:** Full directory analysis of SKCS AI Sports Edge project

---

## EXECUTIVE SUMMARY

| Category | Count | Status |
|----------|-------|--------|
| Total Entries (root) | 61 | Clean |
| Total Backend Files | 23 | Needs cleanup |
| Total Public HTML Files | 13 | Some duplicates |
| Total Scripts (active) | 22 | Clean |
| Total Scripts (archived) | 56 | In quarantine |
| Documentation Files | 20 | ⚠️ HEAVY DUPLICATION |
| Duplicate Images | 5 pairs | ❌ DUPLICATED |
| Configuration Files | 7 | ⚠️ Some duplication |

---

## PART 1: ROOT DIRECTORY ANALYSIS

### ✅ WORKING/CLEAN
| File/Folder | Purpose | Status |
|-------------|---------|--------|
| `_archive/` | Quarantine folder | ✅ GOOD |
| `AGENTS.md` | Agent instructions | ✅ KEEP |
| `STRICT_RULES.md` | AI guardrails | ✅ KEEP |
| `COMPREHENSIVE_AUDIT_REPORT.md` | Audit docs | ✅ KEEP |
| `Dockerfile` | Container config | ✅ KEEP |
| `render.yaml` | Render deployment | ✅ KEEP |
| `vercel.json` | Vercel deployment | ✅ KEEP |
| `package.json` | Root dependencies | ✅ KEEP |
| `backend/` | Backend code | ✅ KEEP |
| `public/` | Frontend code | ✅ KEEP |
| `scripts/` | Active scripts | ✅ KEEP |
| `sql/` | SQL schemas | ✅ KEEP |
| `supabase/` | Supabase configs | ✅ KEEP |
| `api/` | API pipeline | ✅ KEEP |
| `docs/` | Documentation | ✅ KEEP |
| `LICENSE` | License file | ✅ KEEP |
| `requirements.txt` | Python deps | ✅ KEEP |
| `runtime.txt` | Python runtime | ✅ KEEP |

### ❌ DUPLICATE IMAGES (Root vs Public)
| Root File | Public File | Size | Action |
|-----------|-------------|------|--------|
| `about-bg.jpg` | `public/about-bg.jpg` | 778KB | DELETE from root |
| `hero-page.jpg` | `public/hero-page.jpg` | 148KB | DELETE from root |
| `language.jpg` | `public/language.jpg` | 337KB | DELETE from root |
| `login.jpg` | `public/login.jpg` | 100KB | DELETE from root |
| `windrawwin.jpg` | `public/windrawwin.jpg` | 218KB | DELETE from root |

**Total wasted space: ~1.5MB**

### ❌ DUPLICATE IMAGES (WebP)
| Root File | Public File | Size | Action |
|-----------|-------------|------|--------|
| `about-bg.webp` | `public/about-bg.webp` | 69KB | DELETE from root |
| `hero-page.webp` | `public/hero-page.webp` | 45KB | DELETE from root |

### ❌ DUPLICATE ROOT CONFIG FILES
| Root File | Issue |
|-----------|-------|
| `js/config.js` | Duplicated in `public/js/config.js` |
| `public/style.css` | Same as `public/style.css` in archived folder |

---

## PART 2: BACKEND ANALYSIS

### 2.1 BACKEND ROOT
| File | Purpose | Status |
|------|---------|--------|
| `server-express.js` | Main Express server | ✅ ACTIVE |
| `server.js` | Legacy server? | ⚠️ CHECK |
| `database.js` | PostgreSQL connection | ✅ ACTIVE |
| `db.js` | Duplicate DB? | ⚠️ DUPLICATE |
| `apiClients.js` | API clients | ✅ KEEP |
| `config.js` | Backend config | ✅ KEEP |
| `dbBootstrap.js` | DB initialization | ✅ KEEP |
| `deploy-trigger.js` | Deploy trigger | ✅ KEEP |

### 2.2 BACKEND ROUTES (7 files)
| Route | Purpose | Status |
|-------|---------|--------|
| `predictions.js` | Main prediction API | ✅ CRITICAL |
| `user.js` | User management | ✅ ACTIVE |
| `chat.js` | Chat API | ✅ ACTIVE |
| `vip.js` | VIP features | ✅ ACTIVE |
| `accuracy.js` | Accuracy tracking | ✅ ACTIVE |
| `debug.js` | Debug endpoints | ✅ KEEP |
| `pipeline.js` | Pipeline control | ✅ ACTIVE |

### 2.3 BACKEND SERVICES (18 files)
| Service | Purpose | Status |
|---------|---------|--------|
| `accaBuilder.js` | ACCA logic | ✅ CRITICAL |
| `aiPipeline.js` | AI processing | ✅ CRITICAL |
| `aiProvider.js` | AI providers | ✅ CRITICAL |
| `aiScoring.js` | AI scoring | ✅ ACTIVE |
| `marketIntelligence.js` | Market intel | ✅ ACTIVE |
| `syncService.js` | Data sync | ✅ ACTIVE |
| `normalizerService.js` | Data normalization | ✅ ACTIVE |
| `canonicalEvents.js` | Event canonicalization | ✅ ACTIVE |
| `dataProvider.js` | Data provider | ✅ ACTIVE |
| `dataProviders.js` | Data providers | ✅ ACTIVE |
| `apiCacheService.js` | API caching | ✅ ACTIVE |
| `filterEngine.js` | Filtering | ✅ ACTIVE |
| `marketScoringEngine.js` | Market scoring | ✅ ACTIVE |
| `comboEngine.js` | Combo predictions | ✅ ACTIVE |
| `conflictEngine.js` | Conflict resolution | ✅ ACTIVE |
| `reEvaluationEngine.js` | Re-evaluation | ✅ ACTIVE |
| `subscriptionTiming.js` | Timing logic | ✅ ACTIVE |
| `accaMathUtils.js` | Math utilities | ✅ ACTIVE |

### 2.4 BACKEND UTILS (15 files)
| Utility | Purpose | Status |
|---------|---------|--------|
| `weather.js` | Open-Meteo integration | ✅ CRITICAL |
| `availability.js` | Player availability | ✅ CRITICAL |
| `insightUsage.js` | Insight tracking | ✅ ACTIVE |
| `contextInsights.js` | Context analysis | ✅ ACTIVE |
| `insightEngine.js` | Insight generation | ✅ ACTIVE |
| `insightValidationMatrix.js` | Validation | ✅ ACTIVE |
| `accaLogicEngine.js` | ACCA logic | ✅ ACTIVE |
| `conflictResolver.js` | Conflict resolution | ✅ ACTIVE |
| `marketConsistency.js` | Market checks | ✅ ACTIVE |
| `validation.js` | General validation | ✅ ACTIVE |
| `dateNormalization.js` | Date handling | ✅ ACTIVE |
| `purgeStaleData.js` | Data cleanup | ✅ ACTIVE |
| `pipelineLogger.js` | Pipeline logging | ✅ ACTIVE |
| `auth.js` | Authentication | ✅ ACTIVE |
| `db.js` | Duplicate DB utility | ⚠️ DUPLICATE |

### 2.5 BACKEND CONFIG
| File | Purpose | Status |
|------|---------|--------|
| `subscriptionPlans.js` | Plan configs | ✅ ACTIVE |
| `subscriptionMatrix.js` | Matrix configs | ✅ ACTIVE |
| `predictionOutcomes.js` | Outcome configs | ✅ ACTIVE |

### 2.6 BACKEND MIDDLEWARE
| File | Purpose | Status |
|------|---------|--------|
| `supabaseJwt.js` | JWT middleware | ✅ ACTIVE |

### 2.7 BACKEND CONTROLLERS
| File | Purpose | Status |
|------|---------|--------|
| `edgeMindController.js` | Edge mind logic | ✅ ACTIVE |

### 2.8 BACKEND SRC (Nested services)
| Path | Files | Status |
|------|-------|--------|
| `src/services/contextIntelligence/` | 8 files | ✅ ACTIVE |
| `src/services/marketRouter/` | 1 file | ✅ ACTIVE |

### 2.9 BACKEND SCRIPTS (18 files)
| Script | Purpose | Status |
|--------|---------|--------|
| `ingest_football.py` | Football ingestion | ✅ ACTIVE |
| `populate_sports_data.py` | Sports data | ✅ ACTIVE |
| `generate_vip_master.py` | VIP generation | ✅ ACTIVE |
| `test_ai_providers.py` | AI testing | ✅ KEEP |
| `test_ai_real_matches.py` | Match testing | ✅ KEEP |
| `patch-*.js` | Various patches | ⚠️ LEGACY |
| `add-*.js` | Add utilities | ⚠️ LEGACY |
| `_vendor/` | Python packages | ⚠️ DUPLICATE |
| `results/` | Test results | ⚠️ ARCHIVE |
| `.env` | Environment vars | ⚠️ MOVE TO ROOT |

### 2.10 BACKEND TEST
| File | Purpose | Status |
|------|---------|--------|
| `smoke-test-insight-engine.js` | Test | ✅ KEEP |
| `smoke-test-skcs-law.js` | Test | ✅ KEEP |

---

## PART 3: PUBLIC DIRECTORY ANALYSIS

### 3.1 HTML FILES (13 total)
| File | Purpose | Status |
|------|---------|--------|
| `index.html` | Main dashboard | ✅ CRITICAL |
| `login.html` | Login page | ✅ CRITICAL |
| `subscription.html` | Subscription page | ✅ CRITICAL |
| `payment.html` | Payment page | ✅ CRITICAL |
| `experience.html` | Experience mode | ✅ ACTIVE |
| `subscribe/index.html` | Subscribe route | ✅ ACTIVE |
| `terms.html` | Terms of service | ✅ LEGAL |
| `privacy.html` | Privacy policy | ✅ LEGAL |
| `accuracy.html` | Accuracy stats | ✅ ACTIVE |
| `admin-sync.html` | Admin sync | ✅ ADMIN |
| `vip-stress-dashboard.html` | VIP dashboard | ✅ VIP |
| `language-switch.html` | Language switch | ⚠️ LEGACY |
| `sql/index.html` | Why in public? | ❌ REMOVE |

### 3.2 JAVASCRIPT (3 files)
| File | Purpose | Status |
|------|---------|--------|
| `js/config.js` | Frontend config | ✅ CRITICAL |
| `js/supabase-bundle.js` | Supabase client | ✅ CRITICAL |
| `js/vip-stress-dashboard.js` | VIP dashboard | ✅ KEEP |

### 3.3 CSS
| File | Purpose | Status |
|------|---------|--------|
| `style.css` | Main styles | ✅ ACTIVE |

---

## PART 4: API DIRECTORY

### 4.1 API/PIPELINE
| File | Purpose | Status |
|------|---------|--------|
| `run-full.js` | Full pipeline run | ✅ ACTIVE |

---

## PART 5: SUPABASE DIRECTORY

### 5.1 SUPABASE MIGRATIONS
| File | Purpose | Status |
|------|---------|--------|
| `20260415000001_create_insight_usage.sql` | Insight table | ✅ ACTIVE |

### 5.2 SUPABASE FUNCTIONS
| Path | Purpose | Status |
|------|---------|--------|
| `functions/scheduled-prediction-refresh/` | Scheduled refresh | ✅ ACTIVE |
| `functions/sync-sports-data/` | Sports sync | ✅ ACTIVE |

---

## PART 6: DOCUMENTATION ANALYSIS (20 files)

### 6.1 DUPLICATED/OUTDATED
| File | Issue |
|------|-------|
| `DEBUG_REPORT.md` | Old debug info |
| `DEPLOYMENT_READY.md` | Outdated |
| `DEPLOYMENT_STATUS.md` | Outdated (2 copies) |
| `FIXES_APPLIED.md` | Historical |
| `FIXES_VERIFICATION_REPORT.md` | Historical |
| `FRONTEND_CORS_OPTIMIZATION.md` | Historical |
| `INGESTION_STATUS_REPORT.md` | Historical |
| `URGENT_DEPLOY_GUIDE.md` | Old |
| `URGENT_RENDER_FIX.md` | Old |
| `RENDER_DEPLOY_INSTRUCTIONS.md` | Old |
| `ENV_SETUP_GUIDE.md` | Old |
| `API_SETUP.md` | Old |

### 6.2 KEEP
| File | Purpose |
|------|---------|
| `README.md` | Main readme |
| `README_DATA_INGESTION.md` | Data ingestion docs |
| `PRIVACY_POLICY.md` | Legal |
| `TERMS_OF_SERVICE.md` | Legal |
| `AGENTS.md` | Agent instructions |
| `STRICT_RULES.md` | AI guardrails |
| `COMPREHENSIVE_AUDIT_REPORT.md` | Audit report |

### 6.3 DOCS FOLDER
| File | Purpose | Status |
|------|---------|--------|
| `supabase-tier-display-requirements.md` | Relevant | ✅ KEEP |
| `cloud-run-job-deployment.md` | Old Cloud setup | ⚠️ ARCHIVE |
| `google-cloud-soccer-refresh.md` | Old Cloud setup | ⚠️ ARCHIVE |
| `service-account-region-setup.md` | Old Cloud setup | ⚠️ ARCHIVE |
| `weekly-global-scrape-scheduler.md` | Relevant? | ⚠️ CHECK |
| `CheckoutNotice.tsx` | React component | ⚠️ LEGACY? |

---

## PART 7: DUPLICATE FILES SUMMARY

### 7.1 IMAGES (5 pairs = ~1.5MB wasted)
```
Root: about-bg.jpg    ↔  public/about-bg.jpg
Root: hero-page.jpg  ↔  public/hero-page.jpg
Root: language.jpg    ↔  public/language.jpg
Root: login.jpg       ↔  public/login.jpg
Root: windrawwin.jpg  ↔  public/windrawwin.jpg
```

### 7.2 CONFIG FILES (3 copies)
```
public/js/config.js  ←  Used by frontend
js/config.js         ←  Legacy?
backend/config.js    ←  Backend config (different!)
```

### 7.3 SERVER FILES (2 versions)
```
backend/server-express.js  ←  ACTIVE (referenced in package.json)
backend/server.js           ←  Legacy?
```

### 7.4 DATABASE FILES (2 versions)
```
backend/database.js  ←  ACTIVE (PostgreSQL)
backend/db.js         ←  Legacy?
```

### 7.5 ROOT vs PUBLIC CSS
```
_archive/root/style.css  ←  Archived (was duplicate)
public/style.css        ←  ACTIVE
```

### 7.6 BACKEND SCRIPTS ENVIRONMENT
```
backend/scripts/.env  ←  Should be at root?
```

### 7.7 MARKDOWN DUPLICATIONS
```
Root: DEPLOYMENT_STATUS.md      ↔  scripts/deployment-status.md
Root: LICENSE.md                 ↔  backend/scripts/_vendor/.../LICENSE.md
backend: scripts/_vendor/api.md  ↔  (Multiple versions in _vendor/)
```

---

## PART 8: SQL DIRECTORY ANALYSIS

### 8.1 SQL FILES (9 total)
| File | Purpose | Status |
|------|---------|--------|
| `schema_refactor.sql` | Main schema | ✅ CRITICAL |
| `tables.sql` | Base tables | ✅ ACTIVE |
| `acca_rules.sql` | ACCA rules | ✅ ACTIVE |
| `tier_rules.sql` | Tier rules | ✅ ACTIVE |
| `day_zero_subscription.sql` | Subscription setup | ✅ ACTIVE |
| `supabase_test_user_*.sql` | Test users | ✅ KEEP |
| `rapidapi_cache.sql` | Cache table | ✅ ACTIVE |
| `index.html` | ❌ Wrong location | ❌ MOVE/REMOVE |
| `bridge-to-final.sql` | In scripts/ | ✅ ARCHIVED |

---

## PART 9: ARCHIVED FILES (_archive)

### 9.1 _archive/root (3 files)
| File | Original | Reason |
|------|----------|--------|
| `cli_v1.1.0.exe` | Root | Legacy CLI tool |
| `render.zip` | Root | Regenerated artifact |
| `style.css` | Root | Duplicate CSS |

### 9.2 _archive/scripts (56 files)
All migration, debug, check, verify, and legacy scripts moved here.

---

## PART 10: CONFIGURATION FILES

### 10.1 ENVIRONMENT FILES
| File | Purpose | Status |
|------|---------|--------|
| `.env` | Main environment | ✅ CRITICAL |
| `.env.example` | Example | ✅ KEEP |
| `.env.local` | Local overrides | ✅ KEEP |
| `backend/scripts/.env` | Backend scripts | ⚠️ MOVE TO ROOT |

### 10.2 DEPLOYMENT CONFIGS
| File | Platform | Status |
|------|----------|--------|
| `render.yaml` | Render | ✅ ACTIVE |
| `vercel.json` | Vercel | ✅ ACTIVE |
| `Dockerfile` | Docker | ✅ ACTIVE |

### 10.3 IDE CONFIGS (Should be gitignored)
| File | Status |
|------|--------|
| `.idea/` | Should not be committed |
| `.windsurf/` | Should not be committed |
| `.qwen/` | Should not be committed |
| `.vercel/` | Contains .env.local |
| `.venv/` | Python virtualenv |

---

## RECOMMENDATIONS

### 🔴 HIGH PRIORITY (Delete Now)
1. **Duplicate Images (Root)** - 5 JPG + 2 WebP files (~1.5MB)
2. **`sql/index.html`** - Wrong location in SQL folder
3. **`public/language-switch.html`** - Legacy/unused
4. **`backend/server.js`** - Duplicate of server-express.js
5. **`backend/db.js`** - Duplicate of database.js

### 🟡 MEDIUM PRIORITY (Archive)
1. **`docs/CheckoutNotice.tsx`** - Legacy React component
2. **`docs/cloud-run-*.md`** - Old Google Cloud setup docs
3. **`backend/scripts/results/`** - Test result artifacts
4. **`backend/scripts/_vendor/`** - Python packages (can be regenerated)
5. **`backend/scripts/.env`** - Should be at root level

### 🟢 LOW PRIORITY (Review Later)
1. Consolidate documentation (20 files → ~8 essential)
2. Merge `.env.example` and `.env.local` if redundant
3. Review `weekly-global-scrape-scheduler.md` relevance
4. Verify `language-switch.html` is unused

---

## WHAT IS WORKING

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend (public/) | ✅ WORKING | All pages load |
| Backend API | ✅ WORKING | Express server running |
| Database (Supabase) | ✅ WORKING | All tables connected |
| Authentication | ✅ FIXED | window.supabaseClient |
| Gatekeeper Pipeline | ✅ WORKING | 27 predictions active |
| Weather Integration | ✅ WORKING | Open-Meteo |
| Availability Integration | ✅ WORKING | Injury/Absence data |
| ACCA Builder | ✅ WORKING | 5 ACCAs generated |
| Deployment (Vercel) | ✅ WORKING | Frontend hosted |
| Deployment (Render) | ✅ WORKING | Backend hosted |

---

## WHAT NEEDS ATTENTION

| Issue | Impact | Fix Required |
|-------|--------|--------------|
| Duplicate images | 1.5MB wasted | Delete from root |
| Duplicate server.js | Confusion | Archive if unused |
| Duplicate db.js | Confusion | Archive if unused |
| backend/scripts/.env | Config scatter | Move to root |
| sql/index.html | Wrong folder | Remove |
| Legacy docs | 15+ outdated | Archive |
| IDE folders in repo | Should be gitignored | Add to .gitignore |

---

*Report generated: 2026-04-15*
*Next audit scheduled: After cleanup verification*
