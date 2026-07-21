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

async function syncProjects() {
  const projectRes = await requestGas({
    mode: 'getProjects',
    token: sessionToken
  });

  if (projectRes.status === 'success') {
    cachedProjects = projectRes.projects || [];
    return true;
  }

  console.warn('プロジェクト情報の同期に失敗しました:', projectRes.message);
  return false;
}

// ドキュメント読み込み時の処理
window.addEventListener('DOMContentLoaded', async () => {
  sessionToken = getCookie('session_token');
  if (!sessionToken) {
    window.location.href = 'login.html';
    return;
  }

  // ユーザー情報の初期表示
  const userName = getCookie('user_name') || 'ユーザー';
  const userEmail = getCookie('user_email') || '';
  document.getElementById('header-user-name').innerText = userName + 'さん';
  document.getElementById('header-avatar').innerText = userName.charAt(0).toUpperCase();
  document.getElementById('settings-name').innerText = userName;
  document.getElementById('settings-email').innerText = userEmail;

  // Lucide アイコンの初期化
  lucide.createIcons();

  // アプリデータのロード
  await loadAppData();

  // AIメッセージ履歴のロード
  await loadAiMessages();

  // 定期的な同期 (30秒おき)
  setInterval(loadAppData, 30000);
});

// アプリデータのロードと画面更新
async function loadAppData() {
  if (!sessionToken) return;

  try {
    // 統計データとプロジェクト・タスクの取得
    const res = await requestGas({
      mode: 'getReport',
      token: sessionToken
    });

    if (res.status === 'success') {
      cachedProjects = res.projects || [];
      await syncProjects();
      
      // タスクリストの取得
      const taskRes = await requestGas({
        mode: 'getTasks',
        token: sessionToken
      });
      if (taskRes.status === 'success') {
        cachedTasks = taskRes.tasks || [];
      }

      // ダッシュボード・レポートの更新
      updateDashboardUI(res.summary, cachedProjects);
      updateReportUI(res.summary, res.chartData);
      renderTaskList();
      updateProjectSelect();
    } else {
      console.warn('セッションが無効です。ログイン画面へ遷移します。');
      handleLogout();
    }
  } catch (err) {
    console.error('データ取得エラー:', err);
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

  // タスクタブが選択されたら再描画
  if (tabId === 'tasks') {
    renderTaskList();
  }
  
  // 分析タブが選択されたらグラフのリサイズと再描画
  if (tabId === 'report') {
    loadAppData();
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
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div class="project-icon" style="background-color: ${proj.color || '#6366f1'}">
        <i data-lucide="folder" style="width: 18px; height: 18px;"></i>
      </div>
      <div class="project-details">
        <h4>${proj.name}</h4>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${proj.progress}%; background-color: ${proj.color || '#6366f1'};"></div>
        </div>
      </div>
      <div class="project-percent">${proj.progress}%</div>
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

// タスク完了のトグルスイッチ
async function toggleTaskDone(taskId, currentStatus) {
  const newStatus = currentStatus === 'done' ? 'todo' : 'done';
  const task = cachedTasks.find(t => t.id === taskId);
  if (!task) return;

  // 画面の即時反映 (楽観的更新)
  task.status = newStatus;
  renderTaskList();

  try {
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
      renderTaskList();
      alert('タスクの更新に失敗しました。');
    } else {
      await loadAppData();
    }
  } catch (err) {
    task.status = currentStatus;
    renderTaskList();
    console.error(err);
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

// タスク保存の実行
async function saveTaskData(event) {
  event.preventDefault();

  const id = document.getElementById('task-id').value;
  const title = document.getElementById('task-title').value;
  const projectId = document.getElementById('task-project').value;
  const status = document.getElementById('task-status').value;
  const dueDate = document.getElementById('task-due').value;

  closeTaskModal();

  try {
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
      await loadAppData();
    } else {
      alert('タスクの保存に失敗しました: ' + res.message);
    }
  } catch (err) {
    console.error(err);
    alert('保存中に通信エラーが発生しました。');
  }
}

// タスク削除の実行
async function deleteTaskData() {
  const id = document.getElementById('task-id').value;
  if (!id) return;

  if (!confirm('このタスクを削除してもよろしいですか？')) return;

  closeTaskModal();

  try {
    const res = await requestGasPost({
      mode: 'deleteTask',
      token: sessionToken,
      id: id
    });

    if (res.status === 'success') {
      await loadAppData();
    } else {
      alert('タスクの削除に失敗しました: ' + res.message);
    }
  } catch (err) {
    console.error(err);
    alert('削除中に通信エラーが発生しました。');
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
