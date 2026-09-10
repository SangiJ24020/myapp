// ============================================================
// myapp フロントエンドロジック (SPA)
// ============================================================

// グローバル状態管理
let currentTab = 'dashboard';
let taskFilter = 'all';
let sessionToken = '';
let cachedTasks = [];
let cachedProjects = [];
let productivityChartInstance = null;
let statusChartInstance = null;

// ============================================================
// 🎮 コナミコマンド 隠し要素
// ============================================================
const KONAMI_CODE = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiIndex = 0;

document.addEventListener('keydown', (e) => {
  if (e.key === KONAMI_CODE[konamiIndex]) {
    konamiIndex++;
    if (konamiIndex === KONAMI_CODE.length) {
      konamiIndex = 0;
      activateKonamiEasterEgg();
    }
  } else {
    konamiIndex = 0;
  }
});

function activateKonamiEasterEgg() {
  // 紙吹雪を生成
  launchConfetti();

  // オーバーレイメッセージ表示
  const overlay = document.createElement('div');
  overlay.id = 'konami-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(6px);
    animation: konamiFadeIn 0.4s ease;
    cursor: pointer;
  `;
  overlay.innerHTML = `
    <div style="text-align:center; animation: konamiBounce 0.6s ease;">
      <div style="font-size: 4rem; margin-bottom: 0.5rem;">🎮</div>
      <div style="
        font-size: 1.4rem; font-weight: 800;
        background: linear-gradient(90deg, #f87171, #fb923c, #facc15, #4ade80, #60a5fa, #c084fc);
        background-size: 200%;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: konamiRainbow 1.5s linear infinite;
        margin-bottom: 0.75rem;
        font-family: 'Outfit', sans-serif;
      ">KONAMI CODE ACTIVATED!</div>
      <div style="color: white; font-size: 0.95rem; opacity: 0.85; margin-bottom: 0.5rem;">
        ↑↑↓↓←→←→BA 🎉
      </div>
      <div style="color: #fbbf24; font-size: 0.8rem; font-weight: 600;">
        あなたはこのアプリの秘密を発見した！
      </div>
      <div style="color: rgba(255,255,255,0.4); font-size: 0.7rem; margin-top: 1.5rem;">
        タップして閉じる
      </div>
    </div>
  `;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);

  // 5秒後に自動で閉じる
  setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 5000);
}

function launchConfetti() {
  const COLORS = ['#f87171','#fb923c','#facc15','#4ade80','#60a5fa','#c084fc','#f472b6','#ffffff'];
  const container = document.body;

  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    const size = Math.random() * 8 + 5;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const startX = Math.random() * window.innerWidth;
    const drift = (Math.random() - 0.5) * 200;
    const duration = Math.random() * 2 + 2;
    const delay = Math.random() * 1.5;
    const isCircle = Math.random() > 0.5;

    el.style.cssText = `
      position: fixed;
      top: -20px;
      left: ${startX}px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${isCircle ? '50%' : '2px'};
      z-index: 99998;
      pointer-events: none;
      animation: confettiFall ${duration}s ${delay}s ease-in forwards;
      --drift: ${drift}px;
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), (duration + delay) * 1000 + 100);
  }
}


function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

// ローディング表示制御
function setGlobalLoading(isLoading) {
  const loader = document.getElementById('global-loader');
  if (loader) {
    if (isLoading) {
      loader.classList.add('loading');
    } else {
      loader.classList.remove('loading');
    }
  }
}

let isLoadingData = false;

// ============================================================
// ⚡ ローカルキャッシュ管理 (Stale-While-Revalidate: 体感0秒化)
// ============================================================
const CACHE_KEY_TASKS = 'myapp_tasks_cache';
const CACHE_KEY_PROJECTS = 'myapp_projects_cache';
const CACHE_KEY_SUMMARY = 'myapp_summary_cache';
const CACHE_KEY_CHART = 'myapp_chart_cache';

// ローカルストレージにキャッシュ保存
function saveToLocalCache(tasks, projects, summary, chartData) {
  try {
    if (tasks) localStorage.setItem(CACHE_KEY_TASKS, JSON.stringify(tasks));
    if (projects) localStorage.setItem(CACHE_KEY_PROJECTS, JSON.stringify(projects));
    if (summary) localStorage.setItem(CACHE_KEY_SUMMARY, JSON.stringify(summary));
    if (chartData) localStorage.setItem(CACHE_KEY_CHART, JSON.stringify(chartData));
  } catch (e) {
    console.warn('ローカルキャッシュの保存に失敗しました:', e);
  }
}

