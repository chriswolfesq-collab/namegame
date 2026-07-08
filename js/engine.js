// The turn engine: starting a game, taking a turn, validating an answer,
// handling strikes/reverses/battles, and driving AI turns. Mutates
// NameGame.State and calls NameGame.UI to render - this is the only module
// that's allowed to change game rules/state.
(function(){
  const State = window.NameGame.State;
  const UI = window.NameGame.UI;
  const Audio = window.NameGame.Audio;
  const Database = window.NameGame.Database;
  const Validator = window.NameGame.Validator;
  const Rules = window.NameGame.Rules;
  const $ = UI.$;

  function selectedCategory(){
    return State.gameCategory || 'Any Famous Person';
  }

  function categoryValue(){
    const preset = $('categoryPreset');
    const custom = $('categoryInput');
    if(!preset) return 'Any Famous Person';
    return preset.value === 'Custom' ? (custom.value.trim() || 'Custom Category') : preset.value;
  }

  function clearTurnTimers(){
    if(State.timer){ clearInterval(State.timer); State.timer = null; }
    if(State.aiTimeout){ clearTimeout(State.aiTimeout); State.aiTimeout = null; }
  }

  function rollAIDifficulty(){
    const mode = document.getElementById('aiDifficulty')?.value || 'Random';
    if(mode !== 'Random') return mode;
    const r = Math.random();
    if(r < 0.45) return 'Expert';
    if(r < 0.70) return 'Hard';
    if(r < 0.90) return 'Medium';
    return 'Easy';
  }

  async function startGame(){
    const names = $('namesInput').value.split('\n').map(x => x.trim()).filter(Boolean);
    if(names.length < 2){ alert('Add at least 2 players.'); return; }
    clearTurnTimers();
    State.players = names.map((name, i) => {
      const ai = name.startsWith('[AI]');
      const diff = (name.match(/\[(Easy|Medium|Hard|Expert)\]/) || [])[1] || null;
      return {
        name: name.replace(/^\[AI\]\[(Easy|Medium|Hard|Expert)\]\s*/, '').replace('[AI] ', ''),
        ai, difficulty: diff, strikes: 0, out: false, color: UI.colors[i % UI.colors.length],
      };
    });
    State.resetForNewGame();
    State.normalSecs = Number($('normalTime')?.value || 45);
    State.seconds = State.normalSecs;
    State.initStats();
    State.gameCategory = categoryValue();
    $('categoryLabel').textContent = State.gameCategory;
    $('modeLabel').textContent = 'SUDDEN DEATH';

    // Load the selected category before the first turn so AI can use large JSON databases.
    try{
      await Database.loadCategory(State.gameCategory);
      if(State.gameCategory !== 'Any Famous Person' && !Database.byCategory.get(State.gameCategory)){
        await Database.loadAll();
      }
      Database.updateStats?.();
    }catch(e){
      console.warn('Database category load failed:', e);
    }

    if(window.AIEngine){
      const aiDiff = document.getElementById('aiDifficulty')?.value || 'Random';
      await AIEngine.prepare({category: State.gameCategory, difficulty: aiDiff});
    }

    $('setupBox')?.classList.add('hidden');
    beginTurn();
    $('answerInput').focus();
  }

  function beginTurn(){
    if(!State.gameActive) return;
    clearTurnTimers();
    State.activeTurnId++;
    State.seconds = State.reverseBattle ? State.battleSecs : State.normalSecs;
    State.resetForTurn();
    if($('pauseBtn')) $('pauseBtn').textContent = 'PAUSE';
    UI.render();
    UI.updateTimer();
    const thisTurn = State.activeTurnId;
    State.timer = setInterval(() => {
      if(!State.gameActive || thisTurn !== State.activeTurnId) return;
      if(State.paused) return;
      State.seconds--;
      UI.updateTimer();
      if(State.seconds <= 0){ clearTurnTimers(); giveStrike('Time expired', thisTurn); }
    }, 1000);
    const p = State.players[State.current];
    if(p && p.ai && !p.out){ State.aiTimeout = setTimeout(() => aiTakeTurn(thisTurn, State.current), 1000); }
    else if(p && !p.ai && !p.out){ Audio.playSfx('sfxYourTurn'); }
  }

  function aiPickFromDatabase(diff){
    if(!window.AIEngine || !AIEngine.ready) return null;
    return AIEngine.nextMove({
      requiredLetter: State.requiredLetter,
      usedNamesSet: State.used,
      difficulty: diff,
    });
  }

  function aiTakeTurn(turnId, playerIndex){
    if(!State.gameActive || turnId !== State.activeTurnId || playerIndex !== State.current) return;
    const p = State.players[State.current];
    if(!p || !p.ai || p.out) return;

    const diff = p.difficulty || 'Medium';
    const failRate = {Easy:.15, Medium:.05, Hard:.01, Expert:0}[diff] || 0;

    const person = aiPickFromDatabase(diff);

    const trulyStuck = !person || !person.name;
    // Only Easy/Medium ever whiff on a name they actually found (simulated mistake).
    // Hard/Expert always play their best available move.
    const mistake = !trulyStuck && (diff === 'Easy' || diff === 'Medium') && Math.random() < failRate;

    if(trulyStuck || mistake){
      $('answerInput').value = '🤖 ' + p.name + ' is stuck...';
      State.aiTimeout = setTimeout(() => {
        if(!State.gameActive || turnId !== State.activeTurnId || playerIndex !== State.current) return;
        giveStrike(trulyStuck ? 'AI could not find a name' : 'AI hesitated too long', turnId);
      }, 1500);
      return;
    }

    const choice = person.name;
    $('answerInput').value = '🤖 ' + p.name + ' is thinking...';
    // Slower than a "realistic" reaction time on purpose - at full speed the
    // log scrolls faster than a table of players can actually read it.
    const thinkRange = {Easy:[2600,4200], Medium:[2200,3600], Hard:[1800,2900], Expert:[1500,2400]}[diff] || [2200,3600];
    const thinkMs = thinkRange[0] + Math.random() * (thinkRange[1] - thinkRange[0]);
    State.aiTimeout = setTimeout(() => {
      if(!State.gameActive || turnId !== State.activeTurnId || playerIndex !== State.current) return;
      $('answerInput').value = choice;
      submitAnswer(turnId);
    }, thinkMs);
  }

  async function submitAnswer(turnId = State.activeTurnId){
    if(!State.gameActive || turnId !== State.activeTurnId) return;
    const raw = $('answerInput').value.trim();
    if(!raw) return;
    const info = Rules.parseName(raw);
    if(!info){ alert('Use a first and last name.'); return; }
    const key = info.cleaned.toLowerCase();
    if(State.used.has(key)){ alert('That name has already been used.'); return; }
    if(State.requiredLetter && info.firstInitial !== State.requiredLetter){ alert('That name must start with ' + State.requiredLetter + '.'); return; }

    const auto = document.getElementById('autoValidate');
    const cat = selectedCategory();
    UI.setValidation('checking', '🔍 Checking...', cat === 'Any Famous Person' ? raw : raw + ' • ' + cat);
    State.paused = true;
    $('pauseBtn').textContent = 'RESUME';
    $('submitBtn').classList.add('submitDisabled');
    let check;
    try{
      check = await Validator.validateName(raw, cat, {skipNetwork: auto && !auto.checked});
      if(check.skipped){
        UI.setValidation('', 'Auto validation is off.', 'Players decide validity manually.');
      }else if(check.valid){
        const detail = Rules.shortenText(check.description) || 'Verified.';
        UI.setValidation('valid', '✅ Valid: ' + check.title, detail, check.url || '');
      }else if(check.serviceError){
        UI.setValidation('invalid', '⚠️ Wikipedia unavailable', 'Wikipedia is temporarily rate-limiting or unreachable. Try submitting again in a few seconds.');
      }else if(check.reason === 'Wrong category'){
        UI.setValidation('invalid', '❌ Wrong category', (check.title || raw) + ' was found, but Wikipedia does not appear to classify it as ' + (check.matchCat || cat) + '.');
      }else{
        UI.setValidation('invalid', '❌ Invalid', 'No Wikipedia match found for "' + raw + '".');
      }
    }catch(e){
      check = {valid:false, reason:'Validation failed', serviceError:true};
      UI.setValidation('invalid', '❌ Check failed', 'The request was blocked or the internet connection failed.');
    }finally{
      State.paused = false;
      $('pauseBtn').textContent = 'PAUSE';
      $('submitBtn').classList.remove('submitDisabled');
    }

    if(!State.gameActive || turnId !== State.activeTurnId) return;

    if(!check.valid){
      // A rate limit or outage is not a wrong answer - nobody (human or AI) should
      // be eliminated because Wikipedia was briefly unreachable. Retry the same
      // name a few times with a pause, and if it's still down, halt the turn
      // instead of striking anyone out.
      if(check.serviceError){
        if(State.serviceRetryCount < 3){
          State.serviceRetryCount++;
          UI.showToast('SERVICE BUSY', 'Retrying in a moment…', 'purple');
          await new Promise(r => setTimeout(r, 2000));
          if(!State.gameActive || turnId !== State.activeTurnId) return;
          return submitAnswer(turnId);
        }
        State.log.push({type:'event', event:'serviceDown', banner:'VALIDATION IS UNAVAILABLE. TRY SUBMITTING AGAIN IN A MOMENT.', status:'bad'});
        State.paused = true;
        $('pauseBtn').textContent = 'RESUME';
        UI.render();
        return;
      }

      const cur = State.players[State.current];
      // An AI that picked a name that failed validation should discard it and
      // try another, like a human would - the database has obscure entries
      // that occasionally fail validation, and one bad pick shouldn't end the
      // AI's game.
      if(cur && cur.ai && State.aiRetryCount < 3){
        State.aiRetryCount++;
        if(window.AIEngine) AIEngine.markUsedName(info.cleaned);
        // Retry "safe" regardless of the player's real difficulty: a lower
        // difficulty stays near the top of the fame ranking and skips the
        // rare-ending gamble, which is exactly what makes Hard/Expert picks
        // more likely to fail validation in the first place. The point of a
        // retry is recovering, not staying in character.
        const retryPick = aiPickFromDatabase('Easy');
        if(retryPick && retryPick.name){
          console.warn('AI retry ' + State.aiRetryCount + ': "' + raw + '" failed validation, trying "' + retryPick.name + '"');
          $('answerInput').value = retryPick.name;
          return submitAnswer(turnId);
        }
      }
      State.log.push({type:'event', event:'invalid', banner:'COULD NOT VERIFY "' + raw.toUpperCase() + '". PLAYER IS OUT.', status:'bad'});
      giveStrike('Validation failed', turnId);
      return;
    }

    State.activeTurnId++;
    clearTurnTimers();
    const elapsed = (State.reverseBattle ? State.battleSecs : State.normalSecs) - State.seconds;
    if(State.stats.fastest === null || elapsed < State.stats.fastest) State.stats.fastest = elapsed;
    Audio.playSfx('sfxNameSubmitted');
    State.used.add(key);
    if(window.AIEngine){ AIEngine.markUsedName(info.cleaned); }
    const p = State.players[State.current];
    State.stats.names[p.name] = (State.stats.names[p.name] || 0) + 1;
    const wasBattle = State.reverseBattle;
    const wasPreviousDouble = State.previousWasDouble;
    let result = 'NORMAL PLAY', status = 'normal', battleEvent = null, timerUsed = wasBattle ? State.battleSecs : State.normalSecs;
    const startsWith = State.requiredLetter || '—', source = State.requiredSource;

    if(info.isDouble){
      State.direction *= -1;
      State.stats.reverses[p.name] = (State.stats.reverses[p.name] || 0) + 1;
      if(wasPreviousDouble){
        State.reverseBattle = true;
        State.stats.currentBattle++;
        State.stats.longestBattle = Math.max(State.stats.longestBattle, State.stats.currentBattle);
        if(wasBattle){
          result = 'REVERSE BATTLE CONTINUES';
          status = 'battle';
        }else{
          result = 'REVERSE';
          status = 'reverse';
          battleEvent = {type:'event', event:'battleStart', banner:'⚔ REVERSE BATTLE ⚔', status:'battle'};
          UI.showToast('REVERSE BATTLE', '30 second timer active', 'red');
          UI.showReverseBattle(p.name, State.players[State.nextAliveIndex(State.current, State.direction)]?.name);
        }
        Audio.playSfx('sfxReverse');
      }else{
        State.reverseBattle = false;
        State.stats.currentBattle = 1;
        result = 'REVERSE';
        status = 'reverse';
        Audio.playSfx('sfxReverse');
        UI.showToast('REVERSE', 'Direction changed', 'purple');
      }
      State.previousWasDouble = true;
      UI.animateDirection();
    }else{
      if(wasBattle){
        result = 'BATTLE ENDED';
        status = 'battleend';
        battleEvent = {type:'event', event:'battleEnd', banner:'REVERSE BATTLE ENDED. PLAY CONTINUES ' + (State.direction === 1 ? 'CLOCKWISE' : 'COUNTERCLOCKWISE') + '.', status:'ended'};
        UI.showToast('BATTLE ENDED', 'Back to ' + State.normalSecs + ' seconds', 'purple');
      }
      State.reverseBattle = false;
      State.previousWasDouble = false;
      State.stats.currentBattle = 0;
    }

    const entry = {
      type:'play', turn: State.turn++, player: p.name, color: p.color, celebrity: info.cleaned, info,
      validation: (Rules.shortenText(check.description) || check.title || 'Verified'), photo: (check.photo || ''),
      startsWith, source, result, status, timerUsed,
    };
    State.log.push(entry);
    State.lastLogIndex = State.log.length - 1;
    if(battleEvent) State.log.push(battleEvent);
    State.chain.push(entry);
    State.requiredLetter = info.lastInitial;
    State.requiredSource = info.last;
    State.current = State.nextAliveIndex(State.current, State.direction);
    $('answerInput').value = '';
    beginTurn();
  }

  function giveStrike(reason, turnId = State.activeTurnId){
    if(!State.gameActive || turnId !== State.activeTurnId) return;
    State.activeTurnId++;
    clearTurnTimers();
    const p = State.players[State.current];
    if(!p || p.out) return;
    p.strikes = 1;
    p.out = true;
    State.log.push({type:'strike', turn: State.turn++, player: p.name, color: p.color, celebrity:'—', info:null, startsWith: State.requiredLetter || '—', source: State.requiredSource, result: reason, status:'bad', timerUsed: State.seconds});
    State.log.push({type:'event', event:'out', banner: p.name.toUpperCase() + ' IS OUT!', status:'bad'});
    State.lastLogIndex = null;
    State.previousWasDouble = false;
    State.reverseBattle = false;
    State.stats.currentBattle = 0;
    if(State.players.filter(x => !x.out).length <= 1){ UI.render(); endGame(); return; }
    State.current = State.nextAliveIndex(State.current, State.direction);
    beginTurn();
  }

  function rejectLastName(){
    if(State.lastLogIndex === null || !State.log[State.lastLogIndex]) return;
    const entry = State.log[State.lastLogIndex];
    const idx = State.players.findIndex(p => p.name === entry.player);
    if(idx < 0) return;
    State.used.delete((entry.celebrity || '').toLowerCase());
    State.chain = State.chain.filter(x => x !== entry);
    State.log.push({type:'event', event:'challenge', banner:'CHALLENGE SUCCESSFUL. ' + entry.player.toUpperCase() + ' IS OUT.', status:'bad'});
    State.current = idx;
    State.previousWasDouble = false;
    State.reverseBattle = false;
    State.stats.currentBattle = 0;
    giveStrike('Invalid answer');
  }

  function endGame(){
    clearTurnTimers();
    State.gameActive = false;
    const winner = State.players.find(p => !p.out);
    $('winnerTitle').textContent = winner ? winner.name + ' Wins!' : 'Game Over';
    $('winnerMsg').textContent = winner ? 'Last player standing in ' + categoryValue() + '.' : 'No players left.';
    $('endStats').innerHTML = UI.endStatsHtml();
    $('winnerModal').classList.remove('hidden');
  }

  window.NameGame = window.NameGame || {};
  window.NameGame.Engine = {
    selectedCategory, categoryValue, clearTurnTimers, rollAIDifficulty,
    startGame, beginTurn, aiTakeTurn, submitAnswer, giveStrike, rejectLastName, endGame,
  };
})();
