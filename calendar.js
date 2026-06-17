// ================================================================
// K-PICS イベントカレンダー ロジック
// ================================================================

// ---------- スプラッシュ（短縮） ----------
setTimeout(()=>{ document.getElementById('splash').classList.add('hide'); }, 550);

// ---------- 認証ガード ----------
// このページに直接来た場合でもログイン状態を確認し、未ログインならホームへ戻す
let CURRENT_UID = null;
let CURRENT_USER_NAME = '';

_supabase.auth.onAuthStateChange((event, session)=>{
  if(session && session.user){
    CURRENT_UID = session.user.id;
    _supabase.from('profiles').select('name').eq('id', CURRENT_UID).single().then(({data})=>{
      CURRENT_USER_NAME = data?.name || session.user.email || '';
    });
  } else {
    location.href = 'index.html';
  }
});

// ---------- 状態 ----------
const MONTH_NAMES = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
let viewYear, viewMonth; // 0-indexed month
let EVENTS = []; // 全イベント {id,title,event_date,event_time,location,description,created_by,created_by_name}
let selectedDateStr = null;
let currentDetailId = null;
let editingId = null;

const today = new Date();
viewYear = today.getFullYear();
viewMonth = today.getMonth();

function pad2(n){ return String(n).padStart(2,'0'); }
function dateStr(y,m,d){ return `${y}-${pad2(m+1)}-${pad2(d)}`; }
function todayStr(){ const t=new Date(); return dateStr(t.getFullYear(),t.getMonth(),t.getDate()); }

// ---------- データ取得 ----------
async function loadEvents(){
  const {data, error} = await _supabase.from('events').select('*').order('event_date',{ascending:true});
  if(error){
    console.error(error);
    document.getElementById('agenda-list').innerHTML = `<div class="empty-state">読み込みに失敗しました<br>${error.message}</div>`;
    return;
  }
  EVENTS = data || [];
  renderCalendar();
  renderAgenda();
}

// ---------- カレンダー描画 ----------
function renderCalendar(){
  document.getElementById('month-label').textContent = `${viewYear} ${MONTH_NAMES[viewMonth]}`;
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const tStr = todayStr();

  for(let i=0;i<firstDow;i++){
    const empty = document.createElement('div');
    empty.className = 'cal-cell empty';
    grid.appendChild(empty);
  }

  for(let d=1; d<=daysInMonth; d++){
    const ds = dateStr(viewYear, viewMonth, d);
    const dayEvents = EVENTS.filter(e=>e.event_date===ds);
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if(ds===tStr) cell.classList.add('today');
    if(ds===selectedDateStr) cell.classList.add('selected');
    cell.onclick = ()=>selectDate(ds);

    let inner = `<div class="cal-daynum">${d}</div>`;
    if(dayEvents.length){
      const shown = dayEvents.slice(0,2);
      inner += shown.map(e=>`<div class="cal-evt-mini">${escapeHtml(e.title)}</div>`).join('');
      if(dayEvents.length>2){
        inner += `<div class="cal-evt-mini" style="opacity:.7;">+${dayEvents.length-2}件</div>`;
      }
    }
    cell.innerHTML = inner;
    grid.appendChild(cell);
  }
}

function selectDate(ds){
  selectedDateStr = (selectedDateStr===ds) ? null : ds;
  renderCalendar();
  renderAgenda();
}

function changeMonth(delta){
  viewMonth += delta;
  if(viewMonth<0){ viewMonth=11; viewYear--; }
  if(viewMonth>11){ viewMonth=0; viewYear++; }
  renderCalendar();
}
function goToday(){
  viewYear = today.getFullYear();
  viewMonth = today.getMonth();
  selectedDateStr = todayStr();
  renderCalendar();
  renderAgenda();
}

