"use client";

import { useState } from "react";

type Props = {
  departments: string[];
  employees: { department: string | null }[];
  onAdd: (department: string) => Promise<void>;
  onDelete: (department: string) => Promise<void>;
};

export default function DepartmentManager({ departments, employees, onAdd, onDelete }: Props) {
  const [newDepartment, setNewDepartment] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const getEmployeeCount = (department: string) =>
    employees.filter((employee) => employee.department === department).length;

  return (
    <div>
      <h2>Departments</h2>

      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="New department"
          value={newDepartment}
          onChange={(e) => setNewDepartment(e.target.value)}
        />

        <button
          disabled={saving}
          className="primaryButton"
          onClick={async () => {
            setSaving(true);

            try {
              await onAdd(newDepartment);
              setNewDepartment("");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Adding..." : "Add Department"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto",
          gap: "16px",
          fontWeight: 700,
          marginBottom: "12px",
          color: "#64748b",
        }}
      >
        <div>Department</div>
        <div>Employees</div>
        <div>Actions</div>
      </div>

      <ul style={{ padding: 0 }}>
        {departments.map((department) => (
          <li
            key={department}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: "16px",
              alignItems: "center",
              marginBottom: "12px",
              listStyle: "none",
            }}
          >
            <div>{department}</div>

            <div style={{ color: "#64748b", fontWeight: 600 }}>{getEmployeeCount(department)}</div>

            <button
              disabled={deleting === department}
              className="dangerButton"
              onClick={async () => {
                setDeleting(department);

                try {
                  await onDelete(department);
                } finally {
                  setDeleting(null);
                }
              }}
            >
              {deleting === department ? "Deleting..." : "Delete"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