// ローカルキャッシュから即時復元（スマホで開いた瞬間に画面を表示！）
function restoreFromLocalCache() {
  try {
    const rawTasks = localStorage.getItem(CACHE_KEY_TASKS);
    const rawProjects = localStorage.getItem(CACHE_KEY_PROJECTS);
    const rawSummary = localStorage.getItem(CACHE_KEY_SUMMARY);
    const rawChart = localStorage.getItem(CACHE_KEY_CHART);

    let hasCache = false;

    if (rawTasks) {
      cachedTasks = JSON.parse(rawTasks);
      renderTaskList();
      hasCache = true;
    }

    if (rawProjects) {
      cachedProjects = JSON.parse(rawProjects);
      // タスクデータに基づきプロジェクト進捗率を最新計算
      recalculateProjectProgress();
      updateProjectSelect();
      hasCache = true;
    }

    if (rawSummary) {
      const summary = JSON.parse(rawSummary);
      updateDashboardUI(summary, cachedProjects);
      if (rawChart) {
        updateReportUI(summary, JSON.parse(rawChart));
      }
      hasCache = true;
    } else if (hasCache) {
      recalculateSummaryFromCache();
    }

    safeCreateIcons();
    return hasCache;
  } catch (e) {
    console.warn('ローカルキャッシュの復元に失敗しました:', e);
    return false;
  }
}

// Lucideアイコンの安全実行（defer読み込み対応）
function safeCreateIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// プロジェクトごとの進捗率を cachedTasks から動的に再計算する（リアルタイム連動）
function recalculateProjectProgress() {
  if (!cachedProjects || cachedProjects.length === 0) return;

  const projectStats = {};
  cachedProjects.forEach(p => {
    projectStats[p.id] = { total: 0, done: 0 };
  });

  cachedTasks.forEach(t => {
    if (t.project_id) {
      if (!projectStats[t.project_id]) {
        projectStats[t.project_id] = { total: 0, done: 0 };
      }
      projectStats[t.project_id].total++;
      if (t.status === 'done') {
        projectStats[t.project_id].done++;
      }
    }
  });

  cachedProjects.forEach(p => {
    const stats = projectStats[p.id];
    p.taskCount = stats ? stats.total : 0;
    p.doneCount = stats ? stats.done : 0;
    p.progress = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  });
}

// キャッシュからローカル統計およびプロジェクト進捗を再計算して即時UI反映（超高速＆リアルタイム連動）
function recalculateSummaryFromCache() {
  const total = cachedTasks.length;
  let completed = 0;
  let inProgress = 0;
  let overdue = 0;
  const todayStr = formatLocalDate(new Date());

  // プロジェクト進捗率をタスクから自動再計算
  recalculateProjectProgress();

  cachedTasks.forEach(t => {
    if (t.status === 'done') {
      completed++;
    } else {
      inProgress++;
      if (t.due_date && t.due_date < todayStr) {
        overdue++;
      }
    }
  });

  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const summary = {
    total: total,
    completed: completed,
    inProgress: inProgress,
    overdue: overdue,
    rate: rate
  };

  updateDashboardUI(summary, cachedProjects);
  renderTaskList();
  saveToLocalCache(cachedTasks, cachedProjects, summary, null);
}

// ドキュメント読み込み時の処理
window.addEventListener('DOMContentLoaded', async () => {
  sessionToken = getCookie('session_token');
  if (!sessionToken) {
    window.location.href = 'login.html';
    return;
  }

  // 保存済みテーマの復元
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);

  // ユーザー情報の初期表示
  const userName = getCookie('user_name') || 'ユーザー';
  const userEmail = getCookie('user_email') || '';
  document.getElementById('header-user-name').innerText = userName + 'さん';
  document.getElementById('header-avatar').innerText = userName.charAt(0).toUpperCase();
  document.getElementById('settings-name').innerText = userName;
  document.getElementById('settings-email').innerText = userEmail;

  // 1. ローカルキャッシュから0.1秒で即時復元（体感0秒で前回の画面が出現！）
  const hasCache = restoreFromLocalCache();

  // 2. アイコン初期化（defer遅延にも対応）
  safeCreateIcons();
  window.addEventListener('load', safeCreateIcons);

  // 3. アプリデータのロード（キャッシュがあれば全画面ローダーを出さず静かに裏で同期）
  await loadAppData(!hasCache);

  // AIメッセージ履歴はバックグラウンドで非同期ロード（画面表示をブロックしない）
  loadAiMessages();

  // 定期的な同期 (60秒おき・静かに同期)
  setInterval(() => {
    loadAppData(false);
  }, 60000);
});

