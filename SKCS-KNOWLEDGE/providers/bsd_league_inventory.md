# BSD League Inventory — SKCS Coverage Analysis

**Generated:** 2026-06-06 (live API probes)  
**Method:** `GET /leagues/` + per-league `GET /events/?league_id=` + `GET /teams/?league_id=`  
**SKCS target baseline:** 66 API-Sports league IDs from `scripts/fetch-live-fixtures.js` `TARGET_LEAGUES`  
**Mapping policy:** Country-aware verified map only — no ambiguous fuzzy matches (e.g. Egypt ≠ Premier League)

---

## Coverage summary

| Metric | Value |
|--------|-------|
| BSD competitions catalogued | **65** |
| SKCS target leagues (API-Sports IDs) | **66** |
| SKCS targets with BSD equivalent | **28** |
| SKCS targets missing on BSD | **38** |
| **SKCS target football coverage on BSD** | **42.4%** |
| Tier-1 crosswalk leagues present on BSD | **10/10** (100%) |

### Interpretation

BSD represents **42.4%** of SKCS's configured domestic/international football league targets. Coverage is **strong at the top of the pyramid** (European top 5, UCL, MLS, Brasileirão, J1, CSL, Saudi Pro League) but **weak on lower tiers, Africa domestic leagues, South America (outside Brazil), Oceania, and UAE**.

Promotion beyond evaluation should not proceed on percentage alone — the **38 missing targets** include many tier-2/tier-3 leagues SKCS syncs today via API-Sports.

---

## Full BSD inventory (65 leagues)

