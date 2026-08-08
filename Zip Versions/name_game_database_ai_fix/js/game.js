let players=[], current=0, direction=1, requiredLetter=null, requiredSource='Start', used=new Set(), log=[], chain=[], turn=1;
let strikesOut=1, normalSecs=45, battleSecs=30, seconds=45, timer=null, paused=false, tenSecondPlayed=false;
let previousWasDouble=false, reverseBattle=false, lastLogIndex=null;
let activeTurnId=0, aiTimeout=null, gameActive=false;
let gameCategory='Any Famous Person';
let stats={reverses:{},names:{},longestBattle:0,currentBattle:0,fastest:null};

const $=id=>document.getElementById(id);
const colors=['#53e342','#a05bff','#ff9f16','#3998ff','#ffd21f','#ff4138','#38e6ff','#ff5bd6'];

function playSfx(id){
 const a=document.getElementById(id);
 if(!a) return;
 try{a.currentTime=0;a.play().catch(()=>{});}catch(e){}
}

const aiNames=["Adam Sandler", "Adele Adkins", "Al Pacino", "Albert Einstein", "Alexander Hamilton", "Alice Cooper", "Amy Adams", "Angela Bassett", "Anne Hathaway", "Ariana Grande", "Arnold Schwarzenegger", "Audrey Hepburn", "Barack Obama", "Barry Bonds", "Barry Manilow", "Benedict Cumberbatch", "Ben Affleck", "Beyonce Knowles", "Bill Murray", "Bill Nye", "Bill Russell", "Billy Joel", "Bob Dylan", "Brad Pitt", "Bruce Lee", "Bruce Springsteen", "Bruce Willis", "Bugs Bunny", "Calvin Harris", "Cam Newton", "Cardi B", "Carrie Fisher", "Celine Dion", "Chadwick Boseman", "Charles Barkley", "Charlie Chaplin", "Chris Evans", "Chris Hemsworth", "Christian Bale", "Christopher Walken", "Clint Eastwood", "Cristiano Ronaldo", "Dak Prescott", "Daniel Craig", "Daniel Radcliffe", "Dave Chappelle", "David Beckham", "David Bowie", "Denzel Washington", "Derek Jeter", "Diana Ross", "Dolly Parton", "Donald Duck", "Drake Graham", "Drew Barrymore", "Dwayne Johnson", "Ed Sheeran", "Eddie Murphy", "Elon Musk", "Elton John", "Elvis Presley", "Emma Stone", "Emma Watson", "Eminem Mathers", "Eva Mendes", "Evangeline Lilly", "Freddie Mercury", "Frank Sinatra", "Frida Kahlo", "Floyd Mayweather", "Forest Whitaker", "Fiona Apple", "Gal Gadot", "George Clooney", "George Lucas", "George Washington", "Gordon Ramsay", "Grace Kelly", "Greta Gerwig", "Gwen Stefani", "Halle Berry", "Harry Potter", "Harry Styles", "Harrison Ford", "Heath Ledger", "Hedy Lamarr", "Helen Mirren", "Henry Cavill", "Hillary Clinton", "Hugh Jackman", "Idris Elba", "Ice Cube", "Isaac Newton", "Isla Fisher", "Ivanka Trump", "Iggy Azalea", "Jack Black", "Jack Nicholson", "Jackie Chan", "Jake Gyllenhaal", "James Bond", "James Brown", "James Cameron", "Jamie Foxx", "Janet Jackson", "Jason Momoa", "Jennifer Aniston", "Jennifer Lawrence", "Jessica Alba", "Jim Carrey", "Jimmy Fallon", "Joe Montana", "John Cena", "John Legend", "John Lennon", "Johnny Cash", "Johnny Depp", "Jon Stewart", "Jordan Peele", "Julia Roberts", "Justin Bieber", "Justin Timberlake", "Kanye West", "Kate Winslet", "Keanu Reeves", "Kelly Clarkson", "Kendrick Lamar", "Kevin Bacon", "Kevin Costner", "Kevin Durant", "Kevin Hart", "Kobe Bryant", "Kristen Bell", "Kurt Cobain", "Kylie Jenner", "Lady Gaga", "Larry Bird", "LeBron James", "Leonardo DiCaprio", "Liam Neeson", "Lionel Messi", "Lisa Kudrow", "Lizzo Jefferson", "Lorde Yelich", "Luke Skywalker", "Madonna Ciccone", "Magic Johnson", "Marilyn Monroe", "Mark Hamill", "Mark Wahlberg", "Marshall Mathers", "Martin Lawrence", "Matt Damon", "Matthew McConaughey", "Matthew Perry", "Megan Fox", "Meryl Streep", "Michael B Jordan", "Michael Jackson", "Michael Jordan", "Michael Keaton", "Michelle Obama", "Mickey Mantle", "Mickey Mouse", "Mila Kunis", "Morgan Freeman", "Muhammad Ali", "Nancy Pelosi", "Natalie Portman", "Neil Armstrong", "Nicolas Cage", "Nicole Kidman", "Nicki Minaj", "Nina Simone", "Olivia Rodrigo", "Oprah Winfrey", "Orlando Bloom", "Oscar Isaac", "Ozzy Osbourne", "Patrick Mahomes", "Patrick Stewart", "Paul McCartney", "Pele Nascimento", "Pete Davidson", "Peter Parker", "Peyton Manning", "Prince Nelson", "Quentin Tarantino", "Queen Latifah", "Quincy Jones", "Quinn Hughes", "Rachel McAdams", "Rafael Nadal", "Reese Witherspoon", "Rihanna Fenty", "Robert De Niro", "Robert Downey", "Robin Williams", "Roger Federer", "Rosa Parks", "Ryan Gosling", "Ryan Reynolds", "Samuel Jackson", "Sandra Bullock", "Scarlett Johansson", "Serena Williams", "Shaquille ONeal", "Shakira Mebarak", "Simone Biles", "Snoop Dogg", "Stephen Curry", "Steve Carell", "Steve Jobs", "Sylvester Stallone", "Taylor Swift", "Tim Burton", "Tim Cook", "Tina Fey", "Tom Brady", "Tom Cruise", "Tom Hanks", "Tony Hawk", "Tupac Shakur", "Tyler Perry", "Uma Thurman", "Usain Bolt", "Ulysses Grant", "Ursula Andress", "Viola Davis", "Vin Diesel", "Virat Kohli", "Vince Vaughn", "Vladimir Putin", "Walt Disney", "Wayne Gretzky", "Whitney Houston", "Will Ferrell", "Will Smith", "William Shakespeare", "Winston Churchill", "Wolfgang Mozart", "Xavier Woods", "Xabi Alonso", "Xander Bogaerts", "Xena Warrior", "Yao Ming", "Yogi Berra", "Yoko Ono", "Yvonne Strahovski", "Zendaya Coleman", "Zac Efron", "Zach Galifianakis", "Zoe Saldana", "Zooey Deschanel", "Zinedine Zidane"];

