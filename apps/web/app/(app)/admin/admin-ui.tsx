"use client";

import type {
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

export interface AdminNavItem {
  description: string;
  href: string;
  label: string;
}

export interface AdminTableColumn<TRow> {
  header: string;
  render: (row: TRow) => ReactNode;
  width?: string;
}

export const adminNavItems: AdminNavItem[] = [
  {
    description: "Summary, draft status, and export entry points.",
    href: "/admin",
    label: "Overview"
  },
  {
    description: "Inspect and edit skill definitions and access.",
    href: "/admin/skills",
    label: "Skills"
  },
  {
    description: "Inspect and edit skill group structure.",
    href: "/admin/skill-groups",
    label: "Skill Groups"
  },
  {
    description: "Inspect and edit professions and grants.",
    href: "/admin/professions",
    label: "Professions"
  },
  {
    description: "Inspect and edit society/social-class rows.",
    href: "/admin/societies",
    label: "Societies"
  },
  {
    description: "Read relationship views across professions and society rows.",
    href: "/admin/access",
    label: "Access"
  },
  {
    description: "Inspect the system melee weapon catalog with split mode columns.",
    href: "/admin/melee-weapons",
    label: "Melee weapons"
  },
  {
    description: "Inspect the system missile weapon catalog with missile-appropriate attack columns.",
    href: "/admin/missile-weapons",
    label: "Missile weapons"
  },
  {
    description: "Inspect the system shield catalog with merged offensive and defensive workbook data.",
    href: "/admin/shields",
    label: "Shields"
  },
  {
    description: "Inspect the system armor catalog imported from the workbook Armor sheet.",
    href: "/admin/armor",
    label: "Armor"
  },
  {
    description: "Inspect the system gear catalog with shared encumbrance, value, and notes columns.",
    href: "/admin/gear",
    label: "Gear"
  },
  {
    description: "Inspect the system valuables catalog with shared encumbrance, value, and notes columns.",
    href: "/admin/valuables",
    label: "Valuables"
  },
  {
    description: "Manage local users and assign Player, GM, or Admin roles.",
    href: "/admin/players",
    label: "Players"
  },
  {
    description: "Read short player-facing notes for current combat calculations.",
    href: "/admin/documents",
    label: "Documents"
  },
  {
    description: "Inspect workbook-backed reference tables used by current combat and movement calculations.",
    href: "/admin/tables",
    label: "Tables"
  }
];

const panelStyle: CSSProperties = {
  background: "rgba(250, 245, 234, 0.88)",
  border: "1px solid rgba(85, 73, 48, 0.14)",
  borderRadius: 24,
  boxShadow: "0 16px 40px rgba(73, 56, 29, 0.08)",
  padding: "1.25rem"
};

const labelStyle: CSSProperties = {
  color: "#5f543a",
  display: "grid",
  fontSize: "0.9rem",
  fontWeight: 600,
  gap: "0.35rem"
};

const inputStyle: CSSProperties = {
  background: "rgba(255, 252, 245, 0.95)",
  border: "1px solid rgba(85, 73, 48, 0.18)",
  borderRadius: 14,
  color: "#2e2619",
  font: "inherit",
  padding: "0.65rem 0.8rem",
  width: "100%"
};

export function AdminPageIntro(props: {
  actions?: ReactNode;
  eyebrow: string;
  summary: string;
  title: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        alignItems: "end"
      }}
    >
      <div style={{ display: "grid", gap: "0.55rem" }}>
        <div
          style={{
            color: "#835c1f",
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase"
          }}
        >
          {props.eyebrow}
        </div>
        <h1
          style={{
            color: "#2c2418",
            fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
            fontSize: "clamp(2rem, 4vw, 3.1rem)",
            lineHeight: 1.05,
            margin: 0
          }}
        >
          {props.title}
        </h1>
        <p style={{ color: "#4f4635", fontSize: "1rem", lineHeight: 1.6, margin: 0, maxWidth: 760 }}>
          {props.summary}
        </p>
      </div>
      {props.actions ? (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {props.actions}
        </div>
      ) : null}
    </div>
  );
}