| League Name | League ID | Country | Competition Type | Seasons Available | Team Count | Event Count |
|-------------|-----------|---------|------------------|-------------------|------------|-------------|
Africa Cup of Nations 2023 | 30 | Africa | Domestic Cup | Africa Cup of Nations 2025 (2025) · 2025-07-01 → 2026-06-30 | 31 | 104
CAF Champions League | 29 | Africa | Continental Club | CAF Champions League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 62 | 157
World Cup Qualification CAF | 60 | Africa | International Qualification | None embedded | 54 | 267
AFC Asian Cup 2023 | 68 | Asia | Domestic Cup | None embedded | 24 | 51
World Cup Qualification AFC | 61 | Asia | International Qualification | None embedded | 46 | 226
Pro League | 14 | Belgium | Domestic Top Flight | Pro League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 20 | 324
Brasileirão Serie A | 9 | Brazil | Domestic Top Flight | Brasileiro Serie A 2026 (2026) · 2026-01-01 → 2026-12-31 | 32 | 3692
Brasileirão Serie B | 34 | Brazil | Domestic League (lower/split) | Brasileiro Serie B 2026 (2026) · 2026-01-01 → 2026-12-31 | 20 | 382
Copa do Brasil | 35 | Brazil | Domestic Top Flight | Copa do Brasil 2026 (2026) · 2026-01-01 → 2026-12-31 | 126 | 142
Parva Liga | 22 | Bulgaria | Domestic Top Flight | Parva Liga 25/26 (2025) · 2025-07-01 → 2026-06-30 | 19 | 875
Chinese Super League | 52 | China | Domestic Top Flight | Chinese Super League 2026 (2026) · 2026-01-01 → 2026-12-31 | 22 | 965
Carabao Cup | 40 | England | Domestic Cup | None embedded | 92 | 94
Championship | 12 | England | Domestic League (lower/split) | Championship 25/26 (2025) · 2025-07-01 → 2026-06-30 | 50 | 7770
FA Cup | 39 | England | Domestic Cup | None embedded | 124 | 128
Premier League | 1 | England | Domestic Top Flight | Premier League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 42 | 6123
Champions League | 7 | Europe | Continental Club | UEFA Champions League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 128 | 2131
Europa League | 8 | Europe | Domestic Top Flight | UEFA Europa League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 77 | 271
UEFA Euro 2024 | 66 | Europe | International Tournament | None embedded | 24 | 51
UEFA Nations League | 64 | Europe | International Tournament | None embedded | 54 | 188
World Cup Qualification UEFA | 58 | Europe | International Qualification | None embedded | 54 | 204
Suomen Cup | 56 | Finland | Domestic Cup | None embedded | 116 | 112
Veikkausliiga | 55 | Finland | Domestic Top Flight | None embedded | 12 | 132
Coupe de France | 44 | France | Domestic Top Flight | None embedded | 199 | 200
Ligue 1 | 6 | France | Domestic Top Flight | Ligue 1 25/26 (2025) · 2025-07-01 → 2026-06-30 | 34 | 4386
Bundesliga | 5 | Germany | Domestic Top Flight | Bundesliga 25/26 (2025) · 2025-07-01 → 2026-06-30 | 28 | 4943
DFB Pokal | 43 | Germany | Domestic Cup | None embedded | 64 | 63
Stoiximan Super League | 24 | Greece | Domestic Top Flight | Super League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 21 | 1460
International Friendly Games | 31 | International | International Friendly | Int. Friendly Games 2026 (2026) · 2026-01-01 → 2026-12-31 | 181 | 284
World Cup 2026 | 27 | International | International Tournament | World Cup 2026 (2026) · 2026-01-01 → 2026-12-31 | 48 | 248
Coppa Italia | 42 | Italy | Domestic Top Flight | None embedded | 44 | 45
Serie A | 4 | Italy | Domestic Top Flight | Serie A 25/26 (2025) · 2025-07-01 → 2026-06-30 | 39 | 4990
Emperor Cup | 51 | Japan | Domestic Cup | None embedded | 88 | 87
J1 League | 49 | Japan | Domestic Top Flight | None embedded | 20 | 200
Liga MX Apertura | 19 | Mexico | Domestic League (lower/split) | Liga MX, Apertura 2025 (2025) · 2025-07-01 → 2026-06-30 | 18 | 170
Liga MX Clausura | 20 | Mexico | Domestic League (lower/split) | Liga MX, Clausura 2026 (2025) · 2025-07-01 → 2026-06-30 | 18 | 168
Botola Pro | 53 | Morocco | Domestic Top Flight | None embedded | 17 | 195
Eredivisie | 10 | Netherlands | Domestic Top Flight | VriendenLoterij Eredivisie 25/26 (2025) · 2025-07-01 → 2026-06-30 | 29 | 2467
Nigeria Premier Football League | 28 | Nigeria | Domestic Top Flight | Premier League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 20 | 410
CONCACAF Gold Cup 2025 | 69 | North America | Continental Club | None embedded | 23 | 45
CONCACAF Nations League | 65 | North America | International Tournament | None embedded | 41 | 110
World Cup Qualification CONCACAF | 62 | North America | International Qualification | None embedded | 32 | 100
Eliteserien | 54 | Norway | Domestic Top Flight | None embedded | 16 | 256
World Cup Qualification OFC | 63 | Oceania | International Qualification | None embedded | 11 | 18
Ekstraklasa | 25 | Poland | Domestic Top Flight | Ekstraklasa 25/26 (2025) · 2025-07-01 → 2026-06-30 | 24 | 930
Puchar Polski | 46 | Poland | Domestic Top Flight | None embedded | 69 | 68
Liga Portugal Betclic | 2 | Portugal | Domestic Top Flight | Liga Portugal 25/26 (2025) · 2025-07-01 → 2026-06-30 | 27 | 2452
Superliga | 23 | Romania | Domestic Top Flight | Superliga 25/26 (2025) · 2025-07-01 → 2026-06-30 | 31 | 708
Saudi Pro League | 17 | Saudi Arabia | Domestic Top Flight | Saudi Pro League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 18 | 320
Scottish Premiership | 13 | Scotland | Domestic Top Flight | Premiership 25/26 (2025) · 2025-07-01 → 2026-06-30 | 18 | 1277
Copa America 2024 | 67 | South America | International Tournament | None embedded | 16 | 32
Copa Libertadores | 32 | South America | Continental Club | CONMEBOL Libertadores 2026 (2026) · 2026-01-01 → 2026-12-31 | 47 | 142
Copa Sudamericana | 33 | South America | Continental Club | CONMEBOL Sudamericana 2026 (2026) · 2026-01-01 → 2026-12-31 | 57 | 129
World Cup Qualification CONMEBOL | 59 | South America | International Qualification | None embedded | 10 | 90
K League 1 | 50 | South Korea | Domestic Top Flight | None embedded | 12 | 200
Copa del Rey | 41 | Spain | Domestic Cup | None embedded | 126 | 137
La Liga | 3 | Spain | Domestic Top Flight | LaLiga 25/26 (2025) · 2025-07-01 → 2026-06-30 | 44 | 5588
Liga F | 36 | Spain | Women's Competition | Liga F Moeve 25/26 (2025) · 2025-07-01 → 2026-06-30 | 16 | 243
Segunda División | 38 | Spain | Domestic League (lower/split) | None embedded | 29 | 943
Allsvenskan | 26 | Sweden | Domestic Top Flight | Allsvenskan 2026 (2026) · 2026-01-01 → 2026-12-31 | 19 | 977
Super League | 15 | Switzerland | Domestic Top Flight | Super League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 17 | 1414
Coupe de Tunisie | 48 | Tunisia | Domestic Top Flight | None embedded | 32 | 32
Tunisian Ligue Professionnelle 1 | 47 | Tunisia | Domestic Top Flight | None embedded | 16 | 240
Trendyol Super Lig | 11 | Turkey | Domestic Top Flight | Super Lig 25/26 (2025) · 2025-07-01 → 2026-06-30 | 28 | 2064
MLS | 18 | USA | Domestic Top Flight | MLS 2026 (2026) · 2026-01-01 → 2026-12-31 | 30 | 1058
USL Championship | 57 | USA | Domestic League (lower/split) | None embedded | 25 | 376

