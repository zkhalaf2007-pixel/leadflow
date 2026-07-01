"use client";

type Employee = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string | null;
  active: boolean;
};

type Props = {
  employees: Employee[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  onEdit: (employee: Employee) => void;
  onToggleActive: (employee: Employee) => Promise<void>;
  onDelete: (employee: Employee) => Promise<void>;
};

export default function EmployeeDirectory({
  employees,
  searchTerm,
  setSearchTerm,
  onEdit,
  onToggleActive,
  onDelete,
}: Props) {
  return (
    <div>
      <h2>Employee Directory</h2>

      <input
        type="text"
        placeholder="Search employees..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          marginBottom: "16px",
          width: "100%",
          maxWidth: "400px",
        }}
      />

      <p>
        Showing <strong>{employees.length}</strong> employee(s)
      </p>
      <div style={{ marginTop: "24px" }}>
        {employees
          .filter((employee) =>
            `${employee.full_name} ${employee.email}`
              .toLowerCase()
              .includes(searchTerm.toLowerCase())
          )
          .map((employee) => (
            <div key={employee.id} className="leadCard">
              <div>
                <strong>{employee.full_name}</strong>
                <p>{employee.email}</p>
                <p>
                  {employee.role} · {employee.department || "No department"}
                </p>
                <span
                  style={{
                    display: "inline-flex",
                    width: "fit-content",
                    padding: "6px 10px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 800,
                    background: employee.active ? "#dcfce7" : "#fee2e2",
                    color: employee.active ? "#166534" : "#991b1b",
                  }}
                >
                  {employee.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <button className="secondaryButton" onClick={() => onEdit(employee)}>
                  Edit
                </button>

                <button className="dangerButton" onClick={() => void onToggleActive(employee)}>
                  {employee.active ? "Deactivate" : "Reactivate"}
                </button>
                <button className="dangerButton" onClick={() => void onDelete(employee)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
