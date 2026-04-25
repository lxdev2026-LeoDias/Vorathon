import { getPlayerState, updatePlayerState } from '../core/Store';

export enum SkillCategory {
    COMPANIONS = 'COMPANIONS',
    WEAPON = 'WEAPON',
    SPECIALS = 'SPECIALS',
    ATTRIBUTES = 'ATTRIBUTES'
}

export interface SkillTreeState {
    companions: {
        summoner: number;
        shooter: number;
        supporter: number;
    };
    weapon: number;
    specials: {
        shockwave: number;
        explosion: number;
        thunder: number;
    };
    attributes: {
        damage: number;
        hp: number;
        energy: number;
    };
    equippedSpecials: (string | null)[]; // Up to 3
}

export const INITIAL_SKILL_TREE: SkillTreeState = {
    companions: {
        summoner: 0,
        shooter: 0,
        supporter: 0
    },
    weapon: 0,
    specials: {
        shockwave: 0,
        explosion: 0,
        thunder: 0
    },
    attributes: {
        damage: 0,
        hp: 0,
        energy: 0
    },
    equippedSpecials: [null, null, null]
};

class SkillTreeSystem {
    getBonuses() {
        const state = getPlayerState();
        const tree = state.skillTree || INITIAL_SKILL_TREE;
        
        // Amplificador de Plasma (Weapon Level)
        const weaponDmgBonuses = [0, 10, 25, 45, 75];
        const weaponSizeBonuses = [1, 1.1, 1.25, 1.4, 1.6];
        
        return {
            bonusDamage: weaponDmgBonuses[tree.weapon] + (tree.attributes.damage * 10),
            weaponSizeMult: weaponSizeBonuses[tree.weapon],
            bonusHp: tree.attributes.hp * 20,
            bonusMaxEnergy: tree.attributes.energy * 20
        };
    }

    spendPoint(category: SkillCategory, skillId: string) {
        updatePlayerState(prev => {
            const currentPoints = prev.progression.skillPoints;
            if (currentPoints <= 0) return prev;

            const newTree = prev.skillTree ? { ...prev.skillTree } : { ...INITIAL_SKILL_TREE };
            
            if (category === SkillCategory.COMPANIONS) {
                const comp = { ...newTree.companions };
                if (comp[skillId as keyof typeof comp] < 3) {
                    comp[skillId as keyof typeof comp]++;
                    newTree.companions = comp;
                } else return prev;
            } else if (category === SkillCategory.WEAPON) {
                if (newTree.weapon < 4) {
                    newTree.weapon++;
                } else return prev;
            } else if (category === SkillCategory.SPECIALS) {
                const spec = { ...newTree.specials };
                if (spec[skillId as keyof typeof spec] < 3) {
                    spec[skillId as keyof typeof spec]++;
                    newTree.specials = spec;
                } else return prev;
            } else if (category === SkillCategory.ATTRIBUTES) {
                const attr = { ...newTree.attributes };
                if (skillId === 'energy' && attr.energy >= 10) return prev;
                attr[skillId as keyof typeof attr]++;
                newTree.attributes = attr;
            }

            return {
                ...prev,
                progression: {
                    ...prev.progression,
                    skillPoints: currentPoints - 1
                },
                skillTree: newTree
            };
        });
    }

    equipSpecial(specialId: string, slotIndex: number) {
        updatePlayerState(prev => {
            const tree = prev.skillTree || INITIAL_SKILL_TREE;
            // Check if skill is unlocked
            if (tree.specials[specialId as keyof typeof tree.specials] === 0) return prev;

            const newEquipped = [...tree.equippedSpecials];
            newEquipped[slotIndex] = specialId;
            
            return {
                ...prev,
                skillTree: {
                    ...tree,
                    equippedSpecials: newEquipped
                }
            };
        });
    }
}

export const skillTreeSystem = new SkillTreeSystem();
