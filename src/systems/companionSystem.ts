import { BulletType } from '../core/Bullet';
import { getPlayerState, updatePlayerState } from '../core/Store';
import { visualEffectSystem } from './visualEffectSystem';
import { dialogueSystem } from './dialogueSystem';
import { enemySystem } from './enemySystem';
import { effectsSystem } from './effectsSystem';
import { bossSystem } from './bossSystem';

export enum CompanionType {
    SUMMONER = 'summoner',
    SHOOTER = 'shooter',
    SUPPORTER = 'supporter'
}

export enum CompanionState {
    IDLE = 'idle',
    EXECUTING = 'executing',
    COOLDOWN = 'cooldown'
}

interface SpeechBubble {
    text: string;
    timer: number;
    maxTimer: number;
}

export class Companion {
    type: CompanionType;
    x: number = 0;
    y: number = 0;
    targetX: number = 0;
    targetY: number = 0;
    
    private state: CompanionState = CompanionState.IDLE;
    private cooldown: number = 0;
    private maxCooldown: number = 0;
    private executionTimer: number = 0;
    private bubble: SpeechBubble | null = null;
    
    private scale: number = 1.0;
    private targetScale: number = 1.0;
    private rotation: number = 0;
    private pulseIntensity: number = 0;
    
    private color: string;
    private icon: string;

    constructor(type: CompanionType) {
        this.type = type;
        this.maxCooldown = type === CompanionType.SUMMONER ? 20 : (type === CompanionType.SUPPORTER ? 25 : 0.5);
        this.cooldown = this.maxCooldown;
        
        switch (type) {
            case CompanionType.SUMMONER:
                this.color = '#a855f7';
                this.icon = '🌀';
                break;
            case CompanionType.SHOOTER:
                this.color = '#f97316';
                this.icon = '🔥';
                break;
            case CompanionType.SUPPORTER:
                this.color = '#60a5fa';
                this.icon = '🛡️';
                break;
            default:
                this.color = '#ffffff';
                this.icon = '🤖';
        }
    }

    update(delta: number, playerX: number, playerY: number, playerWidth: number, playerHeight: number, spawnBullet: any) {
        const time = performance.now() / 1000;
        const tree = getPlayerState().skillTree;
        const level = (tree.companions as any)[this.type] || 0;
        
        if (level === 0) return;

        // Update Position Targets
        let offsetDx = -60;
        let offsetDy = 0;
        
        if (this.type === CompanionType.SUMMONER) {
            offsetDx = -70;
            offsetDy = playerHeight + 30;
        } else if (this.type === CompanionType.SHOOTER) {
            offsetDx = -50;
            offsetDy = playerHeight / 2;
        } else if (this.type === CompanionType.SUPPORTER) {
            offsetDx = -70;
            offsetDy = -30;
        }

        // Active state logic
        if (this.state === CompanionState.EXECUTING) {
            this.executionTimer -= delta;
            this.targetScale = 1.35;
            this.pulseIntensity = 1.0;
            
            // Move away from ship during execution (only for Summoner and Supporter)
            if (this.type !== CompanionType.SHOOTER) {
                offsetDx -= 60; // 50% more distance
            }

            if (this.executionTimer <= 0) {
                this.state = CompanionState.COOLDOWN;
                this.cooldown = this.maxCooldown;
                // Cooldown scaling
                if (this.type === CompanionType.SUPPORTER) {
                    const cds = [25, 20, 15];
                    this.cooldown = cds[level - 1] || 25;
                } else if (this.type === CompanionType.SUMMONER) {
                    const cds = [20, 15, 10]; // Faster CD for higher levels
                    this.cooldown = cds[level - 1] || 20;
                }
            }

            // Continuous Skill Effects
            if (this.type === CompanionType.SUMMONER) {
                this.executeSummonerBehavior(delta, level);
            }
        } else {
            this.targetScale = 1.0;
            this.pulseIntensity = Math.sin(time * 5) * 0.2 + 0.2;
            
            if (this.cooldown > 0) {
                this.cooldown -= delta;
            } else if (level > 0) {
                // Auto trigger logic
                this.triggerAbility(spawnBullet, level);
            }
        }

        this.targetX = playerX + offsetDx;
        this.targetY = playerY + offsetDy;

        // Organic Following (delayed movement)
        const lerpFactor = this.state === CompanionState.EXECUTING ? 3 : 5;
        this.x += (this.targetX - this.x) * lerpFactor * delta;
        this.y += (this.targetY - this.y) * lerpFactor * delta;

        // Visual Lerping
        this.scale += (this.targetScale - this.scale) * 5 * delta;
        this.rotation = Math.sin(time * 3) * 0.1;

        // Speech Bubble
        if (this.bubble) {
            this.bubble.timer -= delta;
            if (this.bubble.timer <= 0) this.bubble = null;
        }

        // Trail during movement
        if (Math.random() > 0.7) {
            visualEffectSystem.emitTrailParticles(this.x, this.y, this.color + '44', 1);
        }
    }

