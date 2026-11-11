/**
 * Lioran—Tokyo P5 chat window.
 * Visual/interaction standard: Grok-like chat layout (not a Grok/xAI reskin).
 * Code substrate still draws from jakobhoeg/nextjs-ollama-llm-ui patterns (MIT).
 * Wires Hono APIs only — no Ollama /api/tags, no LangChain useChat.
 * UI chrome is Chinese/English bilingual (default Chinese first).
 */

const HISTORY_KEY = "lioran.sessions";
const ACTIVE_KEY = "lioran.sessionId";
const LANG_KEY = "lioran.uiLang";

const STRINGS = {
  zh: {
    skip: "跳到输入框",
    sessionsAria: "会话",
    newChat: "新对话",
    searchChats: "搜索对话",
    yourChats: "你的对话",
    historyAria: "对话历史",
    license: "许可",
    healthTitle: "服务状态",
    conversationAria: "对话",
    openSidebar: "打开侧栏",
    collapseSidebar: "收起侧栏",
    expandSidebar: "展开侧栏",
    emptySub: "说明你要的促销片，有商品页链接也可以一并贴上。先问清楚，确认后才开始做视频。",
    confirmStart: "确认并开始",
    confirmFallback: "我已理解你的请求。确认后开始做视频，也可以先再补一句说明。",
    messageLabel: "消息",
    composerPlaceholder: "用这个链接做一条促销片，价格保留日元。",
    composerHint: "Enter 发送 · Shift+Enter 换行",
    send: "发送",
    tools: "工具",
    modeLocal: "本地",
    footNote: "仅用于你有权使用的页面。",
    noChats: "还没有对话",
    deleteChat: "删除对话",
    newChatPreview: "新对话",
    healthReady: "就绪",
    healthHermesOffline: "就绪 · Hermes 离线",
    healthDegraded: "降级",
    healthUnreachable: "不可达",
    sessionMissing: "找不到会话",
    requestFailed: "请求失败",
    confirmFailed: "确认失败",
    confirmUser: "确认",
    queued: "已入队。成片会出现在这条对话里。",
    status: "状态",
    jobMissing: "任务不存在",
    videoReady: "视频已就绪。可在上方播放或下载，也可以再说一句要改什么。",
    jobFailed: "任务失败",
    downloadMp4: "下载 MP4",
    localRules: "本地规则",
    langToggle: "中 / EN",
    langAria: "切换为英文界面",
    copy: "复制",
    copied: "已复制",
    retry: "再试一次",
    assistantLabel: "Lioran—Tokyo",
  },
  en: {
    skip: "Skip to composer",
    sessionsAria: "Sessions",
    newChat: "New chat",
    searchChats: "Search chats",
    yourChats: "Your chats",
    historyAria: "Chat history",
    license: "License",
    healthTitle: "Service health",
    conversationAria: "Conversation",
    openSidebar: "Open sidebar",
    collapseSidebar: "Collapse sidebar",
    expandSidebar: "Expand sidebar",
    emptySub:
      "Describe the promo you need, including a product page if you have one. Questions come first; the video starts only after you confirm.",
    confirmStart: "Confirm and start",
    confirmFallback:
      "I think I understand the request. Confirm to start the video, or send another note first.",
    messageLabel: "Message",
    composerPlaceholder: "Make a promo from this link, and keep the price in yen.",
    composerHint: "Enter to send · Shift+Enter for a new line",
    send: "Send",
    tools: "Tools",
    modeLocal: "Local",
    footNote: "For pages you have the right to use.",
    noChats: "No chats yet",
    deleteChat: "Delete chat",
    newChatPreview: "New chat",
    healthReady: "Ready",
    healthHermesOffline: "Ready · Hermes offline",
    healthDegraded: "Degraded",
    healthUnreachable: "Unreachable",
    sessionMissing: "Session not found",
    requestFailed: "Request failed",
    confirmFailed: "Confirm failed",
    confirmUser: "Confirm",
    queued: "Queued. The finished video will appear in this chat.",
    status: "Status",
    jobMissing: "Job missing",
    videoReady: "Video ready. Play or download it above, or ask to change one line.",
    jobFailed: "Job failed",
    downloadMp4: "Download MP4",
    localRules: "local rules",
    langToggle: "EN / 中",
    langAria: "Switch to Chinese UI",
    copy: "Copy",
    copied: "Copied",
    retry: "Try again",
    assistantLabel: "Lioran—Tokyo",
  },
};