export function AdminPanel(props: { children: ReactNode; title?: string; subtitle?: string }) {
  return (
    <section style={panelStyle}>
      {props.title ? (
        <div style={{ display: "grid", gap: "0.35rem", marginBottom: "1rem" }}>
          <h2 style={{ color: "#2c2418", fontSize: "1.1rem", margin: 0 }}>{props.title}</h2>
          {props.subtitle ? (
            <p style={{ color: "#5f543a", lineHeight: 1.5, margin: 0 }}>{props.subtitle}</p>
          ) : null}
        </div>
      ) : null}
      {props.children}
    </section>
  );
}

export function AdminReadOnlyNotice(props: { message?: string }) {
  return (
    <div
      style={{
        background: "rgba(255, 252, 245, 0.88)",
        border: "1px solid rgba(85, 73, 48, 0.12)",
        borderRadius: 18,
        color: "#5f543a",
        lineHeight: 1.5,
        padding: "0.95rem 1rem"
      }}
    >
      {props.message ?? "This page is view-only for your current role."}
    </div>
  );
}

export function AdminMetric(props: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div
      style={{
        background: "rgba(255, 252, 245, 0.88)",
        border: "1px solid rgba(85, 73, 48, 0.12)",
        borderRadius: 18,
        display: "grid",
        gap: "0.3rem",
        padding: "0.95rem 1rem"
      }}
    >
      <div style={{ color: "#776b52", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {props.label}
      </div>
      <div style={{ color: "#241d12", fontSize: "1.5rem", fontWeight: 700 }}>{props.value}</div>
      {props.hint ? <div style={{ color: "#5f543a", fontSize: "0.9rem" }}>{props.hint}</div> : null}
    </div>
  );
}

export function formatAdminTimestamp(timestamp: string | undefined): string {
  if (!timestamp) {
    return "Not available";
  }

  return new Date(timestamp).toLocaleString();
}

export function AdminButton(props: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "ghost" | "primary" | "secondary";
}) {
  const background =
    props.variant === "secondary"
      ? "#d7e2d8"
      : props.variant === "ghost"
        ? "transparent"
        : "#7e5d2a";
  const border =
    props.variant === "ghost" ? "1px solid rgba(85, 73, 48, 0.18)" : "1px solid transparent";
  const color = props.variant === "primary" ? "#fffaf0" : "#2e2619";

  return (
    <button
      onClick={props.onClick}
      style={{
        background,
        border,
        borderRadius: 999,
        color,
        cursor: props.disabled ? "not-allowed" : "pointer",
        font: "inherit",
        fontWeight: 700,
        opacity: props.disabled ? 0.55 : 1,
        padding: "0.7rem 1rem"
      }}
      disabled={props.disabled}
      type={props.type ?? "button"}
    >
      {props.children}
    </button>
  );
}

export function AdminStatusBadge(props: {
  children: ReactNode;
  tone?: "danger" | "neutral" | "success" | "warning";
}) {
  const palette =
    props.tone === "danger"
      ? {
          background: "rgba(164, 69, 38, 0.12)",
          border: "1px solid rgba(164, 69, 38, 0.22)",
          color: "#7f2f17"
        }
      : props.tone === "success"
        ? {
            background: "rgba(62, 122, 82, 0.12)",
            border: "1px solid rgba(62, 122, 82, 0.18)",
            color: "#2f6a44"
          }
        : props.tone === "warning"
          ? {
              background: "rgba(163, 108, 23, 0.12)",
              border: "1px solid rgba(163, 108, 23, 0.18)",
              color: "#7b5713"
            }
          : {
              background: "rgba(126, 93, 42, 0.08)",
              border: "1px solid rgba(126, 93, 42, 0.15)",
              color: "#594320"
            };

  return (
    <span
      style={{
        ...palette,
        borderRadius: 999,
        display: "inline-flex",
        fontSize: "0.82rem",
        fontWeight: 700,
        padding: "0.3rem 0.65rem"
      }}
    >
      {props.children}
    </span>
  );
}

export function getAuditSeverityTone(
  severity: "blocking" | "info" | "warning"
): "danger" | "neutral" | "warning" {
  if (severity === "blocking") {
    return "danger";
  }

  if (severity === "warning") {
    return "warning";
  }

  return "neutral";
}