---

## Tier A — Core SKCS leagues

BSD competitions that map to SKCS target leagues or verified tier-1 crosswalk entries.

| League Name | League ID | Country | Competition Type | Seasons Available | Team Count | Event Count |
|-------------|-----------|---------|------------------|-------------------|------------|-------------|
Pro League | 14 | Belgium | Domestic Top Flight | Pro League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 20 | 324
Brasileirão Serie A | 9 | Brazil | Domestic Top Flight | Brasileiro Serie A 2026 (2026) · 2026-01-01 → 2026-12-31 | 32 | 3692
Brasileirão Serie B | 34 | Brazil | Domestic League (lower/split) | Brasileiro Serie B 2026 (2026) · 2026-01-01 → 2026-12-31 | 20 | 382
Parva Liga | 22 | Bulgaria | Domestic Top Flight | Parva Liga 25/26 (2025) · 2025-07-01 → 2026-06-30 | 19 | 875
Chinese Super League | 52 | China | Domestic Top Flight | Chinese Super League 2026 (2026) · 2026-01-01 → 2026-12-31 | 22 | 965
Championship | 12 | England | Domestic League (lower/split) | Championship 25/26 (2025) · 2025-07-01 → 2026-06-30 | 50 | 7770
Premier League | 1 | England | Domestic Top Flight | Premier League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 42 | 6123
Champions League | 7 | Europe | Continental Club | UEFA Champions League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 128 | 2131
Veikkausliiga | 55 | Finland | Domestic Top Flight | None embedded | 12 | 132
Ligue 1 | 6 | France | Domestic Top Flight | Ligue 1 25/26 (2025) · 2025-07-01 → 2026-06-30 | 34 | 4386
Bundesliga | 5 | Germany | Domestic Top Flight | Bundesliga 25/26 (2025) · 2025-07-01 → 2026-06-30 | 28 | 4943
Stoiximan Super League | 24 | Greece | Domestic Top Flight | Super League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 21 | 1460
Serie A | 4 | Italy | Domestic Top Flight | Serie A 25/26 (2025) · 2025-07-01 → 2026-06-30 | 39 | 4990
J1 League | 49 | Japan | Domestic Top Flight | None embedded | 20 | 200
Liga MX Apertura | 19 | Mexico | Domestic League (lower/split) | Liga MX, Apertura 2025 (2025) · 2025-07-01 → 2026-06-30 | 18 | 170
Eredivisie | 10 | Netherlands | Domestic Top Flight | VriendenLoterij Eredivisie 25/26 (2025) · 2025-07-01 → 2026-06-30 | 29 | 2467
Eliteserien | 54 | Norway | Domestic Top Flight | None embedded | 16 | 256
Ekstraklasa | 25 | Poland | Domestic Top Flight | Ekstraklasa 25/26 (2025) · 2025-07-01 → 2026-06-30 | 24 | 930
Liga Portugal Betclic | 2 | Portugal | Domestic Top Flight | Liga Portugal 25/26 (2025) · 2025-07-01 → 2026-06-30 | 27 | 2452
Saudi Pro League | 17 | Saudi Arabia | Domestic Top Flight | Saudi Pro League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 18 | 320
Scottish Premiership | 13 | Scotland | Domestic Top Flight | Premiership 25/26 (2025) · 2025-07-01 → 2026-06-30 | 18 | 1277
K League 1 | 50 | South Korea | Domestic Top Flight | None embedded | 12 | 200
La Liga | 3 | Spain | Domestic Top Flight | LaLiga 25/26 (2025) · 2025-07-01 → 2026-06-30 | 44 | 5588
Segunda División | 38 | Spain | Domestic League (lower/split) | None embedded | 29 | 943
Allsvenskan | 26 | Sweden | Domestic Top Flight | Allsvenskan 2026 (2026) · 2026-01-01 → 2026-12-31 | 19 | 977
Super League | 15 | Switzerland | Domestic Top Flight | Super League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 17 | 1414
Trendyol Super Lig | 11 | Turkey | Domestic Top Flight | Super Lig 25/26 (2025) · 2025-07-01 → 2026-06-30 | 28 | 2064
MLS | 18 | USA | Domestic Top Flight | MLS 2026 (2026) · 2026-01-01 → 2026-12-31 | 30 | 1058
USL Championship | 57 | USA | Domestic League (lower/split) | None embedded | 25 | 376

