// ============================================================
// GAS バックエンド: 「個人製作」タスク管理アプリ (myapp)
// ============================================================

// シートの初期化処理
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // users シート
  let usersSheet = ss.getSheetByName('users');
  if (!usersSheet) {
    usersSheet = ss.insertSheet('users');
    usersSheet.appendRow(['id', 'email', 'password', 'name']);
  }
  
  // sessions シート
  let sessionsSheet = ss.getSheetByName('sessions');
  if (!sessionsSheet) {
    sessionsSheet = ss.insertSheet('sessions');
    sessionsSheet.appendRow(['user_id', 'token', 'expired_at']);
  }

  // projects シート (id, name, color, status, progress, user_id)
  let projectsSheet = ss.getSheetByName('projects');
  if (!projectsSheet) {
    projectsSheet = ss.insertSheet('projects');
    projectsSheet.appendRow(['id', 'name', 'color', 'status', 'progress', 'user_id']);
    // 初期プロジェクトの登録 (adminユーザー用)
    projectsSheet.appendRow(['proj-1', '個人的な活動', '#6366f1', '進行中', '0', 'admin']);
    projectsSheet.appendRow(['proj-2', '課題(専門)', '#10b981', '進行中', '0', 'admin']);
    projectsSheet.appendRow(['proj-3', '課題(帝京)', '#f59e0b', '進行中', '0', 'admin']);
    projectsSheet.appendRow(['proj-4', '就職活動', '#ec4899', '進行中', '0', 'admin']);
    projectsSheet.appendRow(['proj-5', 'その他', '#64748b', '進行中', '0', 'admin']);
  }

  // tasks シート (id, title, project_id, status, due_date, create_at, user_id)
  let tasksSheet = ss.getSheetByName('tasks');
  if (!tasksSheet) {
    tasksSheet = ss.insertSheet('tasks');
    tasksSheet.getRange('E:E').setNumberFormat('@');
    tasksSheet.appendRow(['id', 'title', 'project_id', 'status', 'due_date', 'create_at', 'user_id']);
    // 初期タスクの追加
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    
    tasksSheet.appendRow(['task-1', '個人的な活動のタスク例', 'proj-1', 'todo', formatDateOnly(today), today.toISOString(), 'admin']);
    tasksSheet.appendRow(['task-2', '専門学校の課題タスク例', 'proj-2', 'doing', formatDateOnly(today), today.toISOString(), 'admin']);
    tasksSheet.appendRow(['task-3', '帝京大学の課題タスク例', 'proj-3', 'done', formatDateOnly(today), today.toISOString(), 'admin']);
    tasksSheet.appendRow(['task-4', '就職活動のタスク例', 'proj-4', 'todo', formatDateOnly(tomorrow), today.toISOString(), 'admin']);
  }

  // settings シート (OpenRouter APIキー格納用)
  let settingsSheet = ss.getSheetByName('settings');
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('settings');
    settingsSheet.appendRow(['項目', '値']);
    settingsSheet.appendRow(['OpenRouter_API_Key', 'YOUR_API_KEY_HERE']);
  }

  // messages シート (AI管理人チャット用)
  let messagesSheet = ss.getSheetByName('messages');
  if (!messagesSheet) {
    messagesSheet = ss.insertSheet('messages');
    messagesSheet.appendRow(['user_id', 'type', 'text', 'create_at']);
  }
}

// トークン生成
function generateToken() {
  return Utilities.getUuid();
}

function getDateTimeZone() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss ? ss.getSpreadsheetTimeZone() : Session.getScriptTimeZone();
}