    private triggerAbility(spawnBullet: any, level: number) {
        this.state = CompanionState.EXECUTING;
        
        switch (this.type) {
            case CompanionType.SUMMONER:
                this.executionTimer = 4;
                this.say(["Puxando tudo!", "Vem pro abismo!", "Gravidade ativada!", "Singularidade!"], 2);
                visualEffectSystem.emitExplosion(this.x, this.y, this.color, 100);
                break;
                
            case CompanionType.SUPPORTER:
                this.executionTimer = 1.5;
                this.say(["Proteção ativada!", "Segura firme!", "Escudo no ar!", "Energizando!"], 2);
                this.executeSupporterBehavior(level);
                break;
                
            case CompanionType.SHOOTER:
                this.executionTimer = 0.1;
                this.executeShooterBehavior(spawnBullet, level);
                if (Math.random() < 0.3) {
                     this.say(["Engulam essa!", "Fogo liberado!", "Sem piedade!", "Alvo na mira!"], 1.5);
                }
                break;
        }
    }

    private executeSummonerBehavior(delta: number, level: number) {
        const state = getPlayerState();
        // Area in front of Player
        const centerX = this.targetX + 300; 
        const centerY = this.targetY;
        
        // Visual distortion
        if (Math.random() > 0.3) {
            visualEffectSystem.emitDistortion(centerX, centerY, 180);
        }

        // Sucking particles
        for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 100 + Math.random() * 100;
            const px = centerX + Math.cos(angle) * dist;
            const py = centerY + Math.sin(angle) * dist;
            const vx = (centerX - px) * 2;
            const vy = (centerY - py) * 2;
            
            // Reusing spark for "sucking"
            visualEffectSystem.emitEnergySpark(px, py, this.color);
        }
        
        // Dark core visual
        visualEffectSystem.emitExplosion(centerX, centerY, '#000000', 5);
        
        // Gravity pull
        const pullRadius = 350 + level * 50;
        const pullForce = 300 + level * 50;
        const pullDmg = 200 * level;
        
