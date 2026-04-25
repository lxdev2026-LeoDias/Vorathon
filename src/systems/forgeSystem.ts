import { Rarity, ItemTag, ItemCategory, ChaosOrb, Rune, Relic } from '../core/Types';
import { addChaosOrb, getPlayerState } from '../core/Store';

const MAIN_TAGS = [ItemTag.HEALTH, ItemTag.SHIELD, ItemTag.DAMAGE, ItemTag.CRIT, ItemTag.ATTACK_SPEED];

const BONUS_LIST = [
  { description: '+30% Dano', effect: { statMult: { damage: 1.3 } } },
  { description: '+30% Vida', effect: { statAdd: { maxHp: 30, hp: 30 } } },
  { description: '+35% Velocidade de Ataque', effect: { statMult: { fireRate: 0.65 } } },
  { description: '+15% Chance Crítica', effect: { statAdd: { critChance: 15 } } },
  { description: '+50% Dano Crítico', effect: { statAdd: { critDamage: 0.5 } } },
  { description: '+1 Tiro Automático Extra', effect: { statAdd: { extraProjectiles: 1 } } },
];

const PREFIXES = ['Tempestade', 'Inferno', 'Glacial', 'Radiante', 'Sombrio', 'Primordial', 'Celestial'];
const SUFFIXES = ['do Vazio', 'da Ruína', 'do Titã', 'Ancestral', 'da Eternidade', 'Abissal'];

export const forgeChaosOrb = (rune: any, relic: any): ChaosOrb | string => {
  const state = getPlayerState();
  if (state.currency.primordialShards < 10) return 'Fragmentos Insuficientes';

  const rarityRoll = Math.random() * 100;
  let rarity = Rarity.COMMON;
  let bonusCount = 0;

  if (rarityRoll > 95) {
    rarity = Rarity.MYTHIC;
    bonusCount = 3;
  } else if (rarityRoll > 70) {
    rarity = Rarity.EPIC;
    bonusCount = 2;
  }

  const bonuses: string[] = [];
  const effects = { ...rune.effects, ...relic.effects };
  
  const availableBonuses = [...BONUS_LIST];
  for (let i = 0; i < bonusCount; i++) {
    const bIndex = Math.floor(Math.random() * availableBonuses.length);
    const bonus = availableBonuses.splice(bIndex, 1)[0];
    bonuses.push(bonus.description);
    // Merge effects
    Object.keys(bonus.effect).forEach(key => {
      if (effects[key]) {
        if (typeof effects[key] === 'number') effects[key] += bonus.effect[key];
        else effects[key] = { ...effects[key], ...bonus.effect[key] };
      } else {
        effects[key] = bonus.effect[key];
      }
    });
  }

  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  const name = `Orbe ${prefix} ${suffix}`;

  const chaosOrb: ChaosOrb = {
    id: `chaos_${rune.id}_${relic.id}_${Date.now()}`,
    name,
    description: `Fusão da ${rune.name} e ${relic.name}.`,
    rarity,
    icon: '🔮',
    color: rune.color || relic.color || '#a855f7',
    category: ItemCategory.CHAOS,
    tags: Array.from(new Set([...rune.tags, ...relic.tags])),
    effects,
    runeId: rune.id,
    relicId: relic.id,
    bonuses
  };

  addChaosOrb(chaosOrb);
  
  // Deduct shards
  // Update state logic would go here, usually in Store.ts action
  
  return chaosOrb;
};

export const checkChaosOrbConflict = (orbToEquip: ChaosOrb, equippedOrbs: (ChaosOrb | null)[]): boolean => {
  const orbTags = orbToEquip.tags.filter(t => MAIN_TAGS.includes(t));
  
  for (const equipped of equippedOrbs) {
    if (!equipped) continue;
    const commonTags = equipped.tags.filter(t => orbTags.includes(t) && MAIN_TAGS.includes(t));
    if (commonTags.length > 0) return true;
  }
  
  return false;
};
