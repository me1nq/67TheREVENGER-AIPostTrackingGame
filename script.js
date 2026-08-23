/* =========================================================
   67 THE REVENGER — Boss Battle
   Webcam + Teachable Machine pose tracking,
   turn-based RPG with sprite animation, audio,
   cutscene system, and sensitivity controls.
   ========================================================= */

const MODEL_URL = "https://teachablemachine.withgoogle.com/models/USCwL4puN/";

/* =========================================================
   PHASE 7 — SPRITE ANIMATION SYSTEM
   Frame-by-frame animation for 67man and Professor
   ========================================================= */

const ANIM_FPS = 8; // frames per second for all sprite animations (slower to sync with sounds)

/* =========================================================
   AUDIO SYSTEM
   Loads and plays sound effects synced with animations
   ========================================================= */

class AudioManager {
  constructor() {
    this.sounds = {};
    this.durations = {}; // stored duration per sound (seconds)
    this.bgm = null;
    this.bgmPlaying = false;
  }

  /** Preload a sound file */
  load(name, src) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.src = src;
      audio.preload = 'auto';
      audio.addEventListener('canplaythrough', () => resolve(), { once: true });
      audio.addEventListener('error', () => resolve(), { once: true });
      // Store duration once metadata is available
      audio.addEventListener('loadedmetadata', () => {
        this.durations[name] = audio.duration;
      }, { once: true });
      this.sounds[name] = audio;
    });
  }

  /** Play a sound effect (non-blocking). Optional rate (default 1.0). */
  play(name, rate) {
    const audio = this.sounds[name];
    if (!audio) return;
    // Clone to allow overlapping sounds, but limit concurrent clones
    const clone = audio.cloneNode();
    clone.volume = 0.7;
    if (rate && rate !== 1) {
      clone.playbackRate = rate;
    }
    // Clean up clone after it finishes playing to prevent memory leak
    clone.addEventListener('ended', () => {
      clone.src = '';
    }, { once: true });
    clone.play().catch(() => {}); // ignore autoplay errors
  }

  /**
   * Play a sound after a delay, adjusting playbackRate so it ends
   * exactly when `fitDuration` ms have elapsed from the call.
   * Falls back to rate=1 if duration is unknown.
   */
  playTimed(name, delayMs, fitDurationMs) {
    const audio = this.sounds[name];
    if (!audio) return;
    const originalDuration = this.durations[name];
    let rate = 1;
    if (originalDuration && fitDurationMs > 0) {
      rate = (originalDuration * 1000) / fitDurationMs;
      rate = Math.max(0.25, Math.min(rate, 4)); // clamp to safe range
    }
    setTimeout(() => {
      const clone = audio.cloneNode();
      clone.volume = 0.7;
      clone.playbackRate = rate;
      clone.addEventListener('ended', () => {
        clone.src = '';
      }, { once: true });
      clone.play().catch(() => {});
    }, delayMs);
  }

  /** Start background music (loops) */
  playBGM(name) {
    if (this.bgmPlaying) return;
    this.bgm = this.sounds[name];
    if (!this.bgm) return;
    this.bgm.loop = true;
    this.bgm.volume = 0.3;
    this.bgm.play().catch(() => {});
    this.bgmPlaying = true;
  }

  /** Stop background music */
  stopBGM() {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.currentTime = 0;
    }
    this.bgmPlaying = false;
  }
}

const audio = new AudioManager();

/** Animation definitions: character → action → { folder, frames, loop } */
const ANIMATIONS = {
  player: {
    stand:    { folder: 'Asset/67MAN/', file: '67man_Stand.png', frames: 1, loop: false },
    attack:   { folder: 'Asset/67MAN/67man_Attack/', frames: 6, loop: false },
    damaged:  { folder: 'Asset/67MAN/67man_Damaged/', frames: 10, loop: false },
    heal:     { folder: 'Asset/67MAN/67man_Heal/', frames: 8, loop: false },
    ult:      { folder: 'Asset/67MAN/67man_ULT/', frames: 7, loop: false },
  },
  boss: {
    stand:    { folder: 'Asset/PROFESSOR/', file: 'Professor_Stand.png', frames: 1, loop: false },
    attack:   { folder: 'Asset/PROFESSOR/Professor_Attack/', frames: 7, loop: false },
    damaged:  { folder: 'Asset/PROFESSOR/Professor_Damaged/', frames: 7, loop: false },
    debuff:   { folder: 'Asset/PROFESSOR/Professor_Debuff/', frames: 6, loop: false },
    ult:      { folder: 'Asset/PROFESSOR/Professor_ULT/', frames: 7, loop: false },
  },
};

/** SpriteAnimator — plays frame-by-frame PNG sequences on an <img> element */
class SpriteAnimator {
  constructor(imgEl, charKey) {
    this.imgEl = imgEl;
    this.charKey = charKey; // 'player' or 'boss'
    this.frameCache = {};  // actionName → [Image, Image, ...]
    this.currentAction = 'stand';
    this.frameIndex = 0;
    this.timer = null;
    this.isPlaying = false;
    this.onFinish = null;
  }

  /** Preload all frames for a given action */
  preload(action) {
    const def = ANIMATIONS[this.charKey][action];
    if (!def) return Promise.resolve();
    if (this.frameCache[action]) return Promise.resolve();

    const promises = [];
    this.frameCache[action] = [];

    if (def.file) {
      // Single static image (stand)
      const img = new Image();
      img.src = def.folder + def.file;
      this.frameCache[action].push(img);
      promises.push(new Promise(r => { img.onload = r; img.onerror = r; }));
    } else {
      // Multi-frame animation
      for (let i = 1; i <= def.frames; i++) {
        const img = new Image();
        img.src = def.folder + `frame-${String(i).padStart(3, '0')}.png`;
        this.frameCache[action].push(img);
        promises.push(new Promise(r => { img.onload = r; img.onerror = r; }));
      }
    }
    return Promise.all(promises);
  }

  /** Preload all actions for this character */
  async preloadAll() {
    const actions = Object.keys(ANIMATIONS[this.charKey]);
    await Promise.all(actions.map(a => this.preload(a)));
  }