function clearTurnTimers(){
 if(timer){clearInterval(timer);timer=null;}
 if(aiTimeout){clearTimeout(aiTimeout);aiTimeout=null;}
}

function parseName(full){
 const cleaned=full.trim().replace(/\s+/g,' ');
 const parts=cleaned.split(' ');
 if(parts.length<2)return null;
 const first=parts[0], last=parts[parts.length-1];
 return {cleaned,first,last,firstInitial:first[0].toUpperCase(),lastInitial:last[0].toUpperCase(),isDouble:first[0].toUpperCase()===last[0].toUpperCase()};
}

function nextAliveIndex(from,dir){
 if(players.filter(p=>!p.out).length<=1)return from;
 let i=from;
 do{i=(i+dir+players.length)%players.length;}while(players[i].out);
 return i;
}

function categoryValue(){
 const preset=$('categoryPreset');
 const custom=$('categoryInput');
 if(!preset) return 'Any Famous Person';
 return preset.value==='Custom'?(custom.value.trim()||'Custom Category'):preset.value;
}

function initStats(){
 stats={reverses:{},names:{},longestBattle:0,currentBattle:0,fastest:null};
 players.forEach(p=>{stats.reverses[p.name]=0;stats.names[p.name]=0;});
}

async function startGame(){
 const names=$('namesInput').value.split('\n').map(x=>x.trim()).filter(Boolean);
 if(names.length<2){alert('Add at least 2 players.');return;}
 clearTurnTimers();
 players=names.map((name,i)=>{
   const ai=name.startsWith('[AI]');
   const diff=(name.match(/\[(Easy|Medium|Hard|Expert)\]/)||[])[1]||null;
   return {name:name.replace(/^\[AI\]\[(Easy|Medium|Hard|Expert)\]\s*/,'').replace('[AI] ',''),ai,difficulty:diff,strikes:0,out:false,color:colors[i%colors.length]};
 });
 current=0; direction=1; requiredLetter=null; requiredSource='Start'; used=new Set(); log=[]; chain=[]; turn=1;
 previousWasDouble=false; reverseBattle=false; lastLogIndex=null; strikesOut=1;
 normalSecs=Number($('normalTime')?.value||45); seconds=normalSecs; paused=false; tenSecondPlayed=false;
 gameActive=true; activeTurnId=0;
 initStats();
 gameCategory=categoryValue();
 $('categoryLabel').textContent=gameCategory;
 $('modeLabel').textContent='SUDDEN DEATH';

 // Load the selected category before the first turn so AI can use large JSON databases.
 if(window.NameDatabase){
   try{
     await NameDatabase.loadCategory(gameCategory);
     if(NameDatabase.byCategory && gameCategory!=='Any Famous Person' && !NameDatabase.byCategory.get(gameCategory)){
       await NameDatabase.loadAll();
     }
     NameDatabase.updateStats?.();
   }catch(e){
     console.warn('NameDatabase category load failed:', e);
   }
 }

 $('setupBox')?.classList.add('hidden');
 beginTurn();
 $('answerInput').focus();
}

function beginTurn(){
 if(!gameActive)return;
 clearTurnTimers();
 activeTurnId++;
 seconds=reverseBattle?battleSecs:normalSecs;
 tenSecondPlayed=false;
 paused=false;
 if($('pauseBtn')) $('pauseBtn').textContent='PAUSE';
 render();
 updateTimer();
 const thisTurn=activeTurnId;
 timer=setInterval(()=>{
   if(!gameActive || thisTurn!==activeTurnId) return;
   if(paused)return;
   seconds--;
   updateTimer();
   if(seconds<=0){clearTurnTimers();giveStrike('Time expired',thisTurn);}
 },1000);
 const p=players[current];
 if(p && p.ai && !p.out){aiTimeout=setTimeout(()=>aiTakeTurn(thisTurn,current),300);}
 else if(p && !p.ai && !p.out){playSfx('sfxYourTurn');}
}

