/* ===================================================================
   custom-links.js
   ホーム画面（表）／ポータル（裏）両方に反映される「項目を追加する」機能
   Supabaseの custom_links テーブルを使用
   =================================================================== */

const CUSTOM_LINK_SECTION_LABELS = {
  emergency: '救急医療',
  bls: 'BLS',
  disaster: '災害医療',
  community: '地域医療',
  other: 'その他'
};

let _addLinkSection = null;
let _currentUserId = null;
let _currentUserName = null;

/* ---------------------------------------------------------------
   一覧読み込み・描画
--------------------------------------------------------------- */
async function loadCustomLinks(){
  try{
    const { data, error } = await _supabase
      .from('custom_links')
      .select('*')
      .order('created_at', { ascending: true });
    if(error){ console.error('custom_links読み込みエラー', error); return; }
    (data || []).forEach(row => renderCustomLinkEverywhere(row));
  }catch(e){
    console.error('custom_links読み込み失敗', e);
  }
}

function renderCustomLinkEverywhere(row){
  // ホーム（表）側
  const frontGroup = document.querySelector(`.menu-group[data-section="${row.section}"]`);
  if(frontGroup){
    const addCard = frontGroup.querySelector('.menu-card.add-card');
    const frontCard = buildFrontCard(row);
    if(addCard) frontGroup.insertBefore(frontCard, addCard);
    else frontGroup.appendChild(frontCard);
  }

  // ポータル（裏）側
  const backList = document.querySelector(`.portal-card-list[data-section="${row.section}"]`);
  if(backList){
    const addCard = backList.querySelector('.portal-card.add-card');
    const backCard = buildBackCard(row);
    if(addCard) backList.insertBefore(backCard, addCard);
    else backList.appendChild(backCard);
  }
}

function buildFrontCard(row){
  const a = document.createElement('a');
  a.className = 'menu-card';
  a.href = row.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.dataset.linkId = row.id;
  a.style.position = 'relative';

  const icon = (row.icon && row.icon.trim()) ? row.icon.trim() : '🔗';
  const desc = row.description && row.description.trim() ? row.description.trim() : `追加：${row.added_by || '部員'}`;

  a.innerHTML = `
    <div class="menu-icon">${escapeHtml(icon)}</div>
    <div class="menu-body">
      <div class="menu-title">${escapeHtml(row.title)}</div>
      <div class="menu-desc">${escapeHtml(desc)}</div>
    </div>
    <svg class="menu-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  `;

  if(_currentUserId && row.added_by_id === _currentUserId){
    const delBtn = document.createElement('button');
    delBtn.className = 'menu-card-del';
    delBtn.setAttribute('aria-label', '削除');
    delBtn.innerHTML = '✕';
    delBtn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); deleteCustomLink(row.id); };
    a.appendChild(delBtn);
  }
  return a;
}

function buildBackCard(row){
  const a = document.createElement('a');
  a.className = 'portal-card';
  a.href = row.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.dataset.linkId = row.id;
  a.style.display = 'block';
  a.style.textDecoration = 'none';
  a.style.color = 'inherit';

  const icon = (row.icon && row.icon.trim()) ? row.icon.trim() : '🔗';
  const desc = row.description && row.description.trim() ? row.description.trim() : '部員が追加したリンクです。';

  a.innerHTML = `
    <div class="portal-card-head">
      <div class="portal-card-icon">${escapeHtml(icon)}</div>
      <div class="portal-card-title">${escapeHtml(row.title)}</div>
    </div>
    <div class="portal-card-desc">${escapeHtml(desc)}</div>
    <div style="margin-top:10px;font-size:10.5px;color:var(--text-dim);">追加：${escapeHtml(row.added_by || '部員')}</div>
  `;

  if(_currentUserId && row.added_by_id === _currentUserId){
    const delBtn = document.createElement('button');
    delBtn.className = 'portal-card-del';
    delBtn.setAttribute('aria-label', '削除');
    delBtn.innerHTML = '✕';
    delBtn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); deleteCustomLink(row.id); };
    a.appendChild(delBtn);
  }
  return a;
}