  /** Play an animation. Optional fps overrides ANIM_FPS. */
  play(action, onFinish, fps) {
    // If already playing this action, don't restart
    if (this.isPlaying && this.currentAction === action) return;

    this.stop();
    this.currentAction = action;
    this.frameIndex = 0;
    this.onFinish = onFinish || null;

    const def = ANIMATIONS[this.charKey][action];
    const frames = this.frameCache[action];
    if (!frames || frames.length === 0) return;

    this.isPlaying = true;
    this.imgEl.src = frames[0].src;

    if (frames.length === 1) {
      // Static image — just show it and finish
      this.isPlaying = false;
      if (this.onFinish) this.onFinish();
      return;
    }

    const interval = 1000 / (fps || ANIM_FPS);
    this.timer = setInterval(() => {
      this.frameIndex++;
      if (this.frameIndex >= frames.length) {
        if (def.loop) {
          this.frameIndex = 0;
        } else {
          this.stop();
          // Save callback before play('stand') overwrites onFinish
          const cb = this.onFinish;
          // Return to stand after animation completes
          this.play('stand');
          if (cb) cb();
          return;
        }
      }
      this.imgEl.src = frames[this.frameIndex].src;
    }, interval);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.isPlaying = false;
  }
}

let playerAnimator = null;
let bossAnimator = null;

/* =========================================================
   PHASE 8 — STORY INTRO CUTSCENE
   Text-based scenes using existing sprites
   ========================================================= */

const CUTSCENE_SCENES = [
  {
    sprite: 'Asset/67MAN/67man_Stand.png',
    text: 'You failed the exam...',
    bg: '#0a0a12',
    spriteStyle: 'opacity: 0.6; filter: grayscale(0.8) drop-shadow(0 0 10px rgba(0,0,0,0.8));',
  },
  {
    sprite: 'Asset/67MAN/67man_Stand.png',
    text: 'Desperate, you head to the elevator...',
    bg: '#0d1117',
    spriteStyle: '',
  },
  {
    sprite: '',
    text: '<span class="glow">A mysterious portal appears!</span>',
    bg: '#0d0520',
    spriteStyle: 'display: none;',
    flash: true,
  },
  {
    sprite: 'Asset/PROFESSOR/Professor_Stand.png',
    text: '<span class="highlight">The Professor blocks your escape!</span>',
    bg: '#1a0505',
    spriteStyle: 'max-height: 350px;',
    slap: true,
  },
  {
    sprite: '',
    text: '<span class="highlight">PREPARE FOR BATTLE!</span>',
    bg: '#000',
    spriteStyle: 'display: none;',
    flash: true,
  },
];

class CutscenePlayer {
  constructor() {
    this.overlay = document.getElementById('cutsceneOverlay');
    this.scene = document.getElementById('cutsceneScene');
    this.sprite = document.getElementById('cutsceneSprite');
    this.text = document.getElementById('cutsceneText');
    this.bg = document.getElementById('cutsceneBg');
    this.currentScene = 0;
    this.playing = false;
    this.sceneTimer = null;
    this.onFinish = null;

    // Click to skip
    this.overlay.addEventListener('click', () => this.skipCutscene());
  }

  /** Start the cutscene. Returns a Promise that resolves when done or skipped. */
  start(onFinish) {
    this.onFinish = onFinish || null;
    this.currentScene = 0;
    this.playing = true;
    this.overlay.classList.add('show');
    this.showScene(0);
    return new Promise(resolve => { this._resolve = resolve; });
  }

  showScene(index) {
    if (!this.playing || index >= CUTSCENE_SCENES.length) {
      this.finish();
      return;
    }

    const scene = CUTSCENE_SCENES[index];
    this.currentScene = index;

    // Fade out current scene
    this.scene.classList.remove('active');

    setTimeout(() => {
      // Update background
      this.bg.style.background = scene.bg;

      // Flash effect
      if (scene.flash) {
        this.bg.classList.remove('flash');
        void this.bg.offsetWidth;
        this.bg.classList.add('flash');
      }

      // Update sprite
      if (scene.sprite) {
        this.sprite.src = scene.sprite;
        this.sprite.style.display = '';
        this.sprite.style.cssText = scene.spriteStyle || '';
        this.sprite.classList.toggle('slap', !!scene.slap);
      } else {
        this.sprite.style.display = 'none';
      }

      // Update text
      this.text.innerHTML = scene.text;
      this.text.classList.remove('show');

      // Fade in scene
      setTimeout(() => {
        this.scene.classList.add('active');
        this.text.classList.add('show');
      }, 50);

      // Auto-advance after delay
      clearTimeout(this.sceneTimer);
      this.sceneTimer = setTimeout(() => {
        this.showScene(index + 1);
      }, 3000);
    }, 400);
  }

  skipCutscene() {
    if (!this.playing) return;
    this.finish();
  }

  finish() {
    this.playing = false;
    clearTimeout(this.sceneTimer);
    this.scene.classList.remove('active');
    this.text.classList.remove('show');

    setTimeout(() => {
      this.overlay.classList.remove('show');
      if (this.onFinish) this.onFinish();
      if (this._resolve) this._resolve();
    }, 500);
  }
}

const cutscene = new CutscenePlayer();

// --- DOM refs -------------------------------------------------
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const statusDot = document.getElementById('statusDot');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
const cameraFeed = document.getElementById('cameraFeed');
const turnBanner = document.getElementById('turnBanner');
const confFills = document.querySelectorAll('.conf-fill');

// --- TM / webcam state ------------------------------------------
let model = null;
let webcam = null;
let rafId = null;
let cameraOn = false;

/* =========================================================
   CAMERA / MODEL LIFECYCLE
   ========================================================= */

