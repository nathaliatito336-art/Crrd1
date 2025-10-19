// ---------- CONFIG: GitHub JSON Storage ----------
const GITHUB_USER = "nathaliatito336-art"; // Imong GitHub username
const GITHUB_REPO = "Crrd1";       // Repository name
const FILE_PATH = "data.json";              // JSON file path sa repo
const GITHUB_TOKEN = "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"; // Must have repo access

// ---------- DOM Elements ----------
const loginSection = document.querySelector("#loginSection");
const registerSection = document.querySelector("#registerSection");
const profileSection = document.querySelector("#profileSection");

const loginUsername = document.querySelector("#loginUsername");
const loginPassword = document.querySelector("#loginPassword");
const loginBtn = document.querySelector("#loginBtn");

const regUsername = document.querySelector("#regUsername");
const regPassword = document.querySelector("#regPassword");
const regDept = document.querySelector("#regDept");
const gmCode = document.querySelector("#gmCode");
const gmCodeContainer = document.querySelector("#gmCodeContainer");
const registerBtn = document.querySelector("#registerBtn");

const toRegister = document.querySelector("#toRegister");
const toLogin = document.querySelector("#toLogin");

const displayUsername = document.querySelector("#displayUsername");
const displayDept = document.querySelector("#displayDept");
const profileImg = document.querySelector("#profileImg");
const uploadPic = document.querySelector("#uploadPic");
const logoutBtn = document.querySelector("#logoutBtn");

const activityDate = document.querySelector("#activityDate");
const activityInput = document.querySelector("#activityInput");
const activityImages = document.querySelector("#activityImages");
const addActivity = document.querySelector("#addActivity");
const clearForm = document.querySelector("#clearForm");
const progressFill = document.querySelector("#progressFill");

const reportsList = document.querySelector("#reportsList");
const filterDept = document.querySelector("#filterDept");
const fromDate = document.querySelector("#fromDate");
const toDate = document.querySelector("#toDate");
const searchText = document.querySelector("#searchText");
const filterReportsBtn = document.querySelector("#filterReports");
const clearFiltersBtn = document.querySelector("#clearFilters");

const gmEraseContainer = document.querySelector("#gmEraseContainer");
const eraseSelect = document.querySelector("#eraseSelect");
const eraseUserBtn = document.querySelector("#eraseUserBtn");
const eraseInfo = document.querySelector("#eraseInfo");
const eraseUsername = document.querySelector("#eraseUsername");
const eraseDept = document.querySelector("#eraseDept");
const erasePassword = document.querySelector("#erasePassword");

// ---------- UTILS ----------
let activeUser = null;
let dataCache = { users: [], reports: [] };

const uid = () => Date.now() + "_" + Math.random().toString(36).slice(2, 9);
const escapeHtml = s => String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

// Convert File to Base64
const toBase64 = file => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.onload = () => res(reader.result);
  reader.onerror = err => rej(err);
  reader.readAsDataURL(file);
});

// ---------- GitHub API Helpers ----------
async function fetchData() {
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (!data.content) throw new Error("data.json not found or empty");
  const decoded = atob(data.content);
  return { content: JSON.parse(decoded), sha: data.sha };
}

async function saveData(updated) {
  const { sha } = await fetchData();
  const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Update data.json",
      content: btoa(JSON.stringify(updated, null, 2)),
      sha
    })
  });
  return await resp.json();
}

async function loadData() {
  try {
    const { content } = await fetchData();
    dataCache = content;
  } catch {
    dataCache = { users: [], reports: [] };
  }
  return dataCache;
}

// ---------- NAVIGATION ----------
toRegister.addEventListener("click", e => {
  e.preventDefault();
  loginSection.classList.add("hidden");
  registerSection.classList.remove("hidden");
});
toLogin.addEventListener("click", e => {
  e.preventDefault();
  registerSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
});
regDept.addEventListener("change", e => {
  gmCodeContainer.classList.toggle("hidden", e.target.value !== "GM");
});

// ---------- REGISTER ----------
registerBtn.addEventListener("click", async () => {
  const u = regUsername.value.trim();
  const p = regPassword.value.trim();
  const d = regDept.value;
  const gm = (gmCode.value || "").trim();
  if (!u || !p || !d) return alert("Fill all fields.");
  if (d === "GM" && gm !== "CRRD") return alert("Invalid GM code.");

  await loadData();
  if (dataCache.users.find(x => x.username === u)) return alert("Username exists.");

  dataCache.users.push({ username: u, password: p, dept: d, profilePic: "default-profile.png" });
  await saveData(dataCache);

  alert("Registered. Please login.");
  regUsername.value = regPassword.value = ""; regDept.value = ""; gmCode.value = "";
  registerSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
});

// ---------- LOGIN ----------
loginBtn.addEventListener("click", async () => {
  const u = loginUsername.value.trim();
  const p = loginPassword.value.trim();
  await loadData();
  const user = dataCache.users.find(x => x.username === u && x.password === p);
  if (!user) return alert("Invalid login.");

  activeUser = user;
  loginUsername.value = loginPassword.value = "";
  initUIForActiveUser();
});

// ---------- INIT UI ----------
function initUIForActiveUser() {
  loginSection.classList.add("hidden");
  registerSection.classList.add("hidden");
  profileSection.classList.remove("hidden");

  displayUsername.textContent = activeUser.username;
  displayDept.textContent = activeUser.dept;
  profileImg.src = activeUser.profilePic || "default-profile.png";

  setupEraseUsers();
  applyFiltersAndLoadReports();
}

