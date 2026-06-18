// ================================================================
// K-PICS 質問タブ ロジック
// ================================================================
// テーブル構成（Supabase側で作成する想定）：
//   questions        : id, user_id, is_anonymous, content, created_at
//   question_replies : id, question_id, user_id, is_anonymous, content, created_at
//
// 名前の表示ルール：
//   is_anonymous = true  → 「匿名」と表示
//   is_anonymous = false → profilesテーブルのnameを表示

let _myName = '';
let _questionsCache = []; // 取得した質問をキャッシュしておく（コメント開閉時の再取得を避けるため）

// ---------- 初期化：自分の名前を取得してから質問一覧を読み込む ----------
async function initQuestionsPage(){
  if(window.CURRENT_UID){
    const {data:profile} = await _supabase.from('profiles').select('name').eq('id', window.CURRENT_UID).single();
    _myName = profile?.name || '';
  }
  await loadQuestions();
}

// auth-guard.js がログイン確認を終えた後に呼ばれるよう、
// CURRENT_UID がセットされるのを少し待ってから初期化する
function waitForAuthThenInit(){
  if(window.CURRENT_UID){
    initQuestionsPage();
  } else {
    setTimeout(waitForAuthThenInit, 150);
  }
}
window.addEventListener('DOMContentLoaded', waitForAuthThenInit);

// ---------- 質問一覧の読み込み ----------
async function loadQuestions(){
  const listEl = document.getElementById('q-list');
  const {data, error} = await _supabase
    .from('questions')
    .select('*')
    .order('created_at', {ascending:false});

  if(error){
    listEl.innerHTML = `<div class="empty-state">読み込みに失敗しました<br>${escapeHtml(error.message)}</div>`;
    return;
  }
  _questionsCache = data || [];
  if(_questionsCache.length === 0){
    listEl.innerHTML = `<div class="empty-state">まだ質問がありません。<br>右下の＋ボタンから最初の質問を投稿してみましょう。</div>`;
    return;
  }
  renderQuestions();
}

function renderQuestions(){
  const listEl = document.getElementById('q-list');
  listEl.innerHTML = _questionsCache.map(q => renderQuestionCard(q)).join('');
}

function renderQuestionCard(q){
  const displayName = q.is_anonymous ? '匿名' : (q.author_name || '部員');
  const initial = q.is_anonymous ? '?' : (displayName ? displayName[0] : '?');
  const anonClass = q.is_anonymous ? 'anon' : '';
  return `
    <div class="q-card" data-qid="${q.id}">
      <div class="q-card-head">
        <div class="q-author-icon ${anonClass}">${escapeHtml(initial)}</div>
        <div class="q-author ${anonClass}">${escapeHtml(displayName)}</div>
        <div class="q-time">${formatRelativeTime(q.created_at)}</div>
      </div>
      <div class="q-content">${escapeHtml(q.content)}</div>
      <div class="q-actions">
        <button class="q-reply-toggle" onclick="toggleReplies('${q.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
          <span id="reply-label-${q.id}">コメント</span>
        </button>
      </div>
      <div class="q-replies" id="replies-${q.id}">
        <div class="empty-state" style="padding:14px 0;">読み込み中...</div>
      </div>
    </div>
  `;
}

// ---------- コメント開閉 ----------
const _openedReplies = new Set();
const _repliesLoaded = new Set();

async function toggleReplies(qid){
  const box = document.getElementById('replies-'+qid);
  if(_openedReplies.has(qid)){
    _openedReplies.delete(qid);
    box.classList.remove('open');
    return;
  }
  _openedReplies.add(qid);
  box.classList.add('open');
  if(!_repliesLoaded.has(qid)){
    await loadReplies(qid);
  }
}

async function loadReplies(qid){
  const box = document.getElementById('replies-'+qid);
  const {data, error} = await _supabase
    .from('question_replies')
    .select('*')
    .eq('question_id', qid)
    .order('created_at', {ascending:true});

  if(error){
    box.innerHTML = `<div class="empty-state" style="padding:14px 0;">コメントの読み込みに失敗しました</div>`;
    return;
  }
  _repliesLoaded.add(qid);
  renderReplyBox(qid, data || []);
}

