import { supabase } from "@/app/lib/supabase";

export async function getDepartments() {
  const { data, error } = await supabase
    .from("departments")
    .select("name")
    .order("name", { ascending: true });

  if (error) throw error;

  return data.map((department) => department.name);
}

export async function addDepartment(name: string) {
  const { error } = await supabase.from("departments").insert({ name });

  if (error) throw error;
}

export async function deleteDepartment(name: string) {
  const { error } = await supabase.from("departments").delete().eq("name", name);

  if (error) throw error;
}
