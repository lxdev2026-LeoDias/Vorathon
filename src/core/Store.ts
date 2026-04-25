import { useState, useCallback, useEffect } from 'react';
import playerInitialData from '../data/player.json';

import { ChaosOrb } from './Types';
import { checkChaosOrbConflict } from '../systems/forgeSystem';
import { INITIAL_SKILL_TREE } from '../systems/skillTreeSystem';

// Simple store-like behavior for global access (though React-based for ease)
let globalPlayerState = { 
  ...playerInitialData.player,
  skillTree: (() => {
    try {
      const saved = localStorage.getItem('nebula_forge_skillTree');
      return saved ? JSON.parse(saved) : INITIAL_SKILL_TREE;
    } catch (e) {
      return INITIAL_SKILL_TREE;
    }
  })(),
  progression: (() => {
    try {
      const saved = localStorage.getItem('nebula_forge_progression');
      return saved ? JSON.parse(saved) : playerInitialData.player.progression;
    } catch (e) {
      return playerInitialData.player.progression;
    }
  })(),
  currentGameMode: 'COSMIC_ASCENSION' as any,
  activePowerUp: {
    class: null as any, // PowerUpClass | null
    level: 1 as number // PowerUpLevel
  },
  session: {
    playerName: 'PILOTO',
    score: 0,
    kills: 0,
    elitesKilled: 0,
    goldGained: 0,
    shardsGained: 0,
    bossesKilled: 0,
    lives: 3,
    phase: 1,
    phaseStats: {
        score: 0,
        kills: 0,
        elitesKilled: 0
    }
  },
  rankings: (() => {
    try {
      const saved = localStorage.getItem('nebula_forge_rankings');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  })() as { name: string, score: number, mode: string, date: string }[],
  feedback: {
    shake: 0,
    flash: 0,
    hpChanged: false
  }
};

// Use a simple subject-like pattern to notify subscribers
const subscribers = new Set<() => void>();

export const getPlayerState = () => globalPlayerState;

export const updatePlayerState = (updater: (prev: typeof globalPlayerState) => typeof globalPlayerState) => {
  globalPlayerState = updater(globalPlayerState);
  
  // Persistence
  localStorage.setItem('nebula_forge_skillTree', JSON.stringify(globalPlayerState.skillTree));
  localStorage.setItem('nebula_forge_progression', JSON.stringify(globalPlayerState.progression));

  subscribers.forEach(sub => sub());
};

export const updatePlayerName = (name: string) => {
    updatePlayerState(prev => ({
        ...prev,
        session: {
            ...prev.session,
            playerName: name || 'PILOTO'
        }
    }));
};

export const addRankingEntry = (name: string, score: number, mode: string) => {
    updatePlayerState(prev => {
        const newRanking = [...(prev.rankings || []), { 
            name: name || 'PILOTO', 
            score, 
            mode, 
            date: new Date().toLocaleDateString() 
        }];
        
        // Sort by score descending and keep top 10
        const sortedRanking = newRanking
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
        
        localStorage.setItem('nebula_forge_rankings', JSON.stringify(sortedRanking));
        
        return {
            ...prev,
            rankings: sortedRanking
        };
    });
};

export const triggerFeedback = (type: 'shake' | 'flash' | 'hpChanged', value: any) => {
    updatePlayerState(prev => ({
        ...prev,
        feedback: {
            ...prev.feedback,
            [type]: value
        }
    }));
    // Reset boolean feedback after UI had time to see it if needed (though React state is enough)
    if(type === 'hpChanged') {
        setTimeout(() => {
            updatePlayerState(prev => ({ ...prev, feedback: { ...prev.feedback, hpChanged: false } }));
        }, 100);
    }
    if(type === 'flash') {
        setTimeout(() => {
            updatePlayerState(prev => ({ ...prev, feedback: { ...prev.feedback, flash: 0 } }));
        }, 200);
    }
};

export const equipRune = (runeId: string, slotIndex: number) => {
    updatePlayerState(prev => {
        const newRunes = [...prev.equippedRunes];
        newRunes[slotIndex] = runeId;
        return { ...prev, equippedRunes: newRunes };
    });
};

export const addChaosOrb = (orb: ChaosOrb) => {
    updatePlayerState(prev => ({
        ...prev,
        inventory: {
            ...prev.inventory,
            chaosOrbs: [...prev.inventory.chaosOrbs, orb]
        }
    }));
};

export const destroyChaosOrb = (orbId: string) => {
    updatePlayerState(prev => {
        const filteredOrbs = prev.inventory.chaosOrbs.filter(o => o.id !== orbId);
        const equippedOrbs = prev.equippedChaosOrbs.map(id => id === orbId ? null : id);
        return {
            ...prev,
            inventory: { ...prev.inventory, chaosOrbs: filteredOrbs },
            equippedChaosOrbs: equippedOrbs
        };
    });
};

export const addRune = (runeId: string) => {
    updatePlayerState(prev => ({
        ...prev,
        inventory: {
            ...prev.inventory,
            runes: [...prev.inventory.runes, runeId]
        }
    }));
};

export const addRelic = (relicId: string) => {
    updatePlayerState(prev => ({
        ...prev,
        inventory: {
            ...prev.inventory,
            relics: [...prev.inventory.relics, relicId]
        }
    }));
};

export const deductShards = (amount: number) => {
    updatePlayerState(prev => ({
        ...prev,
        currency: {
            ...prev.currency,
            primordialShards: Math.max(0, prev.currency.primordialShards - amount)
        }
    }));
};

export const equipChaosOrb = (orbId: string, slotIndex: number) => {
    updatePlayerState(prev => {
        const orb = prev.inventory.chaosOrbs.find(o => o.id === orbId);
        if (!orb) return prev;

        const equippedOrbs = prev.equippedChaosOrbs.map(id => id ? prev.inventory.chaosOrbs.find(o => o.id === id) || null : null);
        
        if (checkChaosOrbConflict(orb, equippedOrbs)) {
            // Trigger feedback for conflict
            triggerFeedback('flash', 1);
            return prev;
        }

        const newOrbs = [...prev.equippedChaosOrbs];
        newOrbs[slotIndex] = orbId;
        return { ...prev, equippedChaosOrbs: newOrbs };
    });
};

export const unequipChaosOrb = (slotIndex: number) => {
    updatePlayerState(prev => {
        const newOrbs = [...prev.equippedChaosOrbs];
        newOrbs[slotIndex] = null;
        return { ...prev, equippedChaosOrbs: newOrbs };
    });
};

export const unequipRune = (slotIndex: number) => {
    updatePlayerState(prev => {
        const newRunes = [...prev.equippedRunes];
        newRunes[slotIndex] = null as any;
        return { ...prev, equippedRunes: newRunes };
    });
};

export const equipRelic = (relicId: string, slotIndex: number) => {
    updatePlayerState(prev => {
        const newRelics = [...prev.equippedRelics];
        newRelics[slotIndex] = relicId;
        return { ...prev, equippedRelics: newRelics };
    });
};

export const setGameMode = (mode: string) => {
    updatePlayerState(prev => ({
        ...prev,
        currentGameMode: mode
    }));
};

export const setPowerUpClass = (puClass: any) => {
    updatePlayerState(prev => ({
        ...prev,
        activePowerUp: {
            class: puClass,
            level: 1
        }
    }));
};

export const evolvePowerUp = () => {
    updatePlayerState(prev => ({
        ...prev,
        activePowerUp: {
            ...prev.activePowerUp,
            level: Math.min(4, prev.activePowerUp.level + 1) as any
        }
    }));
};

export const unequipRelic = (slotIndex: number) => {
    updatePlayerState(prev => {
        const newRelics = [...prev.equippedRelics];
        newRelics[slotIndex] = null as any;
        return { ...prev, equippedRelics: newRelics };
    });
};

export const resetSession = () => {
    updatePlayerState(prev => ({
        ...prev,
        stats: {
            ...prev.stats,
            hp: prev.stats.maxHp,
            energy: prev.stats.maxEnergy
        },
        activePowerUp: {
            class: null as any,
            level: 1
        },
        session: {
            playerName: prev.session.playerName,
            score: 0,
            kills: 0,
            elitesKilled: 0,
            goldGained: 0,
            shardsGained: 0,
            bossesKilled: 0,
            lives: 3,
            phase: 1,
            phaseStats: {
                score: 0,
                kills: 0,
                elitesKilled: 0
            }
        }
    }));
};

export const startNextPhase = () => {
    updatePlayerState(prev => ({
        ...prev,
        session: {
            ...prev.session,
            phase: prev.session.phase + 1,
            phaseStats: {
                score: 0,
                kills: 0,
                elitesKilled: 0
            }
        }
    }));
};

export const handlePlayerDeath = () => {
    updatePlayerState(prev => {
        const newLives = Math.max(0, prev.session.lives - 1);
        return {
            ...prev,
            stats: {
                ...prev.stats,
                hp: prev.stats.maxHp
            },
            session: {
                ...prev.session,
                lives: newLives
            }
        };
    });
};

export const addLife = (amount: number = 1) => {
    updatePlayerState(prev => ({
        ...prev,
        session: {
            ...prev.session,
            lives: prev.session.lives + amount
        }
    }));
};

export const addScore = (amount: number, isElite: boolean = false) => {
    updatePlayerState(prev => {
        const oldScore = prev.session.score;
        const newScore = oldScore + amount;
        
        // Every 25k points = +1 life
        const oldLivesFromScore = Math.floor(oldScore / 25000);
        const newLivesFromScore = Math.floor(newScore / 25000);
        const addedLives = newLivesFromScore - oldLivesFromScore;

        return {
            ...prev,
            session: {
                ...prev.session,
                lives: prev.session.lives + addedLives,
                score: newScore,
                kills: prev.session.kills + 1,
                elitesKilled: isElite ? prev.session.elitesKilled + 1 : prev.session.elitesKilled,
                phaseStats: {
                    ...prev.session.phaseStats,
                    score: prev.session.phaseStats.score + amount,
                    kills: prev.session.phaseStats.kills + 1,
                    elitesKilled: isElite ? prev.session.phaseStats.elitesKilled + 1 : prev.session.phaseStats.elitesKilled
                }
            }
        };
    });
};

export const completeSession = () => {
    // Current currency already includes gained gold/shards from pick-ups
    // This can be used for any extra end-of-run bonuses if needed
    updatePlayerState(prev => ({
        ...prev,
        // No double addition here
    }));
};

export const usePlayerState = () => {
  const [state, setState] = useState(globalPlayerState);

  useEffect(() => {
    const sub = () => setState({ ...globalPlayerState });
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, []);

  return state;
};