function updateTimer(){
 const danger=seconds<=10||reverseBattle;
 if(seconds===10 && !tenSecondPlayed){tenSecondPlayed=true;playSfx('sfxTenSeconds');}
 if($('timerCircle')) $('timerCircle').textContent=seconds;
 if($('heroTimer')) $('heroTimer').textContent=seconds;
 $('timerCircle')?.classList.toggle('danger',danger);
 $('heroTimer')?.classList.toggle('danger',danger);
}

function aiFallbackPoolForCurrentCategory(){
 const cat=selectedCategory();
 if(cat==='Any Famous Person') return aiNames;

 const LOCAL_AI_TAGS={
   "Baseball":["Barry Bonds","Derek Jeter","Mickey Mantle","Yogi Berra","Xander Bogaerts"],
   "Football":["Tom Brady","Peyton Manning","Joe Montana","Cam Newton","Dak Prescott","Patrick Mahomes"],
   "Basketball":["Michael Jordan","LeBron James","Kobe Bryant","Stephen Curry","Kevin Durant","Shaquille ONeal","Larry Bird","Magic Johnson","Bill Russell"],
   "Hockey":["Wayne Gretzky","Quinn Hughes"],
   "Soccer":["Lionel Messi","Cristiano Ronaldo","Pele Nascimento","Xabi Alonso","Zinedine Zidane"],
   "Motorsports":[],
   "Tennis":["Serena Williams","Roger Federer","Rafael Nadal"],
   "Golf":[],
   "Combat Sports":["Muhammad Ali","Floyd Mayweather","John Cena"],
   "Olympics / Track & Field":["Simone Biles","Usain Bolt","Serena Williams"],
   "Athletes":["Barry Bonds","Derek Jeter","Mickey Mantle","Yogi Berra","Xander Bogaerts","Tom Brady","Peyton Manning","Joe Montana","Cam Newton","Dak Prescott","Patrick Mahomes","Michael Jordan","LeBron James","Kobe Bryant","Stephen Curry","Kevin Durant","Shaquille ONeal","Larry Bird","Magic Johnson","Bill Russell","Wayne Gretzky","Quinn Hughes","Lionel Messi","Cristiano Ronaldo","Pele Nascimento","Xabi Alonso","Zinedine Zidane","Serena Williams","Roger Federer","Rafael Nadal","Muhammad Ali","Floyd Mayweather","John Cena","Simone Biles","Usain Bolt"],
   "Actors / Actresses":["Tom Hanks","Halle Berry","Bruce Willis","Sylvester Stallone","Denzel Washington","Leonardo DiCaprio","Meryl Streep","Emma Stone","Keanu Reeves","Morgan Freeman","Julia Roberts","Johnny Depp","Ryan Reynolds","Ryan Gosling","Scarlett Johansson","Natalie Portman"],
   "Musicians":["Taylor Swift","Adele Adkins","Beyonce Knowles","Elvis Presley","Michael Jackson","Prince Nelson","Rihanna Fenty","Kanye West","Billy Joel","Bob Dylan","Frank Sinatra","Freddie Mercury","Lady Gaga","Drake Graham","Eminem Mathers"],
   "Fictional Characters":["Mickey Mouse","Bugs Bunny","Harry Potter","Luke Skywalker","Peter Parker","Donald Duck","James Bond","Xena Warrior"],
   "Politicians / Historical Figures":["Barack Obama","George Washington","Hillary Clinton","Nancy Pelosi","Winston Churchill","Ulysses Grant","Alexander Hamilton","Albert Einstein","Isaac Newton","Neil Armstrong","Rosa Parks","William Shakespeare","Frida Kahlo"]
 };

 const local=LOCAL_AI_TAGS[cat]||[];
 return local.length ? aiNames.filter(n=>local.includes(n)) : aiNames;
}

function aiPickFromDatabase(diff){
 if(!window.NameDatabase) return null;

 const person=NameDatabase.pick({
   category:selectedCategory(),
   startsWith:requiredLetter,
   unusedSet:used,
   difficulty:diff
 });

 if(person && person.name) return person.name;
 return null;
}

function aiPickFallback(diff){
 const valid=aiFallbackPoolForCurrentCategory().filter(n=>{
   const info=parseName(n);
   if(!info) return false;
   if(requiredLetter && info.firstInitial!==requiredLetter) return false;
   if(used.has(info.cleaned.toLowerCase())) return false;
   return true;
 });

 if(!valid.length) return null;

 const doubles=valid.filter(n=>parseName(n).isDouble);
 let pool=valid;
 const reverseChance={Easy:.05,Medium:.20,Hard:.45,Expert:.75}[diff]||.2;
 if(doubles.length && Math.random()<reverseChance) pool=doubles;

 return pool[Math.floor(Math.random()*pool.length)];
}

