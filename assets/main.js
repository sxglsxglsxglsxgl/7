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
  const CLOSE_BASE = 0, CLOSE_STEP = 95, CLOSE_DUR = 1000;

  const easing = 'cubic-bezier(.16,1,.3,1)';

  let state = 'closed'; // 'opening' | 'open' | 'closing'
  let lineAnimations = []; // активные анимации строк
  let wipeAnimation = null;
  let transitionToken = 0; // для отмены завершения анимаций

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
    if (wipeAnimation) { try { wipeAnimation.cancel(); } catch(e){} wipeAnimation = null; }
  }

  async function animateOpenLines() {
    stopAllAnimations();
    const lines = collectLines();
    // форс-рефлоу, чтобы последующие анимации всегда стартовали
    infoCont.offsetHeight;

    lines.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.filter = 'none';
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
    const lastDelay = OPEN_BASE + (lines.length - 1) * OPEN_STEP;
    await new Promise(res => setTimeout(res, lastDelay + OPEN_DUR));
  }

  async function animateCloseLines() {
    stopAllAnimations();
    const lines = collectLines();
    // рефлоу
    infoCont.offsetHeight;

    // обратный порядок
    const n = lines.length;
    lines.forEach((el, i) => {
      el.style.opacity = '1';
      el.style.filter = 'none';
      const rev = n - 1 - i;
      const anim = el.animate(
        [
          { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' },
          { opacity: 0.6, transform: 'translateY(-6px)', filter: 'blur(2px)' },
          { opacity: 0, transform: 'translateY(-16px)', filter: 'blur(6px)' }
        ],
        {
          duration: CLOSE_DUR,
          delay: CLOSE_BASE + rev * CLOSE_STEP,
          easing: 'cubic-bezier(.22,.68,.17,1)',
          fill: 'forwards'
        }
      );
      lineAnimations.push(anim);
    });

    const lastDelay = CLOSE_BASE + (n - 1) * CLOSE_STEP;
    await new Promise(res => setTimeout(res, lastDelay + CLOSE_DUR));
  }

  function animateWipeUp() {
    if (!wipe) return Promise.resolve();
    if (wipeAnimation) { try { wipeAnimation.cancel(); } catch(e){} }

    wipe.style.height = '0px';
    // форс-рефлоу
    wipe.offsetHeight;

    wipeAnimation = wipe.animate(
      [{ height: '0px' }, { height: '100%' }],
      { duration: CLOSE_DUR, easing, fill: 'forwards' }
    );
    return wipeAnimation.finished.catch(() => {});
  }

  function resetWipe() {
    if (!wipe) return;
    if (wipeAnimation) { try { wipeAnimation.cancel(); } catch(e){} }
    wipe.style.height = '0px';
  }

  async function openPanel() {
    if (state !== 'closed') return; // блокируем повторные клики
    state = 'opening';
    const token = ++transitionToken;
    if (window.__freezeSafeAreas) window.__freezeSafeAreas();

    // слово уходит «в глубину», бургер → крест
    root.classList.add('panel-opening');
    menuBtn.classList.add('is-open');
    menuBtn.setAttribute('aria-expanded','true');

    // показываем панель чуть позже слова
    setTimeout(() => {
      infoPanel.setAttribute('aria-hidden','false');
      requestAnimationFrame(fitInfo);
    }, 120);

    await animateOpenLines();

    if (state !== 'opening' || token !== transitionToken) return; // могли закрыть во время открытия

    // фиксация состояния
    root.classList.remove('panel-opening');
    root.classList.add('panel-open');

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    state = 'open';
  }

  async function closePanel() {
    if (state === 'closed' || state === 'closing') return; // чтобы не требовалось два клика

    state = 'closing';
    transitionToken++;

    root.classList.add('panel-closing');
    root.classList.remove('panel-open');
    root.classList.remove('panel-opening');

    menuBtn.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded','false');

    // параллельно: строки вверх + шторка снизу
    await Promise.all([ animateCloseLines(), animateWipeUp() ]);

    // скрываем панель только ПОСЛЕ анимаций
    infoPanel.setAttribute('aria-hidden','true');

    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';

    root.classList.remove('panel-closing');
    resetWipe();

    if (window.__unfreezeSafeAreas) window.__unfreezeSafeAreas();

    state = 'closed';
  }

  function togglePanel(){
    if (state === 'closed') openPanel();
    else if (state === 'open' || state === 'opening') closePanel();
    // если opening/closing — игнор, клики не принимаем
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
