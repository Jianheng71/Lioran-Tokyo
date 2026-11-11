/**
 * Lioran—Tokyo P5 chat window.
 * Layout adapted from jakobhoeg/nextjs-ollama-llm-ui (MIT, see ui/chat-window/).
 * Wires Hono APIs only — no Ollama /api/tags, no LangChain useChat.
 */

const HISTORY_KEY = "lioran.sessions";
const ACTIVE_KEY = "lioran.sessionId";

const state = {
  sessionId: localStorage.getItem(ACTIVE_KEY) || null,
  phase: "idle",
  awaitingConfirm: false,
  activeJobId: null,
  pollTimer: null,
  pollGeneration: 0,
  history: loadHistory(),
};

const els = {
  shell: document.getElementById("shell"),
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebar-toggle"),
  sidebarCollapse: document.getElementById("sidebar-collapse"),
  sidebarBackdrop: document.getElementById("sidebar-backdrop"),
  newChat: document.getElementById("new-chat"),
  sessionList: document.getElementById("session-list"),
  empty: document.getElementById("empty"),
  thread: document.getElementById("thread"),
  scroller: document.getElementById("scroller"),
  form: document.getElementById("form"),
  composer: document.getElementById("composer"),
  send: document.getElementById("send"),
  confirmBar: document.getElementById("confirm-bar"),
  confirmText: document.getElementById("confirm-text"),
  confirmBtn: document.getElementById("confirm-btn"),
  health: document.getElementById("health-chip"),
};

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, 40)));
}

function upsertHistory(sessionId, preview) {
  if (!sessionId) return;
  const next = state.history.filter((item) => item.id !== sessionId);
  next.unshift({
    id: sessionId,
    preview: (preview || "New chat").slice(0, 80),
    updatedAt: Date.now(),
  });
  state.history = next;
  saveHistory();
  renderSessionList();
}

function removeHistory(sessionId) {
  state.history = state.history.filter((item) => item.id !== sessionId);
  saveHistory();
  if (state.sessionId === sessionId) startNewChat();
  else renderSessionList();
}

function renderSessionList() {
  els.sessionList.replaceChildren();
  if (!state.history.length) {
    const empty = document.createElement("p");
    empty.className = "sidebar-label";
    empty.style.marginTop = "0";
    empty.textContent = "No chats yet";
    els.sessionList.appendChild(empty);
    return;
  }
  for (const item of state.history) {
    const row = document.createElement("div");
    row.className = `session-item${item.id === state.sessionId ? " active" : ""}`;
    row.setAttribute("role", "button");
    row.tabIndex = 0;

    const preview = document.createElement("span");
    preview.className = "session-preview";
    preview.textContent = item.preview || item.id;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "session-delete";
    del.setAttribute("aria-label", "Delete chat");
    del.textContent = "×";
    del.addEventListener("click", (event) => {
      event.stopPropagation();
      removeHistory(item.id);
    });

    row.append(preview, del);
    row.addEventListener("click", () => void openSession(item.id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        void openSession(item.id);
      }
    });
    els.sessionList.appendChild(row);
  }
}

function setMobileSidebar(open) {
  els.shell.classList.toggle("sidebar-open", open);
  els.sidebarBackdrop.hidden = !open;
  els.sidebarToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function setCollapsed(collapsed) {
  els.shell.classList.toggle("sidebar-collapsed", collapsed);
  els.sidebarCollapse.setAttribute("aria-expanded", collapsed ? "false" : "true");
  els.sidebarCollapse.setAttribute(
    "aria-label",
    collapsed ? "Expand sidebar" : "Collapse sidebar",
  );
  localStorage.setItem("lioran.sidebarCollapsed", collapsed ? "1" : "0");
}

function showThread() {
  els.empty.hidden = true;
  els.thread.hidden = false;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    els.scroller.scrollTop = els.scroller.scrollHeight;
  });
}

function appendBubble(role, content, opts = {}) {
  showThread();
  const row = document.createElement("div");
  row.className = `bubble-row ${role}`;

  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "LT";
    avatar.setAttribute("aria-hidden", "true");
    row.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  let kind = "bubble";
  if (opts.clarify) kind += " clarify";
  if (opts.progress) kind += " progress";
  if (opts.error) kind += " error";
  bubble.className = kind;
  bubble.textContent = content;

  if (opts.meta) {
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = opts.meta;
    bubble.appendChild(meta);
  }

  row.appendChild(bubble);
  els.thread.appendChild(row);
  scrollToBottom();
  return { row, bubble };
}

