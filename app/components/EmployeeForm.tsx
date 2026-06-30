"use client";

type Props = {
  employeeName: string;
  setEmployeeName: (value: string) => void;

  employeeEmail: string;
  setEmployeeEmail: (value: string) => void;

  employeeRole: string;
  setEmployeeRole: (value: string) => void;

  employeeDepartment: string;
  setEmployeeDepartment: (value: string) => void;

  departments: string[];

  editing: boolean;

  onSubmit: () => Promise<void>;
};

export default function EmployeeForm(props: Props) {
  return (
    <div>
      <h2>{props.editing ? "Edit Employee" : "Add Employee"}</h2>

      <p>This component will contain the employee form in the next step.</p>
    </div>
  );
}
