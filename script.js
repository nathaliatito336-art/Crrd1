// === CONFIG ===
const GITHUB_JSON_URL = "https://raw.githubusercontent.com/nathaliatito336-art/Crrd1/main/data.json";
const GITHUB_API_URL = "https://api.github.com/repos/nathaliatito336/Crrd1/contents/data.json";
const GITHUB_TOKEN = "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"; // must have write access

// === LOCAL CACHE ===
let localData = JSON.parse(localStorage.getItem("crownData")) || { users: [], reports: [] };
let activeUser = JSON.parse(localStorage.getItem("activeUser")) || null;

// === ELEMENTS ===
const loginSection = document.getElementById("loginSection");
const registerSection = document.getElementById("registerSection");
const dashboard = document.getElementById("dashboard");
const addReportSection = document.getElementById("addReportSection");
const reportsSection = document.getElementById("reportsSection");

// === INITIALIZATION ===
window.addEventListener("load", async () => {
  await syncFromGitHub();
  if (activeUser) showDashboard();
});

// === SYNC FUNCTIONS ===
async function syncFromGitHub() {
  try {
    const res = await fetch(GITHUB_JSON_URL + "?timestamp=" + Date.now());
    const data = await res.json();
    localData = data;
    localStorage.setItem("crownData", JSON.stringify(data));
    console.log("✅ Synced from GitHub");
  } catch (e) {
    console.warn("⚠️ Using local cache (offline mode)");
  }
}

async function syncToGitHub() {
  const content = btoa(JSON.stringify(localData, null, 2));
  const getRes = await fetch(GITHUB_API_URL, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  const file = await getRes.json();

  await fetch(GITHUB_API_URL, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Update data.json",
      content: content,
      sha: file.sha
    })
  });

  console.log("☁️ Synced to GitHub");
}

// === UI SWITCHES ===
document.getElementById("toRegister").onclick = () => switchView(registerSection);
document.getElementById("toLogin").onclick = () => switchView(loginSection);

function switchView(show) {
  [loginSection, registerSection, dashboard, addReportSection, reportsSection].forEach(sec => sec.classList.add("hidden"));
  show.classList.remove("hidden");
}

// === REGISTRATION ===
document.getElementById("registerBtn").onclick = async () => {
  const user = document.getElementById("regUsername").value.trim();
  const pass = document.getElementById("regPassword").value.trim();
  const dept = document.getElementById("regDept").value;
  const gmCode = document.getElementById("gmCode").value.trim();

  if (!user || !pass || !dept) return alert("Complete all fields");
  if (dept === "GM" && gmCode !== "CRRD") return alert("Invalid GM code");

  if (localData.users.find(u => u.username === user)) return alert("Username already exists");

  localData.users.push({ username: user, password: pass, dept });
  localStorage.setItem("crownData", JSON.stringify(localData));
  await syncToGitHub();
  alert("Registered successfully!");
  switchView(loginSection);
};

// === LOGIN ===
document.getElementById("loginBtn").onclick = async () => {
  const user = document.getElementById("loginUsername").value.trim();
  const pass = document.getElementById("loginPassword").value.trim();

  await syncFromGitHub(); // always refresh before login
  const found = localData.users.find(u => u.username === user && u.password === pass);
  if (!found) return alert("Invalid credentials");

  activeUser = found;
  localStorage.setItem("activeUser", JSON.stringify(found));
  showDashboard();
};

// === DASHBOARD ===
function showDashboard() {
  switchView(dashboard);
  document.getElementById("welcomeText").textContent = `Welcome, ${activeUser.username}!`;
  document.getElementById("userDept").textContent = `Department: ${activeUser.dept}`;
  document.getElementById("gmTools").classList.toggle("hidden", activeUser.dept !== "GM");
}

// === LOGOUT ===
document.getElementById("logoutBtn").onclick = () => {
  activeUser = null;
  localStorage.removeItem("activeUser");
  switchView(loginSection);
};

// === ADD REPORT ===
document.getElementById("addReportBtn").onclick = () => switchView(addReportSection);
document.getElementById("cancelReportBtn").onclick = () => switchView(dashboard);

document.getElementById("saveReportBtn").onclick = async () => {
  const text = document.getElementById("reportText").value.trim();
  const date = document.getElementById("reportDate").value;
  const files = document.getElementById("reportImage").files;

  if (!text || !date) return alert("Complete all fields");

  const images = [];
  for (let f of files) {
    const base64 = await toBase64(f);
    images.push({ name: f.name, content: base64 });
  }

  const report = {
    id: Date.now().toString(),
    username: activeUser.username,
    dept: activeUser.dept,
    text,
    date,
    images,
    createdAt: new Date().toISOString()
  };

  localData.reports.push(report);
  localStorage.setItem("crownData", JSON.stringify(localData));
  await syncToGitHub();
  alert("Report saved!");
  switchView(dashboard);
};

// === VIEW REPORTS ===
document.getElementById("viewReportsBtn").onclick = () => {
  const list = document.getElementById("reportsList");
  list.innerHTML = "";

  const visible = activeUser.dept === "GM"
    ? localData.reports
    : localData.reports.filter(r => r.username === activeUser.username);

  visible.forEach(r => {
    const div = document.createElement("div");
    div.className = "report";
    div.innerHTML = `
      <h4>${r.username} (${r.dept}) - ${r.date}</h4>
      <p>${r.text}</p>
      ${r.images.length ? `<p>📸 ${r.images.length} image(s)</p>` : ""}
    `;
    list.appendChild(div);
  });

  switchView(reportsSection);
};

document.getElementById("backDashboard").onclick = () => switchView(dashboard);

// === UTILITY ===
function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
      }
