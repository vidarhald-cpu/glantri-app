import styles from "./FeedbackPanel.module.css";

interface FeedbackPanelProps {
  messages: string[];
}

export function FeedbackPanel({ messages }: FeedbackPanelProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className={styles.panel}>
      {messages.map((message) => (
        <div key={message}>{message}</div>
      ))}
    </div>
  );
}
