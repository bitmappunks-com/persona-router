import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import { useAppState } from "../state";
import { useT } from "../i18n";
import type { Agent } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (handles: string[], name: string | null) => Promise<void> | void;
}

export function CreateGroupModal({ open, onClose, onConfirm }: Props) {
  const { agents } = useAppState();
  const t = useT();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setPicked([]);
      setName("");
      setBusy(false);
    }
  }, [open]);

  const visibleAgents = useMemo(
    () => agents.filter((a) => a.handle !== "dispatcher"),
    [agents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleAgents;
    return visibleAgents.filter((agent) => {
      const haystack = `${agent.handle} ${agent.display_name} ${(agent.domains || []).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [visibleAgents, query]);

  const pickedAgents = useMemo(
    () => visibleAgents.filter((a) => picked.includes(a.handle)),
    [picked, visibleAgents],
  );

  const togglePick = (agent: Agent) => {
    setPicked((prev) =>
      prev.includes(agent.handle)
        ? prev.filter((h) => h !== agent.handle)
        : [...prev, agent.handle],
    );
  };

  const confirm = async () => {
    if (picked.length === 0) return;
    setBusy(true);
    try {
      await onConfirm(picked, name.trim() || null);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="wx-modal-scrim" onClick={onClose}>
      <div className="wx-modal" onClick={(e) => e.stopPropagation()}>
        <header className="wx-modal-head">
          <span>{t("create_group.title")}</span>
          <button type="button" className="wx-text-link" onClick={onClose}>
            {t("create_group.cancel")}
          </button>
        </header>

        <div className="wx-modal-body">
          <div className="wx-modal-picked" aria-label={t("create_group.selected_count", { count: picked.length })}>
            {pickedAgents.length === 0 ? (
              <span className="wx-modal-picked-empty">{t("create_group.empty_selection")}</span>
            ) : (
              pickedAgents.map((agent) => (
                <button
                  type="button"
                  key={agent.agent_id}
                  className="wx-modal-chip"
                  onClick={() => togglePick(agent)}
                  title={t("drawer.kick")}
                >
                  <Avatar agent={agent} size="xs" />
                  <span>{agent.display_name}</span>
                  <span className="wx-modal-chip-x">×</span>
                </button>
              ))
            )}
          </div>

          <input
            className="wx-modal-name"
            type="text"
            placeholder={t("create_group.name_placeholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
          />

          <input
            className="wx-modal-search"
            type="search"
            placeholder={t("create_group.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="wx-modal-list">
            {filtered.map((agent) => {
              const isPicked = picked.includes(agent.handle);
              return (
                <button
                  type="button"
                  key={agent.agent_id}
                  className={`wx-modal-row ${isPicked ? "picked" : ""}`}
                  onClick={() => togglePick(agent)}
                >
                  <span className={`wx-modal-check ${isPicked ? "on" : ""}`} aria-hidden="true">
                    {isPicked ? "✓" : ""}
                  </span>
                  <Avatar agent={agent} size="sm" />
                  <span className="wx-modal-name-block">
                    <span className="wx-modal-name-line">{agent.display_name}</span>
                    <span className="wx-modal-handle-line">@{agent.handle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="wx-modal-foot">
          <span className="wx-modal-count">{t("create_group.selected_count", { count: picked.length })}</span>
          <button
            type="button"
            className="wx-btn primary"
            disabled={picked.length === 0 || busy}
            onClick={confirm}
          >
            {t("create_group.confirm")}
          </button>
        </footer>
      </div>
    </div>
  );
}
