// Sound effect playback. Just thin wrapping around the <audio> elements
// already in index.html - kept separate from the engine/UI so those modules
// don't need to know anything about the DOM audio API.
(function(){
  function playSfx(id){
    const a = document.getElementById(id);
    if(!a) return;
    try{ a.currentTime = 0; a.play().catch(() => {}); }catch(e){}
  }

  window.NameGame = window.NameGame || {};
  window.NameGame.Audio = {playSfx};
})();
