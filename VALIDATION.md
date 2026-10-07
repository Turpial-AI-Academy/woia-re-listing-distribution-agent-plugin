# Validation

Run `mise run ci:fast` for plugin validation plus provider regression. Tests cover exact Listing/media/rights binding, scoped authority, independent active approval, stale source denial, organization isolation, optimistic revision, UNKNOWN effect retry guards, reconciliation identity and Communications-only inbound normalization. `mise run release:check` validates an exact clean committed candidate. Ecosystem v0.5.4 `plugin:certify-thin` supplies centralized portable certification.

Portal adapter qualification, durable-store concurrency integration, operator business E2E and Production Ready remain NOT_RUN. Unit transitions do not prove remote effects.
