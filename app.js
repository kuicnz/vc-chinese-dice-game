(() => {
  'use strict';

  const STORAGE_KEY = 'pocket-dice-v1';
  const words = {
    zh: {
      brand: '口袋骰盅', round: '当前局数', win: '赢', draw: '平', loss: '输',
      eyebrow: '朋友到齐，随时开局', arena: '你的专属骰盅',
      reroll: '重摇', confirm: '确定', outcome: '选择本局结果', slide: '滑动结束本局',
      sliderHelp: '向右拖动到底，或用方向键调整并按 End 键完成结算。',
      footer: '小小骰盅，大大快乐。', shake: '摇晃', stop: '停',
      soundOn: '音效开', soundOff: '音效关', soundLabel: '音效已', enabled: '开启', disabled: '关闭',
      theme: '主题', system: '跟随系统', light: '浅色', dark: '深色', nextTheme: '点击切换',
      scoreboard: '本局与战绩', dice: '五颗骰子', die: '骰子', points: '点',
      caption: '5 颗骰子 · 无限手气', resultCaption: '记住点数，藏好好运', done: '本局已结束 ✓',
      nextRound: '本局已记分，新一局开始。',
      ready: { title: '好手气，摇出来。', subtitle: '五颗骰子，一桌朋友。今晚看你的！', status: '准备就绪', hint: '点击摇晃，让好运开始转动' },
      shaking: { title: '好运，正在路上！', subtitle: '跟着感觉走，随时喊停。', status: '摇晃中', hint: '点击「停」，揭晓你的点数' },
      result: { title: '这把，手气如何？', subtitle: '不满意就重摇，准备好了就确定。', status: '等待确认', hint: '确定后锁定点数，和朋友开始对局' },
      locked: { title: '骰子落定，好戏开场。', subtitle: '藏好你的点数，轮到你出招了。', status: '点数已锁定', hint: '选好输赢，滑动结算；默认记为平局' },
    },
    en: {
      brand: 'Pocket Dice', round: 'ROUND', win: 'Win', draw: 'Draw', loss: 'Loss',
      eyebrow: 'GOOD FRIENDS. GOOD TIMES.', arena: 'YOUR POCKET DICE',
      reroll: 'Reroll', confirm: 'Confirm', outcome: 'Choose your result', slide: 'Slide to end round',
      sliderHelp: 'Drag all the way right, or use arrow keys and press End to finish the round.',
      footer: 'Little dice. Big good times.', shake: 'Shake', stop: 'Stop',
      soundOn: 'Sound on', soundOff: 'Sound off', soundLabel: 'Sound ', enabled: 'on', disabled: 'off',
      theme: 'Theme', system: 'System', light: 'Light', dark: 'Dark', nextTheme: 'click to change',
      scoreboard: 'Round and results', dice: 'Five dice', die: 'Die', points: '',
      caption: '5 DICE · ENDLESS LUCK', resultCaption: 'YOUR DICE, YOUR SECRET', done: 'Round complete ✓',
      nextRound: 'Result saved. A new round is ready.',
      ready: { title: 'Give luck a little shake.', subtitle: 'Five dice. A table of friends. Your move.', status: 'READY TO ROLL', hint: 'Tap Shake and let the good times roll' },
      shaking: { title: 'Good luck in motion.', subtitle: 'Trust your gut. Stop when it feels right.', status: 'SHAKING', hint: 'Tap Stop to reveal your dice' },
      result: { title: 'Feeling lucky?', subtitle: 'Roll again, or lock in your lucky five.', status: 'YOUR CALL', hint: 'Confirm your dice to start playing with friends' },
      locked: { title: 'Dice set. Game on.', subtitle: 'Keep your dice secret. Make your move.', status: 'DICE LOCKED', hint: 'Pick a result, then slide. Draw is the default.' },
    },
  };

  const $ = (selector) => document.querySelector(selector);
  const shell = $('.app-shell');
  const arena = $('#dice-arena');
  const slider = $('#round-slider');
  const thumb = $('#slider-thumb');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const faces = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { /* Storage is optional. */ }
  if (typeof stored !== 'object' || Array.isArray(stored)) stored = {};
  const validCount = (value) => Number.isSafeInteger(value) && value >= 0 && value < 1000000000 ? value : 0;
  const stats = { win: validCount(stored.stats?.win), draw: validCount(stored.stats?.draw), loss: validCount(stored.stats?.loss) };
  let language = stored.language === 'en' ? 'en' : 'zh';
  let theme = ['system', 'light', 'dark'].includes(stored.theme) ? stored.theme : 'system';
  let soundEnabled = stored.soundEnabled !== false;
  let dice = Array.isArray(stored.dice) && stored.dice.length === 5 && stored.dice.every((v) => Number.isInteger(v) && v >= 1 && v <= 6) ? stored.dice : [3, 1, 5, 4, 2];
  let state = ['result', 'locked'].includes(stored.state) && Array.isArray(stored.dice) && stored.dice.length === 5 && stored.dice.every((v) => Number.isInteger(v) && v >= 1 && v <= 6) ? stored.state : 'ready';
  let outcome = ['win', 'draw', 'loss'].includes(stored.outcome) && state === 'locked' ? stored.outcome : 'draw';
  let animationFrame = 0;
  let lastShake = 0;
  let audioContext;
  let noiseBuffer;
  let slideProgress = 0;
  let drag = null;
  let finishing = false;
  const activeSounds = new Set();

  const diceElements = Array.from({ length: 5 }, (_, i) => {
    const die = document.createElement('div');
    die.className = 'die';
    die.setAttribute('role', 'img');
    die.style.setProperty('--tilt', ['-10deg', '9deg', '-7deg', '5deg', '-9deg'][i]);
    const face = document.createElement('div');
    face.className = 'die-face';
    for (let position = 1; position <= 9; position++) {
      const pip = document.createElement('span');
      pip.className = 'pip';
      pip.dataset.position = position;
      face.append(pip);
    }
    die.append(face);
    $('#dice-group').append(die);
    return die;
  });

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ stats, language, theme, soundEnabled, dice, state: state === 'shaking' ? 'ready' : state, outcome })); } catch { /* Private browsing can disable persistence. */ }
  }

  function randomFace() {
    if (globalThis.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      do { crypto.getRandomValues(value); } while (value[0] >= 4294967292);
      return value[0] % 6 + 1;
    }
    return Math.floor(Math.random() * 6) + 1;
  }

  function drawDice() {
    diceElements.forEach((die, i) => {
      die.dataset.value = dice[i];
      die.setAttribute('aria-label', `${words[language].die} ${i + 1}: ${dice[i]} ${words[language].points}`.trim());
      Array.from(die.firstElementChild.children).forEach((pip, index) => pip.classList.toggle('is-visible', faces[dice[i]].includes(index + 1)));
    });
  }

  function updateTheme() {
    document.documentElement.dataset.theme = theme;
    const dark = theme === 'dark' || (theme === 'system' && systemTheme.matches);
    $('meta[name="theme-color"]').content = dark ? '#202632' : '#fff8e7';
    const icons = {
      system: '<path d="M4 4h16v12H4zM8 20h8M12 16v4"/>',
      light: '<path d="M9 9h6v6H9zM12 1v4M12 19v4M1 12h4M19 12h4M4 4l3 3M17 17l3 3M4 20l3-3M17 7l3-3"/>',
      dark: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',
    };
    $('#theme-toggle svg').innerHTML = icons[theme];
    $('#theme-toggle').dataset.theme = theme;
    const text = words[language];
    const label = `${text.theme}: ${text[theme]}, ${text.nextTheme}`;
    $('#theme-toggle').setAttribute('aria-label', label);
    $('#theme-toggle').title = label;
  }

  function updateSound() {
    const text = words[language];
    $('#sound-toggle').setAttribute('aria-pressed', String(soundEnabled));
    $('#sound-toggle').setAttribute('aria-label', text.soundLabel + (soundEnabled ? text.enabled : text.disabled));
    $('#sound-label').textContent = soundEnabled ? text.soundOn : text.soundOff;
    $('#sound-toggle svg').innerHTML = soundEnabled
      ? '<path d="M4 9h4l5-4v14l-5-4H4zM17 8c2 2 2 6 0 8M20 5c4 4 4 10 0 14"/>'
      : '<path d="M4 9h4l5-4v14l-5-4H4zM17 9l6 6M17 15l6-6"/>';
  }

  function render() {
    const text = words[language];
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = `${text.brand} · ${language === 'zh' ? 'Pocket Dice' : 'Roll with friends'}`;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = text[el.dataset.i18n]; });
    $('#headline').textContent = text[state].title;
    $('#subtitle').textContent = text[state].subtitle;
    $('#status-text').textContent = text[state].status;
    $('#hint').textContent = text[state].hint;
    $('#dice-caption').textContent = ['locked', 'result'].includes(state) ? text.resultCaption : text.caption;
    $('#shake-label').textContent = state === 'shaking' ? text.stop : text.shake;
    $('#shake-button').classList.toggle('is-stop', state === 'shaking');
    $('#ready-controls').hidden = !['ready', 'shaking'].includes(state);
    $('#result-controls').hidden = state !== 'result';
    $('#locked-controls').hidden = state !== 'locked';
    shell.dataset.state = state;
    arena.dataset.state = state;
    arena.classList.toggle('is-shaking', state === 'shaking');
    arena.classList.toggle('is-locked', state === 'locked');
    $('#round-count').textContent = String(stats.win + stats.draw + stats.loss + 1).padStart(2, '0');
    for (const key of ['win', 'draw', 'loss']) $(`#${key}-count`).textContent = String(stats[key]).padStart(2, '0');
    document.querySelectorAll('[name="outcome"]').forEach((radio) => { radio.checked = radio.value === outcome; });
    $('#scoreboard').setAttribute('aria-label', text.scoreboard);
    arena.setAttribute('aria-label', text.dice);
    $('#dice-group').setAttribute('aria-label', text.dice);
    thumb.setAttribute('aria-label', text.slide);
    $('#language-toggle').textContent = language === 'zh' ? 'EN' : '中';
    $('#language-toggle').setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换为中文');
    $('#language-toggle').title = $('#language-toggle').getAttribute('aria-label');
    updateTheme();
    updateSound();
    drawDice();
  }

  function ensureAudio() {
    if (!soundEnabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      if (!audioContext) {
        audioContext = new Audio();
        noiseBuffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * 0.06), audioContext.sampleRate);
        const samples = noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch { /* Dice still work without audio support. */ }
  }

  function trackSound(source) {
    activeSounds.add(source);
    source.onended = () => activeSounds.delete(source);
  }

  function clickSound(delay = 0, strong = false) {
    if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
    const now = audioContext.currentTime + delay;
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const volume = audioContext.createGain();
    source.buffer = noiseBuffer;
    source.playbackRate.value = 0.8 + Math.random() * 0.8;
    filter.type = 'bandpass';
    filter.frequency.value = 1000 + Math.random() * 1600;
    filter.Q.value = 0.7;
    volume.gain.setValueAtTime(strong ? 0.3 : 0.16, now);
    volume.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    source.connect(filter).connect(volume).connect(audioContext.destination);
    trackSound(source);
    source.start(now);
    source.stop(now + 0.06);
  }

  function melody(kind) {
    if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
    const notes = kind === 'win' ? [523.25, 659.25, 783.99, 1046.5] : kind === 'loss' ? [392, 329.63, 261.63] : kind === 'lock' ? [659.25, 880] : [523.25, 659.25, 523.25];
    notes.forEach((frequency, i) => {
      const start = audioContext.currentTime + i * 0.085;
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0, start);
      volume.gain.linearRampToValueAtTime(0.035, start + 0.006);
      volume.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      oscillator.connect(volume).connect(audioContext.destination);
      trackSound(oscillator);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  }

  function stopSounds() {
    activeSounds.forEach((source) => { try { source.stop(); } catch { /* Already ended. */ } });
    activeSounds.clear();
  }

  function shakeFrame(time) {
    if (state !== 'shaking') return;
    if (time - lastShake >= (reducedMotion.matches ? 180 : 65)) {
      dice = dice.map(randomFace);
      drawDice();
      diceElements.forEach((die) => {
        const movement = reducedMotion.matches ? 0 : 1;
        die.style.setProperty('--shake-x', `${(Math.random() - 0.5) * 22 * movement}px`);
        die.style.setProperty('--shake-y', `${(Math.random() - 0.5) * 26 * movement}px`);
        die.style.setProperty('--shake-r', `${(Math.random() - 0.5) * 44 * movement}deg`);
      });
      clickSound();
      lastShake = time;
    }
    animationFrame = requestAnimationFrame(shakeFrame);
  }

  function startShake() {
    if (!['ready', 'result'].includes(state)) return;
    ensureAudio();
    state = 'shaking';
    arena.classList.remove('is-settling');
    lastShake = -Infinity;
    render();
    save();
    animationFrame = requestAnimationFrame(shakeFrame);
    $('#announcement').textContent = words[language].shaking.status;
    $('#shake-button').focus({ preventScroll: true });
  }

  function stopShake() {
    if (state !== 'shaking') return;
    cancelAnimationFrame(animationFrame);
    dice = dice.map(randomFace);
    state = 'result';
    diceElements.forEach((die) => {
      die.style.setProperty('--shake-x', '0px');
      die.style.setProperty('--shake-y', '0px');
      die.style.setProperty('--shake-r', '0deg');
    });
    render();
    arena.classList.add('is-settling');
    clickSound(0, true);
    clickSound(0.075, true);
    clickSound(0.13, true);
    save();
    $('#announcement').textContent = `${words[language].result.status}: ${dice.join(', ')}`;
    if (!document.hidden) $('#confirm-button').focus({ preventScroll: true });
  }

  function confirmDice() {
    if (state !== 'result') return;
    ensureAudio();
    state = 'locked';
    outcome = 'draw';
    render();
    resetSlider();
    save();
    melody('lock');
    $('#announcement').textContent = words[language].locked.status;
    $('input[name="outcome"][value="draw"]').focus({ preventScroll: true });
  }

  function sliderDistance() {
    return Math.max(0, slider.clientWidth - thumb.offsetWidth - 8);
  }

  function setSlider(progress) {
    slideProgress = Math.min(1, Math.max(0, progress));
    slider.style.setProperty('--slide-x', `${slideProgress * sliderDistance()}px`);
    slider.style.setProperty('--slide-progress', String(slideProgress));
    thumb.setAttribute('aria-valuenow', String(Math.round(slideProgress * 100)));
    thumb.setAttribute('aria-valuetext', `${Math.round(slideProgress * 100)}%`);
  }

  function resetSlider() {
    drag = null;
    slider.classList.remove('is-dragging', 'is-complete');
    setSlider(0);
    $('#slider-label').textContent = words[language].slide;
  }

  function finishRound() {
    if (state !== 'locked' || finishing) return;
    finishing = true;
    drag = null;
    slider.classList.remove('is-dragging');
    slider.classList.add('is-complete');
    setSlider(1);
    $('#slider-label').textContent = words[language].done;
    ensureAudio();
    melody(outcome);
    const finalOutcome = outcome;
    window.setTimeout(() => {
      stats[finalOutcome] += 1;
      outcome = 'draw';
      state = 'ready';
      finishing = false;
      render();
      resetSlider();
      save();
      shell.classList.remove('celebration');
      void shell.offsetWidth;
      shell.classList.add('celebration');
      $('#announcement').textContent = words[language].nextRound;
      $('#shake-button').focus({ preventScroll: true });
    }, reducedMotion.matches ? 0 : 220);
  }

  $('#shake-button').addEventListener('click', () => state === 'shaking' ? stopShake() : startShake());
  $('#reroll-button').addEventListener('click', startShake);
  $('#confirm-button').addEventListener('click', confirmDice);
  $('#theme-toggle').addEventListener('click', () => {
    theme = ['system', 'light', 'dark'][(['system', 'light', 'dark'].indexOf(theme) + 1) % 3];
    updateTheme();
    save();
  });
  systemTheme.addEventListener('change', updateTheme);
  $('#language-toggle').addEventListener('click', () => {
    language = language === 'zh' ? 'en' : 'zh';
    render();
    if (finishing) $('#slider-label').textContent = words[language].done;
    save();
  });
  $('#sound-toggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (soundEnabled) { ensureAudio(); clickSound(); } else stopSounds();
    updateSound();
    save();
  });
  document.querySelectorAll('[name="outcome"]').forEach((radio) => radio.addEventListener('change', () => {
    if (state !== 'locked' || finishing) return;
    outcome = radio.value;
    ensureAudio();
    clickSound();
    save();
  }));

  thumb.addEventListener('pointerdown', (event) => {
    if (state !== 'locked' || finishing || event.button !== 0 || drag) return;
    event.preventDefault();
    ensureAudio();
    thumb.focus({ preventScroll: true });
    thumb.setPointerCapture(event.pointerId);
    drag = { pointerId: event.pointerId, start: event.clientX - slideProgress * sliderDistance() };
    slider.classList.add('is-dragging');
  });
  thumb.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId || finishing) return;
    setSlider((event.clientX - drag.start) / Math.max(1, sliderDistance()));
  });
  thumb.addEventListener('pointerup', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const complete = slideProgress >= 0.9;
    drag = null;
    if (thumb.hasPointerCapture(event.pointerId)) thumb.releasePointerCapture(event.pointerId);
    if (complete) finishRound(); else resetSlider();
  });
  const cancelDrag = () => { if (drag && !finishing) resetSlider(); };
  thumb.addEventListener('pointercancel', cancelDrag);
  thumb.addEventListener('lostpointercapture', cancelDrag);
  thumb.addEventListener('keydown', (event) => {
    if (state !== 'locked' || finishing) return;
    if (!['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    ensureAudio();
    if (['End', 'Enter', ' '].includes(event.key)) { finishRound(); return; }
    if (event.key === 'Home') resetSlider();
    else setSlider(slideProgress + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 0.1 : -0.1));
    if (slideProgress >= 0.999) finishRound();
  });
  window.addEventListener('resize', () => { if (!finishing) resetSlider(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopSounds();
      if (state === 'shaking') stopShake();
      if (audioContext?.state === 'running') audioContext.suspend().catch(() => {});
      if (!finishing) resetSlider();
    }
  });

  render();
  resetSlider();
})();
