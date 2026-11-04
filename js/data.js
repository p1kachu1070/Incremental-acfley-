/* except you. — all the words, and the numbers that hold them up. */
(function (root) {
  'use strict';

  const DATA = {};

  /* ------------------------------------------------------------------ */
  /*  habits: the generators. every one of them is a way of not sleeping */
  /* ------------------------------------------------------------------ */
  DATA.gens = [
    {
      id: 'replay', act: 1, cost: 12, rate: 0.3,
      name: 'replay the conversation',
      desc: "in this version you're funnier.",
      glitch: 'you sounded so stupid',
      release: 'stop replaying it',
      releaseLine: 'it happened. you said what you said. it was fine. it was human.',
    },
    {
      id: 'phone', act: 1, cost: 75, rate: 1.4,
      name: 'check your phone',
      desc: 'no new messages. check again.',
      glitch: 'nothing. nothing. nothing.',
      release: 'put the phone face down',
      releaseLine: 'the screen goes dark. the room gets darker, and somehow bigger.',
    },
    {
      id: 'reread', act: 1, cost: 850, rate: 8,
      name: 'reread old texts',
      desc: "the last one says 'haha yeah'. you've read it four hundred times.",
      glitch: 'haha yeah haha yeah haha yeah',
      release: 'stop rereading',
      releaseLine: "'haha yeah.' it was just a text. it was never a verdict on you.",
    },
    {
      id: 'imagine', act: 1, cost: 13000, rate: 52,
      name: 'imagine scenarios',
      desc: 'in this one, they come back. in this one, you were enough.',
      glitch: 'in this one you ruin it again',
      release: 'stop imagining',
      releaseLine: "they're not coming back. you let yourself know it, all the way down. it hurts in a clean way, like cold water.",
    },
    {
      id: 'scroll', act: 2, cost: 150000, rate: 300,
      name: 'doomscroll',
      desc: 'a couple in paris. a couple in a kitchen. a couple. a couple.',
      glitch: 'everyone. everyone. everyone.',
      release: 'close the app',
      releaseLine: 'a couple in paris. good for them. really. good for them.',
    },
    {
      id: 'compare', act: 2, cost: 1.6e6, rate: 1700,
      name: 'compare yourself',
      desc: 'they make it look so easy.',
      glitch: 'look at them. now look at you.',
      release: 'stop comparing',
      releaseLine: "they have their thing. you'll have yours. it was never a race. nobody was even running.",
    },
    {
      id: 'drafts', act: 2, cost: 2.2e7, rate: 9500,
      name: "write texts you won't send",
      desc: 'drafts: "hey" · "hey stranger" · "i miss" · "never mind"',
      glitch: 'delete delete delete delete',
      release: 'stop drafting',
      releaseLine: "you don't delete the drafts. you just stop writing new ones. that's enough for tonight.",
    },
    {
      id: 'song', act: 2, cost: 3.4e8, rate: 56000,
      name: 'play the song again',
      desc: 'the slowed one. with the rain in it.',
      glitch: 'it was never about you',
      release: 'let the song end',
      releaseLine: "you let it end. you don't play it again. the rain outside is real, and it's quieter.",
    },
    {
      id: 'wrong', act: 3, cost: 6e9, rate: 330000,
      name: "wonder what's wrong with you",
      desc: 'there has to be a reason. there has to be.',
      glitch: 'everything. everything. everything.',
      release: 'stop looking for the flaw',
      releaseLine: "nothing is wrong with you. you're tired. it's five in the morning. everything is wrong at five in the morning.",
    },
    {
      id: 'argue', act: 3, cost: 9e10, rate: 2.1e6,
      name: 'argue with yourself',
      desc: 'you lose. you also win. you also lose.',
      glitch: 'shut up shut up shut up',
      release: 'stop arguing',
      releaseLine: "you stop. you let the other side have the last word. it doesn't know what to do with that.",
    },
    {
      id: 'cracks', act: 3, cost: 1.4e12, rate: 1.4e7,
      name: 'count the cracks in the ceiling',
      desc: '412. 413. you lost count. start over.',
      glitch: '1 2 3 4 5 6 7 8 9 10 11 12',
      release: 'stop counting',
      releaseLine: 'the cracks have always been there. the ceiling is still up.',
    },
    {
      id: 'voice', act: 3, cost: Infinity, rate: 5000, auto: true,
      name: 'the voice',
      desc: "you didn't buy this. it came with the noise.",
      glitch: 'i am you i am you i am',
      release: 'let the voice go',
      releaseLine: '',
    },
  ];

  /* ------------------------------------------------------------------ */
  /*  upgrades: one-time things you do to yourself                       */
  /*  gen: multiplies one habit · all: multiplies everything             */
  /* ------------------------------------------------------------------ */
  DATA.upgrades = [
    // act 1
    { id: 'headphones', act: 1, cost: 120, gen: 'replay', mult: 2,
      req: s => s.gens.replay >= 1,
      name: 'headphones in', line: 'the conversation sounds clearer in stereo.' },
    { id: 'brightness', act: 1, cost: 650, gen: 'phone', mult: 2,
      req: s => s.gens.phone >= 1,
      name: 'brightness all the way down', line: "so it won't hurt your eyes. it isn't your eyes that hurt." },
    { id: 'overthink', act: 1, cost: 900, click: 0.03,
      req: s => s.lifetime >= 400,
      name: 'overthink', line: 'every thought has a thought about it now.' },
    { id: 'rewrite', act: 1, cost: 2600, gen: 'replay', mult: 2,
      req: s => s.gens.replay >= 10,
      name: 'rewrite your lines', line: 'you were so close to being charming. so close.' },
    { id: 'logic', act: 1, cost: 3500, all: 1.5,
      req: s => s.lifetime >= 2000,
      name: '3 am logic', line: "everything makes sense at 3 am. that's the problem." },
    { id: 'screenshot', act: 1, cost: 5000, gen: 'reread', mult: 2,
      req: s => s.gens.reread >= 1,
      name: 'screenshot everything', line: "evidence. of what, you're not sure." },
    { id: 'curtains', act: 1, cost: 6500, story: 'act2',
      req: s => s.lifetime >= 4000,
      name: 'open the curtains', line: '' },
    { id: 'online', act: 1, cost: 16000, gen: 'phone', mult: 2,
      req: s => s.gens.phone >= 10,
      name: "check if they're online", line: 'they are. not for you, but they are.' },

    // act 2
    { id: 'soundtrack', act: 2, cost: 90000, gen: 'imagine', mult: 2,
      req: s => s.gens.imagine >= 5,
      name: 'give it a soundtrack', line: 'every daydream needs a song. yours are all slowed down.' },
    { id: 'notifs', act: 2, cost: 250000, all: 1.25, notifs: true,
      req: s => s.act >= 2 && s.lifetime >= 120000,
      name: 'turn notifications on', line: 'just in case. just in case. just in case.' },
    { id: 'darkmode', act: 2, cost: 700000, gen: 'scroll', mult: 2,
      req: s => s.gens.scroll >= 1,
      name: 'dark mode', line: 'easier on the eyes. you can scroll for hours like this.' },
    { id: 'zoom', act: 2, cost: 7e6, gen: 'compare', mult: 2,
      req: s => s.gens.compare >= 1,
      name: 'zoom in', line: 'on their hands. on their faces. until it is only pixels.' },
    { id: 'romanticize', act: 2, cost: 4e7, all: 2, longing: 2,
      req: s => s.act >= 2 && E.stagesTotal(s) >= 10,
      name: 'romanticize it', line: "you're the main character. the main character is alone in the rain. it's an aesthetic." },
    { id: 'outloud', act: 2, cost: 1.2e8, gen: 'drafts', mult: 2,
      req: s => s.gens.drafts >= 1,
      name: 'read them out loud', line: 'your voice sounds strange in the empty room.' },
    { id: 'fine', act: 2, cost: 4e8, all: 1.5,
      req: s => s.gens.drafts >= 5,
      name: "it's fine", line: "it's fine. it's fine. it's fine. it's fine." },
    { id: 'slowed', act: 2, cost: 1.5e9, gen: 'song', mult: 3,
      req: s => s.gens.song >= 1,
      name: 'slowed + reverb', line: 'it sounds like being underwater inside a memory.' },

    // act 3
    { id: 'flaws', act: 3, cost: 3e10, gen: 'wrong', mult: 2,
      req: s => s.gens.wrong >= 1,
      name: 'make a list of your flaws', line: 'it runs out of paper before you run out of flaws.' },
    { id: 'stop1', act: 3, cost: 4e11, all: 3, voices: 4,
      req: s => s.act >= 3 && s.actT > 20,
      name: 'make it stop', line: 'it does not stop. it gets louder.' },
    { id: 'win', act: 3, cost: 6e11, gen: 'argue', mult: 2,
      req: s => s.gens.argue >= 1,
      name: 'win the argument', line: 'you win. the other side was also you. so you lose.' },
    { id: 'again', act: 3, cost: 9e12, gen: 'cracks', mult: 2,
      req: s => s.gens.cracks >= 1,
      name: 'count them again', line: 'there are more than last time. there are always more.' },
    { id: 'stop2', act: 3, cost: 1.5e14, all: 3, voices: 8,
      req: s => s.upgrades.stop1,
      name: 'make it stop.', line: "it doesn't. it can't. it won't." },
    { id: 'stop3', act: 3, cost: 3e16, story: 'act4',
      req: s => s.upgrades.stop2,
      name: 'MAKE IT STOP', line: '' },
  ];

  /* ------------------------------------------------------------------ */
  /*  the building across the street. floors 2–6, units a–d               */
  /* ------------------------------------------------------------------ */
  DATA.windows = [
    { id: '2a', pose: 'sit', hue: 38, lines: [
      "an old couple. he's reading out loud. she's pretending to be asleep so he won't stop.",
      "she's asleep for real now. he keeps reading anyway. quieter.",
      "he marks the page. he'll start from there tomorrow. he always does.",
    ] },
    { id: '2c', pose: 'pair', hue: 30, lines: [
      'two people burning something in a pan, laughing too hard to fix it.',
      "the smoke alarm goes off. they're dancing under it.",
      'they eat it anyway. at three in the morning. sitting on the kitchen floor.',
    ] },
    { id: '2d', pose: 'pair', hue: 26, lines: [
      'a couple arguing. you can see it in their shoulders.',
      'one of them leaves the room. comes back. holds out a hand.',
      "they're fine. just like that. you don't know how people do that.",
    ] },
    { id: '3a', pose: 'sit', hue: 210, lines: [
      "two teenagers. a first date, or close to it. a movie neither of them is watching.",
      'their hands are an inch apart on the couch. the inch is enormous.',
      'the inch closes.',
    ] },
    { id: '3b', pose: 'pair', hue: 42, lines: [
      'a nurse just got home. someone left the hallway light on for her.',
      "there's a plate in the microwave. a note on the fridge.",
      'she reads the note twice. she puts it in her pocket. she keeps all of them.',
    ] },
    { id: '3d', pose: 'screen', hue: 220, lines: [
      'someone on a video call. long distance. the laptop light on their face.',
      "neither of them is talking. they're just there. together.",
      "the other one fell asleep. this one doesn't hang up.",
    ] },
    { id: '4a', pose: 'sit', hue: 34, lines: [
      'two girls on the fire escape, sharing one pair of earbuds.',
      'one leans her head on the other one’s shoulder. the song ends. neither of them moves.',
      "she says something. the other one laughs and says 'yeah. me too.'",
    ] },
    { id: '4c', pose: 'dog', hue: 40, lines: [
      'a man practicing a proposal. to his dog.',
      'the dog is not impressed. he tries again, on one knee this time.',
      'he puts the ring back in its box. tomorrow. his hands are shaking. the good kind.',
    ] },
    { id: '5b', pose: 'pair', hue: 22, lines: [
      "they're slow dancing. there's no music.",
      'you can almost hear it anyway. something old. something with strings.',
      "they've stopped moving. they're just holding on.",
    ] },
    { id: '5d', pose: 'baby', hue: 44, lines: [
      'a new parent pacing the floor with something very small.',
      'the other parent takes the baby without being asked.',
      'the first one falls asleep sitting up. the other one covers them with a blanket.',
    ] },
    { id: '6a', pose: 'sit', hue: 18, lines: [
      'two old friends. a bottle of wine. a card game nobody is winning.',
      'one of them is crying. the other one just moves closer.',
      "they're laughing again. you don't know about what. it's the kind of laughing you can't fake.",
    ] },
    { id: '6c', pose: 'paint', hue: 36, lines: [
      'someone painting a portrait. the person in it is asleep on the couch.',
      'they keep stopping to look. not at the painting.',
      "they sign it. not with their name. they write 'us'.",
    ] },
    // the rest of the building
    { id: '2b', pose: 'dark', text: 'dark. curtains drawn.' },
    { id: '3c', pose: 'cat', hue: 32, text: 'a cat on the windowsill. it stares at you like it knows.' },
    { id: '4b', pose: 'rent', text: "for rent. it's been for rent for a long time." },
    { id: '4d', pose: 'dark', text: 'dark.' },
    { id: '5a', pose: 'lamp', hue: 40, text: 'a lamp left on in an empty room. someone forgot. or someone is coming back.' },
    { id: '5c', pose: 'dark', text: 'dark.' },
    { id: '6b', pose: 'dark', text: 'dark.' },
    { id: '6d', pose: 'single', hue: 215, text: 'dark. top floor.' },
  ];
  // the order the building wakes up in
  DATA.lightOrder = ['2c', '5b', '3a', '3c', '4a', '2a', '6a', '5a', '3b', '4c', '3d', '5d', '2d', '6c'];
  DATA.storyWindowIds = DATA.windows.filter(w => w.lines).map(w => w.id);

  DATA.longingByStage = [0, 0.4, 1.2, 3];
  DATA.stageCost = { 2: 20, 3: 80, growth: 1.3 };
  DATA.windowStageMult = 1.12;
  DATA.lightInterval = 38; // seconds between windows waking up

  DATA.catLines = [
    'it slow-blinks at you. cats do that when they trust someone. you’ll take it.',
    'it blinks again. you blink back. this is the most romantic thing that has happened to you all year.',
    'the cat has gone to sleep. it trusted you enough to do that.',
  ];

  /* ------------------------------------------------------------------ */
  /*  the first thoughts, in order. then the rest, at random.           */
  /* ------------------------------------------------------------------ */
  DATA.firstThoughts = [
    'you think about the way they said your name.',
    'you think about something you said in 2019. you wince in the dark.',
    'you think about whether anyone is thinking about you right now.',
    "you think about how you'd answer if someone asked 'are you happy'.",
    'you think about the last time someone held your hand. you can’t remember. that’s worse.',
    "you think about texting them. you don't.",
    'you think about the ceiling. there’s a crack in it shaped like a river.',
    'you think about how everyone else seems to know how to do this.',
    "you think about being someone's first call.",
    'you think about how loud the fridge is.',
    'you think about a song. not the whole song. just the part that hurts.',
    'you think about being chosen. on purpose. by someone who could have chosen anyone.',
    "you think about how 'fine' is a word you say a lot.",
    "you think about what they're doing right now. probably sleeping. probably not alone.",
    "you think about thinking. you think about how you can't stop.",
  ];
  DATA.moreThoughts = [
    'you think about a stranger who smiled at you once, in march.',
    'you think about getting old. in this version, alone.',
    'you think about the group chat that went quiet.',
    "you think about whether you're hard to love or just hard to find.",
    "you think about the word 'almost'.",
    'you think about that one photo where you look happy. you were, a little.',
    "you think about how nobody has seen you cry in years.",
    "you think about how you'd be good at it. loving someone. you think you would.",
    'you think about how love songs are about someone. yours are about no one in particular.',
    "you think about 'we should hang out sometime'. sometime never came.",
    "you think about the warmth of another person's back. you think you remember it.",
    'you think about what you would say if they called right now. you rehearse it. they don’t call.',
    'you think about being the person someone tells good news to first.',
    'you think about how quiet your phone has been for a year.',
    'you think about that night you almost said it.',
    'you think about whether people can tell, just by looking at you.',
  ];

  // drifting fragments behind everything
  DATA.fragments = [
    'haha yeah', 'are you up?', 'what if', 'u up', 'seen 3:02 am', "it's fine", 'why not me',
    'you could text them', "don't", 'remember when', 'almost', 'someday', 'never mind', 'delivered',
    'read 11:48 pm', 'typing…', 'we should hang out sometime', "i'm fine", 'sorry', 'lol', 'ok',
    'sorry for being weird', 'happy for them', 'is it me', 'one day', 'what did i do', 'miss u',
    'nvm', 'good night', 'last seen recently', 'hey stranger',
  ];
  DATA.loudFragments = [
    'too much', 'not enough', 'they could tell', 'why are you like this', 'everyone else gets to',
    "what's wrong with you", 'say something', 'no. not that', 'it was you', 'they were being polite',
    'always like this', 'unlovable', 'stop', 'STOP', 'haha yeah', 'seen', 'pathetic', 'again',
    'they all have someone', 'you ruin it', 'why', 'shut up',
  ];

  /* ------------------------------------------------------------------ */
  /*  the quiet voice. it was there the whole time.                       */
  /* ------------------------------------------------------------------ */
  DATA.whispers = [
    'drink some water.',
    "you've survived every 3 am so far.",
    "you don't have to figure out your whole life tonight.",
    "it's just the dark talking.",
    "the people who love you are asleep. that's all it is.",
    'you were kind to someone today. remember?',
    "feelings aren't facts.",
    "it's okay to be lonely. it doesn't mean you're unlovable.",
    "this is a bad night. it isn't a bad life.",
    "you're allowed to rest.",
    "you're still here. that counts.",
    "i'm still here.", // the last one only comes in the dark
  ];

  /* ------------------------------------------------------------------ */
  /*  the loud voice. it knows your numbers.                              */
  /* ------------------------------------------------------------------ */
  DATA.voiceLines = [
    'you know why they left.',
    "everyone can tell. they're just polite about it.",
    "look at the number. that's how much you think about them.",
    'you checked your phone {phone} times tonight. they checked theirs zero times for you.',
    'you clicked {clicks} times tonight. for what.',
    "window {fav}. you liked that one. you'll never have that.",
    "it's {clock}. normal people are asleep. people with someone are asleep.",
    "you're too much. you're not enough. pick one.",
    "you could stop clicking. you won't.",
    'they were just being nice to you. that was all it ever was.',
    "you'll be like this forever. you know that, right?",
    'say something. no. not that.',
    "the windows are going dark. they're all asleep. together.",
    'why are you like this.',
    'you were almost something to someone. almost.',
    "'haha yeah.' that was the last thing. that was all of it.",
    'you watched strangers for {watch} minutes tonight. did it help.',
  ];
  DATA.voiceMissed = 'you let {missed} quiet little voices go by tonight. you didn’t even notice them.';

  /* ------------------------------------------------------------------ */
  /*  the phone                                                           */
  /* ------------------------------------------------------------------ */
  DATA.notifs = [
    { from: '@jules', text: 'posted: 1 year with my favorite human \u{1F90D}' },
    { from: '@nora.k', text: 'is now in a relationship with @theo' },
    { from: '@danny', text: "posted a photo with @mia: 'my person'" },
    { from: 'memories', text: 'you have a memory from 2 years ago. tap to see.' },
    { from: '@priya', text: 'added to their story: wedding dress shopping!!' },
    { from: '@marcus', text: 'posted: she said yes \u{1F48D}' },
    { from: 'your story', text: 'was viewed by 3 people. not them.' },
    { from: '@sophie', text: "posted: 'happy anniversary to us'" },
    { from: '@kai', text: 'posted: moving in together!!! \u{1F4E6}' },
    { from: '@ellie', text: "commented on @ben's photo: 'mine \u{1F60C}'" },
    { from: 'suggested', text: 'couples you might know' },
    { from: '@rosa', text: 'posted: date night \u{1F35D}' },
  ];
  DATA.notifOpened = [
    "it wasn't them.",
    "it wasn't them. it's never them.",
    "you look anyway. you're happy for them. you are. you are.",
    'you like the post. you unlike it. you like it again.',
    'you look at it for a long time.',
  ];
  DATA.loudNotifs = [
    { from: 'them', text: 'online', open: "they're online. not for you, but they're online." },
    { from: 'them', text: 'typing…', typing: true, open: 'it was nothing. it’s always nothing.' },
    { from: 'messages', text: 'no new messages', open: 'no new messages.' },
    { from: 'them', text: 'last seen just now', open: 'just now. they were right there. just now.' },
    { from: 'messages', text: 'no new messages', open: 'no new messages. no new messages.' },
  ];

  /* ------------------------------------------------------------------ */
  /*  the clock                                                           */
  /* ------------------------------------------------------------------ */
  DATA.clock = {
    start: 3 * 60 + 7,
    secondsPerMinute: 9,
    caps: { 1: 3 * 60 + 59, 2: 4 * 60 + 43, 3: 5 * 60 + 30, 4: 6 * 60 + 11, 5: 6 * 60 + 12 },
    lines: {
      [3 * 60 + 33]: '3:33 am. you used to make wishes on times like this.',
      [3 * 60 + 47]: 'the fridge stops humming. the quiet is worse.',
      [4 * 60 + 0]: '4:00 am. the hour that belongs to no one.',
      [4 * 60 + 20]: 'a car passes. its headlights crawl across the ceiling and leave.',
      [5 * 60 + 0]: '5:00 am. a bird tries once. it gives up.',
      [5 * 60 + 45]: 'the first bus goes by outside. empty. it goes anyway.',
      [6 * 60 + 0]: '6:00 am.',
    },
  };

  /* ------------------------------------------------------------------ */
  /*  act 4                                                              */
  /* ------------------------------------------------------------------ */
  DATA.releaseCosts = [16, 34, 58, 86, 120, 160, 204, 252, 306, 366, 432, 500];
  DATA.quietPerRelease = 0.42;
  DATA.breathBase = 6;
  DATA.breathFull = 4; // seconds of inhale for a full breath

  DATA.ending = {
    connected: 'even you.',
    both: 'even you. especially you.',
    self: 'starting with you.',
    neither: 'you too. eventually. sleep first.',
  };

  root.DATA = DATA;

  /* ------------------------------------------------------------------ */
  /*  economy. pure functions of state, shared with tools/sim.js         */
  /* ------------------------------------------------------------------ */
  const E = {};
  E.gen = id => DATA.gens.find(g => g.id === id);
  E.genCost = (g, n) => Math.ceil(g.cost * Math.pow(1.15, n));
  E.stagesTotal = s => DATA.storyWindowIds.reduce((a, id) => a + (s.windows[id] || 0), 0);
  E.genMult = (s, id) => {
    let m = 1;
    for (const u of DATA.upgrades) if (s.upgrades[u.id] && u.gen === id) m *= u.mult;
    return m;
  };
  E.globalMult = s => {
    let m = 1;
    for (const u of DATA.upgrades) if (s.upgrades[u.id] && u.all) m *= u.all;
    m *= Math.pow(DATA.windowStageMult, E.stagesTotal(s));
    if (s.act >= 3) m *= Math.pow(1.08, s.gens.voice || 0);
    return m;
  };
  E.genRate = (s, g) => g.rate * E.genMult(s, g.id) * E.globalMult(s);
  E.production = s => {
    if (s.act >= 4) return 0;
    const gm = E.globalMult(s);
    let p = 0;
    for (const g of DATA.gens) p += g.rate * (s.gens[g.id] || 0) * E.genMult(s, g.id) * gm;
    return p;
  };
  E.clickValue = s => {
    let pct = 0;
    for (const u of DATA.upgrades) if (s.upgrades[u.id] && u.click) pct += u.click;
    const base = 1 + (s.act >= 2 ? 4 : 0) + (s.act >= 3 ? 40 : 0);
    return (base + pct * E.production(s)) * (s.act >= 2 ? Math.pow(DATA.windowStageMult, E.stagesTotal(s) / 2) : 1);
  };
  E.longingMult = s => {
    let m = 1;
    for (const u of DATA.upgrades) if (s.upgrades[u.id] && u.longing) m *= u.longing;
    return m;
  };
  E.longingRate = s => {
    if (s.act !== 2) return 0;
    let r = 0;
    for (const id of DATA.storyWindowIds) r += DATA.longingByStage[s.windows[id] || 0];
    return r * E.longingMult(s);
  };
  E.stageCost = (s, stage) => {
    const already = DATA.storyWindowIds.filter(id => (s.windows[id] || 0) >= stage).length;
    return Math.ceil(DATA.stageCost[stage] * Math.pow(DATA.stageCost.growth, already));
  };
  E.quietMult = s => {
    let m = 1 + 0.05 * (s.stats.kept || []).length;
    if (s.flags.sam === 'call') m *= 1.6;
    else if (s.flags.sam === 'truth') m *= 1.4;
    else if (s.flags.sam === 'fine') m *= 1.15;
    if (s.flags.waved) m *= 1.3;
    else if (s.flags.curtain) m *= 1.15;
    if (s.flags.cat) m *= 1.05;
    return m;
  };
  E.quietRate = s => DATA.quietPerRelease * s.released.length * E.quietMult(s);
  E.breathQuiet = (s, held) => {
    if (held < 0.9) return 0;
    const f = Math.min(1, held / DATA.breathFull);
    return DATA.breathBase * f * f * E.quietMult(s);
  };
  E.releaseCost = s => DATA.releaseCosts[Math.min(s.released.length, DATA.releaseCosts.length - 1)];

  root.E = E;
})(typeof window !== 'undefined' ? window : globalThis);
