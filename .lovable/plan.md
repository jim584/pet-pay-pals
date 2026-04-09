

## Plan: Move Search Bar into Header

Move the "Search stories" search input from the main content area into the header, positioned between the logo (left) and the dashboard/avatar controls (right).

### Change: `src/pages/HomePage.tsx`

1. **Header** — Insert the search input between the logo `<Link>` and the right-side controls `<div>`, using `flex-1 max-w-md mx-4` so it fills available space and stays centered:

```tsx
<header className="border-b bg-background">
  <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-0">
    {/* Logo */}
    <Link to="/" ...>...</Link>

    {/* Search bar — NEW location */}
    <div className="flex-1 max-w-md mx-4 relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search stories..."
        className="pl-9 rounded-full"
      />
    </div>

    {/* Dashboard / Avatar controls */}
    <div className="flex items-center gap-2">...</div>
  </div>
</header>
```

2. **Main content area** — Remove the search `<Input>` block that's currently inside `<main>` (the `<div className="relative">` with the Search icon and Input). Keep the category filter buttons in place.

