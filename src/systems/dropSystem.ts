import { Entity, EntityType } from '../core/Types';
import { difficultySystem } from './difficultySystem';
import { eventSystem } from './eventSystem';
import { getPlayerState } from '../core/Store';
import runesData from '../data/runes.json';
import relicsData from '../data/relics.json';

export enum DropType {
  GOLD = 'GOLD',
  SHARD = 'SHARD',
  ELEMENTAL_EVOLUTION = 'ELEMENTAL_EVOLUTION',
  RUNE = 'RUNE',
  RELIC = 'RELIC',
  LIFE = 'LIFE'
}

export class DropEntity implements Entity {
  entityType: EntityType = EntityType.BOT;
  x: number;
  y: number;
  width: number = 16;
  height: number = 16;
  type: DropType;
  lifeTime: number = 0;
  isMagnetized: boolean = false;
  speed: number = 400;
  scale: number = 0;
  bobOffset: number = 0;
  puClass?: string;
  itemId?: string;

  constructor(x: number, y: number, type: DropType, puClass?: string, itemId?: string) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.puClass = puClass;
    this.itemId = itemId;
  }

  update(delta: number, playerPos: { x: number, y: number }) {
    this.lifeTime += delta;
    this.bobOffset = Math.sin(this.lifeTime * 5) * 5;
    
    if (this.scale < 1) this.scale += delta * 4;

    if (this.lifeTime > 0.8) {
      this.isMagnetized = true;
    }

    if (this.isMagnetized) {
      const dx = playerPos.x - this.x;
      const dy = playerPos.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 5) {
        this.x += (dx / dist) * this.speed * delta;
        this.y += (dy / dist) * this.speed * delta;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y + this.bobOffset);
    ctx.scale(this.scale, this.scale);
    
    let color = this.type === DropType.GOLD ? '#eab308' : '#a855f7';
    
    if (this.type === DropType.SHARD) {
        // High visibility for shards: Pulsing cyan/purple
        const pulse = Math.sin(this.lifeTime * 8) * 0.5 + 0.5;
        const color1 = '#a855f7'; // Purple
        const color2 = '#0ea5e9'; // Blue
        color = pulse > 0.5 ? color1 : color2;
        
        ctx.shadowBlur = 15 + pulse * 15;
        ctx.shadowColor = color;
        ctx.scale(1.3, 1.3); 
    }

    if (this.type === DropType.ELEMENTAL_EVOLUTION) {
        if (this.puClass === 'FIRE') color = '#f97316';
        if (this.puClass === 'ICE') color = '#38bdf8';
        if (this.puClass === 'ELECTRIC') color = '#eab308';
    } else if (this.type === DropType.RUNE) {
        color = '#3b82f6';
    } else if (this.type === DropType.RELIC) {
        color = '#10b981';
    } else if (this.type === DropType.LIFE) {
        color = '#ef4444';
    }

    ctx.fillStyle = color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;

    // Heart pulsing for Life Drop
    if (this.type === DropType.LIFE) {
        const pulse = 1 + Math.sin(this.lifeTime * 8) * 0.2;
        ctx.scale(pulse, pulse);
    }
    
    ctx.beginPath();
    ctx.arc(this.width/2, this.height/2, this.width/2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (this.type === DropType.ELEMENTAL_EVOLUTION) {
        if (this.puClass === 'FIRE') {
            ctx.moveTo(8, 4);
            ctx.quadraticCurveTo(12, 8, 8, 12);
            ctx.quadraticCurveTo(4, 8, 8, 4);
        } else if (this.puClass === 'ICE') {
            ctx.moveTo(8, 4); ctx.lineTo(11, 8); ctx.lineTo(8, 12); ctx.lineTo(5, 8); ctx.closePath();
        } else if (this.puClass === 'ELECTRIC') {
            ctx.moveTo(10, 4); ctx.lineTo(6, 8); ctx.lineTo(10, 8); ctx.lineTo(6, 12);
        }
        ctx.stroke();
    } else if (this.type === DropType.RUNE || this.type === DropType.RELIC) {
        ctx.moveTo(8, 4); ctx.lineTo(11, 8); ctx.lineTo(8, 12); ctx.lineTo(5, 8); ctx.closePath();
        ctx.stroke();
    } else if (this.type === DropType.LIFE) {
        // Heart shape
        ctx.moveTo(8, 12);
        ctx.bezierCurveTo(8, 12, 4, 9, 4, 6.5);
        ctx.bezierCurveTo(4, 4, 6.5, 4, 8, 6.5);
        ctx.bezierCurveTo(9.5, 4, 12, 4, 12, 6.5);
        ctx.bezierCurveTo(12, 9, 8, 12, 8, 12);
        ctx.stroke();
    }
    
    ctx.restore();
  }
}