// テーマの適用
function applyTheme(theme) {
  const root = document.documentElement;
  const toggle = document.getElementById('dark-mode-toggle');
  const icon = document.getElementById('theme-icon');

  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
    if (toggle) toggle.checked = true;
    if (icon) icon.textContent = '☀️';
  } else {
    root.removeAttribute('data-theme');
    if (toggle) toggle.checked = false;
    if (icon) icon.textContent = '🌙';
  }
}

// ダークモード切り替え
function toggleDarkMode(isDark) {
  const theme = isDark ? 'dark' : 'light';
  localStorage.setItem('theme', theme);
  applyTheme(theme);
}

// アプリデータのロードと画面更新 (一本化API + フォールバック + SWR)
async function loadAppData(showLoader = true) {
  if (!sessionToken || isLoadingData) return;
  isLoadingData = true;
  if (showLoader) setGlobalLoading(true);

  try {
    let res = null;

    // 1. まずは超高速な一本化エンドポイント (getInitialData) を試行（1往復で全取得）
    try {
      res = await requestGas({ mode: 'getInitialData', token: sessionToken });
    } catch (e) {
      console.warn('getInitialDataの呼び出しに失敗、フォールバックを実行します:', e);
    }

    // 2. フォールバック（旧GASバージョンやエラー時は従来どおり2並列取得）
    if (!res || res.status !== 'success' || !res.tasks) {
      const [reportRes, taskRes] = await Promise.all([
        requestGas({ mode: 'getReport', token: sessionToken }),
        requestGas({ mode: 'getTasks', token: sessionToken })
      ]);
      if (reportRes && reportRes.status === 'success') {
        res = {
          status: 'success',
          tasks: taskRes?.tasks || [],
          projects: reportRes.projects || [],
          summary: reportRes.summary,
          chartData: reportRes.chartData
        };
      } else if (reportRes && reportRes.status === 'error' && reportRes.message && reportRes.message.includes('セッション')) {
        console.warn('セッションが無効です。ログイン画面へ遷移します。');
        handleLogout();
        return;
      }
    }

    if (res && res.status === 'success') {
      cachedProjects = res.projects || [];
      cachedTasks = res.tasks || [];

      // スプレッドシートの古い固定値に影響されないようタスクから動的に進捗率を最新同期
      recalculateProjectProgress();

      // ローカルストレージに最新状態をキャッシュ保存（次回の起動が体感0秒に！）
      saveToLocalCache(cachedTasks, cachedProjects, res.summary, res.chartData);

      // ダッシュボード・レポート・タスク一覧の更新
      updateDashboardUI(res.summary, cachedProjects);
      updateReportUI(res.summary, res.chartData);
      renderTaskList();
      updateProjectSelect();
      safeCreateIcons();
    } else if (res && res.status === 'error' && res.message && res.message.includes('セッション')) {
      console.warn('セッションが無効です。ログイン画面へ遷移します。');
      handleLogout();
    }
  } catch (err) {
    console.error('データ取得エラー:', err);
  } finally {
    isLoadingData = false;
    if (showLoader) setGlobalLoading(false);
  }
}