### SKCS target → BSD mapping (verified)

| API-Sports ID | SKCS Target | Country | BSD ID | BSD League | BSD Events |
|---------------|-------------|---------|--------|------------|------------|
39 | Premier League | England | 1 | Premier League | 6123
40 | Championship | England | 12 | Championship | 7770
140 | La Liga | Spain | 3 | La Liga | 5588
141 | Segunda División | Spain | 38 | Segunda División | 943
78 | Bundesliga | Germany | 5 | Bundesliga | 4943
135 | Serie A | Italy | 4 | Serie A | 4990
61 | Ligue 1 | France | 6 | Ligue 1 | 4386
94 | Primeira Liga | Portugal | 2 | Liga Portugal Betclic | 2452
88 | Eredivisie | Netherlands | 10 | Eredivisie | 2467
144 | Pro League | Belgium | 14 | Pro League | 324
179 | Scottish Premiership | Scotland | 13 | Scottish Premiership | 1277
203 | Süper Lig | Turkey | 11 | Trendyol Super Lig | 2064
207 | Super League | Switzerland | 15 | Super League | 1414
197 | Super League 1 | Greece | 24 | Stoiximan Super League | 1460
113 | Allsvenskan | Sweden | 26 | Allsvenskan | 977
103 | Eliteserien | Norway | 54 | Eliteserien | 256
106 | Ekstraklasa | Poland | 25 | Ekstraklasa | 930
172 | First League | Bulgaria | 22 | Parva Liga | 875
224 | Veikkausliiga | Finland | 55 | Veikkausliiga | 132
253 | MLS | USA | 18 | MLS | 1058
254 | USL Championship | USA | 57 | USL Championship | 376
262 | Liga MX | Mexico | 19 | Liga MX Apertura | 170
71 | Brasileirão Série A | Brazil | 9 | Brasileirão Serie A | 3692
72 | Brasileirão Série B | Brazil | 34 | Brasileirão Serie B | 382
98 | J1 League | Japan | 49 | J1 League | 200
169 | Chinese Super League | China | 52 | Chinese Super League | 965
292 | K League 1 | South Korea | 50 | K League 1 | 200
307 | Pro League | Saudi Arabia | 17 | Saudi Pro League | 320

---

## Tier B — Useful expansion leagues

BSD competitions **not** in Tier A but valuable for enrichment, cups, continental football, or regional expansion.

