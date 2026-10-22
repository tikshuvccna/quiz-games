// "קרב כדורי שלג" - team vs team. A correct answer loads the slingshot; drag back, aim and knock down the
// other team's snowmen. The flight is computed here (same formula as the phone) so hits can't be faked.
const QuizGame = require('./base');

const TEAMS = require('../teams').slice(0, 2);
// world units: the sling is at x=0, ground at y=0; enemy snowmen stand at these distances
const XS = [52, 62, 72, 82, 92];
const SNOW_H = 11; // snowman height
const SNOW_W = 3.2; // half width
const G = 10;
const VMAX = 36;
const THROW_MS = 15000;

// height of the ball when it reaches distance x (negative = it already landed)
function heightAt(x, angleDeg, power) {
  const a = (angleDeg * Math.PI) / 180;
  const v = VMAX * power;
  const vx = v * Math.cos(a);
  if (vx <= 0) return -1;
  return x * Math.tan(a) - (G * x * x) / (2 * vx * vx);
}

// index of the first standing snowman the ball hits, or -1
function flight(angleDeg, power, alive) {
  for (let i = 0; i < XS.length; i++) {
    const front = heightAt(XS[i] - SNOW_W, angleDeg, power);
    const mid = heightAt(XS[i], angleDeg, power);
    if (front < 0 && mid < 0) return -1; // landed before reaching this one
    if (!alive[i]) continue;
    if ((front >= 0 && front <= SNOW_H) || (mid >= 0 && mid <= SNOW_H)) return i;
  }
  return -1;
}

class SnowballGame extends QuizGame {
  static id = 'snowball';
  static order = 6;
  static title = 'קרב כדורי שלג';
  static emoji = '☃️';
  static mode = 'teams';
  static reward = ['כדור שלג', 'כדורי שלג'];
  static blurb = 'שתי קבוצות, שני מבצרי שלג. תשובה נכונה טוענת את הקלע: מושכים אחורה, מכוונים ומשחררים כדי להפיל את אנשי השלג של היריבים.';
  static tickMs = 1000;
  static defaults = { duration: 300 };
  static options = [];

  start() {
    this.size = [0, 0];
    for (const p of this.players()) if (p.team >= 0) this.size[p.team]++;
    // snowmen of team t are attacked by team 1-t, so their toughness follows the attackers' size
    this.snow = [0, 1].map((t) => {
      const hp = Math.max(3, Math.round(2.4 * this.size[1 - t]));
      return XS.map(() => ({ hp, max: hp }));
    });
    this.damage = [0, 0];
    this.ev = [];
    this.eid = 1;
    for (const p of this.players()) this.initPlayer(p, { throws: 0, hits: 0, knocks: 0, toss: null, timer: null });
  }

  onAnswer(p, correct, rewarded) {
    return rewarded ? { note: '❄️ כדור שלג מוכן!' } : {};
  }

  score(p) {
    return p.g ? p.g.hits : 0;
  }

  afterFeedback(p) {
    const g = p.g;
    if (!g.last || !g.last.correct) return this.nextQuestion(p);
    g.phase = 'throw';
    g.timer = this.later(() => this.toss(p, 45, 0.2), THROW_MS);
  }

  action(p, type, data) {
    if (type === 'throw' && p.g.phase === 'throw') this.toss(p, Number(data.angle), Number(data.power));
  }

  toss(p, angle, power) {
    const g = p.g;
    if (this.over || g.phase !== 'throw' || !Number.isFinite(angle) || !Number.isFinite(power)) return;
    clearTimeout(g.timer);
    angle = Math.max(5, Math.min(85, angle));
    power = Math.max(0.15, Math.min(1, power));
    const enemy = 1 - p.team;
    const targets = this.snow[enemy];
    const hit = flight(angle, power, targets.map((s) => s.hp > 0));
    let knocked = false;
    if (hit >= 0) {
      targets[hit].hp--;
      this.damage[p.team]++;
      g.hits++;
      if (targets[hit].hp <= 0) {
        knocked = true;
        g.knocks++;
        this.addFeed(`☃️ ${p.name} הפיל/ה איש שלג!`, p.team);
      }
    }
    g.throws++;
    g.toss = { angle, power, hit, knocked };
    g.phase = 'thrown';
    this.ev.push({ id: this.eid++, team: p.team, name: p.name, angle, power, hit, knocked });
    if (this.ev.length > 14) this.ev.shift();
    this.room.pushPlayer(p);
    this.room.scheduleHostPush();
    if (targets.every((s) => s.hp <= 0)) return this.room.end();
    this.later(() => {
      if (g.phase !== 'thrown') return;
      this.turnDone(p);
      this.room.pushPlayer(p);
    }, 1900);
  }

  publicState() {
    return { kind: 'snowball', teams: TEAMS, size: this.size, snow: this.snow, damage: this.damage, xs: XS, ev: this.ev, feed: this.feed };
  }

  personal(p) {
    const g = p.g;
    const out = { ...this.baseView(p), throws: g.throws, hits: g.hits };
    if (g.phase === 'throw' || g.phase === 'thrown') out.targets = this.snow[1 - p.team].map((s) => s.hp);
    if (g.phase === 'thrown') out.toss = g.toss;
    return out;
  }

  results() {
    const standing = this.snow.map((side) => side.filter((s) => s.hp > 0).length);
    // a team wins by knocking more snowmen down; damage dealt breaks ties
    const knocked = [5 - standing[1], 5 - standing[0]];
    const score = [knocked[0] * 1000 + this.damage[0], knocked[1] * 1000 + this.damage[1]];
    const players = this.players()
      .filter((p) => p.g)
      .map((p) => ({ name: p.name, team: p.team, hits: p.g.hits, knocks: p.g.knocks, throws: p.g.throws, correct: p.g.correct }))
      .sort((a, b) => b.hits - a.hits || b.knocks - a.knocks);
    return { kind: 'snowball', teams: TEAMS, knocked, damage: this.damage, winner: score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1, players };
  }
}

SnowballGame.physics = { XS, SNOW_H, SNOW_W, G, VMAX, heightAt, flight };
module.exports = SnowballGame;