export class DropSystem {
  drops: DropEntity[] = [];
  private phaseLifeDrops: number = 0;
  private lastPhase: number = 1;

  reset() {
      this.drops = [];
      this.phaseLifeDrops = 0;
  }

  rollDrop(x: number, y: number, chance: number, isElite: boolean = false, isBoss: boolean = false) {
    const diff = difficultySystem.getModifiers();
    const scaledChance = chance * diff.dropChanceMultiplier;
    
    if (Math.random() * 100 < scaledChance) {
      this.drops.push(new DropEntity(x, y, DropType.GOLD));
    }

    // Life Drop (New Rules)
    // Only Elites can drop, Max 2 per phase
    if (isElite && this.phaseLifeDrops < 2) {
        const playerState = getPlayerState();
        const playerHpPercent = (playerState.stats.hp / playerState.stats.maxHp) * 100;

        let rollLife = false;
        if (this.phaseLifeDrops === 0) {
            // First drop: 80% chance
            if (Math.random() < 0.8) rollLife = true;
        } else if (this.phaseLifeDrops === 1) {
            // Second drop: 5% chance, only if HP < 40%
            if (playerHpPercent < 40 && Math.random() < 0.05) rollLife = true;
        }

        if (rollLife) {
            this.drops.push(new DropEntity(x, y, DropType.LIFE));
            this.phaseLifeDrops++;
        }
    }

    // Celestial Drops (Runes/Relics)
    let celestialChance = 1; // 1% default
    if (isElite) celestialChance = 5;
    if (isBoss) celestialChance = 10;

    // Event Horde Rewards: Common 5%, Elite 15%
    if (eventSystem.isHordeActive()) {
        if (isElite) {
            celestialChance = 15;
        } else {
            celestialChance = 5;
        }
    }

    if (Math.random() * 100 < celestialChance) {
        this.spawnRandomCelestial(x, y);
    }
  }

  spawnRandomCelestial(x: number, y: number) {
    const isRune = Math.random() > 0.5;
    if (isRune) {
        const runes = (runesData as any).runes;
        const rune = runes[Math.floor(Math.random() * runes.length)];
        this.drops.push(new DropEntity(x, y, DropType.RUNE, undefined, rune.id));
    } else {
        const relics = (relicsData as any).relics;
        const relic = relics[Math.floor(Math.random() * relics.length)];
        this.drops.push(new DropEntity(x, y, DropType.RELIC, undefined, relic.id));
    }
  }

  spawnShard(x: number, y: number) {
    this.drops.push(new DropEntity(x, y, DropType.SHARD));
  }

  spawnElementalEvolution(x: number, y: number, puClass: string) {
    this.drops.push(new DropEntity(x, y, DropType.ELEMENTAL_EVOLUTION, puClass));
  }

  update(delta: number, playerPos: { x: number, y: number }) {
    const playerState = getPlayerState();
    
    // Reset life drops on phase change
    if (playerState.session.phase !== this.lastPhase) {
        this.phaseLifeDrops = 0;
        this.lastPhase = playerState.session.phase;
    }

    this.drops.forEach(d => d.update(delta, playerPos));
    
    // Check for pending event reward
    if (eventSystem.pendingFinalReward) {
        eventSystem.pendingFinalReward = false;
        this.spawnRandomCelestial(playerPos.x, playerPos.y);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.drops.forEach(d => d.draw(ctx));
  }
}

export const dropSystem = new DropSystem();
