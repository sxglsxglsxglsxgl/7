(function loadMainScript() {
  const existing = document.querySelector('script[data-proxy="main"]');
  if (existing) return;

  const script = document.createElement('script');
  script.src = './assets/main.js';
  script.defer = true;
  script.dataset.proxy = 'main';
  document.head.appendChild(script);
})();
