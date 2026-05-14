"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function defaultLocalDateTime(hoursAhead = 24) {
  const d = new Date(Date.now() + hoursAhead * 3600 * 1000);
  d.setSeconds(0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toUnixSeconds(localValue) {
  return Math.floor(new Date(localValue).getTime() / 1000);
}

const fieldLabelStyle = { display: "block", fontSize: 12, color: "#a5b4fc", marginBottom: 6 };
const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0b1020",
  border: "1px solid #334155",
  color: "#e2e8f0",
  borderRadius: 8,
  padding: 10
};

function Card({ title, value, hint }) {
  return (
    <div
      style={{
        background: "#121a30",
        border: "1px solid #223157",
        borderRadius: 12,
        padding: 16
      }}
    >
      <div style={{ fontSize: 12, color: "#a5b4fc", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      {hint ? <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>{hint}</div> : null}
    </div>
  );
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState(null);
  const [events, setEvents] = useState([]);
  const [statusQuery, setStatusQuery] = useState("alice");
  const [statusResult, setStatusResult] = useState(null);
  const [error, setError] = useState("");

  const [mintLabel, setMintLabel] = useState("");
  const [mintRecipient, setMintRecipient] = useState("");
  const [mintExpiresLocal, setMintExpiresLocal] = useState(() => defaultLocalDateTime(24));
  const [mintBusy, setMintBusy] = useState(false);

  const [revokeLabel, setRevokeLabel] = useState("");
  const [revokeBusy, setRevokeBusy] = useState(false);

  const [claimLabel, setClaimLabel] = useState("");
  const [claimExpiresLocal, setClaimExpiresLocal] = useState(() => defaultLocalDateTime(168));
  const [claimMaxClaims, setClaimMaxClaims] = useState(1);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimResult, setClaimResult] = useState(null);

  const loadDashboardData = useCallback(async () => {
    setError("");
    const [analyticsRes, eventsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/analytics`),
      fetch(`${API_BASE_URL}/events/recent?limit=10`)
    ]);

    if (!analyticsRes.ok || !eventsRes.ok) {
      throw new Error("Failed to load analytics data from backend");
    }

    const analyticsData = await analyticsRes.json();
    const eventsData = await eventsRes.json();

    setAnalytics(analyticsData);
    setEvents(eventsData.events || []);
  }, []);

  useEffect(() => {
    loadDashboardData().catch((e) => {
      setError(e.message || "Unknown dashboard error");
    });
  }, [loadDashboardData]);

  const cards = useMemo(() => {
    if (!analytics) {
      return [];
    }
    return [
      { title: "Total Subnames", value: analytics.totalSubnames ?? 0 },
      { title: "Active Subnames", value: analytics.activeSubnames ?? 0 },
      { title: "Revoked Subnames", value: analytics.revokedSubnames ?? 0 },
      { title: "Unique Holders", value: analytics.uniqueHolders ?? 0 }
    ];
  }, [analytics]);

  async function handleMint(event) {
    event.preventDefault();
    const expiresAt = toUnixSeconds(mintExpiresLocal);
    if (!mintLabel.trim() || !mintRecipient.trim()) {
      setError("Mint requires label and recipient.");
      return;
    }
    setMintBusy(true);
    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/mint-subname`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: mintLabel.trim(),
          recipient: mintRecipient.trim(),
          expiresAt
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Mint request failed");
      }
      await loadDashboardData();
      setMintLabel("");
      setMintRecipient("");
    } catch (e) {
      setError(e.message || "Mint failed");
    } finally {
      setMintBusy(false);
    }
  }

  async function handleRevoke(event) {
    event.preventDefault();
    if (!revokeLabel.trim()) {
      setError("Revoke requires a label.");
      return;
    }
    setRevokeBusy(true);
    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/revoke-subname`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: revokeLabel.trim() })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Revoke request failed");
      }
      await loadDashboardData();
      setRevokeLabel("");
    } catch (e) {
      setError(e.message || "Revoke failed");
    } finally {
      setRevokeBusy(false);
    }
  }

  async function handleClaimLink(event) {
    event.preventDefault();
    const expiresAt = toUnixSeconds(claimExpiresLocal);
    if (!claimLabel.trim()) {
      setError("Claim link requires a label.");
      return;
    }
    setClaimBusy(true);
    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/claim-links`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: claimLabel.trim(),
          expiresAt,
          maxClaims: Number(claimMaxClaims) || 1
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Claim link creation failed");
      }
      setClaimResult(body);
      setClaimLabel("");
    } catch (e) {
      setError(e.message || "Claim link failed");
      setClaimResult(null);
    } finally {
      setClaimBusy(false);
    }
  }

  async function handleCheckStatus(event) {
    event.preventDefault();
    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/subname-status?label=${encodeURIComponent(statusQuery)}`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Failed to fetch status");
      }
      setStatusResult(await response.json());
    } catch (e) {
      setError(e.message || "Status check failed");
      setStatusResult(null);
    }
  }

  const panelStyle = {
    background: "#121a30",
    border: "1px solid #223157",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20
  };

  const primaryButtonStyle = (disabled) => ({
    background: "#6366f1",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "10px 14px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1
  });

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 8 }}>ENS Subname Infrastructure Dashboard</h1>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>Connected API: {API_BASE_URL}</p>

      {error ? (
        <div style={{ background: "#3f1d2e", border: "1px solid #be185d", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
        {cards.map((card) => (
          <Card key={card.title} title={card.title} value={card.value} hint={card.hint} />
        ))}
      </section>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Operator actions</h2>
        <p style={{ color: "#94a3b8", marginTop: 0, marginBottom: 20 }}>
          These calls hit the same API the toolkit operators use. Ensure the backend wallet is funded and the registrar is configured.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <form onSubmit={handleMint} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Mint subname</h3>
            <label>
              <span style={fieldLabelStyle}>Label</span>
              <input value={mintLabel} onChange={(e) => setMintLabel(e.target.value)} placeholder="alice" style={inputStyle} />
            </label>
            <label>
              <span style={fieldLabelStyle}>Recipient (0x…)</span>
              <input
                value={mintRecipient}
                onChange={(e) => setMintRecipient(e.target.value)}
                placeholder="0x0000000000000000000000000000000000000001"
                style={inputStyle}
              />
            </label>
            <label>
              <span style={fieldLabelStyle}>Expires</span>
              <input type="datetime-local" value={mintExpiresLocal} onChange={(e) => setMintExpiresLocal(e.target.value)} style={inputStyle} />
            </label>
            <button type="submit" disabled={mintBusy} style={primaryButtonStyle(mintBusy)}>
              {mintBusy ? "Minting…" : "Mint on-chain"}
            </button>
          </form>

          <form onSubmit={handleRevoke} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Revoke subname</h3>
            <label>
              <span style={fieldLabelStyle}>Label</span>
              <input value={revokeLabel} onChange={(e) => setRevokeLabel(e.target.value)} placeholder="alice" style={inputStyle} />
            </label>
            <button type="submit" disabled={revokeBusy} style={primaryButtonStyle(revokeBusy)}>
              {revokeBusy ? "Revoking…" : "Revoke on-chain"}
            </button>
          </form>

          <form onSubmit={handleClaimLink} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Create claim link</h3>
            <label>
              <span style={fieldLabelStyle}>Label</span>
              <input value={claimLabel} onChange={(e) => setClaimLabel(e.target.value)} placeholder="alice" style={inputStyle} />
            </label>
            <label>
              <span style={fieldLabelStyle}>Reserved until</span>
              <input
                type="datetime-local"
                value={claimExpiresLocal}
                onChange={(e) => setClaimExpiresLocal(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label>
              <span style={fieldLabelStyle}>Max claims</span>
              <input
                type="number"
                min={1}
                value={claimMaxClaims}
                onChange={(e) => setClaimMaxClaims(Number(e.target.value))}
                style={inputStyle}
              />
            </label>
            <button type="submit" disabled={claimBusy} style={primaryButtonStyle(claimBusy)}>
              {claimBusy ? "Creating…" : "Generate token"}
            </button>
            {claimResult ? (
              <div style={{ fontSize: 13, color: "#cbd5f5", background: "#0b1020", border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
                <div style={{ marginBottom: 6 }}>
                  <strong>Token</strong>
                </div>
                <div style={{ wordBreak: "break-all", marginBottom: 10 }}>{claimResult.token}</div>
                <div style={{ marginBottom: 4, color: "#94a3b8" }}>Wallet flow: GET challenge then POST redeem with a signature of the returned message.</div>
              </div>
            ) : null}
          </form>
        </div>
      </section>

      <section style={{ background: "#121a30", border: "1px solid #223157", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Subname Status Lookup</h3>
        <form onSubmit={handleCheckStatus} style={{ display: "flex", gap: 8 }}>
          <input
            value={statusQuery}
            onChange={(e) => setStatusQuery(e.target.value)}
            placeholder="alice"
            style={{ flex: 1, background: "#0b1020", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, padding: 10 }}
          />
          <button
            type="submit"
            style={{ background: "#6366f1", color: "white", border: "none", borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}
          >
            Check
          </button>
        </form>
        {statusResult ? (
          <pre style={{ marginTop: 12, background: "#0b1020", border: "1px solid #334155", borderRadius: 8, padding: 10, overflowX: "auto" }}>
            {JSON.stringify(statusResult, null, 2)}
          </pre>
        ) : null}
      </section>

      <section style={{ background: "#121a30", border: "1px solid #223157", borderRadius: 12, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Recent Events</h3>
        {events.length === 0 ? (
          <div style={{ color: "#94a3b8" }}>No events yet</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#a5b4fc" }}>
                <th style={{ paddingBottom: 10 }}>Type</th>
                <th style={{ paddingBottom: 10 }}>Name</th>
                <th style={{ paddingBottom: 10 }}>Owner</th>
                <th style={{ paddingBottom: 10 }}>TX</th>
              </tr>
            </thead>
            <tbody>
              {events.map((item, idx) => (
                <tr key={`${item.type}-${item.label}-${idx}`} style={{ borderTop: "1px solid #24324f" }}>
                  <td style={{ padding: "10px 0" }}>{item.type}</td>
                  <td style={{ padding: "10px 0" }}>{item.fqdn || item.label}</td>
                  <td style={{ padding: "10px 0" }}>{item.owner || "-"}</td>
                  <td style={{ padding: "10px 0" }}>{item.txHash ? `${item.txHash.slice(0, 10)}...` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
