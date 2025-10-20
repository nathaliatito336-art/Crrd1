// ---------- CONFIG: GitHub JSON Storage (HYBRID) ----------
const GITHUB_USER = "nathaliatito336-art"; // e.g. "nathaliatito336-art"
const GITHUB_REPO = "Crrd1";       // e.g. "Crrd1"
const FILE_PATH   = "data.json";
const BRANCH      = "main";

// ====== IMPORTANT ======
// For development you can paste your PAT below (NOT recommended for public repos).
// Best: set your PAT in a prompt on first run or use a server/proxy.
// Leave blank to be prompted at first sync.
let GITHUB_TOKEN = "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";

// ---------- DOM Elements ----------
const qs = s => document.querySelector(s);
const loginSection = qs("#loginSection");
const registerSection = qs("#registerSection");
const profileSection = qs("#profileSection");

const loginUsername = qs("#loginUsername");
const loginPassword = qs("#loginPassword");
const loginBtn = qs("#loginBtn");

const regUsername = qs("#regUsername");
const regPassword = qs("#regPassword");
const regDept = qs("#regDept");
const gmCode = qs("#gmCode");
const gmCodeContainer = qs("#gmCodeContainer");
const registerBtn = qs("#registerBtn");

const toRegister = qs("#toRegister");
const toLogin = qs("#toLogin");

const displayUsername = qs("#displayUsername");
const displayDept = qs("#displayDept");
const profileImg = qs("#profileImg");
const uploadPic = qs("#uploadPic");
const logoutBtn = qs("#logoutBtn");

const activityDate = qs("#activityDate");
const activityInput = qs("#activityInput");
const activityImages = qs("#activityImages");
const addActivity = qs("#addActivity");
const clearForm = qs("#clearForm");
const progressFill = qs("#progressFill");

const reportsList = qs("#reportsList");
const filterDept = qs("#filterDept");
const fromDate = qs("#fromDate");
const toDate = qs("#toDate");
const searchText = qs("#searchText");
const filterReportsBtn = qs("#filterReports");
const clearFiltersBtn = qs("#clearFilters");

const gmEraseContainer = qs("#gmEraseContainer");
const eraseSelect = qs("#eraseSelect");
const eraseUserBtn = qs("#eraseUserBtn");
const eraseInfo = qs("#eraseInfo");
const eraseUsername = qs("#eraseUsername");
const eraseDept = qs("#eraseDept");
const erasePassword = qs("#erasePassword");

// ---------- UTILS ----------
let activeUser = null;
let dataCache = { users: [], reports: [] };
const LOCAL_KEY = "crrd_data_v1";   // localStorage key
const queuedChangesKey = "crrd_queue_v1"; // queue while offline

const uid = () => Date.now() + "_" + Math.random().toString(36).slice(2, 9);
const nowISO = () => new Date().toISOString();
const escapeHtml = s => String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// file -> base64
const toBase64 = file => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = err => rej(err);
  r.readAsDataURL(file);
});

