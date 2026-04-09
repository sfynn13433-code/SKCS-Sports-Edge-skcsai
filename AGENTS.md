# AGENTS.md

## Deployment policy

- For any user-approved change that is meant to go live, do not stop at local edits.
- After verification, commit the changes and push them to the GitHub remote named `deploy` on branch `main`.
- Treat that `deploy` remote as the live production GitHub repo for this workspace.
- Vercel and Render are expected to auto-deploy from `deploy/main`, so a successful push is the step that should trigger all three targets: GitHub, Vercel, and Render.
- Do not claim the site is deployed unless the push to `deploy/main` succeeded.
- If the push fails, report the exact blocker and stop instead of claiming deployment success.
- If the user explicitly asks not to deploy, skip the commit/push step.

## Remote notes

- `deploy` is the production remote to use for live updates.
- `origin` may not be available or may not be the live deployment repo. Do not rely on `origin` for production deployment unless the user explicitly changes the setup.