const state = {
  sessionId: localStorage.getItem(ACTIVE_KEY) || null,
  phase: "idle",
  awaitingConfirm: false,
  activeJobId: null,
  pollTimer: null,
  history: loadHistory(),
  lang: loadLang(),
  lastConfirmSummary: null,
  historyQuery: "",
  lastUserMessage: null,
  plusOpen: false,
};

const els = {
  shell: document.getElementById("shell"),
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebar-toggle"),
  sidebarCollapse: document.getElementById("sidebar-collapse"),
  sidebarBackdrop: document.getElementById("sidebar-backdrop"),
  newChat: document.getElementById("new-chat"),
  sessionList: document.getElementById("session-list"),
  historySearch: document.getElementById("history-search"),
  empty: document.getElementById("empty"),
  thread: document.getElementById("thread"),
  scroller: document.getElementById("scroller"),
  form: document.getElementById("form"),
  composer: document.getElementById("composer"),
  send: document.getElementById("send"),
  composerPlus: document.getElementById("composer-plus"),
  plusMenu: document.getElementById("plus-menu"),
  plusNew: document.getElementById("plus-new"),
  plusLang: document.getElementById("plus-lang"),
  confirmBar: document.getElementById("confirm-bar"),
  confirmText: document.getElementById("confirm-text"),
  confirmBtn: document.getElementById("confirm-btn"),
  health: document.getElementById("health-chip"),
  langToggle: document.getElementById("lang-toggle"),
};

function loadLang() {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === "en" || saved === "zh") return saved;
  return "zh";
}

function t(key) {
  return STRINGS[state.lang][key] || STRINGS.zh[key] || key;
}

function applyI18n() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key) el.setAttribute("placeholder", t(key));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (key) el.setAttribute("title", t(key));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (key) el.setAttribute("aria-label", t(key));
  });
  if (els.langToggle) {
    els.langToggle.textContent = t("langToggle");
    els.langToggle.setAttribute("aria-label", t("langAria"));
  }
  if (els.plusLang) {
    els.plusLang.textContent = t("langToggle");
  }
  if (els.composerPlus) {
    els.composerPlus.setAttribute("title", t("tools"));
  }
  const collapsed = els.shell.classList.contains("sidebar-collapsed");
  els.sidebarCollapse.setAttribute(
    "aria-label",
    collapsed ? t("expandSidebar") : t("collapseSidebar"),
  );
  if (state.awaitingConfirm) {
    els.confirmText.textContent = state.lastConfirmSummary || t("confirmFallback");
  }
  renderSessionList();
  void refreshHealth();
}

function setLang(lang) {
  state.lang = lang === "en" ? "en" : "zh";
  localStorage.setItem(LANG_KEY, state.lang);
  applyI18n();
}

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
    preview: (preview || t("newChatPreview")).slice(0, 80),
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
  const query = state.historyQuery.trim().toLowerCase();
  const items = state.history.filter((item) => {
    if (!query) return true;
    return (item.preview || item.id || "").toLowerCase().includes(query);
  });
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "sidebar-label";
    empty.style.marginTop = "0";
    empty.textContent = t("noChats");
    els.sessionList.appendChild(empty);
    return;
  }
  for (const item of items) {
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
    del.setAttribute("aria-label", t("deleteChat"));
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
    collapsed ? t("expandSidebar") : t("collapseSidebar"),
  );
  localStorage.setItem("lioran.sidebarCollapsed", collapsed ? "1" : "0");
}