async function startCamera() {
  if (cameraOn) return;

  startBtn.disabled = true;
  setPlaceholderText('LOADING…', 'Fetching model + requesting camera access');

  try {
    // 1. Load the Teachable Machine pose model
    if (!model) {
      const modelURL = MODEL_URL + 'model.json';
      const metadataURL = MODEL_URL + 'metadata.json';
      model = await tmPose.load(modelURL, metadataURL);
    }

    // 2. Start the webcam.
    // flip=true mirrors the captured frames, matching how Teachable
    // Machine mirrors the webcam by default while you record training
    // samples — keeping this consistent matters for prediction accuracy.
    const size = 480;
    const flip = true;
    webcam = new tmPose.Webcam(size, size, flip);
    await webcam.setup();   // asks for camera permission
    await webcam.play();

    // 3. Mount the webcam's own canvas into our camera box
    webcam.canvas.classList.add('webcam-canvas');
    cameraFeed.innerHTML = '';
    cameraFeed.appendChild(webcam.canvas);

    cameraOn = true;
    cameraPlaceholder.style.display = 'none';

    statusDot.classList.remove('status-off');
    statusDot.classList.add('status-on');
    statusDot.title = 'Camera on';

    // Initialise the pose event engine
    poseEngine = createPoseEngine();
    poseEngine.init();

    // Initialise sprite animators
    playerAnimator = new SpriteAnimator(document.getElementById('playerSpriteImg'), 'player');
    bossAnimator = new SpriteAnimator(document.getElementById('bossSpriteImg'), 'boss');
    await Promise.all([playerAnimator.preloadAll(), bossAnimator.preloadAll()]);
    playerAnimator.play('stand');
    bossAnimator.play('stand');

    // Load all sound effects
    await Promise.all([
      audio.load('bgm', 'Asset/Sound/Background.mp3'),
      audio.load('startgame', 'Asset/Sound/Startgame.mp3'),
      audio.load('win', 'Asset/Sound/Win.mp3'),
      audio.load('lose', 'Asset/Sound/Lose.mp3'),
      audio.load('damaged', 'Asset/Sound/Damaged.mp3'),
      audio.load('playerAttack', 'Asset/Sound/67MAN/67man_Attack.mp3'),
      audio.load('playerHeal', 'Asset/Sound/67MAN/67man_Heal.mp3'),
      audio.load('playerUlt', 'Asset/Sound/67MAN/67man_ULT.mp3'),
      audio.load('bossAttack', 'Asset/Sound/PROFESSOR/Professor_Attack.mp3'),
      audio.load('bossDebuff', 'Asset/Sound/PROFESSOR/Professor_Debuff.mp3'),
      audio.load('bossUlt', 'Asset/Sound/PROFESSOR/Professor_ULT.mp3'),
    ]);

    // Play story intro cutscene, then start battle
    audio.stopBGM();
    audio.play('startgame');
    cutscene.start(() => {
      audio.playBGM('bgm');
      startTurn();
    });

    rafId = window.requestAnimationFrame(loop);
  } catch (err) {
    console.error('Camera/model init failed:', err);
    stopCamera();
    setPlaceholderText('CAMERA ERROR', errorMessage(err));
    startBtn.disabled = false;
  }
}

function stopCamera() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  if (webcam) {
    try { webcam.stop(); } catch (e) { /* already stopped */ }
  }
  webcam = null;
  cameraOn = false;

  cameraFeed.innerHTML = '';
  cameraPlaceholder.style.display = 'flex';
  setPlaceholderText('CAMERA OFF', 'Press Start to begin');

  statusDot.classList.remove('status-on');
  statusDot.classList.add('status-off');
  statusDot.title = 'Camera off';

  startBtn.disabled = false;

  confFills.forEach(el => {
    el.style.width = '0%';
    el.classList.remove('active');
  });
}

function setPlaceholderText(main, sub) {
  cameraPlaceholder.style.display = 'flex';
  cameraPlaceholder.querySelector('span').textContent = main;
  cameraPlaceholder.querySelector('small').textContent = sub;
}

function errorMessage(err) {
  if (err && err.name === 'NotAllowedError') {
    return 'Camera access was denied — allow it and press Start again';
  }
  if (err && err.name === 'NotFoundError') {
    return 'No camera found on this device';
  }
  return 'Could not load the model or camera — check the model URL and try again';
}

/* =========================================================
   PREDICTION LOOP
   ========================================================= */

async function loop() {
  try {
    webcam.update(); // pulls the latest frame into webcam.canvas
    await predict();
  } catch (err) {
    console.error('Prediction loop error:', err);
    // Edge case: camera disconnected mid-game
    if (!webcam || !webcam.canvas) {
      handleCameraDisconnect();
      return;
    }
  }
  rafId = window.requestAnimationFrame(loop);
}

/** Handle camera disconnect during gameplay */
function handleCameraDisconnect() {
  stopCamera();
  gamePhase = 'IDLE';

  // Show warning in camera box
  const warning = document.createElement('div');
  warning.className = 'camera-warning';
  warning.textContent = 'CAMERA DISCONNECTED';
  cameraFeed.appendChild(warning);
  cameraPlaceholder.style.display = 'none';

  // Pause battle
  clearTimeout(actionTimer);
  clearInterval(countdownTimer);
  clearTimeout(startTurnTimer);
  updateBanner('Camera lost! Press Restart', 'show');
  addLog('Camera disconnected!', 'damage');
}

async function predict() {
  const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
  const predictions = await model.predict(posenetOutput);

  updateConfidenceBars(predictions);

  try {
    drawSkeleton(pose); // best-effort visual overlay; core game logic never depends on this
  } catch (err) {
    console.error('drawSkeleton failed:', err);
  }

  // --- Phase 3: Pose Event Engine ---
  if (poseEngine) {
    const events = poseEngine.processFrame(predictions, performance.now());
    handlePoseEvents(events);
  }
}

function updateConfidenceBars(predictions) {
  // Find the top prediction for glow effect
  let topClass = '';
  let topProb = 0;
  predictions.forEach(p => {
    if (p.probability > topProb) {
      topProb = p.probability;
      topClass = p.className;
    }
  });

  predictions.forEach(p => {
    const bar = document.querySelector(`.conf-fill[data-class="${p.className}"]`);
    if (!bar) return;
    bar.style.width = `${Math.round(p.probability * 100)}%`;
    // Glow on the top-confidence pose
    if (p.className === topClass && topProb >= POSE_CONFIG.confidenceThreshold) {
      bar.classList.add('active');
    } else {
      bar.classList.remove('active');
    }
  });
}

// Standard PoseNet skeleton connections (pairs of body-part names)
const SKELETON_EDGES = [
  ['leftShoulder', 'rightShoulder'],
  ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'],
  ['leftShoulder', 'leftHip'], ['rightShoulder', 'rightHip'],
  ['leftHip', 'rightHip'],
  ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle'],
];

