export function createIndexStore() {
  const subnames = new Map();
  const events = [];

  function key(label) {
    return String(label || "").toLowerCase();
  }

  return {
    applyMint({ label, fqdn, owner, expiresAt, txHash }) {
      const normalized = key(label);
      const previous = subnames.get(normalized);
      subnames.set(normalized, {
        label,
        fqdn,
        owner,
        expiresAt: Number(expiresAt),
        revoked: false,
        active: Number(expiresAt) > Math.floor(Date.now() / 1000),
        updatedAt: Date.now()
      });
      events.unshift({
        type: "mint",
        label,
        fqdn,
        owner,
        expiresAt: Number(expiresAt),
        txHash,
        createdAt: Date.now()
      });
      if (!previous) {
        // noop reserved for future counters/metrics hooks
      }
    },

    applyRevoke({ label, txHash }) {
      const normalized = key(label);
      const existing = subnames.get(normalized);
      if (!existing) {
        return;
      }
      subnames.set(normalized, {
        ...existing,
        revoked: true,
        active: false,
        updatedAt: Date.now()
      });
      events.unshift({
        type: "revoke",
        label: existing.label,
        fqdn: existing.fqdn,
        owner: existing.owner,
        txHash,
        createdAt: Date.now()
      });
    },

    applyStatus({ label, fqdn, owner, expiresAt, revoked, active }) {
      subnames.set(key(label), {
        label,
        fqdn,
        owner,
        expiresAt: Number(expiresAt),
        revoked: Boolean(revoked),
        active: Boolean(active),
        updatedAt: Date.now()
      });
    },

    getRecentEvents(limit = 25) {
      return events.slice(0, Number(limit));
    },

    getAnalytics() {
      const all = [...subnames.values()];
      const totalSubnames = all.length;
      const activeSubnames = all.filter((item) => item.active).length;
      const revokedSubnames = all.filter((item) => item.revoked).length;
      const uniqueHolders = new Set(
        all.filter((item) => item.owner && item.owner !== "0x0000000000000000000000000000000000000000").map((i) => i.owner.toLowerCase())
      ).size;

      return {
        totalSubnames,
        activeSubnames,
        revokedSubnames,
        uniqueHolders,
        recentEvents: events.slice(0, 10)
      };
    }
  };
}
