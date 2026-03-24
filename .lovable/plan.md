

## Plan: Rebrand App with Official Logo and Updated Color Theme

The uploaded logos show a shield emblem with a human hand and pet paw forming a heart shape, with laurel wreath, in two color schemes:
- **Color version**: Navy blue (#1B2A4A) shield + gold (#D4A843) accents
- **B&W version**: For dark backgrounds (white on black) and light backgrounds (black on white)

### Brand Colors Extracted from Logo
- **Primary**: Navy blue `#1B2A4A` (shield background, text)
- **Accent/Gold**: `#D4A843` (shield border, laurel wreath, hand)
- **Secondary dark**: `#0F1D33` (deeper navy for sidebar/dark elements)

### Changes

**1. Copy logo assets into project**
- Copy color logo PNG to `src/assets/logo-color.png`
- Copy B&W white-on-black logo to `src/assets/logo-dark.png` (for dark backgrounds like sidebar)
- Copy B&W black-on-white logo to `src/assets/logo-light.png` (for light backgrounds)

**2. Update color theme (`src/index.css`)**
- Change `--primary` from purple (`262 83% 58%`) to navy blue (`218 52% 20%`)
- Change `--accent` from teal (`168 76% 42%`) to gold (`43 58% 55%`)
- Change `--ring` to match new primary
- Update sidebar colors to use navy tones
- Update dark mode variants accordingly
- Update gradient CSS variables to use navy-to-gold

**3. Replace PawPrint icon with logo image in headers**
Files to update (replace `<PawPrint>` icon + "Help A Pet" text with logo `<img>`):
- `src/pages/HomePage.tsx` — main header logo
- `src/pages/Index.tsx` — if it renders header
- `src/pages/HelpForeverPage.tsx` — page header
- `src/pages/HelpProtectPage.tsx` — page header
- `src/pages/HelpBehavePage.tsx` — page header
- `src/pages/HelpOvercomePage.tsx` — page header
- `src/pages/FearFreedPage.tsx` — page header
- `src/pages/Auth.tsx` — auth page branding
- `src/components/dashboard/DashboardSidebar.tsx` — sidebar logo (use dark variant)

In each header, replace the PawPrint icon + text span with:
```tsx
import logoColor from "@/assets/logo-color.png";
// ...
<img src={logoColor} alt="Help A Pet" className="h-10 w-auto" />
```

**4. Update favicon in `index.html`**
- Add a favicon link tag pointing to the logo (will need a small version in `/public`)

### Notes
- PawPrint icon usage in non-header contexts (pet cards, avatars, nav items) will remain as-is since those are functional icons, not brand logos
- No database changes needed

