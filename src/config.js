export const CONFIG = {
  PLAYER: { SPEED: 6.5, MAX_HP: 100, ROTATION_SPEED: 18, RADIUS: 0.4 },

  WEAPON: {
    name: 'M1911 PISTOL',
    damage: 32,
    magSize: 7,
    reserveAmmo: 999,
    reloadTime: 1500,
    fireCooldown: 0.32,
    spread: 0.015,
    range: 22,
    aimCone: 0.4,
    recoilKick: 0.15,
  },

  ABILITIES: {
    DASH: { cooldown: 3.5, duration: 0.16, speedMult: 5.0, iframes: 0.3 },
    GRENADE: { cooldown: 8, damage: 110, radius: 5, throwDist: 9, fuse: 0.6 },
  },

  CHARACTERS: [
    { id: 'soldier', name: 'سرباز', desc: 'متعادل', skin: 0xe8b890, shirt: 0x3a5c8c, pants: 0x2a3a5c, hair: 0x2a1a10, hpMult: 1.0, speedMult: 1.0, damageMult: 1.0 },
    { id: 'scout', name: 'پیشاهنگ', desc: 'سریع، شکننده', skin: 0xd8a878, shirt: 0x5c8c3a, pants: 0x3a5c2a, hair: 0x1a1008, hpMult: 0.7, speedMult: 1.25, damageMult: 0.9 },
    { id: 'tank', name: 'تانک', desc: 'کند، مقاوم', skin: 0xc89868, shirt: 0x4a4a4a, pants: 0x2a2a2a, hair: 0x0a0a0a, hpMult: 1.6, speedMult: 0.78, damageMult: 1.15 },
    { id: 'medic', name: 'پزشک', desc: 'بازیابی HP', skin: 0xf0c8a0, shirt: 0xdc2626, pants: 0x2a2a2a, hair: 0x6a3a10, hpMult: 0.9, speedMult: 0.95, damageMult: 0.95, regen: 2.5 },
  ],

  ZOMBIE: {
    WALKER:  { hp: 55,  speed: 2.0, damage: 12, attackRange: 1.4, attackCooldown: 900,  color: 0x6a8a4a, score: 10 },
    RUNNER:  { hp: 35,  speed: 4.2, damage: 10, attackRange: 1.3, attackCooldown: 700,  color: 0x8a4a4a, score: 20 },
    CRAWLER: { hp: 30,  speed: 2.4, damage: 16, attackRange: 1.2, attackCooldown: 1100, color: 0x4a5a7a, score: 15 },
    BOOMER:  { hp: 45,  speed: 1.6, damage: 0,  color: 0xa8a838, score: 30, explodeRadius: 9 },
    HUNTER:  { hp: 65,  speed: 5.4, damage: 22, attackRange: 1.8, attackCooldown: 700,  color: 0xb02828, score: 45 },
    TANK:    { hp: 400, speed: 1.8, damage: 32, attackRange: 2.2, attackCooldown: 1200, color: 0x585868, score: 150 },
    SPITTER: { hp: 40,  speed: 3.0, damage: 14, attackRange: 7.0, attackCooldown: 1500, color: 0x6a4a8a, score: 35, ranged: true },
  },

  BOSS: {
    everyNWaves: 5,
    BRUTE: { hp: 900, speed: 2.6, damage: 40, attackRange: 2.5, attackCooldown: 1000, color: 0x8a2828, score: 500, scale: 2.4, name: 'BRUTE' },
    QUEEN: { hp: 1400, speed: 2.2, damage: 35, attackRange: 2.4, attackCooldown: 900, color: 0x8a2880, score: 800, scale: 2.6, name: 'QUEEN', spawner: true },
  },

  DIRECTOR: {
    WAVES: { BASE_COUNT: 6, COUNT_MULTIPLIER: 1.42, PREP_TIME: 6, HORDE_CHANCE: 0.45, HORDE_DURATION: 8 },
    DIFFICULTY: { MIN: 0.8, MAX: 3.2, INCREASE_RATE: 0.06, DECREASE_RATE: 0.07 },
  },

  DIFFICULTY_MODES: {
    easy:      { hpMult: 0.65, dmgMult: 0.6, spawnMult: 0.8,  scoreMult: 0.75 },
    normal:    { hpMult: 1.0,  dmgMult: 1.0, spawnMult: 1.0,  scoreMult: 1.0 },
    hard:      { hpMult: 1.45, dmgMult: 1.4, spawnMult: 1.3,  scoreMult: 1.5 },
    nightmare: { hpMult: 2.1,  dmgMult: 2.0, spawnMult: 1.6,  scoreMult: 2.5 },
  },

  WORLD: { ARENA_SIZE: 110, GRID_CELL: 1.0 },

  LIGHTING: {
    DAY: {
      skyTop: 0x4a80c0, skyMid: 0x90b8e0, skyBot: 0xc8dcec,
      fogColor: 0xb8cce0, fogNear: 70, fogFar: 180,
      hemiSky: 0xffffff, hemiGround: 0x808060, hemiIntensity: 1.0,
      ambientColor: 0xffffff, ambientIntensity: 0.55,
      sunColor: 0xfff2d0, sunIntensity: 1.8, sunPos: [-60, 90, 40],
      rimColor: 0x6688cc, rimIntensity: 0.3,
      exposure: 1.15, flashlight: false, background: 0xc8dcec,
    },
    NIGHT: {
      skyTop: 0x080618, skyMid: 0x1a1838, skyBot: 0x3a3860,
      fogColor: 0x2a2840, fogNear: 40, fogFar: 130,
      hemiSky: 0x8899bb, hemiGround: 0x3a3040, hemiIntensity: 0.6,
      ambientColor: 0x8899bb, ambientIntensity: 0.4,
      sunColor: 0xb0c0e0, sunIntensity: 0.7, sunPos: [-40, 80, 30],
      rimColor: 0x4455aa, rimIntensity: 0.25,
      exposure: 1.3, flashlight: true, background: 0x2a2840,
    },
  },

  CAMERA: { OFFSET_Y: 24, OFFSET_Z: 13, FOV: 58 },
  AUDIO: { MASTER_VOLUME: 0.5, SFX_VOLUME: 0.7 },
  PICKUPS: { HEALTH_HEAL: 25, AMMO_AMOUNT: 21, DROP_CHANCE: 0.25, LIFETIME: 15 },
  MAX_ZOMBIES: 60,
};

