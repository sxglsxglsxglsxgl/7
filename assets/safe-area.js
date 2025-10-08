// assets/safe-area.js
(function () {
  const docEl = document.documentElement;

  function readCssNumber(name){
    const v = getComputedStyle(docEl).getPropertyValue(name).trim();
    const n = parseFloat(v);
    return Number.isNaN(n) ? 0 : n;
  }

  function updateSafeAreaVars() {
    const vv = window.visualViewport;
    let top = readCssNumber('--safe-top');
    let right = readCssNumber('--safe-right');
    let bottom = readCssNumber('--safe-bottom');
    let left = readCssNumber('--safe-left');

    let usableH = window.innerHeight;
    if (vv){
      const W = window.innerWidth;
      const H = window.innerHeight;
      const w = Math.round(vv.width);
      const h = Math.round(vv.height);
      const offT = Math.round(vv.offsetTop);
      const offL = Math.round(vv.offsetLeft);
      const vGap = Math.max(0, H - h);

      top = Math.max(top, offT);
      left = Math.max(left, offL);
      right = Math.max(right, Math.max(0, (W - w) - offL));
      bottom = Math.max(bottom, Math.max(0, vGap - offT));

      usableH = h;
    }

    const panelOpen = docEl.classList.contains('panel-open') ||
                      docEl.classList.contains('panel-opening') ||
                      docEl.classList.contains('panel-closing');

    if (!panelOpen){
      docEl.style.setProperty('--safe-top-active', `${top}px`);
      docEl.style.setProperty('--safe-right-active', `${right}px`);
      docEl.style.setProperty('--safe-bottom-active', `${bottom}px`);
      docEl.style.setProperty('--safe-left-active', `${left}px`);
    }

    docEl.style.setProperty('--vh-usable', `${usableH}px`);
  }

  ['resize','scroll','orientationchange'].forEach((eventName) => {
    window.addEventListener(eventName, updateSafeAreaVars, { passive: true });
  });
  if (window.visualViewport){
    ['resize','scroll'].forEach((eventName) => {
      window.visualViewport.addEventListener(eventName, updateSafeAreaVars, { passive: true });
    });
  }

  window.__freezeSafeAreas = function (){
    // просто перестаём обновлять активные переменные до unfreeze
  };
  window.__unfreezeSafeAreas = function (){
    updateSafeAreaVars();
  };

  updateSafeAreaVars();
})();