function aiTakeTurn(turnId,playerIndex){
 if(!gameActive || turnId!==activeTurnId || playerIndex!==current)return;
 const p=players[current];
 if(!p || !p.ai || p.out)return;

 const diff=p.difficulty||'Medium';
 const failRate={Easy:.15,Medium:.05,Hard:.01,Expert:0}[diff]||0;

 let choice=aiPickFromDatabase(diff);
 if(!choice) choice=aiPickFallback(diff);

 if(Math.random()<failRate || !choice){
   $('answerInput').value='🤖 '+p.name+' is stuck...';
   aiTimeout=setTimeout(()=>{
     if(!gameActive || turnId!==activeTurnId || playerIndex!==current)return;
     giveStrike('AI could not find a name',turnId);
   },1500);
   return;
 }

 $('answerInput').value='🤖 '+p.name+' is thinking...';
 aiTimeout=setTimeout(()=>{
   if(!gameActive || turnId!==activeTurnId || playerIndex!==current)return;
   $('answerInput').value=choice;
   submitAnswer(turnId);
 },2500+Math.random()*2500);
}

function showToast(main,small,type='purple'){
 const t=$('toast'),inn=$('toastInner'),sm=$('toastSmall');
 if(!t||!inn||!sm)return;
 inn.className='toastInner '+(type==='red'?'red':'');
 inn.firstChild.nodeValue=main;
 sm.textContent=small;
 t.classList.remove('hidden');
 setTimeout(()=>t.classList.add('hidden'),1450);
}

function showReverseBattle(a,b){
 const ov=$('reverseBattleOverlay'), nm=$('reverseBattleNames');
 if(!ov||!nm) return;
 nm.textContent=(a||'PLAYER')+' ↔ '+(b||'PLAYER');
 ov.classList.remove('show');
 void ov.offsetWidth;
 ov.classList.add('show');
 setTimeout(()=>ov.classList.remove('show'),2000);
}

function setValidation(status,title,detail,url){
 const box=$('validationStatus');
 if(!box) return;
 box.className='validationStatus '+status;
 const link=url?`<small><a href="${url}" target="_blank" rel="noopener">Open Wikipedia result</a></small>`:'';
 box.innerHTML=`${title||''}${detail?'<small>'+detail+'</small>':''}${link}`;
}


const CATEGORY_RULES={
 "Any Famous Person":{positive:[],negative:[]},

 "Actors / Actresses":{
   positive:[" actor"," actress","film actor","television actor","voice actor","comedian","filmmaker"],
   negative:["football player","baseball player","basketball player","ice hockey player","racing driver","boxer","mixed martial artist","politician","singer","rapper"]
 },

 "Athletes":{
   positive:["athlete","football player","baseball player","basketball player","ice hockey player","soccer player","association football player","footballer","tennis player","golfer","boxer","fighter","racing driver","olympian","olympic","professional wrestler","gymnast","swimmer","runner","quarterback","pitcher","outfielder","infielder"],
   negative:[" actor"," actress","film actor","television actor","voice actor","filmmaker","singer","songwriter","rapper","musician","politician","writer","author"]
 },

 "Baseball":{
   positive:["baseball player","major league baseball","mlb","minor league baseball","negro league","pitcher","catcher","outfielder","infielder","first baseman","second baseman","third baseman","shortstop","designated hitter","baseball coach","baseball manager"],
   negative:["football player","basketball player","ice hockey player","soccer player","footballer","racing driver","actor","actress","singer","politician"]
 },

 "Football":{
   positive:["american football player","football player","national football league","nfl","college football","quarterback","running back","wide receiver","tight end","linebacker","cornerback","safety","defensive end","offensive tackle","offensive guard","placekicker","punter"],
   negative:["baseball player","basketball player","ice hockey player","soccer player","footballer","racing driver","actor","actress","singer","politician"]
 },

 "Basketball":{
   positive:["basketball player","national basketball association","nba","wnba","point guard","shooting guard","small forward","power forward","basketball coach"],
   negative:["baseball player","football player","ice hockey player","soccer player","footballer","racing driver","actor","actress","singer","politician"]
 },

 "Hockey":{
   positive:["ice hockey player","national hockey league","nhl","hockey player","goaltender","defenceman","defenseman","ice hockey coach"],
   negative:["baseball player","football player","basketball player","soccer player","footballer","racing driver","actor","actress","singer","politician"]
 },

 "Soccer":{
   positive:["association football player","footballer","soccer player","major league soccer","mls","premier league","la liga","serie a","bundesliga","ligue 1","fifa","uefa"],
   negative:["american football player","baseball player","basketball player","ice hockey player","racing driver","actor","actress","singer","politician"]
 },

 "Motorsports":{
   positive:["racing driver","racecar driver","race car driver","formula one","formula 1","f1 driver","nascar","indycar","indy car","motogp","world rally championship","wrc","endurance racing","le mans","stock car racing","open-wheel racing","drag racer"],
   negative:["baseball player","football player","basketball player","ice hockey player","soccer player","actor","actress","singer","politician"]
 },

 "Tennis":{
   positive:["tennis player","atp","wta","grand slam","davis cup","billie jean king cup"],
   negative:["baseball player","football player","basketball player","ice hockey player","racing driver","actor","actress","singer","politician"]
 },

 "Golf":{
   positive:["golfer","pga tour","lpga","masters tournament","u.s. open","open championship","ryder cup"],
   negative:["baseball player","football player","basketball player","ice hockey player","racing driver","actor","actress","singer","politician"]
 },

 "Combat Sports":{
   positive:["boxer","boxing","mixed martial artist","mma fighter","ufc","kickboxer","wrestler","professional wrestler","judoka","martial artist","brazilian jiu-jitsu"],
   negative:["baseball player","football player","basketball player","ice hockey player","racing driver","actor","actress","singer","politician"]
 },

 "Olympics / Track & Field":{
   positive:["olympian","olympic","track and field","sprinter","long-distance runner","middle-distance runner","hurdler","swimmer","gymnast","skier","figure skater","speed skater","javelin thrower","discus thrower","shot putter","pole vaulter"],
   negative:["actor","actress","singer","politician","writer","author"]
 },

 "Musicians":{
   positive:["musician","singer","songwriter","rapper","band","composer","guitarist","pianist","drummer","record producer"],
   negative:["football player","baseball player","basketball player","actor","actress","politician"]
 },

 "Fictional Characters":{
   positive:["fictional character","animated character","comic book character","video game character","television character","film character"],
   negative:["american actor","american actress","football player","baseball player","politician","singer"]
 },

 "Politicians / Historical Figures":{
   positive:["politician","president","prime minister","governor","senator","representative","king","queen","emperor","general","activist","leader","historical figure"],
   negative:["actor","actress","football player","baseball player","basketball player","singer","rapper"]
 },

 "Custom":{positive:[],negative:[]}
};