// Anything below this is treated as pure noise and skipped entirely.
// Everything else still draws — just faint if the score is low —
// instead of a hard on/off cutoff that could hide real data.
const NOISE_FLOOR = 0.05;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function drawSkeleton(pose) {
  const ctx = webcam.canvas.getContext('2d');
  if (!ctx) {
    console.error('[pose debug] webcam.canvas has no 2D context — cannot draw overlay.');
    return;
  }

  ctx.globalAlpha = 1;
  if (!pose || !pose.keypoints) return;

  const byPart = {};
  pose.keypoints.forEach(kp => { byPart[kp.part] = kp; });

  // lines first, so dots sit on top
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#c77dff'; // violet, matches the game's accent color
  SKELETON_EDGES.forEach(([a, b]) => {
    const kpA = byPart[a];
    const kpB = byPart[b];
    if (!kpA || !kpB) return;
    const avgScore = (kpA.score + kpB.score) / 2;
    if (avgScore < NOISE_FLOOR) return;
    ctx.globalAlpha = clamp(avgScore, 0.25, 1); // faint if low-confidence, solid if high
    ctx.beginPath();
    ctx.moveTo(kpA.position.x, kpA.position.y);
    ctx.lineTo(kpB.position.x, kpB.position.y);
    ctx.stroke();
  });

  // then the keypoint dots
  pose.keypoints.forEach(kp => {
    if (kp.score < NOISE_FLOOR) return;
    ctx.globalAlpha = clamp(kp.score, 0.25, 1);
    ctx.beginPath();
    ctx.arc(kp.position.x, kp.position.y, 7, 0, 2 * Math.PI);
    ctx.fillStyle = '#f4b400'; // gold, matches the ultimate gauge color
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#14121f';
    ctx.stroke();
  });

  ctx.globalAlpha = 1; // reset — otherwise next frame's video draw inherits this fade
}

/* =========================================================
   PHASE 3 — POSE EVENT ENGINE
   Converts raw per-frame predictions into clean discrete events:
   threshold + debounce for entering/exiting a pose,
   rep counting (rising-edge) for Squat / Jump,
   hold-duration tracking for Sage.
   ========================================================= */

const POSE_CONFIG = {
  confidenceThreshold: 0.70,   // minimum probability to consider a pose "active"
  debounceFrames: 6,           // consecutive frames above threshold to confirm entry
  exitFrames: 10,              // consecutive frames below threshold to confirm exit (wider = less flicker)
};

/* --- Sensitivity slider controls --- */
const SENS_DEFAULTS = { threshold: 70, debounce: 6, exit: 10 };

function initSensitivityControls() {
  const thresholdSlider = document.getElementById('sensThreshold');
  const debounceSlider = document.getElementById('sensDebounce');
  const exitSlider = document.getElementById('sensExit');
  const thresholdVal = document.getElementById('sensThresholdVal');
  const debounceVal = document.getElementById('sensDebounceVal');
  const exitVal = document.getElementById('sensExitVal');
  const resetBtn = document.getElementById('resetSensBtn');

  function applySliderValues() {
    POSE_CONFIG.confidenceThreshold = parseInt(thresholdSlider.value) / 100;
    thresholdVal.textContent = thresholdSlider.value + '%';
    POSE_CONFIG.debounceFrames = parseInt(debounceSlider.value);
    debounceVal.textContent = debounceSlider.value;
    POSE_CONFIG.exitFrames = parseInt(exitSlider.value);
    exitVal.textContent = exitSlider.value;
  }

  if (thresholdSlider) {
    thresholdSlider.addEventListener('input', applySliderValues);
  }
  if (debounceSlider) {
    debounceSlider.addEventListener('input', applySliderValues);
  }
  if (exitSlider) {
    exitSlider.addEventListener('input', applySliderValues);
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      thresholdSlider.value = SENS_DEFAULTS.threshold;
      debounceSlider.value = SENS_DEFAULTS.debounce;
      exitSlider.value = SENS_DEFAULTS.exit;
      applySliderValues();
    });
  }
}
initSensitivityControls();

/* --- Settings modal open/close --- */
(function initSettingsModal() {
  const overlay = document.getElementById('settingsOverlay');
  const openBtn = document.getElementById('settingsBtn');
  const closeBtn = document.getElementById('settingsClose');

  if (openBtn && overlay) {
    openBtn.addEventListener('click', () => overlay.classList.add('show'));
  }
  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', () => overlay.classList.remove('show'));
  }
  // Click backdrop to close
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('show');
    });
  }
})();

const ACTION_POSES = ['Squat', 'Sage', 'Jump'];

let poseEngine = null;   // created when camera starts
let actionLocked = false;
let lockedAction = null; // 'Squat' | 'Sage' | 'Jump' | null
let actionWindowStart = 0;
const ACTION_WINDOW_MS = 10000; // 10 seconds
const COUNTDOWN_MS = 3000;      // 3-second countdown
let countdownTimer = null;
let actionTimer = null;
let startTurnTimer = null;       // timeout for startTurn's boss-action delay

function createPoseEngine() {
  return {
    tracker: {},
    init() {
      ['Default', 'Ready', ...ACTION_POSES].forEach(name => {
        this.tracker[name] = {
          consecutiveAbove: 0,
          consecutiveBelow: 0,
          confirmedActive: false,
          reps: 0,
          holdStart: null,
          totalHoldTime: 0,
        };
      });
    },

    reset() {
      this.init();
    },

    /**
     * Process one frame of predictions. Returns an array of events.
     * Each event: { type, pose, timestamp, ... }
     *   type = 'pose_enter' | 'pose_exit' | 'rep'
     */
    processFrame(predictions, timestamp) {
      const events = [];

      predictions.forEach(p => {
        const state = this.tracker[p.className];
        if (!state) return;

        const above = p.probability >= POSE_CONFIG.confidenceThreshold;

        if (above) {
          state.consecutiveAbove++;
          state.consecutiveBelow = 0;
        } else {
          state.consecutiveBelow++;
          state.consecutiveAbove = 0;
        }

        // Entry confirmed
        if (!state.confirmedActive && state.consecutiveAbove >= POSE_CONFIG.debounceFrames) {
          state.confirmedActive = true;
          state.holdStart = timestamp;
          events.push({ type: 'pose_enter', pose: p.className, timestamp });

          // Count a rep on entry (rising edge) for action poses
          if (ACTION_POSES.includes(p.className)) {
            state.reps++;
            events.push({ type: 'rep', pose: p.className, repCount: state.reps, timestamp });
          }
        }

        // Exit confirmed
        if (state.confirmedActive && state.consecutiveBelow >= POSE_CONFIG.exitFrames) {
          state.confirmedActive = false;
          if (state.holdStart) {
            state.totalHoldTime += (timestamp - state.holdStart);
            state.holdStart = null;
          }          events.push({ type: 'pose_exit', pose: p.className, timestamp });
        }
      });

      return events;
    },

    /** Current live hold duration for a pose (ms) */
    getHoldTime(pose, now) {
      const s = this.tracker[pose];
      if (!s) return 0;
      let total = s.totalHoldTime;
      if (s.confirmedActive && s.holdStart) total += (now - s.holdStart);
      return total;
    },

    getReps(pose) {
      const s = this.tracker[pose];
      return s ? s.reps : 0;
    },
  };
}

