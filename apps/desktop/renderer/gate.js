/**
 * Gate renderer logic.
 *
 * Talks to nothing directly — every call goes through `window.tikgames`, the narrow preload bridge.
 * All it does is drive which view is visible from the licence status the main process reports.
 */

const views = {
  checking: document.getElementById("view-checking"),
  form: document.getElementById("view-form"),
  pending: document.getElementById("view-pending"),
  blocked: document.getElementById("view-blocked"),
  offline: document.getElementById("view-offline"),
};

function show(name) {
  for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
}

/** APPROVED means: stop the gate and hand off to the dashboard. */
function applyStatus(status) {
  switch (status) {
    case "APPROVED":
      window.tikgames.enter();
      return;
    case "PENDING":
      show("pending");
      return;
    case "BLOCKED":
      showBlocked("blocked");
      return;
    case "OFFLINE":
      show("offline");
      return;
    case "UNKNOWN":
    default:
      // On the gate, an unrecognised machine simply hasn't registered yet — show the form. (A
      // device revoked *mid-session* is handled separately, via main's ?locked=unknown relaunch.)
      show("form");
  }
}

function showBlocked(kind) {
  const title = document.getElementById("blocked-title");
  const sub = document.getElementById("blocked-sub");
  if (kind === "unknown") {
    title.textContent = "الجهاز مش متعرّف";
    sub.textContent = "التسجيل اتلغى من السيرفر. فعّل الجهاز من جديد.";
  } else {
    title.textContent = "النسخة دي متوقفة";
    sub.textContent = "الأدمن أوقف الجهاز ده. تواصل معاه لإعادة التفعيل.";
  }
  show("blocked");
}

// --- form submit --------------------------------------------------------------------
const form = document.getElementById("form");
const submitBtn = document.getElementById("submit");
const btnLabel = submitBtn.querySelector(".btn-label");
const btnSpinner = submitBtn.querySelector(".btn-spinner");
const errorEl = document.getElementById("error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = document.getElementById("password").value;
  const label = document.getElementById("label").value;
  errorEl.hidden = true;
  submitBtn.disabled = true;
  btnLabel.textContent = "بنفعّل…";
  btnSpinner.hidden = false;

  const result = await window.tikgames.register(password, label);

  submitBtn.disabled = false;
  btnLabel.textContent = "تفعيل";
  btnSpinner.hidden = true;

  if (!result.ok) {
    errorEl.textContent = result.error || "فشل التفعيل";
    errorEl.hidden = false;
    return;
  }
  if (result.shortId) document.getElementById("device-short").textContent = result.shortId;
  applyStatus(result.status);
});

// --- retry buttons ------------------------------------------------------------------
document.getElementById("retry").addEventListener("click", () => location.reload());
document.getElementById("retry-offline").addEventListener("click", () => location.reload());

// --- live status pushes (the heartbeat) ---------------------------------------------
// While the user waits on the pending screen, an approve in Discord flips them straight in with
// no click; a block anywhere shows the stopped screen.
window.tikgames.onStatus((status) => {
  const current = Object.entries(views).find(([, el]) => !el.hidden)?.[0];
  // Don't yank someone out of the middle of typing their password over a transient OFFLINE tick.
  if (current === "form" && status !== "BLOCKED" && status !== "APPROVED") return;
  applyStatus(status);
});

// --- boot ---------------------------------------------------------------------------
async function boot() {
  // If main was relaunched into the gate because access was revoked, it passes ?locked=…
  const locked = new URLSearchParams(location.search).get("locked");
  if (locked === "blocked") return showBlocked("blocked");
  if (locked === "unknown") return showBlocked("unknown");

  window.tikgames.version().then((v) => {
    document.getElementById("version").textContent = "v" + v;
  });

  show("checking");
  const status = await window.tikgames.check();
  applyStatus(status);
}

boot();
