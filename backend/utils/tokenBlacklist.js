// In-memory access-token revocation list. Maps jti -> token's natural expiry
// (ms epoch). Entries are dropped once expired because the JWT signature check
// will reject them anyway -- no need to keep storing what's already dead.
//
// Limits (acceptable for Phase 2, fixed in Phase 3):
//   - Cleared on process restart (single-instance, Render free tier)
//   - Not shared across instances
// Phase 3 will swap the Map for a Redis SET keyed by jti with TTL = remaining
// token lifetime. The revoke()/isRevoked() surface stays identical.

const blacklist = new Map();

export const revoke = (jti, expiresAtMs) => {
    blacklist.set(jti, expiresAtMs);
};

export const isRevoked = (jti) => {
    const exp = blacklist.get(jti);
    if (!exp) return false;
    if (Date.now() > exp) {
        blacklist.delete(jti);
        return false;
    }
    return true;
};

// Sweep expired entries once a minute so the map doesn't grow unbounded under
// steady logout traffic. .unref() lets the process exit cleanly during tests
// without waiting on this interval.
setInterval(() => {
    const now = Date.now();
    for (const [jti, exp] of blacklist) {
        if (exp < now) blacklist.delete(jti);
    }
}, 60_000).unref();
