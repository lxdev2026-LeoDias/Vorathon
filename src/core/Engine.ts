import { Player } from './Player';
import { Bullet } from './Bullet';
import { enemySystem } from '../systems/enemySystem';
import { combatSystem } from '../systems/combatSystem';
import { dropSystem } from '../systems/dropSystem';
import { progressionSystem } from '../systems/progressionSystem';
import { effectsSystem } from '../systems/effectsSystem';
import { stageSystem } from '../systems/stageSystem';
import { bossSystem } from '../systems/bossSystem';
import { statusSystem } from '../systems/statusSystem';
import { runeSystem } from '../systems/runeSystem';
import { relicSystem } from '../systems/relicSystem';
import { effectSystem } from '../systems/effectSystem';
import { visualEffectSystem } from '../systems/visualEffectSystem';
import { eventSystem } from '../systems/eventSystem';
import { overloadSystem } from '../systems/overloadSystem';
import { modeSystem } from '../systems/modeSystem';
import { powerUpSystem } from '../systems/powerUpSystem';
import { difficultySystem } from '../systems/difficultySystem';
import { gameOverSystem, GameOverStep } from '../systems/gameOverSystem';
import { updatePlayerState, getPlayerState, triggerFeedback, evolvePowerUp, addScore, handlePlayerDeath, resetSession, addRune, addRelic, addLife, addRankingEntry } from './Store';
import { inputManager } from './InputManager';
import { GameState } from './GameState';
import { ScrollDirection, PowerUpClass } from './Types';
import { BulletType } from './Bullet';
import { DropType } from '../systems/dropSystem';

export class Engine {
  private lastTime: number = 0;
  private running: boolean = false;
  private ctx: CanvasRenderingContext2D | null = null;
  private player: Player | null = null;
  private bullets: Bullet[] = [];
  private setGameState?: (state: GameState) => void;
  
  // Background & Camera
  private bgTime: number = 0;
  private camOffset = { x: 0, y: 0 };
  private shakeAmount: number = 0;
  private shotsCounter: number = 0;

  constructor(ctx: CanvasRenderingContext2D, setGameState?: (state: GameState) => void) {
    this.ctx = ctx;
    this.setGameState = setGameState;
  }

  start(player: Player) {
    this.player = player;
    this.running = true;
    this.lastTime = performance.now();
    this.shotsCounter = 0;
    gameOverSystem.reset();
    eventSystem.reset();
    
    // Sync mode system with store
    const state = getPlayerState();
    modeSystem.setMode(state.currentGameMode);
    
    requestAnimationFrame(this.loop.bind(this));
  }

  stop() {
    this.running = false;
  }

  private loop(now: number) {
    if (!this.running || !this.ctx) return;

    const rawDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Apply GameOver Time Scaling
    const delta = rawDelta * gameOverSystem.timeScale;

    // Pause handling
    if(inputManager.isKeyDown('Escape') && gameOverSystem.step === GameOverStep.NONE) {
        this.setGameState?.(GameState.PAUSED);
        this.lastTime = performance.now(); // reset timer to avoid huge delta on resume
    }

    this.update(delta, rawDelta);
    this.draw();

    if (gameOverSystem.showMenu) {
        this.setGameState?.(GameState.GAME_OVER);
        this.stop();
        return;
    }

    requestAnimationFrame(this.loop.bind(this));
  }

