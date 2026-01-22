# FairGate (FairScale Prototype)

FairGate is a trust-gated product flow on Solana powered by **FairScale** reputation scoring.
Users connect a Solana wallet (Phantom), the backend fetches their FairScore from FairScale, and only wallets that meet a trust threshold can obtain a **server-signed permit** to execute a protected action (“Mint”).

This demo shows how **onchain wallet reputation** becomes a first-class primitive for access control.

---

## What this prototype demonstrates

✅ **Meaningful FairScale usage**: FairScore is used to **gate access**, not just displayed.  
✅ **Wallet ownership proof**: the user must sign a challenge message with Phantom.  
✅ **Server-side enforcement**: protected actions require a valid server-issued permit.  
✅ **Solana-native UX**: wallet connect + signature flow.

---

## Flow Overview

1. User connects Phantom (Solana wallet).
2. Frontend requests a challenge from the backend (`POST /api/challenge`).
3. User signs the challenge message with Phantom (`signMessage`).
4. Backend verifies the signature → fetches **FairScale /score** → applies threshold.
5. If allowed, backend returns a **permit** (HMAC-signed token).
6. Frontend calls protected action (`POST /api/mint`) with the permit.
7. Backend verifies the permit and allows the action.

---

## Architecture

**Frontend (Next.js App Router)**
- Wallet connect (Phantom via wallet-adapter)
- Challenge signing (SignMessage)
- UI shows FairScore + badges + access state
- Requests permit and calls server-gated action

**Backend (Next.js API routes)**
- `/api/challenge`: issues a short-lived challenge token + message
- `/api/permit`: verifies wallet signature, calls FairScale, issues permit if eligible
- `/api/mint`: verifies permit, executes protected action (demo)

**FairScale API**
- `/score` endpoint is used as a trust oracle for FairScore/tier/badges

---

## Tech Stack

- Next.js (App Router)
- TypeScript
- Solana wallet-adapter + Phantom
- FairScale API (`fairkey` header auth)
- HMAC permits (server-signed tokens)
- `tweetnacl` + `bs58` for Solana signature verification

---

## Setup

### 1) Install dependencies

```bash
npm install
```
2) Configure environment variables
Create a .env.local file in the project root:

```env
FAIRSCALE_API_KEY=YOUR_FAIRSCALE_KEY
FAIRSCALE_API_BASE=https://api.fairscale.xyz
```

# HMAC secret used for challenge + permit signing (keep private!)
PERMIT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
Important: never commit .env.local.

3) Run locally
```bash
npm run dev
```
Open:
http://localhost:3000

How FairScale is integrated
This prototype calls FairScale’s GET /score endpoint on the backend:

Endpoint: GET https://api.fairscale.xyz/score?wallet=<SOLANA_ADDRESS>

Auth: header fairkey: <FAIRSCALE_API_KEY>

Response: fairscore, tier, badges, metadata

The backend uses fairscore to compute an access decision (tiers + mint limits).
This decision is enforced server-side by issuing (or denying) a permit.

Key Endpoints
POST /api/challenge
Issues a short-lived challenge that the user must sign.

Request:

```json
{ "wallet": "..." }
```
Response:

```json
{
  "ok": true,
  "challengeToken": "...",
  "message": "FairGate Permit Request\nWallet: ...\nNonce: ...\nExpiresAt: ..."
}
```
POST /api/permit
Verifies the wallet signature, calls FairScale /score, applies threshold, issues permit.

Request:

```json
{
  "wallet": "...",
  "challengeToken": "...",
  "signature": "BASE64_SIGNATURE"
}
```
Success response:

```json
{ "ok": true, "permit": "...", "decision": { "tierLabel": "Silver", "canMint": true, "mintLimit": 1 } }
```
Denied response (example):

```json
{ "ok": false, "reason": "Score too low", "fairScore": 25, "decision": { "canMint": false } }
```
POST /api/mint
Protected action. Requires a valid permit token.

Request:

```json
{ "permit": "..." }
```
Response:

```json
{ "ok": true, "message": "Mint permitted (server-side gate + wallet ownership verified) ✅" }
```
Demo Notes / Thresholds
The access thresholds are configurable in app/api/permit/route.ts:

```ts
function decisionFromFairScore(score: number) {
  if (score >= 70) return { tierLabel: "Gold", canMint: true, mintLimit: 3 };
  if (score >= 40) return { tierLabel: "Silver", canMint: true, mintLimit: 1 };
  return { tierLabel: "Bronze", canMint: false, mintLimit: 0 };
}
```
For demos, you can:

connect a wallet with higher onchain activity, or

temporarily lower the threshold to showcase the “allowed” path.

Troubleshooting
“Mint (server-gated)” button is disabled
A permit was not issued (usually because FairScore is below threshold).
Click Request Permit and check the response message.

401 from FairScale
Make sure .env.local contains a valid FAIRSCALE_API_KEY and restart npm run dev.

Hydration error with wallet button
If you see hydration mismatch, render the wallet button after mount (client-only component).
(Already handled by WalletButtonClient.tsx.)

Security Notes
FairScale API key is never exposed to the browser (server-only).

Wallet ownership is enforced by verifying a real Solana signature.

Permits are server-signed and short-lived (expiry enforced).

Protected actions are enforced server-side, not by UI.
