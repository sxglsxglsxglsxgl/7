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
  let closePromise = null;
  let closeToken = null;
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

  async function waitForPanelFade() {
    const styles = getComputedStyle(document.documentElement);
    const duration = parseCssTimeToMs(styles.getPropertyValue('--panel-duration'));
    const delay = parseCssTimeToMs(styles.getPropertyValue('--panel-delay-active'));
    const total = duration + delay;
    if (total <= 0) return;
    await new Promise(res => setTimeout(res, total));
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
    root.classList.add('panel-open');

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    state = 'open';
  }

  function openPanel() {
    if (state !== 'closed') return; // блокируем повторные клики
    state = 'opening';
    if (window.__freezeSafeAreas) window.__freezeSafeAreas();

    // слово уходит «в глубину», бургер → крест
    root.classList.add('panel-opening');
    menuBtn.classList.add('is-open');
    menuBtn.setAttribute('aria-expanded','true');

    // показываем панель чуть позже слова
    showPanelTimer = setTimeout(() => {
      showPanelTimer = null;
      infoPanel.setAttribute('aria-hidden','false');
      requestAnimationFrame(fitInfo);
    }, 120);

    animateOpenLines().then(finalizeOpen);
  }

  async function closePanel() {
    if (state === 'closed') return;
    if (state === 'closing') return closePromise;
    state = 'closing';
    clearOpenTimers();

    stopAllAnimations();
    root.classList.remove('panel-opening');
    root.classList.add('panel-closing');

    const hadOpenClass = root.classList.contains('panel-open');
    if (hadOpenClass) {
      root.classList.remove('panel-open');
    }

    menuBtn.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded','false');

    // форс-рефлоу, чтобы переход гарантированно стартовал
    infoPanel.offsetHeight;

    const token = Symbol('close');
    closeToken = token;

    const finishClose = (async () => {
      await waitForPanelFade();

      if (closeToken !== token) {
        if (closePromise === finishClose) closePromise = null;
        return;
      }

      // скрываем панель только ПОСЛЕ анимаций
      infoPanel.setAttribute('aria-hidden','true');

      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';

      root.classList.remove('panel-closing');

      if (window.__unfreezeSafeAreas) window.__unfreezeSafeAreas();

      state = 'closed';
      closeToken = null;
      closePromise = null;

    })();

    closePromise = finishClose;

    return finishClose;
  }

  function interruptCloseAndReopen(){
    if (state !== 'closing') return;

    closeToken = null;

    if (closePromise) {
      closePromise = null;
    }

    root.classList.remove('panel-closing');

    state = 'closed';

    openPanel();
  }

  function togglePanel(){
    if (state === 'closed') {
      openPanel();
    } else if (state === 'open' || state === 'opening') {
      closePanel();
    } else if (state === 'closing') {
      interruptCloseAndReopen();
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