  private spawnBullet = (x: number, y: number, angle: number, isEnemy: boolean, extraDmgMult: number = 1) => {
    const pu = powerUpSystem.getEffect();
    const color = !isEnemy ? pu.bulletColor : undefined;

    if (!isEnemy) {
        this.shotsCounter++;
        const mods = effectSystem.getModifiers();
        const sizeMult = mods.weaponSizeMult || 1;
        
        // Multi-shot logic
        const spread = 0.1;
        const count = pu.shotCount;
        for (let i = 0; i < count; i++) {
            const offset = (i - (count - 1) / 2) * spread;
            const b = new Bullet(x, y, angle + offset, false, color);
            b.width *= sizeMult;
            b.height *= sizeMult;
            b.damageMult = extraDmgMult;
            this.bullets.push(b);
        }

        // Special Level 4 effect
        if (this.shotsCounter >= 5) {
            this.shotsCounter = 0;
            if (pu.specialEffect) {
                let type = BulletType.NORMAL;
                if (pu.specialEffect === 'MISSILE') type = BulletType.MISSILE;
                if (pu.specialEffect === 'PLASMA') type = BulletType.PLASMA;
                if (pu.specialEffect === 'ARC') type = BulletType.ARC;

                const specialBullet = new Bullet(x, y, angle, false, color, type, 3);
                specialBullet.width *= sizeMult;
                specialBullet.height *= sizeMult;
                
                // Target selection for missile
                if (type === BulletType.MISSILE) {
                    const target = bossSystem.currentBoss || enemySystem.enemies[0] || null;
                    if (target) specialBullet.setTarget(target);
                }
                
                this.bullets.push(specialBullet);
            }
        }

        visualEffectSystem.emitShotParticles(x, y, color || '#3b82f6');
        runeSystem.onShoot((bx: number, by: number, ba: number) => {
            this.bullets.push(new Bullet(bx, by, ba, false, color));
            visualEffectSystem.emitShotParticles(bx, by, color || '#3b82f6');
        }, { x, y });
    } else {
        this.bullets.push(new Bullet(x, y, angle, isEnemy));
    }
  };