// ============ UPGRADES ============
// rarity: 1 common, 2 rare, 3 epic, 4 legendary
export const UPGRADES = [
  { id: 'dmg_up',    name: 'POWER',       desc: '+25% آسیب',              icon: '⚔️', rarity: 1, apply: p => p.damageMult *= 1.25 },
  { id: 'rate_up',   name: 'RAPID FIRE',  desc: '+20% سرعت شلیک',         icon: '🔥', rarity: 1, apply: p => p.fireRateMult *= 1.2 },
  { id: 'hp_up',     name: 'VITALITY',    desc: '+30 HP ماکسیمم',         icon: '❤️', rarity: 1, apply: p => p.hpBonus += 30 },
  { id: 'speed_up',  name: 'SWIFT',       desc: '+12% سرعت حرکت',         icon: '💨', rarity: 1, apply: p => p.speedMult *= 1.12 },
  { id: 'regen',     name: 'REGEN',       desc: '+1 HP/ثانیه',            icon: '💚', rarity: 2, apply: p => p.regenBonus += 1 },
  { id: 'crit',      name: 'CRITICAL',    desc: '+15% شانس کریتیکال',     icon: '🎯', rarity: 2, apply: p => p.critChance += 0.15 },
  { id: 'mag_up',    name: 'EXTENDED MAG',desc: '+3 ظرفیت خشاب',          icon: '📦', rarity: 2, apply: p => p.magBonus += 3 },
  { id: 'grenade_up',name: 'ARSENAL',     desc: '+1 نارنجک',              icon: '💣', rarity: 2, apply: p => { p.grenadeMax++; p.grenadeCount++; } },
  { id: 'dash_up',   name: 'GHOST',       desc: '-30% کول‌داون Dash',     icon: '👻', rarity: 2, apply: p => p.dashCdMult *= 0.7 },
  { id: 'pierce',    name: 'PIERCE',      desc: 'گلوله از ۱ زامبی رد می‌شود', icon: '➡️', rarity: 3, apply: p => p.pierce += 1 },
  { id: 'reload_up', name: 'QUICK HANDS', desc: '-30% زمان ریلود',        icon: '⚡', rarity: 3, apply: p => p.reloadMult *= 0.7 },
  { id: 'explosive', name: 'EXPLOSIVE',   desc: 'گلوله‌ها منفجر می‌شوند',  icon: '💥', rarity: 4, apply: p => { p.explosiveRounds = true; } },
  { id: 'vampiric',  name: 'VAMPIRIC',    desc: 'هر کشتن ۳ HP برمی‌گرداند', icon: '🩸', rarity: 4, apply: p => p.lifesteal += 3 },
];

export function pickUpgrades(count, owned = []) {
  // وزن بر اساس rarity
  const weight = { 1: 6, 2: 3, 3: 1.5, 4: 0.5 };
  const pool = UPGRADES.filter(u => !owned.includes(u.id) || u.rarity < 4);
  const result = [];
  const used = new Set();
  while (result.length < count && used.size < pool.length) {
    let total = 0;
    for (const u of pool) if (!used.has(u.id)) total += weight[u.rarity];
    let r = Math.random() * total;
    for (const u of pool) {
      if (used.has(u.id)) continue;
      r -= weight[u.rarity];
      if (r <= 0) { result.push(u); used.add(u.id); break; }
    }
  }
  return result;
}

const SETTINGS_KEY = 'dead-signal-settings';
export const DEFAULT_SETTINGS = {
  quality: 'medium', music: 40, sfx: 70, sensitivity: 100,
  cameraShake: true, touchControls: 'auto', characterId: 'soldier',
  gameMode: 'day', difficulty: 'normal',
};
export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...DEFAULT_SETTINGS };
}
export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
}