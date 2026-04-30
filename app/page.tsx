"use client";

import { useEffect, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Lead = {
  id: string;
  name: string;
  consultant: string;
  phone: string | null;
  last_contact: string | null;
  next_action: string;
  status: string;
  user_id: string;
};

const STATUS_OPTIONS = [
  "New",
  "Contacted",
  "Followed Up",
  "Viewing Scheduled",
  "Offer Made",
  "Won",
  "Lost",
];

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getNextAction(lastContact: string | null) {
  if (!lastContact) return "Contact Now";

  const today = new Date();
  const last = new Date(lastContact);
  const diffDays = Math.floor(
    (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays >= 3) return "OVERDUE — CALL NOW";
  if (diffDays === 2) return "Follow Up Today";
  if (diffDays === 1) return "Check Soon";
  return "Up to Date";
}

function badgeColor(value: string) {
  if (value.includes("OVERDUE")) return "#dc2626";
  if (value === "Follow Up Today") return "#f97316";
  if (value === "Check Soon") return "#ca8a04";
  if (value === "Up to Date" || value === "Won" || value === "Followed Up") return "#16a34a";
  if (value === "Lost") return "#dc2626";
  if (value === "Viewing Scheduled") return "#2563eb";
  if (value === "Offer Made") return "#7c3aed";
  return "#64748b";
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [name, setName] = useState("");
  const [consultant, setConsultant] = useState("");
  const [phone, setPhone] = useState("");
  const [lastContact, setLastContact] = useState("");
  const [status, setStatus] = useState("New");

  async function signUp() {
    const { error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
    });
    if (error) return alert(error.message);
    alert("Account created. Now log in.");
  }

  async function logIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) return alert(error.message);
  }

  async function logOut() {
    await supabase.auth.signOut();
    setUser(null);
    setLeads([]);
  }

  async function fetchLeads() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return alert("Error loading leads");
    setLeads(data || []);
  }

  async function addLead() {
    if (!name.trim() || !consultant.trim() || !user) return;

    const { error } = await supabase.from("leads").insert({
      name,
      consultant,
      phone,
      last_contact: lastContact || null,
      next_action: getNextAction(lastContact || null),
      status,
      user_id: user.id,
    });

    if (error) return alert("Error adding lead");

    setName("");
    setConsultant("");
    setPhone("");
    setLastContact("");
    setStatus("New");
    fetchLeads();
  }

  async function deleteLead(id: string) {
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) return alert("Error deleting lead");
    fetchLeads();
  }

  async function markContacted(id: string) {
    const today = getTodayDate();

    const { error } = await supabase
      .from("leads")
      .update({
        last_contact: today,
        next_action: "Up to Date",
        status: "Contacted",
      })
      .eq("id", id);

    if (error) return alert("Error updating lead");
    fetchLeads();
  }

  async function openWhatsApp(lead: Lead) {
    if (!lead.phone) {
      alert("No phone number saved for this lead");
      return;
    }

    const message =
      "Hello, how are you? I’m just checking to see if you’re still looking for an apartment.";

    await supabase
      .from("leads")
      .update({
        last_contact: getTodayDate(),
        next_action: "Up to Date",
        status: "Followed Up",
      })
      .eq("id", lead.id);

    const cleanPhone = lead.phone.replace(/\D/g, "");
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );

    fetchLeads();
  }

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) return alert("Error updating status");
    fetchLeads();
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) fetchLeads();
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
        if (session?.user) fetchLeads();
        else setLeads([]);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!user) {
    return (
      <main style={styles.loginPage}>
        <div style={styles.loginCard}>
          <h1 style={styles.logo}>LeadFlow</h1>
          <p style={styles.subtitle}>Real estate follow-up system</p>

          <input style={styles.input} value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email" />
          <input style={styles.input} type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Password" />

          <button style={styles.primaryButton} onClick={logIn}>Log In</button>
          <button style={styles.secondaryButton} onClick={signUp}>Sign Up</button>
        </div>
      </main>
    );
  }

  const totalLeads = leads.length;
  const overdue = leads.filter((l) => l.next_action === "OVERDUE — CALL NOW").length;
  const followUps = leads.filter((l) => l.next_action === "OVERDUE — CALL NOW" || l.next_action === "Follow Up Today");
  const won = leads.filter((l) => l.status === "Won").length;
  const consultants = Array.from(new Set(leads.map((l) => l.consultant)));

  return (
    <main style={styles.app}>
      <aside style={styles.sidebar}>
        <h1 style={styles.sidebarLogo}>LeadFlow</h1>
        <div style={styles.navItem}>Dashboard</div>
        <div style={styles.navItem}>Follow-Ups</div>
        <div style={styles.navItem}>Leads</div>
        <div style={styles.navItem}>Consultants</div>
      </aside>

      <section style={styles.content}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>Dashboard</h1>
            <p style={styles.subtitle}>Manage leads, follow-ups, and agent activity.</p>
          </div>
          <button onClick={logOut} style={styles.logout}>Log Out</button>
        </header>

        <div style={styles.cards}>
          <Card label="Total Leads" value={totalLeads} />
          <Card label="Urgent Follow-Ups" value={followUps.length} color="#f97316" />
          <Card label="Overdue" value={overdue} color="#dc2626" />
          <Card label="Won Deals" value={won} color="#16a34a" />
        </div>

        <section style={styles.panel}>
          <h2>Add Lead</h2>
          <div style={styles.formGrid}>
            <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" />
            <input style={styles.input} value={consultant} onChange={(e) => setConsultant(e.target.value)} placeholder="Consultant" />
            <input style={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone e.g. 97450123456" />
            <input style={styles.input} type="date" value={lastContact} onChange={(e) => setLastContact(e.target.value)} />
            <select style={styles.input} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <button style={styles.primaryButton} onClick={addLead}>Add Lead</button>
          </div>
        </section>

        <section style={styles.panel}>
          <h2>Follow-Up Queue</h2>
          {followUps.length === 0 && <p>No urgent leads 🎉</p>}
          {followUps.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              updateStatus={updateStatus}
              markContacted={markContacted}
              openWhatsApp={openWhatsApp}
              deleteLead={deleteLead}
            />
          ))}
        </section>

        <section style={styles.panel}>
          <h2>Consultant Scoreboard</h2>
          {consultants.map((person) => {
            const personLeads = leads.filter((l) => l.consultant === person);
            return (
              <div key={person} style={styles.scoreRow}>
                <strong>{person}</strong>
                <span>{personLeads.length} leads</span>
              </div>
            );
          })}
        </section>

        <section style={styles.panel}>
          <h2>All Leads</h2>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              updateStatus={updateStatus}
              markContacted={markContacted}
              openWhatsApp={openWhatsApp}
              deleteLead={deleteLead}
            />
          ))}
        </section>
      </section>
    </main>
  );
}