function selectedCategory(){
 return gameCategory || 'Any Famous Person';
}

function categorySearchText(obj){
 return [
   obj.title||'',
   obj.description||'',
   obj.extract||'',
   obj.categoriesText||''
 ].join(' ').toLowerCase();
}

function categoryMatchesWikipedia(obj){
 const cat=selectedCategory();
 if(cat==='Any Famous Person') return {ok:true};

 const rules=CATEGORY_RULES[cat]||{positive:[],negative:[]};
 if(!rules.positive.length) return {ok:true};

 const text=' '+categorySearchText(obj).replace(/\s+/g,' ')+' ';

 const positiveHit=(rules.positive||[]).find(rule=>text.includes(rule.toLowerCase()));
 const negativeHit=(rules.negative||[]).find(rule=>text.includes(rule.toLowerCase()));

 if(positiveHit) return {ok:true,hit:positiveHit};
 if(negativeHit) return {ok:false,cat,reason:'negative match: '+negativeHit};

 return {ok:false,cat};
}

async function fetchWikiCategories(title){
 try{
   const url='https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&prop=categories&cllimit=50&titles='+encodeURIComponent(title);
   const res=await fetch(url);
   if(!res.ok) return '';
   const data=await res.json();
   const pages=data&&data.query&&data.query.pages?Object.values(data.query.pages):[];
   const cats=(pages[0]&&pages[0].categories)?pages[0].categories.map(c=>c.title.replace('Category:','')):[];
   return cats.join(' ');
 }catch(e){
   return '';
 }
}

async function validateWikipedia(name){
  const auto = document.getElementById('autoValidate');
  if(auto && !auto.checked){
    setValidation('', 'Auto validation is off.', 'Players decide validity manually.');
    return {valid:true, skipped:true};
  }

  const cat=selectedCategory();
  setValidation('checking', '🔍 Checking Wikipedia...', cat==='Any Famous Person'?name:name+' • '+cat);
  paused = true;
  $('pauseBtn').textContent='RESUME';
  $('submitBtn').classList.add('submitDisabled');

  try{
    const summaryUrl='https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(name);
    let res=await fetch(summaryUrl, {headers:{'Accept':'application/json'}});
    if(res.ok){
      const data=await res.json();
      if(data && data.title && data.type !== 'disambiguation'){
        data.categoriesText=await fetchWikiCategories(data.title);
        const match=categoryMatchesWikipedia(data);
        if(!match.ok){
          setValidation('invalid', '❌ Wrong category', data.title+' was found, but Wikipedia does not appear to classify it as '+match.cat+'.');
          return {valid:false, reason:'Wrong category'};
        }
        const detail=(data.description || data.extract || 'Wikipedia page found.');
        setValidation('valid', '✅ Valid: '+data.title, detail, data.content_urls && data.content_urls.desktop ? data.content_urls.desktop.page : '');
        const wikiResult={valid:true, title:data.title, description:detail, photo:data.thumbnail&&data.thumbnail.source?data.thumbnail.source:'', categoriesText:data.categoriesText||'', url:data.content_urls && data.content_urls.desktop ? data.content_urls.desktop.page : ''}; if(window.NameDatabase){NameDatabase.cacheWiki(name,wikiResult); NameDatabase.learnFromWikipedia(name,wikiResult,selectedCategory());} return wikiResult;
      }
    }

    const searchUrl='https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&generator=search&gsrsearch='+encodeURIComponent(name)+'&gsrlimit=3&prop=pageprops|description|info&inprop=url';
    res=await fetch(searchUrl);
    const data=await res.json();
    const pages=data && data.query && data.query.pages ? Object.values(data.query.pages) : [];
    const exact=pages.find(p => (p.title||'').toLowerCase() === name.toLowerCase());
    const best=exact || pages[0];

    if(best && best.title){
      best.extract='';
      best.categoriesText=await fetchWikiCategories(best.title);
      const match=categoryMatchesWikipedia(best);
      if(!match.ok){
        setValidation('invalid', '❌ Wrong category', best.title+' was found, but Wikipedia does not appear to classify it as '+match.cat+'.');
        return {valid:false, reason:'Wrong category'};
      }
      setValidation('valid', '✅ Valid: '+best.title, best.description || 'Wikipedia search result found.', best.fullurl || '');
      const wikiResult={valid:true, title:best.title, description:best.description || '', photo:'', categoriesText:best.categoriesText||'', url:best.fullurl||''}; if(window.NameDatabase){NameDatabase.cacheWiki(name,wikiResult); NameDatabase.learnFromWikipedia(name,wikiResult,selectedCategory());} return wikiResult;
    }

    setValidation('invalid', '❌ Invalid', 'No Wikipedia match found for "'+name+'".');
    return {valid:false, reason:'No Wikipedia match found'};
  }catch(e){
    setValidation('invalid', '❌ Wikipedia check failed', 'The request was blocked or the internet connection failed. Try hosting the file or turn off Auto Validate.');
    return {valid:false, reason:'Wikipedia request failed'};
  }finally{
    paused = false;
    $('pauseBtn').textContent='PAUSE';
    $('submitBtn').classList.remove('submitDisabled');
  }
}


