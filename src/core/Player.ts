import { Entity, PlayerType, ScrollDirection } from './Types';
import { inputManager } from '../core/InputManager';
import { getPlayerState, updatePlayerState, triggerFeedback } from './Store';
import { effectSystem } from '../systems/effectSystem';
import { visualEffectSystem } from '../systems/visualEffectSystem';
import { modeSystem } from '../systems/modeSystem';
import { skillTreeSystem, INITIAL_SKILL_TREE } from '../systems/skillTreeSystem';
import { enemySystem } from '../systems/enemySystem';
import { bossSystem } from '../systems/bossSystem';
import { combatSystem } from '../systems/combatSystem';
import { effectsSystem } from '../systems/effectsSystem';
import { dialogueSystem } from '../systems/dialogueSystem';import { synergySystem } from '../systems/synergySystem';
import { companionSystem, CompanionType } from '../systems/companionSystem';
import { PowerUpClass } from './Types';
import { BulletType } from './Bullet';

interface ActiveSpecial {
    id: string;
    level: number;
    timer: number;
    duration: number;
}

export class Player implements Entity {
  x: number;
  y: number;
  width: number = 64;
  height: number = 40;
  shootTimer: number = 0;
  private plasmaShotCount: number = 0;
  private currentScale: number = 2.0;

  // Energy & Specials
  private energyRegenTimer: number = 0;
  private activeSpecial: ActiveSpecial | null = null;
  private specialCooldowns: { [key: string]: number } = {};
  private specialCooldownTime: number = 3; // Minimum 3s base cooldown between specials