function escapeHtml(str){
  return String(str)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

/* ---------------------------------------------------------------
   追加モーダル
--------------------------------------------------------------- */
function openAddLinkModal(section){
  _addLinkSection = section;
  const label = CUSTOM_LINK_SECTION_LABELS[section] || section;
  document.getElementById('addlink-section-label').textContent = `「${label}」に項目を追加します。`;
  document.getElementById('addlink-title').value = '';
  document.getElementById('addlink-url').value = '';
  document.getElementById('addlink-icon').value = '';
  document.getElementById('addlink-desc').value = '';
  const err = document.getElementById('addlink-error');
  err.classList.remove('show'); err.textContent = '';
  document.getElementById('addlink-overlay').classList.add('open');
}
function closeAddLinkModal(){
  document.getElementById('addlink-overlay').classList.remove('open');
}
function closeAddLinkOnOverlay(e){
  if(e.target.id === 'addlink-overlay') closeAddLinkModal();
}

async function ensureCurrentUserName(){
  if(_currentUserName) return _currentUserName;
  try{
    const { data: { user } } = await _supabase.auth.getUser();
    if(!user) return null;
    _currentUserId = user.id;
    const { data: profile } = await _supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();
    _currentUserName = profile && profile.name ? profile.name : '部員';
    return _currentUserName;
  }catch(e){
    console.error('ユーザー名取得エラー', e);
    return null;
  }
}

async function submitAddLink(){
  const titleEl = document.getElementById('addlink-title');
  const urlEl = document.getElementById('addlink-url');
  const iconEl = document.getElementById('addlink-icon');
  const descEl = document.getElementById('addlink-desc');
  const errEl = document.getElementById('addlink-error');
  const btn = document.getElementById('addlink-submit-btn');

  const title = titleEl.value.trim();
  let url = urlEl.value.trim();

  errEl.classList.remove('show'); errEl.textContent = '';

  if(!title){ showAddLinkError('タイトルを入力してください'); return; }
  if(!url){ showAddLinkError('リンク先URLを入力してください'); return; }
  if(!/^https?:\/\//i.test(url)) url = 'https://' + url;

  btn.disabled = true; btn.textContent = '追加中...';

  try{
    const name = await ensureCurrentUserName();
    if(!_currentUserId){
      showAddLinkError('ログイン状態を確認できませんでした。再読み込みしてお試しください');
      return;
    }
    const { data, error } = await _supabase
      .from('custom_links')
      .insert({
        section: _addLinkSection,
        title: title,
        url: url,
        icon: iconEl.value.trim() || null,
        description: descEl.value.trim() || null,
        added_by: name,
        added_by_id: _currentUserId
      })
      .select()
      .single();

    if(error){ showAddLinkError('追加に失敗しました：' + error.message); return; }

    renderCustomLinkEverywhere(data);
    closeAddLinkModal();
  }catch(e){
    console.error(e);
    showAddLinkError('追加に失敗しました。通信環境をご確認ください');
  }finally{
    btn.disabled = false; btn.textContent = '追加する';
  }
}

function showAddLinkError(msg){
  const errEl = document.getElementById('addlink-error');
  errEl.textContent = msg;
  errEl.classList.add('show');
  const btn = document.getElementById('addlink-submit-btn');
  btn.disabled = false; btn.textContent = '追加する';
}

/* ---------------------------------------------------------------
   削除
--------------------------------------------------------------- */
async function deleteCustomLink(id){
  if(!confirm('この項目を削除します。よろしいですか？')) return;
  try{
    const { error } = await _supabase.from('custom_links').delete().eq('id', id);
    if(error){ alert('削除に失敗しました：' + error.message); return; }
    document.querySelectorAll(`[data-link-id="${id}"]`).forEach(el => el.remove());
  }catch(e){
    console.error(e);
    alert('削除に失敗しました');
  }
}

/* ---------------------------------------------------------------
   初期化
--------------------------------------------------------------- */
(async function initCustomLinks(){
  try{
    const { data: { user } } = await _supabase.auth.getUser();
    if(user) _currentUserId = user.id;
  }catch(e){ /* 未ログイン時は何もしない */ }
  loadCustomLinks();
})();
