# Scope Variance Document — Help A Pet / PlexLogo Contract

Produce a formal, client-ready document comparing the signed contract (PlexLogo Ltd. / Ryan Becker, Feb 19, 2026, $20,000, five phases) against what has actually been delivered, so it can support a change-order conversation.

## Deliverable

A branded PDF written to `/mnt/documents/HAP_Scope_Variance_Report.pdf`, styled in Help A Pet brand colors (Navy #1B2A4A, Gold #D4A843), plus an editable DOCX version of the same content.

## Document structure

1. **Cover** — title, parties, contract date, contract value, document date.
2. **Executive summary** — one page: contract covered X, delivery included substantial out-of-scope work, several paid-phase items remain open, net recommendation.
3. **Section A — Contracted scope baseline** — the deliverables as written in the contract, grouped by the five payment phases.
4. **Section B — Delivered out-of-scope work** — table with columns: Item | Contract basis (none / partial / contradicts) | What was delivered | Scope impact (Low/Med/High). Covers:
   - Vet license database + state bulk-import pipeline + Vet of Record
   - Vet signup path with live identity capture and manual admin verification
   - Multi-path veterinary attestation system (email / print / in-clinic)
   - Help a Pet Now campaign rules engine (60-day expiry, invoice clock pause, verified-amount caps, dual disbursement paths, fund redirection)
   - Priority ranking framework and admin priority console
   - Required social-proof update cadence with reminder sweep and disbursement pausing
   - Addendum 2: reconsideration workflow, content-blocks CMS, fee displays, auto-approval thresholds
   - Unconditional ticket auto-approval (flagged as contradicting the contract's "release only after verification" clause)
   - Furensic Files rename + blog/video/podcast CMS with inline embeds
   - Vetted converted to read-only external mirror (native store descoped)
   - Audit remediation Tier 1/2: append-only ledger, per-pet membership binding, settlement reconciliation, security hardening
   - BNPL membership gating, branded transactional email + DNS setup, white-labeling, IA reorganizations
5. **Section C — Contracted items still open** — referral & bounty automation, Stripe Issuing cards, ~40 domain redirects, dev/staging/prod environments, AWS/VPS + WAF/CDN/DDoS, native merchandise & books store; each mapped to its payment phase.
6. **Section D — Architecture variance** — contract specified Node.js + PostgreSQL/MSSQL on AWS/VPS; delivery uses a managed Postgres + edge-function backend. Stated as a note, not a defect.
7. **Section E — Recommendation** — options: (a) formal change order valuing the out-of-scope work, (b) trade out-of-scope work against remaining open items, (c) re-baseline the contract with a revised phase plan and schedule.
8. **Appendix** — clause-by-clause traceability table.

Tone: factual and neutral, no blame language. Out-of-scope items are presented as delivered value, not as overruns.

## Technical notes

- Generate the PDF with ReportLab (Platypus) using a registered DejaVu Sans TTF, brand-colored headings, and full-width tables with wrapped cell text.
- Generate the DOCX with docx-js at US Letter with matching structure, then validate.
- No project source files change; output goes only to `/mnt/documents`.
- QA: render every PDF page to images and inspect each for clipped text, table overflow, and spacing before delivering; fix and re-render as needed.
