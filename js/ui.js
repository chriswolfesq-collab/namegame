// All DOM rendering. Reads from NameGame.State, never mutates game rules -
// the engine module is the only thing that changes State.
(function(){
  const State = window.NameGame.State;
  const $ = id => document.getElementById(id);

  const colors = ['#53e342','#a05bff','#ff9f16','#3998ff','#ffd21f','#ff4138','#38e6ff','#ff5bd6'];

  function showToast(main, small, type='purple'){
    const t = $('toast'), inn = $('toastInner'), sm = $('toastSmall');
    if(!t || !inn || !sm) return;
    inn.className = 'toastInner ' + (type === 'red' ? 'red' : '');
    inn.firstChild.nodeValue = main;
    sm.textContent = small;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 1450);
  }

  function showReverseBattle(a, b){
    const ov = $('reverseBattleOverlay'), nm = $('reverseBattleNames');
    if(!ov || !nm) return;
    nm.textContent = (a || 'PLAYER') + ' ↔ ' + (b || 'PLAYER');
    ov.classList.remove('show');
    void ov.offsetWidth;
    ov.classList.add('show');
    setTimeout(() => ov.classList.remove('show'), 2000);
  }

  function setValidation(status, title, detail, url){
    const box = $('validationStatus');
    if(!box) return;
    box.className = 'validationStatus ' + status;
    const link = url ? `<small><a href="${url}" target="_blank" rel="noopener">Open Wikipedia result</a></small>` : '';
    box.innerHTML = `${title || ''}${detail ? '<small>' + detail + '</small>' : ''}${link}`;
  }

  function highlightName(info){
    const mid = info.cleaned.split(' ').slice(1, -1).join(' ');
    return `<span class="firstLetter">${info.first[0]}</span>${info.first.slice(1)} ${mid ? mid + ' ' : ''}<span class="lastLetter">${info.last[0]}</span>${info.last.slice(1)}`;
  }

  function celebrityCell(item){
    const nameHtml = item.info ? highlightName(item.info) : item.celebrity;
    const img = item.photo;
    const fallback = (item.celebrity || '?').trim()[0] || '?';
    const media = img
      ? `<img class="celebPhoto" src="${img}" alt="${item.celebrity || 'photo'}" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=&quot;celebPhoto placeholder&quot;>?</div>'">`
      : `<div class="celebPhoto placeholder">${fallback.toUpperCase()}</div>`;
    return `<div class="celebCell">${media}<div class="celebText"><div>${nameHtml}</div></div></div>`;
  }

  function animateDirection(){
    const box = $('directionBox');
    if(!box) return;
    box.classList.remove('flip');
    void box.offsetWidth;
    box.classList.add('flip');
  }

  function renderPlayers(){
    $('players').innerHTML = State.players.map((p, i) => {
      const status = p.out ? 'OUT' : 'LIVE';
      return `<div class="player ${i === State.current && !p.out ? 'active' : ''} ${p.out ? 'out' : ''}"><div class="num" style="background:${p.color}">${i + 1}</div><div class="avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div><div class="pname">${p.name.toUpperCase()}</div><div class="strikeDots" style="font-family:Arial,sans-serif;font-weight:1000;color:${p.out ? 'var(--red)' : 'var(--green)'}">${status}</div></div>`;
    }).join('');
  }

  function renderLog(){
    let html = '';
    State.log.forEach(item => {
      if(item.type === 'event' || item.banner){
        const cls = item.status === 'bad' ? 'red' : item.status === 'ended' ? 'green' : item.status === 'battle' ? 'purple' : 'purple';
        html += `<div class="banner ${cls}">${item.banner}</div>`;
        return;
      }
      const celeb = celebrityCell(item);
      let statusClass = 'normal', statusText = '✓ ' + item.result;
      if(item.status === 'reverse'){ statusClass = 'reverse'; statusText = '↺ REVERSE'; }
      else if(item.status === 'battle'){ statusClass = 'reverse'; statusText = '⚔ REVERSE BATTLE CONTINUES'; }
      else if(item.status === 'battleend'){ statusClass = 'normal'; statusText = '✓ BATTLE ENDED'; }
      else if(item.status === 'bad'){ statusClass = 'bad'; statusText = '✖ ' + item.result; }
      html += `<div class="logRow"><div class="turnNum" style="color:${item.color || 'var(--red)'}">${item.turn}</div><div class="turnPlayer"><div class="avatar" style="width:42px;height:42px;background:${item.color || 'var(--red)'}">${item.player ? item.player[0] : '!'}</div>${(item.player || 'EVENT').toUpperCase()}</div><div class="celebrity">${celeb}</div><div class="req" style="font-size:14px;text-align:left;color:white">${item.validation || ''}</div><div class="result"><span class="${statusClass}">${statusText}</span></div><div class="timeCell ${item.status === 'battle' || item.status === 'reverse' && item.timerUsed === 30 ? 'red' : ''}">${item.timerUsed || ''}${item.timerUsed ? 's' : ''}</div></div>`;
    });
    const p = State.players[State.current];
    if(p && !p.out && State.gameActive){
      html += `<div class="logRow current"><div class="turnNum" style="color:${p.color}">${State.turn}</div><div class="turnPlayer"><div class="avatar" style="width:42px;height:42px;background:${p.color}">${p.name[0]}</div>${p.name.toUpperCase()}</div><div class="celebrity" style="color:${p.color}">YOUR TURN!<br><small style="font-size:17px;color:white">Needs a name that starts with ${State.requiredLetter || 'anything'}</small></div><div class="req">${State.requiredLetter || '—'}<small>${State.requiredSource !== 'Start' ? '(' + State.requiredSource + ')' : ''}</small></div><div></div><div class="timeCell ${State.reverseBattle ? 'red' : ''}">${State.reverseBattle ? 30 : State.normalSecs}s</div></div>`;
    }
    $('log').innerHTML = html;
    $('log').scrollTop = $('log').scrollHeight;
  }

  function renderHero(){
    const p = State.players[State.current];
    if(!p) return;
    $('heroPlayer').textContent = p.out ? 'GAME OVER' : p.name.toUpperCase() + "'S TURN";
    $('heroNeed').innerHTML = 'Needs <b>' + (State.requiredLetter || 'ANY') + '</b>';
    $('heroSub').textContent = State.reverseBattle ? 'Reverse Battle is active. This player only has 30 seconds.' : (State.requiredSource === 'Start' ? 'Start the chain with any valid name.' : 'Previous last name: ' + State.requiredSource + '. Normal 45 second turn.');
  }

  function render(){
    renderPlayers();
    renderLog();
    renderHero();
    const alive = State.players.filter(p => !p.out).length;
    $('aliveCount').textContent = alive + ' / ' + State.players.length;
    $('dirArrow').textContent = State.direction === 1 ? '→' : '←';
    $('dirText').textContent = State.direction === 1 ? 'CLOCKWISE' : 'COUNTERCLOCKWISE';
    $('battleText').textContent = State.reverseBattle ? 'REVERSE BATTLE' : 'NORMAL PLAY';
    $('battleText').className = 'mode ' + (State.reverseBattle ? 'battle' : '');
  }

  function updateTimer(){
    const danger = State.seconds <= 10 || State.reverseBattle;
    if(State.seconds === 10 && !State.tenSecondPlayed){
      State.tenSecondPlayed = true;
      window.NameGame.Audio.playSfx('sfxTenSeconds');
    }
    if($('timerCircle')) $('timerCircle').textContent = State.seconds;
    if($('heroTimer')) $('heroTimer').textContent = State.seconds;
    $('timerCircle')?.classList.toggle('danger', danger);
    $('heroTimer')?.classList.toggle('danger', danger);
  }

  function topStat(obj){
    let best = '—', val = -1;
    Object.entries(obj).forEach(([k, v]) => { if(v > val){ best = k; val = v; } });
    return val > 0 ? best + ' (' + val + ')' : '—';
  }

  function endStatsHtml(){
    const s = State.stats;
    return `<div class="statsLine"><span>Most Names</span><span>${topStat(s.names)}</span></div><div class="statsLine"><span>Most Reverses</span><span>${topStat(s.reverses)}</span></div><div class="statsLine"><span>Longest Reverse Battle</span><span>${s.longestBattle || 0} names</span></div><div class="statsLine"><span>Fastest Answer</span><span>${s.fastest === null ? '—' : s.fastest + 's'}</span></div>`;
  }

  window.NameGame = window.NameGame || {};
  window.NameGame.UI = {
    $, colors, showToast, showReverseBattle, setValidation,
    render, renderPlayers, renderLog, renderHero, updateTimer,
    animateDirection, endStatsHtml, topStat,
  };
})();
