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
  const [consultants] = useState<string[]>([]);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const popSoundRef = useRef<HTMLAudioElement | null>(null);
  const finalDropSoundRef = useRef<HTMLAudioElement | null>(null);
  const countdownSoundRef = useRef<HTMLAudioElement | null>(null);
  const finalSoundRef = useRef<HTMLAudioElement | null>(null);
  const tickSoundRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    popSoundRef.current = new Audio("/pop.mp3");
    countdownSoundRef.current = new Audio("/countdown-pop.mp3");
    finalSoundRef.current = new Audio("/final-drop-pop.mp3");
    tickSoundRef.current = new Audio("/tick.mp3");
  }, []);
  function playSound(
    soundRef: React.RefObject<HTMLAudioElement | null>,
    options?: { volume?: number; playbackRate?: number },
  ) {
    const baseSound = soundRef.current;
    if (!baseSound?.src) return;

    const sound = new Audio(baseSound.src);
    const targetVolume = options?.volume ?? 1;

    sound.volume = 0;
    sound.playbackRate = options?.playbackRate ?? 1;
    sound.currentTime = 0;

    sound.play().catch((error) => {
      console.log("Sound failed:", error);
    });

    let volume = 0;

    const fadeIn = setInterval(() => {
      volume += targetVolume / 6;

      if (volume >= targetVolume) {
        sound.volume = targetVolume;
        clearInterval(fadeIn);
        return;
      }

      sound.volume = volume;
    }, 16);
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

  const [undoLead, setUndoLead] = useState<Lead | null>(null);
  const [toastState, setToastState] = useState<{
    id: number;
    message: string;
    type: "normal" | "undo" | "delete" | "restore";
    seconds: number;
  } | null>(null);
  const [addedToastStack, setAddedToastStack] = useState<
    { id: number; message: string }[]
  >([]);
  const [consultantNames, setConsultantNames] = useState<string[]>([]);
  const [addedToastDragX, setAddedToastDragX] = useState<
    Record<number, number>
  >({});
  const [exitingAddedToastIds, setExitingAddedToastIds] = useState<Set<number>>(
    new Set(),
  );
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  const addedToastDragStartRef = useRef<
    Record<
      number,
      {
        startClientX: number;
        startDragX: number;
        currentX: number;
        minX: number;
        maxX: number;
        startLeft: number;
        startRight: number;
      }
    >
  >({});
  const [toastExiting, setToastExiting] = useState(false);
  const [toastDragX, setToastDragX] = useState(0);
  const [toastDragging, setToastDragging] = useState(false);
  const [toastStartX, setToastStartX] = useState(0);
  const toastDragBoundsRef = useRef({
    minX: 0,
    maxX: 0,
    startLeft: 0,
    startRight: 0,
  });
  const [, setUndoSeconds] = useState(0);
  const [newConsultantName, setNewConsultantName] = useState("");
  const [consultantToDelete, setConsultantToDelete] = useState("");
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toastRunIdRef = useRef(0);
  const normalToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toastClearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalPlayedRef = useRef(false);
  const countdownSoundTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const finalToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const undoTickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [undoLeads, setUndoLeads] = useState<Lead[]>([]);
  function stopUndoSequence() {
    if (toastTimerRef.current) {
      clearInterval(toastTimerRef.current);
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    if (toastClearTimeoutRef.current) {
      clearTimeout(toastClearTimeoutRef.current);
      toastClearTimeoutRef.current = null;
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

    if (countdownSoundTimeoutRef.current) {
      clearTimeout(countdownSoundTimeoutRef.current);
      countdownSoundTimeoutRef.current = null;
    }

    if (finalToastTimeoutRef.current) {
      clearTimeout(finalToastTimeoutRef.current);
      finalToastTimeoutRef.current = null;
    }

    if (undoTickTimeoutRef.current) {
      clearTimeout(undoTickTimeoutRef.current);
      undoTickTimeoutRef.current = null;
    }
    setUndoSeconds(0);
  }

  function clearAllToastTimers() {
    toastRunIdRef.current += 1;

    if (toastTimerRef.current) clearInterval(toastTimerRef.current);
    if (normalToastTimerRef.current) clearTimeout(normalToastTimerRef.current);
    if (countdownSoundTimeoutRef.current)
      clearTimeout(countdownSoundTimeoutRef.current);
    if (finalToastTimeoutRef.current)
      clearTimeout(finalToastTimeoutRef.current);
    if (undoTickTimeoutRef.current) clearTimeout(undoTickTimeoutRef.current);

    toastTimerRef.current = null;
    normalToastTimerRef.current = null;
    countdownSoundTimeoutRef.current = null;
    finalToastTimeoutRef.current = null;
    undoTickTimeoutRef.current = null;
    finalPlayedRef.current = false;
  }

  function showToast(
    message: string,
    type: "normal" | "undo" | "delete" | "restore" = "normal",
  ) {
    clearAllToastTimers();

    const id = toastRunIdRef.current + 1;
    toastRunIdRef.current = id;

    setToastExiting(false);
    setToastDragX(0);

    setToastState({
      id,
      message,
      type,
      seconds: 5,
    });

    playSound(popSoundRef, { volume: 0.75, playbackRate: 1 });

    normalToastTimerRef.current = setTimeout(() => {
      if (toastRunIdRef.current !== id) return;

      // 🔥 Step 1: trigger exit animation
      setToastExiting(true);

      // 🔊 Step 2: play exit sound
      playSound(finalDropSoundRef, { volume: 0.8, playbackRate: 1 });

      // ⏱ Step 3: remove after animation
      setTimeout(() => {
        if (toastRunIdRef.current !== id) return;
        setToastState(null);
        setToastExiting(false);
      }, 220);
    }, 5000);
  }
  function showAddedToast(message: string) {
    const id = Date.now();

    setAddedToastStack((prev) => [...prev, { id, message }].slice(-5));

    playSound(popSoundRef, { volume: 0.75, playbackRate: 1 });
  }

  function dismissAddedToast(id: number) {
    setExitingAddedToastIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    playSound(finalDropSoundRef, { volume: 0.8, playbackRate: 1 });

    setTimeout(() => {
      setAddedToastStack((prev) => prev.filter((t) => t.id !== id));

      setAddedToastDragX((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

      setExitingAddedToastIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 220);
  }

  function showUndoToast(message: string) {
    clearAllToastTimers();

    const id = toastRunIdRef.current;
    let secondsLeft = 5;

    setToastDragX(0);
    setToastState({ id, message, type: "undo", seconds: secondsLeft });
    playSound(popSoundRef, { volume: 0.8, playbackRate: 1 });

    function tick() {
      if (toastRunIdRef.current !== id) return;

      secondsLeft -= 1;

      setToastState({ id, message, type: "undo", seconds: secondsLeft });

      if (secondsLeft > 0) {
        playSound(tickSoundRef, { volume: 0.1, playbackRate: 1 });

        countdownSoundTimeoutRef.current = setTimeout(() => {
          if (toastRunIdRef.current !== id) return;
          playSound(countdownSoundRef, { volume: 0.32, playbackRate: 1.03 });
        }, 40);

        undoTickTimeoutRef.current = setTimeout(tick, 1000);
        return;
      }

      playSound(finalSoundRef, { volume: 0.2, playbackRate: 0.9 });

      finalToastTimeoutRef.current = setTimeout(() => {
        if (toastRunIdRef.current !== id) return;
        setToastState(null);
        setUndoLead(null);
      }, 500);
    }

    undoTickTimeoutRef.current = setTimeout(tick, 1000);
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
    });

    if (error) return alert("Error adding consultant");

    setNewConsultantName("");
    fetchConsultants();
    showToast("Consultant added", "normal");
  }

  async function deleteConsultant(name: string) {
    const assignedLeadCount = leads.filter((lead) => lead.consultant === name).length;

if (assignedLeadCount > 0) {
  showToast(
    `${name} is assigned to ${assignedLeadCount} lead(s). Reassign them before deleting.`,
    "delete"
  );
  return;
}
    const { error } = await supabase
      .from("consultants")
      .delete()
      .eq("name", name);

    if (error) {
      console.error("Error deleting consultant:", error);
      return alert("Error deleting consultant");
    }

    // 🔑 Wait for fresh data from DB ONLY
    await fetchConsultants();

    showToast("Consultant removed", "delete");
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

  async function fetchConsultants() {
    const { data, error } = await supabase
      .from("consultants")
      .select("name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching consultants:", error);
      return;
    }

    setConsultantNames(data.map((c) => c.name));
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
    showAddedToast("Lead added successfully");
  }

  async function deleteLead(lead: Lead) {
    setUndoLead(lead);
    setUndoLeads([]);

    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) return alert("Error deleting lead");

    fetchLeads();
    showUndoToast("Lead deleted");
  }

  async function updateLeadName(id: string, newName: string) {
    setLeads((prev) =>
      prev.map((lead) => (lead.id === id ? { ...lead, name: newName } : lead)),
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
        lead.id === id ? { ...lead, phone: newPhone } : lead,
      ),
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
        lead.id === id ? { ...lead, consultant: newConsultant } : lead,
      ),
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
    if (undoLeads.length > 0) {
      const { error } = await supabase.from("leads").insert(undoLeads);

      if (error) return alert("Error restoring leads");

      setUndoLeads([]);
      setUndoLead(null);
      setUndoSeconds(0);
      fetchLeads();
      showToast(`${undoLeads.length} leads restored`, "restore");
      return;
    }
    if (!undoLead) return;

    const { error } = await supabase.from("leads").insert(undoLead);
    if (error) return alert("Error restoring lead");

    setUndoLead(null);
    setUndoSeconds(0);
    fetchLeads();
    showToast("Lead restored", "restore");
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
              <h2 style={{ marginBottom: "16px" }}>
  Manage Consultants ({consultantNames.length})
</h2>

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
                    {consultantNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
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
              {consultantNames.map((name) => (
                <option key={name} value={name}>
                  {name}
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

          {followUps.map((lead: Lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              selected={selectedLeadIds.includes(lead.id)}
              onToggleSelected={() => {
                setSelectedLeadIds((prev) =>
                  prev.includes(lead.id)
                    ? prev.filter((id) => id !== lead.id)
                    : [...prev, lead.id],
                );
              }}
              updateStatus={updateStatus}
              markContacted={markContacted}
              openWhatsApp={openWhatsApp}
              deleteLead={deleteLead}
              updateLeadName={updateLeadName}
              updateLeadPhone={updateLeadPhone}
              updateLeadConsultant={updateLeadConsultant}
              consultantNames={consultantNames}
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

          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 12,
              alignItems: "center",
            }}
          >
            <input
              type="checkbox"
              checked={
                selectedLeadIds.length === filteredLeads.length &&
                filteredLeads.length > 0
              }
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedLeadIds(filteredLeads.map((l) => l.id));
                } else {
                  setSelectedLeadIds([]);
                }
              }}
              style={{
                width: "18px",
                height: "18px",
                cursor: "pointer",
              }}
            />

            <span style={{ fontSize: "14px", opacity: 0.8 }}>Select All</span>

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

          {selectedLeadIds.length > 0 && (
            <button
              className="dangerButton"
              style={{
                position: "fixed",
                right: "24px",
                bottom: "24px",
                zIndex: 50,
                padding: "10px 16px",
                borderRadius: "10px",
                boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
                fontWeight: 700,
              }}
              onClick={async () => {
                const leadsToDelete = filteredLeads.filter((lead) =>
                  selectedLeadIds.includes(lead.id),
                );

                const { error } = await supabase
                  .from("leads")
                  .delete()
                  .in("id", selectedLeadIds);

                if (error) return alert("Error deleting selected leads");

                setUndoLeads(leadsToDelete);
                setUndoLead(null);

                setLeads((prev) =>
                  prev.filter((lead) => !selectedLeadIds.includes(lead.id)),
                );

                showUndoToast(`${leadsToDelete.length} leads deleted`);
                setSelectedLeadIds([]);
              }}
            >
              Delete {selectedLeadIds.length} selected
            </button>
          )}

          {filteredLeads.map((lead: Lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              selected={selectedLeadIds.includes(lead.id)}
              onToggleSelected={() => {
                setSelectedLeadIds((prev) =>
                  prev.includes(lead.id)
                    ? prev.filter((id) => id !== lead.id)
                    : [...prev, lead.id],
                );
              }}
              updateStatus={updateStatus}
              markContacted={markContacted}
              openWhatsApp={openWhatsApp}
              deleteLead={deleteLead}
              updateLeadName={updateLeadName}
              updateLeadPhone={updateLeadPhone}
              updateLeadConsultant={updateLeadConsultant}
              consultantNames={consultantNames}
            />
          ))}
        </section>
      </section>
      <div
        style={{
          position: "fixed",
          left: "50%",
          marginLeft: "160px",
          bottom: toastState ? "132px" : "32px",
          transform: "translateX(-50%)",
          width: "320px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          zIndex: 9998,
          pointerEvents: "none",
        }}
      >
        {addedToastStack.map((toast) => (
          <div
            key={toast.id}
            style={{
              width: "fit-content",
              display: "inline-block",
              transform: `translateY(${exitingAddedToastIds.has(toast.id) ? 0 : 6}px) translateX(${addedToastDragX[toast.id] || 0}px) scale(${addedToastDragX[toast.id] ? 0.985 : 1})`,
              opacity: exitingAddedToastIds.has(toast.id) ? 0 : 1,
              transition: addedToastDragX[toast.id]
                ? "none"
                : "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.18s ease",
              willChange: "transform, opacity",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              pointerEvents: "auto",
              touchAction: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
              cursor: "default",
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              (document.activeElement as HTMLElement | null)?.blur();
              document.body.classList.add("toastDraggingActive");
              e.currentTarget.setPointerCapture(e.pointerId);
              document.body.style.userSelect = "none";
              document.body.style.webkitUserSelect = "none";

              const card = e.currentTarget
                .firstElementChild as HTMLElement | null;
              const rect = (card ?? e.currentTarget).getBoundingClientRect();
              const startDragX = addedToastDragX[toast.id] || 0;

              addedToastDragStartRef.current[toast.id] = {
                startClientX: e.clientX,
                startDragX,
                currentX: startDragX,
                minX: startDragX - rect.left,
                maxX: startDragX + (window.innerWidth - rect.right),
                startLeft: rect.left,
                startRight: rect.right,
              };
            }}
            onPointerMove={(e) => {
              const data = addedToastDragStartRef.current[toast.id];
              if (!data) return;
              e.preventDefault();
              e.stopPropagation();

              const rawDelta =
                data.startDragX + (e.clientX - data.startClientX);
              const delta = Math.max(data.minX, Math.min(data.maxX, rawDelta));
              const hitLeftEdge = data.startLeft + rawDelta <= 0;
              const hitRightEdge =
                data.startRight + rawDelta >= window.innerWidth;

              if (hitLeftEdge || hitRightEdge) {
                dismissAddedToast(toast.id);
                delete addedToastDragStartRef.current[toast.id];
                return;
              }
              data.currentX = delta;
              window.getSelection()?.removeAllRanges();

              setAddedToastDragX((prev) => ({
                ...prev,
                [toast.id]: delta,
              }));
            }}
            onPointerUp={(e) => {
              document.body.classList.remove("toastDraggingActive");
              document.body.style.userSelect = "";
              document.body.style.webkitUserSelect = "";
              setToastDragging(false);
              setToastDragX(0);
              setToastStartX(0);
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }

              delete addedToastDragStartRef.current[toast.id];

              setAddedToastDragX((prev) => ({
                ...prev,
                [toast.id]: 0,
              }));
            }}
            onPointerCancel={() => {
              document.body.classList.remove("toastDraggingActive");
              document.body.style.userSelect = "";
              document.body.style.webkitUserSelect = "";
              setToastDragging(false);
              setToastDragX(0);
              setToastStartX(0);
              delete addedToastDragStartRef.current[toast.id];
            }}
          >
            <div
              className="toast normalToast"
              style={{
                position: "relative",
                top: "auto",
                left: "auto",
                right: "auto",
                bottom: "auto",
                transform: "none",
                width: "320px",
                height: "56px",
                padding: "10px 18px",
                boxSizing: "border-box",
                boxShadow: "0 10px 28px rgba(0,0,0,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  width: "100%",
                }}
              >
                <span>{toast.message}</span>

                <button
                  className="toastCloseButton"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault(); // 👈 ADD THIS
                    dismissAddedToast(toast.id);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {toastState && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: "32px",
            transform: "translateX(-50%)",
            zIndex: 9999,
            pointerEvents: "auto",
          }}
        >
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              (document.activeElement as HTMLElement | null)?.blur();
              document.body.classList.add("toastDraggingActive");

              setToastDragging(true);
              document.body.style.userSelect = "none";
              document.body.style.webkitUserSelect = "none";

              e.currentTarget.setPointerCapture(e.pointerId);
              setToastStartX(e.clientX - toastDragX);
              const card = e.currentTarget
                .firstElementChild as HTMLElement | null;
              const rect = (card ?? e.currentTarget).getBoundingClientRect();
              const startDragX = toastDragX;

              toastDragBoundsRef.current = {
                minX: startDragX - rect.left,
                maxX: startDragX + (window.innerWidth - rect.right),
                startLeft: rect.left,
                startRight: rect.right,
              };
            }}
            onPointerMove={(e) => {
              if (!toastDragging) return;

              e.preventDefault();
              e.stopPropagation();

              const rawNextX = e.clientX - toastStartX;
              const nextX = Math.max(
                toastDragBoundsRef.current.minX,
                Math.min(toastDragBoundsRef.current.maxX, rawNextX),
              );
              const hitLeftEdge =
                toastDragBoundsRef.current.startLeft + rawNextX <= 0;
              const hitRightEdge =
                toastDragBoundsRef.current.startRight + rawNextX >=
                window.innerWidth;

              if (hitLeftEdge || hitRightEdge) {
                stopUndoSequence();
                setToastState(null);
                setUndoLead(null);
                setUndoSeconds(0);
                setToastDragX(0);
                setToastDragging(false);
                return;
              }

              window.getSelection()?.removeAllRanges();
              setToastDragX(nextX);
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              e.stopPropagation();
              document.body.classList.remove("toastDraggingActive");

              setToastDragging(false);
              document.body.style.userSelect = "";
              document.body.style.webkitUserSelect = "";

              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }

              setToastDragX(0);
            }}
            onPointerCancel={() => {
              document.body.classList.remove("toastDraggingActive");
              setToastDragging(false);
              document.body.style.userSelect = "";
              document.body.style.webkitUserSelect = "";
              setToastDragX(0);
            }}
            style={{
              transform: `translateY(${toastDragging ? 0 : 6}px) translateX(${toastDragX}px) scale(${toastDragging ? 0.985 : 1})`,
              transition: toastDragging
                ? "none"
                : "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.18s ease",
              willChange: "transform, opacity",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              pointerEvents: "auto",
              touchAction: "none",
              userSelect: "none",
              WebkitUserSelect: "none",
              cursor: toastDragging ? "grabbing" : "grab",
            }}
          >
            <div
              className={`${
                toastState.type === "undo"
                  ? "toast undoToast"
                  : "toast normalToast"
              } ${toastExiting ? "toastExiting" : ""}`}
              style={
                {
                  zIndex: 9999,
                  boxSizing: "border-box",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...(toastState.message === "Lead restored"
                    ? {
                        width: "fit-content",
                        height: "48px",
                        padding: "10px 18px",
                      }
                    : {
                        background:
                          toastState?.type === "delete"
                            ? "rgba(220, 38, 38, 0.12)" // soft red
                            : toastState?.type === "restore"
                              ? "rgba(34, 197, 94, 0.12)" // soft green
                              : toastState?.type === "undo"
                                ? "#111" // keep neutral for undo
                                : "#111",
                        width: "320px",
                        color:
                          toastState?.type === "delete"
                            ? "#ef4444"
                            : toastState?.type === "restore"
                              ? "#22c55e"
                              : "#fff",
                        border:
                          toastState?.type === "delete"
                            ? "1px solid rgba(220, 38, 38, 0.25)"
                            : toastState?.type === "restore"
                              ? "1px solid rgba(34, 197, 94, 0.25)"
                              : "1px solid rgba(255,255,255,0.06)",
                        height: "56px",
                        padding: "10px 18px",
                      }),
                } as React.CSSProperties
              }
            >
              <span
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      lineHeight: 0,
                      opacity: 0.9,
                      transform: "scale(0.95)",
                    }}
                  >
                    {toastState.type === "delete" && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <defs>
                          <linearGradient
                            id="trashGlow"
                            x1="4"
                            y1="3"
                            x2="20"
                            y2="21"
                          >
                            <stop stopColor="#ff6b6b" />
                            <stop offset="1" stopColor="#dc2626" />
                          </linearGradient>
                        </defs>

                        <rect
                          x="5"
                          y="7"
                          width="14"
                          height="14"
                          rx="3"
                          fill="url(#trashGlow)"
                        />
                        <path
                          d="M9 7V5.5C9 4.7 9.7 4 10.5 4H13.5C14.3 4 15 4.7 15 5.5V7"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <path
                          d="M4 7H20"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <path
                          d="M10 11V17"
                          stroke="white"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          opacity="0.9"
                        />
                        <path
                          d="M14 11V17"
                          stroke="white"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          opacity="0.9"
                        />
                        <circle cx="18" cy="6" r="3" fill="#fde047" />
                        <path
                          d="M17.2 6L17.8 6.6L19 5.3"
                          stroke="#111827"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}

                    {toastState.type === "restore" && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <defs>
                          <linearGradient
                            id="restoreGlow"
                            x1="4"
                            y1="4"
                            x2="20"
                            y2="20"
                          >
                            <stop stopColor="#38bdf8" />
                            <stop offset="1" stopColor="#2563eb" />
                          </linearGradient>
                        </defs>

                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          fill="url(#restoreGlow)"
                        />

                        <path
                          d="M8.5 10.2H6.2V7.9"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        <path
                          d="M6.5 10.2C7.3 7.9 9.4 6.3 12 6.3C15.2 6.3 17.8 8.8 17.8 12C17.8 15.2 15.2 17.8 12 17.8C9.9 17.8 8.1 16.7 7.1 15"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />

                        <circle cx="17.5" cy="6.5" r="2.6" fill="#a7f3d0" />
                        <path
                          d="M16.5 6.5L17.2 7.2L18.7 5.7"
                          stroke="#064e3b"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}

                    {toastState.type === "undo" && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <defs>
                          <linearGradient
                            id="undoGlow"
                            x1="4"
                            y1="4"
                            x2="20"
                            y2="20"
                          >
                            <stop stopColor="#a78bfa" />
                            <stop offset="1" stopColor="#7c3aed" />
                          </linearGradient>
                        </defs>

                        <circle cx="12" cy="12" r="9" fill="url(#undoGlow)" />

                        <path
                          d="M8.5 10.2H6.2V7.9"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        <path
                          d="M6.5 10.2C7.3 7.9 9.4 6.3 12 6.3C15.2 6.3 17.8 8.8 17.8 12"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />

                        <path
                          d="M15.2 14.2L17.8 16.8"
                          stroke="white"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />

                        <path
                          d="M17.8 14.2L15.2 16.8"
                          stroke="white"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}

                    {toastState.type === "normal" && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <defs>
                          <linearGradient
                            id="successGlow"
                            x1="4"
                            y1="4"
                            x2="20"
                            y2="20"
                          >
                            <stop stopColor="#34d399" />
                            <stop offset="1" stopColor="#059669" />
                          </linearGradient>
                        </defs>

                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          fill="url(#successGlow)"
                        />

                        <path
                          d="M8.5 12.5L11 15L16 10"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        <circle cx="17.5" cy="6.5" r="2.6" fill="#a7f3d0" />
                        <path
                          d="M16.5 6.5L17.2 7.2L18.7 5.7"
                          stroke="#064e3b"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                </span>

                <span className="toastText">{toastState.message}</span>
              </span>

              {toastState.type === "undo" && (
                <button
                  className="undoButton"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    undoDelete();
                  }}
                >
                  Undo ({toastState.seconds})
                </button>
              )}

              <button
                className="toastCloseButton"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  clearAllToastTimers();
                  setToastExiting(true);

                  setTimeout(() => {
                    setToastState(null);
                    setToastExiting(false);
                    setUndoLead(null);
                  }, 180);
                }}
                aria-label="Close notification"
              >
                ×
              </button>

              {toastState.type === "undo" && (
                <div
                  className="toastProgress"
                  key={`progress-${toastState.id}`}
                />
              )}
            </div>
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
  selected,
  onToggleSelected,
  updateStatus,
  markContacted,
  openWhatsApp,
  deleteLead,
  updateLeadName,
  updateLeadPhone,
  updateLeadConsultant,
  consultantNames,
}: {
  lead: Lead;
  selected: boolean;
  onToggleSelected: () => void;
  updateStatus: (id: string, status: string) => void;
  markContacted: (id: string) => void;
  openWhatsApp: (lead: Lead) => void;
  deleteLead: (lead: Lead) => void;
  updateLeadName: (id: string, newName: string) => void;
  updateLeadPhone: (id: string, newPhone: string) => void;
  updateLeadConsultant: (id: string, newConsultant: string) => void;
  consultantNames: string[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(lead.name);
  const [editPhone, setEditPhone] = useState(lead.phone || "");
  const [editConsultant, setEditConsultant] = useState(lead.consultant || "");
  const [justSaved, setJustSaved] = useState(false);
  return (
    <div className="leadCard">
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "18px",
            height: "18px",
            cursor: "pointer",
            marginTop: "4px",
          }}
        />

        <div style={{ flex: 1 }}>
          {isEditing ? (
            <div className="leadEditRow">
              <div className="editFields">
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

                <select
                  value={editConsultant}
                  onChange={(e) => setEditConsultant(e.target.value)}
                >
                  <option value="" disabled>
                    Select Consultant
                  </option>

                  {consultantNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="editActions">
                <button
                  className="primaryButton"
                  onClick={() => {
                    updateLeadName(lead.id, editName);
                    updateLeadPhone(lead.id, editPhone);
                    updateLeadConsultant(lead.id, editConsultant);
                    setJustSaved(true);

                    setTimeout(() => {
                      setJustSaved(false);
                    }, 1200);

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

        {justSaved && <span className="saveToast">Saved ✓</span>}

        <div className="leadActions">
          <select
            value={lead.status}
            onChange={(e) => updateStatus(lead.id, e.target.value)}
            className="statusSelect"
          >
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Followed Up">Followed Up</option>
            <option value="Viewing Scheduled">Viewing Scheduled</option>
            <option value="Offer Made">Offer Made</option>
            <option value="Won">Won</option>
            <option value="Lost">Lost</option>
          </select>

          <button
            className="secondaryButton"
            onClick={() => markContacted(lead.id)}
          >
            Mark Contacted
          </button>

          <button className="whatsappButton" onClick={() => openWhatsApp(lead)}>
            <svg
              className="whatsappSvg"
              viewBox="0 0 448 512"
              aria-hidden="true"
            >
              <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32 101.5 32 2 131.5 2 253.9c0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.5 224.1-221.9 0-59.3-25.2-115-67.1-157.1zM223.9 438.7c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3 18.6-68.1-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8s-14.3 18-17.6 21.8c-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2s-9.7 1.4-14.8 6.9c-5.1 5.6-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
            </svg>
            WhatsApp
          </button>

          {!isEditing && (
            <button
              className="secondaryButton"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
          )}

          <button className="dangerButton" onClick={() => deleteLead(lead)}>
            Delete
          </button>
        </div>
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
