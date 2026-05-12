"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

const CONSULTANT_OPTIONS = ["Consultant 1", "Consultant 2", "Consultant 3"];
function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getNextAction(lastContact: string | null) {
  if (!lastContact) return "Contact Now";

  const today = new Date();
  const last = new Date(lastContact);

  const diffDays = Math.floor(
    (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays >= 3) return "OVERDUE — CALL NOW";
  if (diffDays === 2) return "Follow Up Today";
  if (diffDays === 1) return "Check Soon";
  return "Up to Date";
}

function badgeColor(value: string) {
  if (value?.includes("OVERDUE")) return "#dc2626";
  if (value === "Follow Up Today") return "#f97316";
  if (value === "Check Soon") return "#ca8a04";
  if (value === "Up to Date" || value === "Won" || value === "Followed Up")
    return "#16a34a";
  if (value === "Lost") return "#dc2626";
  if (value === "Viewing Scheduled") return "#2563eb";
  if (value === "Offer Made") return "#7c3aed";
  return "#64748b";
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [selectedConsultant, setSelectedConsultant] = useState<string>("All");
  const [consultants, setConsultants] = useState<string[]>([]);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const popSoundRef = useRef<HTMLAudioElement | null>(null);
  const countdownSoundRef = useRef<HTMLAudioElement | null>(null);
  const finalSoundRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    popSoundRef.current = new Audio("/pop.mp3");
    countdownSoundRef.current = new Audio("/countdown-pop.mp3");
    finalSoundRef.current = new Audio("/final-droop-pop.mp3");
  }, []);
  function playSound(
    soundRef: React.RefObject<HTMLAudioElement | null>,
    options?: { volume?: number; playbackRate?: number },
  ) {
    const baseSound = soundRef.current;
    if (!baseSound) return;

    const sound = baseSound.cloneNode(true) as HTMLAudioElement;
    sound.volume = options?.volume ?? 1;
    sound.playbackRate = options?.playbackRate ?? 1;
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  const [leads, setLeads] = useState<Lead[]>([]);
  const [name, setName] = useState("");
  const [consultant, setConsultant] = useState("");
  const [phone, setPhone] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [lastContact, setLastContact] = useState("");
  const [status, setStatus] = useState("New");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [toast, setToast] = useState("");
  const [undoLead, setUndoLead] = useState<Lead | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(5);
  const [closeVisible, setCloseVisible] = useState(false);
  const [undoSeconds, setUndoSeconds] = useState(0);
  const [newConsultantName, setNewConsultantName] = useState("");
  const [consultantToDelete, setConsultantToDelete] = useState("");
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const undoRunRef = useRef(0);
  const toastClearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const undoStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalPlayedRef = useRef(false);
  function stopUndoSequence() {
    undoRunRef.current += 1;

    if (toastTimerRef.current) {
      clearInterval(toastTimerRef.current);
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    if (toastClearTimeoutRef.current) {
      clearTimeout(toastClearTimeoutRef.current);
      toastClearTimeoutRef.current = null;
    }

    if (undoStartTimeoutRef.current) {
      clearTimeout(undoStartTimeoutRef.current);
      undoStartTimeoutRef.current = null;
    }

    if (popSoundRef.current) {
      popSoundRef.current.pause();
      popSoundRef.current.currentTime = 0;
    }

    if (countdownSoundRef.current) {
      countdownSoundRef.current.pause();
      countdownSoundRef.current.currentTime = 0;
    }

    if (finalSoundRef.current) {
      finalSoundRef.current.pause();
      finalSoundRef.current.currentTime = 0;
    }

    setUndoSeconds(0);
  }

  function showToast(message: string) {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      clearInterval(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setToast(message);

    playSound(popSoundRef, { volume: 1 });

    toastTimerRef.current = setTimeout(() => {
      setToast("");
      setUndoLead(null);
      setUndoSeconds(0);
    }, 5000);
  }

  function showUndoToast(message: string) {
    stopUndoSequence();

    const runId = undoRunRef.current;

    if (toastTimerRef.current) {
      clearInterval(toastTimerRef.current);
    }

    if (toastClearTimeoutRef.current) {
      clearTimeout(toastClearTimeoutRef.current);
    }

    setToast(message);
    setUndoSeconds(5);
    playSound(popSoundRef, { volume: 1 });
    finalPlayedRef.current = false;

    let secondsLeft = 5;

    toastTimerRef.current = setInterval(() => {
      secondsLeft -= 1;

      setUndoSeconds(secondsLeft);

      if (secondsLeft > 0) {
        playSound(countdownSoundRef, {
          volume: 0.04,
          playbackRate: 1,
        });
      }

      if (secondsLeft <= 0) {
        clearInterval(toastTimerRef.current!);
        toastTimerRef.current = null;

        if (!finalPlayedRef.current) {
          finalPlayedRef.current = true;

          playSound(finalSoundRef, {
            volume: 0.07,
            playbackRate: 0.75,
          });
        }

        setTimeout(() => {
          setToast("");
          setUndoLead(null);
          setUndoSeconds(0);
        }, 700);
      }
    }, 1000);
  }

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

  async function fetchRole(userId: string) {
    console.log("Fetching role for user:", userId);
    const { data, error } = await supabase
      .from("profiles")
      .select("role, consultant_name")
      .eq("id", userId)
      .maybeSingle();

    console.log("Profile result:", data, error);

    if (error) {
      console.error("Error fetching role:", error);
      return;
    }

    if (data) {
      setRole(data.role);
      setConsultant(data.consultant_name || "");
    } else {
      console.warn("No profile found for user");
    }
  }

  async function fetchConsultants() {
    const { data, error } = await supabase
      .from("consultants")
      .select("name")
      .eq("active", true)
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setConsultants(data.map((c) => c.name));
  }

  async function addConsultant() {
    if (!newConsultantName.trim()) {
      alert("Please enter a consultant name.");
      return;
    }
    const cleanName = newConsultantName.trim();
    const exists = consultants.some(
      (c) => c.toLowerCase() === cleanName.toLowerCase(),
    );

    if (exists) {
      alert("This consultant already exists.");
      return;
    }

    const { error } = await supabase.from("consultants").insert({
      name: cleanName,
      active: true,
    });

    if (error) return alert("Error adding consultant");

    setNewConsultantName("");
    fetchConsultants();
    showToast("Consultant added");
  }

  async function deleteConsultant(name: string) {
    const { error } = await supabase
      .from("consultants")
      .update({ active: false })
      .eq("name", name);

    if (error) return alert("Error deleting consultant");

    fetchConsultants();
    showToast("Consultant removed");
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
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanRef = referenceNumber.trim();
    if (!cleanName || !consultant || !cleanPhone || !cleanRef) {
      alert("Please fill in all required fields before adding a lead.");
      return;
    }

    const { error } = await supabase.from("leads").insert({
      name: cleanName,
      consultant,
      phone: cleanPhone,
      reference_number: cleanRef,
      last_contact: lastContact || null,
      next_action: getNextAction(lastContact || null),
      status,
      user_id: user!.id,
    });

    if (error) return alert("Error adding lead");

    setName("");
    setConsultant("");
    setPhone("");
    setReferenceNumber("");
    setLastContact("");
    setStatus("New");

    fetchLeads();
    showToast("Lead added successfully");
  }

  async function deleteLead(lead: Lead) {
    setUndoLead(lead);

    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) return alert("Error deleting lead");

    fetchLeads();
    showUndoToast("Lead deleted");
  }

  async function updateLeadName(id: string, newName: string) {
  setLeads((prev) =>
    prev.map((lead) =>
      lead.id === id ? { ...lead, name: newName } : lead
    )
  );

  const { error } = await supabase
    .from("leads")
    .update({ name: newName })
    .eq("id", id);

  if (error) {
    alert("Error updating lead name");
    fetchLeads();
  }
}

async function updateLeadPhone(id: string, newPhone: string) {
  setLeads((prev) =>
    prev.map((lead) =>
      lead.id === id ? { ...lead, phone: newPhone } : lead
    )
  );

  const { error } = await supabase
    .from("leads")
    .update({ phone: newPhone })
    .eq("id", id);

  if (error) {
    alert("Error updating lead phone");
    fetchLeads();
  }
}

async function updateLeadConsultant(id: string, newConsultant: string) {
  setLeads((prev) =>
    prev.map((lead) =>
      lead.id === id ? { ...lead, consultant: newConsultant } : lead
    )
  );

  const { error } = await supabase
    .from("leads")
    .update({ consultant: newConsultant })
    .eq("id", id);

  if (error) {
    alert("Error updating consultant");
    fetchLeads();
  }
}

  async function undoDelete() {
    stopUndoSequence();

    if (!undoLead) return;

    const { error } = await supabase.from("leads").insert(undoLead);
    if (error) return alert("Error restoring lead");

    setUndoLead(null);
    setUndoSeconds(0);
    fetchLeads();
    showToast("Lead restored");
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
    showToast("Lead marked contacted");
  }

  async function openWhatsApp(lead: Lead) {
  const phone = lead.phone;
    if (!phone) {
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

    const cleanPhone = phone.replace(/\D/g, "");
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );

    fetchLeads();
    showToast("WhatsApp follow-up opened");
  }

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) return alert("Error updating status");

    fetchLeads();
    showToast("Status updated");
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        fetchRole(data.user.id);
        fetchConsultants();
        fetchLeads();
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
        if (session?.user) {
          fetchRole(session.user.id);
          fetchConsultants();
          fetchLeads();
        } else {
          setRole(null);
          setLeads([]);
        }
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);
  const followUps = leads.filter(
    (l) =>
      l.next_action === "OVERDUE — CALL NOW" ||
      l.next_action === "Follow Up Today",
  );

  const overdue = leads.filter(
    (l) => l.next_action === "OVERDUE — CALL NOW",
  ).length;

  const won = leads.filter((l) => l.status === "Won").length;
  const consultantNames = Array.from(new Set(leads.map((l) => l.consultant)));
  const consultantStats = consultantNames.map((name) => {
    const consultantLeads = leads.filter((lead) => lead.consultant === name);

    return {
      name,
      total: consultantLeads.length,
      followUps: consultantLeads.filter(
        (lead) =>
          lead.next_action === "OVERDUE — CALL NOW" ||
          lead.next_action === "Follow Up Today",
      ).length,
      overdue: consultantLeads.filter(
        (lead) => lead.next_action === "OVERDUE — CALL NOW",
      ).length,
      won: consultantLeads.filter((lead) => lead.status === "Won").length,
    };
  });
  const filteredLeads = leads
    .filter((lead) => {
      // 🔐 ROLE FILTER (THIS IS THE NEW PART)
      if (role === "consultant") {
        return lead.consultant === consultant;
      }

      if (selectedConsultant !== "All") {
        return lead.consultant === selectedConsultant;
      }

      return true; // manager sees all
    })
    .filter((lead) => {
      // 🔍 existing search filter
      const matchesSearch =
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.phone || "").includes(searchTerm);

      const matchesStatus =
        statusFilter === "All" || lead.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

  if (!user) {
    return (
      <main className="loginPage">
        <div className="loginCard">
          <h1 style={{ marginBottom: "8px" }}>LeadFlow</h1>

          <p
            style={{
              color: "#64748b",
              fontSize: "14px",
              marginBottom: "20px",
            }}
          >
            Real estate follow-up system
          </p>

          <input
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            placeholder="Email"
            style={{
              width: "100%",
              padding: "10px 12px",
              marginBottom: "10px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
            }}
          />

          <input
            type="password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder="Password"
          />

          <button
            onClick={logIn}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#4f46e5",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: "8px",
            }}
          >
            Log In
          </button>

          <button
            onClick={signUp}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              backgroundColor: "white",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Sign Up
          </button>
        </div>

        <GlobalStyles />
      </main>
    );
  }

  const thLeft = {
    textAlign: "left" as const,
    padding: "12px",
    fontWeight: 600,
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
  };

  const thCenter = {
    textAlign: "center" as const,
    padding: "12px",
    fontWeight: 600,
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
  };

  const tdLeft = {
    textAlign: "left" as const,
    padding: "12px",
    borderBottom: "1px solid #f1f5f9",
  };

  const tdCenter = {
    textAlign: "center" as const,
    padding: "12px",
    borderBottom: "1px solid #f1f5f9",
    fontWeight: 500,
  };

  if (!user) {
    return <div>Loading user...</div>;
  }

  if (!role) {
    return <div>Loading role...</div>;
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <h1 className="brandTitle">LeadFlow</h1>

        <div className="navList">
          <div className="navText active">Dashboard</div>
          <div className="navText">Follow-Ups</div>
          <div className="navText">Leads</div>
          <div className="navText">Consultants</div>
        </div>
      </aside>

      <section className="content">
        <header className="header">
          <div>
            <h1 className="pageTitle">Dashboard</h1>
            {role === "manager" && (
              <div className="fieldGroup">
                <label className="mutedLabel">Manager View</label>

                <select
                  value={selectedConsultant}
                  onChange={(e) => setSelectedConsultant(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#f9fafb",
                    fontSize: "14px",
                    minWidth: "220px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="All">All Consultants</option>
                  {consultantNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p>Logged in as: {role}</p>
            <p>Manage leads, follow-ups, and consultant activity.</p>
          </div>

          <button className="darkButton" onClick={logOut}>
            Log Out
          </button>
        </header>

        <div className="cards">
          <Card label="Total Leads" value={leads.length} />
          <Card
            label="Urgent Follow-Ups"
            value={followUps.length}
            color="#f97316"
          />
          <Card label="Overdue" value={overdue} color="#dc2626" />
          <Card label="Won Deals" value={won} color="#16a34a" />
        </div>

        {role === "manager" && (
          <div className="panel" style={{ marginTop: "24px", padding: "24px" }}>
            <h2 className="sectionTitle">Team Performance</h2>

            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: "0",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  <th style={thLeft}>Consultant</th>
                  <th style={thCenter}>Total Leads</th>
                  <th style={thCenter}>Follow-Ups</th>
                  <th style={thCenter}>Overdue</th>
                  <th style={thCenter}>Won Deals</th>
                </tr>
              </thead>

              <tbody>
                {consultantStats.map((stat, index) => (
                  <tr
                    key={stat.name}
                    onClick={() =>
                      setSelectedConsultant(
                        selectedConsultant === stat.name ? "All" : stat.name,
                      )
                    }
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f1f5f9";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        selectedConsultant === stat.name
                          ? "#eef2ff"
                          : index % 2 === 0
                            ? "#ffffff"
                            : "#f9fafb";
                    }}
                    style={{
                      cursor: "pointer",
                      backgroundColor:
                        selectedConsultant === stat.name
                          ? "#eef2ff"
                          : index % 2 === 0
                            ? "#ffffff"
                            : "#f9fafb",
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <td style={tdLeft}>{stat.name}</td>
                    <td style={tdCenter}>{stat.total}</td>
                    <td style={tdCenter}>{stat.followUps}</td>
                    <td style={tdCenter}>{stat.overdue}</td>
                    <td style={tdCenter}>{stat.won}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <section
          className="panel"
          style={{
            marginBottom: "28px",
            padding: "24px",
            borderRadius: "16px",
            backgroundColor: "#ffffff",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
            border: "1px solid #eef2f7",
          }}
        >
          {role === "manager" && (
            <div style={{ marginBottom: "28px" }}>
              <h2 style={{ marginBottom: "16px" }}>Manage Consultants</h2>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginBottom: "24px",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  placeholder="New consultant name"
                  value={newConsultantName}
                  onChange={(e) => setNewConsultantName(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    flex: 1,
                    fontSize: "14px",
                  }}
                />

                <button
                  onClick={addConsultant}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#1d4ed8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#2563eb";
                  }}
                  style={{
                    backgroundColor: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                  }}
                >
                  Add Consultant
                </button>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontWeight: 600,
                  }}
                >
                  Remove Existing Consultant
                </label>

                <div
                  style={{ display: "flex", gap: "10px", alignItems: "center" }}
                >
                  <select
                    value={consultantToDelete}
                    onChange={(e) => setConsultantToDelete(e.target.value)}
                  >
                    <option value="">Select consultant...</option>
                    {consultants.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => deleteConsultant(consultantToDelete)}
                    style={{
                      backgroundColor: "#dc2626",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
          <h2>Add Lead</h2>

          <div
            className="formGrid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "16px",
            }}
          >
            <input
              type="text"
              placeholder="Client name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.border = "1px solid #2563eb";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid #d1d5db";
              }}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                width: "100%",
                fontSize: "14px",
                backgroundColor: "#f9fafb",
                outline: "none",
              }}
            />

            <select
              value={consultant}
              onChange={(e) => setConsultant(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.border = "1px solid #2563eb";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid #d1d5db";
              }}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                width: "100%",
                fontSize: "14px",
                backgroundColor: "#f9fafb",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="">Select Consultant</option>
              {consultants.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.border = "1px solid #2563eb";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid #d1d5db";
              }}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                width: "100%",
                fontSize: "14px",
                backgroundColor: "#f9fafb",
              }}
            />

            <input
              type="text"
              placeholder="Reference number"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.border = "1px solid #2563eb";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid #d1d5db";
              }}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                width: "100%",
                fontSize: "14px",
                backgroundColor: "#f9fafb",
              }}
            />

            <input
              type="date"
              value={lastContact}
              onChange={(e) => setLastContact(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.border = "1px solid #2563eb";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid #d1d5db";
              }}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #d1d5db",
                width: "100%",
                fontSize: "14px",
                backgroundColor: "#f9fafb",
              }}
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                width: "100%",
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={addLead}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#15803d";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#16a34a";
            }}
            style={{
              backgroundColor: "#16a34a",
              color: "white",
              border: "none",
              borderRadius: "10px",
              padding: "10px 16px",
              fontWeight: 600,
              cursor: "pointer",
              marginTop: "10px",
              transition: "background-color 0.15s ease",
            }}
          >
            Add Lead
          </button>
        </section>

        <section className="panel" style={{ marginBottom: "24px" }}>
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
  updateLeadName={updateLeadName}
  updateLeadPhone={updateLeadPhone}
