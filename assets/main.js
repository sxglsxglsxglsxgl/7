// assets/main.js
(function () {
  const root      = document.documentElement;
  const menuBtn   = document.getElementById('menuBtn');
  const infoPanel = document.getElementById('infoPanel');
  const infoCont  = infoPanel.querySelector('.info-content');
  const infoFit   = infoPanel.querySelector('.info-fit') || infoPanel;
  const wipe      = infoPanel.querySelector('.panel-wipe');

  // Параметры стадирования
  const OPEN_BASE = 160, OPEN_STEP = 95, OPEN_DUR = 1100;

  const easing = 'cubic-bezier(.16,1,.3,1)';

  let state = 'closed'; // 'opening' | 'open' | 'closing'
  let lineAnimations = []; // активные анимации строк
  let showPanelTimer = null;
  let closeTimer = null;
  let closeToken = 0;
  function collectLines() {
    const lines = [];
    const lead = infoCont.querySelector('.lead'); if (lead) lines.push(lead);
    infoCont.querySelectorAll('.roles span').forEach(n => lines.push(n));
    const founders = infoCont.querySelector('.founders'); if (founders) lines.push(founders);
    return lines;
  }

  // Автофит: чтобы контент помещался
  function fitInfo(){
    const s = getComputedStyle(infoPanel);
    const padTop = parseFloat(s.paddingTop);
    const padBottom = parseFloat(s.paddingBottom);
    const avail = infoPanel.clientHeight - padTop - padBottom;

    infoFit.style.transform = 'scale(1)';
    const need = infoFit.scrollHeight;

    let scale = 1;
    if (need > avail) scale = Math.max(0.75, avail / need);
    infoFit.style.transform = `scale(${scale})`;
  }

  function stopAllAnimations() {
    lineAnimations.forEach(a => { try { a.cancel(); } catch(e){} });
    lineAnimations = [];
    collectLines().forEach(el => {
      el.style.opacity = '';
      el.style.transform = '';
    });
    if (wipe) wipe.style.height = '0px';
  }

  async function animateOpenLines() {
    stopAllAnimations();
    const lines = collectLines();
    // форс-рефлоу, чтобы последующие анимации всегда стартовали
    infoCont.offsetHeight;

    lines.forEach((el, i) => {
      el.style.opacity = '0';
      const anim = el.animate(
        [
          { opacity: 0, transform: 'translateY(14px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        {
          duration: OPEN_DUR,
          delay: OPEN_BASE + i * OPEN_STEP,
          easing,
          fill: 'forwards'
        }
      );
      lineAnimations.push(anim);
    });

    // ждём последнюю
    const lastDelay = lines.length
      ? OPEN_BASE + (lines.length - 1) * OPEN_STEP
      : 0;
    await new Promise(res => setTimeout(res, lastDelay + OPEN_DUR));
  }

  function parseCssTimeToMs(value) {
    if (!value) return 0;
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const multiplier = trimmed.endsWith('ms') ? 1 : 1000;
    const numeric = parseFloat(trimmed);
    if (Number.isNaN(numeric)) return 0;
    return numeric * multiplier;
  }

  function getPanelFadeMs() {
    const styles = getComputedStyle(document.documentElement);
    const duration = parseCssTimeToMs(styles.getPropertyValue('--panel-duration'));
    const delay = parseCssTimeToMs(styles.getPropertyValue('--panel-delay-active'));
    return duration + delay;
  }

  function clearOpenTimers(){
    if (showPanelTimer !== null) {
      clearTimeout(showPanelTimer);
      showPanelTimer = null;
    }
  }

  function finalizeOpen(){
    if (state !== 'opening') return;

    root.classList.remove('panel-opening');
    state = 'open';
  }

  function applyScrollLock(lock){
    document.documentElement.style.overflow = lock ? 'hidden' : '';
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  function ensurePanelVisible(){
    infoPanel.setAttribute('aria-hidden','false');
    root.classList.add('panel-open');
    if (showPanelTimer !== null) {
      clearTimeout(showPanelTimer);
    }
    showPanelTimer = setTimeout(() => {
      showPanelTimer = null;
      requestAnimationFrame(fitInfo);
    }, 120);
  }

  function cancelClosing(){
    if (closeTimer !== null) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    closeToken += 1;
    root.classList.remove('panel-closing');
  }

  function openPanel() {
    if (state === 'open' || state === 'opening') return;

    if (state === 'closing') cancelClosing();

    state = 'opening';
    if (window.__freezeSafeAreas) window.__freezeSafeAreas();

    // слово уходит «в глубину», бургер → крест
    root.classList.add('panel-opening');
    menuBtn.classList.add('is-open');
    menuBtn.setAttribute('aria-expanded','true');

    ensurePanelVisible();
    applyScrollLock(true);

    animateOpenLines().then(finalizeOpen);
  }

  function finalizeClose(token){
    if (token !== closeToken) return;

    infoPanel.setAttribute('aria-hidden','true');
    applyScrollLock(false);
    root.classList.remove('panel-closing');

    if (window.__unfreezeSafeAreas) window.__unfreezeSafeAreas();

    state = 'closed';
    closeTimer = null;
  }

  function closePanel() {
    if (state === 'closed') return;
    if (state === 'closing') return;

    state = 'closing';
    clearOpenTimers();

    stopAllAnimations();
    root.classList.remove('panel-opening');
    root.classList.remove('panel-open');
    root.classList.add('panel-closing');

    menuBtn.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded','false');

    // форс-рефлоу, чтобы переход гарантированно стартовал
    infoPanel.offsetHeight;

    const token = closeToken += 1;
    const waitMs = getPanelFadeMs();

    if (waitMs <= 0) {
      finalizeClose(token);
      return;
    }

    closeTimer = setTimeout(() => finalizeClose(token), waitMs);
  }

  function togglePanel(){
    if (state === 'open' || state === 'opening') {
      closePanel();
    } else {
      openPanel();
    }
  }

  // Слушатели
  menuBtn.addEventListener('click', togglePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

  infoPanel.addEventListener('click', (e) => {
    const content = infoCont;
    if (e.target === e.currentTarget || !content.contains(e.target)) closePanel();
  });

  const fitIfOpen = () => { if (state === 'open') fitInfo(); };
  window.addEventListener('resize', fitIfOpen);
  if (window.visualViewport){
    window.visualViewport.addEventListener('resize', fitIfOpen, { passive:true });
  }

  // старт
  infoPanel.setAttribute('aria-hidden','true');
})();