        const targets = [...enemySystem.enemies, bossSystem.currentBoss].filter(Boolean);
        targets.forEach(e => {
            const dx = centerX - (e.x + e.width / 2);
            const dy = centerY - (e.y + e.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < pullRadius) {
                const angle = Math.atan2(dy, dx);
                const force = (1 - dist / pullRadius) * pullForce;
                e.x += Math.cos(angle) * force * delta;
                e.y += Math.sin(angle) * force * delta;
                e.takeDamage(pullDmg * delta);
                
                if (Math.random() > 0.8) {
                    visualEffectSystem.emitShotParticles(e.x + e.width / 2, e.y + e.height/2, this.color);
                }
            }
        });
    }

    private executeSupporterBehavior(level: number) {
        // Shoot energy projectile to player
        const state = getPlayerState();
        const maxShieldValues = [80, 150, 300];
        const amount = maxShieldValues[level - 1] || 80;
        
        // Visual beam to player
        visualEffectSystem.emitLightningBolt(this.x, this.y, this.targetX + 60, this.targetY, this.color, 2);
        
        // Wave effect at player position
        setTimeout(() => {
            visualEffectSystem.emitExplosion(this.targetX + 60, this.targetY, this.color, 40);
            visualEffectSystem.emitDistortion(this.targetX + 60, this.targetY, 120);
        }, 100);

        (window as any).playerShieldRequest = amount;
    }

    private executeShooterBehavior(spawnBullet: any, level: number) {
        const bx = this.x + 20;
        const by = this.y;
        
        spawnBullet(bx, by, 0, false, undefined, BulletType.NORMAL, 0.6);
        if (level >= 2) spawnBullet(bx, by, -0.3, false, undefined, BulletType.NORMAL, 0.5);
        if (level >= 3) spawnBullet(bx, by, 0.3, false, undefined, BulletType.NORMAL, 0.5);
        
        visualEffectSystem.emitShotParticles(bx, by, this.color);
    }

    private say(choices: string[], duration: number) {
        const text = choices[Math.floor(Math.random() * choices.length)];
        this.bubble = { text, timer: duration, maxTimer: duration };
    }

    draw(ctx: CanvasRenderingContext2D) {
        const tree = getPlayerState().skillTree;
        const level = (tree.companions as any)[this.type] || 0;
        if (level === 0) return;

        const time = performance.now() / 1000;
        const idleBob = Math.sin(time * 3 + (this.type === CompanionType.SUMMONER ? 1 : 0)) * 5;

        ctx.save();
        ctx.translate(this.x, this.y + idleBob);
        ctx.rotate(this.rotation);
        
        const s = this.scale;
        ctx.scale(s, s);

        // Aura / Glow during execution
        if (this.state === CompanionState.EXECUTING || this.state === CompanionState.IDLE) {
            const glowSize = 20 + this.pulseIntensity * 15;
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
            grad.addColorStop(0, this.color + '44');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // Body
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-12, -12, 24, 24, 4);
        ctx.fill();
        ctx.stroke();

        // Eye / Core
        ctx.fillStyle = this.color;
        const eyePulse = Math.sin(time * 10) * 1 + 3;
        ctx.beginPath();
        ctx.arc(0, -4, eyePulse, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner white light
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(0, -4, eyePulse * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Icon
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.icon, 0, 10);

        // Cooldown Indicator (Ring)
        if (this.state === CompanionState.COOLDOWN && this.maxCooldown > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = this.color;
            const progress = (this.cooldown / this.maxCooldown);
            ctx.beginPath();
            ctx.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + (1 - progress) * Math.PI * 2);
            ctx.stroke();
        } else if (this.state === CompanionState.IDLE && this.cooldown <= 0) {
            // Pulse glow when ready
            ctx.save();
            ctx.globalAlpha = Math.sin(time * 10) * 0.3 + 0.3;
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, 18 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();

        // Draw Speech Bubble
        if (this.bubble) {
            this.drawSpeechBubble(ctx, this.x, this.y + idleBob - 30);
        }
    }

    private drawSpeechBubble(ctx: CanvasRenderingContext2D, x: number, y: number) {
        if (!this.bubble) return;
        
        const padding = 10;
        ctx.font = 'bold 12px Arial';
        const metrics = ctx.measureText(this.bubble.text);
        const w = metrics.width + padding * 2;
        const h = 24;
        
        // Bounce effect on entry
        const lifeFactor = 1 - (this.bubble.timer / this.bubble.maxTimer);
        const bounce = Math.sin(lifeFactor * Math.PI * 10) * Math.exp(-lifeFactor * 5) * 5;
        
        ctx.save();
        ctx.translate(x, y - bounce);
        
        // Tail
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-5, -5);
        ctx.lineTo(5, -5);
        ctx.fill();
        
        // Box
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h - 5, w, h, 8);
        ctx.fill();
        
        // Text
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.bubble.text, 0, -h / 2 - 5);
        
        ctx.restore();
    }
}

export const companionSystem = {
    companions: [] as Companion[],
    
    init() {
        this.companions = [
            new Companion(CompanionType.SHOOTER),
            new Companion(CompanionType.SUMMONER),
            new Companion(CompanionType.SUPPORTER)
        ];
    },

    update(delta: number, playerX: number, playerY: number, playerWidth: number, playerHeight: number, spawnBullet: any) {
        this.companions.forEach(c => c.update(delta, playerX, playerY, playerWidth, playerHeight, spawnBullet));
    },

    draw(ctx: CanvasRenderingContext2D) {
        this.companions.forEach(c => c.draw(ctx));
    },

    getCompanion(type: CompanionType) {
        return this.companions.find(c => c.type === type);
    }
};