  private shieldHealth: number = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    companionSystem.init();
  }

  update(delta: number, spawnBullet: (x: number, y: number, angle: number, isEnemy: boolean, color?: string, type?: BulletType, extraDmgMult?: number) => void) {
    const state = getPlayerState();
    const mode = modeSystem.getCurrentMode();
    const tree = state.skillTree || INITIAL_SKILL_TREE;
    
    // Cooldown updates
    Object.keys(this.specialCooldowns).forEach(key => {
        if (this.specialCooldowns[key] > 0) {
            this.specialCooldowns[key] -= delta;
        }
    });

    // Energy Regeneration: 100 every 30s = ~3.33 per second
    this.energyRegenTimer += delta;
    if (this.energyRegenTimer >= 1) {
        this.energyRegenTimer = 0;
        const regenAmount = 100 / 30;
        updatePlayerState(prev => ({
            ...prev,
            stats: { ...prev.stats, energy: Math.min(prev.stats.maxEnergy, prev.stats.energy + regenAmount) }
        }));
    }

    // Special Skill Trigger (T, Y, U, I Keys)
    const specialKeys = ['KeyT', 'KeyY', 'KeyU', 'KeyI'];
    specialKeys.forEach((key, index) => {
        if (inputManager.isKeyDown(key)) {
            const specialId = tree.equippedSpecials[index];
            // Only trigger if energy >= 100 AND no special is currently active AND cooldown is off
            if (specialId && !this.activeSpecial && (this.specialCooldowns[specialId] || 0) <= 0) {
                this.useSpecial(specialId, tree.specials[specialId as keyof typeof tree.specials]);
            }
        }
    });

    if (this.activeSpecial) {
        this.activeSpecial.timer -= delta;
        this.updateSpecialEffects(delta);
        if (this.activeSpecial.timer <= 0) {
            const finishedId = this.activeSpecial.id;
            this.activeSpecial = null;
            this.specialCooldowns[finishedId] = this.specialCooldownTime;
        }
    }

    // Update Companions
    companionSystem.update(delta, this.x, this.y, this.width, this.height, spawnBullet);
    
    // Check for shield requests from companions
    if ((window as any).playerShieldRequest) {
        this.shieldHealth = Math.max(this.shieldHealth, (window as any).playerShieldRequest);
        effectsSystem.addFloatingText(this.x, this.y - 40, "SHIELD CHARGED", '#60a5fa', true);
        delete (window as any).playerShieldRequest;
    }
    
    const { speed, fireRate } = state.stats;
    const mods = effectSystem.getModifiers();
    
    // Update Hitbox based on current visual scale
    const equippedRelicsCount = state.equippedRelics.filter(Boolean).length;
    const baseScale = 2.0; 
    let scaleMult = (equippedRelicsCount >= 4 ? 1.15 : 1.0) * baseScale;
    
    // Special Shockwave/Explosion Size Increase
    if (this.activeSpecial) {
        if (this.activeSpecial.id === 'shockwave') {
            const sizeMults = [1.1, 1.2, 1.5];
            scaleMult *= sizeMults[this.activeSpecial.level - 1];
        } else if (this.activeSpecial.id === 'explosion') {
            const sizeMults = [2.0, 3.0, 4.0];
            scaleMult *= sizeMults[this.activeSpecial.level - 1];
        }
    }

    this.currentScale = scaleMult;
    
    // Perfect hitbox matching visual ship model (32x20 at scale 1)
    const nextWidth = 32 * this.currentScale;
    const nextHeight = 20 * this.currentScale;
    
    // Smoothly adjust x/y to prevent ship jumping when scale changes
    this.x -= (nextWidth - this.width) / 2;
    this.y -= (nextHeight - this.height) / 2;
    this.width = nextWidth;
    this.height = nextHeight;

    const currentSpeed = speed * mods.speedMult;
    const currentFireRate = fireRate * mods.fireRateMult;
    const weaponBonuses = skillTreeSystem.getBonuses();

    const dx = inputManager.axisX;
    const dy = inputManager.axisY;

    // Movement
    this.x += dx * currentSpeed * delta;
    this.y += dy * currentSpeed * delta;

    // Shooting (Auto-fire)
    this.shootTimer += delta;
    if (this.shootTimer >= currentFireRate) {
      this.shootTimer = 0;
      
      const angle = mode.direction === ScrollDirection.HORIZONTAL ? 0 : -Math.PI / 2;
      const bx = mode.direction === ScrollDirection.HORIZONTAL ? this.x + this.width : this.x + this.width / 2;
      const by = mode.direction === ScrollDirection.HORIZONTAL ? this.y + this.height / 2 : this.y;
      
      const isPlasma = state.activePowerUp.class === PowerUpClass.PLASMA;
      const pLevel = isPlasma ? state.activePowerUp.level : 0;
      const plasmaDmgMults = [1, 1, 1.25, 1.30, 1.35];
      const dmgMult = isPlasma ? plasmaDmgMults[pLevel] : 1;

      if (pLevel > 0) {
          // Level 1: dark blue (#1e3a8a), Level 2: light blue (#60a5fa), Level 3/4: dark blue (#1e3a8a)
          const plasmaColors = [undefined, '#1e3a8a', '#60a5fa', '#1e3a8a', '#1e3a8a'];
          const shotColor = plasmaColors[pLevel];

          if (pLevel === 1) {
              spawnBullet(bx, by, angle, false, shotColor, BulletType.NORMAL, dmgMult);
          } else if (pLevel === 2) {
              spawnBullet(bx, by - 8, angle, false, shotColor, BulletType.NORMAL, dmgMult);
              spawnBullet(bx, by + 8, angle, false, shotColor, BulletType.NORMAL, dmgMult);
          } else if (pLevel === 3) {
              spawnBullet(bx, by, angle, false, shotColor, BulletType.NORMAL, dmgMult);
              spawnBullet(bx, by - 12, angle, false, shotColor, BulletType.NORMAL, dmgMult);
              spawnBullet(bx, by + 12, angle, false, shotColor, BulletType.NORMAL, dmgMult);
          } else if (pLevel === 4) {
              spawnBullet(bx, by, angle, false, shotColor, BulletType.NORMAL, dmgMult);
              spawnBullet(bx, by - 12, angle, false, shotColor, BulletType.NORMAL, dmgMult);
              spawnBullet(bx, by + 12, angle, false, shotColor, BulletType.NORMAL, dmgMult);

              this.plasmaShotCount++;
              if (this.plasmaShotCount >= 5) {
                  this.plasmaShotCount = 0;
                  // Level 4: Pulse ball every 5 shots, 3x damage
                  spawnBullet(bx, by, angle, false, '#60a5fa', BulletType.PLASMA, dmgMult * 3);
              }
          }
      } else {
          spawnBullet(bx, by, angle, false);
      }

      // Handle extra projectiles bonus from Chaos Orbs
      if (mods.extraProjectiles > 0) {
          for (let i = 0; i < mods.extraProjectiles; i++) {
              const offset = (i + 1) * 0.15;
              spawnBullet(bx, by, angle + offset, false);
              spawnBullet(bx, by, angle - offset, false);
          }
      }
    }
  }

  private useSpecial(id: string, level: number) {
    const state = getPlayerState();
    if (state.stats.energy < 100) return;

    updatePlayerState(prev => ({
        ...prev,
        stats: { ...prev.stats, energy: prev.stats.energy - 100 }
    }));

    // Check for synergy
    const bonus = synergySystem.getSynergyBonus(state.activePowerUp.class!, id);
    const baseDuration = 5;
    const duration = bonus ? baseDuration + bonus.durationBonus : baseDuration;

    this.activeSpecial = {
        id,
        level,
        timer: duration,
        duration: duration
    };

    visualEffectSystem.emitExplosion(this.x + this.width / 2, this.y + this.height / 2, bonus ? bonus.color : '#3b82f6', bonus ? 100 : 60);
    effectsSystem.addFloatingText(this.x, this.y - 50, bonus ? "SYNERGY ACTIVATED" : "SPECIAL ACTIVATED", bonus ? bonus.color : '#fbbf24', true);
    dialogueSystem.trigger('player', id);
  }

  private updateSpecialEffects(delta: number) {
    if (!this.activeSpecial) return;
    
    const state = getPlayerState();
    const bonus = synergySystem.getSynergyBonus(state.activePowerUp.class!, this.activeSpecial.id);
    const damageMult = bonus ? bonus.damageMult : 1.0;
    const sizeMult = bonus ? bonus.sizeMult : 1.0;

    const level = this.activeSpecial.level;
    const dpsLevels = [200, 300, 400];
    const dps = dpsLevels[level - 1] * damageMult;
    const damage = dps * delta;

    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;

    if (this.activeSpecial.id === 'shockwave') {
        // Laser logic (Rectangle to the right)
        const laserWidth = 1400; // Extremely long laser
        const sizeMults = [1.1, 1.2, 1.5];
        const laserHeight = this.height * sizeMults[level - 1] * sizeMult;
        const laserY = centerY - laserHeight / 2;
        const laserX = this.x + this.width;

        // Visuals
        const colors = ['#3b82f6', '#60a5fa', 'rainbow'];
        const color = bonus ? bonus.color : colors[level - 1];
        this.emitLaserVFX(laserX, centerY, laserWidth, laserHeight, color);

        // Damage calculation (Rectangle area)
        [...enemySystem.enemies, bossSystem.currentBoss].filter(Boolean).forEach((e: any) => {
            if (e.x < laserX + laserWidth && e.x + e.width > laserX &&
                e.y < laserY + laserHeight && e.y + e.height > laserY) {
                e.takeDamage(damage);
                
                // Impact effects
                if (Math.random() > (bonus ? 0.4 : 0.7)) {
                    visualEffectSystem.emitEnergySpark(e.x + e.width / 2, e.y + e.height / 2, color === 'rainbow' ? `hsl(${Date.now() % 360}, 100%, 70%)` : '#f0f9ff');
                }
                visualEffectSystem.emitShotParticles(e.x + e.width / 2, e.y + e.height / 2, color === 'rainbow' ? 'white' : (bonus ? bonus.color : '#3b82f6'));
            }
        });

    } else if (this.activeSpecial.id === 'explosion') {
        // Aura logic (Circle around player)
        const radiusMults = [0.6, 0.9, 1.2]; // Reduced by 40% from [1.0, 1.5, 2.0]
        const radius = this.width * radiusMults[level - 1] * sizeMult;
        
        // Visuals
        visualEffectSystem.emitExplosion(centerX, centerY, bonus ? bonus.color : '#f97316', bonus ? 10 : 5); 
        
        // Dynamic Flame and Smoke for Special
        if (Math.random() > (bonus ? 0.1 : 0.3)) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * radius;
            visualEffectSystem.emitFlame(centerX + Math.cos(angle) * dist, centerY + Math.sin(angle) * dist, bonus ? 15 : 10);
        }
        if (Math.random() > (bonus ? 0.5 : 0.7)) {
            const angle = Math.random() * Math.PI * 2;
            const dist = radius;
            visualEffectSystem.emitSmoke(centerX + Math.cos(angle) * dist, centerY + Math.sin(angle) * dist, bonus ? bonus.color + '22' : '#ff550022', 15);
        }
        if (Math.random() > 0.9) {
            visualEffectSystem.emitDistortion(centerX, centerY, radius);
        }
        
        // Ring of fire (Borda viva)
        for (let i = 0; i < (bonus ? 5 : 3); i++) {
            const angle = Math.random() * Math.PI * 2;
            visualEffectSystem.emitFlame(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius, bonus ? 18 : 12);
        }

        // Damage
        [...enemySystem.enemies, bossSystem.currentBoss].filter(Boolean).forEach((e: any) => {
            const dist = Math.sqrt((e.x + e.width / 2 - centerX)**2 + (e.y + e.height / 2 - centerY)**2);
            if (dist < radius) {
                e.takeDamage(damage);
                if (Math.random() > 0.8) visualEffectSystem.emitShotParticles(e.x + e.width / 2, e.y + e.height / 2, bonus ? bonus.color : '#f97316');
            }
        });

    } else if (this.activeSpecial.id === 'thunder') {
        // Thunder Storm logic
        visualEffectSystem.setStormIntensity((0.5 + (level * 0.2)) * (bonus ? 1.5 : 1.0));
        
        // Main Bolts (Rain)
        const chance = (0.95 - level * 0.05) - (bonus ? 0.05 : 0);
        if (Math.random() > chance) {
            const targets = [...enemySystem.enemies, bossSystem.currentBoss].filter(Boolean);
            let tx, ty;
            
            if (targets.length > 0 && Math.random() > (bonus ? 0.1 : 0.3)) {
                const target = targets[Math.floor(Math.random() * targets.length)];
                tx = target.x + target.width / 2;
                ty = target.y + target.height / 2;
                target.takeDamage(damage * (bonus ? 12 : 8)); // High impact damage
                
                // Impact effects
                visualEffectSystem.emitExplosion(tx, ty, '#ffffff', bonus ? 60 : 40);
                visualEffectSystem.emitEnergySpark(tx, ty, bonus ? bonus.color : '#eab308');
                visualEffectSystem.emitDistortion(tx, ty, bonus ? 150 : 100);
            } else {
                tx = Math.random() * 1200; // Random position
                ty = Math.random() * 800;
            }
            
            visualEffectSystem.emitLightningBolt(tx, -100, tx, ty, bonus ? bonus.color : '#eab308', level * sizeMult);
            triggerFeedback('flash', bonus ? 0.25 : 0.15); 
        }

        // Erratic Rays
        if (Math.random() > (bonus ? 0.95 : 0.98)) {
            visualEffectSystem.emitErraticRay(centerX, centerY, bonus ? bonus.color : '#a855f7');
        }

        // Damage from active erratic rays
        visualEffectSystem.getErraticRayPositions().forEach(pos => {
            const range = 150 * sizeMult;
            const enemyTargets = [...enemySystem.enemies, bossSystem.currentBoss].filter(Boolean);
            enemyTargets.forEach(e => {
                const dist = Math.sqrt((e.x + e.width / 2 - pos.x)**2 + (e.y + e.height / 2 - pos.y)**2);
                if (dist < range) {
                    e.takeDamage(damage * (bonus ? 0.75 : 0.5)); // Constant smaller damage from rays
                    if (Math.random() > 0.9) {
                        visualEffectSystem.emitEnergySpark(e.x + e.width / 2, e.y + e.height / 2, bonus ? bonus.color : '#a855f7');
                    }
                }
            });
        });
    } else if (this.activeSpecial.id === 'blizzard') {
        const level = this.activeSpecial.level;
        
        // Initial Impact Burst
        if (this.activeSpecial.timer >= this.activeSpecial.duration - 0.1) {
            visualEffectSystem.emitIceBurst(centerX, centerY, 400 * sizeMult, bonus ? bonus.color : '#60a5fa');
            triggerFeedback('flash', 0.4);
            triggerFeedback('shake', 10);
        }

        // Global blizzard visuals scaled by level
        const snowflakeCount = (15 + level * 15) * (bonus ? 2 : 1);
        for (let i = 0; i < snowflakeCount; i++) {
            visualEffectSystem.emitSnowflake(Math.random() * 2000, -100, level * sizeMult);
        }

        // Blizzard effects on entities
        const allEntities = [...enemySystem.enemies, bossSystem.currentBoss].filter(Boolean);
        allEntities.forEach((e: any) => {
            // Progressive slowdown and freeze
            const distance = Math.sqrt((e.x - centerX)**2 + (e.y - centerY)**2);
            const intensityMult = 1 - Math.min(1, distance / (800 * sizeMult));
            
            e.freeze((bonus ? 0.4 : 0.3) * intensityMult); 
            e.takeDamage(damage);
            
            // Visual freeze/ice particles
            if (Math.random() > (bonus ? 0.3 : 0.5)) {
                visualEffectSystem.emitShotParticles(e.x + e.width / 2, e.y + e.height / 2, bonus ? bonus.color : '#93c5fd');
            }
            if (Math.random() > (bonus ? 0.85 : 0.92) - level * 0.01) {
                visualEffectSystem.emitExplosion(e.x + e.width / 2, e.y + e.height / 2, '#ffffff', bonus ? 4 : 2);
                visualEffectSystem.emitIceShatter(e.x + e.width / 2, e.y + e.height / 2, bonus ? 25 : 15);
                if (Math.random() > 0.8) triggerFeedback('shake', 1 * sizeMult);
            }
        });
    }
  }

  private emitLaserVFX(x: number, y: number, w: number, h: number, color: string) {
    // Add particle along laser
    for (let i = 0; i < 5; i++) {
        const px = x + Math.random() * w;
        const py = y + (Math.random() - 0.5) * h;
        visualEffectSystem.emitShotParticles(px, py, color === 'rainbow' ? `hsl(${Date.now() % 360}, 100%, 50%)` : color);
    }
  }


  draw(ctx: CanvasRenderingContext2D) {
    const { width: cW, height: cH } = ctx.canvas;
    const state = getPlayerState();
    const mode = modeSystem.getCurrentMode();
    const tree = state.skillTree || INITIAL_SKILL_TREE;
    const scale = this.currentScale;

    // Movement animation
    const time = performance.now() / 1000;
    const isOverloaded = state.stats.isOverloaded;
    const pulse = 1 + Math.sin(time * (isOverloaded ? 15 : 8)) * (isOverloaded ? 0.08 : 0.03);
    const vibrate = Math.sin(time * (isOverloaded ? 60 : 40)) * (isOverloaded ? 0.8 : 0.4);

    // Boundary clamp
    this.x = Math.max(0, Math.min(cW - this.width, this.x));
    this.y = Math.max(0, Math.min(cH - this.height, this.y));

    // Trail
    const dx = inputManager.axisX;
    const dy = inputManager.axisY;
    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1 || isOverloaded) {
        const trailX = mode.direction === ScrollDirection.HORIZONTAL ? this.x : this.x + this.width / 2;
        const trailY = mode.direction === ScrollDirection.HORIZONTAL ? this.y + this.height / 2 : this.y + this.height;
        visualEffectSystem.emitTrailParticles(trailX, trailY, isOverloaded ? '#60a5fa44' : '#3b82f622', isOverloaded ? 5 : 3);
        
        // Ship smoke effect
        if (Math.random() > 0.6) {
            visualEffectSystem.emitSmoke(trailX, trailY, isOverloaded ? '#60a5fa22' : '#ffffff11', 8);
        }
    }

    // Draw Companions
    this.drawCompanions(ctx, time, tree);

    ctx.save();
    ctx.translate(this.x + this.width / 2 + vibrate, this.y + this.height / 2 + vibrate);
    
    // Rotate player based on direction
    if (mode.direction === ScrollDirection.VERTICAL) {
        ctx.rotate(-Math.PI / 2);
    }

    ctx.scale(scale * pulse, scale * pulse);
    
    // Draw chaotic aura if any chaos orbs are equipped
    if (state.equippedChaosOrbs.some(id => id !== null)) {
        ctx.save();
        ctx.strokeStyle = '#a855f777';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const auraRotate = time * 2;
        for (let i = 0; i < 6; i++) {
            const a = auraRotate + (i * Math.PI * 2) / 6;
            const r = 25 + Math.sin(time * 5 + i) * 3;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
    
    if (mode.playerType === PlayerType.SHIP) {
        this.drawShip(ctx, isOverloaded, time);
    } else {
        this.drawGroundVehicle(ctx, isOverloaded, time);
    }

    ctx.restore();

    // Draw Shield
    if (this.shieldHealth > 0) {
        ctx.save();
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2 + Math.sin(time * 10) * 1;
        ctx.globalAlpha = 0.4 + Math.sin(time * 5) * 0.1;
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Draw Active Specials Visuals
    if (this.activeSpecial) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const level = this.activeSpecial.level;
        
        if (this.activeSpecial.id === 'shockwave') {
            const time = this.activeSpecial.duration > 0 ? this.activeSpecial.timer / this.activeSpecial.duration : 0;
            const laserWidth = ctx.canvas.width * 0.9;
            const sizeMults = [1.1, 1.2, 1.5];
            const laserHeight = this.height * sizeMults[level - 1];
            const colors = ['#3b82f6', '#60a5fa', 'cyan'];
            const color = colors[level - 1];

            // Use the new hardened beam drawing from visualEffectSystem
            visualEffectSystem.drawShockwaveBeam(ctx, this.x + this.width, centerY, laserWidth, laserHeight, color, level, time);

            // Muzzle Flash / Core concentrate at ship nose
            const flashSize = Math.max(0.1, 40 + Math.sin(time * 40) * 15);
            if (Number.isFinite(flashSize) && Number.isFinite(this.x) && Number.isFinite(this.width) && Number.isFinite(centerY)) {
                const flashGrad = ctx.createRadialGradient(this.x + this.width, centerY, 0, this.x + this.width, centerY, flashSize);
                flashGrad.addColorStop(0, 'white');
                flashGrad.addColorStop(0.4, level === 3 ? 'cyan' : color);
                flashGrad.addColorStop(1, 'transparent');
                
                ctx.save();
                ctx.fillStyle = flashGrad;
                ctx.beginPath();
                ctx.arc(this.x + this.width, centerY, flashSize, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

        } else if (this.activeSpecial.id === 'explosion') {
            const radiusMults = [0.6, 0.9, 1.2]; // Match updated scale
            const radius = this.width * radiusMults[level - 1];
            
            ctx.save();
            // Intense core
            const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            grad.addColorStop(0, 'rgba(255, 100, 0, 0.9)');
            grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.4)');
            grad.addColorStop(1, 'transparent');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();

            // Border fire effect (Simulated with rotating gradient)
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 6;
            ctx.setLineDash([15, 8]);
            ctx.lineDashOffset = -time * 150;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 0.95, 0, Math.PI * 2);
            ctx.stroke();

            // Extra glow for boarder
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 12;
            ctx.strokeStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            ctx.restore();
        } else if (this.activeSpecial.id === 'thunder') {
            // Enhanced Thunder Visuals - Ship Overcharge effect
            ctx.save();
            
            // 1. Electrical arcs on ship
            ctx.strokeStyle = level === 3 ? '#ffffff' : '#eab308';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#eab308';
            
            for(let i=0; i<3; i++) {
                ctx.beginPath();
                let lastX = centerX + (Math.random() - 0.5) * this.width;
                let lastY = centerY + (Math.random() - 0.5) * this.height;
                ctx.moveTo(lastX, lastY);
                for(let j=0; j<3; j++) {
                    const nx = lastX + (Math.random() - 0.5) * 60;
                    const ny = lastY + (Math.random() - 0.5) * 60;
                    ctx.lineTo(nx, ny);
                    lastX = nx;
                    lastY = ny;
                }
                ctx.stroke();
            }

            // 2. Aura pulse
            const auraSize = this.width * (1.2 + Math.sin(time * 20) * 0.2);
            const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, auraSize);
            grad.addColorStop(0, '#eab30844');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(centerX, centerY, auraSize, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        } else if (this.activeSpecial.id === 'blizzard') {
            const state = getPlayerState();
            const bonus = synergySystem.getSynergyBonus(state.activePowerUp.class!, this.activeSpecial.id);
            const sizeMult = bonus ? bonus.sizeMult : 1.0;
            visualEffectSystem.drawBlizzardEffect(ctx, time, this.activeSpecial.level, bonus?.color);
            visualEffectSystem.drawIceFloorEffect(ctx, centerX, centerY, 150 * sizeMult, time);
        }
    }
  }

  private drawCompanions(ctx: CanvasRenderingContext2D, time: number, tree: any) {
    companionSystem.draw(ctx);
  }

  private drawShip(ctx: CanvasRenderingContext2D, isOverloaded: boolean, time: number) {
    // Thruster effects
    ctx.save();
    const thrusterPulse = Math.sin(time * (isOverloaded ? 30 : 20)) * (isOverloaded ? 4 : 2);
    ctx.fillStyle = isOverloaded ? '#3b82f6aa' : '#a855f766'; 
    ctx.beginPath();
    ctx.ellipse(-15, -6, (isOverloaded ? 18 : 12) + thrusterPulse, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(-15, 6, (isOverloaded ? 18 : 12) + thrusterPulse, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isOverloaded ? '#93c5fd' : '#f472b6cc';
    ctx.beginPath();
    ctx.ellipse(-12, -6, (isOverloaded ? 10 : 6) + thrusterPulse/2, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(-12, 6, (isOverloaded ? 10 : 6) + thrusterPulse/2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body
    ctx.fillStyle = '#1e293b'; 
    ctx.beginPath();
    ctx.moveTo(18, 0); 
    ctx.lineTo(8, -6);
    ctx.lineTo(-8, -10); 
    ctx.lineTo(-14, -4);
    ctx.lineTo(-14, 4);
    ctx.lineTo(-8, 10); 
    ctx.lineTo(8, 6);
    ctx.closePath();
    ctx.fill();

    this.drawEnergyCore(ctx, isOverloaded);
  }

  private drawGroundVehicle(ctx: CanvasRenderingContext2D, isOverloaded: boolean, time: number) {
    // Ground vehicle (Tank-like)
    ctx.fillStyle = '#334155'; // Darker steel
    
    // Tracks
    ctx.fillRect(-15, -12, 30, 6);
    ctx.fillRect(-15, 6, 30, 6);
    
    // Main base
    ctx.fillStyle = '#475569';
    ctx.fillRect(-12, -8, 24, 16);
    
    // Turret
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Cannon
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(8, -2, 10, 4);

    this.drawEnergyCore(ctx, isOverloaded);
  }

  private drawEnergyCore(ctx: CanvasRenderingContext2D, isOverloaded: boolean) {
    const { activePowerUp } = getPlayerState();
    let coreColor = isOverloaded ? '#60a5fa' : '#22c55e';
    
    if (activePowerUp.class === PowerUpClass.FIRE) coreColor = '#f97316';
    if (activePowerUp.class === PowerUpClass.ICE) coreColor = '#38bdf8';
    if (activePowerUp.class === PowerUpClass.ELECTRIC) coreColor = '#eab308';
    if (activePowerUp.class === PowerUpClass.PLASMA) coreColor = '#60a5fa';

    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(6, 0, isOverloaded ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(6, 0, isOverloaded ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Handle taking damage with shield support
  takeDamage(amount: number): number {
    if (this.shieldHealth > 0) {
        const absorb = Math.min(this.shieldHealth, amount);
        this.shieldHealth -= absorb;
        visualEffectSystem.emitHitEffect(this.x + this.width / 2, this.y + this.height / 2, '#60a5fa');
        return amount - absorb;
    }
    return amount;
  }
}
