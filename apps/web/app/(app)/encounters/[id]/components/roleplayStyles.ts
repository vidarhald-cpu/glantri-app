export const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

export const compactControlStyle = {
  display: "grid",
  gap: "0.2rem",
} as const;

export const compactInputStyle = {
  maxWidth: "8.75rem",
  minHeight: "1.9rem",
  width: "8.75rem",
} as const;

export const compactSkillInputStyle = {
  ...compactInputStyle,
  maxWidth: "10.5rem",
  width: "10.5rem",
} as const;

export const rollBlockShellStyle = {
  border: "1px solid #eee8dc",
  borderRadius: 10,
  display: "grid",
  gap: "0.6rem",
  padding: "0.75rem",
  overflow: "hidden",
} as const;

export const rollEditorStyle = {
  alignItems: "start",
  display: "grid",
  gap: "0.85rem",
  gridTemplateColumns: "minmax(0, 1fr) minmax(22rem, 1fr)",
  minWidth: 0,
} as const;

export const rollControlsStackStyle = {
  display: "grid",
  gap: "0.9rem",
  minWidth: 0,
} as const;

export const rollControlsStyle = {
  display: "grid",
  gap: "0.65rem",
  minWidth: 0,
} as const;

export const opponentControlsStyle = {
  ...rollControlsStyle,
  borderTop: "1px solid #eee8dc",
  paddingTop: "0.9rem",
} as const;

export const rollControlRowStyle = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "0.45rem",
} as const;

export const rollFieldRowStyle = {
  ...rollControlRowStyle,
  alignItems: "end",
} as const;

export const rollSkillGridStyle = {
  display: "grid",
  gap: "0.45rem 0.65rem",
  gridTemplateColumns: "repeat(2, minmax(0, max-content))",
} as const;

export const rollPreviewStyle = {
  background: "#fbfaf7",
  border: "1px solid #eee8dc",
  borderRadius: 8,
  color: "#5e5a50",
  display: "grid",
  gap: "0.35rem",
  gridTemplateRows: "auto",
  alignSelf: "stretch",
  boxSizing: "border-box",
  justifySelf: "stretch",
  minHeight: "10.5rem",
  minWidth: 0,
  padding: "0.65rem",
  width: "100%",
} as const;

export const calculationLineStyle = {
  display: "block",
  overflowX: "auto",
  whiteSpace: "nowrap",
} as const;

export const playerReadOnlyPanelStyle = {
  background: "#fbfaf7",
  border: "1px solid #eee8dc",
  borderRadius: 8,
  padding: "0.75rem",
  whiteSpace: "pre-wrap",
} as const;

export const playerMetadataTagStyle = {
  flex: "0 1 auto",
  fontSize: "0.95rem",
  fontWeight: 400,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

export const playerRollSkillColumnsStyle = {
  alignItems: "end",
  display: "grid",
  gap: "0.45rem",
  gridTemplateColumns: "minmax(8rem, 9rem) minmax(10rem, 12rem)",
} as const;
