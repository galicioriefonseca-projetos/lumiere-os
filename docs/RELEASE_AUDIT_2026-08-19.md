# Release audit — 2026-08-19

Scope: readiness for commercial launch, new-user onboarding, plan catalog and Asaas billing.

Findings addressed in the release-hardening pass:
- New-user checkout previously required a pre-existing salon document even though registration only created the Firebase user.
- Registration still recommended legacy Start/Performance/Network plan IDs instead of the public catalog.
- The Master Panel Asaas seed action still recreated the old Founder/Start/Network catalog.
- Release verification incorrectly rejected the repository because explicit Vercel API functions exist under `api/billing/`.
- Backend plan resolution needed to reject inactive/legacy/custom-pricing plans before creating an Asaas subscription.

Release policy:
- Existing legacy customers are migrated explicitly; their historical payments are not recreated.
- New customers use only the active public catalog.
- The frontend never supplies the authoritative price; the backend resolves price and cycle from the catalog.
- Payment activation remains webhook-driven.
