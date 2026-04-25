import stagesData from '../data/stages.json';

export interface Stage {
  id: string;
  name: string;
  duration: number;
  bossSpawnTime: number;
  enemyPool: string[];
  initialSpawnRate: number;
  maxSpawnRate: number;
  bossId: string;
}

export class StageSystem {
  private stages: Stage[] = stagesData.stages;
  private currentStageIndex: number = 0;
  
  public stageTime: number = 0;
  public bossSpawned: boolean = false;
  public stageCompleted: boolean = false;

  get currentStage(): Stage {
    return this.stages[this.currentStageIndex];
  }

  reset() {
    console.log("[StageSystem] Resetting all stage state...");
    this.stageTime = 0;
    this.bossSpawned = false;
    this.stageCompleted = false;
    this.currentStageIndex = 0;
  }

  nextStage() {
      console.log(`[StageSystem] Moving to next stage. Previous: ${this.currentStageIndex}`);
      this.currentStageIndex = (this.currentStageIndex + 1) % this.stages.length;
      this.stageTime = 0;
      this.bossSpawned = false;
      this.stageCompleted = false;
      console.log(`[StageSystem] Next stage ready: ${this.currentStageIndex}. stageTime: ${this.stageTime}, bossSpawned: ${this.bossSpawned}, stageCompleted: ${this.stageCompleted}`);
  }

  update(delta: number): boolean {
    if (this.stageCompleted) return false;
    
    this.stageTime += delta;

    // Check boss spawn
    const shouldSpawn = !this.bossSpawned && (
      this.stageTime >= this.currentStage.bossSpawnTime || 
      this.stageTime >= this.currentStage.duration // Failsafe: spawn if stage duration is reached
    );

    if (shouldSpawn) {
      console.log(`[StageSystem] Spawning boss for stage ${this.currentStage.id} (${this.currentStage.name}) at time ${this.stageTime}`);
      this.bossSpawned = true;
      return true; // Signal to spawn boss
    }

    return false;
  }

  getSpawnRate(): number {
    // Linear interpolation between initial and max spawn rate based on duration
    const progress = Math.min(1, this.stageTime / this.currentStage.duration);
    return this.currentStage.initialSpawnRate - (this.currentStage.initialSpawnRate - this.currentStage.maxSpawnRate) * progress;
  }

  completeStage() {
      this.stageCompleted = true;
  }
}

export const stageSystem = new StageSystem();
