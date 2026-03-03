

## MX Records and Email Domain Setup

MX records are **not needed** for what you're setting up. Here's why:

### What Each Record Type Does

- **MX records** control where **incoming** emails are delivered (i.e., someone sends an email *to* you@yourdomain.com — MX tells the internet which mail server receives it)
- **TXT records** (SPF, DKIM, domain verification) control **outgoing** email authentication — proving that emails *sent from* your domain are legitimate
- **CNAME records** are used for DKIM signing of outgoing emails

### Your Situation

You're setting up a **sender domain** so that authentication emails (verification, password reset) are sent **from** your domain (e.g., `noreply@yourdomain.com`). You are not setting up an inbox to **receive** emails at that domain.

**You only need:**
- **TXT records** — for SPF, DKIM, and domain ownership verification
- **CNAME records** — for DKIM signing

**You do NOT need:**
- **MX records** — unless you also want to receive emails at that domain (separate concern, handled by your email provider like Gmail, Outlook, etc.)
- **Nameserver changes** — never needed for this setup

### If Your Registrar Shows MX Records

If the setup flow is showing MX records, it may be bundling full email setup (send + receive). You can safely **skip MX records** — they won't affect your ability to send branded auth emails from Lovable.

### Summary

| Record Type | Purpose | Needed for sending auth emails? |
|---|---|---|
| TXT | SPF, DKIM, verification | Yes |
| CNAME | DKIM signing | Yes |
| MX | Incoming mail routing | No |
| NS (Nameservers) | Full DNS delegation | No |

