"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/app/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { createPortal } from "react-dom";
import { addDepartment, deleteDepartment, getDepartments } from "@/app/lib/departments";
import DepartmentManager from "@/app/components/DepartmentManager";
import EmployeeDirectory from "@/app/components/EmployeeDirectory";
import EmployeeForm from "@/app/components/EmployeeForm";
import {
  addEmployee,
  deleteEmployee,
  getEmployeeByEmail,
  getEmployees,
  updateEmployee,
} from "@/app/lib/employees";
import Image from "next/image";
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
  source_type?: string;
  submitted?: boolean;
  submitted_at?: string | null;
  assigned_by?: string | null;
  avatar_url?: string | null;
  notes?: string | null;
  last_contact_date?: string | null;
  next_follow_up_date?: string | null;
};

type LeadActivity = {
  id: string;
  lead_id: string;
  activity_type: string;
  activity_text: string;
  created_at: string;
};

type LeadAttachment = {
  id: string;
  lead_id: string;
  file_name: string;
  file_url: string;
  created_at: string;
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

  const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays >= 3) return "OVERDUE — CALL NOW";
  if (diffDays === 2) return "Follow Up Today";
  if (diffDays === 1) return "Check Soon";
  return "Up to Date";
}

function badgeColor(value: string) {
  if (value?.includes("OVERDUE")) return "#dc2626";
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
    options?: { volume?: number; playbackRate?: number }
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

  const [activePage, setActivePage] = useState("dashboard");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [name, setName] = useState("");
  const [consultant, setConsultant] = useState("");
  const [phone, setPhone] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [lastContact, setLastContact] = useState("");
  const [status, setStatus] = useState("New");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [analyticsConsultant, setAnalyticsConsultant] = useState("All Consultants");
  const [employees, setEmployees] = useState<
    {
      id: string;
      email: string;
      full_name: string;
      role: string;
      department: string | null;
      active: boolean;
    }[]
  >([]);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeeRole, setEmployeeRole] = useState("consultant");
  const [employeeDepartment, setEmployeeDepartment] = useState("Sales");
  const [departments, setDepartments] = useState<string[]>([
    "Executive",
    "Sales",
    "Marketing",
    "Operations",
  ]);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);

  const analyticsLeads =
    analyticsConsultant === "All Consultants"
      ? leads
      : leads.filter((lead) => lead.consultant === analyticsConsultant);

  const leadsAssigned = analyticsLeads.length;

  const activeLeads = analyticsLeads.filter(
    (lead) => lead.status !== "Won" && lead.status !== "Lost"
  ).length;

  const wonDeals = analyticsLeads.filter((lead) => lead.status === "Won").length;

  const conversionRate = leadsAssigned === 0 ? 0 : Math.round((wonDeals / leadsAssigned) * 100);
  const [undoLead, setUndoLead] = useState<Lead | null>(null);
  const [toastState, setToastState] = useState<{
    id: number;
    message: string;
    type: "normal" | "undo" | "delete" | "restore";
    seconds: number;
  } | null>(null);
  const [employeeRecord, setEmployeeRecord] = useState<{
    id: string;
    full_name: string;
    email: string;
    role: string;
    department: string | null;
    active: boolean;
    created_at: string;
    updated_at: string | null;
  } | null>(null);
  const isManager = employeeRecord?.role === "manager";
  const isAdmin = employeeRecord?.role === "admin";

  const permissions = {
    canManageEmployees: isManager || isAdmin,
    canViewReports: isManager || isAdmin,
    canViewAnalytics: isManager || isAdmin,
  };
  const [addedToastStack, setAddedToastStack] = useState<{ id: number; message: string }[]>([]);
  const [consultantNames, setConsultantNames] = useState<string[]>([]);
  const [addedToastDragX, setAddedToastDragX] = useState<Record<number, number>>({});
  const [exitingAddedToastIds, setExitingAddedToastIds] = useState<Set<number>>(new Set());
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
    if (countdownSoundTimeoutRef.current) clearTimeout(countdownSoundTimeoutRef.current);
    if (finalToastTimeoutRef.current) clearTimeout(finalToastTimeoutRef.current);
    if (undoTickTimeoutRef.current) clearTimeout(undoTickTimeoutRef.current);

    toastTimerRef.current = null;
    normalToastTimerRef.current = null;
    countdownSoundTimeoutRef.current = null;
    finalToastTimeoutRef.current = null;
    undoTickTimeoutRef.current = null;
    finalPlayedRef.current = false;
  }

  function showToast(message: string, type: "normal" | "undo" | "delete" | "restore" = "normal") {
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error) return alert(error.message);

    const employee = await fetchEmployeeByEmail(data.user.email || "");

    if (!employee) {
      await supabase.auth.signOut();
      alert("This email is not registered as an employee.");
      return;
    }

    if (!employee.active) {
      await supabase.auth.signOut();
      alert("This employee account has been deactivated.");
      return;
    }
    setEmployeeRecord(employee);
    console.log("Employee login record:", employee);
    setRole(employee.role);

    setConsultant(employee.role === "consultant" ? employee.full_name : "All Consultants");
  }

  async function logOut() {
    await supabase.auth.signOut();
    setUser(null);
    setLeads([]);
    setEmployeeRecord(null);
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
  async function fetchEmployeeByEmail(email: string) {
    try {
      return await getEmployeeByEmail(email);
    } catch (error) {
      console.error("Error fetching employee by email:", error);
      return null;
    }
  }
  async function addConsultant() {
    if (!newConsultantName.trim()) {
      alert("Please enter a consultant name.");
      return;
    }
    const cleanName = newConsultantName.trim();
    const exists = consultants.some((c) => c.toLowerCase() === cleanName.toLowerCase());

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
    const { error } = await supabase.from("consultants").delete().eq("name", name);

    if (error) {
      console.error("Error deleting consultant:", error);
      return alert("Error deleting consultant");
    }

    // 🔑 Wait for fresh data from DB ONLY
    await fetchConsultants();

    showToast("Consultant removed", "delete");
  }
  async function fetchLeads() {
    let query = supabase.from("leads").select("*").order("created_at", { ascending: false });

    if (role === "consultant") {
      query = query.eq("consultant", consultant.trim());
    }

    const { data, error } = await query;

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
  async function fetchEmployees() {
    try {
      const employeeList = await getEmployees();
      setEmployees(employeeList);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }
  async function fetchDepartments() {
    try {
      const departmentNames = await getDepartments();
      setDepartments(departmentNames);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
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
      source_type: isManager ? "manager-assigned" : "self-created",

      submitted: false,

      assigned_by: isManager ? user?.id : null,
    });

    if (error) return alert("Error adding lead");

    setName("");
    if (role !== "consultant") {
      setConsultant("");
    }
    setPhone("");
    setReferenceNumber("");
    setLastContact("");
    setStatus("New");

    await fetchLeads();
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
    setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, name: newName } : lead)));

    const { error } = await supabase.from("leads").update({ name: newName }).eq("id", id);

    if (error) {
      alert("Error updating lead name");
      fetchLeads();
    }
  }

  async function updateLeadPhone(id: string, newPhone: string) {
    setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, phone: newPhone } : lead)));

    const { error } = await supabase.from("leads").update({ phone: newPhone }).eq("id", id);

    if (error) {
      alert("Error updating lead phone");
      fetchLeads();
    }
  }

  async function updateLeadConsultant(id: string, newConsultant: string) {
    setLeads((prev) =>
      prev.map((lead) => (lead.id === id ? { ...lead, consultant: newConsultant } : lead))
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
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");

    fetchLeads();
    showToast("WhatsApp follow-up opened");
  }

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", id);

    if (error) return alert("Error updating status");

    fetchLeads();
    showToast("Status updated");
  }

  async function markSubmitted(id: string) {
    const { error } = await supabase
      .from("leads")
      .update({
        submitted: true,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return alert("Error submitting lead");

    await fetchLeads();
  }

  async function unsubmitLead(id: string) {
    const { error } = await supabase
      .from("leads")
      .update({
        submitted: false,
        submitted_at: null,
      })
      .eq("id", id);

    if (error) return alert("Error unsubmitting lead");

    await fetchLeads();
  }
  async function handleDeleteDepartment(department: string) {
    const employeesUsingDepartment = employees.filter(
      (employee) => employee.department === department
    );

    if (employeesUsingDepartment.length > 0) {
      alert(
        `Cannot delete "${department}" because ${employeesUsingDepartment.length} employee(s) are assigned to it.`
      );
      return;
    }

    if (!confirm(`Delete ${department}?`)) return;

    try {
      await deleteDepartment(department);
      await fetchDepartments();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete department.");
    }
  }
  async function handleAddDepartment(department: string) {
    const trimmedDepartment = department.trim();

    if (!trimmedDepartment) return;

    if (departments.includes(trimmedDepartment)) {
      alert("That department already exists.");
      return;
    }

    try {
      await addDepartment(trimmedDepartment);
      await fetchDepartments();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to add department.");
    }
  }
  useEffect(() => {
    const loadData = async () => {
      const { data } = await supabase.auth.getUser();

      setUser(data.user);

      if (data.user) {
        await fetchRole(data.user.id);

        const employee = await fetchEmployeeByEmail(data.user.email || "");
        if (employee) {
          setEmployeeRecord(employee);
          setRole(employee.role);
          setConsultant(employee.role === "consultant" ? employee.full_name : "All Consultants");
        }

        await fetchConsultants();
        await fetchEmployees();
        await fetchDepartments();
      }
    };

    loadData();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        fetchRole(session.user.id);

        fetchEmployeeByEmail(session.user.email || "").then((employee) => {
          if (employee) {
            setEmployeeRecord(employee);
            setRole(employee.role);
            setConsultant(employee.role === "consultant" ? employee.full_name : "All Consultants");
          }
        });

        fetchConsultants();
        fetchEmployees();
        fetchDepartments();
      } else {
        setRole(null);
        setLeads([]);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!role) return;
    if (role === "consultant" && !consultant) return;

    const timer = window.setTimeout(() => {
      fetchLeads();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, consultant]);
  const followUps = leads.filter(
    (l) => l.next_action === "OVERDUE — CALL NOW" || l.next_action === "Follow Up Today"
  );

  const overdue = leads.filter((l) => l.next_action === "OVERDUE — CALL NOW").length;

  const won = leads.filter((l) => l.status === "Won").length;
  const consultantStats = consultantNames.map((name) => {
    const consultantLeads = leads.filter((lead) => lead.consultant === name);

    return {
      name,
      total: consultantLeads.length,
      followUps: consultantLeads.filter(
        (lead) =>
          lead.next_action === "OVERDUE — CALL NOW" || lead.next_action === "Follow Up Today"
      ).length,
      overdue: consultantLeads.filter((lead) => lead.next_action === "OVERDUE — CALL NOW").length,
      won: consultantLeads.filter((lead) => lead.status === "Won").length,
    };
  });
  const filteredLeads = leads
    .filter((lead) => {
      if (role === "consultant") {
        return lead.consultant === consultant;
      }

      return true;
    })
    .filter((lead) => {
      // 🔍 existing search filter
      const matchesSearch =
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.phone || "").includes(searchTerm);

      const matchesStatus = statusFilter === "All" || lead.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  <div
    style={{
      marginBottom: "16px",
      color: "#64748b",
      fontSize: "14px",
      fontWeight: 600,
    }}
  >
    {employees.length} employee{employees.length !== 1 ? "s" : ""} found
  </div>;
  const todayDateString = new Date().toISOString().split("T")[0];

  const overdueLeads = leads.filter(
    (lead) => lead.next_follow_up_date && lead.next_follow_up_date < todayDateString
  );

  const dueTodayLeads = leads.filter((lead) => lead.next_follow_up_date === todayDateString);

  const upcomingFollowUpLeads = leads.filter(
    (lead) => lead.next_follow_up_date && lead.next_follow_up_date > todayDateString
  );

  const getLeadPriority = (lead: Lead) => {
    if (!lead.next_follow_up_date) return "Low";
    if (lead.next_follow_up_date < todayDateString) return "High";
    if (lead.next_follow_up_date === todayDateString) return "Medium";
    return "Low";
  };

  const getAttentionScore = (lead: Lead) => {
    if (!lead.next_follow_up_date) return 0;

    const diffDays = Math.ceil(
      (new Date(todayDateString).getTime() - new Date(lead.next_follow_up_date).getTime()) /
        86400000
    );

    return Math.max(diffDays, 0);
  };
  const getRecommendedAction = (lead: Lead) => {
    const score = getAttentionScore(lead);
    const priority = getLeadPriority(lead);

    if (score >= 7) return "Urgent: contact immediately";
    if (score >= 3) return "High priority follow-up";
    if (priority === "Medium") return "Follow up today";

    return "Monitor";
  };
  const attentionQueueLeads = [...overdueLeads].sort(
    (a, b) => getAttentionScore(b) - getAttentionScore(a)
  );
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
  async function handleSaveEmployee() {
    if (!employeeName || !employeeEmail) {
      alert("Please enter a name and email.");
      return;
    }

    const payload = {
      full_name: employeeName,
      email: employeeEmail,
      role: employeeRole,
      department: employeeDepartment,
      active: true,
    };

    try {
      if (editingEmployeeId) {
        await updateEmployee(editingEmployeeId, payload);
      } else {
        await addEmployee(payload);
      }

      setEditingEmployeeId(null);
      setEmployeeName("");
      setEmployeeEmail("");
      setEmployeeRole("consultant");
      setEmployeeDepartment("Sales");

      await fetchEmployees();
      await fetchDepartments();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save employee.");
    }
  }
  return (
    <main className="app">
      <aside className="sidebar">
        <h1 className="brandTitle">LeadFlow</h1>

        <div className="navList">
          <div
            className={`navText ${activePage === "dashboard" ? "active" : ""}`}
            onClick={() => setActivePage("dashboard")}
          >
            Dashboard
          </div>

          {permissions.canViewAnalytics && (
            <>
              {permissions.canViewAnalytics && (
                <div
                  className={`navText ${activePage === "analytics" ? "active" : ""}`}
                  onClick={() => setActivePage("analytics")}
                >
                  Analytics
                </div>
              )}

              <div
                className={`navText ${activePage === "consultants" ? "active" : ""}`}
                onClick={() => setActivePage("consultants")}
              >
                Consultants
              </div>
              {permissions.canManageEmployees && (
                <div
                  className={`navText ${activePage === "employees" ? "active" : ""}`}
                  onClick={() => setActivePage("employees")}
                >
                  Employees
                </div>
              )}
              {permissions.canViewReports && (
                <div
                  className={`navText ${activePage === "reports" ? "active" : ""}`}
                  onClick={() => setActivePage("reports")}
                >
                  Reports
                </div>
              )}
            </>
          )}
          <>
            <div
              className={`navText ${activePage === "my-leads" ? "active" : ""}`}
              onClick={() => setActivePage("my-leads")}
            >
              My Leads
            </div>

            <div
              className={`navText ${activePage === "assigned-leads" ? "active" : ""}`}
              onClick={() => setActivePage("assigned-leads")}
            >
              Assigned Leads (
              {
                leads.filter((lead) => lead.source_type === "manager-assigned" && !lead.submitted)
                  .length
              }
              )
            </div>

            <div
              className={`navText ${activePage === "my-followups" ? "active" : ""}`}
              onClick={() => setActivePage("my-followups")}
            >
              My Follow-Ups
            </div>

            <div
              className={`navText ${activePage === "my-performance" ? "active" : ""}`}
              onClick={() => setActivePage("my-performance")}
            >
              My Performance
            </div>
          </>
        </div>
      </aside>

      <section className="content">
        {activePage === "employees" && permissions.canManageEmployees && (
          <section className="panel">
            <EmployeeDirectory
              employees={employees}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onEdit={(employee) => {
                setEditingEmployeeId(employee.id);
                setEmployeeName(employee.full_name);
                setEmployeeEmail(employee.email);
                setEmployeeRole(employee.role);
                setEmployeeDepartment(employee.department || "Sales");
              }}
              onToggleActive={async (employee) => {
                const confirmed = confirm(
                  `Are you sure you want to ${
                    employee.active ? "deactivate" : "reactivate"
                  } ${employee.full_name}?`
                );

                if (!confirmed) return;

                await updateEmployee(employee.id, {
                  active: !employee.active,
                });

                await fetchEmployees();
                await fetchDepartments();
              }}
              onDelete={async (employee) => {
                const confirmed = confirm(`Are you sure you want to delete ${employee.full_name}?`);

                if (!confirmed) return;

                await deleteEmployee(employee.id);

                await fetchEmployees();
                await fetchDepartments();
              }}
            />
            <EmployeeForm
              editing={editingEmployeeId !== null}
              employeeName={employeeName}
              setEmployeeName={setEmployeeName}
              employeeEmail={employeeEmail}
              setEmployeeEmail={setEmployeeEmail}
              employeeRole={employeeRole}
              setEmployeeRole={setEmployeeRole}
              employeeDepartment={employeeDepartment}
              setEmployeeDepartment={setEmployeeDepartment}
              departments={departments}
              onSubmit={handleSaveEmployee}
              submitLabel={editingEmployeeId ? "Save Employee" : "+ Add Employee"}
            />
            <hr style={{ margin: "32px 0" }} />

            <DepartmentManager
              departments={departments}
              employees={employees}
              onAdd={handleAddDepartment}
              onDelete={handleDeleteDepartment}
            />
          </section>
        )}
        {activePage === "analytics" && permissions.canViewAnalytics && (
          <section className="panel">
            <h1 className="sectionTitle">Consultant Analytics</h1>

            <p style={{ color: "#64748b", marginBottom: "20px" }}>
              Select a consultant to view performance metrics.
            </p>

            <select
              value={analyticsConsultant}
              onChange={(e) => setAnalyticsConsultant(e.target.value)}
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                minWidth: "240px",
              }}
            >
              <option>All Consultants</option>

              {consultantNames.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                background: "#f8fafc",
              }}
            >
              <strong>Selected Consultant:</strong> {analyticsConsultant}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "16px",
                marginTop: "20px",
              }}
            >
              <div className="panel">
                <h3>Leads Assigned</h3>
                <p style={{ fontSize: "28px", fontWeight: 700 }}>{leadsAssigned}</p>
              </div>

              <div className="panel">
                <h3>Active Leads</h3>
                <p style={{ fontSize: "28px", fontWeight: 700 }}>{activeLeads}</p>
              </div>

              <div className="panel">
                <h3>Won Deals</h3>
                <p style={{ fontSize: "28px", fontWeight: 700 }}>{wonDeals}</p>
              </div>

              <div className="panel">
                <h3>Conversion Rate</h3>
                <p style={{ fontSize: "28px", fontWeight: 700 }}>{conversionRate}%</p>
              </div>
              <div className="statCard">
                <h3>Overdue Follow-Ups</h3>
                <p>{overdueLeads.length}</p>
              </div>

              <div className="statCard">
                <h3>Due Today</h3>
                <p>{dueTodayLeads.length}</p>
              </div>

              <div className="statCard">
                <h3>Upcoming Follow-Ups</h3>
                <p>{upcomingFollowUpLeads.length}</p>
              </div>
            </div>
          </section>
        )}
        {activePage === "consultants" && (
          <section className="panel">
            <h1 className="pageTitle">Consultants</h1>

            <p style={{ color: "#64748b", marginTop: "12px" }}>
              Manage consultants, assignments, and performance.
            </p>

            <div style={{ marginTop: "24px" }}>
              {consultantNames.length === 0 ? (
                <p>No consultants found.</p>
              ) : (
                consultantNames.map((consultant) => {
                  const consultantLeads = leads.filter((lead) => lead.consultant === consultant);

                  const assignedLeads = consultantLeads.length;

                  const activeLeads = consultantLeads.filter(
                    (lead) => lead.status !== "Won" && lead.status !== "Lost"
                  ).length;

                  const wonDeals = consultantLeads.filter((lead) => lead.status === "Won").length;

                  const conversionRate =
                    assignedLeads === 0 ? 0 : Math.round((wonDeals / assignedLeads) * 100);

                  return (
                    <div key={consultant} className="panel" style={{ marginBottom: "12px" }}>
                      <h3>{consultant}</h3>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: "16px",
                          marginTop: "12px",
                        }}
                      >
                        <div>
                          <strong>{assignedLeads}</strong>
                          <div>Assigned</div>
                        </div>

                        <div>
                          <strong>{activeLeads}</strong>
                          <div>Active</div>
                        </div>

                        <div>
                          <strong>{wonDeals}</strong>
                          <div>Won</div>
                        </div>

                        <div>
                          <strong>{conversionRate}%</strong>
                          <div>Conversion</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}
        {activePage === "reports" && permissions.canViewReports && (
          <section className="panel">
            <h1 className="pageTitle">Reports</h1>

            <p style={{ color: "#64748b", marginTop: "12px" }}>
              Charts, trends, and performance reports.
            </p>

            <div className="panel" style={{ marginTop: "24px", minHeight: "250px" }}>
              <h3>Lead Pipeline Overview</h3>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={consultantNames.map((consultant) => ({
                    consultant,
                    leads: leads.filter((lead) => lead.consultant === consultant).length,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="consultant" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="leads" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
        {activePage === "my-leads" && (
          <section className="panel">
            <h1 className="pageTitle">My Leads</h1>

            <div style={{ marginTop: "20px" }}>
              {leads
                .filter(
                  (lead) =>
                    lead.consultant?.trim().toLowerCase() === consultant.trim().toLowerCase() &&
                    lead.source_type !== "manager-assigned"
                )
                .map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    selected={selectedLeadIds.includes(lead.id)}
                    onToggleSelected={() =>
                      setSelectedLeadIds((prev) =>
                        prev.includes(lead.id)
                          ? prev.filter((id) => id !== lead.id)
                          : [...prev, lead.id]
                      )
                    }
                    updateStatus={updateStatus}
                    markContacted={markContacted}
                    openWhatsApp={openWhatsApp}
                    deleteLead={deleteLead}
                    markSubmitted={markSubmitted}
                    updateLeadName={updateLeadName}
                    updateLeadPhone={updateLeadPhone}
                    updateLeadConsultant={updateLeadConsultant}
                    consultantNames={consultantNames}
                  />
                ))}
            </div>
          </section>
        )}
        {activePage === "my-followups" && (
          <section className="panel">
            <h1 className="pageTitle">My Follow-Ups</h1>

            <div style={{ marginTop: "20px" }}>
              {leads
                .filter(
                  (lead) =>
                    lead.consultant?.trim().toLowerCase() === consultant.trim().toLowerCase() &&
                    lead.status !== "Closed"
                )
                .map((lead) => (
                  <div key={lead.id} className="panel" style={{ marginBottom: "12px" }}>
                    <strong>{lead.name}</strong>
                    <div className={`priorityBadge priority${getLeadPriority(lead)}`}>
                      Priority: {getLeadPriority(lead)}
                    </div>
                    <div>Attention Score: {getAttentionScore(lead)}</div>

                    <p>Status: {lead.status}</p>
                    <div className="actionBadge">Next Step: {getRecommendedAction(lead)}</div>
                    <div className={`priorityBadge priority${getLeadPriority(lead)}`}>
                      Priority: {getLeadPriority(lead)}
                    </div>
                    <p>Phone: {lead.phone}</p>
                    <p>Ref: {lead.reference_number}</p>
                    <div className="leadDateRow">
                      <label>
                        Last Contact
                        <input
                          type="date"
                          defaultValue={lead.last_contact_date || ""}
                          onChange={async (e) => {
                            await supabase
                              .from("leads")
                              .update({ last_contact_date: e.target.value || null })
                              .eq("id", lead.id);

                            await supabase.from("lead_activity").insert({
                              lead_id: lead.id,
                              activity_type: "last_contact_updated",
                              activity_text: `Last contact date set to ${e.target.value}`,
                            });
                          }}
                        />
                      </label>

                      <label>
                        Next Follow-Up
                        <input
                          type="date"
                          defaultValue={lead.next_follow_up_date || ""}
                          onChange={async (e) => {
                            await supabase
                              .from("leads")
                              .update({ next_follow_up_date: e.target.value || null })
                              .eq("id", lead.id);

                            await supabase.from("lead_activity").insert({
                              lead_id: lead.id,
                              activity_type: "follow_up_updated",
                              activity_text: `Follow-up date set to ${e.target.value}`,
                            });
                          }}
                        />
                      </label>
                    </div>
                    <button onClick={() => updateStatus(lead.id, "Contacted")}>
                      Mark Contacted
                    </button>
                  </div>
                ))}
            </div>
          </section>
        )}

        {activePage === "assigned-leads" && (
          <section className="panel">
            <h1 className="pageTitle">Assigned Leads</h1>

            <h2>Active Assignments</h2>

            {leads
              .filter((lead) => lead.source_type === "manager-assigned" && !lead.submitted)
              .map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  selected={selectedLeadIds.includes(lead.id)}
                  onToggleSelected={() =>
                    setSelectedLeadIds((prev) =>
                      prev.includes(lead.id)
                        ? prev.filter((id) => id !== lead.id)
                        : [...prev, lead.id]
                    )
                  }
                  updateStatus={updateStatus}
                  markContacted={markContacted}
                  openWhatsApp={openWhatsApp}
                  deleteLead={deleteLead}
                  markSubmitted={markSubmitted}
                  updateLeadName={updateLeadName}
                  updateLeadPhone={updateLeadPhone}
                  updateLeadConsultant={updateLeadConsultant}
                  consultantNames={consultantNames}
                />
              ))}

            <h2 style={{ marginTop: "30px" }}>Submitted</h2>

            {leads
              .filter((lead) => lead.source_type === "manager-assigned" && lead.submitted)
              .map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  selected={selectedLeadIds.includes(lead.id)}
                  onToggleSelected={() =>
                    setSelectedLeadIds((prev) =>
                      prev.includes(lead.id)
                        ? prev.filter((id) => id !== lead.id)
                        : [...prev, lead.id]
                    )
                  }
                  updateStatus={updateStatus}
                  markContacted={markContacted}
                  openWhatsApp={openWhatsApp}
                  deleteLead={deleteLead}
                  markSubmitted={unsubmitLead}
                  updateLeadName={updateLeadName}
                  updateLeadPhone={updateLeadPhone}
                  updateLeadConsultant={updateLeadConsultant}
                  consultantNames={consultantNames}
                />
              ))}
          </section>
        )}
        {activePage === "dashboard" && (
          <header className="header">
            <div>
              <h1 className="pageTitle">Dashboard</h1>
              {activePage === "dashboard" && permissions.canViewAnalytics && (
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
        )}

        {activePage === "dashboard" && permissions.canViewAnalytics && (
          <div className="cards">
            <Card label="Total Leads" value={leads.length} />
            <Card label="Urgent Follow-Ups" value={followUps.length} color="#f97316" />
            <Card label="Overdue" value={overdue} color="#dc2626" />
            <Card label="Won Deals" value={won} color="#16a34a" />
          </div>
        )}
        {activePage === "dashboard" && permissions.canViewAnalytics && (
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
                      setSelectedConsultant(selectedConsultant === stat.name ? "All" : stat.name)
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

        {activePage === "dashboard" && (
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
            {permissions.canViewAnalytics && (
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
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                    }}
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
            {activePage === "dashboard" && (
              <>
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
              </>
            )}
          </section>
        )}

        {activePage === "dashboard" && permissions.canViewAnalytics && (
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
                      : [...prev, lead.id]
                  );
                }}
                updateStatus={updateStatus}
                markContacted={markContacted}
                openWhatsApp={openWhatsApp}
                deleteLead={deleteLead}
                markSubmitted={markSubmitted}
                updateLeadName={updateLeadName}
                updateLeadPhone={updateLeadPhone}
                updateLeadConsultant={updateLeadConsultant}
                consultantNames={consultantNames}
              />
            ))}
          </section>
        )}
        <div className="dashboardStats">
          <div className="statCard">
            <h3>Overdue Follow-Ups</h3>
            <p>{overdueLeads.length}</p>
          </div>

          <div className="statCard">
            <h3>Due Today</h3>
            <p>{dueTodayLeads.length}</p>
          </div>

          <div className="statCard">
            <h3>Upcoming Follow-Ups</h3>
            <p>{upcomingFollowUpLeads.length}</p>
          </div>
        </div>
        <div className="panel" style={{ marginBottom: "24px" }}>
          <h2>🔴 Needs Attention</h2>

          {attentionQueueLeads.length === 0 ? (
            <p>No overdue follow-ups.</p>
          ) : (
            attentionQueueLeads.map((lead) => (
              <div key={lead.id} className="timelineEvent">
                <strong>{lead.name}</strong>
                <div className={`priorityBadge priority${getLeadPriority(lead)}`}>
                  <div>Attention Score: {getAttentionScore(lead)}</div>
                  <div className="actionBadge">Next Step: {getRecommendedAction(lead)}</div>
                  Priority: {getLeadPriority(lead)}
                </div>
                <div>Follow-up date: {lead.next_follow_up_date}</div>
                <div>
                  Overdue by{" "}
                  {Math.ceil(
                    (new Date(todayDateString).getTime() -
                      new Date(lead.next_follow_up_date || todayDateString).getTime()) /
                      86400000
                  )}{" "}
                  day(s)
                </div>
              </div>
            ))
          )}
        </div>
        <div className="panel" style={{ marginBottom: "24px" }}>
          <h2>🟢 Due Today</h2>

          {dueTodayLeads.length === 0 ? (
            <p>No follow-ups due today.</p>
          ) : (
            dueTodayLeads.map((lead) => (
              <div key={lead.id} className="timelineEvent">
                <strong>{lead.name}</strong>
                <div className="actionBadge">Next Step: {getRecommendedAction(lead)}</div>
                <div className={`priorityBadge priority${getLeadPriority(lead)}`}>
                  Priority: {getLeadPriority(lead)}
                </div>
                <div>Follow-up date: {lead.next_follow_up_date}</div>
              </div>
            ))
          )}
        </div>
        <div className="panel" style={{ marginBottom: "24px" }}>
          <h2>⏳ Upcoming Follow-Ups</h2>

          {upcomingFollowUpLeads.length === 0 ? (
            <p>No upcoming follow-ups.</p>
          ) : (
            upcomingFollowUpLeads
              .slice()
              .sort((a, b) =>
                (a.next_follow_up_date || "").localeCompare(b.next_follow_up_date || "")
              )
              .map((lead) => (
                <div key={lead.id} className="timelineEvent">
                  <strong>{lead.name}</strong>
                  <div className="actionBadge">Next Step: {getRecommendedAction(lead)}</div>
                  <div className={`priorityBadge priority${getLeadPriority(lead)}`}>
                    Priority: {getLeadPriority(lead)}
                  </div>
                  <div>Follow-up date: {lead.next_follow_up_date}</div>
                </div>
              ))
          )}
        </div>
        {activePage === "dashboard" && (
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
        )}

        {activePage === "dashboard" && (
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
                  selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0
                }
                onChange={async (e) => {
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

              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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
                    selectedLeadIds.includes(lead.id)
                  );

                  const { error } = await supabase.from("leads").delete().in("id", selectedLeadIds);

                  if (error) return alert("Error deleting selected leads");

                  setUndoLeads(leadsToDelete);
                  setUndoLead(null);

                  setLeads((prev) => prev.filter((lead) => !selectedLeadIds.includes(lead.id)));

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
                      : [...prev, lead.id]
                  );
                }}
                updateStatus={updateStatus}
                markContacted={markContacted}
                openWhatsApp={openWhatsApp}
                deleteLead={deleteLead}
                markSubmitted={markSubmitted}
                updateLeadName={updateLeadName}
                updateLeadPhone={updateLeadPhone}
                updateLeadConsultant={updateLeadConsultant}
                consultantNames={consultantNames}
              />
            ))}
          </section>
        )}
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

              const card = e.currentTarget.firstElementChild as HTMLElement | null;
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

              const rawDelta = data.startDragX + (e.clientX - data.startClientX);
              const delta = Math.max(data.minX, Math.min(data.maxX, rawDelta));
              const hitLeftEdge = data.startLeft + rawDelta <= 0;
              const hitRightEdge = data.startRight + rawDelta >= window.innerWidth;

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
              const card = e.currentTarget.firstElementChild as HTMLElement | null;
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
                Math.min(toastDragBoundsRef.current.maxX, rawNextX)
              );
              const hitLeftEdge = toastDragBoundsRef.current.startLeft + rawNextX <= 0;
              const hitRightEdge =
                toastDragBoundsRef.current.startRight + rawNextX >= window.innerWidth;

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
                toastState.type === "undo" ? "toast undoToast" : "toast normalToast"
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
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <defs>
                          <linearGradient id="trashGlow" x1="4" y1="3" x2="20" y2="21">
                            <stop stopColor="#ff6b6b" />
                            <stop offset="1" stopColor="#dc2626" />
                          </linearGradient>
                        </defs>

                        <rect x="5" y="7" width="14" height="14" rx="3" fill="url(#trashGlow)" />
                        <path
                          d="M9 7V5.5C9 4.7 9.7 4 10.5 4H13.5C14.3 4 15 4.7 15 5.5V7"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <path d="M4 7H20" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
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
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <defs>
                          <linearGradient id="restoreGlow" x1="4" y1="4" x2="20" y2="20">
                            <stop stopColor="#38bdf8" />
                            <stop offset="1" stopColor="#2563eb" />
                          </linearGradient>
                        </defs>

                        <circle cx="12" cy="12" r="9" fill="url(#restoreGlow)" />

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
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <defs>
                          <linearGradient id="undoGlow" x1="4" y1="4" x2="20" y2="20">
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
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <defs>
                          <linearGradient id="successGlow" x1="4" y1="4" x2="20" y2="20">
                            <stop stopColor="#34d399" />
                            <stop offset="1" stopColor="#059669" />
                          </linearGradient>
                        </defs>

                        <circle cx="12" cy="12" r="9" fill="url(#successGlow)" />

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
                <div className="toastProgress" key={`progress-${toastState.id}`} />
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
  markSubmitted,
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
  openWhatsApp: (lead: Lead) => void | Promise<void>;
  deleteLead: (lead: Lead) => void;
  markSubmitted: (id: string) => void;
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
  const [avatarHovered, setAvatarHovered] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(lead.avatar_url || null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [leadAttachments, setLeadAttachments] = useState<LeadAttachment[]>([]);
  const [leadActivities, setLeadActivities] = useState<LeadActivity[]>([]);
  const noteWidth = 280;
  const noteHeight = 240;

  const [notePosition, setNotePosition] = useState({
    x: typeof window !== "undefined" ? window.innerWidth - 340 : 900,
    y: 120,
  });

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draggingNote, setDraggingNote] = useState(false);
  useEffect(() => {
    if (!draggingNote) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();

      const nextX = Math.min(
        Math.max(e.clientX - dragOffset.x, 8),
        window.innerWidth - noteWidth - 8
      );

      const nextY = Math.min(
        Math.max(e.clientY - dragOffset.y, 8),
        window.innerHeight - noteHeight - 8
      );

      setNotePosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setDraggingNote(false);
    };

    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingNote, dragOffset.x, dragOffset.y]);

  useEffect(() => {
    if (!timelineOpen) return;

    const loadActivities = async () => {
      const { data, error } = await supabase
        .from("lead_activity")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Timeline load failed:", error);
        return;
      }

      setLeadActivities(data || []);
    };

    loadActivities();
  }, [timelineOpen, lead.id]);

  useEffect(() => {
    if (!attachmentsOpen) return;

    const loadAttachments = async () => {
      const { data, error } = await supabase
        .from("lead_attachments")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Attachments load failed:", error);
        return;
      }

      setLeadAttachments(data || []);
    };

    loadAttachments();
  }, [attachmentsOpen, lead.id]);

  const addActivity = useCallback(
    async (type: string, text: string) => {
      const { error } = await supabase.from("lead_activity").insert({
        lead_id: lead.id,
        activity_type: type,
        activity_text: text,
      });

      if (error) {
        console.error("Activity log failed:", error);
      }
    },
    [lead.id]
  );

  const [notesDraft, setNotesDraft] = useState(lead.notes || "");
  const lastLoggedNotesRef = useRef(lead.notes || "");
  useEffect(() => {
    const saveNotes = async () => {
      const { error } = await supabase
        .from("leads")
        .update({ notes: notesDraft })
        .eq("id", lead.id);

      if (error) {
        console.error("Notes save failed:", error);
        return;
      }

      if (notesDraft !== lastLoggedNotesRef.current) {
        lastLoggedNotesRef.current = notesDraft;
        await addActivity("notes_updated", "Lead notes updated");
      }
    };

    const timeout = setTimeout(saveNotes, 1000);
    return () => clearTimeout(timeout);
  }, [notesDraft, lead.id, addActivity]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initials = lead.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const followUpDate = lead.next_follow_up_date ? new Date(lead.next_follow_up_date) : null;

  const followUpDiff =
    followUpDate !== null ? Math.ceil((followUpDate.getTime() - today.getTime()) / 86400000) : null;
  return (
    <div
      className={`leadCard ${
        lead.source_type === "manager-assigned" ? "assignedLeadCard" : "selfLeadCard"
      } ${lead.submitted ? "submittedLeadCard" : ""}`}
      style={{
        position: "relative",
        overflow: "visible",
        marginTop: "30px",
      }}
    >
      <div
        className={`leadFolderTab ${
          lead.source_type === "manager-assigned" ? "assignedTab" : "selfTab"
        }`}
        style={{
          position: "absolute",
          top: "-24px",
          left: "18px",
          height: "32px",
          padding: "0 22px",
          display: "flex",
          alignItems: "center",
          borderRadius: "12px 12px 0 0",
          border: "1px solid #d7dde6",
          borderBottom: "none",
          zIndex: 999,
          background: lead.source_type === "manager-assigned" ? "#ecfdf3" : "#eef6ff",
          color: lead.source_type === "manager-assigned" ? "#166534" : "#1d4ed8",
          fontWeight: 700,
          fontSize: "12px",
        }}
      >
        {lead.source_type === "manager-assigned"
          ? lead.submitted
            ? "Submitted Assignment"
            : "Manager Assigned"
          : "Self Assigned"}
      </div>
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

                <select value={editConsultant} onChange={(e) => setEditConsultant(e.target.value)}>
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

                <button className="secondaryButton" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ lineHeight: 1.22 }}>
              <strong className="leadName">{lead.name}</strong>

              <p style={{ margin: "3px 0" }}>Consultant: {lead.consultant}</p>
              <p style={{ margin: "3px 0" }}>Phone: {lead.phone || "No phone"}</p>
              <p style={{ margin: "3px 0" }}>Ref: {lead.reference_number || "N/A"}</p>
              <div className="leadDateRow">
                <label>
                  Last Contact
                  <input
                    type="date"
                    defaultValue={lead.last_contact_date || ""}
                    onChange={async (e) => {
                      await supabase
                        .from("leads")
                        .update({ last_contact_date: e.target.value || null })
                        .eq("id", lead.id);

                      await supabase.from("lead_activity").insert({
                        lead_id: lead.id,
                        activity_type: "last_contact_updated",
                        activity_text: `Last contact date set to ${e.target.value}`,
                      });
                    }}
                  />
                </label>

                <label>
                  Next Follow-Up
                  <input
                    type="date"
                    defaultValue={lead.next_follow_up_date || ""}
                    onChange={async (e) => {
                      await supabase
                        .from("leads")
                        .update({ next_follow_up_date: e.target.value || null })
                        .eq("id", lead.id);

                      await supabase.from("lead_activity").insert({
                        lead_id: lead.id,
                        activity_type: "follow_up_updated",
                        activity_text: `Follow-up date set to ${e.target.value}`,
                      });
                    }}
                  />
                </label>
              </div>
              {followUpDiff !== null && (
                <div
                  className={
                    followUpDiff < 0
                      ? "followUpAlert overdue"
                      : followUpDiff === 0
                        ? "followUpAlert today"
                        : "followUpAlert upcoming"
                  }
                >
                  {followUpDiff < 0
                    ? `🔴 Follow-up overdue by ${Math.abs(followUpDiff)} day(s)`
                    : followUpDiff === 0
                      ? "🟢 Follow-up due today"
                      : `⏳ Follow-up in ${followUpDiff} day(s)`}
                </div>
              )}
            </div>
          )}

          <span className="badge" style={{ background: badgeColor(lead.next_action) }}>
            {lead.next_action}
          </span>

          <span className="badge" style={{ background: badgeColor(lead.status), marginLeft: 8 }}>
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
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button className="secondaryButton" onClick={() => markContacted(lead.id)}>
            Mark Contacted
          </button>

          <button className="whatsappButton" onClick={() => openWhatsApp(lead)}>
            <svg className="whatsappSvg" viewBox="0 0 448 512" aria-hidden="true">
              <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32 101.5 32 2 131.5 2 253.9c0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.5 224.1-221.9 0-59.3-25.2-115-67.1-157.1zM223.9 438.7c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3 18.6-68.1-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8s-14.3 18-17.6 21.8c-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2s-9.7 1.4-14.8 6.9c-5.1 5.6-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
            </svg>
            WhatsApp
          </button>

          {!isEditing && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button className="secondaryButton" onClick={() => setIsEditing(true)}>
                Edit
              </button>

              <button className="secondaryButton" onClick={() => setNotesOpen(true)}>
                Notes
              </button>

              <button className="secondaryButton" onClick={() => setTimelineOpen(true)}>
                Timeline
              </button>

              <button className="secondaryButton" onClick={() => setAttachmentsOpen(true)}>
                Attachments
              </button>
            </div>
          )}

          {lead.source_type === "manager-assigned" ? (
            <button className="secondaryButton" onClick={() => markSubmitted(lead.id)}>
              {lead.submitted ? "Unsubmit" : "Submit"}
            </button>
          ) : (
            <button className="dangerButton" onClick={() => deleteLead(lead)}>
              Delete
            </button>
          )}
        </div>
        {!isEditing && (
          <div
            className="leadAvatarUpload"
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={() => setAvatarHovered(true)}
            onMouseLeave={() => setAvatarHovered(false)}
            style={{
              marginLeft: "12px",
              marginRight: "4px",
              width: "180px",
              height: "96px",
              borderRadius: "18px",
              background: avatarHovered ? "#0f172a" : "#eef2f7",
              border: "2px solid #d8e0ea",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
              cursor: "pointer",
              flexShrink: 0,
              alignSelf: "flex-start",
              transform: "translateY(0px)",
              transition: "all 0.2s ease",
            }}
          >
            {!avatarHovered && avatarPreview ? (
              <Image
                src={avatarPreview}
                alt="Client avatar"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "18px",
                  boxShadow: "0 2px 8px rgba(15, 23, 42, 0.12)",
                }}
              />
            ) : !avatarHovered ? (
              <div
                style={{
                  fontSize: "70px",
                  fontWeight: 950,
                  lineHeight: 1,
                  letterSpacing: "-0.14em",
                  transform: "translateX(-4px)",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                {initials || "?"}
              </div>
            ) : (
              <div
                style={{
                  color: "white",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontSize: "13px",
                  fontWeight: 800,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "14px",
                    border: "1px solid rgba(255,255,255,0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    fontWeight: 300,
                  }}
                >
                  📁
                </div>
                <div style={{ lineHeight: 1.15 }}>
                  Upload
                  <br />
                  Media
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const fileExt = file.name.split(".").pop();
                const filePath = `${lead.id}-${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                  .from("lead-avatars")
                  .upload(filePath, file);

                console.error("Avatar upload failed:", uploadError);

                const { data } = supabase.storage.from("lead-avatars").getPublicUrl(filePath);

                const publicUrl = data.publicUrl;

                const { error: updateError } = await supabase
                  .from("leads")
                  .update({ avatar_url: publicUrl })
                  .eq("id", lead.id);

                console.error("Avatar update failed:", updateError);

                setAvatarPreview(publicUrl);
                await addActivity("avatar_uploaded", "Client photo uploaded");
              }}
            />
          </div>
        )}
      </div>
      {avatarPreview && !isEditing && (
        <div
          style={{
            marginLeft: "6px",
            marginRight: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "center",
          }}
        >
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();

              const { error } = await supabase
                .from("leads")
                .update({ avatar_url: null })
                .eq("id", lead.id);

              if (error) {
                alert("Reset failed: " + error.message);
                return;
              }

              setAvatarPreview(null);
              await addActivity("avatar_reset", "Client photo reset");
            }}
            style={{
              height: "30px",
              padding: "0 11px",
              borderRadius: "999px",
              border: "1px solid #d6dee9",
              background: "#f8fafc",
              color: "#64748b",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
            }}
          >
            Reset
          </button>
        </div>
      )}

      {notesOpen &&
        createPortal(
          <div
            className="notesOverlay"
            style={{
              left: notePosition.x,
              top: notePosition.y,
            }}
          >
            <div className="stickyNote">
              <div
                className="stickyNoteHeader"
                onMouseDown={(e) => {
                  e.preventDefault();

                  setDraggingNote(true);

                  setDragOffset({
                    x: e.clientX - notePosition.x,
                    y: e.clientY - notePosition.y,
                  });
                }}
              >
                <span>Lead Notes</span>

                <button
                  type="button"
                  className="stickyNoteClose"
                  onClick={() => setNotesOpen(false)}
                >
                  ×
                </button>
              </div>

              <textarea
                className="stickyNoteTextarea"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={"• Called client\n• Wants follow-up\n• Sent brochure"}
              />
            </div>
          </div>,
          document.body
        )}

      {timelineOpen &&
        createPortal(
          <div
            className="notesOverlay"
            style={{
              left: notePosition.x,
              top: notePosition.y,
            }}
          >
            <div className="stickyNote">
              <div className="stickyNoteHeader">
                <span>Activity Timeline</span>

                <button
                  type="button"
                  className="stickyNoteClose"
                  onClick={() => setTimelineOpen(false)}
                >
                  ×
                </button>
              </div>

              <div className="timelinePlaceholder">
                {leadActivities.length === 0 ? (
                  <div>No activity yet.</div>
                ) : (
                  leadActivities.map((activity) => (
                    <div key={activity.id} className="timelineEvent">
                      <div className="timelineEventText">{activity.activity_text}</div>
                      <div className="timelineEventDate">
                        {new Date(activity.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      {attachmentsOpen &&
        createPortal(
          <div
            className="notesOverlay"
            style={{
              left: notePosition.x,
              top: notePosition.y,
            }}
          >
            <div className="stickyNote">
              <div className="stickyNoteHeader">
                <span>Lead Attachments</span>

                <button
                  type="button"
                  className="stickyNoteClose"
                  onClick={() => setAttachmentsOpen(false)}
                >
                  ×
                </button>
              </div>

              <div className="timelinePlaceholder">
                <input
                  type="file"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];

                    if (!file) return;

                    const filePath = `${lead.id}/${Date.now()}-${file.name}`;

                    const { error: uploadError } = await supabase.storage
                      .from("lead-attachments")
                      .upload(filePath, file);

                    if (uploadError) {
                      console.error("Upload failed:", uploadError);
                      return;
                    }

                    const { data } = supabase.storage
                      .from("lead-attachments")
                      .getPublicUrl(filePath);

                    await supabase.from("lead_attachments").insert({
                      lead_id: lead.id,
                      file_name: file.name,
                      file_url: data.publicUrl,
                    });

                    const { data: attachments } = await supabase
                      .from("lead_attachments")
                      .select("*")
                      .eq("lead_id", lead.id)
                      .order("created_at", { ascending: false });

                    setLeadAttachments(attachments || []);

                    await addActivity("attachment_uploaded", `Attachment uploaded: ${file.name}`);
                  }}
                />

                <div style={{ marginTop: "12px" }}>
                  {leadAttachments.length === 0 ? (
                    <div>No attachments yet.</div>
                  ) : (
                    leadAttachments.map((attachment) => (
                      <div key={attachment.id} className="timelineEvent">
                        <a href={attachment.file_url} target="_blank">
                          {attachment.file_name}
                        </a>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
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
        position: relative;
        overflow: visible;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        padding: 12px;
        margin-top: 18px;
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
