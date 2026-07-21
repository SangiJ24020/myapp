const GAS_API_URL = window.GAS_API_URL || "https://script.google.com/macros/s/AKfycbzCDD8Mc1ZNdNy8WOCb_l9bBOXyrZrzJ8SIoP8vdhLUSHc4d_6PG2e7tZADbgR98zfw/exec";

// Cookieに値を保存する (有効期限は時間単位)
function setCookie(name, value, hours) {
  let expires = "";
  if (hours) {
    const date = new Date();
    date.setTime(date.getTime() + (hours * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/";

  // file:// スキームやローカル対応のフォールバック
  try {
    localStorage.setItem(name, value);
  } catch (e) {
    console.warn('localStorageへの保存に失敗しました:', e);
  }
}

// Cookieから値を取得する
function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1, c.length);
    }
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
  }

  // フォールバック取得
  try {
    return localStorage.getItem(name);
  } catch (e) {
    console.warn('localStorageからの取得に失敗しました:', e);
    return null;
  }
}

// Cookieを削除する
function deleteCookie(name) {
  document.cookie = name + "=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
  try {
    localStorage.removeItem(name);
  } catch (e) {
    console.warn('localStorageの削除に失敗しました:', e);
  }
}

// GASへのAPIリクエスト用ヘルパー (GET)
async function requestGas(params) {
  if (!GAS_API_URL || GAS_API_URL.includes('YOUR_GAS_WEB_APP_URL')) {
    throw new Error('GASのWeb App URLが設定されていません。public/utils.js の GAS_API_URL を更新してください。');
  }

  const queryString = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const url = `${GAS_API_URL}?${queryString}`;

  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error('APIリクエストに失敗しました。GASのURLまたはデプロイ設定を確認してください。');
  }

  return await response.json();
}

// GASへのAPIリクエスト用ヘルパー (書き込み系もGETで送信 ※GASのPOSTリダイレクト問題を回避)
async function requestGasPost(data) {
  if (!GAS_API_URL || GAS_API_URL.includes('YOUR_GAS_WEB_APP_URL')) {
    throw new Error('GASのWeb App URLが設定されていません。public/utils.js の GAS_API_URL を更新してください。');
  }

  const queryString = Object.keys(data)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key] ?? '')}`)
    .join('&');

  const url = `${GAS_API_URL}?${queryString}`;

  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error('APIリクエストに失敗しました。');
  }

  return await response.json();
}
