"use client";

type Props = {
  editing: boolean;
  employeeName: string;
  setEmployeeName: (value: string) => void;
  employeeEmail: string;
  setEmployeeEmail: (value: string) => void;
  employeeRole: string;
  setEmployeeRole: (value: string) => void;
  employeeDepartment: string;
  setEmployeeDepartment: (value: string) => void;
  departments: string[];
  onSubmit: () => Promise<void>;
  submitLabel: string;
};

export default function EmployeeForm({
  editing,
  employeeName,
  setEmployeeName,
  employeeEmail,
  setEmployeeEmail,
  employeeRole,
  setEmployeeRole,
  employeeDepartment,
  setEmployeeDepartment,
  departments,
  onSubmit,
  submitLabel,
}: Props) {
  return (
    <div>
      <h2>{editing ? "Edit Employee" : "Add Employee"}</h2>

      <div className="formGrid">
        <input
          placeholder="Full name"
          value={employeeName}
          onChange={(e) => setEmployeeName(e.target.value)}
        />

        <input
          placeholder="Email"
          value={employeeEmail}
          onChange={(e) => setEmployeeEmail(e.target.value)}
        />

        <select value={employeeRole} onChange={(e) => setEmployeeRole(e.target.value)}>
          <option value="consultant">Consultant</option>
          <option value="manager">Manager</option>
          <option value="accountant">Accountant</option>
          <option value="admin">Admin</option>
        </select>

        <select value={employeeDepartment} onChange={(e) => setEmployeeDepartment(e.target.value)}>
          {departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
      </div>
      <button className="primaryButton" onClick={() => void onSubmit()}>
        {submitLabel}
      </button>
    </div>
  );
}