| League Name | League ID | Country | Competition Type | Seasons Available | Team Count | Event Count |
|-------------|-----------|---------|------------------|-------------------|------------|-------------|
Africa Cup of Nations 2023 | 30 | Africa | Domestic Cup | Africa Cup of Nations 2025 (2025) · 2025-07-01 → 2026-06-30 | 31 | 104
CAF Champions League | 29 | Africa | Continental Club | CAF Champions League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 62 | 157
World Cup Qualification CAF | 60 | Africa | International Qualification | None embedded | 54 | 267
AFC Asian Cup 2023 | 68 | Asia | Domestic Cup | None embedded | 24 | 51
World Cup Qualification AFC | 61 | Asia | International Qualification | None embedded | 46 | 226
Copa do Brasil | 35 | Brazil | Domestic Top Flight | Copa do Brasil 2026 (2026) · 2026-01-01 → 2026-12-31 | 126 | 142
Carabao Cup | 40 | England | Domestic Cup | None embedded | 92 | 94
FA Cup | 39 | England | Domestic Cup | None embedded | 124 | 128
Europa League | 8 | Europe | Domestic Top Flight | UEFA Europa League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 77 | 271
UEFA Euro 2024 | 66 | Europe | International Tournament | None embedded | 24 | 51
UEFA Nations League | 64 | Europe | International Tournament | None embedded | 54 | 188
World Cup Qualification UEFA | 58 | Europe | International Qualification | None embedded | 54 | 204
Suomen Cup | 56 | Finland | Domestic Cup | None embedded | 116 | 112
Coupe de France | 44 | France | Domestic Top Flight | None embedded | 199 | 200
DFB Pokal | 43 | Germany | Domestic Cup | None embedded | 64 | 63
International Friendly Games | 31 | International | International Friendly | Int. Friendly Games 2026 (2026) · 2026-01-01 → 2026-12-31 | 181 | 284
World Cup 2026 | 27 | International | International Tournament | World Cup 2026 (2026) · 2026-01-01 → 2026-12-31 | 48 | 248
Coppa Italia | 42 | Italy | Domestic Top Flight | None embedded | 44 | 45
Emperor Cup | 51 | Japan | Domestic Cup | None embedded | 88 | 87
Liga MX Clausura | 20 | Mexico | Domestic League (lower/split) | Liga MX, Clausura 2026 (2025) · 2025-07-01 → 2026-06-30 | 18 | 168
Botola Pro | 53 | Morocco | Domestic Top Flight | None embedded | 17 | 195
Nigeria Premier Football League | 28 | Nigeria | Domestic Top Flight | Premier League 25/26 (2025) · 2025-07-01 → 2026-06-30 | 20 | 410
CONCACAF Gold Cup 2025 | 69 | North America | Continental Club | None embedded | 23 | 45
CONCACAF Nations League | 65 | North America | International Tournament | None embedded | 41 | 110
World Cup Qualification CONCACAF | 62 | North America | International Qualification | None embedded | 32 | 100
World Cup Qualification OFC | 63 | Oceania | International Qualification | None embedded | 11 | 18
Puchar Polski | 46 | Poland | Domestic Top Flight | None embedded | 69 | 68
Superliga | 23 | Romania | Domestic Top Flight | Superliga 25/26 (2025) · 2025-07-01 → 2026-06-30 | 31 | 708
Copa America 2024 | 67 | South America | International Tournament | None embedded | 16 | 32
Copa Libertadores | 32 | South America | Continental Club | CONMEBOL Libertadores 2026 (2026) · 2026-01-01 → 2026-12-31 | 47 | 142
Copa Sudamericana | 33 | South America | Continental Club | CONMEBOL Sudamericana 2026 (2026) · 2026-01-01 → 2026-12-31 | 57 | 129
World Cup Qualification CONMEBOL | 59 | South America | International Qualification | None embedded | 10 | 90
Copa del Rey | 41 | Spain | Domestic Cup | None embedded | 126 | 137
Liga F | 36 | Spain | Women's Competition | Liga F Moeve 25/26 (2025) · 2025-07-01 → 2026-06-30 | 16 | 243
Coupe de Tunisie | 48 | Tunisia | Domestic Top Flight | None embedded | 32 | 32
Tunisian Ligue Professionnelle 1 | 47 | Tunisia | Domestic Top Flight | None embedded | 16 | 240

**Notable Tier B assets:** UEFA Europa League, Copa Libertadores, Copa Sudamericana, World Cup 2026, FIFA/continental qualifiers, domestic cups (FA Cup, Copa del Rey, DFB Pokal), Morocco Botola Pro, Nigeria NPFL, Tunisia Ligue 1, Liga F (women).

---

## Tier C — Missing compared with API-Sports (SKCS targets absent on BSD)

These **38** SKCS target leagues have **no verified BSD equivalent** in the live catalog.

