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
  private currentScale: number = 2.0;

  // Energy & Specials
  private energyRegenTimer: number = 0;
  private activeSpecial: ActiveSpecial | null = null;
  private specialCooldowns: { [key: string]: number } = {};
  private specialCooldownTime: number = 3; // Minimum 3s base cooldown between specials

  // Companions state
  private blackHoleTimer: number = 0;
  private companionShootTimer: number = 0;
  private shieldTimer: number = 0;
  private shieldHealth: number = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(delta: number, spawnBullet: (x: number, y: number, angle: number, isEnemy: boolean, extraDmgMult?: number) => void) {
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

    // Special Skill Trigger (T, Y, U Keys)
    const specialKeys = ['KeyT', 'KeyY', 'KeyU'];
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
    this.updateCompanions(delta, spawnBullet, tree);
    
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
      
      spawnBullet(bx, by, angle, false);

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

    this.activeSpecial = {
        id,
        level,
        timer: 5,
        duration: 5
    };

    visualEffectSystem.emitExplosion(this.x + this.width / 2, this.y + this.height / 2, '#3b82f6', 60);
    effectsSystem.addFloatingText(this.x, this.y - 50, "SPECIAL ACTIVATED", '#fbbf24', true);
  }

  private updateSpecialEffects(delta: number) {
    if (!this.activeSpecial) return;
    
    const level = this.activeSpecial.level;
    const dpsLevels = [200, 300, 400];
    const dps = dpsLevels[level - 1];
    const damage = dps * delta;

    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;

    if (this.activeSpecial.id === 'shockwave') {
        // Laser logic (Rectangle to the right)
        const laserWidth = 800; // Long laser
        const sizeMults = [1.1, 1.2, 1.5];
        const laserHeight = this.height * sizeMults[level - 1];
        const laserY = centerY - laserHeight / 2;
        const laserX = this.x + this.width;

        // Visuals
        const colors = ['#3b82f6', '#60a5fa', 'rainbow'];
        const color = colors[level - 1];
        this.emitLaserVFX(laserX, centerY, laserWidth, laserHeight, color);

        // Damage calculation (Rectangle area)
        [...enemySystem.enemies, bossSystem.currentBoss].filter(Boolean).forEach((e: any) => {
            if (e.x < laserX + laserWidth && e.x + e.width > laserX &&
                e.y < laserY + laserHeight && e.y + e.height > laserY) {
                e.takeDamage(damage);
                visualEffectSystem.emitShotParticles(e.x + e.width / 2, e.y + e.height / 2, '#3b82f6');
            }
        });

    } else if (this.activeSpecial.id === 'explosion') {
        // Aura logic (Circle around player)
        const radiusMults = [2.0, 3.0, 4.0];
        const radius = this.width * radiusMults[level - 1];
        
        // Visuals
        visualEffectSystem.emitExplosion(centerX, centerY, '#f97316', 15); // Constant subtle explosions (increased)
        
        // Damage
        [...enemySystem.enemies, bossSystem.currentBoss].filter(Boolean).forEach((e: any) => {
            const dist = Math.sqrt((e.x + e.width / 2 - centerX)**2 + (e.y + e.height / 2 - centerY)**2);
            if (dist < radius) {
                e.takeDamage(damage);
                if (Math.random() > 0.8) visualEffectSystem.emitShotParticles(e.x + e.width / 2, e.y + e.height / 2, '#f97316');
            }
        });

    } else if (this.activeSpecial.id === 'thunder') {
        // Thunder logic (Random strikes on screen)
        if (Math.random() > 0.8) {
            const targets = [...enemySystem.enemies, bossSystem.currentBoss].filter(Boolean);
            if (targets.length > 0) {
                const target = targets[Math.floor(Math.random() * targets.length)];
                target.takeDamage(damage * 5); // High damage per strike instead of constant DPS
                visualEffectSystem.emitExplosion(target.x + target.width / 2, target.y + target.height / 2, '#eab308', 60);
                visualEffectSystem.emitShotParticles(target.x + target.width / 2, target.y + target.height / 2, '#ffffff');
                triggerFeedback('flash', 0.2); // Screen flash for lightning
            }
        }
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

  private updateCompanions(delta: number, spawnBullet: (x: number, y: number, angle: number, isEnemy: boolean, extraDmgMult?: number) => void, tree: any) {
    // Summoner
    if (tree.companions.summoner > 0) {
        this.blackHoleTimer += delta;
        const spawnInterval = tree.companions.summoner >= 3 ? 4 : 6;
        if (this.blackHoleTimer >= spawnInterval) {
            this.blackHoleTimer = 0;
            const bhX = this.x + this.width + 100 + Math.random() * 200;
            const bhY = this.y + this.height/2 + (Math.random() - 0.5) * 200;
            
            // Effect
            visualEffectSystem.emitExplosion(bhX, bhY, '#a855f7', 150);
            
            // Functional pull and damage
            const pullRadius = 300;
            const pullForce = 200;
            const pullDmg = 100 * tree.companions.summoner;
            
            enemySystem.enemies.forEach(e => {
                const dist = Math.sqrt((e.x - bhX)**2 + (e.y - bhY)**2);
                if (dist < pullRadius) {
                    const angle = Math.atan2(bhY - e.y, bhX - e.x);
                    e.x += Math.cos(angle) * pullForce * delta;
                    e.y += Math.sin(angle) * pullForce * delta;
                    e.takeDamage(pullDmg * delta);
                }
            });
        }
    }

    // Shooter
    if (tree.companions.shooter > 0) {
        this.companionShootTimer += delta;
        if (this.companionShootTimer >= 0.5) {
            this.companionShootTimer = 0;
            const bx = this.x - 20;
            const by = this.y + this.height / 2;
            
            spawnBullet(bx, by, 0, false, 0.5);
            if (tree.companions.shooter >= 2) spawnBullet(bx, by, -0.4, false, 0.5);
            if (tree.companions.shooter >= 3) spawnBullet(bx, by, 0.4, false, 0.5);
        }
    }

    // Supporter
    if (tree.companions.supporter > 0) {
        const cooldowns = [25, 20, 15];
        const maxShieldValues = [50, 100, 200];
        const cd = cooldowns[tree.companions.supporter - 1];
        const maxShield = maxShieldValues[tree.companions.supporter - 1];

        if (this.shieldHealth <= 0) {
            this.shieldTimer += delta;
            if (this.shieldTimer >= cd) {
                this.shieldTimer = 0;
                this.shieldHealth = maxShield;
                effectsSystem.addFloatingText(this.x, this.y - 40, "SHIELD CHARGED", '#60a5fa', true);
            }
        }
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
            const laserWidth = 800;
            const sizeMults = [1.1, 1.2, 1.5];
            const laserHeight = this.height * sizeMults[level - 1];
            const colors = ['#3b82f6', '#60a5fa', 'cyan'];
            const color = level === 3 ? `hsl(${time * 360}, 100%, 70%)` : colors[level - 1];

            ctx.save();
            
            // 1. Muzzle Flash (At ship nose)
            const flashSize = 30 + Math.sin(time * 30) * 10;
            const flashGrad = ctx.createRadialGradient(this.x + this.width, centerY, 0, this.x + this.width, centerY, flashSize);
            flashGrad.addColorStop(0, 'white');
            flashGrad.addColorStop(0.3, color);
            flashGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = flashGrad;
            ctx.beginPath();
            ctx.arc(this.x + this.width, centerY, flashSize, 0, Math.PI * 2);
            ctx.fill();

            // 2. Lens Flare (Muzzle)
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            for(let i=0; i<4; i++) {
                const angle = time * 2 + (i * Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(this.x + this.width - Math.cos(angle) * flashSize * 1.5, centerY - Math.sin(angle) * flashSize * 1.5);
                ctx.lineTo(this.x + this.width + Math.cos(angle) * flashSize * 1.5, centerY + Math.sin(angle) * flashSize * 1.5);
                ctx.stroke();
            }

            // 3. Main Beam
            const grad = ctx.createLinearGradient(this.x + this.width, 0, this.x + this.width + laserWidth, 0);
            grad.addColorStop(0, color);
            grad.addColorStop(0.5, color);
            grad.addColorStop(1, 'transparent');
            
            ctx.fillStyle = grad;
            ctx.globalAlpha = 0.4 + Math.sin(time * 25) * 0.2;
            ctx.beginPath();
            ctx.roundRect(this.x + this.width, centerY - laserHeight/1.5, laserWidth, laserHeight * 1.3, 5);
            ctx.fill();
            
            // 4. Core Beam (White/Bright)
            ctx.fillStyle = 'white';
            ctx.globalAlpha = 0.8 + Math.sin(time * 40) * 0.1;
            ctx.beginPath();
            ctx.roundRect(this.x + this.width, centerY - laserHeight/4, laserWidth, laserHeight/2, 5);
            ctx.fill();

            // 5. Tip Effect (Glow at the end of visible beam)
            const tipX = this.x + this.width + laserWidth * 0.8;
            const tipGrad = ctx.createRadialGradient(tipX, centerY, 0, tipX, centerY, laserHeight * 2);
            tipGrad.addColorStop(0, color);
            tipGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = tipGrad;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(tipX, centerY, laserHeight * 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

        } else if (this.activeSpecial.id === 'explosion') {
            const radiusMults = [2.0, 3.0, 4.0];
            const radius = this.width * radiusMults[level - 1];
            
            ctx.save();
            const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            grad.addColorStop(0, 'rgba(249, 115, 22, 0.8)');
            grad.addColorStop(0.7, 'rgba(249, 115, 22, 0.2)');
            grad.addColorStop(1, 'transparent');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();

            // Fire ring
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 5]);
            ctx.lineDashOffset = -time * 100;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 0.9, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        } else if (this.activeSpecial.id === 'thunder') {
            // Enhanced Thunder Visuals
            ctx.save();
            
            // 1. Electrical arcs on ship
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 2;
            for(let i=0; i<3; i++) {
                ctx.beginPath();
                let lastX = centerX + (Math.random() - 0.5) * this.width;
                let lastY = centerY + (Math.random() - 0.5) * this.height;
                ctx.moveTo(lastX, lastY);
                for(let j=0; j<3; j++) {
                    const nx = lastX + (Math.random() - 0.5) * 40;
                    const ny = lastY + (Math.random() - 0.5) * 40;
                    ctx.lineTo(nx, ny);
                    lastX = nx;
                    lastY = ny;
                }
                ctx.stroke();
            }

            // 2. Global screen flicker (very faint)
            if (Math.random() > 0.95) {
                ctx.fillStyle = 'rgba(234, 179, 8, 0.1)';
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            }

            // 3. Lightning Bolts (triggered periodically in draw to match update logic)
            // Note: Exact target matching is handled in update, here we just draw aesthetics
            if (Math.random() > 0.8) {
                const targetX = centerX + (Math.random() - 0.5) * 1000;
                const targetY = centerY + (Math.random() - 0.5) * 800;
                
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#eab308';
                
                ctx.beginPath();
                ctx.moveTo(targetX + (Math.random()-0.5)*200, 0); // From top
                let lx = targetX;
                let ly = 0;
                const segments = 10;
                for(let s=0; s<segments; s++) {
                    const nx = targetX + (Math.random() - 0.5) * 80;
                    const ny = (s + 1) * (targetY / segments);
                    ctx.lineTo(nx, ny);
                    lx = nx;
                    ly = ny;
                }
                ctx.stroke();
                
                // Strike point explosion
                ctx.fillStyle = '#eab308';
                ctx.beginPath();
                ctx.arc(lx, ly, 15, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        }
    }
  }

  private drawCompanions(ctx: CanvasRenderingContext2D, time: number, tree: any) {
    const drawBot = (x: number, y: number, color: string, icon: string) => {
        ctx.save();
        ctx.translate(x, y);
        const hover = Math.sin(time * 4) * 5;
        ctx.translate(0, hover);
        
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-10, -10, 20, 20, 5);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = color;
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(icon, 0, 4);
        ctx.restore();
    };

    // Positions: 1 behind, 1 top-behind, 1 bottom-behind
    if (tree.companions.summoner > 0) drawBot(this.x - 40, this.y + this.height / 2, '#a855f7', '🌀');
    if (tree.companions.shooter > 0) drawBot(this.x - 30, this.y - 20, '#f97316', '🔥');
    if (tree.companions.supporter > 0) drawBot(this.x - 30, this.y + this.height + 20, '#60a5fa', '🛡️');
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
    
    if (activePowerUp.class === 'FIRE') coreColor = '#f97316';
    if (activePowerUp.class === 'ICE') coreColor = '#38bdf8';
    if (activePowerUp.class === 'ELECTRIC') coreColor = '#eab308';

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
