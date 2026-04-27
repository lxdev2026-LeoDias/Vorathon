import { Entity } from '../core/Types';
import { effectsSystem } from './effectsSystem';
import { visualEffectSystem } from './visualEffectSystem';
import { modeSystem } from './modeSystem';
import { eventSystem } from './eventSystem';
import { difficultySystem } from './difficultySystem';
import { BulletType } from '../core/Bullet';

export enum EnemyType {
  COMMON = 'COMMON',
  ELITE = 'ELITE',
  FAST = 'FAST'
}

export class Enemy implements Entity {
  id: string;
  x: number;
  y: number;
  width: number = 50;
  height: number = 50;
  hp: number;
  maxHp: number;
  type: EnemyType;
  speed: number;
  damage: number = 10;
  shootTimer: number = 0;
  shootInterval: number = 2;
  blinkTimer: number = 0;
  knockbackX: number = 0;
  frozenTimer: number = 0;
  private organicTimer: number = Math.random() * 10;
  private trailTimer: number = 0;
  
  get isFrozen() { return this.frozenTimer > 0; }

  constructor(x: number, y: number, type: EnemyType = EnemyType.COMMON) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.x = x;
    this.y = y;
    this.type = type;

    const diff = difficultySystem.getModifiers();
    const eventAggro = eventSystem.getAgressionMultiplier();
    
    switch(type) {
      case EnemyType.ELITE:
        this.speed = 60 * diff.enemySpeedMultiplier * eventAggro;
        this.maxHp = 90 * diff.enemyHealthMultiplier * diff.eliteHealthMultiplier;
        this.damage = 25 * diff.enemyDamageMultiplier;
        this.width = 75;
        this.height = 75;
        this.shootInterval = 1.5 / (diff.enemySpeedMultiplier * eventAggro); // Faster attack frequency
        break;
      case EnemyType.FAST:
        this.speed = 250 * diff.enemySpeedMultiplier * eventAggro;
        this.maxHp = 15 * diff.enemyHealthMultiplier;
        this.damage = 8 * diff.enemyDamageMultiplier;
        this.width = 38;
        this.height = 29;
        this.shootInterval = 999;
        break;
      default:
        this.speed = 100 * diff.enemySpeedMultiplier * eventAggro;
        this.maxHp = 30 * diff.enemyHealthMultiplier;
        this.damage = 10 * diff.enemyDamageMultiplier;
        this.width = 50;
        this.height = 50;
        this.shootInterval = (2 + Math.random() * 2) / (diff.enemySpeedMultiplier * eventAggro);
    }
    this.hp = this.maxHp;
  }

  freeze(duration: number) {
    this.frozenTimer = Math.max(this.frozenTimer, duration);
  }

  takeDamage(amount: number) {
    if (this.isFrozen && amount > 0) {
      this.hp -= amount * 100; // Force immediate death while maintaining damage flow
      if (this.hp < 0) this.hp = 0;
      return;
    }
    this.hp -= amount;
    this.blinkTimer = 0.1;
    this.knockbackX = 10; // Simple visual pop back
  }

  update(delta: number, playerPos: { x: number, y: number }, spawnBullet: (x: number, y: number, angle: number, isEnemy: boolean, color?: string, type?: BulletType, dmgMult?: number) => void) {
    if (this.blinkTimer > 0) this.blinkTimer -= delta;
    if (this.frozenTimer > 0) this.frozenTimer -= delta;
    if (this.knockbackX > 0) this.knockbackX *= 0.8;
    this.organicTimer += delta;

    // Movement
    const mode = modeSystem.getCurrentMode();
    const currentSpeed = this.isFrozen ? 0 : this.speed;

    if (this.type === EnemyType.ELITE) {
      const dx = playerPos.x - (this.x - this.knockbackX);
      const dy = playerPos.y - this.y;
      const angle = Math.atan2(dy, dx);
      this.x += Math.cos(angle) * currentSpeed * delta;
      this.y += Math.sin(angle) * currentSpeed * delta;
    } else {
      switch(mode.spawnSide) {
        case 'RIGHT': this.x -= currentSpeed * delta; break;
        case 'LEFT': this.x += currentSpeed * delta; break;
        case 'TOP': this.y += currentSpeed * delta; break;
        case 'BOTTOM': this.y -= currentSpeed * delta; break;
      }
    }

    // Subtle organic float
    if (!this.isFrozen) this.y += Math.sin(this.organicTimer * 3) * 0.5;

    // Trail (Double particles for 2x feel)
    this.trailTimer += delta;
    if (this.trailTimer > 0.05 && !this.isFrozen) {
        this.trailTimer = 0;
        const color = this.type === EnemyType.ELITE ? '#f59e0b66' : '#ef444466';
        visualEffectSystem.emitTrailParticles(this.x + this.width, this.y + this.height/2, color, 3);
    }

    // Shooting
    if (!this.isFrozen) {
        this.shootTimer += delta;
        if (this.shootTimer >= this.shootInterval) {
            this.shootTimer = 0;
            if (this.type === EnemyType.ELITE || Math.random() > 0.5) {
                const dx = playerPos.x - this.x;
                const dy = playerPos.y - this.y;
                const angle = Math.atan2(dy, dx);
                spawnBullet(this.x, this.y + this.height/2, angle, true);
            }
        }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x + this.knockbackX, this.y);
    
    // 1. Organic vibration/pulsation
    const time = performance.now() / 1000;
    const pulse = 1 + Math.sin(time * 8) * 0.05;
    const vib = Math.sin(this.organicTimer * 20) * 0.5;
    ctx.translate(vib, vib);

    // Blink effect
    if (this.blinkTimer > 0) {
      ctx.filter = 'brightness(3)';
    }

    // Colors
    let color = '#ef4444';
    if (this.type === EnemyType.ELITE) { color = '#f59e0b'; }
    if (this.type === EnemyType.FAST) { color = '#10b981'; }

    // 2. Body with Ice Overlay
    ctx.fillStyle = color;
    if (this.isFrozen) {
        ctx.fillStyle = '#60a5fa'; // Frozen state override
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffffff';
    }
    
    ctx.beginPath();
    ctx.moveTo(0, this.height/2);
    ctx.lineTo(this.width, 0);
    ctx.lineTo(this.width * 0.8, this.height/2);
    ctx.lineTo(this.width, this.height);
    ctx.closePath();
    ctx.fill();

    // 3. Ice Layer
    if (this.isFrozen) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#f0f9ff';
        ctx.beginPath();
        const icePad = 4;
        ctx.roundRect(-icePad, -icePad, this.width + icePad * 2, this.height + icePad * 2, 10);
        ctx.fill();
        
        // Crystalline shine
        const grad = ctx.createLinearGradient(0, 0, this.width, this.height);
        grad.addColorStop(0, 'rgba(255,255,255,0.8)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.2)');
        grad.addColorStop(1, 'rgba(255,255,255,0.8)');
        ctx.fillStyle = grad;
        ctx.fill();

        // Ice cracks / Frost patterns
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        for(let i=0; i<4; i++) {
            ctx.beginPath();
            const startX = Math.random() * this.width;
            const startY = Math.random() * this.height;
            ctx.moveTo(startX, startY);
            ctx.lineTo(startX + (Math.random()-0.5)*20, startY + (Math.random()-0.5)*20);
            ctx.stroke();
        }

        // Rising frost particles
        if (Math.random() > 0.8) {
            visualEffectSystem.emitTrailParticles(this.x + Math.random()*this.width, this.y + this.height, '#ffffff44', 2);
        }

        ctx.restore();
    }

    // 3. Energy Nucleus
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(this.width * 0.4, this.height/2, this.width * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // HP Bar (Sleek)
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, -14, this.width, 3);
    ctx.fillStyle = color;
    ctx.fillRect(0, -14, this.width * (this.hp / this.maxHp), 3);

    ctx.restore();
  }
}