export function AdminAuditLegend() {
  return (
    <div style={{ display: "grid", gap: "0.65rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <AdminStatusBadge tone="danger">blocking</AdminStatusBadge>
        <AdminStatusBadge tone="warning">warning</AdminStatusBadge>
        <AdminStatusBadge tone="neutral">info</AdminStatusBadge>
      </div>
      <div style={{ color: "#5f543a", display: "grid", gap: "0.35rem", lineHeight: 1.5 }}>
        <span>`blocking` means the content model contradicts the intended layer semantics and should be fixed before deeper content-building.</span>
        <span>`warning` means the data is probably usable but likely deserves review before it spreads into more professions or society rows.</span>
        <span>`info` highlights context, balance outliers, or metadata polish that improves trust without implying broken content.</span>
      </div>
    </div>
  );
}

export function AdminTag({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        background: "rgba(126, 93, 42, 0.08)",
        border: "1px solid rgba(126, 93, 42, 0.15)",
        borderRadius: 999,
        color: "#594320",
        display: "inline-flex",
        fontSize: "0.82rem",
        fontWeight: 600,
        padding: "0.2rem 0.55rem"
      }}
    >
      {children}
    </span>
  );
}

export function AdminTagList(props: { emptyLabel?: string; values: string[] }) {
  if (props.values.length === 0) {
    return <span style={{ color: "#8a7e63" }}>{props.emptyLabel ?? "None"}</span>;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
      {props.values.map((value) => (
        <AdminTag key={value}>{value}</AdminTag>
      ))}
    </div>
  );
}

export function AdminDataTable<TRow extends { id: string }>(props: {
  columns: AdminTableColumn<TRow>[];
  emptyState: string;
  onSelect?: (rowId: string) => void;
  rows: TRow[];
  selectedId?: string;
}) {
  return (
    <div
      style={{
        overflowX: "auto",
        border: "1px solid rgba(85, 73, 48, 0.12)",
        borderRadius: 18
      }}
    >
      <table style={{ borderCollapse: "collapse", minWidth: 760, width: "100%" }}>
        <thead>
          <tr style={{ background: "rgba(126, 93, 42, 0.08)" }}>
            {props.columns.map((column) => (
              <th
                key={column.header}
                style={{
                  color: "#594320",
                  fontSize: "0.8rem",
                  letterSpacing: "0.08em",
                  padding: "0.8rem",
                  textAlign: "left",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  width: column.width
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.length === 0 ? (
            <tr>
              <td
                colSpan={props.columns.length}
                style={{ color: "#6d624d", padding: "1rem" }}
              >
                {props.emptyState}
              </td>
            </tr>
          ) : (
            props.rows.map((row) => {
              const selected = row.id === props.selectedId;

              return (
                <tr
                  key={row.id}
                  onClick={() => props.onSelect?.(row.id)}
                  style={{
                    background: selected ? "rgba(215, 226, 216, 0.72)" : "transparent",
                    cursor: props.onSelect ? "pointer" : "default"
                  }}
                >
                  {props.columns.map((column) => (
                    <td
                      key={column.header}
                      style={{
                        borderTop: "1px solid rgba(85, 73, 48, 0.1)",
                        color: "#2e2619",
                        padding: "0.9rem 0.8rem",
                        verticalAlign: "top"
                      }}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AdminField(props: {
  children: ReactNode;
  hint?: string;
  label: string;
}) {
  return (
    <label style={labelStyle}>
      <span>{props.label}</span>
      {props.hint ? <span style={{ color: "#776b52", fontSize: "0.82rem", lineHeight: 1.45 }}>{props.hint}</span> : null}
      {props.children}
    </label>
  );
}

export function AdminInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...(props.style ?? {}) }} />;
}

export function AdminSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...inputStyle, ...(props.style ?? {}) }} />;
}

export function AdminTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle, minHeight: 132, ...(props.style ?? {}) }} />;
}

export function AdminCheckboxList(props: {
  options: Array<{ label: string; selected: boolean; value: string }>;
  onToggle: (value: string) => void;
}) {
  return (
    <div
      style={{
        background: "rgba(255, 252, 245, 0.8)",
        border: "1px solid rgba(85, 73, 48, 0.1)",
        borderRadius: 18,
        display: "grid",
        gap: "0.5rem",
        maxHeight: 240,
        overflowY: "auto",
        padding: "0.8rem"
      }}
    >
      {props.options.map((option) => (
        <label
          key={option.value}
          style={{ alignItems: "start", color: "#3f3422", display: "flex", gap: "0.55rem" }}
        >
          <input
            checked={option.selected}
            onChange={() => props.onToggle(option.value)}
            style={{ marginTop: 3 }}
            type="checkbox"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
