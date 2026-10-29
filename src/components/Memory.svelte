<script lang="ts">
  import { onMount } from 'svelte';

  const EMOJIS = ['🐶', '🐱', '🐸', '🦊', '🐼', '🦁', '🐵', '🐧'];

  interface Card {
    id: number;
    emoji: string;
    flipped: boolean;
    matched: boolean;
  }

  let cards: Card[] = [];
  let flippedIds: number[] = [];
  let moves = 0;
  let pairsFound = 0;
  let gameWon = false;
  let locked = false;
  let timer: number | null = null;

  function shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function initGame() {
    if (timer) clearTimeout(timer);
    cards = shuffle([...EMOJIS, ...EMOJIS]).map((emoji, id) => ({
      id,
      emoji,
      flipped: false,
      matched: false
    }));
    flippedIds = [];
    moves = 0;
    pairsFound = 0;
    gameWon = false;
    locked = false;
  }

  function flipCard(id: number) {
    if (locked || gameWon) return;
    const card = cards[id];
    if (card.flipped || card.matched) return;

    card.flipped = true;
    flippedIds = [...flippedIds, id];
    cards = cards;

    if (flippedIds.length === 2) {
      moves++;
      const [a, b] = flippedIds.map(i => cards[i]);

      if (a.emoji === b.emoji) {
        a.matched = true;
        b.matched = true;
        pairsFound++;
        flippedIds = [];
        cards = cards;
        if (pairsFound === EMOJIS.length) {
          gameWon = true;
        }
      } else {
        locked = true;
        timer = window.setTimeout(() => {
          a.flipped = false;
          b.flipped = false;
          flippedIds = [];
          locked = false;
          cards = cards;
        }, 800);
      }
    }
  }

  onMount(() => {
    initGame();
    return () => {
      if (timer) clearTimeout(timer);
    };
  });
</script>

<div class="game-container">
  <div class="game-header">
    <h1>🧠 Mémo</h1>
    <div class="stats">
      <div class="stat">
        <span class="label">Coups:</span>
        <span class="value">{moves}</span>
      </div>
      <div class="stat">
        <span class="label">Paires:</span>
        <span class="value">{pairsFound}/{EMOJIS.length}</span>
      </div>
    </div>
  </div>

  <div class="board" role="grid" aria-label="Plateau de jeu Mémo avec {cards.length} cartes">
    {#each cards as card (card.id)}
      <button
        class="card"
        class:flipped={card.flipped || card.matched}
        class:matched={card.matched}
        on:click={() => flipCard(card.id)}
        disabled={card.matched}
        aria-label={card.flipped || card.matched ? `Carte ${card.emoji}` : 'Carte cachée'}
      >
        <div class="card-inner">
          <div class="card-front">❓</div>
          <div class="card-back">{card.emoji}</div>
        </div>
      </button>
    {/each}
  </div>

  <button class="restart-btn" on:click={initGame} aria-label="Recommencer une partie">
    🔄 Recommencer
  </button>

  {#if gameWon}
    <div class="game-over-overlay">
      <div class="game-over-content" role="dialog" aria-labelledby="win-title">
        <h2 id="win-title">🎉 Bravo!</h2>
        <p class="final-score">Terminé en {moves} coups</p>
        <button class="restart-btn" on:click={initGame} aria-label="Rejouer une partie">
          🔄 Rejouer
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
    gap: 1.5rem;
    padding: 1rem;
    max-width: 600px;
    margin: 0 auto;
    font-family: 'Comic Sans MS', cursive, sans-serif;
  }

  .game-header {
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
    font-size: 1.3rem;
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

  .board {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    width: 100%;
    max-width: 360px;
  }

  .card {
    aspect-ratio: 1;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    perspective: 600px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .card:disabled {
    cursor: default;
    color: #000;
    opacity: 1;
  }

  .card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transition: transform 0.4s;
    transform-style: preserve-3d;
  }

  .card.flipped .card-inner {
    transform: rotateY(180deg);
  }

  .card-front,
  .card-back {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 15px;
    font-size: 2.5rem;
    backface-visibility: hidden;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  }

  .card-front {
    background: linear-gradient(135deg, #4ECDC4 0%, #45B7D1 100%);
  }

  .card-back {
    background: linear-gradient(135deg, #FFD93D 0%, #FFA500 100%);
    transform: rotateY(180deg);
  }

  .card.matched .card-back {
    background: linear-gradient(135deg, #98D8C8 0%, #4ECDC4 100%);
    animation: pop 0.4s ease-out;
  }

  @keyframes pop {
    0% { transform: rotateY(180deg) scale(1); }
    50% { transform: rotateY(180deg) scale(1.15); }
    100% { transform: rotateY(180deg) scale(1); }
  }

  .restart-btn {
    font-size: 1.3rem;
    padding: 0.75rem 2rem;
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

  .restart-btn:hover {
    transform: scale(1.05);
  }

  .restart-btn:active {
    transform: scale(0.95);
  }

  .game-over-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    pointer-events: none;
  }

  .game-over-content {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    padding: 3rem;
    border-radius: 25px;
    text-align: center;
    border: 4px solid #FFD93D;
    box-shadow: 0 10px 50px rgba(0,0,0,0.5);
    pointer-events: auto;
  }

  .game-over-content h2 {
    color: #FFD93D;
    font-size: 2.5rem;
    margin: 0 0 1rem 0;
  }

  .final-score {
    color: #4ECDC4;
    font-size: 1.8rem;
    margin: 1rem 0;
    font-weight: bold;
  }

  @media (max-width: 600px) {
    .game-container {
      gap: 1rem;
      padding: 0.5rem;
    }

    h1 {
      font-size: 1.8rem;
      margin: 0 0 0.5rem 0;
    }

    .stats {
      font-size: 1rem;
      gap: 0.75rem;
    }

    .board {
      max-width: 320px;
      gap: 0.5rem;
    }

    .card-front,
    .card-back {
      font-size: 2rem;
    }
  }
</style>
