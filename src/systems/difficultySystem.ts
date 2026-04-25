import { getPlayerState } from '../core/Store';

export interface DifficultyModifiers {
  enemyHealthMultiplier: number;
  enemyDamageMultiplier: number;
  enemySpeedMultiplier: number;
  spawnRateMultiplier: number;
  eliteChanceAdd: number;
  bossHealthMultiplier: number;
  goldMultiplier: number;
  xpMultiplier: number;
  dropChanceMultiplier: number;
  shardChance: number;      // Chance for elites to drop shards
  relicChanceMultiplier: number; // Future use
  runeChanceMultiplier: number;  // Future use
}

export class DifficultySystem {
  // Base scaling factors
  private readonly HP_GROWTH = 0.22;       // Increased from 0.12 for steeper curve
  private readonly DMG_GROWTH = 0.10;      // Slightly increased from 0.08
  private readonly SPEED_GROWTH = 0.03;    // +3% Speed per phase
  private readonly SPAWN_GROWTH = 0.20;    // +20% Spawn rate per phase (Doubled)
  private readonly ELITE_GROWTH = 0.04;    // +4% Elite chance per phase (Doubled)
  private readonly BOSS_HP_GROWTH = 0.20;  // +20% Boss HP per phase
  private readonly GOLD_GROWTH = 0.30;     // +30% Gold per phase (Doubled)
  private readonly XP_GROWTH = 0.10;       // +10% XP per phase (Doubled)
  private readonly DROP_GROWTH = 0.10;     // +10% Drop chance per phase (Doubled)
  private readonly SHARD_GROWTH = 0.05;    // +5% Shard chance from elites per phase (Massive increase)

  getModifiers(): DifficultyModifiers {
    const phase = getPlayerState().session.phase;
    const levelIndex = phase - 1; 

    return {
      enemyHealthMultiplier: 1 + (levelIndex * this.HP_GROWTH),
      enemyDamageMultiplier: 1 + (levelIndex * this.DMG_GROWTH),
      enemySpeedMultiplier: 1 + (levelIndex * this.SPEED_GROWTH),
      spawnRateMultiplier: 1.5 + (levelIndex * this.SPAWN_GROWTH), // Base 1.5x spawn rate
      eliteChanceAdd: 0.1 + (levelIndex * this.ELITE_GROWTH), // Base 10% elite chance
      bossHealthMultiplier: 1 + (levelIndex * this.BOSS_HP_GROWTH),
      goldMultiplier: 2 + (levelIndex * this.GOLD_GROWTH), // Base 2x gold
      xpMultiplier: 1.5 + (levelIndex * this.XP_GROWTH),
      dropChanceMultiplier: 2 + (levelIndex * this.DROP_GROWTH), // Base 2x drop chance
      shardChance: 0.20 + (levelIndex * this.SHARD_GROWTH), // Base 20% from elites
      relicChanceMultiplier: 1.5 + (levelIndex * 0.1),
      runeChanceMultiplier: 1.5 + (levelIndex * 0.1)
    };
  }

  // Helper to calculate total value
  applyMultiplier(baseValue: number, multiplier: number): number {
    return baseValue * multiplier;
  }
}

export const difficultySystem = new DifficultySystem();
