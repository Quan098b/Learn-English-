import type { ValidationIssue } from "../../lib/lesson-validator";

export function IssueList({ title, issues, tone = "error" }: { title: string; issues: ValidationIssue[]; tone?: "error" | "warning" }) {
  if (issues.length === 0) return null;
  return (
    <div className={`issues issues-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <p className="issues-title">{title}</p>
      <ul>
        {issues.slice(0, 50).map((issue, index) => (
          <li key={index}>
            <strong>{issue.where}:</strong> {issue.message}
            <br />
            <span className="muted">Cách sửa: {issue.fix}</span>
          </li>
        ))}
      </ul>
      {issues.length > 50 && <p className="muted small">…và {issues.length - 50} lỗi khác.</p>}
    </div>
  );
}
