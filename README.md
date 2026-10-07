# WOIA RE Listing Distribution v0.5.0

Thin shared provider for exact ListingVersion distribution, separate remote desired/observed state and normalized inbound interactions. See [skill](skills/woia-re-listing-distribution/SKILL.md) and [contract](skills/woia-re-listing-distribution/references/contract.md).

The portable helper prepares intents, records remote evidence and guards source/authority/idempotency. It performs no portal/network dispatch. No portal adapter is qualified or advertised; organization binding, trusted grants/acceptance and atomic durable storage are required integration inputs. Interactions route to Communications/Customer Service; no direct person reply or financial effect.

Maintenance: `mise run bootstrap`, `mise run doctor`, `mise run ci:fast`; exact committed candidate: `mise run release:check` and Ecosystem `plugin:certify-thin`. Public tests use synthetic evidence. Operator E2E and Production Ready remain NOT_RUN/false. No hard intra-W2 dependency is added.