export class EnemySystem {
  enemies: Enemy[] = [];
  spawnTimer: number = 0;

  reset() {
    this.enemies = [];
    this.spawnTimer = 0;
  }

  update(delta: number, canvasWidth: number, canvasHeight: number, playerPos: { x: number, y: number }, spawnBullet: (x: number, y: number, angle: number, isEnemy: boolean, color?: string, type?: BulletType, dmgMult?: number) => void) {
    const mode = modeSystem.getCurrentMode();
    const diff = difficultySystem.getModifiers();
    const eventSpawnMult = eventSystem.getSpawnMultiplier();
    
    // Intensity and Difficulty scale the timer
    this.spawnTimer += delta * mode.intensity * diff.spawnRateMultiplier * eventSpawnMult;
    
    if (this.spawnTimer > 1.2) {
      this.spawnTimer = 0;
      const roll = Math.random();
      let type = EnemyType.COMMON;
      
      // Elite chance increases with phase
      const eliteChance = 0.15 + diff.eliteChanceAdd;
      const fastChance = 0.25;

      if (roll < eliteChance) type = EnemyType.ELITE;
      else if (roll < eliteChance + fastChance) type = EnemyType.FAST;
      
      let x = 0, y = 0;
      switch(mode.spawnSide) {
        case 'RIGHT':
            x = canvasWidth + 50;
            y = Math.random() * (canvasHeight - 50);
            break;
        case 'TOP':
            x = Math.random() * (canvasWidth - 50);
            y = -50;
            break;
        case 'LEFT':
            x = -50;
            y = Math.random() * (canvasHeight - 50);
            break;
        case 'BOTTOM':
            x = Math.random() * (canvasWidth - 50);
            y = canvasHeight + 50;
            break;
      }
      this.enemies.push(new Enemy(x, y, type));
    }

    this.enemies.forEach(e => {
      e.update(delta, playerPos, spawnBullet);
    });
    
    // Remove off-screen or dead
    this.enemies = this.enemies.filter(e => {
        const isDead = e.hp <= 0;
        const isOffscreen = e.x < -200 || e.x > canvasWidth + 200 || e.y < -200 || e.y > canvasHeight + 200;
        return !isDead && !isOffscreen;
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.enemies.forEach(e => e.draw(ctx));
  }
}

export const enemySystem = new EnemySystem();