/* ---------------------------------------------------------
   EVENT HANDLER — wires events to game state + UI
   --------------------------------------------------------- */

function handlePoseEvents(events) {
  events.forEach(ev => {
    if (ev.type === 'pose_enter' && ev.pose === 'Ready' && gamePhase === 'WAIT_READY') {
      startCountdown();
    }
    // Fix #1: Lock action on pose_enter during ACTION_WINDOW (moved from UI code)
    if (ev.type === 'pose_enter' && gamePhase === 'ACTION_WINDOW' && ACTION_POSES.includes(ev.pose)) {
      // Edge case: tie-breaking — if multiple poses enter same frame, pick highest confidence
      if (!actionLocked) {
        tryLockAction(ev.pose);
      }
    }
  });

  updatePoseDebugUI();
}

function startCountdown() {
  if (gamePhase !== 'WAIT_READY') return;
  gamePhase = 'COUNTDOWN';
  let count = 3;
  updateBanner(`${count}..`, 'countdown');
  addLog('Countdown started!', 'info');

  // Edge case: player already doing an action pose when countdown starts
  // Pre-lock it so action window picks it up immediately
  if (poseEngine) {
    ACTION_POSES.forEach(pose => {
      const s = poseEngine.tracker[pose];
      if (s && s.confirmedActive && !actionLocked) {
        if (pose === 'Jump' && player.ult < 67) return;
        tryLockAction(pose);
      }
    });
  }

  countdownTimer = setInterval(() => {
    count--;
    if (count > 0) {
      updateBanner(`${count}..`, 'countdown');
      audio.play('damaged'); // tick sound for countdown
    } else {
      clearInterval(countdownTimer);
      updateBanner('GO!', 'go');
      addLog('GO! Action window open!', 'buff');
      startActionWindow();
    }
  }, 1000);
}

function startActionWindow() {
  gamePhase = 'ACTION_WINDOW';
  actionWindowStart = performance.now();

  // If action was pre-locked during countdown, preserve its reps then reset cleanly
  const preLockedAction = actionLocked ? lockedAction : null;
  const preLockedReps = preLockedAction ? poseEngine.getReps(preLockedAction) : 0;

  poseEngine.reset();
  actionLocked = false;
  lockedAction = null;

  // Restore pre-locked reps so they aren't lost
  if (preLockedAction && preLockedReps > 0) {
    poseEngine.tracker[preLockedAction].reps = preLockedReps;
  }

  actionTimer = setTimeout(() => {
    resolveAction();
  }, ACTION_WINDOW_MS);
}

/* ---------------------------------------------------------
   ACTION LOCK — locks the first detected action type
   --------------------------------------------------------- */

function tryLockAction(pose) {
  if (actionLocked || !ACTION_POSES.includes(pose)) return;

  // Jump requires 67+ ult gauge
  if (pose === 'Jump' && player.ult < 67) return;

  actionLocked = true;
  lockedAction = pose;

  // Highlight the skill icon
  document.querySelectorAll('.skill-icon').forEach(el => el.classList.remove('active'));
  const iconMap = { Squat: 'iconSquat', Sage: 'iconSage', Jump: 'iconJump' };
  document.getElementById(iconMap[pose])?.classList.add('active');
}

/* =========================================================
   PHASE 4 — BATTLE DATA MODEL & TURN STATE MACHINE
   ========================================================= */

const player = {
  hp: 100,
  maxHp: 100,
  ult: 0,
  maxUlt: 67,
  passiveUlt: 2,        // +2 ult at start of each turn
};

const boss = {
  hp: 150,
  maxHp: 150,
  ult: 0,
  maxUlt: 67,
  passiveUlt: 2,        // +2 ult at start of each turn
  debuffCooldown: 0,    // turns remaining before debuff可用
  debuffMaxCooldown: 3, // 3-turn cooldown
  skipPlayerTurn: false, // set true when debuff is used
};

let turnNumber = 0;
let gamePhase = 'IDLE'; // IDLE | BOSS_TURN | WAIT_READY | COUNTDOWN | ACTION_WINDOW | RESOLVING

/* =========================================================
   BATTLE LOG
   ========================================================= */

const battleLogEl = document.getElementById('battleLog');
const MAX_LOG_ENTRIES = 20;

/** Add an entry to the battle log */
function addLog(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = message;
  battleLogEl.insertBefore(entry, battleLogEl.firstChild);
  
  // Limit log entries
  while (battleLogEl.children.length > MAX_LOG_ENTRIES) {
    battleLogEl.removeChild(battleLogEl.lastChild);
  }
}

/** Apply passive +2 ult at start of each turn */
function applyPassiveUlt() {
  player.ult = clamp(player.ult + player.passiveUlt, 0, player.maxUlt);
  boss.ult = clamp(boss.ult + boss.passiveUlt, 0, boss.maxUlt);
}

/** Apply damage to a target, returns actual damage dealt */
function applyDamage(target, amount) {
  const actual = Math.min(target.hp, amount);
  target.hp = clamp(target.hp - actual, 0, target.maxHp);
  return actual;
}

/** Apply heal to a target, returns actual HP restored */
function applyHeal(target, amount) {
  const before = target.hp;
  target.hp = clamp(target.hp + amount, 0, target.maxHp);
  return target.hp - before;
}

/** Update HP bar UI for player or boss */
function updateHpUI(who, triggerPulse = false) {
  const data = who === 'player' ? player : boss;
  const fillEl = document.getElementById(who === 'player' ? 'playerHpFill' : 'bossHpFill');
  const textEl = document.getElementById(who === 'player' ? 'playerHpText' : 'bossHpText');
  const trackEl = fillEl?.parentElement;
  
  if (fillEl) {
    fillEl.style.width = `${(data.hp / data.maxHp) * 100}%`;
    if (triggerPulse) {
      fillEl.classList.remove('pulse');
      void fillEl.offsetWidth; // Force reflow to restart animation
      fillEl.classList.add('pulse');
    }
  }
  if (textEl) textEl.textContent = `${data.hp}/${data.maxHp}`;
  
  if (trackEl && triggerPulse) {
    trackEl.classList.remove('shake');
    void trackEl.offsetWidth;
    trackEl.classList.add('shake');
  }
}

