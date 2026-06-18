// ================================================================
// K-PICS 認証ガード（資料・質問タブなど、サブページ共通）
// ================================================================
// このスクリプトがやること：
// 1. ログインしているか確認する
// 2. ログインしていなければ、自動的にホーム画面（index.html）に戻す
//    → index.html側でログイン画面が表示される
// 3. ログインしていれば、ページの中身をそのまま表示する
//
// index.html や calendar.html のような「ログイン画面そのものを持つページ」
// では使わない。app.js / calendar.js が別途、同じ役割を担っている。

(function(){
  // ページの中身を一旦隠しておき、ログイン確認が終わるまで見えないようにする
  document.documentElement.style.visibility = 'hidden';

  _supabase.auth.onAuthStateChange((event, session) => {
    if(session && session.user){
      // ログイン済み：ページを表示する
      window.CURRENT_UID = session.user.id;
      document.documentElement.style.visibility = 'visible';
    } else {
      // 未ログイン：ホーム画面に戻す（ホーム画面でログイン画面が出る）
      window.location.href = 'index.html';
    }
  });

  // 万一、確認が長引いた場合の保険（5秒後に強制的に表示する）
  setTimeout(()=>{
    document.documentElement.style.visibility = 'visible';
  }, 5000);
})();