function formatDateOnly(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const text = value.toString().trim();
  // yyyy-MM-dd 形式は直接抽出（new Date() 変換を避けてタイムゾーンズレを防ぐ）
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  // M/D/YYYY 形式
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    return `${slashMatch[3]}-${month}-${day}`;
  }
  // 上記以外はDateオブジェクトに変換してローカルメソッドで取得
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dateVal = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dateVal}`;
}

function setTaskDueDate(tasksSheet, row, dueDate) {
  tasksSheet.getRange(row, 5).setNumberFormat('@').setValue(formatDateOnly(dueDate));
}

// JSON レスポンス返却
function createJsonResponse(data) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(JSON.stringify(data));
  return output;
}

// OpenRouter API 呼び出し (フォールバック対応版)
function callOpenRouter(messages) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName('settings');
  const apiKey = settingsSheet.getRange('B2').getValue().toString().trim();

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE' || apiKey === '') {
    throw new Error('OpenRouterのAPIキーが settings シートの B2 セルに設定されていません。');
  }

  const MODELS = [
    'google/gemma-4-31b:free',
    'openai/gpt-oss-120b:free',
    'nvidia/nemotron-3-ultra:free',
    'google/gemma-4-26b-a4b:free',
    'openai/gpt-oss-20b:free',
    'nvidia/nemotron-3-super:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'google/gemini-2.0-flash-lite-preview-02-05:free', // 安定したフォールバック
    'meta-llama/llama-3.3-70b-instruct:free'
  ];

  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const headers = {
    'Authorization': 'Bearer ' + apiKey,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://script.google.com/',
    'X-Title': 'GAS Tasks App AI Assistant'
  };

  let lastError = null;

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i];
    Logger.log('[OpenRouter] モデル試行: ' + model);

    const payload = {
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 256
    };

    const options = {
      method: 'post',
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      const res = UrlFetchApp.fetch(url, options);
      const status = res.getResponseCode();
      const text = res.getContentText();

      if (status < 200 || status >= 300) {
        lastError = new Error('HTTP ' + status + ' (' + model + ')\n' + text);
        continue;
      }

      const json = JSON.parse(text);
      const content = json?.choices?.[0]?.message?.content ?? '';

      if (!content) {
        lastError = new Error('空のレスポンス (' + model + ')');
        continue;
      }

      return content;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error('全モデルで失敗しました。最後のエラー: ' + lastError.toString());
}

// セッション確認
function handleCheckSession(token) {
  if (!token) {
    return { status: 'error', message: 'トークンが指定されていません。' };
  }
  
  // 管理者デモ用のアカウントのハードコード対応（デモ用）
  if (token === 'admin-token') {
    return { status: 'success', user: { name: '山田 太郎', email: 'admin@example.com' }, userId: 'admin' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sessionsSheet = ss.getSheetByName('sessions');
  const sessionData = sessionsSheet.getDataRange().getValues();
  
  let sessionIndex = -1;
  let userId = '';
  let expiredAt = null;
  
  for (let i = 1; i < sessionData.length; i++) {
    if (sessionData[i][1].toString() === token) {
      sessionIndex = i;
      userId = sessionData[i][0].toString();
      expiredAt = new Date(sessionData[i][2]);
      break;
    }
  }
  
  if (sessionIndex === -1) {
    return { status: 'error', message: 'セッションが無効です。' };
  }
  
  const now = new Date();
  if (now > expiredAt) {
    sessionsSheet.deleteRow(sessionIndex + 1);
    return { status: 'error', message: 'セッションの有効期限が切れています。' };
  }
  
  const usersSheet = ss.getSheetByName('users');
  const userData = usersSheet.getDataRange().getValues();
  let userInfo = null;
  
  for (let i = 1; i < userData.length; i++) {
    if (userData[i][0].toString() === userId) {
      userInfo = {
        name: userData[i][3] ? userData[i][3].toString() : '',
        email: userData[i][1] ? userData[i][1].toString() : ''
      };
      break;
    }
  }
  
  if (!userInfo) {
    return { status: 'error', message: 'ユーザー情報が見つかりません。' };
  }
  
  return { status: 'success', user: userInfo, userId: userId };
}

// GET リクエスト受付
function doGet(e) {
  initSheets();
  const mode = e.parameter.mode;
  if (!mode) {
    return createJsonResponse({ status: 'error', message: 'mode未指定' });
  }

  try {
    if (mode === 'login') {
      return createJsonResponse(handleLogin(e.parameter.email, e.parameter.password));
    } else if (mode === 'checkSession') {
      return createJsonResponse(handleCheckSession(e.parameter.token));
    } else if (mode === 'getTasks') {
      return createJsonResponse(handleGetTasks(e.parameter.token));
    } else if (mode === 'getProjects') {
      return createJsonResponse(handleGetProjects(e.parameter.token));
    } else if (mode === 'getMessages') {
      return createJsonResponse(handleGetMessages(e.parameter.token));
    } else if (mode === 'getReport') {
      return createJsonResponse(handleGetReport(e.parameter.token));
    } else if (mode === 'saveTask') {
      return createJsonResponse(handleSaveTask(e.parameter.token, e.parameter.id, e.parameter.title, e.parameter.project_id, e.parameter.status, e.parameter.due_date));
    } else if (mode === 'deleteTask') {
      return createJsonResponse(handleDeleteTask(e.parameter.token, e.parameter.id));
    } else if (mode === 'saveProject') {
      return createJsonResponse(handleSaveProject(e.parameter.token, e.parameter.id, e.parameter.name, e.parameter.color, e.parameter.status, e.parameter.progress));
    } else if (mode === 'deleteProject') {
      return createJsonResponse(handleDeleteProject(e.parameter.token, e.parameter.id));
    } else if (mode === 'sendChat') {
      return createJsonResponse(handleSendChat(e.parameter.token, e.parameter.text));
    } else if (mode === 'debugOpenRouter') {
      // APIテスト用エンドポイント
      const testMsg = [{ role: 'user', content: 'こんにちは。一言挨拶してください。' }];
      const reply = callOpenRouter(testMsg);
      return createJsonResponse({ status: 'success', reply: reply });
    } else if (mode === 'debugDate') {
      // 日付フォーマットのデプロイ確認用エンドポイント
      const testDate = e.parameter.date || '2026-07-20';
      const result = formatDateOnly(testDate);
      const tz = getDateTimeZone();
      return createJsonResponse({
        status: 'success',
        version: '2026-07-16-fix',
        input: testDate,
        output: result,
        timezone: tz,
        match: testDate === result ? 'OK (日付一致)' : 'NG (日付ズレあり)'
      });
    }
    return createJsonResponse({ status: 'error', message: '無効なmode: ' + mode });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// POST リクエスト受付
function doPost(e) {
  initSheets();
  const mode = e.parameter.mode;
  if (!mode) {
    return createJsonResponse({ status: 'error', message: 'mode未指定' });
  }

  try {
    if (mode === 'saveTask') {
      return createJsonResponse(handleSaveTask(e.parameter.token, e.parameter.id, e.parameter.title, e.parameter.project_id, e.parameter.status, e.parameter.due_date));
    } else if (mode === 'deleteTask') {
      return createJsonResponse(handleDeleteTask(e.parameter.token, e.parameter.id));
    } else if (mode === 'saveProject') {
      return createJsonResponse(handleSaveProject(e.parameter.token, e.parameter.id, e.parameter.name, e.parameter.color, e.parameter.status, e.parameter.progress));
    } else if (mode === 'deleteProject') {
      return createJsonResponse(handleDeleteProject(e.parameter.token, e.parameter.id));
    } else if (mode === 'sendChat') {
      return createJsonResponse(handleSendChat(e.parameter.token, e.parameter.text));
    }
    return createJsonResponse({ status: 'error', message: '無効なmode: ' + mode });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// ユーザーログイン
function handleLogin(email, password) {
  if (!email || !password) {
    return { status: 'error', message: '未入力項目があります。' };
  }

  // デモ用アカウント
  if (email.trim() === 'admin@example.com' && password.trim() === 'admin') {
    return {
      status: 'success',
      token: 'admin-token',
      user: { name: '山田 太郎', email: 'admin@example.com' }
    };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName('users');
  const data = usersSheet.getDataRange().getValues();
  
  let targetUser = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] && data[i][1].toString().trim() === email.trim() && data[i][2] && data[i][2].toString().trim() === password.trim()) {
      targetUser = {
        id: data[i][0].toString(),
        email: data[i][1].toString(),
        name: data[i][3] ? data[i][3].toString() : ''
      };
      break;
    }
  }

  if (!targetUser) {
    return { status: 'error', message: 'メールアドレスまたはパスワードが違います。' };
  }

  // セッションの作成
  const sessionsSheet = ss.getSheetByName('sessions');
  const token = generateToken();
  const expiredAt = new Date();
  expiredAt.setHours(expiredAt.getHours() + 24);
  sessionsSheet.appendRow([targetUser.id, token, expiredAt]);

  return {
    status: 'success',
    token: token,
    user: { name: targetUser.name, email: targetUser.email }
  };
}

// タスク取得
function handleGetTasks(token) {
  const session = handleCheckSession(token);
  if (session.status === 'error') return session;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tasksSheet = ss.getSheetByName('tasks');
  const data = tasksSheet.getDataRange().getValues();
  const tasks = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][6] && data[i][6].toString() === session.userId) {
      const rawValue = data[i][4];
      const dueDate = formatDateOnly(rawValue);
      const rawValueStr = rawValue ? rawValue.toString().trim() : '';
      const isAlreadyFormatted = /^\d{4}-\d{2}-\d{2}$/.test(rawValueStr);
      
      // セルの生の値が yyyy-MM-dd 形式の文字列でない場合のみ再保存する（不要な無限書き込みを防止）
      if (rawValueStr && !isAlreadyFormatted) {
        setTaskDueDate(tasksSheet, i + 1, dueDate);
      }
      tasks.push({
        id: data[i][0].toString(),
        title: data[i][1].toString(),
        project_id: data[i][2].toString(),
        status: data[i][3].toString(),
        due_date: dueDate,
        create_at: data[i][5] ? new Date(data[i][5]).toISOString() : ''
      });
    }
  }

  return { status: 'success', tasks: tasks };
}

// タスク保存 (新規・編集)
function handleSaveTask(token, id, title, projectId, status, dueDate) {
  const session = handleCheckSession(token);
  if (session.status === 'error') return session;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tasksSheet = ss.getSheetByName('tasks');
  const data = tasksSheet.getDataRange().getValues();
  const now = new Date();
  const normalizedDueDate = formatDateOnly(dueDate);

  let foundRow = -1;
  if (id) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === id && data[i][6].toString() === session.userId) {
        foundRow = i + 1;
        break;
      }
    }
  }

  if (foundRow !== -1) {
    // 編集
    tasksSheet.getRange(foundRow, 2).setValue(title);
    tasksSheet.getRange(foundRow, 3).setValue(projectId);
    tasksSheet.getRange(foundRow, 4).setValue(status);
    setTaskDueDate(tasksSheet, foundRow, normalizedDueDate);
  } else {
    // 新規作成
    const newId = 'task-' + generateToken().substring(0, 8);
    tasksSheet.appendRow([newId, title, projectId, status, '', now, session.userId]);
    setTaskDueDate(tasksSheet, tasksSheet.getLastRow(), normalizedDueDate);
  }

  return { status: 'success' };
}

// タスク削除
function handleDeleteTask(token, id) {
  const session = handleCheckSession(token);
  if (session.status === 'error') return session;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tasksSheet = ss.getSheetByName('tasks');
  const data = tasksSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === id && data[i][6].toString() === session.userId) {
      tasksSheet.deleteRow(i + 1);
      return { status: 'success' };
    }
  }

  return { status: 'error', message: 'タスクが見つかりません。' };
}

// ユーザーごとの固定プロジェクトを保証・更新する関数
function ensureUserProjects(userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projectsSheet = ss.getSheetByName('projects');
  if (!projectsSheet) return;

  const data = projectsSheet.getDataRange().getValues();
  
  // 対象ユーザー의既存プロジェクトをマッピング (ID => 行番号 1-indexed)
  const userProjMap = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][5] && data[i][5].toString() === userId) {
      userProjMap[data[i][0].toString()] = i + 1;
    }
  }
  
  // 定義する5つの固定プロジェクト
  const targetProjects = [
    { suffix: '1', name: '個人的な活動', color: '#6366f1' },
    { suffix: '2', name: '課題(専門)', color: '#10b981' },
    { suffix: '3', name: '課題(帝京)', color: '#f59e0b' },
    { suffix: '4', name: '就職活動', color: '#ec4899' },
    { suffix: '5', name: 'その他', color: '#64748b' }
  ];
  
  targetProjects.forEach(p => {
    // adminの場合は既存の 'proj-1' 等との互換性のため 'proj-1'、それ以外は 'proj-[userId]-1' などの形式にする
    const projId = userId === 'admin' ? `proj-${p.suffix}` : `proj-${userId}-${p.suffix}`;
    const rowIndex = userProjMap[projId];
    
    if (rowIndex) {
      // 既に存在する場合は名前と色を更新 (ステータスや進捗は維持する)
      projectsSheet.getRange(rowIndex, 2).setValue(p.name);
      projectsSheet.getRange(rowIndex, 3).setValue(p.color);
    } else {
      // 存在しない場合は新規登録
      projectsSheet.appendRow([projId, p.name, p.color, '進行中', 0, userId]);
    }
  });
}

// プロジェクト取得
function handleGetProjects(token) {
  const session = handleCheckSession(token);
  if (session.status === 'error') return session;

  // ユーザーのプロジェクト情報を最新の5項目に同期
  ensureUserProjects(session.userId);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projectsSheet = ss.getSheetByName('projects');
  const data = projectsSheet.getDataRange().getValues();
  const projects = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][5] && data[i][5].toString() === session.userId) {
      projects.push({
        id: data[i][0].toString(),
        name: data[i][1].toString(),
        color: data[i][2].toString(),
        status: data[i][3].toString(),
        progress: Number(data[i][4] || 0)
      });
    }
  }

  return { status: 'success', projects: projects };
}

// プロジェクト保存 (新規・編集)
function handleSaveProject(token, id, name, color, status, progress) {
  const session = handleCheckSession(token);
  if (session.status === 'error') return session;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projectsSheet = ss.getSheetByName('projects');
  const data = projectsSheet.getDataRange().getValues();

  let foundRow = -1;
  if (id) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === id && data[i][5].toString() === session.userId) {
        foundRow = i + 1;
        break;
      }
    }
  }

  if (foundRow !== -1) {
    projectsSheet.getRange(foundRow, 2).setValue(name);
    projectsSheet.getRange(foundRow, 3).setValue(color);
    projectsSheet.getRange(foundRow, 4).setValue(status);
    projectsSheet.getRange(foundRow, 5).setValue(progress);
  } else {
    const newId = 'proj-' + generateToken().substring(0, 8);
    projectsSheet.appendRow([newId, name, color, status, progress, session.userId]);
  }

  return { status: 'success' };
}

// プロジェクト削除
function handleDeleteProject(token, id) {
  const session = handleCheckSession(token);
  if (session.status === 'error') return session;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const projectsSheet = ss.getSheetByName('projects');
  const data = projectsSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === id && data[i][5].toString() === session.userId) {
      projectsSheet.deleteRow(i + 1);
      return { status: 'success' };
    }
  }

  return { status: 'error', message: 'プロジェクトが見つかりません。' };
}

// メッセージ取得
function handleGetMessages(token) {
  const session = handleCheckSession(token);
  if (session.status === 'error') return session;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const messagesSheet = ss.getSheetByName('messages');
  const messages = [];

  if (messagesSheet.getLastRow() >= 2) {
    const data = messagesSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === session.userId) {
        messages.push({
          type: data[i][1].toString(),
          text: data[i][2].toString(),
          create_at: data[i][3] ? new Date(data[i][3]).toISOString() : ''
        });
      }
    }
  }

  return { status: 'success', messages: messages };
}

// チャットメッセージ送信 & AI応答
function handleSendChat(token, text) {
  if (!text || text.trim() === '') {
    return { status: 'error', message: 'メッセージが空です。' };
  }

  const session = handleCheckSession(token);
  if (session.status === 'error') return session;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const messagesSheet = ss.getSheetByName('messages');
  const now = new Date();

  // 1. ユーザー発言保存
  messagesSheet.appendRow([session.userId, 'user', text.trim(), now]);

  // 2. コンテキスト組み立て用履歴取得 (直近15件)
  const data = messagesSheet.getDataRange().getValues();
  const userHistory = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === session.userId) {
      userHistory.push(data[i]);
    }
  }
  const recent = userHistory.slice(-15);

  const systemPrompt = "あなたはユーザーをサポートする親切なタスク管理AIアシスタントです。タスクの優先順位付け、スケジュール整理、モチベーション維持について、簡潔かつ前向きで親しみやすい言葉遣いで回答してください。マークダウン形式を使って読みやすく構造化して答えてください。";
  const messages = [{ role: 'system', content: systemPrompt }];

  for (let i = 0; i < recent.length; i++) {
    const row = recent[i];
    const type = row[1].toString(); // 'user' or 'assistant'
    if (type === 'user' || type === 'assistant') {
      messages.push({ role: type, content: row[2].toString() });
    }
  }

  try {
    // 3. AI応答取得
    const aiReply = callOpenRouter(messages);
    
    // 4. AI発言保存
    messagesSheet.appendRow([session.userId, 'assistant', aiReply, new Date()]);

    return { status: 'success', reply: aiReply };
  } catch (err) {
    return { status: 'error', message: 'AI応答生成エラー: ' + err.toString() };
  }
}

// レポート・統計データの取得
function handleGetReport(token) {
  const session = handleCheckSession(token);
  if (session.status === 'error') return session;

  // ユーザーのプロジェクト情報を最新の5項目に同期
  ensureUserProjects(session.userId);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tasksSheet = ss.getSheetByName('tasks');
  const projectsSheet = ss.getSheetByName('projects');
  
  const tasksData = tasksSheet.getDataRange().getValues();
  const projectsData = projectsSheet.getDataRange().getValues();
  
  const todayStr = formatDateOnly(new Date());

  let totalTasks = 0;
  let completedTasks = 0;
  let inProgressTasks = 0;
  let overdueTasks = 0;

  // 週別の統計データ用 (過去7日間)
  const last7Days = [];
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDateOnly(d);
    last7Days.push({
      dateStr: dateStr,
      label: (d.getMonth() + 1) + '/' + d.getDate() + '(' + dayNames[d.getDay()] + ')',
      count: 0
    });
  }

  // タスクの集計
  for (let i = 1; i < tasksData.length; i++) {
    const row = tasksData[i];
    if (row[6] && row[6].toString() === session.userId) {
      totalTasks++;
      const status = row[3].toString();
      const dueDate = formatDateOnly(row[4]);

      if (status === 'done') {
        completedTasks++;
        
        // 過去7日間の完了タスクをマッピング
        const compDateStr = formatDateOnly(row[4]); // 期限日または完了日
        const matchedDay = last7Days.find(item => item.dateStr === compDateStr);
        if (matchedDay) {
          matchedDay.count++;
        }
      } else {
        inProgressTasks++;
        // 期限切れチェック (本日より前で未完了)
        if (dueDate && dueDate < todayStr) {
          overdueTasks++;
        }
      }
    }
  }

  // プロジェクト進捗の取得
  const projects = [];
  for (let i = 1; i < projectsData.length; i++) {
    const row = projectsData[i];
    if (row[5] && row[5].toString() === session.userId) {
      projects.push({
        id: row[0].toString(),
        name: row[1].toString(),
        color: row[2].toString(),
        status: row[3].toString(),
        progress: Number(row[4] || 0)
      });
    }
  }

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    status: 'success',
    summary: {
      total: totalTasks,
      completed: completedTasks,
      inProgress: inProgressTasks,
      overdue: overdueTasks,
      rate: completionRate
    },
    projects: projects,
    chartData: {
      labels: last7Days.map(item => item.label),
      values: last7Days.map(item => item.count)
    }
  };
}
