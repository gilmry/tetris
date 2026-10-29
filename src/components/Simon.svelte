<script lang="ts">
  import { onMount } from 'svelte';

  interface Pad {
    color: string;
    active: string;
    freq: number;
    emoji: string;
    label: string;
  }

  const PADS: Pad[] = [
    { color: '#c0392b', active: '#FF6B6B', freq: 329.63, emoji: '🍓', label: 'rouge' },
    { color: '#1e8449', active: '#98D8C8', freq: 392.0, emoji: '🍏', label: 'vert' },
    { color: '#1f618d', active: '#45B7D1', freq: 523.25, emoji: '🫐', label: 'bleu' },
    { color: '#b7950b', active: '#FFD93D', freq: 659.25, emoji: '🍋', label: 'jaune' }
  ];

  type Phase = 'idle' | 'showing' | 'input' | 'over';

  let phase: Phase = 'idle';
  let sequence: number[] = [];
  let inputIndex = 0;
  let activePad = -1;
  let level = 0;
  let best = 0;
  let audio: AudioContext | null = null;
  let timers: number[] = [];

  function later(fn: () => void, ms: number) {
    timers.push(window.setTimeout(fn, ms));
  }

  function clearTimers() {
    timers.forEach(t => clearTimeout(t));
    timers = [];
  }

  function ensureAudio() {
    if (audio) return;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    try {
      audio = new Ctor();
    } catch {
      audio = null;
    }
  }

  function beep(freq: number, ms: number) {
    if (!audio) return;
    try {
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000);
      osc.connect(gain).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + ms / 1000 + 0.05);
    } catch {
      // audio is a bonus; the game stays playable silently
    }
  }

  function flash(i: number, ms: number) {
    activePad = i;
    beep(PADS[i].freq, ms);
    later(() => { activePad = -1; }, ms);
  }

  function showSequence() {
    phase = 'showing';
    activePad = -1;
    const stepMs = Math.max(350, 700 - level * 25);
    sequence.forEach((pad, idx) => {
      later(() => flash(pad, stepMs * 0.6), 400 + idx * stepMs);
    });
    later(() => {
      phase = 'input';
      inputIndex = 0;
    }, 400 + sequence.length * stepMs);
  }

  function nextRound() {
    sequence = [...sequence, Math.floor(Math.random() * PADS.length)];
    level = sequence.length;
    showSequence();
  }

  function press(i: number) {
    if (phase !== 'input') return;
    ensureAudio();
    flash(i, 250);

    if (i !== sequence[inputIndex]) {
      phase = 'over';
      clearTimers();
      activePad = -1;
      beep(110, 500);
      if (level - 1 > best) best = level - 1;
      return;
    }

    inputIndex++;
    if (inputIndex === sequence.length) {
      phase = 'showing';
      later(nextRound, 700);
    }
  }

  function startGame() {
    ensureAudio();
    clearTimers();
    sequence = [];
    level = 0;
    inputIndex = 0;
    activePad = -1;
    nextRound();
  }

  function handleKeyDown(e: KeyboardEvent) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) press(n - 1);
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimers();
      if (audio) audio.close().catch(() => {});
    };
  });

  $: statusText =
    phase === 'showing' ? '👀 Regarde bien...' :
    phase === 'input' ? '👆 À toi !' :
    '';
</script>