/** Update ult gauge UI */
function updateUltUI() {
  // Player ult
  const fillEl = document.getElementById('playerUltFill');
  const textEl = document.getElementById('playerUltText');
  if (fillEl) fillEl.style.width = `${(player.ult / player.maxUlt) * 100}%`;
  if (textEl) textEl.textContent = `${player.ult} / ${player.maxUlt}`;

  // Boss ult
  const bossFillEl = document.getElementById('bossUltFill');
  if (bossFillEl) bossFillEl.style.width = `${(boss.ult / boss.maxUlt) * 100}%`;
}

/** Update turn banner with animation */
function updateBanner(text, className = '') {
  turnBanner.classList.remove('show', 'countdown', 'go');
  turnBanner.textContent = text;
  if (className) {
    turnBanner.classList.add(className);
  } else {
    turnBanner.classList.add('show');
  }
}

/** Start a new turn */
function startTurn() {
  // Guard: don't start a new turn if the game is already over
  if (gamePhase === 'IDLE') return;
  turnNumber++;
  applyPassiveUlt();
  updateHpUI('player');
  updateHpUI('boss');
  updateUltUI();
  updateTurnCounter();
  updateDangerIndicator();

  // Boss attacks first
  gamePhase = 'BOSS_TURN';
  updateBanner("Boss's turn...", 'show');
  addLog(`Turn ${turnNumber} — Boss's turn`, 'info');

  startTurnTimer = setTimeout(() => {
    startTurnTimer = null;

    try {
      executeBossAction();
    } catch (err) {
      console.error('executeBossAction failed:', err);
    }

    updateHpUI('player');
    updateUltUI();

    // Check if player is dead
    if (player.hp <= 0) {
      gamePhase = 'IDLE';
      updateBanner('DEFEAT!', 'go');
      addLog('DEFEAT! You have been defeated!', 'damage');
      audio.stopBGM();
      audio.play('lose');
      if (playerAnimator) {
        playerAnimator.play('damaged', () => {
          showGameOver(false);
        });
      } else {
        showGameOver(false);
      }
      return;
    }

    // Auto-skip player turn when debuff is active (no T-pose needed)
    if (boss.skipPlayerTurn) {
      boss.skipPlayerTurn = false;
      gamePhase = 'RESOLVING';
      updateBanner('Turn skipped by debuff!', 'show');
      addLog('Turn skipped by debuff!', 'damage');
      showActionResult({ action: 'Skipped', reps: 0, holdTime: 0, dmg: 0, heal: 0 });
      setTimeout(() => {
        startTurn();
      }, 2000);
      return;
    }

    // Player's turn
    gamePhase = 'WAIT_READY';
    updateBanner('Your turn — T-pose Ready!', 'show');
    addLog('Your turn — T-pose Ready!', 'info');
  }, 1500); // 1.5s delay for boss action display
}