function appendSkeleton() {
  showThread();
  const row = document.createElement("div");
  row.className = "bubble-row assistant";
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = "LT";
  avatar.setAttribute("aria-hidden", "true");
  const bubble = document.createElement("div");
  bubble.className = "bubble skeleton";
  bubble.setAttribute("aria-hidden", "true");
  row.append(avatar, bubble);
  els.thread.appendChild(row);
  scrollToBottom();
  return row;
}

function appendVideoCard(url, jobId) {
  showThread();
  const row = document.createElement("div");
  row.className = "bubble-row assistant";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = "LT";
  avatar.setAttribute("aria-hidden", "true");

  const card = document.createElement("div");
  card.className = "video-card";

  const video = document.createElement("video");
  video.controls = true;
  video.playsInline = true;
  video.src = url;
  video.setAttribute("aria-label", `Promo video ${jobId}`);

  const actions = document.createElement("div");
  actions.className = "video-actions";

  const download = document.createElement("a");
  download.className = "btn btn-secondary";
  download.href = url;
  download.download = `${jobId}.mp4`;
  download.textContent = "Download MP4";

  const meta = document.createElement("span");
  meta.className = "meta";
  meta.style.marginTop = "0";
  meta.textContent = jobId;

  actions.append(download, meta);
  card.append(video, actions);
  row.append(avatar, card);
  els.thread.appendChild(row);
  scrollToBottom();
}

function setConfirm(visible, summary) {
  state.awaitingConfirm = visible;
  els.confirmBar.hidden = !visible;
  if (visible) {
    els.confirmText.textContent =
      summary ||
      "I think I understand the request. Confirm to start the video, or send another note first.";
  }
}

function setBusy(busy) {
  els.send.disabled = busy || !els.composer.value.trim();
  els.confirmBtn.disabled = busy;
  els.composer.disabled = busy;
}

function syncSendEnabled() {
  els.send.disabled = els.composer.disabled || !els.composer.value.trim();
}

function startNewChat() {
  stopPoll();
  state.sessionId = null;
  state.phase = "idle";
  state.awaitingConfirm = false;
  state.activeJobId = null;
  localStorage.removeItem(ACTIVE_KEY);
  els.thread.replaceChildren();
  els.thread.hidden = true;
  els.empty.hidden = false;
  setConfirm(false);
  setMobileSidebar(false);
  renderSessionList();
  els.composer.focus();
}

async function openSession(sessionId) {
  stopPoll();
  setMobileSidebar(false);
  try {
    const res = await fetch(`/v1/sessions/${encodeURIComponent(sessionId)}`);
    const data = await res.json();
    if (!res.ok) {
      removeHistory(sessionId);
      appendBubble("assistant", data.error || "Session not found", { error: true });
      return;
    }
    state.sessionId = sessionId;
    localStorage.setItem(ACTIVE_KEY, sessionId);
    state.phase = data.chat?.phase || "idle";
    els.thread.replaceChildren();
    const messages = data.chat?.messages || [];
    if (!messages.length) {
      els.thread.hidden = true;
      els.empty.hidden = false;
    } else {
      for (const message of messages) {
        appendBubble(message.role === "user" ? "user" : "assistant", message.content);
      }
    }
    setConfirm(state.phase === "awaiting_confirm", data.chat?.draft?.summary || null);
    if (data.chat?.activeJobId && state.phase === "running") {
      watchJob(data.chat.activeJobId);
    } else if (data.lastVideoUrl && data.lastJobId) {
      appendVideoCard(data.lastVideoUrl, data.lastJobId);
    }
    renderSessionList();
  } catch (err) {
    appendBubble("assistant", err instanceof Error ? err.message : String(err), { error: true });
  }
}

async function refreshHealth() {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    const hermesOk = data.checks?.hermes?.ok;
    if (data.ok && hermesOk) {
      els.health.textContent = "Ready";
      els.health.className = "sidebar-health ok";
    } else if (data.ok) {
      els.health.textContent = "Ready · Hermes offline";
      els.health.className = "sidebar-health warn";
    } else {
      els.health.textContent = "Degraded";
      els.health.className = "sidebar-health warn";
    }
  } catch {
    els.health.textContent = "Unreachable";
    els.health.className = "sidebar-health warn";
  }
}

