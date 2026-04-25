import { getPlayerState } from '../core/Store';
import runesData from '../data/runes.json';
import relicsData from '../data/relics.json';
import { environmentSystem } from './environmentSystem';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
    type?: 'ambient' | 'fire' | 'energy' | 'glow' | 'lightning';
}

export class VisualEffectSystem {
    private runes = (runesData as any).runes;
    private relics = (relicsData as any).relics;
    
    private particles: Particle[] = [];
    private ambientParticles: Particle[] = [];
    private maxParticles = 800; // High limit for intense effects
    private orbitAngle = 0;
    private pulseTimer = 0;
    private flickerTimer = 0;
    private ambientEnergyTimer = 0;

    constructor() {
        this.initAmbientParticles();
    }

    private initAmbientParticles() {
        this.ambientParticles = [];
        for (let i = 0; i < 100; i++) {
            this.ambientParticles.push({
                x: Math.random() * 2000,
                y: Math.random() * 2000,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                life: 1,
                maxLife: 1,
                color: '#ffffff',
                size: Math.random() * 2 + 0.5,
                type: 'ambient'
            });
        }
    }

    update(delta: number) {
        this.orbitAngle += 1.5 * delta;
        this.pulseTimer += (getPlayerState().stats.isOverloaded ? 6 : 2) * delta;
        this.flickerTimer += 10 * delta;
        this.ambientEnergyTimer += delta;

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * delta;
            p.y += p.vy * delta;
            
            p.life -= delta;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update ambient particles
        this.ambientParticles.forEach(p => {
            p.x += p.vx * delta;
            p.y += p.vy * delta;
            if (p.x < 0) p.x = 2000;
            if (p.x > 2000) p.x = 0;
            if (p.y < 0) p.y = 2000;
            if (p.y > 2000) p.y = 0;
        });
    }

