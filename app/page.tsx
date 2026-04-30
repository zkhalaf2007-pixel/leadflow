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
  last_contact: string | null;
  next_action: string;
  status: string;
  user_id: string;
};

const STATUS_OPTIONS = [
  "New",
  "Contacted",
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

function getActionColor(action: string) {
  if (action === "OVERDUE — CALL NOW") return "red";
  if (action === "Follow Up Today") return "orange";
  if (action === "Check Soon") return "goldenrod";
  if (action === "Up to Date") return "green";
  return "black";
}

function getStatusColor(status: string) {
  if (status === "Won") return "green";
  if (status === "Lost") return "red";
  if (status === "Offer Made") return "purple";
  if (status === "Viewing Scheduled") return "blue";
  if (status === "Contacted") return "orange";
  return "gray";
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [name, setName] = useState("");
  const [consultant, setConsultant] = useState("");
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
      last_contact: lastContact || null,
      next_action: getNextAction(lastContact || null),
      status,
      user_id: user.id,
    });

    if (error) return alert("Error adding lead");

    setName("");
    setConsultant("");
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
        next_action: getNextAction(today),
        status: "Contacted",
      })
      .eq("id", id);

    if (error) return alert("Error updating lead");
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
      <main style={{ padding: 20, fontFamily: "Arial" }}>
        <h1>LeadFlow Login</h1>

        <input
          value={authEmail}
          onChange={(e) => setAuthEmail(e.target.value)}
          placeholder="Email"
          style={{ padding: 8, marginRight: 8 }}
        />

        <input
          type="password"
          value={authPassword}
          onChange={(e) => setAuthPassword(e.target.value)}
          placeholder="Password"
          style={{ padding: 8, marginRight: 8 }}
        />

        <button onClick={logIn}>Log In</button>
        <button onClick={signUp} style={{ marginLeft: 8 }}>
          Sign Up
        </button>
      </main>
    );
  }

  const totalLeads = leads.length;
  const overdueLeads = leads.filter((l) => l.next_action === "OVERDUE — CALL NOW").length;
  const needsAction = leads.filter(
    (l) => l.next_action === "Follow Up Today" || l.next_action === "Check Soon"
  ).length;
  const upToDate = leads.filter((l) => l.next_action === "Up to Date").length;
  const wonLeads = leads.filter((l) => l.status === "Won").length;
  const lostLeads = leads.filter((l) => l.status === "Lost").length;

  const followUps = leads.filter(
    (l) => l.next_action === "OVERDUE — CALL NOW" || l.next_action === "Follow Up Today"
  );

  const consultants = Array.from(new Set(leads.map((l) => l.consultant)));

  return (
    <main style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>LeadFlow</h1>

      <div style={{ marginBottom: 20 }}>
        Logged in as: <strong>{user.email}</strong>
        <button onClick={logOut} style={{ marginLeft: 10 }}>
          Log Out
        </button>
      </div>

      <h2>Dashboard</h2>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div><strong>Total Leads:</strong> {totalLeads}</div>
        <div style={{ color: "red" }}><strong>Overdue:</strong> {overdueLeads}</div>
        <div style={{ color: "orange" }}><strong>Needs Action:</strong> {needsAction}</div>
        <div style={{ color: "green" }}><strong>Up to Date:</strong> {upToDate}</div>
        <div style={{ color: "green" }}><strong>Won:</strong> {wonLeads}</div>
        <div style={{ color: "red" }}><strong>Lost:</strong> {lostLeads}</div>
      </div>

      <h2>Follow-Up Queue</h2>

      {followUps.length === 0 && <div>No urgent leads 🎉</div>}

      {followUps.map((lead) => (
        <div
          key={lead.id}
          style={{
            border: `2px solid ${getActionColor(lead.next_action)}`,
            padding: 12,
            marginBottom: 10,
            borderRadius: 8,
          }}
        >
          <strong>{lead.name}</strong>
          <div>Consultant: {lead.consultant}</div>
          <div style={{ color: getActionColor(lead.next_action), fontWeight: "bold" }}>
            {lead.next_action}
          </div>
          <button onClick={() => markContacted(lead.id)}>Mark Contacted</button>
        </div>
      ))}

      <h2>Consultant Scoreboard</h2>

      {consultants.length === 0 && <div>No consultant data yet.</div>}

      {consultants.map((person) => {
        const personLeads = leads.filter((l) => l.consultant === person);
        const personOverdue = personLeads.filter(
          (l) => l.next_action === "OVERDUE — CALL NOW"
        ).length;
        const personWon = personLeads.filter((l) => l.status === "Won").length;

        return (
          <div
            key={person}
            style={{
              border: "1px solid #ccc",
              padding: 10,
              marginBottom: 8,
              borderRadius: 8,
            }}
          >
            <strong>{person}</strong>
            <div>Total Leads: {personLeads.length}</div>
            <div style={{ color: "red" }}>Overdue Leads: {personOverdue}</div>
            <div style={{ color: "green" }}>Won Leads: {personWon}</div>
          </div>
        );
      })}

      <h2>Add Lead</h2>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Client name"
        style={{ padding: 6, marginRight: 8 }}
      />

      <input
        value={consultant}
        onChange={(e) => setConsultant(e.target.value)}
        placeholder="Consultant"
        style={{ padding: 6, marginRight: 8 }}
      />

      <input
        type="date"
        value={lastContact}
        onChange={(e) => setLastContact(e.target.value)}
        style={{ padding: 6, marginRight: 8 }}
      />

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        style={{ padding: 6, marginRight: 8 }}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>

      <button onClick={addLead}>Add</button>

      <h2>All Leads</h2>

      {leads.map((lead) => (
        <div
          key={lead.id}
          style={{
            border: "1px solid #ddd",
            padding: 12,
            marginBottom: 10,
            borderRadius: 8,
          }}
        >
          <strong>{lead.name}</strong>
          <div>Consultant: {lead.consultant}</div>
          <div>Last Contact: {lead.last_contact || "None"}</div>

          <div style={{ color: getActionColor(lead.next_action), fontWeight: "bold" }}>
            Next Action: {lead.next_action}
          </div>

          <div style={{ color: getStatusColor(lead.status), fontWeight: "bold" }}>
            Status: {lead.status || "New"}
          </div>

          <select
            value={lead.status || "New"}
            onChange={(e) => updateStatus(lead.id, e.target.value)}
            style={{ marginTop: 8, marginRight: 8 }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          <button onClick={() => markContacted(lead.id)}>Mark Contacted</button>

          <button
            onClick={() => deleteLead(lead.id)}
            style={{ marginLeft: 8, background: "red", color: "white" }}
          >
            Delete
          </button>
        </div>
      ))}
    </main>
  );
}