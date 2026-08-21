# Champagne Atlas plans

The server is the authority for quotas. Android mirrors the same limits for immediate feedback. `null` means unlimited.

| Plan | Chef/week | Photos/week | Favourite houses | Favourite champagnes | Journal | Scan | Offline | Smart planning |
|---|---:|---:|---:|---:|---:|---|---|---|
| FREE | 5 | 2 | 20 | 20 | 30 | No | No | No |
| PRO | 30 | 5 | Unlimited | Unlimited | 150 | Yes | Yes | Yes |
| PRO_PLUS | 50 | 20 | Unlimited | Unlimited | Unlimited | Yes | Yes | Yes |
| TRIP_PASS | 30 | 5 | Unlimited | Unlimited | 150 | Yes | Yes | Yes |

Apply migration `021_pro_plan_tiers` before deploying this backend. Expired entitlements resolve to Free. Records above the active visibility limit remain stored and become visible again when access is renewed. Play products and payment verification are deliberately not enabled yet; debug builds can simulate every plan.
