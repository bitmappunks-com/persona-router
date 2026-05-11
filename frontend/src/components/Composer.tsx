import { FormEvent } from "react";

interface Props {
  topic: string;
  onTopicChange: (value: string) => void;
  status: string;
  isError: boolean;
  isBusy: boolean;
  onSubmit: () => void;
}

export function Composer({
  topic,
  onTopicChange,
  status,
  isError,
  isBusy,
  onSubmit,
}: Props) {
  return (
    <form
      className="composer"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        rows={3}
        placeholder="@feynman @steve_jobs 讨论一下产品发布会为什么容易变成形式主义"
        value={topic}
        onChange={(event) => onTopicChange(event.target.value)}
      />
      <div className="composer-actions">
        <div className={`status-line ${isError ? "error" : ""}`}>{status}</div>
        <button type="submit" className="primary-button" disabled={isBusy}>
          {isBusy ? "Running…" : "Run round"}
        </button>
      </div>
    </form>
  );
}
