# 67 THE REVENGER 🎮
> Turn-based RPG + Google Teachable Machine Pose Tracking

---

## ✅ Phase 1 — Project Scaffold
- [x] File structure: `index.html`, `style.css`, `script.js`
- [x] 8-bit UI layout (battle scene, HP bars, ult gauges, webcam preview, message log)
- [x] Responsive grid layout (camera | battle | sidebar)
- [x] Pixel-art styling with Press Start 2P + VT323 fonts

## ✅ Phase 2 — Teachable Machine + Webcam Integration
- [x] Load pose model from Teachable Machine URL
- [x] Webcam feed with mirror flip
- [x] Live confidence bars for all 5 classes (Default, Ready, Squat, Sage, Jump)
- [x] Skeleton overlay on webcam canvas
- [x] Start / Restart button controls

## ✅ Phase 3 — Pose Event Engine (Rep Detection)
- [x] `PoseEventEngine` — threshold + debounce system
  - Confidence threshold: 70%
  - Entry debounce: 6 frames
  - Exit debounce: 10 frames (anti-flicker)
- [x] Rep counting (rising-edge detection) for Squat & Jump
- [x] Hold-duration tracking for Sage (Tree Pose)
- [x] Ready pose detection → triggers countdown
- [x] Game phase state machine: `IDLE → WAIT_READY → COUNTDOWN → ACTION_WINDOW → RESOLVING`
- [x] Action Lock System — locks first detected action, only counts that action's reps
- [x] 10-second action window with countdown (3..2..1.. GO!)
- [x] Real-time UI updates (reps, hold time, countdown, action result)

## ✅ Phase 4 — Core Battle Data Model & Turn State Machine
- [x] Player/Boss data objects (HP, ult gauge, cooldowns, status flags)
- [x] Full turn system: Boss Turn → Player Turn (with skip-turn mechanic)
- [x] Passive +2 ult points at start of each turn
- [x] Damage/heal calculation wired to HP bars
- [x] Ult gauge fill + reset logic

## ✅ Phase 5 — Boss AI Logic (Implemented in Phase 4)
- [x] First Strike: Boss always attacks first
- [x] Normal Attack: 15 DMG, +7 ult
- [x] Tactical Skill (Debuff): Skip Player's turn, 3-turn cooldown, can't use turns 1-3, +15 ult
- [x] Ultimate: Auto-trigger at 67 ult, 30 DMG
- [x] Decision rules: cooldown-gated, gauge-triggered, fallback to normal

## ✅ Phase 6 — Player Action Resolution (Implemented in Phase 4)
- [x] Wire pose events → battle damage/heal
- [x] Ult bonus accrual per action (+5 ult per Squat)
- [x] Jump eligibility check (ult ≥ 67)
- [x] Player passive: +2 ult at turn start

## ✅ Phase 7 — UI Feedback & Juice
- [x] HP bar smooth animations
- [x] Floating damage numbers
- [x] Turn/countdown banners with effects
- [x] 8-bit sprite reactions (hit, heal, ultimate)
- [x] Battle log messages
- [x] Audio system with sound effects
- [x] Animation timing synced with sounds

### Sprites & Assets Integrated
- [x] 67man: Stand, Attack (6 frames), Damaged (10 frames), Heal (8 frames), ULT (7 frames)
- [x] Professor: Stand, Attack (8 frames), Damaged (7 frames), Debuff (6 frames), ULT (7 frames)
- [x] Background image
- [x] Boss ult gauge bar
- [x] SpriteAnimator class for frame-by-frame animation
- [x] Hit flash + shake effects
- [x] Floating damage/heal numbers

## ✅ Phase 8 — Story Intro Sequence
- [x] Text-based cutscene system (`CutscenePlayer` class)
- [x] 5 scenes: exam fail → elevator → portal → Professor slap → battle start
- [x] Auto-advance (3s per scene) + click anywhere to skip
- [x] `Startgame.mp3` plays during intro, BGM resumes after
- [x] Flash effects for dramatic moments (portal, battle start)
- [x] Professor slam-in animation (slap effect)
- [x] Full-screen overlay with fade transitions

## 🔲 Phase 9 — Win/Lose States & Polish
- [x] Victory / Defeat overlay screen with Play Again button
- [x] Game-over overlay styled with gold (victory) / crimson (defeat) themes
- [x] HP bar visible at 0 HP (min-width)
- [x] Sound effects (completed in Phase 7)
- [ ] Pose sensitivity tuning
- [ ] Edge-case handling

---

## 📝 Notes
- **Model URL**: `https://teachablemachine.withgoogle.com/models/USCwL4puN/`
- **Jumping Jack detection is unstable** — may need to retrain model with more diverse samples
- Camera set to `object-fit: cover` to fill the camera box
- Git version control active — commits on `main` branch