/** Show a floating damage/heal number above a sprite */
function showFloatNumber(who, text, type) {
  const wrapper = document.getElementById(who === 'player' ? 'playerSprite' : 'bossSprite');
  if (!wrapper) return;
  const el = document.createElement('div');
  el.className = `float-number ${type}`;
  el.textContent = text;
  el.style.left = '50%';
  el.style.top = '-10px';
  el.style.transform = 'translateX(-50%)';
  wrapper.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

/** Trigger hit flash + shake on a sprite */
function triggerHitEffect(who) {
  const wrapper = document.getElementById(who === 'player' ? 'playerSprite' : 'bossSprite');
  if (!wrapper) return;
  wrapper.classList.add('hit-flash', 'shake');
  setTimeout(() => wrapper.classList.remove('hit-flash', 'shake'), 300);
}

/** Pokémon-style blink/flicker on a sprite (for normal attacks) */
function triggerBlinkEffect(who) {
  const wrapper = document.getElementById(who === 'player' ? 'playerSprite' : 'bossSprite');
  if (!wrapper) return;
  const img = wrapper.querySelector('.sprite-img');
  if (!img) return;
  img.classList.remove('blink');
  void img.offsetWidth; // reflow to restart animation
  img.classList.add('blink');
  setTimeout(() => img.classList.remove('blink'), 600);
}


/** Show ULT screen dim overlay with spotlight on casting character */
function showUltOverlay(who) {
  const overlay = document.getElementById('ultOverlay');
  if (!overlay) return;
  overlay.classList.remove('ult-player', 'ult-boss');
  overlay.classList.add(who === 'player' ? 'ult-player' : 'ult-boss');
  overlay.classList.add('show');
  // Brief screen shake on the battle scene
  const scene = document.getElementById('battleScene');
  if (scene) {
    scene.classList.remove('ult-shake');
    void scene.offsetWidth;
    scene.classList.add('ult-shake');
    setTimeout(() => scene.classList.remove('ult-shake'), 500);
  }
}

/** Hide ULT screen dim overlay */
function hideUltOverlay() {
  const overlay = document.getElementById('ultOverlay');
  if (!overlay) return;
  overlay.classList.remove('show', 'ult-player', 'ult-boss');
}

/** Update turn counter badge */
function updateTurnCounter() {
  const el = document.getElementById('turnCounter');
  if (el) el.textContent = `TURN ${turnNumber}`;
}


/** Toggle low-HP danger indicator on player HP bar */
function updateDangerIndicator() {
  const hpBar = document.querySelector('.hp-bar.hp-player');
  if (!hpBar) return;
  if (player.hp <= 25 && player.hp > 0) {
    hpBar.classList.add('danger');
  } else {
    hpBar.classList.remove('danger');
  }
}

/** Boss AI — decides and executes an action */
function executeBossAction() {
  // Edge case: if boss debuff is active but ult is also ready, ultimate takes priority
  // (ultimate is more impactful and should not be wasted)

  // 1. Auto-trigger ultimate at 67 ult
  if (boss.ult >= boss.maxUlt) {
    boss.ult = 0;
    boss.debuffCooldown = Math.max(0, boss.debuffCooldown - 1);
    // If debuff was queued this turn, cancel it (ult overrides)
    if (boss.skipPlayerTurn) {
      boss.skipPlayerTurn = false;
      addLog('Professor ULT overrides debuff!', 'info');
    }
    const dmg = applyDamage(player, 30);
    updateBanner(`Professor uses ULTIMATE! -${dmg} DMG`, 'show');
    addLog(`Professor uses ULTIMATE! -${dmg} DMG`, 'damage');
    showUltOverlay('boss');
    audio.playTimed('bossUlt', 875, 875); // start at midpoint, fit into remaining 875ms
    bossAnimator.play('ult', () => {
      hideUltOverlay();
      audio.play('damaged');
      triggerHitEffect('player');
      playerAnimator.play('damaged');
      showFloatNumber('player', `-${dmg}`, 'dmg');
      updateHpUI('player', true); // Trigger HP bar pulse
      updateDangerIndicator();
    }, 4);
    return;
  }

  // 2. Tactical Skill (Debuff) — skip player's turn, 3-turn cooldown
  if (boss.debuffCooldown <= 0 && turnNumber > 3) {
    boss.debuffCooldown = boss.debuffMaxCooldown - 1; // -1 because it will also tick down at end of next normal turn
    boss.ult = clamp(boss.ult + 15, 0, boss.maxUlt);
    boss.skipPlayerTurn = true;
    updateBanner('Professor uses DEBUFF! Your turn skipped!', 'show');
    addLog('Professor uses DEBUFF! Your turn is skipped!', 'damage');
    audio.play('bossDebuff');
    bossAnimator.play('debuff', () => {
      audio.play('damaged');
      triggerHitEffect('player');
      triggerBlinkEffect('player');
      updateDangerIndicator();
    });
    return;
  }

  // 3. Normal Attack — 15 DMG, +7 ult
  boss.debuffCooldown = Math.max(0, boss.debuffCooldown - 1);
  const dmg = applyDamage(player, 15);
  boss.ult = clamp(boss.ult + 7, 0, boss.maxUlt);
  updateBanner(`Professor attacks! -${dmg} DMG`, 'show');
  addLog(`Professor attacks! -${dmg} DMG`, 'damage');
  audio.play('bossAttack');
  bossAnimator.play('attack', () => {
    audio.play('damaged');
    triggerHitEffect('player');
    triggerBlinkEffect('player');
    showFloatNumber('player', `-${dmg}`, 'dmg');
    updateHpUI('player', true);
    updateDangerIndicator();
  });
}

/** Resolve player action at end of action window */
function resolveAction() {
  // Edge case: if game already ended (e.g. boss died mid-ULT callback), bail out
  if (gamePhase === 'IDLE') return;

  gamePhase = 'RESOLVING';
  clearTimeout(actionTimer);
  clearInterval(countdownTimer);

  // Capture and clear action lock state
  const action = lockedAction;
  actionLocked = false;
  lockedAction = null;

  let result = { action: action || 'None', reps: 0, holdTime: 0, dmg: 0, heal: 0 };

  if (action) {
    result.reps = poseEngine.getReps(action);
    result.holdTime = poseEngine.getHoldTime(action, performance.now());

    if (action === 'Squat') {
      result.dmg = result.reps * 5;
      if (result.dmg > 0) {
        const actual = applyDamage(boss, result.dmg);
        result.dmg = actual;
        player.ult = clamp(player.ult + 5, 0, player.maxUlt);
        addLog(`67man uses Squat! ${result.reps} reps = ${actual} DMG`, 'damage');
        // Play attack animation + hit effects
        audio.play('playerAttack');
        playerAnimator.play('attack', () => {
          audio.play('damaged');
          triggerHitEffect('boss');
          triggerBlinkEffect('boss');
          showFloatNumber('boss', `-${actual}`, 'dmg');
          updateHpUI('boss', true);
        });
      } else {
        addLog('67man tries Squat but no reps detected!', 'info');
      }
    } else if (action === 'Sage') {
      result.heal = (result.holdTime >= 1000) ? Math.floor(Math.random() * 6) + 15 : 0;
      if (result.heal > 0) {
        result.heal = applyHeal(player, result.heal);
        addLog(`67man uses Sage! Healed ${result.heal} HP`, 'heal');
        // Play heal animation + heal number
        audio.play('playerHeal');
        playerAnimator.play('heal', () => {
          showFloatNumber('player', `+${result.heal}`, 'heal');
          updateHpUI('player', true); // Trigger HP bar pulse
        });
      } else {
        addLog('67man tries Sage but hold too short!', 'info');
      }
    } else if (action === 'Jump') {
      result.dmg = result.reps * 20;
      if (result.dmg > 0) {
        const actual = applyDamage(boss, result.dmg);
        result.dmg = actual;
        player.ult = 0;
        addLog(`67man uses ULTIMATE! ${result.reps} reps = ${actual} DMG`, 'buff');
        // Play ult animation + hit effects
        showUltOverlay('player');
        audio.playTimed('playerUlt', 875, 875); // start at midpoint, fit into remaining 875ms
        playerAnimator.play('ult', () => {
          hideUltOverlay();
          audio.play('damaged');
          triggerHitEffect('boss');
          bossAnimator.play('damaged');
          showFloatNumber('boss', `-${actual}`, 'ult');
          updateHpUI('boss', true); // Trigger HP bar pulse

          // Check if boss died from this ult (delay game-over to show animation)
          if (boss.hp <= 0) {
            gamePhase = 'IDLE';
            clearTimeout(startTurnTimer);
            updateBanner('VICTORY!', 'go');
            addLog('VICTORY! Professor has been defeated!', 'heal');
            audio.stopBGM();
            audio.play('win');
            showGameOver(true);
          }
        }, 4);
      } else {
        addLog('67man tries Jump but no reps detected!', 'info');
      }
    }
  } else {
    addLog('No action detected this turn!', 'info');
  }

  showActionResult(result);
  updateHpUI('boss');
  updateHpUI('player');
  updateUltUI();    // Check if boss died from non-Jump action (instant, no ULT animation to wait for)
    if (boss.hp <= 0) {
      gamePhase = 'IDLE';
      clearTimeout(startTurnTimer);
      updateBanner('VICTORY!', 'go');
      addLog('VICTORY! Professor has been defeated!', 'heal');
      audio.stopBGM();
      audio.play('win');
      bossAnimator.play('damaged', () => {
        showGameOver(true);
      });
      return;
    }

  updateBanner('Turn complete!', 'show');

  // Next turn after short delay
  setTimeout(() => {
    startTurn();
  }, 2500);
}

/* ---------------------------------------------------------
   UI HELPERS — debug + action result display
   --------------------------------------------------------- */

function updatePoseDebugUI() {
  if (!poseEngine) return;
  const now = performance.now();
  const actionPanel = document.getElementById('actionEmpty');
  const actionResult = document.getElementById('actionResult');

  // Show live state during action window
  if (gamePhase === 'ACTION_WINDOW' && poseEngine) {
    actionPanel.hidden = true;
    actionResult.hidden = false;

    const actionName = document.getElementById('actionName');
    const actionAccuracy = document.getElementById('actionAccuracy');
    const actionValue = document.getElementById('actionValue');
    const actionCombo = document.getElementById('actionCombo');

    if (lockedAction) {
      const reps = poseEngine.getReps(lockedAction);
      const hold = poseEngine.getHoldTime(lockedAction, now);
      const elapsed = Math.max(0, ACTION_WINDOW_MS - (now - actionWindowStart));
      const secs = Math.ceil(elapsed / 1000);

      actionName.textContent = lockedAction;
      actionAccuracy.textContent = `${secs}s left`;

      if (lockedAction === 'Sage') {
        actionValue.textContent = `Holding ${(hold / 1000).toFixed(1)}s`;
        actionCombo.textContent = reps > 0 ? `x${reps} release` : 'keep holding...';
      } else {
        actionValue.textContent = `${reps} reps`;
        actionCombo.textContent = lockedAction === 'Squat' ? `x${reps} combo = ${reps * 5} DMG` : `x${reps} combo = ${reps * 20} DMG`;
      }
    } else {
      actionName.textContent = 'Detecting...';
      actionAccuracy.textContent = '';
      const elapsed = Math.max(0, ACTION_WINDOW_MS - (now - actionWindowStart));
      const secs = Math.ceil(elapsed / 1000);
      actionValue.textContent = `${secs}s left`;
      actionCombo.textContent = 'Do Squat, Sage, or Jump!';
    }
  }
}

function showActionResult(result) {
  const actionPanel = document.getElementById('actionEmpty');
  const actionResult = document.getElementById('actionResult');
  actionPanel.hidden = true;
  actionResult.hidden = false;

  document.getElementById('actionName').textContent = result.action;
  document.getElementById('actionAccuracy').textContent = '';

  if (result.dmg > 0) {
    document.getElementById('actionValue').textContent = `${result.dmg} DMG`;
    document.getElementById('actionValue').style.color = 'var(--crimson-dark)';
  } else if (result.heal > 0) {
    document.getElementById('actionValue').textContent = `+${result.heal} HP`;
    document.getElementById('actionValue').style.color = '#2ecc71';
  } else {
    document.getElementById('actionValue').textContent = 'No action detected';
    document.getElementById('actionValue').style.color = 'var(--ink)';
  }

  document.getElementById('actionCombo').textContent =
    result.reps > 0 ? `x${result.reps} reps` : '';
}

/* =========================================================
   BUTTONS
   ========================================================= */

startBtn.addEventListener('click', startCamera);

restartBtn.addEventListener('click', () => {
  // Edge case: if cutscene is playing, stop it first
  if (cutscene && cutscene.playing) {
    cutscene.finish();
  }

  stopCamera();

  // Remove any camera disconnect warning
  const warning = document.querySelector('.camera-warning');
  if (warning) warning.remove();

  // Reset game state
  gamePhase = 'IDLE';
  actionLocked = false;
  lockedAction = null;
  poseEngine = null;
  turnNumber = 0;
  clearTimeout(actionTimer);
  clearTimeout(startTurnTimer);
  clearInterval(countdownTimer);
  startTurnTimer = null;

  // Stop animators
  if (playerAnimator) playerAnimator.stop();
  if (bossAnimator) bossAnimator.stop();
  playerAnimator = null;
  bossAnimator = null;

  // Reset sprite images
  const playerImg = document.getElementById('playerSpriteImg');
  const bossImg = document.getElementById('bossSpriteImg');
  if (playerImg) playerImg.src = 'Asset/67MAN/67man_Stand.png';
  if (bossImg) bossImg.src = 'Asset/PROFESSOR/Professor_Stand.png';

  // Reset player/boss stats
  player.hp = player.maxHp;
  player.ult = 0;
  boss.hp = boss.maxHp;
  boss.ult = 0;
  boss.debuffCooldown = 0;
  boss.skipPlayerTurn = false;

  turnBanner.textContent = "Boss's turn";
  turnBanner.classList.remove('show', 'countdown', 'go');
  updateHpUI('player');
  updateHpUI('boss');
  updateUltUI();

  // Reset turn counter and danger indicator
  const turnCounterEl = document.getElementById('turnCounter');
  if (turnCounterEl) turnCounterEl.textContent = 'TURN 1';
  const hpBar = document.querySelector('.hp-bar.hp-player');
  if (hpBar) hpBar.classList.remove('danger');

  document.getElementById('actionEmpty').hidden = false;
  document.getElementById('actionResult').hidden = true;

  document.querySelectorAll('.skill-icon').forEach(el => el.classList.remove('active'));

  // Clear battle log
  document.getElementById('battleLog').innerHTML = '';

  // Hide game-over overlay if visible
  const overlay = document.getElementById('gameOverOverlay');
  if (overlay) overlay.classList.remove('show');

  // Hide ULT overlay if visible
  hideUltOverlay();
});

/* =========================================================
   GAME OVER OVERLAY
   ========================================================= */

function showGameOver(isVictory) {
  const overlay = document.getElementById('gameOverOverlay');
  if (!overlay) return;
  const title = overlay.querySelector('.go-title');
  const sub = overlay.querySelector('.go-sub');
  if (title) title.textContent = isVictory ? 'VICTORY!' : 'DEFEAT!';
  if (sub) sub.textContent = isVictory
    ? 'Professor has been defeated!'
    : 'You have been defeated...';
  overlay.classList.toggle('go-victory', isVictory);
  overlay.classList.toggle('go-defeat', !isVictory);
  overlay.classList.add('show');
}