async function submitAnswer(turnId=activeTurnId){
 if(!gameActive || turnId!==activeTurnId)return;
 const raw=$('answerInput').value.trim();
 if(!raw)return;
 const info=parseName(raw);
 if(!info){alert('Use a first and last name.');return;}
 const key=info.cleaned.toLowerCase();
 if(used.has(key)){alert('That name has already been used.');return;}
 if(requiredLetter && info.firstInitial!==requiredLetter){alert('That name must start with '+requiredLetter+'.');return;}
 const check=await validateWikipedia(raw);
 if(!gameActive || turnId!==activeTurnId)return;
 if(!check.valid){
   log.push({type:'event',event:'invalid',banner:'WIKIPEDIA COULD NOT VERIFY "'+raw.toUpperCase()+'". PLAYER IS OUT.',status:'bad'});
   giveStrike('Wikipedia validation failed',turnId);
   return;
 }
 activeTurnId++;
 clearTurnTimers();
 const elapsed=(reverseBattle?battleSecs:normalSecs)-seconds;
 if(stats.fastest===null||elapsed<stats.fastest) stats.fastest=elapsed;
 playSfx('sfxNameSubmitted');
 used.add(key);
 const p=players[current];
 stats.names[p.name]=(stats.names[p.name]||0)+1;
 const wasBattle=reverseBattle;
 const wasPreviousDouble=previousWasDouble;
 let result='NORMAL PLAY', status='normal', battleEvent=null, timerUsed=wasBattle?battleSecs:normalSecs;
 const startsWith=requiredLetter||'—', source=requiredSource;
 if(info.isDouble){
   direction*=-1;
   stats.reverses[p.name]=(stats.reverses[p.name]||0)+1;
   if(wasPreviousDouble){
     reverseBattle=true;
     stats.currentBattle++;
     stats.longestBattle=Math.max(stats.longestBattle,stats.currentBattle);
     if(wasBattle){
       result='REVERSE BATTLE CONTINUES';
       status='battle';
     }else{
       result='REVERSE';
       status='reverse';
       battleEvent={type:'event',event:'battleStart',banner:'⚔ REVERSE BATTLE ⚔',status:'battle'};
       showToast('REVERSE BATTLE','30 second timer active','red');
       showReverseBattle(p.name, players[nextAliveIndex(current,direction)]?.name);
     }
     playSfx('sfxReverse');
   }else{
     reverseBattle=false;
     stats.currentBattle=1;
     result='REVERSE';
     status='reverse';
     playSfx('sfxReverse');
     showToast('REVERSE','Direction changed','purple');
   }
   previousWasDouble=true;
   animateDirection();
 }else{
   if(wasBattle){
     result='BATTLE ENDED';
     status='battleend';
     battleEvent={type:'event',event:'battleEnd',banner:'REVERSE BATTLE ENDED. PLAY CONTINUES '+(direction===1?'CLOCKWISE':'COUNTERCLOCKWISE')+'.',status:'ended'};
     showToast('BATTLE ENDED','Back to 45 seconds','purple');
   }
   reverseBattle=false;
   previousWasDouble=false;
   stats.currentBattle=0;
 }
 const entry={type:'play',turn:turn++,player:p.name,color:p.color,celebrity:info.cleaned,info,validation:(check.description||check.title||'Wikipedia verified'),photo:(check.photo||''),startsWith,source,result,status,timerUsed};
 log.push(entry);
 lastLogIndex=log.length-1;
 if(battleEvent) log.push(battleEvent);
 chain.push(entry);
 requiredLetter=info.lastInitial;
 requiredSource=info.last;
 current=nextAliveIndex(current,direction);
 $('answerInput').value='';
 beginTurn();
}

function giveStrike(reason,turnId=activeTurnId){
 if(!gameActive || turnId!==activeTurnId)return;
 activeTurnId++;
 clearTurnTimers();
 const p=players[current];
 if(!p || p.out)return;
 p.strikes=1;
 p.out=true;
 log.push({type:'strike',turn:turn++,player:p.name,color:p.color,celebrity:'—',info:null,startsWith:requiredLetter||'—',source:requiredSource,result:reason,status:'bad',timerUsed:seconds});
 log.push({type:'event',event:'out',banner:p.name.toUpperCase()+' IS OUT!',status:'bad'});
 lastLogIndex=null;
 previousWasDouble=false;
 reverseBattle=false;
 stats.currentBattle=0;
 if(players.filter(x=>!x.out).length<=1){render();endGame();return;}
 current=nextAliveIndex(current,direction);
 beginTurn();
}

