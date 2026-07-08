// Bootstrap: wires DOM events to the engine and starts the initial database
// preload. This is the only file that should be reaching into raw DOM event
// handlers - everything else works through NameGame.State/UI/Engine.
(function(){
  const State = window.NameGame.State;
  const UI = window.NameGame.UI;
  const Engine = window.NameGame.Engine;
  const Database = window.NameGame.Database;
  const $ = UI.$;

  $('categoryPreset').onchange = () => {
    $('categoryInput').classList.toggle('hidden', $('categoryPreset').value !== 'Custom');
    if($('categoryPreset').value !== 'Custom') $('categoryInput').value = $('categoryPreset').value;
  };
  $('startBtn').onclick = () => Engine.startGame();
  $('submitBtn').onclick = () => Engine.submitAnswer();
  $('answerInput').addEventListener('keydown', e => { if(e.key === 'Enter') Engine.submitAnswer(); });
  $('skipBtn').onclick = () => Engine.giveStrike('Strike taken');
  $('pauseBtn').onclick = () => { State.paused = !State.paused; $('pauseBtn').textContent = State.paused ? 'RESUME' : 'PAUSE'; };
  $('settingsBtn').onclick = () => $('setupBox').classList.toggle('hidden');
  $('newBtn').onclick = () => { Engine.clearTurnTimers(); State.gameActive = false; $('setupBox').classList.remove('hidden'); };
  $('closeWinner').onclick = () => $('winnerModal').classList.add('hidden');
  $('winnerNew').onclick = () => location.reload();
  $('challengeBtn').onclick = () => {
    State.paused = true;
    $('pauseBtn').textContent = 'RESUME';
    const last = State.lastLogIndex !== null ? State.log[State.lastLogIndex] : null;
    $('challengeName').textContent = last ? 'Last answer: ' + last.celebrity + ' by ' + last.player : 'No answer to challenge yet.';
    $('challengeModal').classList.remove('hidden');
  };
  $('cancelChallenge').onclick = () => { $('challengeModal').classList.add('hidden'); };
  $('acceptChallenge').onclick = () => { $('challengeModal').classList.add('hidden'); State.paused = false; $('pauseBtn').textContent = 'PAUSE'; };
  $('rejectChallenge').onclick = () => { $('challengeModal').classList.add('hidden'); State.paused = false; $('pauseBtn').textContent = 'PAUSE'; Engine.rejectLastName(); };

  function buildPlayerInputs(){
    const c = Number(document.getElementById('playerCountSelect').value);
    const box = document.getElementById('playerInputs');
    let h = '';
    for(let i = 1; i <= c; i++) h += `<input placeholder="Player ${i}" value="Player ${i}" style="margin-bottom:8px">`;
    box.innerHTML = h;
  }
  buildPlayerInputs();
  document.getElementById('playerCountSelect').onchange = buildPlayerInputs;

  document.getElementById('launchGameBtn').onclick = () => {
    const names = [...document.querySelectorAll('#playerInputs input')].map(x => x.value.trim()).filter(Boolean);
    const aiCount = Number(document.getElementById('aiCountSelect').value);
    const aiPool = ['Atlas','Nova','Phoenix','Maverick','Titan','Rogue','Echo','Vega','Blaze','Onyx','Storm','Jinx','Rocket','Ace','Bolt','Falcon','Ghost','Havoc','Saber','Drift','Comet','Orbit','Shadow','Frost','Ember','Knox','Raven','Diesel','Bandit'];
    const shuffled = [...aiPool].sort(() => Math.random() - 0.5);
    for(let i = 0; i < aiCount; i++) names.push('[AI][' + Engine.rollAIDifficulty() + '] ' + shuffled[i]);
    document.getElementById('namesInput').value = names.join('\n');
    const chosenCat = document.getElementById('startCategory').value;
    document.getElementById('categoryPreset').value = chosenCat;
    State.gameCategory = chosenCat;
    document.getElementById('startScreen').style.display = 'none';
    Engine.startGame();
  };

  // Database preload. Game still works if fetch is blocked by file://, but large JSON
  // databases require a local server - unless this is the standalone dist build, which
  // has everything embedded and needs no network access at all.
  Database.loadAll().catch(e => console.warn('Database preload failed:', e));

  // Debug helpers (see README): NameDatabase.stats(), AIEngine.stats(), debugAI()
  window.debugAI = () => window.AIEngine ? AIEngine.stats() : null;
})();