// ---------- LOGOUT ----------
logoutBtn.addEventListener("click", () => {
  activeUser = null;
  profileSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
});

// ---------- PROFILE IMAGE UPLOAD ----------
profileImg.addEventListener("click", () => uploadPic.click());
uploadPic.addEventListener("change", async () => {
  const file = uploadPic.files[0];
  if (!file) return;
  const b64 = await toBase64(file);
  activeUser.profilePic = b64;
  profileImg.src = b64;

  const idx = dataCache.users.findIndex(u => u.username === activeUser.username);
  if (idx !== -1) dataCache.users[idx].profilePic = b64;
  await saveData(dataCache);
  alert("Profile picture updated.");
});

// ---------- ADD ACTIVITY REPORT ----------
addActivity.addEventListener("click", async () => {
  if (!activeUser) return alert("Login first.");
  const date = activityDate.value;
  const text = activityInput.value.trim();
  const files = Array.from(activityImages.files || []);
  if (!date) return alert("Select a date.");
  if (!text && files.length === 0) return alert("Enter details or attach images.");

  const reportId = uid();
  let images = [];
  for (const file of files) {
    const b64 = await toBase64(file);
    images.push({ id: uid(), fileName: file.name, content: b64 });
  }

  dataCache.reports.push({
    id: reportId,
    username: activeUser.username,
    dept: activeUser.dept,
    text,
    date,
    images,
    createdAt: new Date().toISOString()
  });

  await saveData(dataCache);

  activityDate.value = ""; activityInput.value = ""; activityImages.value = "";
  alert("Report saved.");
  applyFiltersAndLoadReports();
});

// ---------- FILTERS ----------
filterReportsBtn.addEventListener("click", applyFiltersAndLoadReports);
clearFiltersBtn.addEventListener("click", () => {
  filterDept.value = ""; fromDate.value = ""; toDate.value = ""; searchText.value = "";
  applyFiltersAndLoadReports();
});

function applyFilters() {
  let filtered = [...dataCache.reports];
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

  // If user is not GM, show only own reports
  if (activeUser.dept !== "GM") filtered = filtered.filter(r => r.username === activeUser.username);

  return filtered;
}

async function applyFiltersAndLoadReports() {
  await loadData();
  renderReports(applyFilters());
}

// ---------- RENDER REPORTS ----------
function renderReports(reports) {
  reportsList.innerHTML = "";
  reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  reports.forEach(r => {
    const card = document.createElement("div");
    card.className = "report";

    const h = document.createElement("h4");
    h.innerHTML = `${escapeHtml(r.username)} (${escapeHtml(r.dept)}) | ${escapeHtml(r.date)}`;
    card.appendChild(h);

    const p = document.createElement("p");
    p.innerHTML = marked.parse(r.text || "");
    card.appendChild(p);

    if (r.images && r.images.length > 0) {
      const viewBtn = document.createElement("button");
      viewBtn.textContent = `📎 View Attachments (${r.images.length})`;
      viewBtn.className = "view-attachments";

      viewBtn.addEventListener("click", () => {
        let existing = card.querySelector(".image-grid");
        if (existing) { existing.remove(); return; }

        const grid = document.createElement("div");
        grid.className = "image-grid";
        r.images.forEach(img => {
          const imgEl = document.createElement("img");
          imgEl.src = img.content;
          imgEl.alt = img.fileName;
          imgEl.addEventListener("click", () => {
            const w = window.open("");
            w.document.write(`<html><head><title>Attachment</title></head><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center"><img src="${img.content}" style="max-width:100%;max-height:100vh"></body></html>`);
          });
          grid.appendChild(imgEl);
        });
        card.appendChild(grid);
      });
      card.appendChild(viewBtn);
    }

    if (activeUser.username === r.username || activeUser.dept === "GM") {
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Delete report by ${r.username}?`)) return;
        dataCache.reports = dataCache.reports.filter(rep => rep.id !== r.id);
        await saveData(dataCache);
        renderReports(applyFilters());
      });
      card.appendChild(delBtn);
    }

    reportsList.appendChild(card);
  });
}

// ---------- GM ERASE USER ----------
function setupEraseUsers() {
  if (activeUser.dept !== "GM") {
    gmEraseContainer.classList.add("hidden");
    return;
  }
  gmEraseContainer.classList.remove("hidden");
  eraseSelect.innerHTML = `<option value="">Select User</option>`;
  dataCache.users.forEach(u => {
    if (u.username !== activeUser.username) eraseSelect.innerHTML += `<option value="${u.username}">${u.username} (${u.dept})</option>`;
  });
}

eraseSelect.addEventListener("change", () => {
  const sel = dataCache.users.find(u => u.username === eraseSelect.value);
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
  if (!confirm(`Erase user ${username} and all their reports?`)) return;

  dataCache.users = dataCache.users.filter(u => u.username !== username);
  dataCache.reports = dataCache.reports.filter(r => r.username !== username);
  await saveData(dataCache);
  setupEraseUsers();
  renderReports(applyFilters());
  alert("User and their reports erased.");
});

// ---------- INITIAL LOAD ----------
window.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  if (activeUser) initUIForActiveUser();
  else loginSection.classList.remove("hidden");
});
