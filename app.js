// ================================================================
// K-PICS ホームアプリ ロジック
// ================================================================
const REVIEWER_INVITE_CODE = 'KPICS-REVIEWER-2026';

// ---------- スプラッシュ ----------
const SPLASH_MIN_MS = 1200;
const _splashStart = Date.now();
function hideSplash(){
  const elapsed = Date.now() - _splashStart;
  const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
  setTimeout(()=>{
    document.getElementById('splash').classList.add('hide');
  }, wait);
}

// ---------- 認証タブ切り替え ----------
function switchAuthTab(tab){
  document.getElementById('form-login').style.display  = tab==='login'  ? 'block':'none';
  document.getElementById('form-signup').style.display = tab==='signup' ? 'block':'none';
  document.getElementById('tab-login').classList.toggle('active', tab==='login');
  document.getElementById('tab-signup').classList.toggle('active', tab==='signup');
  document.getElementById('login-error').classList.remove('show');
  document.getElementById('signup-error').classList.remove('show');
}

// ---------- ログイン ----------
async function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const password=document.getElementById('login-password').value;
  const errEl=document.getElementById('login-error');
  const btn=document.getElementById('login-btn');
  errEl.classList.remove('show');
  if(!email||!password){ errEl.textContent='メールアドレスとパスワードを入力してください'; errEl.classList.add('show'); return; }
  btn.disabled=true; btn.textContent='ログイン中...';
  const {error}=await _supabase.auth.signInWithPassword({email,password});
  btn.disabled=false; btn.textContent='ログイン';
  if(error){ errEl.textContent='メールアドレスまたはパスワードが間違っています'; errEl.classList.add('show'); }
}

// ---------- 新規登録 ----------
async function doSignup(){
  const name=document.getElementById('signup-name').value.trim();
  const year=parseInt(document.getElementById('signup-year').value);
  const email=document.getElementById('signup-email').value.trim();
  const password=document.getElementById('signup-password').value;
  const invite=document.getElementById('signup-invite').value.trim();
  const errEl=document.getElementById('signup-error');
  const btn=document.getElementById('signup-btn');
  errEl.classList.remove('show');
  if(!name||!email||!password){ errEl.textContent='名前・メールアドレス・パスワードは必須です'; errEl.classList.add('show'); return; }
  if(password.length<6){ errEl.textContent='パスワードは6文字以上にしてください'; errEl.classList.add('show'); return; }
  if(invite&&invite!==REVIEWER_INVITE_CODE){ errEl.textContent='招待コードが正しくありません'; errEl.classList.add('show'); return; }
  const role=(invite===REVIEWER_INVITE_CODE)?'reviewer':'member';
  btn.disabled=true; btn.textContent='登録中...';
  const {data,error}=await _supabase.auth.signUp({email,password});
  if(error){ btn.disabled=false; btn.textContent='登録する'; errEl.textContent='登録に失敗しました: '+error.message; errEl.classList.add('show'); return; }
  const uid=data.user.id;
  let pErr=null;
  for(let attempt=0;attempt<3;attempt++){
    if(attempt>0) await new Promise(r=>setTimeout(r,800));
    const {error:e}=await _supabase.from('profiles').upsert({id:uid,name,year:isNaN(year)?null:year,role},{onConflict:'id'});
    pErr=e;
    if(!pErr) break;
  }
  btn.disabled=false; btn.textContent='登録する';
  if(pErr){
    errEl.textContent=`プロフィール保存に失敗しました（${pErr.message}）。管理者に連絡してください。`;
    errEl.classList.add('show');
    return;
  }
}

// ---------- ログアウト ----------
async function doLogout(){
  await _supabase.auth.signOut();
  location.reload();
}

// ---------- 30分無操作で自動ログアウト ----------
let _idleTimer;
function resetIdleTimer(){
  clearTimeout(_idleTimer);
  _idleTimer=setTimeout(async()=>{
    await _supabase.auth.signOut();
    alert('30分間操作がなかったため、自動ログアウトしました。');
    location.reload();
  }, 30*60*1000);
}
['click','keydown','touchstart','scroll'].forEach(ev=>
  document.addEventListener(ev, resetIdleTimer, {passive:true})
);
resetIdleTimer();

// ---------- 認証状態の監視 ----------
window.CURRENT_UID  = null;
window.CURRENT_ROLE = 'member';

_supabase.auth.onAuthStateChange(async (event, session) => {
  if(session && session.user){
    const user = session.user;
    const {data:profile} = await _supabase.from('profiles').select('*').eq('id', user.id).single();
    const role = profile?.role || 'member';
    const name = profile?.name || user.email;
    const year = profile?.year || '';
    window.CURRENT_UID  = user.id;
    window.CURRENT_ROLE = role;

    document.getElementById('auth-screen').classList.remove('active');

    const avatarEl = document.getElementById('greet-avatar');
    const nameEl   = document.getElementById('greet-name');
    const subEl    = document.getElementById('greet-sub');
    if(avatarEl) avatarEl.textContent = name ? name[0] : '−';
    if(nameEl)   nameEl.textContent = name ? `こんにちは、${name} さん` : 'こんにちは';
    if(subEl)    subEl.textContent = `${year ? year+'年生 ・ ' : ''}${role==='reviewer' ? '確認者' : '部員'}`;

    document.getElementById('home-screen').classList.add('active');
    hideSplash();
    showInstallBannerIfNeeded();
  } else {
    window.CURRENT_UID = null;
    document.getElementById('home-screen').classList.remove('active');
    document.getElementById('auth-screen').classList.add('active');
    hideSplash();
  }
});

// 万一 Supabase からの応答が遅れた場合の保険（最大3秒でスプラッシュを閉じる）
setTimeout(hideSplash, 3000);

// ---------- PWA: ホーム画面に追加した時に正しく動くようにする ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  });
}

// ---------- ホーム画面に追加の案内バナー ----------
function isRunningStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function showInstallBannerIfNeeded(){
  if(isRunningStandalone()) return; // すでにアプリとして開いている場合は表示しない
  if(localStorage.getItem('kpics_install_banner_dismissed')==='1') return;

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  if(!isIOS && !isAndroid) return; // パソコンでは表示しない

  const descEl = document.getElementById('install-banner-desc');
  if(isIOS){
    descEl.textContent = '共有ボタン（□に↑）をタップ →「ホーム画面に追加」を選んでください';
  } else {
    descEl.textContent = '右上の「︙」メニューをタップ →「アプリをインストール」または「ホーム画面に追加」を選んでください';
  }
  document.getElementById('install-banner').style.display = 'flex';
}
function dismissInstallBanner(){
  document.getElementById('install-banner').style.display = 'none';
  localStorage.setItem('kpics_install_banner_dismissed', '1');
}