// ---------- アジェンダ描画 ----------
function renderAgenda(){
  const label = document.getElementById('agenda-label');
  const list = document.getElementById('agenda-list');

  let items;
  if(selectedDateStr){
    label.textContent = formatDateLabel(selectedDateStr) + ' の予定';
    items = EVENTS.filter(e=>e.event_date===selectedDateStr);
  } else {
    label.textContent = '今後の予定';
    const tStr = todayStr();
    items = EVENTS.filter(e=>e.event_date>=tStr).slice(0,20);
  }

  if(!items.length){
    list.innerHTML = `<div class="empty-state">予定はまだありません<br>右下の + ボタンから追加できます</div>`;
    return;
  }

  list.innerHTML = items.map(e=>{
    const d = new Date(e.event_date+'T00:00:00');
    return `
    <div class="evt-card" onclick="openDetail('${e.id}')">
      <div class="evt-date-chip">
        <div class="d">${d.getDate()}</div>
        <div class="m">${MONTH_NAMES[d.getMonth()]}</div>
      </div>
      <div class="evt-body">
        <div class="evt-title">${escapeHtml(e.title)}</div>
        <div class="evt-meta">
          ${e.event_time ? `<div class="evt-meta-item">🕐 ${escapeHtml(e.event_time)}</div>` : ''}
          ${e.location ? `<div class="evt-meta-item">📍 ${escapeHtml(e.location)}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function formatDateLabel(ds){
  const d = new Date(ds+'T00:00:00');
  const dow = ['日','月','火','水','木','金','土'][d.getDay()];
  return `${d.getMonth()+1}/${d.getDate()}（${dow}）`;
}

function escapeHtml(s){
  if(!s) return '';
  return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- 詳細モーダル ----------
function openDetail(id){
  const e = EVENTS.find(x=>x.id===id);
  if(!e) return;
  currentDetailId = id;
  document.getElementById('detail-title-h').textContent = e.title;
  const d = new Date(e.event_date+'T00:00:00');
  const dow = ['日','月','火','水','木','金','土'][d.getDay()];
  document.getElementById('detail-body').innerHTML = `
    <div class="detail-meta-row"><span class="ic">📅</span> ${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${dow}）</div>
    ${e.event_time ? `<div class="detail-meta-row"><span class="ic">🕐</span> ${escapeHtml(e.event_time)}</div>` : ''}
    ${e.location ? `<div class="detail-meta-row"><span class="ic">📍</span> ${escapeHtml(e.location)}</div>` : ''}
    ${e.description ? `<div class="detail-desc">${escapeHtml(e.description)}</div>` : ''}
    ${e.created_by_name ? `<div class="detail-created">登録: ${escapeHtml(e.created_by_name)}</div>` : ''}
  `;
  document.getElementById('detail-overlay').classList.add('open');
}

function closeModal(id){
  document.getElementById(id).classList.remove('open');
}
function closeOnOverlay(ev, id){
  if(ev.target.id===id) closeModal(id);
}

// ---------- 追加・編集モーダル ----------
function openCreateModal(){
  editingId = null;
  document.getElementById('form-title-h').textContent = 'イベントを追加';
  document.getElementById('f-title').value = '';
  document.getElementById('f-date').value = selectedDateStr || todayStr();
  document.getElementById('f-time').value = '';
  document.getElementById('f-location').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('form-error').classList.remove('show');
  document.getElementById('form-submit-btn').textContent = '保存する';
  document.getElementById('form-overlay').classList.add('open');
}

function openEditModal(id){
  const e = EVENTS.find(x=>x.id===id);
  if(!e) return;
  closeModal('detail-overlay');
  editingId = id;
  document.getElementById('form-title-h').textContent = 'イベントを編集';
  document.getElementById('f-title').value = e.title || '';
  document.getElementById('f-date').value = e.event_date || '';
  document.getElementById('f-time').value = e.event_time || '';
  document.getElementById('f-location').value = e.location || '';
  document.getElementById('f-desc').value = e.description || '';
  document.getElementById('form-error').classList.remove('show');
  document.getElementById('form-submit-btn').textContent = '更新する';
  document.getElementById('form-overlay').classList.add('open');
}

async function submitForm(){
  const title = document.getElementById('f-title').value.trim();
  const date = document.getElementById('f-date').value;
  const time = document.getElementById('f-time').value.trim();
  const location = document.getElementById('f-location').value.trim();
  const desc = document.getElementById('f-desc').value.trim();
  const errEl = document.getElementById('form-error');
  const btn = document.getElementById('form-submit-btn');
  errEl.classList.remove('show');

  if(!title || !date){
    errEl.textContent = 'イベント名と日付は必須です';
    errEl.classList.add('show');
    return;
  }

  btn.disabled = true; btn.textContent = '保存中...';

  const payload = {
    title, event_date: date, event_time: time || null,
    location: location || null, description: desc || null,
  };

  let error;
  if(editingId){
    ({error} = await _supabase.from('events').update(payload).eq('id', editingId));
  } else {
    payload.created_by = CURRENT_UID;
    payload.created_by_name = CURRENT_USER_NAME;
    ({error} = await _supabase.from('events').insert(payload));
  }

  btn.disabled = false; btn.textContent = editingId ? '更新する' : '保存する';

  if(error){
    errEl.textContent = '保存に失敗しました: ' + error.message;
    errEl.classList.add('show');
    return;
  }

  closeModal('form-overlay');
  await loadEvents();
}

async function confirmDelete(id){
  if(!confirm('このイベントを削除しますか？この操作は取り消せません。')) return;
  const {error} = await _supabase.from('events').delete().eq('id', id);
  if(error){ alert('削除に失敗しました: '+error.message); return; }
  closeModal('detail-overlay');
  await loadEvents();
}

// ---------- 初期化 ----------
selectedDateStr = null;
loadEvents();
