# WOIA RE Listing Distribution v0.5.8

Thin shared provider for exact ListingVersion distribution, separate remote desired/observed state and normalized inbound interactions. See [skill](skills/woia-re-listing-distribution/SKILL.md) and [contract](skills/woia-re-listing-distribution/references/contract.md).

The portable helper prepares intents, records remote evidence and guards source/authority/idempotency. It performs no portal/network dispatch. No portal adapter is qualified or advertised; organization binding, trusted grants/acceptance and atomic durable storage are required integration inputs. Interactions route to Communications/Customer Service; no direct person reply or financial effect.

Maintenance: validate a clean exact candidate through WOIA Ecosystem `plugin:certify-thin`; repositories with local tooling also expose `ci:fast` and `release:check`.

## Maintenance

Edit only this canonical repository. Keep `plugin.json`, `package.json` and `dev.woia/manifest.json` versions aligned. From the canonical WOIA Ecosystem repository, run `mise run plugin:certify-thin --repo <absolute-plugin-repository>`, then use its release preparation/publication tasks. Install and update consumers from immutable published artifacts; keep Project personalization in overlays.