async function sendMessage(message) {
  setBusy(true);
  appendBubble("user", message);
  const skeleton = appendSkeleton();
  try {
    const res = await fetch("/v1/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId, message }),
    });
    const data = await res.json();
    skeleton.remove();
    if (!res.ok) {
      appendBubble("assistant", data.error || "Request failed", { error: true });
      return;
    }
    state.sessionId = data.sessionId;
    localStorage.setItem(ACTIVE_KEY, data.sessionId);
    state.phase = data.phase;
    upsertHistory(data.sessionId, message);

    const clarify = data.status === "need_clarification";
    appendBubble("assistant", data.reply, {
      clarify,
      meta: data.source === "rules" ? "local rules" : undefined,
    });
    setConfirm(data.status === "ready_to_confirm", data.draft?.summary || data.reply);
    if (data.jobId) {
      setConfirm(false);
      watchJob(data.jobId);
    }
  } catch (err) {
    skeleton.remove();
    appendBubble("assistant", err instanceof Error ? err.message : String(err), { error: true });
  } finally {
    setBusy(false);
    syncSendEnabled();
  }
}

async function confirmJob() {
  if (!state.sessionId) return;
  setBusy(true);
  const skeleton = appendSkeleton();
  try {
    const res = await fetch(`/v1/chat/${encodeURIComponent(state.sessionId)}/confirm`, {
      method: "POST",
    });
    const data = await res.json();
    skeleton.remove();
    if (!res.ok) {
      appendBubble("assistant", data.error || "Confirm failed", { error: true });
      return;
    }
    appendBubble("user", "Confirm");
    appendBubble("assistant", data.reply);
    setConfirm(false);
    watchJob(data.jobId);
  } catch (err) {
    skeleton.remove();
    appendBubble("assistant", err instanceof Error ? err.message : String(err), { error: true });
  } finally {
    setBusy(false);
    syncSendEnabled();
  }
}

function stopPoll() {
  state.pollGeneration += 1;
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

function watchJob(jobId) {
  stopPoll();
  const generation = state.pollGeneration;
  state.activeJobId = jobId;
  appendBubble("assistant", "Queued. The finished video will appear in this chat.", {
    progress: true,
    meta: jobId,
  });
  const status = appendBubble("assistant", "Status: queued", {
    progress: true,
    meta: jobId,
  });

  async function poll() {
    if (generation !== state.pollGeneration) return;
    try {
      const res = await fetch(`/v1/jobs/${encodeURIComponent(jobId)}`);
      if (generation !== state.pollGeneration) return;
      const job = await res.json();
      if (generation !== state.pollGeneration) return;
      if (!res.ok) {
        status.bubble.textContent = job.error || "Job missing";
        status.bubble.classList.add("error");
        stopPoll();
        return;
      }
      status.bubble.textContent = `Status: ${job.status}`;
      if (job.stageDetail) {
        status.bubble.textContent += ` · ${job.stageDetail}`;
      }
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = jobId;
      status.bubble.appendChild(meta);

      if (job.status === "done" && job.videoUrl) {
        stopPoll();
        appendVideoCard(job.videoUrl, jobId);
        appendBubble(
          "assistant",
          "Video ready. Play or download it above, or ask to change one line.",
        );
      } else if (job.status === "failed") {
        stopPoll();
        appendBubble("assistant", job.error || "Job failed", { error: true });
      }
    } catch (err) {
      if (generation !== state.pollGeneration) return;
      status.bubble.textContent = err instanceof Error ? err.message : String(err);
      status.bubble.classList.add("error");
    }
  }

  state.pollTimer = setInterval(() => {
    void poll();
  }, 1500);
}

function autoGrowComposer() {
  els.composer.style.height = "auto";
  els.composer.style.height = `${Math.min(els.composer.scrollHeight, 160)}px`;
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = els.composer.value.trim();
  if (!message) return;
  els.composer.value = "";
  autoGrowComposer();
  syncSendEnabled();
  void sendMessage(message);
});

els.composer.addEventListener("input", () => {
  autoGrowComposer();
  syncSendEnabled();
});

els.composer.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    els.form.requestSubmit();
  }
});

els.confirmBtn.addEventListener("click", () => {
  void confirmJob();
});

els.newChat.addEventListener("click", () => {
  startNewChat();
});

els.sidebarToggle.addEventListener("click", () => {
  setMobileSidebar(!els.shell.classList.contains("sidebar-open"));
});

els.sidebarBackdrop.addEventListener("click", () => {
  setMobileSidebar(false);
});

els.sidebarCollapse.addEventListener("click", () => {
  setCollapsed(!els.shell.classList.contains("sidebar-collapsed"));
});

setCollapsed(localStorage.getItem("lioran.sidebarCollapsed") === "1");
renderSessionList();
syncSendEnabled();
void refreshHealth();
setInterval(() => void refreshHealth(), 30_000);

if (state.sessionId) {
  void openSession(state.sessionId);
} else {
  els.composer.focus();
}