function Card({ label, value, color = "#0f172a" }: { label: string; value: number; color?: string }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={{ ...styles.cardValue, color }}>{value}</div>
    </div>
  );
}

function LeadCard({ lead, updateStatus, markContacted, openWhatsApp, deleteLead }: any) {
  return (
    <div style={styles.leadCard}>
      <div>
        <strong style={styles.leadName}>{lead.name}</strong>
        <p>Consultant: {lead.consultant}</p>
        <p>Phone: {lead.phone || "No phone"}</p>
        <span style={{ ...styles.badge, background: badgeColor(lead.next_action) }}>
          {lead.next_action}
        </span>
        <span style={{ ...styles.badge, background: badgeColor(lead.status), marginLeft: 8 }}>
          {lead.status}
        </span>
      </div>

      <div style={styles.actions}>
        <select style={styles.smallInput} value={lead.status || "New"} onChange={(e) => updateStatus(lead.id, e.target.value)}>
          {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>

        <button style={styles.secondaryButton} onClick={() => markContacted(lead.id)}>
          Mark Contacted
        </button>

        <button style={styles.whatsappButton} onClick={() => openWhatsApp(lead)}>
          🟢 WhatsApp
        </button>

        <button style={styles.deleteButton} onClick={() => deleteLead(lead.id)}>
          Delete
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "Arial" },
  sidebar: { width: 240, background: "#0f172a", color: "white", padding: 24 },
  sidebarLogo: { fontSize: 26, marginBottom: 30 },
  navItem: { padding: "12px 0", color: "#cbd5e1" },
  content: { flex: 1, padding: 32 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { margin: 0, fontSize: 32 },
  subtitle: { color: "#64748b" },
  cards: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 },
  card: { background: "white", padding: 20, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  cardLabel: { color: "#64748b", fontSize: 14 },
  cardValue: { fontSize: 32, fontWeight: "bold", marginTop: 8 },
  panel: { background: "white", padding: 24, borderRadius: 16, marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },
  input: { padding: 12, border: "1px solid #cbd5e1", borderRadius: 10 },
  smallInput: { padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" },
  primaryButton: { padding: 12, borderRadius: 10, border: "none", background: "#2563eb", color: "white", cursor: "pointer" },
  secondaryButton: { padding: 10, borderRadius: 10, border: "1px solid #cbd5e1", background: "white", cursor: "pointer" },
  logout: { padding: 10, borderRadius: 10, border: "none", background: "#0f172a", color: "white" },
  leadCard: { border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 16 },
  leadName: { fontSize: 18 },
  badge: { color: "white", padding: "5px 10px", borderRadius: 999, fontSize: 12, display: "inline-block" },
  actions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  whatsappButton: { padding: 10, borderRadius: 10, border: "none", background: "#16a34a", color: "white", cursor: "pointer" },
  deleteButton: { padding: 10, borderRadius: 10, border: "none", background: "#dc2626", color: "white", cursor: "pointer" },
  scoreRow: { display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", padding: "10px 0" },
  loginPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "Arial" },
  loginCard: { background: "white", padding: 32, borderRadius: 18, width: 360, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" },
  logo: { margin: 0, fontSize: 34 },
};