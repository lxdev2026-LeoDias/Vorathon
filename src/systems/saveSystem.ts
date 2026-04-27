
import { ChaosOrb } from '../core/Types';

export interface SaveData {
  player: {
    level: number;
    xp: number;
    nextLevelExp: number;
    skillPoints: number;
  };
  inventory: {
    runes: string[];
    relics: string[];
    chaosOrbs: ChaosOrb[];
  };
  equipped: {
    runes: (string | null)[];
    relics: (string | null)[];
    orbs: (string | null)[];
  };
  currency: {
    gold: number;
    shards: number;
  };
  skillTree: any;
  progress: {
    unlockedFeatures: string[];
    lastModePlayed: string;
  };
  rankings: any[];
  progressionAreas: {
    unlockedAreas: string[];
    areaStars: Record<string, number>;
    maxDifficultyUnlocked: string;
  };
}

const SAVE_KEY = 'nebula_forge_complete_save';

export const saveSystem = {
  save(state: any) {
    try {
      const saveData: SaveData = {
        player: {
          level: state.progression.level,
          xp: state.progression.exp,
          nextLevelExp: state.progression.nextLevelExp,
          skillPoints: state.progression.skillPoints
        },
        inventory: {
          runes: state.inventory.runes,
          relics: state.inventory.relics,
          chaosOrbs: state.inventory.chaosOrbs
        },
        equipped: {
          runes: state.equippedRunes,
          relics: state.equippedRelics,
          orbs: state.equippedChaosOrbs
        },
        currency: {
          gold: state.currency.gold,
          shards: state.currency.primordialShards
        },
        skillTree: state.skillTree,
        progressionAreas: state.progressionAreas,
        progress: {
          unlockedFeatures: [], // To be implemented if needed
          lastModePlayed: state.currentGameMode
        },
        rankings: state.rankings
      };
      
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
      console.log('SAVE REALIZADO');
    } catch (e) {
      console.error('Falha ao realizar SAVE:', e);
    }
  },

  load(): SaveData | null {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Basic validation to prevent corruption issues
        if (parsed && typeof parsed === 'object' && parsed.player && parsed.inventory) {
          console.log('SAVE CARREGADO');
          return parsed;
        } else {
          console.warn('SAVE CORROMPIDO - REALIZANDO RESET SEGURO');
        }
      }
    } catch (e) {
      console.error('Falha ao carregar SAVE:', e);
    }
    console.log('NOVO SAVE CRIADO');
    return null;
  }
};
