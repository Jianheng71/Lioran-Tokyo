const state = {
  sessionId: localStorage.getItem("lioran.sessionId") || null,
  phase: "idle",
  awaitingConfirm: false,
  activeJobId: null,
  pollTimer: null,
};

const els = {
  empty: document.getElementById("empty"),
  thread: document.getElementById("thread"),
  form: document.getElementById("form"),
  composer: document.getElementById("composer"),
  send: document.getElementById("send"),
  confirmBar: document.getElementById("confirm-bar"),
  confirmText: document.getElementById("confirm-text"),
  confirmBtn: document.getElementById("confirm-btn"),
  player: document.getElementById("player"),
  video: document.getElementById("video"),
  download: document.getElementById("download"),
  jobLabel: document.getElementById("job-label"),
  health: document.getElementById("health-chip"),
};

function showThread() {
  els.empty.hidden = true;
  els.thread.hidden = false;
}

function appendBubble(role, content, meta) {
  showThread();
  const div = document.createElement("div");
  div.className = `bubble ${role}`;
  div.textContent = content;
  if (meta) {
    const m = document.createElement("span");
    m.className = "meta";
    m.textContent = meta;
    div.appendChild(m);
  }
  els.thread.appendChild(div);
  div.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return div;
}

function appendSkeleton() {
  showThread();
  const div = document.createElement("div");
  div.className = "bubble assistant skeleton";
  div.setAttribute("aria-hidden", "true");
  els.thread.appendChild(div);
  return div;
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
  els.send.disabled = busy;
  els.confirmBtn.disabled = busy;
  els.composer.disabled = busy;
}

async function refreshHealth() {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    const hermesOk = data.checks?.hermes?.ok;
    if (data.ok && hermesOk) {
      els.health.textContent = "Ready";
      els.health.className = "top-meta ok";
    } else if (data.ok) {
      els.health.textContent = "Ready · Hermes offline";
      els.health.className = "top-meta warn";
    } else {
      els.health.textContent = "Degraded";
      els.health.className = "top-meta warn";
    }
  } catch {
    els.health.textContent = "Unreachable";
    els.health.className = "top-meta warn";
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
      appendBubble("assistant", data.error || "Request failed");
      return;
    }
    state.sessionId = data.sessionId;
    localStorage.setItem("lioran.sessionId", data.sessionId);
    state.phase = data.phase;
    appendBubble("assistant", data.reply, data.source === "rules" ? "local rules" : undefined);
    setConfirm(data.status === "ready_to_confirm", data.draft?.summary || data.reply);
    if (data.jobId) {
      setConfirm(false);
      watchJob(data.jobId);
    }
  } catch (err) {
    skeleton.remove();
    appendBubble("assistant", err instanceof Error ? err.message : String(err));
  } finally {
    setBusy(false);
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
      appendBubble("assistant", data.error || "Confirm failed");
      return;
    }
    appendBubble("user", "Confirm");
    appendBubble("assistant", data.reply);
    setConfirm(false);
    watchJob(data.jobId);
  } catch (err) {
    skeleton.remove();
    appendBubble("assistant", err instanceof Error ? err.message : String(err));
  } finally {
    setBusy(false);
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
  appendBubble("assistant", "Queued. I will share the video here when rendering finishes.", jobId);
  const statusBubble = appendBubble("assistant", "Status: queued", jobId);
  stopPoll();
  state.pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/v1/jobs/${encodeURIComponent(jobId)}`);
      const job = await res.json();
      if (!res.ok) {
        statusBubble.textContent = job.error || "Job missing";
        stopPoll();
        return;
      }
      statusBubble.textContent = "";
      statusBubble.append(document.createTextNode(`Status: ${job.status}`));
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = jobId;
      statusBubble.appendChild(meta);

      if (job.status === "done" && job.videoUrl) {
        stopPoll();
        showVideo(job.videoUrl, jobId);
        appendBubble("assistant", "Video ready. Play it above, download it, or ask to change one line.");
      } else if (job.status === "failed") {
        stopPoll();
        appendBubble("assistant", job.error || "Job failed");
      }
    } catch (err) {
      statusBubble.textContent = err instanceof Error ? err.message : String(err);
    }
  }, 1500);
}

function showVideo(url, jobId) {
  els.player.hidden = false;
  els.video.src = url;
  els.download.href = url;
  els.download.setAttribute("download", `${jobId}.mp4`);
  els.jobLabel.textContent = jobId;
  els.player.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = els.composer.value.trim();
  if (!message) return;
  els.composer.value = "";
  void sendMessage(message);
});

els.composer.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    els.form.requestSubmit();
  }
});

els.confirmBtn.addEventListener("click", () => {
  void confirmJob();
});

void refreshHealth();
setInterval(() => void refreshHealth(), 30_000);
