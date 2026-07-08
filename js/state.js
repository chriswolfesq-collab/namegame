// Single source of truth for all mutable game state. Every other module reads
// and writes through NameGame.State instead of its own top-level globals -
// this is what used to be ~15 loose `let` bindings at the top of game.js.
(function(){
  const State = {
    players: [],
    current: 0,
    direction: 1,
    requiredLetter: null,
    requiredSource: 'Start',
    used: new Set(),
    log: [],
    chain: [],
    turn: 1,

    strikesOut: 1,
    normalSecs: 45,
    battleSecs: 30,
    seconds: 45,
    timer: null,
    paused: false,
    tenSecondPlayed: false,

    previousWasDouble: false,
    reverseBattle: false,
    lastLogIndex: null,

    activeTurnId: 0,
    aiTimeout: null,
    gameActive: false,
    aiRetryCount: 0,
    serviceRetryCount: 0,

    gameCategory: 'Any Famous Person',
    stats: {reverses:{}, names:{}, longestBattle:0, currentBattle:0, fastest:null},
  };

  State.initStats = function(){
    State.stats = {reverses:{}, names:{}, longestBattle:0, currentBattle:0, fastest:null};
    State.players.forEach(p => {
      State.stats.reverses[p.name] = 0;
      State.stats.names[p.name] = 0;
    });
  };

  State.resetForNewGame = function(){
    State.current = 0;
    State.direction = 1;
    State.requiredLetter = null;
    State.requiredSource = 'Start';
    State.used = new Set();
    State.log = [];
    State.chain = [];
    State.turn = 1;
    State.previousWasDouble = false;
    State.reverseBattle = false;
    State.lastLogIndex = null;
    State.strikesOut = 1;
    State.seconds = State.normalSecs;
    State.paused = false;
    State.tenSecondPlayed = false;
    State.gameActive = true;
    State.activeTurnId = 0;
    State.aiRetryCount = 0;
    State.serviceRetryCount = 0;
  };

  State.resetForTurn = function(){
    State.tenSecondPlayed = false;
    State.paused = false;
    State.aiRetryCount = 0;
    State.serviceRetryCount = 0;
  };

  State.nextAliveIndex = function(from, dir){
    if(State.players.filter(p => !p.out).length <= 1) return from;
    let i = from;
    do{ i = (i + dir + State.players.length) % State.players.length; }while(State.players[i].out);
    return i;
  };

  window.NameGame = window.NameGame || {};
  window.NameGame.State = State;
})();
