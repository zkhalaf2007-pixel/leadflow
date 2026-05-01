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
  reference_number: string | null;
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
  const [referenceNumber, setReferenceNumber] = useState("");
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
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", userData.user.id)
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
      reference_number: referenceNumber,
      last_contact: lastContact || null,
      next_action: getNextAction(lastContact || null),
      status,
      user_id: user.id,
    });

    if (error) return alert("Error adding lead");

    setName("");
    setConsultant("");
    setPhone("");
    setReferenceNumber("");
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

  const followUps = leads.filter(
    (l) =>
      l.next_action === "OVERDUE — CALL NOW" ||
      l.next_action === "Follow Up Today"
  );

  const overdue = leads.filter((l) => l.next_action === "OVERDUE — CALL NOW").length;
  const won = leads.filter((l) => l.status === "Won").length;
  const consultants = Array.from(new Set(leads.map((l) => l.consultant)));

  if (!user) {
    return (
      <main className="loginPage">
        <div className="loginCard">
          <h1>LeadFlow</h1>
          <p>Real estate follow-up system</p>

          <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email" />
          <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Password" />

          <button className="primaryButton" onClick={logIn}>Log In</button>
          <button className="secondaryButton" onClick={signUp}>Sign Up</button>
        </div>

        <GlobalStyles />
      </main>
    );
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <h1>LeadFlow</h1>
        <p>Dashboard</p>
        <p>Follow-Ups</p>
        <p>Leads</p>
        <p>Consultants</p>
      </aside>

      <section className="content">
        <header className="header">
          <div>
            <h1>Dashboard</h1>
            <p>Manage leads, follow-ups, and consultant activity.</p>
          </div>
          <button className="darkButton" onClick={logOut}>Log Out</button>
        </header>

        <div className="cards">
          <Card label="Total Leads" value={leads.length} />
          <Card label="Urgent Follow-Ups" value={followUps.length} color="#f97316" />
          <Card label="Overdue" value={overdue} color="#dc2626" />
          <Card label="Won Deals" value={won} color="#16a34a" />
        </div>

        <section className="panel">
          <h2>Add Lead</h2>
          <div className="formGrid">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" />
            <input value={consultant} onChange={(e) => setConsultant(e.target.value)} placeholder="Consultant" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone e.g. 97450123456" />
            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Reference Number" />
            <input type="date" value={lastContact} onChange={(e) => setLastContact(e.target.value)} />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <button className="primaryButton" onClick={addLead}>Add Lead</button>
          </div>
        </section>

        <section className="panel">
          <h2>Follow-Up Queue</h2>
          {followUps.length === 0 && <p>No urgent leads 🎉</p>}
          {followUps.map((lead) => (
            <LeadCard key={lead.id} lead={lead} updateStatus={updateStatus} markContacted={markContacted} openWhatsApp={openWhatsApp} deleteLead={deleteLead} />
          ))}
        </section>

        <section className="panel">
          <h2>Consultant Scoreboard</h2>
          {consultants.map((person) => {
            const personLeads = leads.filter((l) => l.consultant === person);
            return (
              <div className="scoreRow" key={person}>
                <strong>{person}</strong>
                <span>{personLeads.length} leads</span>
              </div>
            );
          })}
        </section>

        <section className="panel">
          <h2>All Leads</h2>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} updateStatus={updateStatus} markContacted={markContacted} openWhatsApp={openWhatsApp} deleteLead={deleteLead} />
          ))}
        </section>
      </section>

      <GlobalStyles />
    </main>
  );
}

function Card({ label, value, color = "#0f172a" }: { label: string; value: number; color?: string }) {
  return (
    <div className="card">
      <div className="cardLabel">{label}</div>
      <div className="cardValue" style={{ color }}>{value}</div>
    </div>
  );
}

function LeadCard({ lead, updateStatus, markContacted, openWhatsApp, deleteLead }: any) {
  return (
    <div className="leadCard">
      <div>
        <strong className="leadName">{lead.name}</strong>
        <p>Consultant: {lead.consultant}</p>
        <p>Phone: {lead.phone || "No phone"}</p>
        <p>Ref: {lead.reference_number || "N/A"}</p>

        <span className="badge" style={{ background: badgeColor(lead.next_action) }}>
          {lead.next_action}
        </span>

        <span className="badge" style={{ background: badgeColor(lead.status), marginLeft: 8 }}>
          {lead.status}
        </span>
      </div>

      <div className="actions">
        <select value={lead.status || "New"} onChange={(e) => updateStatus(lead.id, e.target.value)}>
          {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>

        <button className="secondaryButton" onClick={() => markContacted(lead.id)}>Mark Contacted</button>

        <button className="whatsappButton" onClick={() => openWhatsApp(lead)}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" />
          WhatsApp
        </button>

        <button className="deleteButton" onClick={() => deleteLead(lead.id)}>Delete</button>
      </div>
    </div>
  );
}

function GlobalStyles() {
  return (
    <style jsx global>{`
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #f8fafc;
      }

      button, select, input {
        transition: all 0.2s ease;
      }

      button {
        cursor: pointer;
      }

      button:hover {
        transform: translateY(-1px);
        opacity: 0.92;
        box-shadow: 0 6px 14px rgba(0,0,0,0.12);
      }

      input, select {
        padding: 12px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
      }

      .app {
        display: flex;
        min-height: 100vh;
      }

      .sidebar {
        width: 240px;
        background: #0f172a;
        color: white;
        padding: 24px;
      }

      .sidebar h1 {
        font-size: 26px;
        margin-bottom: 30px;
      }

      .sidebar p {
        color: #cbd5e1;
      }

      .content {
        flex: 1;
        padding: 32px;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
      }

      .header h1 {
        margin: 0;
        font-size: 32px;
      }

      .header p {
        color: #64748b;
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 24px;
      }

      .card, .panel, .leadCard, .loginCard {
        background: white;
        border-radius: 16px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      }

      .card {
        padding: 20px;
      }

      .cardLabel {
        color: #64748b;
        font-size: 14px;
      }

      .cardValue {
        font-size: 32px;
        font-weight: bold;
        margin-top: 8px;
      }

      .panel {
        padding: 24px;
        margin-bottom: 24px;
      }

      .formGrid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }

      .leadCard {
        border: 1px solid #e2e8f0;
        padding: 16px;
        margin-bottom: 12px;
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }

      .leadCard:hover {
        transform: scale(1.01);
        box-shadow: 0 8px 20px rgba(0,0,0,0.12);
      }

      .leadName {
        font-size: 18px;
      }

      .badge {
        color: white;
        padding: 5px 10px;
        border-radius: 999px;
        font-size: 12px;
        display: inline-block;
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .primaryButton {
        background: #2563eb;
        color: white;
        border: none;
        padding: 12px;
        border-radius: 10px;
      }

      .secondaryButton {
        background: white;
        border: 1px solid #cbd5e1;
        padding: 10px;
        border-radius: 10px;
      }

      .darkButton {
        background: #0f172a;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 10px;
      }

      .whatsappButton {
        background: #16a34a;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .whatsappButton img {
        width: 18px;
        height: 18px;
      }

      .deleteButton {
        background: #dc2626;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 10px;
      }

      .scoreRow {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px solid #e2e8f0;
        padding: 10px 0;
      }

      .loginPage {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .loginCard {
        padding: 32px;
        width: 360px;
      }

      .loginCard input {
        width: 100%;
        margin-bottom: 10px;
        box-sizing: border-box;
      }

      .loginCard button {
        margin-right: 8px;
      }
    `}</style>
  );
}