  private update(delta: number, rawDelta: number) {
    if (!this.player) return;

    // Update GameOver sequence
    gameOverSystem.update(rawDelta, this.player.x, this.player.y);
    if (gameOverSystem.step >= GameOverStep.FREEZE_STAY) return; // Full freeze

    this.bgTime += delta;
    this.player.update(delta, this.spawnBullet);

    const mods = effectSystem.getModifiers();
    const state = getPlayerState();

    // Camera follow player subtly
    const targetCamX = -inputManager.axisX * 20;
    const targetCamY = -inputManager.axisY * 20;
    this.camOffset.x += (targetCamX - this.camOffset.x) * 5 * delta;
    this.camOffset.y += (targetCamY - this.camOffset.y) * 5 * delta;

    // Shake decay - 1 second duration feel
    if (state.feedback.shake > this.shakeAmount) {
        this.shakeAmount = state.feedback.shake;
    }
    if (this.shakeAmount > 0) {
        // Decrease by 20 units per second. If starting at 20, it lasts 1s.
        this.shakeAmount -= 20 * rawDelta; 
        if (this.shakeAmount < 0) this.shakeAmount = 0;
    }

    // --- STAGE PROGRESSION ---
    const shouldSpawnBoss = stageSystem.update(delta);
    if (shouldSpawnBoss) {
        bossSystem.spawnBoss(this.ctx!.canvas.width, this.ctx!.canvas.height, stageSystem.currentStage.bossId);
    }

    if (bossSystem.bossDefeated && !stageSystem.stageCompleted) {
        stageSystem.completeStage();
        // Clear all bullets and enemies for clean transition
        this.bullets = [];
        enemySystem.enemies = [];
        setTimeout(() => this.setGameState?.(GameState.STAGE_RESULTS), 1500);
    }

    // Sync Max Stats from Skill Tree / Modifiers
    const baseMaxHp = 100; // Hardcoded base or from player.json
    const baseMaxEnergy = 100;
    const targetMaxHp = baseMaxHp + mods.maxHpAdd;
    const targetMaxEnergy = baseMaxEnergy + mods.maxEnergyAdd;

    if (state.stats.maxHp !== targetMaxHp || state.stats.maxEnergy !== targetMaxEnergy) {
        updatePlayerState(prev => ({
            ...prev,
            stats: {
                ...prev.stats,
                maxHp: targetMaxHp,
                maxEnergy: targetMaxEnergy
            }
        }));
    }

    // Update Projectiles
    const mode = modeSystem.getCurrentMode();
    this.bullets.forEach(b => b.update(delta));
    
    if (mode.direction === ScrollDirection.HORIZONTAL) {
        this.bullets = this.bullets.filter(b => b.x > -150 && b.x < this.ctx!.canvas.width + 150 && b.active);
    } else {
        this.bullets = this.bullets.filter(b => b.y > -150 && b.y < this.ctx!.canvas.height + 150 && b.active);
    }

    visualEffectSystem.update(delta);

    // Update Entities via Systems
    // If boss is active, reduce common enemy spawns significantly
    const spawnRateModifier = bossSystem.currentBoss ? 0.1 : 1;
    enemySystem.update(delta * spawnRateModifier, this.ctx!.canvas.width, this.ctx!.canvas.height, { x: this.player.x, y: this.player.y }, this.spawnBullet);
    
    // Process Status Effects on Enemies
    statusSystem.update(delta, enemySystem.enemies, (id, dmg) => {
        const enemy = enemySystem.enemies.find(e => e.id === id);
        if (enemy) {
            enemy.hp -= dmg;
            if (Math.random() < 0.1) effectsSystem.addFloatingText(enemy.x, enemy.y, "🔥", '#f97316');
        }
    });

    bossSystem.update(delta, { x: this.player.x, y: this.player.y }, this.spawnBullet);
    eventSystem.update(delta);
    dropSystem.update(delta, { x: this.player.x, y: this.player.y });
    relicSystem.update(delta);
    overloadSystem.update();
    effectsSystem.update(delta);

    // --- COLLISION LOGIC ---

    // 1. Player Bullets -> Enemies/Boss
    const puEff = powerUpSystem.getEffect();
    
    this.bullets.filter(b => !b.isEnemyBullet).forEach(b => {
      // Check Enemies
      enemySystem.enemies.forEach(e => {
        if (combatSystem.checkCollision(b, e)) {
          let damageMult = mods.damageMult * puEff.damageMult * b.damageMult;
          
          // Low HP Boost
          const lowHpFX = mods.onInterval.find((f: any) => f.type === 'LOW_HP_BOOST');
          if (lowHpFX) {
              const missingHpPerc = 1 - (state.stats.hp / state.stats.maxHp);
              damageMult *= (1 + missingHpPerc * lowHpFX.mult);
          }

          const baseDmg = (state.stats.damage + mods.bonusDamage) * damageMult;
          const critChance = state.stats.critChance + mods.critChanceAdd;
          const dmg = combatSystem.calculateDamage(baseDmg, critChance, state.stats.critDamage);
          
          e.takeDamage(dmg.amount);
          visualEffectSystem.emitHitEffect(e.x + e.width/2, e.y + e.height/2, e.type === 'ELITE' ? '#fbbf24' : '#ef4444');
          visualEffectSystem.emitShotParticles(e.x + e.width/2, e.y + e.height/2, '#ffffff'); // Impact sparks
          
          // Execution check
          if (e.hp / e.maxHp < mods.executionThreshold) {
              e.hp = 0;
              effectsSystem.addFloatingText(e.x, e.y, "EXECUTED", '#ef4444', true);
          }

          if (!mods.piercing) b.active = false;
          effectsSystem.addFloatingText(e.x, e.y, dmg.amount.toString(), dmg.isCrit ? '#fbbf24' : '#ffffff', dmg.isCrit);
          
          // PowerUp visual hit feedback
          if (state.activePowerUp.class === PowerUpClass.FIRE) visualEffectSystem.emitHitEffect(e.x, e.y, '#f97316');
          if (state.activePowerUp.class === PowerUpClass.ICE) visualEffectSystem.emitHitEffect(e.x, e.y, '#38bdf8');
          if (state.activePowerUp.class === PowerUpClass.ELECTRIC) visualEffectSystem.emitHitEffect(e.x, e.y, '#eab308');

          // Rune hit effect
          runeSystem.onHit(e, dmg.amount);

          // Additional systems based on mods
          mods.onHit.forEach((fx: any) => {
              if (fx.type === 'HEAL' && Math.random() < fx.chance) {
                  updatePlayerState(prev => ({
                      ...prev,
                      stats: { ...prev.stats, hp: Math.min(prev.stats.maxHp, prev.stats.hp + fx.amount * mods.healingMult) }
                  }));
              }
              if (fx.type === 'SPLASH') {
                  enemySystem.enemies.forEach(nearby => {
                      if (nearby.id === e.id) return;
                      const dist = Math.sqrt((nearby.x - e.x)**2 + (nearby.y - e.y)**2);
                      if (dist < fx.radius) {
                          nearby.takeDamage(dmg.amount * fx.mult);
                      }
                  });
              }
          });

          if (e.hp <= 0) {
            // Rune death effect
            runeSystem.onDeath(e, (x: number, y: number, mult: number) => {
                effectsSystem.addExplosion(x, y, '#ef4444', 30);
                // Area damage logic could go here
            });
            relicSystem.onKill(e);

            // Relic/Rune onKill specifics
            mods.onInterval.forEach((fx: any) => {
                // If we had onKill in onInterval, we'd process it here
            });
            if (mods.onKillEnergy) {
                updatePlayerState(prev => ({ ...prev, stats: { ...prev.stats, energy: Math.min(prev.stats.maxEnergy, prev.stats.energy + mods.onKillEnergy) } }));
            }

            // PowerUp Evolution Drop Logic
            const pu = state.activePowerUp;
            let spawnEvolution = false;
            
            // Level 2: any enemy after 30s of run
            if (pu.class && pu.level === 1 && stageSystem.stageTime > 20) {
                if (Math.random() < 0.04) spawnEvolution = true;
            } 
            // Level 3: Only from elites if L2 active
            else if (pu.class && pu.level === 2 && e.type === 'ELITE') {
                if (Math.random() < 0.25) spawnEvolution = true;
            } 
            // Level 4: Only from elites if L3 active (lower chance)
            else if (pu.class && pu.level === 3 && e.type === 'ELITE') {
                if (Math.random() < 0.1) spawnEvolution = true;
            }

            if (spawnEvolution) {
                dropSystem.spawnElementalEvolution(e.x, e.y, pu.class);
            }

            const diff = difficultySystem.getModifiers();

            // Elite shard drop
            if (e.type === 'ELITE' && Math.random() < diff.shardChance) {
                dropSystem.spawnShard(e.x, e.y);
            }

            const goldGain = Math.floor(50 * mods.goldMult * diff.goldMultiplier);
            const scoreGain = Math.floor((e.type === 'ELITE' ? 100 : 15) * mods.scoreMult);
            const xpGain = Math.floor(scoreGain * diff.xpMultiplier);

            updatePlayerState(prev => ({
                ...prev,
                session: {
                    ...prev.session,
                    kills: prev.session.kills + 1,
                    elitesKilled: e.type === 'ELITE' ? prev.session.elitesKilled + 1 : prev.session.elitesKilled,
                    goldGained: prev.session.goldGained + goldGain
                }
            }));

            dropSystem.rollDrop(e.x, e.y, 40 * (mods.goldDropChance || 1), e.type === 'ELITE');
            addScore(scoreGain, e.type === 'ELITE');
            this.gainXP(xpGain);
            visualEffectSystem.emitExplosion(e.x + e.width/2, e.y + e.height/2, e.type === 'ELITE' ? '#f59e0b' : '#ef4444', 30); // 2x base
          }
        }
      });

      // Check Boss
      if (bossSystem.currentBoss && combatSystem.checkCollision(b, bossSystem.currentBoss)) {
          const dmg = combatSystem.calculateDamage(state.stats.damage * puEff.damageMult * b.damageMult, state.stats.critChance, state.stats.critDamage);
          bossSystem.currentBoss.takeDamage(dmg.amount);
          visualEffectSystem.emitHitEffect(b.x, b.y, '#f59e0b');
          b.active = false;
          effectsSystem.addFloatingText(bossSystem.currentBoss.x, bossSystem.currentBoss.y, dmg.amount.toString(), dmg.isCrit ? '#fbbf24' : '#ffffff', dmg.isCrit);
          if (bossSystem.currentBoss.hp <= 0) {
              updatePlayerState(prev => ({
                  ...prev,
                  session: {
                      ...prev.session,
                      bossesKilled: prev.session.bossesKilled + 1
                  }
              }));
              dropSystem.spawnShard(bossSystem.currentBoss.x, bossSystem.currentBoss.y);
              dropSystem.rollDrop(bossSystem.currentBoss.x, bossSystem.currentBoss.y, 100, false, true); // Boss drop
              addScore(2500, true);
              this.gainXP(500);
              visualEffectSystem.emitExplosion(bossSystem.currentBoss.x + bossSystem.currentBoss.width/2, bossSystem.currentBoss.y + bossSystem.currentBoss.height/2, '#f59e0b', 80); // Massive 2x
          }
      }
    });

    // 2. Enemy Bullets / Enemies / Boss -> Player
    const playerBox = { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height };
    const diffMods = difficultySystem.getModifiers();
    
    this.bullets.filter(b => b.isEnemyBullet).forEach(b => {
      if (combatSystem.checkCollision(b, playerBox)) {
        b.active = false;
        // Enemy bullets could have their own damage property in the future
        const dmg = this.player!.takeDamage(10 * diffMods.enemyDamageMultiplier);
        if (dmg > 0) this.damagePlayer(dmg);
      }
    });

    enemySystem.enemies.forEach(e => {
        if (combatSystem.checkCollision(e, playerBox)) {
            e.hp = 0;
            const dmg = this.player!.takeDamage(e.damage);
            if (dmg > 0) this.damagePlayer(dmg);
        }
    });

    if (bossSystem.currentBoss && combatSystem.checkCollision(bossSystem.currentBoss, playerBox)) {
        this.damagePlayer(1); // Rapid micro-damage for contact
    }

    // 3. Player -> Drops
    dropSystem.drops.forEach((d, idx) => {
        if (combatSystem.checkCollision(d, playerBox)) {
            if (d.type === DropType.ELEMENTAL_EVOLUTION) {
                evolvePowerUp();
                effectsSystem.addFloatingText(this.player!.x, this.player!.y - 50, "POWER UP EVOLVED!", '#fbbf24', true);
                visualEffectSystem.emitExplosion(this.player!.x, this.player!.y, d.puClass === 'FIRE' ? '#f97316' : (d.puClass === 'ICE' ? '#38bdf8' : '#eab308'), 50);
            } else if (d.type === DropType.RUNE && d.itemId) {
                addRune(d.itemId);
                effectsSystem.addFloatingText(this.player!.x, this.player!.y - 50, "RUNE DISCOVERED!", '#3b82f6', true);
                visualEffectSystem.emitExplosion(this.player!.x, this.player!.y, '#3b82f6', 40);
            } else if (d.type === DropType.RELIC && d.itemId) {
                addRelic(d.itemId);
                effectsSystem.addFloatingText(this.player!.x, this.player!.y - 50, "RELIC DISCOVERED!", '#10b981', true);
                visualEffectSystem.emitExplosion(this.player!.x, this.player!.y, '#10b981', 40);
            } else if (d.type === DropType.LIFE) {
                addLife(1);
                effectsSystem.addFloatingText(this.player!.x, this.player!.y - 50, "+1 LIFE", '#ef4444', true);
                visualEffectSystem.emitExplosion(this.player!.x, this.player!.y, '#ef4444', 40);
            } else {
                updatePlayerState(prev => ({
                    ...prev,
                    currency: {
                        ...prev.currency,
                        gold: d.type === 'GOLD' ? prev.currency.gold + 50 : prev.currency.gold,
                        primordialShards: d.type === DropType.SHARD ? prev.currency.primordialShards + 1 : prev.currency.primordialShards
                    },
                    session: {
                        ...prev.session,
                        goldGained: d.type === 'GOLD' ? prev.session.goldGained + 50 : prev.session.goldGained,
                        shardsGained: d.type === DropType.SHARD ? prev.session.shardsGained + 1 : prev.session.shardsGained
                    }
                }));
            }
            dropSystem.drops.splice(idx, 1);
        }
    });
  }

