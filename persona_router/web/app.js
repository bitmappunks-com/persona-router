const state = {
  agents: [],
  active: [],
  selected: null,
  session: null,
  rounds: [],
};

const els = {
  agentList: document.querySelector("#agentList"),
  agentCount: document.querySelector("#agentCount"),
  activeChips: document.querySelector("#activeChips"),
  clearActiveButton: document.querySelector("#clearActiveButton"),
  composer: document.querySelector("#composer"),
  nextRoundButton: document.querySelector("#nextRoundButton"),
  search: document.querySelector("#agentSearch"),
  sessionLabel: document.querySelector("#sessionLabel"),
  sourceInspector: document.querySelector("#sourceInspector"),
  sourceRisk: document.querySelector("#sourceRisk"),
  statusLine: document.querySelector("#statusLine"),
  topicInput: document.querySelector("#topicInput"),
  topicTitle: document.querySelector("#topicTitle"),
  transcript: document.querySelector("#transcript"),
};

async function boot() {
  bindEvents();
  setStatus("Loading agents");
  state.agents = await api("/agents");
  const created = await api("/sessions", { method: "POST" });
  state.session = created.session;
  state.active = [...state.session.active_agent_ids];
  els.sessionLabel.textContent = state.session.session_id;
  renderAll();
  setStatus("Ready");
}

function bindEvents() {
  els.search.addEventListener("input", renderAgents);
  els.clearActiveButton.addEventListener("click", () => setActive([]));
  els.nextRoundButton.addEventListener("click", nextRound);
  els.composer.addEventListener("submit", (event) => {
    event.preventDefault();
    runRound();
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || response.statusText);
  }
  return payload;
}

function renderAll() {
  renderAgents();
  renderActive();
  renderTranscript();
  renderInspector();
  els.nextRoundButton.disabled = state.rounds.length === 0 || state.active.length === 0;
}

function renderAgents() {
  const query = els.search.value.trim().toLowerCase();
  const filtered = state.agents.filter((agent) => {
    const text = `${agent.handle} ${agent.display_name} ${(agent.domains || []).join(" ")}`.toLowerCase();
    return text.includes(query);
  });
  els.agentCount.textContent = `${filtered.length}/${state.agents.length}`;
  els.agentList.replaceChildren(
    ...filtered.map((agent) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = [
        "agent-row",
        state.active.includes(agent.agent_id) ? "active" : "",
        state.selected?.agent_id === agent.agent_id ? "selected" : "",
      ].join(" ");
      row.addEventListener("click", () => toggleAgent(agent));

      const dot = document.createElement("span");
      dot.className = "toggle-dot";
      dot.setAttribute("aria-hidden", "true");

      const body = document.createElement("span");
      const title = document.createElement("span");
      title.className = "agent-title";
      title.innerHTML = `<strong>${escapeHtml(agent.display_name)}</strong><span class="handle">@${escapeHtml(agent.handle)}</span>`;

      const badges = document.createElement("span");
      badges.className = "badges";
      badges.append(
        badge(agent.risk_level || "medium", agent.risk_level || "medium"),
        badge(agent.source?.license_status || "license_unknown"),
        ...agent.domains.slice(0, 2).map((domain) => badge(domain)),
      );

      body.append(title, badges);
      row.append(dot, body);
      return row;
    }),
  );
}

function renderActive() {
  const activeAgents = activeAgentsInOrder();
  els.activeChips.replaceChildren(
    ...activeAgents.map((agent) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = `@${agent.handle} ×`;
      chip.title = `Deactivate @${agent.handle}`;
      chip.addEventListener("click", () => setActive(state.active.filter((id) => id !== agent.agent_id)));
      return chip;
    }),
  );
  els.clearActiveButton.disabled = state.active.length === 0;
}

function renderTranscript() {
  if (!state.rounds.length) {
    els.transcript.innerHTML = `
      <div class="empty-state">
        <div class="empty-grid" aria-hidden="true"></div>
        <h3>Start with mentions or active agents.</h3>
        <p>Pick two or more people on the left, write a subject, then run a round.</p>
      </div>
    `;
    return;
  }
  els.transcript.replaceChildren(
    ...state.rounds.map((round) => {
      const section = document.createElement("section");
      section.className = "round";
      const title = document.createElement("div");
      title.className = "round-title";
      title.textContent = `Round ${round.round_index}${round.needs_verification ? " · needs verification" : ""}`;
      section.append(title, ...round.turns.map(renderTurn));
      return section;
    }),
  );
  els.transcript.scrollTop = els.transcript.scrollHeight;
}