function rejectLastName(){
 if(lastLogIndex===null||!log[lastLogIndex])return;
 const entry=log[lastLogIndex];
 const idx=players.findIndex(p=>p.name===entry.player);
 if(idx<0)return;
 used.delete((entry.celebrity||'').toLowerCase());
 chain=chain.filter(x=>x!==entry);
 log.push({type:'event',event:'challenge',banner:'CHALLENGE SUCCESSFUL. '+entry.player.toUpperCase()+' IS OUT.',status:'bad'});
 current=idx;
 previousWasDouble=false;
 reverseBattle=false;
 stats.currentBattle=0;
 giveStrike('Invalid answer');
}

function endGame(){
 clearTurnTimers();
 gameActive=false;
 const winner=players.find(p=>!p.out);
 $('winnerTitle').textContent=winner?winner.name+' Wins!':'Game Over';
 $('winnerMsg').textContent=winner?'Last player standing in '+categoryValue()+'.':'No players left.';
 $('endStats').innerHTML=endStatsHtml();
 $('winnerModal').classList.remove('hidden');
}

function topStat(obj){
 let best='—',val=-1;
 Object.entries(obj).forEach(([k,v])=>{if(v>val){best=k;val=v}});
 return val>0?best+' ('+val+')':'—';
}

function endStatsHtml(){
 return `<div class="statsLine"><span>Most Names</span><span>${topStat(stats.names)}</span></div><div class="statsLine"><span>Most Reverses</span><span>${topStat(stats.reverses)}</span></div><div class="statsLine"><span>Longest Reverse Battle</span><span>${stats.longestBattle||0} names</span></div><div class="statsLine"><span>Fastest Answer</span><span>${stats.fastest===null?'—':stats.fastest+'s'}</span></div>`;
}

function renderPlayers(){
 $('players').innerHTML=players.map((p,i)=>{
   const status=p.out?'OUT':'LIVE';
   return `<div class="player ${i===current&&!p.out?'active':''} ${p.out?'out':''}"><div class="num" style="background:${p.color}">${i+1}</div><div class="avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div><div class="pname">${p.name.toUpperCase()}</div><div class="strikeDots" style="font-family:Arial,sans-serif;font-weight:1000;color:${p.out?'var(--red)':'var(--green)'}">${status}</div></div>`;
 }).join('');
}

function renderLog(){
 let html='';
 log.forEach(item=>{
   if(item.type==='event' || item.banner){
     const cls=item.status==='bad'?'red':item.status==='ended'?'green':item.status==='battle'?'purple':'purple';
     html+=`<div class="banner ${cls}">${item.banner}</div>`;
     return;
   }
   const celeb=celebrityCell(item);
   let statusClass='normal', statusText='✓ '+item.result;
   if(item.status==='reverse'){statusClass='reverse';statusText='↺ REVERSE';}
   else if(item.status==='battle'){statusClass='reverse';statusText='⚔ REVERSE BATTLE CONTINUES';}
   else if(item.status==='battleend'){statusClass='normal';statusText='✓ BATTLE ENDED';}
   else if(item.status==='bad'){statusClass='bad';statusText='✖ '+item.result;}
   html+=`<div class="logRow"><div class="turnNum" style="color:${item.color||'var(--red)'}">${item.turn}</div><div class="turnPlayer"><div class="avatar" style="width:42px;height:42px;background:${item.color||'var(--red)'}">${item.player?item.player[0]:'!'}</div>${(item.player||'EVENT').toUpperCase()}</div><div class="celebrity">${celeb}</div><div class="req" style="font-size:14px;text-align:left;color:white">${item.validation||''}</div><div class="result"><span class="${statusClass}">${statusText}</span></div><div class="timeCell ${item.status==='battle'||item.status==='reverse'&&item.timerUsed===30?'red':''}">${item.timerUsed||''}${item.timerUsed?'s':''}</div></div>`;
 });
 const p=players[current];
 if(p && !p.out && gameActive){
   html+=`<div class="logRow current"><div class="turnNum" style="color:${p.color}">${turn}</div><div class="turnPlayer"><div class="avatar" style="width:42px;height:42px;background:${p.color}">${p.name[0]}</div>${p.name.toUpperCase()}</div><div class="celebrity" style="color:${p.color}">YOUR TURN!<br><small style="font-size:17px;color:white">Needs a name that starts with ${requiredLetter||'anything'}</small></div><div class="req">${requiredLetter||'—'}<small>${requiredSource!=='Start'?'('+requiredSource+')':''}</small></div><div></div><div class="timeCell ${reverseBattle?'red':''}">${reverseBattle?30:normalSecs}s</div></div>`;
 }
 $('log').innerHTML=html;
 $('log').scrollTop=$('log').scrollHeight;
}


function celebrityCell(item){
 const nameHtml=item.info?highlightName(item.info):item.celebrity;
 const desc=item.validation||'';
 const img=item.photo;
 const fallback=(item.celebrity||'?').trim()[0]||'?';
 const media=img
   ? `<img class="celebPhoto" src="${img}" alt="${item.celebrity||'photo'}" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=&quot;celebPhoto placeholder&quot;>?</div>'">`
   : `<div class="celebPhoto placeholder">${fallback.toUpperCase()}</div>`;
 return `<div class="celebCell">${media}<div class="celebText"><div>${nameHtml}</div></div></div>`;
}

