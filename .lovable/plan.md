

## Plan: Reduce Header-to-Border Gap

The header already has `py-0`, so the vertical space between the logo and the bottom border comes from the logo image's own internal whitespace/padding baked into the PNG.

### Change

**`src/pages/HomePage.tsx`** — Add a negative vertical margin to the logo image to visually collapse the extra space without changing its rendered size:

```tsx
<img 
  src={logoColor} 
  alt="Help A Pet" 
  className="object-contain" 
  style={{ width: 100, height: 140, marginTop: -20, marginBottom: -20 }} 
/>
```

This clips the invisible padding in the PNG, pulling the border line closer to the visible logo content. The values (~20px) can be fine-tuned based on how the image looks.

