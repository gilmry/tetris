<script lang="ts">
  import Tetris from './Tetris.svelte';
  import BlockBlast from './BlockBlast.svelte';

  let selectedGame: 'menu' | 'tetris' | 'blockblast' = 'menu';

  function selectGame(game: 'tetris' | 'blockblast') {
    selectedGame = game;
  }

  function backToMenu() {
    selectedGame = 'menu';
  }
</script>

{#if selectedGame === 'menu'}
  <div class="menu-container">
    <h1 class="main-title">🎮 Jeux pour Enfants</h1>
    <p class="subtitle">Choisis ton jeu préféré !</p>

    <div class="game-cards">
      <button class="game-card tetris-card" on:click={() => selectGame('tetris')}>
        <div class="card-icon">🎯</div>
        <h2>Tetris</h2>
        <p>Empile les blocs qui tombent et fais des lignes !</p>
        <div class="play-button">▶️ Jouer</div>
      </button>

      <button class="game-card blockblast-card" on:click={() => selectGame('blockblast')}>
        <div class="card-icon">🧩</div>
        <h2>Block Blast</h2>
        <p>Glisse les blocs sur la grille et fais des combos !</p>
        <div class="play-button">▶️ Jouer</div>
      </button>
    </div>
  </div>
{:else if selectedGame === 'tetris'}
  <div class="game-wrapper">
    <button class="back-button" on:click={backToMenu}>
      ⬅️ Menu
    </button>
    <Tetris />
  </div>
{:else if selectedGame === 'blockblast'}
  <div class="game-wrapper">
    <button class="back-button" on:click={backToMenu}>
      ⬅️ Menu
    </button>
    <BlockBlast />
  </div>
{/if}

<style>
  .menu-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    text-align: center;
  }

  .main-title {
    font-size: 3rem;
    color: #FFD93D;
    text-shadow: 4px 4px 0px #FF6B6B;
    margin: 0 0 0.5rem 0;
    font-family: 'Comic Sans MS', cursive, sans-serif;
  }

  .subtitle {
    font-size: 1.5rem;
    color: #4ECDC4;
    margin: 0 0 3rem 0;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    font-weight: bold;
  }

  .game-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 2rem;
    max-width: 800px;
    width: 100%;
  }

  .game-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 25px;
    padding: 2rem;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    color: white;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    text-align: center;
  }

  .game-card:hover {
    transform: translateY(-10px) scale(1.05);
    box-shadow: 0 15px 40px rgba(0,0,0,0.4);
  }

  .game-card:active {
    transform: translateY(-5px) scale(1.02);
  }

  .tetris-card {
    background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
  }

  .blockblast-card {
    background: linear-gradient(135deg, #4ECDC4 0%, #45B7D1 100%);
  }

  .card-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .game-card h2 {
    font-size: 2rem;
    margin: 0 0 1rem 0;
    color: white;
  }

  .game-card p {
    font-size: 1.1rem;
    margin: 0 0 1.5rem 0;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.5;
  }

  .play-button {
    background: rgba(255, 255, 255, 0.3);
    padding: 1rem 2rem;
    border-radius: 15px;
    font-size: 1.3rem;
    font-weight: bold;
    display: inline-block;
    transition: all 0.2s;
  }

  .game-card:hover .play-button {
    background: rgba(255, 255, 255, 0.5);
    transform: scale(1.1);
  }

  .game-wrapper {
    position: relative;
    width: 100%;
  }

  .back-button {
    position: fixed;
    top: 1rem;
    left: 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 15px;
    padding: 0.75rem 1.5rem;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    transition: transform 0.2s;
    font-family: 'Comic Sans MS', cursive, sans-serif;
    z-index: 100;
  }

  .back-button:hover {
    transform: scale(1.05);
  }

  .back-button:active {
    transform: scale(0.95);
  }

  @media (max-width: 600px) {
    .main-title {
      font-size: 2rem;
    }

    .subtitle {
      font-size: 1.2rem;
    }

    .game-cards {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .game-card {
      padding: 1.5rem;
    }

    .card-icon {
      font-size: 3rem;
    }

    .game-card h2 {
      font-size: 1.5rem;
    }

    .game-card p {
      font-size: 1rem;
    }

    .back-button {
      padding: 0.5rem 1rem;
      font-size: 1rem;
    }
  }
</style>