function renderTurn(turn) {
  const agent = state.agents.find((item) => item.agent_id === turn.agent_id);
  const card = document.createElement("article");
  card.className = "turn";
  card.addEventListener("click", () => {
    state.selected = agent;
    renderAll();
  });
  card.innerHTML = `
    <div class="turn-head">
      <h3>${escapeHtml(agent?.display_name || turn.handle)}</h3>
      <span class="badge">${escapeHtml(turn.trigger)}</span>
    </div>
    <p>${escapeHtml(turn.content)}</p>
  `;
  return card;
}

function renderInspector() {
  const agent = state.selected || activeAgentsInOrder()[0];
  if (!agent) {
    els.sourceRisk.textContent = "none";
    els.sourceInspector.innerHTML = "<p>Select an agent to inspect source, license, risk, and boundaries.</p>";
    return;
  }
  els.sourceRisk.textContent = agent.risk_level || "medium";
  const source = agent.source || {};
  const repo = source.source_repository || source.upstream_repository || "";
  els.sourceInspector.innerHTML = `
    <dl>
      <dt>Agent</dt>
      <dd>${escapeHtml(agent.display_name)} <span class="handle">@${escapeHtml(agent.handle)}</span></dd>
      <dt>License</dt>
      <dd>${escapeHtml(source.license_status || "license_unknown")}</dd>
      <dt>Repository</dt>
      <dd>${repo ? `<a href="${escapeAttr(repo)}" target="_blank" rel="noreferrer">${escapeHtml(repo)}</a>` : "not provided"}</dd>
      <dt>Commit</dt>
      <dd>${escapeHtml(source.source_commit || source.upstream_commit || "not provided")}</dd>
      <dt>Domains</dt>
      <dd>${escapeHtml((agent.domains || []).join(", ") || "none")}</dd>
      <dt>Boundaries</dt>
      <dd>${escapeHtml((agent.runtime_boundaries || []).slice(0, 2).join(" "))}</dd>
    </dl>
  `;
}

async function toggleAgent(agent) {
  state.selected = agent;
  const active = state.active.includes(agent.agent_id)
    ? state.active.filter((id) => id !== agent.agent_id)
    : [...state.active, agent.agent_id];
  await setActive(active);
}

async function setActive(agentIds) {
  state.active = agentIds;
  renderAll();
  const handles = activeAgentsInOrder().map((agent) => agent.handle);
  if (!state.session) {
    return;
  }
  try {
    const session = await api(`/sessions/${state.session.session_id}/active`, {
      method: "POST",
      body: JSON.stringify({ handles }),
    });
    state.session = session;
    state.active = [...session.active_agent_ids];
    renderAll();
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function runRound() {
  const topic = els.topicInput.value.trim();
  if (!topic) {
    setStatus("Write a topic first", true);
    return;
  }
  const mentions = activeAgentsInOrder().map((agent) => `@${agent.handle}`).join(" ");
  const text = topic.includes("@") ? topic : `${mentions} ${topic}`.trim();
  await submitRound(`/sessions/${state.session.session_id}/round`, { text });
}

async function nextRound() {
  await submitRound(`/sessions/${state.session.session_id}/next`);
}

async function submitRound(path, body) {
  setBusy(true);
  try {
    const payload = await api(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
    state.session = payload.session;
    state.active = [...payload.session.active_agent_ids];
    state.rounds.push(payload.round);
    els.topicTitle.textContent = state.session.topic || "Active discussion";
    if (body?.text) {
      els.topicInput.value = state.session.topic || "";
    }
    setStatus("Round complete");
    renderAll();
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setBusy(false);
  }
}

function activeAgentsInOrder() {
  const activeSet = new Set(state.active);
  return state.agents.filter((agent) => activeSet.has(agent.agent_id));
}

function badge(text, tone = "") {
  const item = document.createElement("span");
  item.className = `badge ${tone}`;
  item.textContent = text;
  return item;
}

function setBusy(isBusy) {
  document.querySelector("#sendButton").disabled = isBusy;
  els.nextRoundButton.disabled = isBusy || state.rounds.length === 0 || state.active.length === 0;
  if (isBusy) {
    setStatus("Running round");
  }
}

function setStatus(message, isError = false) {
  els.statusLine.textContent = message;
  els.statusLine.className = `status-line ${isError ? "error" : ""}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

boot().catch((error) => setStatus(error.message, true));
