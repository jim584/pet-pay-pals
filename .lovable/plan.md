## Change
Add a **"Vet Tickets"** item to the pet owner sidebar so owners can reach `/dashboard/vet-tickets` (where they see their tickets and the **+ New ticket** button).

### Edit: `src/components/dashboard/DashboardSidebar.tsx`
In `ownerNav`, insert a new item between "My Pets" and "Community":

```ts
{ title: "Vet Tickets", url: "/dashboard/vet-tickets", icon: FileText },
```

`FileText` is already imported (added in the previous change).

No other files change. Same route serves both roles — the page already renders the owner's submission UI when `role !== 'vet'` and the read-only queue when `role === 'vet'`.
