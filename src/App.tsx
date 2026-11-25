import { useEffect, useMemo, useRef, useState } from "react";
import { api, apiBase } from "./api";
import type { AuthUser } from "./api";
import type { EmailRow, Sender } from "./types";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import EmailsPage from "./pages/EmailsPage";
import ComposePage from "./pages/ComposePage";

export type Page = "dashboard" | "emails" | "compose";
export type EmailTab = "scheduled" | "sent";

function parseLeads(text: string): string[] {
  return [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(x => x.toLowerCase()))];
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [tab, setTab] = useState<EmailTab>("scheduled");
  const [scheduled, setScheduled] = useState<EmailRow[]>([]);
  const [sent, setSent] = useState<EmailRow[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<EmailRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRequestId = useRef(0);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true); setError("");
    try {
      const [scheduledRows, sentRows, senderRows] = await Promise.all([api.scheduled(), api.sent(), api.senders()]);
      setScheduled(scheduledRows); setSent(sentRows); setSenders(senderRows);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load emails"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await api.me();
        if (!active) return;
        setUser(result.user);
        if (result.user) await refresh();
      } catch { if (active) setUser(null); }
      finally { if (active) { setAuthLoading(false); setLoading(false); } }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const query = search.trim(); const requestId = ++searchRequestId.current;
    if (!query) { setSearchResults([]); setSearchLoading(false); return; }
    const timeout = window.setTimeout(async () => {
      setSearchLoading(true);
      try { const result = await api.search(query); if (requestId === searchRequestId.current) setSearchResults(result as EmailRow[]); }
      catch (e) { if (requestId === searchRequestId.current) setError(e instanceof Error ? `Search failed: ${e.message}` : "Search failed"); }
      finally { if (requestId === searchRequestId.current) setSearchLoading(false); }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const rows = useMemo(() => {
    const source = search.trim() ? searchResults : tab === "scheduled" ? scheduled : sent;
    return source.filter(row => tab === "scheduled" ? row.status === "SCHEDULED" || row.status === "PROCESSING" : row.status === "SENT" || row.status === "FAILED");
  }, [tab, scheduled, sent, search, searchResults]);

  async function logout() {
    setLoggingOut(true);
    try { await api.logout(); setUser(null); setScheduled([]); setSent([]); setSenders([]); setSearchResults([]); setSearch(""); setNotice(""); setError(""); setPage("dashboard"); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not log out"); }
    finally { setLoggingOut(false); }
  }

  async function addSender() {
    const email = prompt("Sender email address");
    const smtpUser = email ? prompt("Ethereal SMTP username") : null;
    const smtpPassword = smtpUser ? prompt("Ethereal SMTP password") : null;
    if (!email || !smtpUser || !smtpPassword) return;
    try { await api.addSender({ email, smtpUser, smtpPassword }); await refresh(); setNotice("Sender added successfully."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Could not add sender"); }
  }

  async function testSlack() {
    setBusy(true); setNotice("");
    try { const result = await api.testSlack(); setNotice(result.message); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Slack test failed"); }
    finally { setBusy(false); }
  }

  async function scheduleCampaign(input: { subject: string; body: string; recipientsText: string; fileText: string; senderId: string; startTime: string; delay: number; hourlyLimit: number }) {
    const recipients = [...new Set([...parseLeads(input.recipientsText), ...parseLeads(input.fileText)])];
    if (!input.subject.trim() || !input.body.trim() || !recipients.length || !input.senderId || !input.startTime) {
      setNotice("Complete the subject, message, recipients, sender and schedule time."); return;
    }
    setBusy(true); setNotice("");
    try {
      const result = await api.createCampaign({ subject: input.subject, body: input.body, recipients, senderId: input.senderId, startTime: new Date(input.startTime).toISOString(), delayBetweenEmails: Number(input.delay), hourlyLimit: Number(input.hourlyLimit) });
      setNotice(`Campaign created: ${result.total} emails scheduled.`); await refresh(); setPage("emails"); setTab("scheduled");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Scheduling failed"); }
    finally { setBusy(false); }
  }

  if (authLoading) return <div className="loading-screen"><span className="loader"/>Checking your session...</div>;
  if (!user) return <LoginPage apiBase={apiBase} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setPage("dashboard")} aria-label="ReachInbox dashboard"><span className="brand-mark">R</span><span>reachinbox</span></button>
      <div className="profile-mini">{user.avatar ? <img src={user.avatar} alt=""/> : <span className="avatar-fallback">{user.name?.[0]?.toUpperCase() || "U"}</span>}<div><strong>{user.name}</strong><small>{user.email}</small></div></div>
      <button className="compose-nav" onClick={() => { setNotice(""); setPage("compose"); }}>＋ <span>Compose</span></button>
      <div className="nav-label">WORKSPACE</div>
      <button className={`nav-item ${page === "dashboard" ? "active" : ""}`} onClick={() => setPage("dashboard")}><span className="nav-symbol">▦</span>Dashboard</button>
      <div className="nav-label">EMAILS</div>
      <button className={`nav-item ${page === "emails" && tab === "scheduled" ? "active" : ""}`} onClick={() => { setPage("emails"); setTab("scheduled"); }}><span className="nav-symbol">◷</span>Scheduled <span className="nav-count">{scheduled.length}</span></button>
      <button className={`nav-item ${page === "emails" && tab === "sent" ? "active" : ""}`} onClick={() => { setPage("emails"); setTab("sent"); }}><span className="nav-symbol">➤</span>Sent <span className="nav-count">{sent.length}</span></button>
      <div className="sidebar-bottom"><div className="integration-title">INTEGRATIONS</div><a className="nav-item link-nav" href={`${apiBase}/api/slack/connect`}>◉ Connect Slack</a><button className="nav-item" onClick={() => void testSlack()} disabled={busy}>↗ Test Slack</button><button className="nav-item" onClick={() => void addSender()}>＋ Add sender</button><div className="sidebar-footer"><button onClick={() => window.open(`${apiBase}/admin/queues`, "_blank")}>Queue monitor ↗</button><button onClick={() => void logout()} disabled={loggingOut}>↪ {loggingOut ? "Signing out..." : "Log out"}</button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><span className="topbar-kicker">REACHINBOX WORKSPACE</span><span className="topbar-title">{page === "compose" ? "Compose new email" : page === "emails" ? (tab === "scheduled" ? "Scheduled emails" : "Sent emails") : "Overview"}</span></div><div className="topbar-right"><span className="online-dot"/> Workspace active <button className="refresh-button" onClick={() => void refresh()} title="Refresh">↻</button></div></header>
      {notice && <div className="notice-banner">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
      {page === "dashboard" && <DashboardPage scheduled={scheduled} sent={sent} senders={senders} loading={loading} onCompose={() => setPage("compose")} onViewEmails={(next) => { setTab(next); setPage("emails"); }} />}
      {page === "emails" && <EmailsPage tab={tab} setTab={setTab} rows={rows} loading={loading || searchLoading} search={search} setSearch={setSearch} onRefresh={() => void refresh()} />}
      {page === "compose" && <ComposePage senders={senders} busy={busy} onCancel={() => setPage("dashboard")} onSubmit={scheduleCampaign} />}
      <footer className="app-footer"><span>ReachInbox · Email operations</span><span><a href={`${apiBase}/api/health`} target="_blank" rel="noreferrer">API status ↗</a></span></footer>
    </main>
  </div>;
}
