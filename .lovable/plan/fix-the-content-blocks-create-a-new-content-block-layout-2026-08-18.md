# Fix the Content Blocks "Create a new content block" layout

The create-block row squeezes three controls onto one line. The long "Kind" dropdown option labels ("text — Short single-line copy") force the native select wider than its share of the row, so the "Kind" label collides with the dropdown and the row visually cuts off at wide viewports.

## What changes

- Rebuild the create card as a responsive grid instead of a single `flex-wrap` row:
  - Mobile: each control stacks full width.
  - Desktop: Key field takes the flexible remaining space, Kind is a fixed-width column, Create button sits on its own column, right-aligned and bottom-aligned with the inputs.
- Give the Kind control its own stacked label above the input (matching the Key field) so the label never sits inline against the dropdown.
- Replace the raw `<select>` with the project's shadcn Select so the trigger height, border, radius and focus ring match the Key input, and the option list can show the longer description text without widening the trigger.
- Shorten the visible trigger text to the kind name (`text`, `richtext`, `image`, `image list`) and keep the full description as secondary text inside the dropdown options only.
- Keep the description line under the header and the filter field as-is.

## Technical notes

Only `src/pages/admin/AdminContentPage.tsx` is touched — presentation markup and the Select import. No changes to `createBlock`, the content block queries, or the `content_blocks` schema. `newKind` stays the same state value and type.
