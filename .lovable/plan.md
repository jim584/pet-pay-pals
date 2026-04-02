

## Plan: Reduce Header Height

The logo is currently 80×112px, making the header very tall. I'll shrink the logo to **60×84px** (same aspect ratio) so the header feels compact while the logo stays prominent. The `py-1` padding is already minimal.

### Changes

**`src/pages/HomePage.tsx` (line 53)**
- Change logo dimensions from `{ width: 80, height: 112 }` to `{ width: 60, height: 84 }`

