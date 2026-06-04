# SKCS AI Usage Policy

## Default operating mode

- AI tools should read the knowledge layer first.
- AI tools should not invent schema, formulas, or provider behavior when the repo does not confirm it.

## Safe usage rules

- Prefer inventory documents over raw code browsing.
- Prefer gap reports over assumptions.
- Treat Supabase schema as the source of truth for business logic where SQL is authoritative.
- Treat legacy code as compatibility until verified otherwise.

## Cost control

- Reduce repeated rediscovery of the architecture.
- Use the knowledge layer to avoid rereading large parts of the repo.
- Record high-cost API and AI usage patterns so they can be governed explicitly.

## Change discipline

- If AI proposes a new formula or rule, it must be added to the registry before being treated as real.
- If AI proposes a new provider, it must be added to the registry and quota map before use.