<div class="game-container">
  <div class="game-info">
    <h1>🎵 Simon</h1>
    <div class="stats">
      <div class="stat">
        <span class="label">Niveau:</span>
        <span class="value">{level}</span>
      </div>
      <div class="stat">
        <span class="label">Record:</span>
        <span class="value">{best}</span>
      </div>
    </div>
  </div>

  <p class="status" aria-live="polite">{statusText}&nbsp;</p>

  <div class="pads" role="group" aria-label="Quatre boutons de couleur">
    {#each PADS as pad, i}
      <button
        class="pad"
        class:active={activePad === i}
        style="--pad-color: {pad.color}; --pad-active: {pad.active};"
        on:pointerdown={() => press(i)}
        disabled={phase !== 'input'}
        aria-label="Bouton {pad.label}"
      >
        <span class="pad-emoji" aria-hidden="true">{pad.emoji}</span>
      </button>
    {/each}
  </div>

  {#if phase === 'idle' || phase === 'over'}
    <div class="game-over-overlay">
      <div class="game-over-content" role="dialog" aria-labelledby="simon-status">
        <h2 id="simon-status">{phase === 'over' ? '😅 Raté!' : '🎵 Prêt à Jouer?'}</h2>
        {#if phase === 'over'}
          <p class="final-score">Niveau {level - 1}</p>
        {:else}
          <p class="hint">Regarde les couleurs s'allumer,<br>puis répète dans le même ordre !</p>
        {/if}
        <button
          class="start-button"
          on:click={startGame}
          aria-label={phase === 'over' ? 'Rejouer une partie' : 'Commencer une partie'}
        >
          {phase === 'over' ? '🔄 Rejouer' : '▶️ Commencer'}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .game-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    max-width: 600px;
    margin: 0 auto;
    font-family: 'Comic Sans MS', cursive, sans-serif;
  }

  .game-info {
    width: 100%;
    text-align: center;
  }

  h1 {
    font-size: 2.5rem;
    margin: 0 0 1rem 0;
    color: #FFD93D;
    text-shadow: 3px 3px 0px #FF6B6B;
  }

  .stats {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
    font-size: 1.5rem;
  }

  .stat {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 0.5rem 1.5rem;
    border-radius: 15px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  }

  .label {
    color: #fff;
    font-weight: bold;
  }

  .value {
    color: #FFD93D;
    font-weight: bold;
    margin-left: 0.5rem;
  }

  .status {
    color: #4ECDC4;
    font-size: 1.4rem;
    font-weight: bold;
    margin: 0;
    min-height: 1.6em;
  }

  .pads {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    width: 100%;
    max-width: 340px;
    padding: 1rem;
    background: #1a1a2e;
    border-radius: 30px;
    border: 4px solid #FFD93D;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  }

  .pad {
    aspect-ratio: 1;
    border: none;
    border-radius: 25px;
    background: var(--pad-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 -6px 0 rgba(0,0,0,0.3), 0 4px 15px rgba(0,0,0,0.3);
    transition: background 0.1s, transform 0.1s, box-shadow 0.1s;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    -webkit-user-select: none;
  }

  .pad:disabled {
    cursor: default;
    color: #000;
    opacity: 1;
  }

  .pad.active {
    background: var(--pad-active);
    transform: scale(0.96);
    box-shadow: inset 0 -2px 0 rgba(0,0,0,0.2), 0 0 30px var(--pad-active);
  }

  .pad-emoji {
    font-size: 3rem;
    opacity: 0.85;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
  }

  .game-over-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    pointer-events: none;
  }

  .game-over-content {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    padding: 2.5rem;
    border-radius: 25px;
    text-align: center;
    border: 4px solid #FFD93D;
    box-shadow: 0 10px 50px rgba(0,0,0,0.5);
    pointer-events: auto;
    max-width: 320px;
  }

  .game-over-content h2 {
    color: #FFD93D;
    font-size: 2.2rem;
    margin: 0 0 1rem 0;
  }

  .final-score {
    color: #4ECDC4;
    font-size: 2rem;
    margin: 0.5rem 0 1rem 0;
    font-weight: bold;
  }

  .hint {
    color: #fff;
    font-size: 1.1rem;
    margin: 0 0 1rem 0;
    line-height: 1.5;
  }

  .start-button {
    font-size: 1.5rem;
    padding: 1rem 2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 15px;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    transition: transform 0.2s;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    touch-action: manipulation;
  }

  .start-button:active {
    transform: scale(0.95);
  }

  @media (max-width: 600px) {
    .game-container {
      gap: 0.75rem;
      padding: 0.5rem;
    }

    h1 {
      font-size: 1.8rem;
      margin: 0 0 0.5rem 0;
    }

    .stats {
      font-size: 1.1rem;
      gap: 0.75rem;
    }

    .status {
      font-size: 1.2rem;
    }

    .pads {
      max-width: 300px;
      gap: 0.75rem;
    }

    .pad-emoji {
      font-size: 2.5rem;
    }
  }
</style>