  private gainXP(amount: number) {
      const state = getPlayerState();
      const res = progressionSystem.calculateExp(state.progression.exp, amount, state.progression.level);
      
      updatePlayerState(prev => ({
          ...prev,
          progression: {
            ...prev.progression,
            exp: res.newExp,
            level: res.newLevel,
            nextLevelExp: res.nextLevelExp
          }
      }));

      if (res.leveledUp) {
          effectsSystem.addFloatingText(this.player!.x, this.player!.y - 80, "LEVEL UP!", '#fbbf24', true);
          visualEffectSystem.emitLevelUp(this.player!.x + this.player!.width/2, this.player!.y + this.player!.height/2);
      }
  }

  private damagePlayer(amount: number) {
      if (gameOverSystem.step !== GameOverStep.NONE) return;
      const mods = effectSystem.getModifiers();
      
      if (Math.random() < mods.dodgeChance) {
          effectsSystem.addFloatingText(this.player!.x, this.player!.y - 30, "DODGED", '#60a5fa', true);
          return;
      }

      triggerFeedback('shake', 20);
      triggerFeedback('flash', 0.4);
      triggerFeedback('hpChanged', true);
      effectsSystem.addFloatingText(this.player!.x, this.player!.y, `-${Math.ceil(amount)}`, '#ef4444');

      updatePlayerState(prev => ({
          ...prev,
          stats: {
              ...prev.stats,
              hp: Math.max(0, prev.stats.hp - amount)
          }
      }));

      if (getPlayerState().stats.hp <= 0) {
          handlePlayerDeath();
          const newState = getPlayerState();
          if (newState.session.lives <= 0) {
              addRankingEntry(newState.session.playerName, newState.session.score, newState.currentGameMode);
              gameOverSystem.start(this.player!.x, this.player!.y);
              return;
          } else {
              // Re-center player or just visual feedback
              visualEffectSystem.emitExplosion(this.player!.x, this.player!.y, '#ef4444', 100);
              this.player!.x = this.ctx!.canvas.width / 2;
              this.player!.y = this.ctx!.canvas.height / 2;
          }
      }
  }

