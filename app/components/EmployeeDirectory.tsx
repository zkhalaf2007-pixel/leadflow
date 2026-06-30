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
};

export default function EmployeeDirectory({ employees, searchTerm, setSearchTerm }: Props) {
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
    </div>
  );
}