function setPlusMenu(open) {
  state.plusOpen = open;
  els.plusMenu.hidden = !open;
  els.composerPlus.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    const rect = els.composerPlus.getBoundingClientRect();
    const menuWidth = Math.min(280, window.innerWidth - 32);
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 16) {
      left = window.innerWidth - 16 - menuWidth;
    }
    els.plusMenu.style.left = `${Math.max(16, left)}px`;
    els.plusMenu.style.bottom = `${Math.max(16, window.innerHeight - rect.top + 8)}px`;
    els.plusMenu.style.transform = "none";
    els.plusMenu.style.width = `${menuWidth}px`;
  }
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

function makeAssistantHead() {
  const head = document.createElement("div");
  head.className = "assistant-head";
  const img = document.createElement("img");
  img.src = "/brand/mark.svg";
  img.alt = "";
  img.width = 18;
  img.height = 18;
  const label = document.createElement("span");
  label.textContent = t("assistantLabel");
  head.append(img, label);
  return head;
}

function makeActionRow(content, opts = {}) {
  const row = document.createElement("div");
  row.className = "action-row";

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "action-btn";
  copyBtn.textContent = t("copy");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(content);
      copyBtn.textContent = t("copied");
      setTimeout(() => {
        copyBtn.textContent = t("copy");
      }, 1200);
    } catch {
      copyBtn.textContent = t("copy");
    }
  });
  row.appendChild(copyBtn);

  if (opts.retryable && state.lastUserMessage) {
    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "action-btn";
    retryBtn.textContent = t("retry");
    retryBtn.addEventListener("click", () => {
      const message = state.lastUserMessage;
      if (!message) return;
      void sendMessage(message);
    });
    row.appendChild(retryBtn);
  }

  return row;
}

