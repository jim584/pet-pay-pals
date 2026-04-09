

## Recommendation: Add a Light Background Container Behind the Logo

The simplest and most robust solution is to wrap the logo in a small rounded container with a light/white background. This way:

- No need to upload or maintain a separate logo file
- Works automatically regardless of the logo's colors
- Looks clean and intentional — like a badge or emblem

### Change: `src/components/dashboard/DashboardSidebar.tsx`

Wrap the `<img>` tag inside the sidebar header with a light background container:

```tsx
<div className="bg-white rounded-xl p-2 inline-flex items-center justify-center">
  <img src={logoDark} alt="Help A Pet" className="object-contain" style={{ width: 80, height: 112 }} />
</div>
```

This gives the shield logo a clean white "card" behind it, making it pop against the dark sidebar while looking polished and intentional — similar to how apps display logos on dark navigation bars.

