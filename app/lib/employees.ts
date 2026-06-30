import { supabase } from "@/app/lib/supabase";

export async function getEmployees() {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("active", { ascending: false })
    .order("full_name", { ascending: true });

  if (error) throw error;

  return data;
}
export async function getEmployeeByEmail(email: string) {
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, email, role, department, active, created_at, updated_at")
    .eq("email", email)
    .maybeSingle();

  if (error) throw error;

  return data;
}
export async function addEmployee(employee: {
  full_name: string;
  email: string;
  role: string;
  department: string;
  active: boolean;
}) {
  const { error } = await supabase.from("employees").insert(employee);

  if (error) throw error;
}

export async function updateEmployee(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("employees").update(updates).eq("id", id);

  if (error) throw error;
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from("employees").delete().eq("id", id);

  if (error) throw error;
}
