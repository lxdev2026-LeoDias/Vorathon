import { Boss, BossData } from '../core/Boss';
import { difficultySystem } from './difficultySystem';
import bossesData from '../data/bosses.json';

export class BossSystem {
  private availableBosses: BossData[] = (bossesData as any).bosses;
  currentBoss: Boss | null = null;
  bossDefeated: boolean = false;

  reset() {
    this.currentBoss = null;
    this.bossDefeated = false;
  }

  spawnBoss(canvasWidth: number, canvasHeight: number, bossId: string) {
    const data = this.availableBosses.find(b => b.id === bossId);
    if (!data) {
        console.error(`Boss with ID ${bossId} not found!`);
        return;
    }
    
    const diff = difficultySystem.getModifiers();
    const scaledData = {
        ...data,
        vida: Math.floor(data.vida * diff.bossHealthMultiplier)
    };

    this.currentBoss = new Boss(canvasWidth + 200, canvasHeight / 2 - 100, scaledData);
    this.bossDefeated = false;
  }

  update(delta: number, playerPos: { x: number, y: number }, spawnBullet: (x: number, y: number, angle: number, isEnemy: boolean, dmgMult?: number) => void) {
    if (this.currentBoss) {
      this.currentBoss.update(delta, playerPos, spawnBullet);
      if (this.currentBoss.hp <= 0) {
        this.currentBoss = null;
        this.bossDefeated = true;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.currentBoss?.draw(ctx);
  }
}

export const bossSystem = new BossSystem();
