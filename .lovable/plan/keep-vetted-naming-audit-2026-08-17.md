# Keep "Vetted" — Naming Audit

## Finding

The rename to "Help a Pet Thrive" was never applied to this codebase. A full-repo search for "Thrive" (source, components, routes, migrations, edge functions, index.html) returns zero matches.

The section is already named and wired as Vetted everywhere:

- Compass menu label: `Vetted™` linking to `/vetted`
- Route `/vetted` → `VettedPage`
- Files: `src/pages/VettedPage.tsx`, `src/components/vetted/ProductCard.tsx`, `src/components/vetted/CreateProductDialog.tsx`, `src/lib/vetted-api.ts`
- Database table: `vetted_products`

## Proposed action

No code changes are required to satisfy this requirement. The plan is:

1. Record "Vetted" as a locked naming rule in project memory (constraint: never rename Vetted to "Help a Pet Thrive" or anything else), so no future turn reintroduces the rename.
2. Leave all Vetted functionality, routes, labels, and data untouched.

If you would rather I also add a visible naming note somewhere (for example in the page header or admin copy), say so and I will extend the plan — otherwise this is a documentation-only change.