function appendBubble(role, content, opts = {}) {
  showThread();
  const row = document.createElement("div");
  row.className = `bubble-row ${role}`;

  if (role === "assistant") {
    row.appendChild(makeAssistantHead());
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

  if (role === "assistant" && !opts.progress && !opts.skeleton) {
    row.appendChild(makeActionRow(content, { retryable: Boolean(opts.error) }));
  }

  els.thread.appendChild(row);
  scrollToBottom();
  return { row, bubble };
}

function appendSkeleton() {
  showThread();
  const row = document.createElement("div");
  row.className = "bubble-row assistant";
  row.appendChild(makeAssistantHead());
  const bubble = document.createElement("div");
  bubble.className = "bubble skeleton";
  bubble.setAttribute("aria-hidden", "true");
  row.appendChild(bubble);
  els.thread.appendChild(row);
  scrollToBottom();
  return row;
}

function appendVideoCard(url, jobId) {
  showThread();
  const row = document.createElement("div");
  row.className = "bubble-row assistant";
  row.appendChild(makeAssistantHead());

  const card = document.createElement("div");
  card.className = "video-card";

  const video = document.createElement("video");
  video.controls = true;
  video.playsInline = true;
  video.src = url;
  video.setAttribute("aria-label", `Lioran—Tokyo ${jobId}`);

  const actions = document.createElement("div");
  actions.className = "video-actions";

  const download = document.createElement("a");
  download.className = "btn btn-secondary";
  download.href = url;
  download.download = `${jobId}.mp4`;
  download.textContent = t("downloadMp4");

  const meta = document.createElement("span");
  meta.className = "meta";
  meta.style.marginTop = "0";
  meta.textContent = jobId;

  actions.append(download, meta);
  card.append(video, actions);
  row.appendChild(card);
  els.thread.appendChild(row);
  scrollToBottom();
}

function setConfirm(visible, summary) {
  state.awaitingConfirm = visible;
  state.lastConfirmSummary = summary || null;
  els.confirmBar.hidden = !visible;
  if (visible) {
    els.confirmText.textContent = summary || t("confirmFallback");
  }
}

function setBusy(busy) {
  els.send.disabled = busy || !els.composer.value.trim();
  els.confirmBtn.disabled = busy;
  els.composer.disabled = busy;
  els.composerPlus.disabled = busy;
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
  state.lastUserMessage = null;
  localStorage.removeItem(ACTIVE_KEY);
  els.thread.replaceChildren();
  els.thread.hidden = true;
  els.empty.hidden = false;
  setConfirm(false);
  setMobileSidebar(false);
  setPlusMenu(false);
  renderSessionList();
  els.composer.focus();
}

async function openSession(sessionId) {
  stopPoll();
  setMobileSidebar(false);
  setPlusMenu(false);
  try {
    const res = await fetch(`/v1/sessions/${encodeURIComponent(sessionId)}`);
    const data = await res.json();
    if (!res.ok) {
      removeHistory(sessionId);
      appendBubble("assistant", data.error || t("sessionMissing"), { error: true });
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
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      state.lastUserMessage = lastUser?.content || null;
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
      els.health.textContent = t("healthReady");
      els.health.className = "sidebar-health ok";
    } else if (data.ok) {
      els.health.textContent = t("healthHermesOffline");
      els.health.className = "sidebar-health warn";
    } else {
      els.health.textContent = t("healthDegraded");
      els.health.className = "sidebar-health warn";
    }
  } catch {
    els.health.textContent = t("healthUnreachable");
    els.health.className = "sidebar-health warn";
  }
}

async function sendMessage(message) {
  setBusy(true);
  state.lastUserMessage = message;
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
      appendBubble("assistant", data.error || t("requestFailed"), { error: true });
      return;
    }
    state.sessionId = data.sessionId;
    localStorage.setItem(ACTIVE_KEY, data.sessionId);
    state.phase = data.phase;
    upsertHistory(data.sessionId, message);

    const clarify = data.status === "need_clarification";
    appendBubble("assistant", data.reply, {
      clarify,
      meta: data.source === "rules" ? t("localRules") : undefined,
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
      appendBubble("assistant", data.error || t("confirmFailed"), { error: true });
      return;
    }
    appendBubble("user", t("confirmUser"));
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
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

function watchJob(jobId) {
  state.activeJobId = jobId;
  appendBubble("assistant", t("queued"), {
    progress: true,
    meta: jobId,
  });
  const status = appendBubble("assistant", `${t("status")}: queued`, {
    progress: true,
    meta: jobId,
  });
  stopPoll();
  state.pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/v1/jobs/${encodeURIComponent(jobId)}`);
      const job = await res.json();
      if (!res.ok) {
        status.bubble.textContent = job.error || t("jobMissing");
        status.bubble.classList.add("error");
        stopPoll();
        return;
      }
      status.bubble.textContent = `${t("status")}: ${job.status}`;
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
        appendBubble("assistant", t("videoReady"));
      } else if (job.status === "failed") {
        stopPoll();
        appendBubble("assistant", job.error || t("jobFailed"), { error: true });
      }
    } catch (err) {
      status.bubble.textContent = err instanceof Error ? err.message : String(err);
      status.bubble.classList.add("error");
    }
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
  setPlusMenu(false);
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

els.langToggle.addEventListener("click", () => {
  setLang(state.lang === "zh" ? "en" : "zh");
});

els.historySearch.addEventListener("input", () => {
  state.historyQuery = els.historySearch.value || "";
  renderSessionList();
});

els.composerPlus.addEventListener("click", (event) => {
  event.stopPropagation();
  setPlusMenu(!state.plusOpen);
});

els.plusNew.addEventListener("click", () => {
  setPlusMenu(false);
  startNewChat();
});

els.plusLang.addEventListener("click", () => {
  setPlusMenu(false);
  setLang(state.lang === "zh" ? "en" : "zh");
});

document.addEventListener("click", (event) => {
  if (!state.plusOpen) return;
  const target = event.target;
  if (
    target instanceof Node &&
    (els.plusMenu.contains(target) || els.composerPlus.contains(target))
  ) {
    return;
  }
  setPlusMenu(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setPlusMenu(false);
    setMobileSidebar(false);
  }
});

setCollapsed(localStorage.getItem("lioran.sidebarCollapsed") === "1");
applyI18n();
syncSendEnabled();
setInterval(() => void refreshHealth(), 30_000);

if (state.sessionId) {
  void openSession(state.sessionId);
} else {
  els.composer.focus();
}
