
# Plan: Reply to client re: AAVSB "Look Up A License" link

The client sent `https://www.aavsb.org/public-resources/look-up-a-license/` as their answer for the license verification data source. That page is **not a data source** — it's a directory of links to each state board's own website. Below is a message you can send back explaining why, plus what we actually need from them.

---

## Message to send the client

> **Subject: Re: License verification — the AAVSB page isn't a data source, here's why**
>
> Hi [name],
>
> Thanks for sending the AAVSB link. I want to explain what that page actually is, because it's a common misunderstanding and it changes what we need from you.
>
> **What `aavsb.org/public-resources/look-up-a-license/` actually is:**
> It's a **directory of hyperlinks**, one per state, pointing to each state veterinary board's own website. It's not a database, not an API, and it does not itself hold any license data. If you click "California," it takes you to the California DCA/VMB site. If you click "Texas," it takes you to the Texas HPC site. And so on for all 50 states plus territories.
>
> **Why that means we can't just "use the AAVSB page":**
>
> 1. **There is no data behind it to pull.** AAVSB is a membership association for the state boards — they don't operate a public license database. The page is a convenience directory, nothing more.
> 2. **Every link goes to a different website** built on a different platform (Thentia, Accela, MyLicense, F5-protected legacy portals, custom PHP, etc.). Each one has its own form fields, its own response format, and its own terms of service. Verifying one vet in one state via that page requires a human to click through, fill out that state's form, and read the result.
> 3. **About half the linked sites actively block automated lookups** — CAPTCHAs, WAF challenges (Cloudflare, F5 BIG-IP), or explicit "no scraping" clauses in their terms. We've already probed the major ones; the details are in our internal coverage report. Even where it's technically possible, doing it may violate that board's ToS, which is a legal risk we shouldn't take on your behalf.
> 4. **What AAVSB *does* sell that would work — but it's a paid product, not this page.** AAVSB operates **VetNet**, a paid license-verification service used by employers, hospital chains, and licensing boards to check vet credentials across states through a single interface. That is the real product. It requires a signed agreement and a subscription. It is **not** the free "Look Up A License" page.
>
> **So the actual options in front of you are the same three I laid out before:**
>
> - **(A) AAVSB VetNet subscription** — the closest thing to a "one API for all states." You (the business) sign up with AAVSB directly, pay their fee, and we integrate against their service. Best coverage, real cost.
> - **(B) Third-party verification vendor** — e.g. Verifiable, ProVet — $3–8 per lookup, covers all 50 states, no per-state integration work.
> - **(C) Manual admin review** — vet uploads a photo of their license, an admin (you or a staff member) clicks the appropriate state link on the AAVSB page, verifies by hand, and approves in our dashboard. Free, but doesn't scale past a few signups per week.
>
> The AAVSB directory page you sent is useful for **option C** — it's exactly what an admin would use to do manual lookups. It is not usable for A or B.
>
> Which of the three do you want to move forward with? If you want A, I can point you at AAVSB's VetNet sales contact so you can start the subscription process; once you have credentials we can wire it in.
>
> Thanks,
> [you]

---

## What we need from you (project owner) before sending

1. **Confirm the three options** (VetNet / vendor / manual) still match what you want to offer the client — same as the previous plan.
2. **Confirm the VetNet framing** — I'm describing it accurately per AAVSB's public materials, but if you already know the client's budget won't cover it, we can soften option A and push them toward C.
3. **Fear Free** — the client didn't address it. Should this reply also re-ask about Fear Free, or wait until they pick a license path first? Default in the draft above: wait.

## Technical notes (for you, not the client)

- No code changes. Our scaffolding already routes every state to `pending_review` (`supabase/functions/verify-vet-license/states/index.ts`), which is exactly the manual-review path option C describes. Whichever option the client picks, only one new adapter needs to be registered.
- If they pick C, the admin dashboard at `AdminVetsPage` / `AdminVetDetailPage` is already the review surface — no new UI needed.
