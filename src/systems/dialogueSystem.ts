import { getPlayerState } from '../core/Store';
import { companionSystem, CompanionType } from './companionSystem';

export interface Dialogue {
    id: string;
    text: string;
    sourceId: 'player' | 'summoner' | 'shooter' | 'supporter';
    duration: number;
    timer: number;
    color: string;
    targetX: number;
    targetY: number;
}

class DialogueSystem {
    private dialogues: Dialogue[] = [];
    private lastDialogueTime: Record<string, number> = {
        player: 0,
        summoner: 0,
        shooter: 0,
        supporter: 0
    };
    private globalCooldown = 1.5; // Minimum time between any two dialogues

    private library = {
        player: {
            shockwave: ["BANZAAAAI!", "Agora vai!", "Laser liberado!"],
            explosion: ["GERONIMOOO!", "TOMA ESSA!", "Fogo neles!"],
            thunder: ["It's raining... THUNDERS!", "Caiam dos céus!", "Eletrizante!"],
            random: ["Vorathon neles!", "Velocidade máxima!", "Estou no controle."]
        },
        summoner: ["Pra cima deles!", "Vou puxar tudo!", "Eles não escapam!", "Buraco negro ativo!"],
        shooter: ["Engulam essa!", "Fogo liberado!", "Alvo travado!", "Recarregando... Brincadeira!"],
        supporter: ["Vai uma proteção aí, patrão?", "Escudo ativado!", "Segura firme!", "Sempre alerta!"]
    };

    update(delta: number, entityPositions: Record<string, {x: number, y: number}>) {
        for (let i = this.dialogues.length - 1; i >= 0; i--) {
            const d = this.dialogues[i];
            d.timer -= delta;
            
            // Update position to follow source
            if (entityPositions[d.sourceId]) {
                d.targetX = entityPositions[d.sourceId].x;
                d.targetY = entityPositions[d.sourceId].y;
            }

            if (d.timer <= 0) {
                this.dialogues.splice(i, 1);
            }
        }

        Object.keys(this.lastDialogueTime).forEach(key => {
            this.lastDialogueTime[key] += delta;
        });
    }

    trigger(source: Dialogue['sourceId'], event?: string) {
        // Redirect to companion system if it's a companion
        if (source !== 'player') {
            const compType = source === 'summoner' ? CompanionType.SUMMONER : 
                           source === 'shooter' ? CompanionType.SHOOTER :
                           CompanionType.SUPPORTER;
            const companion = companionSystem.getCompanion(compType);
            if (companion) {
                let choices = (this.library as any)[source];
                if (Array.isArray(choices)) {
                    companion.say(choices, 2.0);
                }
                return;
            }
        }

        const timeSinceGlobal = Math.max(...Object.values(this.lastDialogueTime));
        // Simple heuristic: if any dialogue was triggered very recently, skip
        if (this.dialogues.length > 0 && Math.min(...Object.values(this.lastDialogueTime)) < 0.8) return;
        
        if (this.lastDialogueTime[source] < this.globalCooldown) return;

        let text = "";
        if (source === 'player' && event) {
            const pool = (this.library.player as any)[event] || this.library.player.random;
            text = pool[Math.floor(Math.random() * pool.length)];
        } else if (source === 'summoner') {
            text = this.library.summoner[Math.floor(Math.random() * this.library.summoner.length)];
        } else if (source === 'shooter') {
            text = this.library.shooter[Math.floor(Math.random() * this.library.shooter.length)];
        } else if (source === 'supporter') {
            text = this.library.supporter[Math.floor(Math.random() * this.library.supporter.length)];
        } else if (source === 'player') {
            text = this.library.player.random[Math.floor(Math.random() * this.library.player.random.length)];
        }

        if (!text) return;

        const colors = {
            player: '#ffffff',
            summoner: '#a855f7',
            shooter: '#f97316',
            supporter: '#60a5fa'
        };

        this.dialogues.push({
            id: Math.random().toString(36).substr(2, 9),
            text,
            sourceId: source,
            duration: 2.5,
            timer: 2.5,
            color: colors[source],
            targetX: 0,
            targetY: 0
        });

        this.lastDialogueTime[source] = 0;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        
        // Prepare list of active dialogues and their desired screen positions
        // This helps in detecting and resolving overlaps
        const activeDialogues = this.dialogues.map(d => {
            const scale = d.timer > 2.2 ? (2.5 - d.timer) / 0.3 : (d.timer < 0.3 ? d.timer / 0.3 : 1);
            const alpha = d.timer < 0.5 ? d.timer / 0.5 : 1;
            
            // Base offset to float up
            const floatOffset = (1 - scale) * 20;
            const baseY = d.targetY - 50 - floatOffset;
            
            return {
                ...d,
                scale,
                alpha,
                currentY: baseY,
                adjustedY: baseY
            };
        });

        // Simple overlap resolution (vertical)
        // Sort by Y to prevent chaotic repositioning
        activeDialogues.sort((a, b) => a.currentY - b.currentY);
        
        const minGap = 40; // Minimum vertical distance between dialogue centers
        for (let i = 0; i < activeDialogues.length; i++) {
            for (let j = i + 1; j < activeDialogues.length; j++) {
                const a = activeDialogues[i];
                const b = activeDialogues[j];
                
                // If they are horizontally close and vertically overlapping
                const dx = Math.abs(a.targetX - b.targetX);
                const dy = Math.abs(a.adjustedY - b.adjustedY);
                
                if (dx < 100 && dy < minGap) {
                    // Push b further up
                    b.adjustedY -= (minGap - dy);
                }
            }
        }

        activeDialogues.forEach(d => {
            ctx.save(); // CRITICAL FIX: Push state for each dialogue
            
            ctx.globalAlpha = d.alpha;
            ctx.translate(d.targetX, d.adjustedY);
            ctx.scale(d.scale, d.scale);

            // Draw balloon
            ctx.font = 'bold 14px Arial';
            const metrics = ctx.measureText(d.text);
            const padding = 10;
            const w = metrics.width + padding * 2;
            const h = 30;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = d.color;
            ctx.lineWidth = 2;
            
            ctx.shadowBlur = 10;
            ctx.shadowColor = d.color;

            // Balloon body
            ctx.beginPath();
            ctx.roundRect(-w/2, -h, w, h, 8);
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(-5, 0);
            ctx.lineTo(5, 0);
            ctx.lineTo(0, 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;

            // Text
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(d.text, 0, -10);

            ctx.restore(); // CRITICAL FIX: Pop state for each dialogue
        });
        ctx.restore();
    }

    getDialogues() {
        return this.dialogues;
    }
}

export const dialogueSystem = new DialogueSystem();