    emitHitEffect(x: number, y: number, color: string) {
        const count = 30; // High density for impact
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= this.maxParticles) break;
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 800,
                vy: (Math.random() - 0.5) * 800,
                life: 0.5,
                maxLife: 0.5,
                color,
                size: Math.random() * 5 + 1
            });
        }
    }

    emitExplosion(x: number, y: number, color: string, intensity: number = 25) {
        const actualIntensity = intensity * 4; 
        
        // 1. Shockwave Ripple
        this.particles.push({
            x, y, vx: 0, vy: 0,
            life: 0.4, maxLife: 0.4,
            color, size: 1, type: 'glow'
        });

        // 2. Central Flash
        this.particles.push({
            x, y, vx: 0, vy: 0,
            life: 0.2, maxLife: 0.2,
            color: '#ffffff', size: 50, type: 'ambient'
        });

        // 3. Shrapnel
        for (let i = 0; i < actualIntensity; i++) {
            if (this.particles.length >= this.maxParticles) break;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1000 + 300;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Math.random() * 1.0 + 0.5,
                maxLife: 1.5,
                color: i % 2 === 0 ? color : '#ffffff',
                size: Math.random() * 10 + 2
            });
        }
    }

    emitLevelUp(x: number, y: number) {
        const colors = ['#f59e0b', '#fbbf24', '#ffffff'];
        for (let i = 0; i < 200; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 700 + 400;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 2.0,
                maxLife: 2.0,
                color: colors[i % colors.length],
                size: Math.random() * 8 + 3
            });
        }
        
        // Ring
        this.particles.push({
            x, y, vx: 0, vy: 0,
            life: 1.0, maxLife: 1.0,
            color: '#fbbf24', size: 2, type: 'glow'
        });
    }

    emitShotParticles(x: number, y: number, color: string) {
        const count = 10;
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= this.maxParticles) break;
            this.particles.push({
                x, y,
                vx: (Math.random() - 1.5) * 250, 
                vy: (Math.random() - 0.5) * 200,
                life: 0.4,
                maxLife: 0.4,
                color,
                size: Math.random() * 4 + 1
            });
        }
    }

    emitTrailParticles(x: number, y: number, color: string, size: number = 2) {
        if (this.particles.length >= this.maxParticles) return;
        this.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 30,
            vy: (Math.random() - 0.5) * 30,
            life: 0.8,
            maxLife: 0.8,
            color,
            size: Math.random() * size + 1
        });
    }

    drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
        const theme = environmentSystem.getTheme();

        // 1. Dynamic Background Gradient
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, theme.bgColor1);
        bgGradient.addColorStop(1, theme.bgColor2);
        ctx.fillStyle = bgGradient;
        ctx.fillRect(-width, -height, width * 3, height * 3);

        // 2. Nebulae
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        this.drawNebula(ctx, width * 0.2, height * 0.3, 700, theme.nebulaColor1, time * 0.1);
        this.drawNebula(ctx, width * 0.8, height * 0.7, 800, theme.nebulaColor2, time * -0.08);
        ctx.restore();

        // 3. Ambient Elements
        this.drawAmbientEffects(ctx, width, height, time, theme);

        // 4. Parallax Stars
        for (let i = 0; i < 3; i++) {
            const speed = (i + 1) * 25;
            const offset = (time * speed) % 1000;
            ctx.fillStyle = theme.particleColor;
            ctx.globalAlpha = 0.1 + i * 0.1;
            for(let x = -width; x < width * 2; x += 400) {
                for(let y = -height; y < height * 2; y += 400) {
                    const px = x - offset + (i * 123);
                    const py = y + (i * 456);
                    ctx.beginPath();
                    ctx.arc(px, py, i + 1, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.globalAlpha = 1;

        // Overlay Vignette
        const vignette = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width * 1.2);
        vignette.addColorStop(0, 'transparent');
        vignette.addColorStop(0.8, 'rgba(0,0,0,0.1)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vignette;
        ctx.fillRect(-width, -height, width*3, height*3);
    }

    private drawAmbientEffects(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, theme: any) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = theme.particleColor;
        ctx.fillStyle = theme.particleColor;

        if (theme.ambientEffects === 'bubbles') {
            for(let i=0; i<30; i++) {
                const y = (height + 200) - ((time * 80 + i * 150) % (height + 400));
                const x = (i * 100 + Math.sin(time + i) * 60) % width;
                ctx.beginPath();
                ctx.arc(x, y, 1 + Math.random() * 4, 0, Math.PI * 2);
                ctx.stroke();
            }
        } else if (theme.ambientEffects === 'lava') {
             ctx.globalAlpha = 0.4;
             for(let i=0; i<12; i++) {
                const x = (width + 200) - ((time * 120 + i * 250) % (width + 400));
                const y = (i * 100 + Math.cos(time * 0.4 + i) * 120) % height;
                this.drawGlowCircle(ctx, x, y, 50 + Math.random() * 50, '#ef444433');
             }
        } else if (theme.ambientEffects === 'leaves') {
            for(let i=0; i<20; i++) {
                const x = (width + 200) - ((time * 60 + i * 180) % (width + 400));
                const y = (i * 150 + Math.sin(time * 0.2 + i) * 100) % height;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(time + i);
                ctx.fillRect(-5, -2, 10, 4);
                ctx.restore();
            }
        }
        ctx.restore();
    }

    private drawGlowCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawNebula(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, rotation: number) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.scale(3, 1.5); 
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    draw(ctx: CanvasRenderingContext2D, playerX: number, playerY: number, playerW: number, playerH: number) {
        const state = getPlayerState();
        const equippedRunes = state.equippedRunes.filter(Boolean);
        const equippedRelics = state.equippedRelics.filter(Boolean);
        const isOverloaded = state.stats.isOverloaded;

        const px = playerX + playerW / 2;
        const py = playerY + playerH / 2;
        const pulse = 1 + Math.sin(this.pulseTimer * 3) * (isOverloaded ? 0.3 : 0.1);

        if (isOverloaded) this.drawOverloadAura(ctx, px, py, pulse);

        if (equippedRelics.length >= 4) {
            const avgColor = this.getAverageColor(equippedRelics, this.relics);
            this.emitTrailParticles(px, py, avgColor, 8);
        } else {
            this.emitTrailParticles(px, py, '#3b82f644', 4);
        }

        if (equippedRunes.length >= 4) {
            equippedRunes.forEach((id, i) => {
                const rune = this.runes.find((r: any) => r.id === id);
                if (rune) this.drawOrbitingSphere(ctx, px, py, i, rune.color);
            });
        }

        this.drawParticles(ctx);
    }

    private drawOverloadAura(ctx: CanvasRenderingContext2D, x: number, y: number, pulse: number) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const auraSize = 140 * pulse;
        const grad = ctx.createRadialGradient(x, y, 10, x, y, auraSize);
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.7)');
        grad.addColorStop(0.7, 'rgba(59, 130, 246, 0.2)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, auraSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.4 * pulse;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, 45 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    private getAverageColor(equippedIds: string[], dataList: any[]): string {
        const first = dataList.find(d => d.id === equippedIds[0]);
        return first?.color || '#ffffff';
    }

    private drawOrbitingSphere(ctx: CanvasRenderingContext2D, px: number, py: number, index: number, color: string) {
        const radius = 90;
        const angle = this.orbitAngle * (1 + index * 0.2) + (index * Math.PI / 2);
        const sx = px + Math.cos(angle) * radius;
        const sy = py + Math.sin(angle) * radius;
        const sphereSize = 10 * (1 + Math.sin(this.pulseTimer + index) * 0.2);

        ctx.save();
        ctx.fillStyle = color;
        this.drawGlowCircle(ctx, sx, sy, sphereSize * 2.5, color + '55');
        ctx.beginPath();
        ctx.arc(sx, sy, sphereSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, sphereSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    private drawParticles(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        this.particles.forEach(p => {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;

            if (p.type === 'glow') {
                const growth = (1 - alpha) * 600;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 6 * alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, growth, 0, Math.PI * 2);
                ctx.stroke();
            } else if (p.type === 'ambient') {
                 // Solid flash or blob
                 ctx.beginPath();
                 ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
                 ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.restore();
    }
}

export const visualEffectSystem = new VisualEffectSystem();
