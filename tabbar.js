// ===================== 下部タブバー：現在地ハイライト =====================
// 各ページ（index.html / calendar.html / documents.html / questions.html）で
// 共通して読み込むスクリプト。今いるページに対応するタブだけ active にする。
(function(){
  var fileToTab = {
    'index.html': 'home',
    '': 'home', // ルート直下でindex.htmlが省略された場合
    'calendar.html': 'calendar',
    'documents.html': 'documents',
    'questions.html': 'questions'
  };

  function highlightCurrentTab(){
    var path = window.location.pathname.split('/').pop();
    var currentTab = fileToTab[path];
    if(!currentTab) return;

    var items = document.querySelectorAll('.tabbar-item');
    items.forEach(function(item){
      if(item.getAttribute('data-tab') === currentTab){
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', highlightCurrentTab);
  } else {
    highlightCurrentTab();
  }
})();