function renderReplyBox(qid, replies){
  const box = document.getElementById('replies-'+qid);
  const countLabel = document.getElementById('reply-label-'+qid);
  if(countLabel) countLabel.textContent = replies.length > 0 ? `コメント (${replies.length})` : 'コメント';

  const repliesHtml = replies.map(r => {
    const name = r.is_anonymous ? '匿名' : (r.author_name || '部員');
    const anonClass = r.is_anonymous ? 'anon' : '';
    return `
      <div class="q-reply-item">
        <div class="q-reply-body">
          <div class="q-reply-head">
            <div class="q-reply-author ${anonClass}">${escapeHtml(name)}</div>
            <div class="q-reply-time">${formatRelativeTime(r.created_at)}</div>
          </div>
          <div class="q-reply-text">${escapeHtml(r.content)}</div>
        </div>
      </div>
    `;
  }).join('');

  box.innerHTML = `
    ${repliesHtml || '<div style="font-size:11.5px;color:var(--text-dim);padding:4px 0 2px;">まだコメントはありません</div>'}
    <div class="q-reply-form">
      <div class="q-reply-input-row">
        <textarea class="q-reply-input" id="reply-input-${qid}" rows="1" placeholder="コメントする"></textarea>
        <button class="q-reply-send" onclick="submitReply('${qid}')" aria-label="送信">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>
        </button>
      </div>
      <label class="q-reply-toggle-anon">
        <input type="checkbox" id="reply-anon-${qid}" style="accent-color:var(--orange);">
        匿名でコメントする
      </label>
    </div>
  `;
}

async function submitReply(qid){
  const input = document.getElementById('reply-input-'+qid);
  const anonCheckbox = document.getElementById('reply-anon-'+qid);
  const content = input.value.trim();
  if(!content) return;

  const isAnon = anonCheckbox.checked;
  const {error} = await _supabase.from('question_replies').insert({
    question_id: qid,
    user_id: window.CURRENT_UID,
    is_anonymous: isAnon,
    author_name: isAnon ? null : _myName,
    content: content
  });

  if(error){
    alert('コメントの投稿に失敗しました: ' + error.message);
    return;
  }
  input.value = '';
  await loadReplies(qid);
}

// ---------- 質問投稿モーダル ----------
function openPostModal(){
  document.getElementById('post-content').value = '';
  document.getElementById('post-anon-toggle').checked = false;
  document.getElementById('post-error').classList.remove('show');
  document.getElementById('post-overlay').classList.add('open');
}
function closeModal(id){
  document.getElementById(id).classList.remove('open');
}
function closeOnOverlay(ev, id){
  if(ev.target.id === id) closeModal(id);
}

async function submitQuestion(){
  const content = document.getElementById('post-content').value.trim();
  const isAnon = document.getElementById('post-anon-toggle').checked;
  const errEl = document.getElementById('post-error');
  const btn = document.getElementById('post-submit-btn');
  errEl.classList.remove('show');

  if(!content){
    errEl.textContent = '質問の内容を入力してください';
    errEl.classList.add('show');
    return;
  }

  btn.disabled = true; btn.textContent = '投稿中...';
  const {error} = await _supabase.from('questions').insert({
    user_id: window.CURRENT_UID,
    is_anonymous: isAnon,
    author_name: isAnon ? null : _myName,
    content: content
  });
  btn.disabled = false; btn.textContent = '投稿する';

  if(error){
    errEl.textContent = '投稿に失敗しました: ' + error.message;
    errEl.classList.add('show');
    return;
  }
  closeModal('post-overlay');
  await loadQuestions();
}

// ---------- ユーティリティ ----------
function escapeHtml(str){
  if(str == null) return '';
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;');
}

function formatRelativeTime(isoString){
  if(!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if(diffMin < 1) return 'たった今';
  if(diffMin < 60) return `${diffMin}分前`;
  if(diffHour < 24) return `${diffHour}時間前`;
  if(diffDay < 7) return `${diffDay}日前`;
  return `${date.getMonth()+1}/${date.getDate()}`;
}