| API-Sports ID | SKCS Target | Country | Type |
|---------------|-------------|---------|------|
41 | League One | England | Domestic 3rd Tier
42 | League Two | England | Domestic 4th Tier
79 | 2. Bundesliga | Germany | Domestic 2nd Tier
80 | 3. Liga | Germany | Domestic 3rd Tier
136 | Serie B | Italy | Domestic 2nd Tier
137 | Serie C | Italy | Domestic 3rd Tier
62 | Ligue 2 | France | Domestic 2nd Tier
63 | National 1 | France | Domestic 3rd Tier
95 | Liga Portugal 2 | Portugal | Domestic 2nd Tier
89 | Eerste Divisie | Netherlands | Domestic 2nd Tier
145 | Challenger Pro League | Belgium | Domestic 2nd Tier
180 | Scottish Championship | Scotland | Domestic 2nd Tier
204 | 1. Lig | Turkey | Domestic 2nd Tier
208 | Challenge League | Switzerland | Domestic 2nd Tier
218 | Bundesliga | Austria | Domestic Top Flight
219 | 2. Liga | Austria | Domestic 2nd Tier
114 | Superettan | Sweden | Domestic 2nd Tier
104 | OBOS-ligaen | Norway | Domestic 2nd Tier
119 | Superliga | Denmark | Domestic Top Flight
120 | 1st Division | Denmark | Domestic 2nd Tier
107 | I Liga | Poland | Domestic 2nd Tier
345 | First League | Czech Republic | Domestic Top Flight
318 | First Division | Cyprus | Domestic Top Flight
118 | Urvalsdeild | Iceland | Domestic Top Flight
128 | Liga Profesional | Argentina | Domestic Top Flight
239 | Primera A | Colombia | Domestic Top Flight
265 | Primera División | Chile | Domestic Top Flight
268 | Primera División | Uruguay | Domestic Top Flight
130 | Primera División | Costa Rica | Domestic Top Flight
99 | J2 League | Japan | Domestic 2nd Tier
301 | Pro League | UAE | Domestic Top Flight
188 | A-League | Australia | Domestic Top Flight
288 | Premiership | South Africa | Domestic Top Flight
289 | Motsepe Foundation Championship | South Africa | Domestic 2nd Tier
233 | Premier League | Egypt | Domestic Top Flight
195 | Ligue 1 | Algeria | Domestic Top Flight
315 | Premier League | Ghana | Domestic Top Flight
326 | Premier League | Kenya | Domestic Top Flight

### Missing by region

| Region | Missing count | Examples |
|--------|---------------|----------|
| England lower tiers | 2 | League One, League Two |
| Germany lower tiers | 1 | 3. Liga (2. Bundesliga also absent) |
| Italy lower tiers | 2 | Serie B, Serie C |
| France lower tiers | 2 | Ligue 2, National 1 |
| Portugal | 1 | Liga Portugal 2 |
| Netherlands | 1 | Eerste Divisie |
| Scotland / Turkey / Switzerland / Austria | 4 | 2nd-tier leagues |
| Nordics (2nd tier) | 2 | Superettan, OBOS-ligaen |
| Denmark | 2 | Superliga, 1st Division — **no BSD Denmark league** |
| CEE | 3 | Czech, Cyprus; Poland I Liga |
| Iceland | 1 | Urvalsdeild |
| South America (non-Brazil) | 5 | Argentina, Colombia, Chile, Uruguay, Costa Rica |
| Asia-Pacific | 3 | J2, A-League, UAE Pro League |
| Africa domestic | 6 | South Africa ×2, Egypt, Algeria, Ghana, Kenya |

---

## Promotion gate recommendation

| Gate | Threshold | BSD status |
|------|-----------|------------|
| Tier-1 crosswalk | 10/10 present | ✓ Pass |
| SKCS `TARGET_LEAGUES` coverage | ≥80% for PRIMARY candidacy | ✗ **42.4%** |
| Lower-tier depth | Championship+ equivalents | Partial (Championship ✓; League One/Two ✗) |
| Multi-region Africa / CONMEBOL | Major domestic leagues | ✗ Mostly Tier C |

**Verdict:** BSD remains **evaluation + enrichment**. Do not promote to PRIMARY until missing Tier C targets are accepted as permanent gaps or supplemented by another provider.

---

## Regeneration

```bash
npm run audit:bsd-league-inventory
```

Source script: `scripts/audit-bsd-league-inventory.js`