updateLeadConsultant={updateLeadConsultant}
/>
          ))}
        </section>

        <section className="panel" style={{ marginBottom: "24px" }}>
          <h2>Consultant Scoreboard</h2>

          {consultantNames.map((person) => {
            const personLeads = leads.filter((l) => l.consultant === person);

            return (
              <div className="scoreRow" key={person}>
                <strong>{person}</strong>
                <span>{personLeads.length} leads</span>
              </div>
            );
          })}
        </section>

        <section className="panel" style={{ marginBottom: "24px" }}>
          <h2>All Leads</h2>

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 1 }}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {filteredLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              updateStatus={updateStatus}
              markContacted={markContacted}
              openWhatsApp={openWhatsApp}
              deleteLead={deleteLead}
              updateLeadName={updateLeadName}
              updateLeadPhone={updateLeadPhone}
updateLeadConsultant={updateLeadConsultant}
            />
          ))}
        </section>
      </section>

      {toast && (
        <div
          className="toast relative inline-flex items-center gap-3 px-5 py-3 animate-toastIn"
          onMouseEnter={() => setCloseVisible(true)}
          onMouseLeave={() => setCloseVisible(false)}
        >
          <span>{toast}</span>

          <div>
            {undoLead && (
              <button
                key={undoLead?.id}
                className="undoButton"
                onClick={undoDelete}
              >
                <span>Undo ({undoSeconds})</span>
              </button>
            )}

            <button
              onClick={() => {
                stopUndoSequence();
                setToast("");
                setUndoLead(null);
                setUndoSeconds(0);
              }}
              aria-label="Close toast"
              style={{
                position: "absolute",
                top: "-6px", // ↓ moves it DOWN slightly
                right: "-7px", // ← moves it LEFT slightly
                width: "16px",
                height: "16px",
                borderRadius: "999px",
                border: "1px solid rgba(0,0,0,0.16)",
                background: "rgba(245,245,245,0.72)",
                color: "rgba(40,40,40,0.65)",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                opacity: closeVisible ? 0.75 : 0.35,
                boxShadow: "0 2px 6px rgba(0,0,0,0.16)",
                backdropFilter: "blur(6px)",
                transition: "all 0.16s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.transform = "scale(1.16)";
                e.currentTarget.style.background = "rgba(255,255,255,0.95)";
                e.currentTarget.style.boxShadow =
                  "0 0 10px rgba(255,255,255,0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = closeVisible ? "0.75" : "0.35";
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.background = "rgba(245,245,245,0.72)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.16)";
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                style={{
                  display: "block",
                }}
              >
                <line
                  x1="2"
                  y1="2"
                  x2="10"
                  y2="10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <line
                  x1="10"
                  y1="2"
                  x2="2"
                  y2="10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <GlobalStyles />
    </main>
  );
}

function Card({
  label,
  value,
  color = "#0f172a",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      className="card"
      style={{
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
        border: "1px solid #eef2f7",
      }}
    >
      <div
        className="cardLabel"
        style={{
          fontSize: "14px",
          color: "#64748b",
          marginBottom: "14px",
        }}
      >
        {label}
      </div>

      <div
        className="cardValue"
        style={{
          color,
          fontSize: "34px",
          fontWeight: 700,
          letterSpacing: "-0.03em",
        }}
      >
        <span className="statNumber" style={{ color }}>
          {value}
        </span>
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  updateStatus,
  markContacted,
  openWhatsApp,
  deleteLead,
  updateLeadName,
  updateLeadPhone,
updateLeadConsultant,
}: {
  lead: Lead;
  updateStatus: (id: string, status: string) => void;
  markContacted: (id: string) => void;
  openWhatsApp: (lead: Lead) => void;
  deleteLead: (lead: Lead) => void;
  updateLeadName: (id: string, newName: string) => void;
  updateLeadPhone: (id: string, newPhone: string) => void;
updateLeadConsultant: (id: string, newConsultant: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
const [editName, setEditName] = useState(lead.name);
const [editPhone, setEditPhone] = useState(lead.phone || "");
const [editConsultant, setEditConsultant] = useState(lead.consultant || "");
  return (
    <div className="leadCard">
      <div>
        {isEditing ? (
  <div>
    <input
      value={editName}
      onChange={(e) => setEditName(e.target.value)}
      className="editInput"
      autoFocus
    />

<input
  value={editPhone}
  onChange={(e) => setEditPhone(e.target.value)}
  className="editInput"
  placeholder="Phone"
/>

<input
  value={editConsultant}
  onChange={(e) => setEditConsultant(e.target.value)}
  className="editInput"
  placeholder="Consultant"
/>

    <div className="editActions">
      <button
        className="secondaryButton"
        onClick={() => {
  updateLeadName(lead.id, editName);
  updateLeadPhone(lead.id, editPhone);
  updateLeadConsultant(lead.id, editConsultant);
  setIsEditing(false);
}}
      >
        Save
      </button>

      <button
        className="secondaryButton"
        onClick={() => setIsEditing(false)}
      >
        Cancel
      </button>
    </div>
  </div>
) : (
  <strong className="leadName">{lead.name}</strong>
)}
        <p>Consultant: {lead.consultant}</p>
        <p>Phone: {lead.phone || "No phone"}</p>
        <p>Ref: {lead.reference_number || "N/A"}</p>

        <span
          className="badge"
          style={{ background: badgeColor(lead.next_action) }}
        >
          {lead.next_action}
        </span>

        <span
          className="badge"
          style={{ background: badgeColor(lead.status), marginLeft: 8 }}
        >
          {lead.status}
        </span>
      </div>

      <div className="actions">
        <select
          value={lead.status || "New"}
          onChange={(e) => updateStatus(lead.id, e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <button
          className="secondaryButton"
          onClick={() => markContacted(lead.id)}
        >
          Mark Contacted
        </button>

        <button className="whatsappButton" onClick={() => openWhatsApp(lead)}>
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
            alt="WhatsApp"
          />
          WhatsApp
        </button>

<button
  className="secondaryButton"
  onClick={() => {
    setEditName(lead.name);
setEditPhone(lead.phone || "");
setEditConsultant(lead.consultant || "");
setIsEditing(true);
  }}
>
  Edit
</button>

        <button className="deleteButton" onClick={() => deleteLead(lead)}>
          Delete
        </button>
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
        background: #f3f6fb;
      }

      button,
      input,
      select {
        transition: all 0.2s ease;
      }

      button {
        cursor: pointer;
      }

      button:hover {
        transform: translateY(-1px);
        opacity: 0.92;
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.12);
      }

      input,
      select {
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

      .cards {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 24px;
      }

      .panel {
        background: white;
        border-radius: 16px;
        padding: 28px;
        box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
        border: 1px solid #eef2f7;
      }
      .card {
        background: white;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06);
        border: 1px solid #eef2f7;
        transition:
          transform 0.15s ease,
          box-shadow 0.15s ease;
      }

      .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
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
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
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

      .toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: #0f172a;
        color: white;
        padding: 14px 18px;
        border-radius: 12px;
        display: flex;
        gap: 14px;
        align-items: center;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        z-index: 999;
      }

      .toast button {
        background: #facc15;
        color: #0f172a;
        border: none;
        padding: 8px 10px;
        border-radius: 8px;
        font-weight: bold;
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
