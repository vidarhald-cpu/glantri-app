interface FeedbackPanelProps {
  messages: string[];
}

export function FeedbackPanel({ messages }: FeedbackPanelProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: "#fff8e1",
        border: "1px solid #e6d38c",
        borderRadius: 12,
        padding: "1rem",
      }}
    >
      {messages.map((message) => (
        <div key={message}>{message}</div>
      ))}
    </div>
  );
}