// ---------- LOCAL STORAGE HELPERS ----------
function saveLocal(data) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}
function loadLocal() {
  const s = localStorage.getItem(LOCAL_KEY);
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function pushQueuedOp(op) {
  const q = JSON.parse(localStorage.getItem(queuedChangesKey) || "[]");
  q.push(op);
  localStorage.setItem(queuedChangesKey, JSON.stringify(q));
}
function popQueuedOps() {
  const q = JSON.parse(localStorage.getItem(queuedChangesKey) || "[]");
  localStorage.removeItem(queuedChangesKey);
  return q;
}

// ---------- GITHUB API HELPERS ----------
async function githubGetFile() {
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  return res.json(); // returns {content, sha, ...}
}

async function githubPutFile(contentJson, message = "Update data.json") {
  // Ensure token present
  if (!GITHUB_TOKEN) {
    // prompt user for token (sa dev only)
    const t = prompt("Enter GitHub Personal Access Token (repo scope) — it will not be saved:", "");
    if (!t) throw new Error("No GitHub token provided.");
    GITHUB_TOKEN = t.trim();
  }

  // fetch current sha
  let current;
  try { current = await githubGetFile(); } catch (err) { current = null; }

  const payload = {
    message,
    content: btoa(JSON.stringify(contentJson, null, 2)),
    branch: BRANCH
  };
  if (current && current.sha) payload.sha = current.sha;

  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "Accept": "application/vnd.github.v3+json"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} ${txt}`);
  }
  return res.json();
}

// ---------- MERGE STRATEGY ----------
/*
  Merge local vs remote:
  - remote fetched from GitHub (remoteData)
  - local from localStorage (localData)
  - merge users & reports by id/username:
    - for users: username is key; use latest updatedAt or createdAt
    - for reports: id is key; use createdAt/updatedAt, last-write-wins
  - result becomes canonical dataCache and saved locally and (optionally) pushed to GitHub
*/
function mergeData(localData, remoteData) {
  if (!localData) return remoteData || { users: [], reports: [] };
  if (!remoteData) return localData;

  const usersMap = new Map();
  (remoteData.users || []).forEach(u => usersMap.set(u.username, u));
  (localData.users || []).forEach(u => {
    const r = usersMap.get(u.username);
    if (!r) usersMap.set(u.username, u);
    else {
      // compare timestamps (use updatedAt if present) — fallback to createdAt
      const ru = r.updatedAt || r.createdAt || "";
      const lu = u.updatedAt || u.createdAt || "";
      if (lu >= ru) usersMap.set(u.username, u);
    }
  });

  const reportsMap = new Map();
  (remoteData.reports || []).forEach(r => reportsMap.set(r.id, r));
  (localData.reports || []).forEach(r => {
    const rr = reportsMap.get(r.id);
    if (!rr) reportsMap.set(r.id, r);
    else {
      const rrTime = rr.updatedAt || rr.createdAt || "";
      const lrTime = r.updatedAt || r.createdAt || "";
      if (lrTime >= rrTime) reportsMap.set(r.id, r);
    }
  });

  return {
    users: Array.from(usersMap.values()),
    reports: Array.from(reportsMap.values())
  };
}

// ---------- SYNC LOGIC ----------
async function syncFromGitHubAndMerge() {
  try {
    const gh = await githubGetFile();
    const decoded = atob(gh.content || "");
    const remote = decoded ? JSON.parse(decoded) : { users: [], reports: [] };
    const local = loadLocal() || { users: [], reports: [] };
    const merged = mergeData(local, remote);
    dataCache = merged;
    saveLocalAndUI();
    // If merged differs from remote, push back (resolve)
    const mergedJson = JSON.stringify(merged);
    const remoteJson = JSON.stringify(remote);
    if (mergedJson !== remoteJson) {
      // queue or push
      try {
        await githubPutFile(merged, "Sync merged local changes");
      } catch (err) {
        // push failed -> queue ops
        console.warn("Push after merge failed, changes queued", err);
        pushQueuedOp({ type: "push_merged", payload: merged });
      }
    }
    // apply queued ops (if any)
    await flushQueuedOps();
    return dataCache;
  } catch (err) {
    console.warn("Could not fetch from GitHub:", err);
    // still load local if present
    dataCache = loadLocal() || { users: [], reports: [] };
    return dataCache;
  }
}

async function flushQueuedOps() {
  const ops = popQueuedOps();
  if (!ops || ops.length === 0) return;
  await loadLocal(); // ensure dataCache current
  for (const op of ops) {
    try {
      if (op.type === "push_merged") {
        await githubPutFile(op.payload, "Flush queued merged changes");
      } else if (op.type === "push_update") {
        await githubPutFile(dataCache, op.message || "Flush queued update");
      }
    } catch (err) {
      console.warn("Failed queued op", op, err);
      // On failure, re-queue remaining and stop
      pushQueuedOp(op);
      break;
    }
  }
}

// push current dataCache to GitHub; if offline or fail -> queue
async function pushToGitHub(message = "Update data.json from client") {
  try {
    await githubPutFile(dataCache, message);
    return true;
  } catch (err) {
    console.warn("GitHub push failed; queuing op", err);
    pushQueuedOp({ type: "push_update", payload: null, message });
    return false;
  }
}

// ---------- UI / App Logic (same flows as previous) ----------
// Navigation wiring
toRegister.addEventListener("click", e => { e.preventDefault(); loginSection.classList.add("hidden"); registerSection.classList.remove("hidden"); });
toLogin.addEventListener("click", e => { e.preventDefault(); registerSection.classList.add("hidden"); loginSection.classList.remove("hidden"); });
regDept.addEventListener("change", e => gmCodeContainer.classList.toggle("hidden", e.target.value !== "GM"));

// Register
registerBtn.addEventListener("click", async () => {
  const u = regUsername.value.trim();
  const p = regPassword.value.trim();
  const d = regDept.value;
  const gm = (gmCode.value || "").trim();
  if (!u || !p || !d) return alert("Fill all fields.");
  if (d === "GM" && gm !== "CRRD") return alert("Invalid GM code.");

  // load current cache
  dataCache = loadLocal() || { users: [], reports: [] };
  if (dataCache.users.find(x => x.username === u)) return alert("Username exists.");

  const userObj = { username: u, password: p, dept: d, profilePic: "default-profile.png", createdAt: nowISO() };
  dataCache.users.push(userObj);
  saveLocalAndUI();

  // try to push
  const ok = await pushToGitHub(`Register user ${u}`);
  if (!ok) alert("Registered locally. Will sync to GitHub when online.");
  else alert("Registered and synced.");
  regUsername.value = regPassword.value = ""; regDept.value = ""; gmCode.value = "";
  registerSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
});

// Login
loginBtn.addEventListener("click", async () => {
  const u = loginUsername.value.trim();
  const p = loginPassword.value.trim();
  dataCache = loadLocal() || { users: [], reports: [] }; // immediate
  let user = dataCache.users.find(x => x.username === u && x.password === p);
  if (!user) {
    // try to sync from remote then re-check
    await syncFromGitHubAndMerge();
    user = dataCache.users.find(x => x.username === u && x.password === p);
  }
  if (!user) return alert("Invalid login.");
  activeUser = user;
  loginUsername.value = loginPassword.value = "";
  initUIForActiveUser();
});

// Init UI after login
function initUIForActiveUser() {
  loginSection.classList.add("hidden");
  registerSection.classList.add("hidden");
  profileSection.classList.remove("hidden");

  displayUsername.textContent = activeUser.username;
  displayDept.textContent = activeUser.dept;
  profileImg.src = activeUser.profilePic || "default-profile.png";

  setupEraseUsers();
  renderReports(applyFilters());
}

// Logout
logoutBtn.addEventListener("click", () => {
  activeUser = null;
  profileSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
});

// Profile image
profileImg.addEventListener("click", () => uploadPic.click());
uploadPic.addEventListener("change", async () => {
  if (!activeUser) return;
  const file = uploadPic.files[0];
  if (!file) return;
  const b64 = await toBase64(file);
  activeUser.profilePic = b64;
  profileImg.src = b64;

  // update local data cache
  dataCache = loadLocal() || { users: [], reports: [] };
  const idx = dataCache.users.findIndex(u => u.username === activeUser.username);
  if (idx !== -1) {
    dataCache.users[idx].profilePic = b64;
    dataCache.users[idx].updatedAt = nowISO();
  }
  saveLocalAndUI();
  const ok = await pushToGitHub(`Update profilePic ${activeUser.username}`);
  if (!ok) alert("Profile updated locally; will sync when online.");
});

// Add report
addActivity.addEventListener("click", async () => {
  if (!activeUser) return alert("Please login first.");
  const date = activityDate.value;
  const text = activityInput.value.trim();
  const files = Array.from(activityImages.files || []);
  if (!date) return alert("Select a date.");
  if (!text && files.length === 0) return alert("Enter details or attach images.");

  const reportId = uid();
  const images = [];
  progressFill.style.width = "0%";
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const b64 = await toBase64(f);
    images.push({ id: uid(), fileName: f.name, content: b64 });
    progressFill.style.width = `${Math.round(((i+1)/files.length)*100)}%`;
    await new Promise(r => setTimeout(r, 10));
  }
  setTimeout(() => progressFill.style.width = "0%", 300);

  const report = {
    id: reportId,
    username: activeUser.username,
    dept: activeUser.dept,
    text,
    date,
    images,
    createdAt: nowISO()
  };

  dataCache = loadLocal() || { users: [], reports: [] };
  dataCache.reports.push(report);
  saveLocalAndUI();

  const ok = await pushToGitHub(`Add report ${reportId}`);
  if (!ok) alert("Report saved locally. Will sync to GitHub when online.");
  else alert("Report saved and synced.");

  activityDate.value = ""; activityInput.value = ""; activityImages.value = "";
  renderReports(applyFilters());
});

// Filters
filterReportsBtn.addEventListener("click", () => { renderReports(applyFilters()); });
clearFiltersBtn.addEventListener("click", () => {
  filterDept.value = ""; fromDate.value = ""; toDate.value = ""; searchText.value = "";
  renderReports(applyFilters());
});

function applyFilters() {
  const local = loadLocal() || { users: [], reports: [] };
  let filtered = local.reports || [];
  const dept = filterDept.value;
  const fFrom = fromDate.value;
  const fTo = toDate.value;
  const search = (searchText.value || "").toLowerCase();

  filtered = filtered.filter(r => {
    if (dept && r.dept !== dept) return false;
    if (fFrom && r.date < fFrom) return false;
    if (fTo && r.date > fTo) return false;
    if (search && !(`${r.text} ${r.username} ${r.dept}`.toLowerCase().includes(search))) return false;
    return true;
  });

  if (!activeUser) return filtered;
  if (activeUser.dept !== "GM") filtered = filtered.filter(r => r.username === activeUser.username);
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return filtered;
}

function renderReports(reports) {
  reportsList.innerHTML = "";
  for (const r of reports) {
    const card = document.createElement("div");
    card.className = "report";

    const h = document.createElement("h4");
    h.innerHTML = `${escapeHtml(r.username)} (${escapeHtml(r.dept)}) | ${escapeHtml(r.date)}`;
    card.appendChild(h);

    const p = document.createElement("p");
    try { p.innerHTML = marked.parse(r.text || ""); }
    catch { p.textContent = r.text || ""; }
    card.appendChild(p);

    if (r.images && r.images.length > 0) {
      const viewBtn = document.createElement("button");
      viewBtn.textContent = `📎 View Attachments (${r.images.length})`;
      viewBtn.className = "view-attachments";
      viewBtn.addEventListener("click", () => {
        const existing = card.querySelector(".image-grid");
        if (existing) { existing.remove(); return; }
        const grid = document.createElement("div"); grid.className = "image-grid";
        for (const imgRec of r.images) {
          const imgEl = document.createElement("img");
          imgEl.src = imgRec.content;
          imgEl.alt = imgRec.fileName || "attachment";
          imgEl.addEventListener("click", () => {
            const w = window.open("");
            w.document.write(`<html><head><title>Attachment</title></head><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center"><img src="${imgRec.content}" style="max-width:100%;max-height:100vh"></body></html>`);
          });
          grid.appendChild(imgEl);
        }
        card.appendChild(grid);
      });
      card.appendChild(viewBtn);
    }

    if (activeUser && (activeUser.username === r.username || activeUser.dept === "GM")) {
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Delete report by ${r.username} dated ${r.date}?`)) return;
        dataCache = loadLocal() || { users: [], reports: [] };
        dataCache.reports = dataCache.reports.filter(rep => rep.id !== r.id);
        saveLocalAndUI();
        const ok = await pushToGitHub(`Delete report ${r.id}`);
        if (!ok) alert("Deleted locally; will sync when online.");
        renderReports(applyFilters());
      });
      card.appendChild(delBtn);
    }

    reportsList.appendChild(card);
  }
}

// GM erase user
function setupEraseUsers() {
  if (!activeUser || activeUser.dept !== "GM") { gmEraseContainer.classList.add("hidden"); return; }
  gmEraseContainer.classList.remove("hidden");
  const local = loadLocal() || { users: [], reports: [] };
  eraseSelect.innerHTML = `<option value="">Select User</option>`;
  for (const u of local.users) {
    if (u.username !== activeUser.username) {
      const opt = document.createElement("option");
      opt.value = u.username;
      opt.textContent = `${u.username} (${u.dept})`;
      eraseSelect.appendChild(opt);
    }
  }
}
eraseSelect.addEventListener("change", () => {
  const local = loadLocal() || { users: [], reports: [] };
  const sel = local.users.find(u => u.username === eraseSelect.value);
  if (sel) {
    eraseInfo.classList.remove("hidden");
    eraseUsername.value = sel.username;
    eraseDept.value = sel.dept;
    erasePassword.value = sel.password;
  } else {
    eraseInfo.classList.add("hidden");
    eraseUsername.value = eraseDept.value = erasePassword.value = "";
  }
});
eraseUserBtn.addEventListener("click", async () => {
  const username = eraseUsername.value;
  if (!username) return alert("Select a user.");
  if (!confirm(`Erase user ${username} and all reports? This cannot be undone.`)) return;
  dataCache = loadLocal() || { users: [], reports: [] };
  dataCache.users = dataCache.users.filter(u => u.username !== username);
  dataCache.reports = dataCache.reports.filter(r => r.username !== username);
  saveLocalAndUI();
  const ok = await pushToGitHub(`GM erased user ${username}`);
  if (!ok) alert("Erased locally; will sync when online.");
  setupEraseUsers();
  renderReports(applyFilters());
  alert("User erased.");
});

// Save local and update UI (single source)
function saveLocalAndUI() {
  if (!dataCache) dataCache = { users: [], reports: [] };
  saveLocal(dataCache);
  // auto-update UI lists if needed
  if (activeUser) setupEraseUsers();
  renderReports(applyFilters());
}

// ---------- BOOTSTRAP: load local first then try remote merge ----------
window.addEventListener("DOMContentLoaded", async () => {
  // Load local to show instantly
  const local = loadLocal();
  if (local) {
    dataCache = local;
  } else {
    dataCache = { users: [], reports: [] };
  }

  // show login or restore activeUser from sessionStorage (optional)
  loginSection.classList.remove("hidden");

  // Try to fetch remote and merge; this will also try to flush queued ops
  try {
    await syncFromGitHubAndMerge();
  } catch (err) {
    console.warn("Initial sync failed:", err);
  }

  // Optionally, restore activeUser from session (not required)
});
