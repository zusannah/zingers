/* Zingers sound: original music and effects, synthesised live with the Web Audio API.
   Nothing is downloaded. Only the host screen makes sound. */
window.ZingSound = (function(){
  "use strict";
  var ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  var muted = false, musicOn = false, schedTimer = null, nextTime = 0, step = 0;
  try{ muted = localStorage.getItem("zing-mute") === "1"; }catch(e){}

  var BPM = 116, SIXTEENTH = 60 / BPM / 4;
  function mtof(m){ return 440 * Math.pow(2, (m - 69) / 12); }

  function init(){
    try{
      if(ctx){ if(ctx.state === "suspended") ctx.resume(); return true; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return false;
      ctx = new AC();
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85;
      master.connect(comp); comp.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.45; musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for(var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    }catch(e){ ctx = null; return false; }
  }

  /* ---------- building blocks ---------- */
  function tone(o){
    var t = o.t, dur = o.dur || 0.15, vol = o.vol == null ? 0.2 : o.vol;
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "square";
    osc.frequency.setValueAtTime(o.f, t);
    if(o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || dur));
    if(o.vib){
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vib; lg.gain.value = o.vibDepth || 6;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.3);
    }
    var node = osc;
    if(o.lp){ var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.bus || sfxBus);
    var a = o.attack || 0.005, r = o.release || 0.06;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, t + Math.max(a, dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    osc.start(t); osc.stop(t + dur + r + 0.05);
  }
  function noise(o){
    var src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = noiseBuf;
    f.type = o.ftype || "highpass"; f.frequency.value = o.freq || 6000; if(o.q) f.Q.value = o.q;
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    var t = o.t, dur = o.dur || 0.05, vol = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  /* ---------- the groove (original composition, I-vi-IV-V in C) ---------- */
  var BASS = [48, 45, 41, 43];                          // C, A, F, G roots
  var CHORDS = [[64,67,72],[64,69,72],[65,69,72],[62,67,71]];
  // melody: [step, midi, lengthInSixteenths] per bar, 8 bars
  var MELODY = [
    [[0,72,2],[2,76,2],[4,79,3],[8,76,2],[10,77,1],[11,76,1],[12,74,4]],
    [[0,72,2],[3,69,1],[4,72,2],[6,76,2],[8,74,2],[10,72,2],[12,69,4]],
    [[0,69,2],[2,72,2],[4,77,3],[8,76,2],[10,74,2],[12,72,2],[14,74,2]],
    [[0,74,3],[4,71,2],[6,74,2],[8,79,4],[12,77,1],[13,76,1],[14,74,2]],
    [[0,79,2],[2,76,1],[3,79,1],[4,84,3],[8,79,2],[10,76,2],[12,77,2],[14,76,2]],
    [[0,72,2],[2,76,2],[4,81,3],[8,79,2],[10,76,2],[12,72,4]],
    [[0,77,2],[2,76,2],[4,74,2],[6,72,2],[8,69,2],[10,72,2],[12,74,2],[14,76,2]],
    [[0,74,2],[2,79,2],[4,83,2],[6,79,2],[8,74,3],[12,71,1],[13,74,1],[14,79,2]]
  ];
  // sparse "boing" counter-line for the groove-only half
  var COUNTER = [[[6,84,1],[14,79,1]],[[6,81,1],[14,76,1]],[[6,81,1],[14,77,1]],[[4,79,1],[6,83,1],[14,86,2]]];
  var BASS_PAT = [0,null,null,null,null,null,12,null,0,null,null,null,7,null,12,null];

  function scheduleStep(s, t){
    var bar = Math.floor(s / 16) % 16, i = s % 16, ch = bar % 4, M = musicBus;
    // drums
    if(i === 0 || i === 8 || (i === 10 && bar % 2 === 1)) tone({t:t, f:150, f2:42, glide:0.12, dur:0.14, type:"sine", vol:0.9, bus:M, release:0.05});
    if(i === 4 || i === 12){ noise({t:t, dur:0.13, vol:0.32, ftype:"bandpass", freq:1900, q:0.8, bus:M}); tone({t:t, f:200, f2:140, dur:0.06, type:"triangle", vol:0.25, bus:M}); }
    if(i % 2 === 0) noise({t:t, dur:i % 4 === 2 ? 0.05 : 0.025, vol:i % 4 === 2 ? 0.14 : 0.07, freq:7500, bus:M});
    // bass
    var bp = BASS_PAT[i];
    if(bp !== null) tone({t:t, f:mtof(BASS[ch] + bp), dur:SIXTEENTH * 1.5, type:"triangle", vol:0.42, bus:M, lp:1200, release:0.04});
    // chord stabs on the offbeats
    if(i === 4 || i === 12 || (i === 14 && bar % 4 === 3)){
      CHORDS[ch].forEach(function(n){ tone({t:t, f:mtof(n), dur:0.07, type:"square", vol:0.045, bus:M, lp:2600, release:0.03}); });
    }
    // melody first 8 bars, counter-line the next 8
    var line = bar < 8 ? MELODY[bar] : COUNTER[ch];
    for(var k = 0; k < line.length; k++){
      if(line[k][0] === i){
        var len = line[k][2] * SIXTEENTH;
        tone({t:t, f:mtof(line[k][1]), dur:len * 0.9, type:"square", vol:bar < 8 ? 0.085 : 0.07, bus:M, lp:3200, vib:bar < 8 ? 5.5 : 0, vibDepth:4, release:0.05});
        if(bar < 8) tone({t:t, f:mtof(line[k][1] - 12), dur:len * 0.9, type:"triangle", vol:0.06, bus:M, release:0.05});
      }
    }
  }
  function scheduler(){
    if(!ctx) return;
    while(nextTime < ctx.currentTime + 0.15){
      if(!muted) scheduleStep(step, nextTime);
      nextTime += SIXTEENTH; step++;
    }
  }
  function startMusic(){
    if(!ctx || musicOn) return;
    musicOn = true; step = 0; nextTime = ctx.currentTime + 0.1;
    schedTimer = setInterval(scheduler, 25);
  }
  function stopMusic(){ musicOn = false; clearInterval(schedTimer); }
  function level(v){ if(ctx) musicBus.gain.setTargetAtTime(v, ctx.currentTime, 0.4); }

  /* ---------- sound effects ---------- */
  function arp(notes, gap, o){
    var t = ctx.currentTime + 0.02;
    notes.forEach(function(n, i){ tone({t:t + i * gap, f:mtof(n), dur:(o && o.dur) || gap * 1.4, type:(o && o.type) || "square", vol:(o && o.vol) || 0.16, lp:3500}); });
    return t + notes.length * gap;
  }
  var SFX = {
    join: function(){ arp([72, 79], 0.07, {vol:0.14}); },
    pop: function(){ var t = ctx.currentTime + 0.01; tone({t:t, f:500, f2:1100, glide:0.06, dur:0.07, type:"sine", vol:0.35}); },
    tick: function(){ var t = ctx.currentTime + 0.01; tone({t:t, f:1300, dur:0.03, type:"square", vol:0.08, lp:4000}); },
    tock: function(){ var t = ctx.currentTime + 0.01; tone({t:t, f:880, dur:0.05, type:"triangle", vol:0.35}); },
    tockHi: function(){ var t = ctx.currentTime + 0.01; tone({t:t, f:1320, dur:0.07, type:"square", vol:0.16, lp:4000}); },
    whoosh: function(){ var t = ctx.currentTime + 0.01; noise({t:t, dur:0.45, vol:0.25, ftype:"bandpass", freq:900, q:0.7, attack:0.25}); },
    round: function(){ SFX.whoosh(); arp([60, 64, 67, 72, 76, 79], 0.07, {vol:0.14}); },
    ding: function(){ var t = ctx.currentTime + 0.01; tone({t:t, f:mtof(84), dur:0.5, type:"sine", vol:0.3, release:0.4}); tone({t:t, f:mtof(91), dur:0.4, type:"sine", vol:0.12, release:0.4}); },
    vote: function(){ arp([79, 84], 0.12, {type:"triangle", vol:0.3, dur:0.3}); },
    tada: function(){ var end = arp([67, 72], 0.09, {vol:0.15}); [72, 76, 79, 84].forEach(function(n){ tone({t:end, f:mtof(n), dur:0.55, type:"square", vol:0.07, lp:3000, vib:6, vibDepth:5}); }); },
    zinger: function(){
      var end = arp([72, 76, 79, 84, 88, 91], 0.055, {vol:0.14});
      [72, 76, 79, 84, 88].forEach(function(n){ tone({t:end, f:mtof(n), dur:0.9, type:"square", vol:0.07, lp:3500, vib:6.5, vibDepth:7}); });
      for(var i = 0; i < 10; i++) tone({t:end + 0.05 + i * 0.07, f:mtof(96 + (i % 4) * 3), dur:0.05, type:"sine", vol:0.12});
      noise({t:end, dur:0.5, vol:0.12, freq:8000});
    },
    sad: function(){
      var t = ctx.currentTime + 0.02;
      [[67,0.35],[66,0.35],[65,0.35],[64,1.0]].forEach(function(p, i){
        tone({t:t + i * 0.38, f:mtof(p[0] - 12), f2:p[1] > 0.5 ? mtof(p[0] - 13) : null, glide:p[1], dur:p[1], type:"sawtooth", vol:0.14, lp:900, vib:p[1] > 0.5 ? 6 : 0, vibDepth:8});
      });
    },
    scores: function(){ arp([67, 71, 74, 79, 74, 79, 83], 0.075, {type:"triangle", vol:0.3}); },
    drumroll: function(dur){
      var t = ctx.currentTime + 0.02, n = Math.floor(dur / 0.045);
      for(var i = 0; i < n; i++) noise({t:t + i * 0.045, dur:0.04, vol:0.08 + 0.2 * i / n, ftype:"bandpass", freq:1600, q:0.7});
      noise({t:t + dur, dur:0.6, vol:0.3, freq:5000});
      tone({t:t + dur, f:120, f2:40, glide:0.3, dur:0.3, type:"sine", vol:0.9});
      return t + dur;
    },
    fanfare: function(delay){
      var t = ctx.currentTime + 0.02 + (delay || 0);
      var seq = [[67,0.12],[67,0.12],[67,0.12],[72,0.5],[67,0.18],[72,0.9]];
      var at = t;
      seq.forEach(function(p){
        tone({t:at, f:mtof(p[0]), dur:p[1] * 0.9, type:"sawtooth", vol:0.1, lp:2600, vib:p[1] > 0.4 ? 5 : 0, vibDepth:5});
        tone({t:at, f:mtof(p[0] + 4), dur:p[1] * 0.9, type:"square", vol:0.05, lp:2600});
        tone({t:at, f:mtof(p[0] - 12), dur:p[1] * 0.9, type:"triangle", vol:0.2});
        at += p[1];
      });
      return at;
    },
    applause: function(delay, dur){
      var t = ctx.currentTime + (delay || 0), d = dur || 2.5;
      for(var i = 0; i < d * 60; i++){
        var tt = t + Math.random() * d, fade = 1 - (tt - t) / d;
        noise({t:tt, dur:0.02 + Math.random() * 0.03, vol:(0.05 + Math.random() * 0.1) * fade, ftype:"bandpass", freq:1500 + Math.random() * 2500, q:1.2});
      }
    },
    dramatic: function(){
      var t = ctx.currentTime + 0.02;
      tone({t:t, f:55, f2:35, glide:1.2, dur:1.2, type:"sawtooth", vol:0.25, lp:500});
      noise({t:t, dur:1.0, vol:0.2, ftype:"lowpass", freq:300, attack:0.01});
      [48, 51, 55].forEach(function(n, i){ tone({t:t + 0.5 + i * 0.25, f:mtof(n + 12), dur:0.9, type:"square", vol:0.07, lp:1500, vib:5, vibDepth:4}); });
    }
  };

  function sfx(name, a, b){
    if(muted || !ctx || !SFX[name]) return;
    try{ return SFX[name](a, b); }catch(e){}
  }

  /* what the host screen sounds like in each phase */
  var LEVELS = { lobby:0.5, intro:0.45, answer:0.3, vote:0.2, reveal:0.14, scores:0.45, fintro:0.25, fanswer:0.3, fvote:0.2, freveal:0.1, end:0.35 };
  function phase(ph, info){
    if(!ctx) return;
    level(LEVELS[ph] == null ? 0.4 : LEVELS[ph]);
    switch(ph){
      case "intro": sfx("round"); break;
      case "answer": case "fanswer": sfx("ding"); break;
      case "vote": case "fvote": sfx("vote"); break;
      case "reveal": {   /* authors pop in, then the votes, then the points land with the fanfare */
        var fin = info && info.zinger ? "zinger" : (info && info.forfeit ? "sad" : "tada");
        setTimeout(function(){ sfx("pop"); }, 800);
        setTimeout(function(){ sfx("pop"); }, 1800);
        setTimeout(function(){ sfx(fin); }, 2800);
        break;
      }
      case "scores": sfx("scores"); break;
      case "fintro": sfx("dramatic"); break;
      case "freveal": sfx("drumroll", 1.1); sfx("fanfare", 1.15); sfx("applause", 2.2, 2); break;
      case "end": sfx("zinger"); sfx("applause", 0.3, 3); break;
    }
  }

  function setMuted(m){
    muted = !!m;
    try{ localStorage.setItem("zing-mute", muted ? "1" : "0"); }catch(e){}
    if(ctx) master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.05);
  }

  return {
    init: init, startMusic: startMusic, stopMusic: stopMusic, phase: phase, sfx: sfx,
    isMuted: function(){ return muted; }, setMuted: setMuted, toggle: function(){ init(); setMuted(!muted); return muted; }
  };
})();
