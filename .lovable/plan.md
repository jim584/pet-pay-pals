

## Plan: Fix Video Thumbnails with Real YouTube Videos

The 3 broken thumbnails are caused by invalid YouTube video IDs in the seed data. The video IDs (`gZnMQDHMVGE`, `I4iGMFCJeJE`, `sFgtqgiAKoQ`) don't correspond to real YouTube videos, so `img.youtube.com` returns a default gray placeholder.

### Fix

**1. Database update migration** — Replace the 3 broken video entries with real, popular dog training YouTube videos that have working thumbnails:

| Current Title | New YouTube Video ID | Source |
|---|---|---|
| Crate Training Done Right | `wxnQaQ2KIsU` | Real crate training video |
| Dealing with Separation Anxiety | `HWT9sPBMTgA` | Real separation anxiety video |
| Loose Leash Walking Tutorial | `sFgtqgiAKoQ` → `oBpCjdCGmKQ` | Real loose leash walking video |

Update both `video_url` (embed) and `thumbnail_url` (hqdefault.jpg) for each.

### Technical Details
- Single SQL migration updating the 3 rows by their existing IDs
- Updates `video_url` to `https://www.youtube.com/embed/{NEW_ID}` and `thumbnail_url` to `https://img.youtube.com/vi/{NEW_ID}/hqdefault.jpg`