## 🎯 Game Stats
| Stat | Player (Student) | Boss (Professor) |
|------|-------------------|-------------------|
| Max HP | 100 | 150 |
| Ult Gauge Max | 67 | 67 |
| Passive | +2 ult/turn | +2 ult/turn |
| Normal Attack | 5 DMG/rep (Squat) | 15 DMG flat |
| Special | Heal 15-20 HP (Sage) | Skip Turn (3-turn CD) |
| Ultimate | 20 DMG/rep (Jump) | 30 DMG flat |

---

## 📋 Session Progress Log

### Session 1 — July 16, 2026
- Phase 1: Project scaffold (file structure, 8-bit UI, responsive grid, pixel-art fonts)
- Phase 2: Teachable Machine + webcam integration (pose model, webcam feed, confidence bars, skeleton overlay)
- Phase 3: Pose event engine (threshold/debounce, rep counting, hold tracking, action lock, 10s action window)

### Session 2 — August 21, 2026
- **Jump detection fix**: Reps now count on `pose_enter` (rising edge) instead of `pose_exit`, so continuous holds register reps properly

### Session 3 — August 21, 2026
- **Phase 7 completed**: UI Feedback & Juice
  - Added `AudioManager` class for sound loading and playback
  - Wired up all sound effects (player attacks, boss attacks, heals, ults, BGM, victory/defeat)
  - Slowed animation speed from 12 FPS to 8 FPS to sync with sounds
  - Removed purple portal effect from battle scene
  - Adjusted Professor sprite position (vertically centered)
  - Set player starting ult to 50 for testing
  - Added HP bar smooth animations (pulse + shake effects)
  - Added turn/countdown banner animations (pop-in, countdown pulse, GO! flash)
  - Added battle log in sidebar with color-coded entries
  - Added `updateBanner()` helper for animated banner text
  - Added `addLog()` helper for battle log entries
  - Updated HP bar UI to trigger pulse animation on damage/heal
- **Phase 4**: Core battle data model & turn state machine
  - `player` / `boss` data objects (HP, ult, cooldowns, status flags)
  - Full turn system: Boss Turn → Player Turn
  - Boss AI: normal attack, debuff (skip turn), ultimate (auto at 67 ult)
  - Passive +2 ult at start of each turn
  - Damage/heal calculation wired to HP bars and ult gauge
- **Phase 5**: Boss AI logic (implemented as part of Phase 4)
- **Phase 6**: Player action resolution (implemented as part of Phase 4)
  - Squat: 5 DMG/rep, +5 ult
  - Sage: 15-20 HP heal (hold ≥1s)
  - Jump: 20 DMG/rep (ult ≥67 gate), ult resets
- **Phase 7 (partial)**: Sprite & asset integration
  - Imported all character sprites (67man + Professor) and animations
  - Renamed animation frames to `frame-001.png` format
  - Replaced emoji sprites with `<img>` elements
  - Added `SpriteAnimator` class for frame-by-frame PNG animation (12 FPS)
  - Added background image to battle scene
  - Added boss ult gauge bar
  - Added hit flash + shake effects on damage
  - Added floating damage/heal/ult numbers
  - Victory/defeat trigger damaged animations

### Session 4 — August 22, 2026
- **Code review**: Identified 6 bugs (fragile action lock, restart race condition, debuff messaging, no game-over screen, invisible HP bar, debuff missing hit effect)
- **Bug fixes**: All 6 resolved and committed (`967fce6`)
  - Moved `tryLockAction` from UI code to pose event handler
  - Added `startTurnTimer` tracking to prevent stale timeouts on restart
  - Fixed debuff skip message in `startTurn()`
  - Added game-over overlay (victory/defeat) with Play Again button
  - Added `min-width: 2px` to HP fill bar
  - Added hit flash + sound callback to boss debuff animation
  - Removed duplicate `clamp()` function
  - Reset player ult from 50 (testing) to 0
- **Animation updates**: Pokémon-style blink/flicker + attack overlay
  - Added `triggerBlinkEffect()` for normal attack hits
  - Added `showAttackOverlay()` to show Professor_Attack frame-008 on 67man during normal attacks
  - Added `blinkFlicker` CSS keyframes (0.6s opacity flicker)
  - Added `attack-overlay` CSS for overlay image positioning
- **Phase 8 completed**: Story intro cutscene
  - Built `CutscenePlayer` class with 5 scenes
  - Text-based scenes using existing sprites
  - Auto-advance + click-to-skip
  - `Startgame.mp3` as cutscene BGM
  - Flash effects, slap animation, fade transitions

### What's Left
- Phase 9: Pose tuning, edge-case handling
