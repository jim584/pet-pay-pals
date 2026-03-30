

## Plan: Remove All Lovable Traces

### Files to Modify

**1. `index.html`**
- Change `<meta name="twitter:site" content="@Lovable" />` to `@HelpAPet` or remove it
- Replace `gpt-engineer-file-uploads` image URLs in `og:image` and `twitter:image` with your own hosted social image (or remove them for now)

**2. `vite.config.ts`**
- Remove the `lovable-tagger` import and its usage in the `plugins` array
- Keep the rest of the config intact

**3. `package.json`**
- Remove `"lovable-tagger"` from `devDependencies`

**4. `README.md`**
- Rewrite entirely — remove all Lovable references, project URLs, and instructions. Replace with a generic project README for "Help A Pet"

**5. `supabase/functions/auth-email-hook/index.ts`**
- The `@lovable.dev/email-js` and `@lovable.dev/webhooks-js` imports are **functional dependencies** required for the email system to work — these cannot be removed without breaking email sending. They are server-side only and not visible to end users.
- The `SAMPLE_PROJECT_URL` referencing `lovable.app` is only used for internal preview testing and is not user-facing, but can be changed to your domain.

**6. `.lovable/plan.md`**
- Clear or delete this file

### What stays
- The `supabase/functions` npm imports from `@lovable.dev/*` must remain as they are backend infrastructure packages (not visible to users)
- The Supabase client files (`client.ts`, `types.ts`) are auto-generated and don't contain Lovable branding

### Summary of visible traces removed
- Twitter `@Lovable` meta tag
- `gpt-engineer-file-uploads` social image URLs
- `lovable-tagger` dev dependency and plugin
- README.md Lovable references
- `.lovable/plan.md`