function highlightName(info){
 const mid=info.cleaned.split(' ').slice(1,-1).join(' ');
 return `<span class="firstLetter">${info.first[0]}</span>${info.first.slice(1)} ${mid?mid+' ':''}<span class="lastLetter">${info.last[0]}</span>${info.last.slice(1)}`;
}

function renderHero(){
 const p=players[current];
 if(!p){return;}
 $('heroPlayer').textContent=p.out?'GAME OVER':p.name.toUpperCase()+"'S TURN";
 $('heroNeed').innerHTML='Needs <b>'+(requiredLetter||'ANY')+'</b>';
 $('heroSub').textContent=reverseBattle?'Reverse Battle is active. This player only has 30 seconds.':(requiredSource==='Start'?'Start the chain with any valid name.':'Previous last name: '+requiredSource+'. Normal 45 second turn.');
}

function animateDirection(){
 const box=$('directionBox');
 if(!box)return;
 box.classList.remove('flip');
 void box.offsetWidth;
 box.classList.add('flip');
}

function render(){
 renderPlayers();
 renderLog();
 renderHero();
 const alive=players.filter(p=>!p.out).length;
 $('aliveCount').textContent=alive+' / '+players.length;
 $('dirArrow').textContent=direction===1?'→':'←';
 $('dirText').textContent=direction===1?'CLOCKWISE':'COUNTERCLOCKWISE';
 $('battleText').textContent=reverseBattle?'REVERSE BATTLE':'NORMAL PLAY';
 $('battleText').className='mode '+(reverseBattle?'battle':'');
}

$('categoryPreset').onchange=()=>{
 $('categoryInput').classList.toggle('hidden',$('categoryPreset').value!=='Custom');
 if($('categoryPreset').value!=='Custom')$('categoryInput').value=$('categoryPreset').value;
};
$('startBtn').onclick=()=>startGame();
$('submitBtn').onclick=()=>submitAnswer();
$('answerInput').addEventListener('keydown',e=>{if(e.key==='Enter')submitAnswer()});
$('skipBtn').onclick=()=>giveStrike('Strike taken');
$('pauseBtn').onclick=()=>{paused=!paused;$('pauseBtn').textContent=paused?'RESUME':'PAUSE'};
$('settingsBtn').onclick=()=>$('setupBox').classList.toggle('hidden');
$('newBtn').onclick=()=>{clearTurnTimers();gameActive=false;$('setupBox').classList.remove('hidden')};
$('closeWinner').onclick=()=>$('winnerModal').classList.add('hidden');
$('winnerNew').onclick=()=>location.reload();
$('challengeBtn').onclick=()=>{
 paused=true;
 $('pauseBtn').textContent='RESUME';
 const last=lastLogIndex!==null?log[lastLogIndex]:null;
 $('challengeName').textContent=last?'Last answer: '+last.celebrity+' by '+last.player:'No answer to challenge yet.';
 $('challengeModal').classList.remove('hidden');
};
$('cancelChallenge').onclick=()=>{$('challengeModal').classList.add('hidden')};
$('acceptChallenge').onclick=()=>{$('challengeModal').classList.add('hidden');paused=false;$('pauseBtn').textContent='PAUSE'};
$('rejectChallenge').onclick=()=>{$('challengeModal').classList.add('hidden');paused=false;$('pauseBtn').textContent='PAUSE';rejectLastName()};

function rollAIDifficulty(){
 const mode=document.getElementById('aiDifficulty')?.value || 'Random';
 if(mode!=='Random') return mode;
 const r=Math.random();
 if(r<0.45) return 'Expert';
 if(r<0.70) return 'Hard';
 if(r<0.90) return 'Medium';
 return 'Easy';
}
function buildPlayerInputs(){
 const c=Number(document.getElementById('playerCountSelect').value);
 const box=document.getElementById('playerInputs');
 let h='';
 for(let i=1;i<=c;i++) h+=`<input placeholder="Player ${i}" value="Player ${i}" style="margin-bottom:8px">`;
 box.innerHTML=h;
}
buildPlayerInputs();
document.getElementById('playerCountSelect').onchange=buildPlayerInputs;
document.getElementById('launchGameBtn').onclick=()=>{
 const names=[...document.querySelectorAll('#playerInputs input')].map(x=>x.value.trim()).filter(Boolean);
 const aiCount=Number(document.getElementById('aiCountSelect').value);
 const aiPool=['Atlas','Nova','Phoenix','Maverick','Titan','Rogue','Echo','Vega','Blaze','Onyx','Storm','Jinx','Rocket','Ace','Bolt','Falcon','Ghost','Havoc','Saber','Drift','Comet','Orbit','Shadow','Frost','Ember','Knox','Raven','Diesel','Bandit'];
 const shuffled=[...aiPool].sort(()=>Math.random()-0.5);
 for(let i=0;i<aiCount;i++) names.push('[AI]['+rollAIDifficulty()+'] '+shuffled[i]);
 document.getElementById('namesInput').value=names.join('\n');
 const chosenCat=document.getElementById('startCategory').value;
 document.getElementById('categoryPreset').value=chosenCat;
 gameCategory=chosenCat;
 document.getElementById('startScreen').style.display='none';
 startGame();
};

// Database preload. Game still works if fetch is blocked by file://, but large JSON databases require a local server.
if(window.NameDatabase){ NameDatabase.loadAll().catch(e=>console.warn('NameDatabase preload failed:', e)); }
