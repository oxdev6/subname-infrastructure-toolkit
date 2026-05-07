"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

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

  useEffect(() => {
    async function load() {
      try {
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
      } catch (e) {
        setError(e.message || "Unknown dashboard error");
      }
    }
    load();
  }, []);

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
