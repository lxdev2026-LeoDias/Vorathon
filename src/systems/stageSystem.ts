import stagesData from '../data/stages.json';

export interface Stage {
  id: string;
  name: string;
  duration: number;
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
  
  // New Progress logic
  public bossProgress: number = 0;
  public readonly MAX_PROGRESS: number = 150;
  public isWarningBoss: boolean = false;
  public warningTimer: number = 0;
  public lastKillTimer: number = 0;

  get currentStage(): Stage {
    return this.stages[this.currentStageIndex];
  }

  reset() {
    console.log("[StageSystem] Resetting all stage state...");
    this.stageTime = 0;
    this.bossSpawned = false;
    this.stageCompleted = false;
    this.currentStageIndex = 0;
    this.bossProgress = 0;
    this.isWarningBoss = false;
    this.warningTimer = 0;
    this.lastKillTimer = 0;
  }

  nextStage() {
      console.log(`[StageSystem] Moving to next stage. Previous: ${this.currentStageIndex}`);
      this.currentStageIndex = (this.currentStageIndex + 1) % this.stages.length;
      this.stageTime = 0;
      this.bossSpawned = false;
      this.stageCompleted = false;
      this.bossProgress = 0;
      this.isWarningBoss = false;
      this.warningTimer = 0;
      this.lastKillTimer = 0;
      console.log(`[StageSystem] Next stage ready: ${this.currentStageIndex}. stageTime: ${this.stageTime}, bossSpawned: ${this.bossSpawned}, stageCompleted: ${this.stageCompleted}`);
  }

  addProgress(enemyType: string) {
    if (this.bossSpawned || this.isWarningBoss) return;
    
    let points = 0.5; // DEFAULT
    if (enemyType === 'ELITE') points = 3;
    
    this.bossProgress = Math.min(this.MAX_PROGRESS, this.bossProgress + points);
    this.lastKillTimer = 0; // Reset anti-trava
  }

  update(delta: number): { shouldSpawn: boolean, forceSpawnEnemies: boolean } {
    if (this.stageCompleted) return { shouldSpawn: false, forceSpawnEnemies: false };
    
    this.stageTime += delta;
    this.lastKillTimer += delta;

    // Anti-trava logic: if no kills for 15 seconds, force spawn more enemies
    const forceSpawnEnemies = this.lastKillTimer > 15 && !this.bossSpawned && !this.isWarningBoss;

    // Handle warning sequence
    if (this.bossProgress >= this.MAX_PROGRESS && !this.isWarningBoss && !this.bossSpawned) {
        this.isWarningBoss = true;
        this.warningTimer = 1.0; // 1 second warning
    }

    if (this.isWarningBoss) {
        this.warningTimer -= delta;
        if (this.warningTimer <= 0) {
            this.isWarningBoss = false;
            this.bossSpawned = true;
            return { shouldSpawn: true, forceSpawnEnemies: false };
        }
    }

    return { shouldSpawn: false, forceSpawnEnemies };
  }

  getSpawnRate(): number {
    // Progress-based spawn rate increase
    const progress = Math.min(1, this.bossProgress / this.MAX_PROGRESS);
    return this.currentStage.initialSpawnRate - (this.currentStage.initialSpawnRate - this.currentStage.maxSpawnRate) * progress;
  }

  completeStage() {
      this.stageCompleted = true;
  }
}

export const stageSystem = new StageSystem();