  private draw() {
    if (!this.ctx) return;
    const { width, height } = this.ctx.canvas;
    
    this.ctx.save();
    
    // Zoom/Camera transformation
    if (gameOverSystem.step !== GameOverStep.NONE) {
        const tx = gameOverSystem.cameraTarget.x;
        const ty = gameOverSystem.cameraTarget.y;
        this.ctx.translate(width / 2, height / 2);
        this.ctx.scale(gameOverSystem.zoom, gameOverSystem.zoom);
        this.ctx.translate(-tx, -ty);
    } else {
        const sx = (Math.random() - 0.5) * this.shakeAmount;
        const sy = (Math.random() - 0.5) * this.shakeAmount;
        this.ctx.translate(this.camOffset.x + sx, this.camOffset.y + sy);
    }

    visualEffectSystem.drawBackground(this.ctx, width, height, this.bgTime);

    dropSystem.draw(this.ctx);
    enemySystem.draw(this.ctx);
    bossSystem.draw(this.ctx);
    this.bullets.forEach(b => b.draw(this.ctx!));
    
    if (this.player && gameOverSystem.step < GameOverStep.EXPLODING) {
      visualEffectSystem.draw(this.ctx, this.player.x, this.player.y, this.player.width, this.player.height);
      this.player.draw(this.ctx);
    }

    effectsSystem.draw(this.ctx);

    this.ctx.restore();

    // Red Overlay (Game Over)
    if (gameOverSystem.overlayAlpha > 0) {
        this.ctx.fillStyle = `rgba(180, 0, 0, ${gameOverSystem.overlayAlpha})`;
        this.ctx.fillRect(0, 0, width, height);
    }

    // GAME OVER TEXT
    if (gameOverSystem.step >= GameOverStep.SHOW_TEXT) {
        const textScale = Math.min(1.0, 0.5 + gameOverSystem.timer * 2);
        this.ctx.save();
        this.ctx.translate(width / 2, height / 2);
        this.ctx.scale(textScale, textScale);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '900 80px "Inter", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = 'red';
        this.ctx.shadowBlur = 20;
        this.ctx.fillText('GAME OVER', 0, 0);
        this.ctx.restore();
    }

    const state = getPlayerState();
    if (state.feedback.flash > 0) {
        this.ctx.fillStyle = `rgba(239, 68, 68, ${state.feedback.flash})`;
        this.ctx.fillRect(0, 0, width, height);
    }

    // --- EVENT FEEDBACK ---
    if (eventSystem.isHordeActive()) {
        const time = performance.now() / 1000;
        const opacity = 0.05 + Math.sin(time * 4) * 0.02;
        this.ctx.fillStyle = `rgba(239, 68, 68, ${opacity})`;
        this.ctx.fillRect(0, 0, width, height);
    }

    if (eventSystem.messageTimer > 0) {
        this.ctx.save();
        this.ctx.translate(width / 2, height * 0.3);
        const scale = 1 + Math.sin(performance.now() / 200) * 0.05;
        this.ctx.scale(scale, scale);
        
        this.ctx.fillStyle = 'rgba(234, 179, 8, 1)';
        this.ctx.font = 'italic 900 32px "Inter", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = 'rgba(234, 179, 8, 0.5)';
        this.ctx.shadowBlur = 15;
        this.ctx.fillText(eventSystem.message, 0, 0);
        
        // Glitch line
        if (Math.random() > 0.8) {
            this.ctx.fillRect(-200, 10, 400, 2);
        }
        
        this.ctx.restore();
    }
  }
}