// タブ切り替え
function switchTab(tabId) {
  currentTab = tabId;
  
  // ナビボタンの active クラス切り替え
  document.querySelectorAll('.app-nav .nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById(`nav-${tabId}`);
  if (activeNav) activeNav.classList.add('active');

  // 表示セクションの切り替え
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
  document.getElementById(`view-${tabId}`).classList.remove('hidden');

  // タスクタブが選択されたらキャッシュから即時描画
  if (tabId === 'tasks') {
    renderTaskList();
  }
  
  // 分析タブが選択されたら裏で静かに同期
  if (tabId === 'report') {
    loadAppData(false);
  }
}

// 設定画面を開く
function openSettingsView() {
  switchTab('settings');
}

// ログアウト処理
function handleLogout() {
  deleteCookie('session_token');
  deleteCookie('user_name');
  deleteCookie('user_email');
  try {
    localStorage.removeItem(CACHE_KEY_TASKS);
    localStorage.removeItem(CACHE_KEY_PROJECTS);
    localStorage.removeItem(CACHE_KEY_SUMMARY);
    localStorage.removeItem(CACHE_KEY_CHART);
  } catch (e) {}
  window.location.href = 'login.html';
}

// 🏠 ダッシュボード UI 更新
function updateDashboardUI(summary, projects) {
  if (!summary) return;

  // 今日のタスク数
  document.getElementById('dash-task-count').innerText = `${summary.total} 件`;
  document.getElementById('dash-task-detail').innerText = `完了 ${summary.completed}件 / 残り ${summary.inProgress}件`;

  // 円形進捗バー更新
  const circleBar = document.getElementById('dash-circle-bar');
  const percentText = document.getElementById('dash-circle-percent');
  const rate = summary.rate || 0;
  
  percentText.innerText = `${rate}%`;
  const strokeOffset = 226 - (226 * rate / 100);
  circleBar.style.strokeDashoffset = strokeOffset;

  // クイックステータス
  document.getElementById('dash-num-doing').innerText = summary.inProgress;
  document.getElementById('dash-num-done').innerText = summary.completed;
  document.getElementById('dash-num-overdue').innerText = summary.overdue;

  // プロジェクトリストの更新
  const projList = document.getElementById('dash-project-list');
  projList.innerHTML = '';

  if (projects.length === 0) {
    projList.innerHTML = '<div class="project-card" style="justify-content: center; color: var(--text-muted); font-size: 0.8rem;">プロジェクトがありません。</div>';
    return;
  }

  projects.forEach(proj => {
    // このプロジェクトに紐づくタスク件数を算出
    const taskCount = proj.taskCount !== undefined 
      ? proj.taskCount 
      : cachedTasks.filter(t => t.project_id === proj.id).length;

    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div class="project-icon" style="background-color: ${proj.color || '#6366f1'}">
        <i data-lucide="folder" style="width: 18px; height: 18px;"></i>
      </div>
      <div class="project-details">
        <h4>${proj.name}</h4>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${proj.progress || 0}%; background-color: ${proj.color || '#6366f1'};"></div>
        </div>
      </div>
      <div class="project-percent" title="タスク数">${taskCount}個</div>
    `;
    projList.appendChild(card);
  });
  
  lucide.createIcons();
}

// ✅ タスクフィルター切り替え
function filterTasks(filterType) {
  taskFilter = filterType;
  
  document.querySelectorAll('.filter-tabs .filter-tab').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-filter-${filterType}`).classList.add('active');

  renderTaskList();
}

// タスクリストのレンダリング
function renderTaskList() {
  const container = document.getElementById('task-list-container');
  container.innerHTML = '';

  // フィルター適用
  let filtered = cachedTasks;
  if (taskFilter === 'todo') {
    filtered = cachedTasks.filter(t => t.status === 'todo');
  } else if (taskFilter === 'doing') {
    filtered = cachedTasks.filter(t => t.status === 'doing');
  } else if (taskFilter === 'done') {
    filtered = cachedTasks.filter(t => t.status === 'done');
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="project-card" style="justify-content: center; color: var(--text-muted); font-size: 0.8rem; padding: 2rem 0;">該当するタスクはありません。</div>';
    return;
  }

  // 期限日でグループ化 (今日 / 明日 / 今週 / その他)
  const todayStr = formatLocalDate(new Date());
  const tom = new Date(); tom.setDate(tom.getDate() + 1);
  const tomorrowStr = formatLocalDate(tom);

  const groups = {
    '今日': [],
    '明日': [],
    '今週以降': []
  };

  filtered.forEach(task => {
    if (task.due_date === todayStr) {
      groups['今日'].push(task);
    } else if (task.due_date === tomorrowStr) {
      groups['明日'].push(task);
    } else {
      groups['今週以降'].push(task);
    }
  });

  for (const groupName in groups) {
    const list = groups[groupName];
    if (list.length === 0) continue;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'task-group';
    groupDiv.innerHTML = `<div class="task-group-title">${groupName}</div>`;

    list.forEach(task => {
      const proj = cachedProjects.find(p => p.id === task.project_id) || { name: 'プロジェクトなし', color: '#cbd5e1' };
      const isChecked = task.status === 'done';
      
      const item = document.createElement('div');
      item.className = `task-item ${isChecked ? 'done' : ''}`;
      item.onclick = () => openEditTaskModal(task.id);
      item.innerHTML = `
        <div class="task-checkbox ${isChecked ? 'checked' : ''}" onclick="event.stopPropagation(); toggleTaskDone('${task.id}', '${task.status}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="task-info">
          <h5>${task.title}</h5>
          <div class="task-meta">
            <span class="task-tag" style="background-color: ${proj.color}20; color: ${proj.color};">${proj.name}</span>
          </div>
        </div>
        <div class="task-time">${formatDateLabel(task.due_date)}</div>
      `;
      groupDiv.appendChild(item);
    });

    container.appendChild(groupDiv);
  }

  lucide.createIcons();
}

// プロジェクト選択セレクトボックスの更新
function updateProjectSelect() {
  const select = document.getElementById('task-project');
  select.innerHTML = '';
  cachedProjects.forEach(proj => {
    const opt = document.createElement('option');
    opt.value = proj.id;
    opt.innerText = proj.name;
    select.appendChild(opt);
  });
}

// 📅 日付のフォーマットユーティリティ
function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = parseDateOnly(dateStr);
  if (!d) return dateStr;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// タスク完了のトグルスイッチ (体感0秒の楽観的UI更新)
async function toggleTaskDone(taskId, currentStatus) {
  const newStatus = currentStatus === 'done' ? 'todo' : 'done';
  const task = cachedTasks.find(t => t.id === taskId);
  if (!task) return;

  // 画面と統計を即座にローカル更新 (止まらない！)
  task.status = newStatus;
  recalculateSummaryFromCache();

  try {
    setGlobalLoading(true);
    const res = await requestGasPost({
      mode: 'saveTask',
      token: sessionToken,
      id: taskId,
      title: task.title,
      project_id: task.project_id,
      status: newStatus,
      due_date: task.due_date
    });

    if (res.status !== 'success') {
      // 失敗時はロールバック
      task.status = currentStatus;
      recalculateSummaryFromCache();
      alert('タスクの更新に失敗しました。');
    }
  } catch (err) {
    task.status = currentStatus;
    recalculateSummaryFromCache();
    console.error(err);
  } finally {
    setGlobalLoading(false);
  }
}

// --- ➕ タスクモーダルの制御 ---
function openAddTaskModal() {
  document.getElementById('modal-title-text').innerText = 'タスクの作成';
  document.getElementById('task-id').value = '';
  document.getElementById('task-title').value = '';
  document.getElementById('task-status').value = 'todo';
  
  const todayStr = formatLocalDate(new Date());
  document.getElementById('task-due').value = todayStr;
  
  document.getElementById('btn-delete-task').style.display = 'none';

  const overlay = document.getElementById('task-modal');
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
}

function openEditTaskModal(taskId) {
  const task = cachedTasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('modal-title-text').innerText = 'タスクの編集';
  document.getElementById('task-id').value = task.id;
  document.getElementById('task-title').value = task.title;
  document.getElementById('task-project').value = task.project_id;
  document.getElementById('task-status').value = task.status;
  document.getElementById('task-due').value = task.due_date;
  
  document.getElementById('btn-delete-task').style.display = 'flex';

  const overlay = document.getElementById('task-modal');
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
}

function closeTaskModal(e) {
  const overlay = document.getElementById('task-modal');
  overlay.classList.remove('active');
  setTimeout(() => overlay.style.display = 'none', 300);
}

// タスク保存の実行 (楽観的UI更新)
async function saveTaskData(event) {
  event.preventDefault();

  const id = document.getElementById('task-id').value;
  const title = document.getElementById('task-title').value.trim();
  const projectId = document.getElementById('task-project').value;
  const status = document.getElementById('task-status').value;
  const dueDate = document.getElementById('task-due').value;

  closeTaskModal();

  // 画面への即時反映 (待たずにすぐ表示！)
  if (id) {
    const existing = cachedTasks.find(t => t.id === id);
    if (existing) {
      existing.title = title;
      existing.project_id = projectId;
      existing.status = status;
      existing.due_date = dueDate;
    }
  } else {
    // 一時タスクをリスト先頭に追加
    const tempTask = {
      id: 'temp-' + Date.now(),
      title: title,
      project_id: projectId,
      status: status,
      due_date: dueDate,
      create_at: new Date().toISOString()
    };
    cachedTasks.unshift(tempTask);
  }
  recalculateSummaryFromCache();

  try {
    setGlobalLoading(true);
    const res = await requestGasPost({
      mode: 'saveTask',
      token: sessionToken,
      id: id,
      title: title,
      project_id: projectId,
      status: status,
      due_date: dueDate
    });

    if (res.status === 'success') {
      // 静かに裏で同期して正式なIDを取得
      loadAppData(false);
    } else {
      alert('タスクの保存に失敗しました: ' + res.message);
      loadAppData(false);
    }
  } catch (err) {
    console.error(err);
    alert('保存中に通信エラーが発生しました。');
    loadAppData(false);
  } finally {
    setGlobalLoading(false);
  }
}

// タスク削除の実行 (楽観的UI更新)
async function deleteTaskData() {
  const id = document.getElementById('task-id').value;
  if (!id) return;

  if (!confirm('このタスクを削除してもよろしいですか？')) return;

  closeTaskModal();

  // 画面から即座に削除 (待たずにすぐ消える！)
  cachedTasks = cachedTasks.filter(t => t.id !== id);
  recalculateSummaryFromCache();

  try {
    setGlobalLoading(true);
    const res = await requestGasPost({
      mode: 'deleteTask',
      token: sessionToken,
      id: id
    });

    if (res.status === 'success') {
      loadAppData(false);
    } else {
      alert('タスクの削除に失敗しました: ' + res.message);
      loadAppData(false);
    }
  } catch (err) {
    console.error(err);
    alert('削除中に通信エラーが発生しました。');
    loadAppData(false);
  } finally {
    setGlobalLoading(false);
  }
}


// --- 🤖 AI アシスタントチャット ---

// チャット履歴のロード
async function loadAiMessages() {
  try {
    const res = await requestGas({
      mode: 'getMessages',
      token: sessionToken
    });

    if (res.status === 'success' && res.messages) {
      const chatLog = document.getElementById('chat-log');
      chatLog.innerHTML = ''; // クリア
      
      if (res.messages.length === 0) {
        chatLog.innerHTML = `<div class="chat-bubble ai">何かお手伝いできることはありますか？<br>「今日のスケジュールを整理して」「タスクの優先順位を提案して」など、何でも聞いてくださいね。</div>`;
        return;
      }

      res.messages.forEach(msg => {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${msg.type === 'user' ? 'user' : 'ai'}`;
        bubble.innerText = msg.text;
        chatLog.appendChild(bubble);
      });

      // スクロール最下部へ
      chatLog.scrollTop = chatLog.scrollHeight;
    }
  } catch (err) {
    console.error(err);
  }
}

// チャット入力でのEnterキーハンドリング
function handleChatKeyPress(event) {
  if (event.key === 'Enter') {
    sendChatMessage();
  }
}

// チャットメッセージの送信
async function sendChatMessage() {
  const input = document.getElementById('chat-input-text');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  
  const chatLog = document.getElementById('chat-log');
  
  // ユーザーのメッセージを追加
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble user';
  userBubble.innerText = text;
  chatLog.appendChild(userBubble);
  chatLog.scrollTop = chatLog.scrollHeight;

  // AI「考え中...」プレースホルダー追加
  const aiBubble = document.createElement('div');
  aiBubble.className = 'chat-bubble ai';
  aiBubble.innerHTML = '考え中<span class="loading-dot">...</span>';
  chatLog.appendChild(aiBubble);
  chatLog.scrollTop = chatLog.scrollHeight;

  try {
    const res = await requestGasPost({
      mode: 'sendChat',
      token: sessionToken,
      text: text
    });

    if (res.status === 'success') {
      aiBubble.innerText = res.reply;
    } else {
      aiBubble.innerText = 'すみません、応答の生成中にエラーが発生しました。';
    }
  } catch (err) {
    console.error(err);
    aiBubble.innerText = '通信エラーが発生しました。APIキーまたは接続状態を確認してください。';
  } finally {
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}


// --- 📊 分析・レポート用グラフ描画 ---

function updateReportUI(summary, chartData) {
  if (!summary) return;

  document.getElementById('report-done-count').innerText = `${summary.completed} 件`;
  document.getElementById('report-productivity-score').innerText = `${summary.rate} / 100`;

  // 1. 折れ線グラフ (週別完了タスク推移)
  const lineCtx = document.getElementById('productivityChart').getContext('2d');
  if (productivityChartInstance) {
    productivityChartInstance.destroy();
  }

  productivityChartInstance = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: chartData?.labels || ['月', '火', '水', '木', '金', '土', '日'],
      datasets: [{
        label: '完了タスク数',
        data: chartData?.values || [0, 0, 0, 0, 0, 0, 0],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#6366f1',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });

  // 2. ドーナツグラフ (ステータス比率)
  const donutCtx = document.getElementById('statusChart').getContext('2d');
  if (statusChartInstance) {
    statusChartInstance.destroy();
  }

  statusChartInstance = new Chart(donutCtx, {
    type: 'doughnut',
    data: {
      labels: ['進行中', '完了', '期限切れ'],
      datasets: [{
        data: [summary.inProgress, summary.completed, summary.overdue],
        backgroundColor: ['#6366f1', '#10b981', '#ef4444'],
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            font: { size: 10 }
          }
        }
      },
      cutout: '65%'
    }
  });
}

// ============================================================
// ✨ AIアイコンウインク機能
// ============================================================
function triggerAiWink() {
  const avatar = document.getElementById('ai-avatar-icon');
  if (!avatar || avatar.classList.contains('winking')) return;
  
  avatar.classList.add('winking');
  
  // アイコン全体を少し傾けてピョンと跳ねさせる
  avatar.style.transform = 'scale(1.1) rotate(-8deg)';
  
  // LucideのbotアイコンのSVGから「目」の要素を探してウインク(＜の形)させる
  const svg = avatar.querySelector('svg');
  let originalPath = '';
  let rightEyePath = null;
  
  if (svg) {
    const paths = svg.querySelectorAll('path');
    paths.forEach(p => {
      const d = p.getAttribute('d');
      // d="M15 13v2" が右目のパス
      if (d && d.includes('M15') && d.includes('13v2')) {
        rightEyePath = p;
        originalPath = d; // 元のパスを記憶
        
        p.style.transition = 'all 0.1s ease';
        // ＜ の形 (M16 13 L14 14 L16 15) にパスを書き換える
        p.setAttribute('d', 'M16 13 L14 14 L16 15');
      }
    });
  }
  
  // 浮遊する小さなキラキラを生成
  const sparkle = document.createElement('div');
  sparkle.innerHTML = '✨';
  sparkle.style.cssText = `
    position: absolute;
    top: -5px;
    right: -10px;
    font-size: 14px;
    pointer-events: none;
    animation: floatUp 0.8s ease-out forwards;
  `;
  avatar.appendChild(sparkle);
  
  // 少し待ってから元の状態に戻す
  setTimeout(() => {
    avatar.style.transform = 'scale(1) rotate(0deg)';
    // パスを元に戻す
    if (rightEyePath && originalPath) {
      rightEyePath.setAttribute('d', originalPath);
    }
    
    // アニメーション完了後にクラスを外す
    setTimeout(() => {
      avatar.classList.remove('winking');
    }, 300);
  }, 400); // まばたきのキープ時間
}

// ============================================================
// 🕹️ ミニゲーム (ダッシュボード隠し要素)
// ============================================================
let isGameMode = false;
let dashTitleClickCount = 0;
let dashTitleClickTimer = null;

// タイトル5回連続タップの検知
document.addEventListener('DOMContentLoaded', () => {
  const dashTitle = document.getElementById('dash-title');
  if (dashTitle) {
    dashTitle.addEventListener('click', () => {
      dashTitleClickCount++;
      clearTimeout(dashTitleClickTimer);
      
      if (dashTitleClickCount >= 5) {
        dashTitleClickCount = 0;
        toggleGameMode();
      } else {
        dashTitleClickTimer = setTimeout(() => {
          dashTitleClickCount = 0;
        }, 1000);
      }
    });
  }
  
  // キーボード操作 (矢印キー↑ または スペースキーでジャンプ)
  document.addEventListener('keydown', (e) => {
    if (isGameMode && (e.code === 'Space' || e.code === 'ArrowUp')) {
      e.preventDefault();
      jumpGameCharacter();
    }
  });
});

function toggleGameMode() {
  isGameMode = !isGameMode;
  
  const normalStats = document.getElementById('dash-normal-stats');
  const gameContainer = document.getElementById('game-container');
  const dashSectionTitle = document.getElementById('dash-section-title');
  const dashSectionLink = document.getElementById('dash-section-link');
  const projectList = document.getElementById('dash-project-list');
  const highscoreList = document.getElementById('dash-highscore-list');
  
  // 中央のタスク追加ボタン
  const centerNavBtn = document.querySelector('.nav-item-center');
  
  if (isGameMode) {
    // ゲームモード ON
    normalStats.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    
    dashSectionTitle.innerText = '👑 ハイスコア トップ3';
    dashSectionLink.classList.add('hidden');
    projectList.classList.add('hidden');
    highscoreList.classList.remove('hidden');
    
    // ＋ボタンを ▶ ボタンに変更
    if (centerNavBtn) {
      centerNavBtn.innerHTML = '<i data-lucide="play"></i>';
      centerNavBtn.onclick = startGame;
      lucide.createIcons();
    }
    
    renderHighscores();
    resetGame();
  } else {
    // ゲームモード OFF (通常に戻す)
    normalStats.classList.remove('hidden');
    gameContainer.classList.add('hidden');
    
    dashSectionTitle.innerText = 'プロジェクトの概要';
    dashSectionLink.classList.remove('hidden');
    projectList.classList.remove('hidden');
    highscoreList.classList.add('hidden');
    
    if (centerNavBtn) {
      centerNavBtn.innerHTML = '<i data-lucide="plus"></i>';
      centerNavBtn.onclick = openAddTaskModal;
      lucide.createIcons();
    }
    
    stopGame();
  }
}

// ---- ミニゲーム ロジック ----
let gameTimer = null;
let gameScore = 0;
let isJumping = false;
let charY = 40; // bottom px
let obsX = 400; // right px
let isPlaying = false;
let gameSpeed = 5;

function resetGame() {
  const msg = document.getElementById('game-msg');
  const char = document.getElementById('game-character');
  const obs = document.getElementById('game-obstacle');
  const scoreEl = document.getElementById('game-score');
  
  isPlaying = false;
  gameScore = 0;
  charY = 40;
  obsX = 400;
  gameSpeed = 5;
  
  char.style.bottom = charY + 'px';
  obs.style.right = 'auto'; // leftベースに変更
  obs.style.left = obsX + 'px';
  scoreEl.innerText = 'Score: 0';
  msg.innerText = '▶ を押してスタート\n(↑キーかタップでジャンプ)';
  msg.style.display = 'block';
}

function startGame() {
  if (isPlaying || !isGameMode) return;
  isPlaying = true;
  
  document.getElementById('game-msg').style.display = 'none';
  obsX = window.innerWidth > 430 ? 430 : window.innerWidth;
  gameScore = 0;
  gameSpeed = 5;
  
  if (gameTimer) clearInterval(gameTimer);
  gameTimer = setInterval(gameLoop, 20);
}

function stopGame() {
  isPlaying = false;
  if (gameTimer) clearInterval(gameTimer);
}

function jumpGameCharacter() {
  if (!isPlaying || isJumping) return;
  isJumping = true;
  
  let jumpHeight = 0;
  const maxJump = 100; // ジャンプの高さを100に調整
  const jumpTimer = setInterval(() => {
    if (jumpHeight >= maxJump) {
      clearInterval(jumpTimer);
      // 落下
      const fallTimer = setInterval(() => {
        if (jumpHeight <= 0) {
          clearInterval(fallTimer);
          isJumping = false;
          charY = 40;
        } else {
          jumpHeight -= 6;
          charY = 40 + jumpHeight;
        }
        document.getElementById('game-character').style.bottom = charY + 'px';
      }, 20);
    } else {
      jumpHeight += 8;
      charY = 40 + jumpHeight;
    }
    document.getElementById('game-character').style.bottom = charY + 'px';
  }, 20);
}

function gameLoop() {
  const obs = document.getElementById('game-obstacle');
  const char = document.getElementById('game-character');
  const scoreEl = document.getElementById('game-score');
  
  // 障害物の移動
  obsX -= gameSpeed;
  if (obsX < -40) {
    // 画面幅 + 0〜300px のランダムな間隔を持たせてリスポーン
    const baseWidth = window.innerWidth > 430 ? 430 : window.innerWidth;
    const randomDelay = Math.floor(Math.random() * 300); 
    obsX = baseWidth + randomDelay;
    
    gameScore += 100;
    scoreEl.innerText = 'Score: ' + gameScore;
    
    // スピードアップ
    if (gameSpeed < 12) {
      gameSpeed += 0.5;
    }
  }
  obs.style.left = obsX + 'px';
  
  // 衝突判定
  // charの幅は約40, obsの幅は約32 (左端基準)
  // char Xは常に30付近
  const charLeft = 30;
  const charRight = 30 + 35;
  const obsLeft = obsX;
  const obsRight = obsX + 30;
  
  // Y軸: charYが40の時が地面, obsYは40
  // もしcharYが obsの高さ(約30)以下なら当たる
  if (obsLeft < charRight && obsRight > charLeft && charY < 75) {
    gameOver();
  }
}

function gameOver() {
  stopGame();
  document.getElementById('game-msg').innerText = 'Game Over\nScore: ' + gameScore;
  document.getElementById('game-msg').style.display = 'block';
  
  saveHighscore(gameScore);
  renderHighscores();
}

function saveHighscore(score) {
  if (score <= 0) return;
  let scores = JSON.parse(localStorage.getItem('minigame_scores') || '[]');
  scores.push(score);
  // 降順ソート
  scores.sort((a, b) => b - a);
  // トップ3だけ残す
  scores = scores.slice(0, 3);
  localStorage.setItem('minigame_scores', JSON.stringify(scores));
}

function renderHighscores() {
  const container = document.getElementById('dash-highscore-list');
  if (!container) return;
  container.innerHTML = '';
  
  const scores = JSON.parse(localStorage.getItem('minigame_scores') || '[]');
  
  if (scores.length === 0) {
    container.innerHTML = '<div class="project-card" style="justify-content: center; color: var(--text-muted); font-size: 0.8rem;">まだスコアがありません</div>';
    return;
  }
  
  const medals = ['🥇', '🥈', '🥉'];
  scores.forEach((score, index) => {
    const card = document.createElement('div');
    card.className = 'highscore-card';
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div class="highscore-rank">${medals[index]}</div>
        <div class="highscore-name">ランク ${index + 1}</div>
      </div>
      <div class="highscore-val">${score} pts</div>
    `;
    container.appendChild(card);
  });
}

