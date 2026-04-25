import { Entity } from './Types';
import { effectsSystem } from '../systems/effectsSystem';

export interface BossData {
  id: string;
  nome: string;
  titulo: string;
  vida: number;
  velocidade: number;
  comportamento: string;
  tema: string;
  descricao: string;
}

export class Boss implements Entity {
  x: number;
  y: number;
  width: number = 140;
  height: number = 200;
  hp: number;
  maxHp: number;
  data: BossData;
  speed: number;
  shootTimer: number = 0;
  shootInterval: number = 0.8;
  blinkTimer: number = 0;
  moveDir: number = 1;
  phase: number = 1;
  stateTimer: number = 0;

  constructor(x: number, y: number, data: BossData) {
    this.x = x;
    this.y = y;
    this.data = data;
    this.hp = data.vida;
    this.maxHp = data.vida;
    this.speed = data.velocidade;
  }

  get name() { return this.data.nome; }

  takeDamage(amount: number) {
    this.hp -= amount;
    this.blinkTimer = 0.1;
  }

  update(delta: number, playerPos: { x: number, y: number }, spawnBullet: (x: number, y: number, angle: number, isEnemy: boolean, dmgMult?: number) => void) {
    if (this.blinkTimer > 0) this.blinkTimer -= delta;
    this.stateTimer += delta;

    // Base Movement: Stay on right side
    const targetX = 750;
    if (this.x > targetX) {
        this.x -= 100 * delta;
    }

    // Behavior Switch
    switch (this.data.comportamento) {
      case 'invoca_sombras':
        this.updateHades(delta);
        break;
      case 'ataque_onda':
        this.updatePoseidon(delta);
        break;
      case 'ataque_rapido':
        this.updateZeus(delta);
        break;
      case 'perseguicao':
        this.updateAres(delta, playerPos);
        break;
      case 'desviar_inteligente':
        this.updateAthena(delta, playerPos);
        break;
      case 'erratico':
        this.updateHermes(delta);
        break;
      case 'precisao':
        this.updateArtemis(delta);
        break;
      case 'cria_entidades':
        this.updateHephaestus(delta);
        break;
      case 'vibracao_tempo':
        this.updateChronos(delta);
        break;
      case 'escuridao_total':
        this.updateNyx(delta);
        break;
      default:
        this.y += this.moveDir * this.speed * delta;
        if (this.y > 450 || this.y < 50) this.moveDir *= -1;
    }

    // Phase Change logic (Simplified for 10 bosses)
    if (this.hp < this.maxHp * 0.4 && this.phase === 1) {
        this.phase = 2;
        this.shootInterval *= 0.7;
        this.speed *= 1.2;
    }

    // Simple Shooting Logic (data-driven soon)
    this.shootTimer += delta;
    if (this.shootTimer >= this.shootInterval) {
      this.shootTimer = 0;
      this.fireAttack(playerPos, spawnBullet);
    }
  }

  private updateHades(delta: number) {
      this.y += Math.sin(this.stateTimer) * this.speed * delta;
  }

  private updatePoseidon(delta: number) {
      this.y += Math.cos(this.stateTimer * 0.5) * this.speed * 2 * delta;
  }

  private updateZeus(delta: number) {
      if (Math.random() < 0.02) this.moveDir *= -1;
      this.y += this.moveDir * this.speed * delta;
      if (this.y < 0 || this.y > 500) this.moveDir *= -1;
  }

  private updateAres(delta: number, playerPos: { x: number, y: number }) {
      const dy = playerPos.y - (this.y + this.height/2);
      this.y += Math.sign(dy) * this.speed * delta * 0.8;
  }

  private updateAthena(delta: number, playerPos: { x: number, y: number }) {
      this.y += this.moveDir * this.speed * delta;
      if (this.y > 400 || this.y < 100) this.moveDir *= -1;
      // Athena avoids player Y slightly
      const dy = playerPos.y - (this.y + this.height/2);
      if (Math.abs(dy) < 50) this.y -= Math.sign(dy) * 50 * delta;
  }

  private updateHermes(delta: number) {
      this.y += Math.sin(this.stateTimer * 4) * this.speed * delta;
      this.x += Math.cos(this.stateTimer * 2) * 50 * delta;
  }

  private updateArtemis(delta: number) {
      this.y += this.moveDir * this.speed * delta;
      if (this.y > 450 || this.y < 50) this.moveDir *= -1;
  }

  private updateHephaestus(delta: number) {
      this.y += this.moveDir * (this.speed * 0.5) * delta;
      if (this.y > 350 || this.y < 150) this.moveDir *= -1;
  }

  private updateChronos(delta: number) {
      const speedMod = Math.sin(this.stateTimer) > 0 ? 2 : 0.2;
      this.y += this.moveDir * this.speed * speedMod * delta;
      if (this.y > 450 || this.y < 50) this.moveDir *= -1;
  }

  private updateNyx(delta: number) {
      this.y += Math.sin(this.stateTimer * 0.2) * this.speed * delta;
  }

  private fireAttack(playerPos: { x: number, y: number }, spawnBullet: (x: number, y: number, angle: number, isEnemy: boolean, dmgMult?: number) => void) {
      const dx = playerPos.x - this.x;
      const dy = playerPos.y - (this.y + this.height/2);
      const angle = Math.atan2(dy, dx);

      if (this.data.id === 'boss_nyx') {
          for(let i=-2; i<=2; i++) spawnBullet(this.x, this.y + this.height/2, angle + i*0.2, true);
      } else if (this.data.id === 'boss_poseidon') {
          spawnBullet(this.x, this.y + this.height/2, Math.PI, true);
          spawnBullet(this.x, this.y + 40, Math.PI, true);
          spawnBullet(this.x, this.y + this.height - 40, Math.PI, true);
      } else if (this.data.id === 'boss_zeus') {
          spawnBullet(this.x, this.y + this.height/2, angle + (Math.random()-0.5), true);
      } else {
          spawnBullet(this.x, this.y + this.height/2, angle, true);
          if (this.phase === 2) {
              spawnBullet(this.x, this.y + this.height/2, angle + 0.3, true);
              spawnBullet(this.x, this.y + this.height/2, angle - 0.3, true);
          }
      }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.blinkTimer > 0) ctx.filter = 'brightness(3)';

    // Pulse
    const pulse = Math.sin(this.stateTimer * 5) * 0.1 + 1;

    // 1. Boss Bloom (Simplified)
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = this.data.tema;
    ctx.beginPath();
    ctx.arc(this.width/2, this.height/2, this.width, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Boss Body
    ctx.fillStyle = this.data.tema;
    
    ctx.beginPath();
    if (this.data.id === 'boss_zeus') {
        ctx.moveTo(0, this.height/2);
        ctx.lineTo(this.width * 0.5, 0);
        ctx.lineTo(this.width * 0.3, this.height/2);
        ctx.lineTo(this.width * 0.8, 0);
        ctx.lineTo(this.width, this.height/2);
        ctx.lineTo(this.width * 0.4, this.height);
    } else if (this.data.id === 'boss_nyx') {
        for(let i=0; i<8; i++) {
            const r = i % 2 === 0 ? this.width/2 : this.width/4;
            const ang = (i / 8) * Math.PI * 2;
            ctx.lineTo(this.width/2 + Math.cos(ang)*r, this.height/2 + Math.sin(ang)*r);
        }
    } else {
        ctx.moveTo(0, this.height/2);
        ctx.lineTo(this.width, 0);
        ctx.lineTo(this.width * 0.7, this.height/2);
        ctx.lineTo(this.width, this.height);
    }
    ctx.closePath();
    ctx.fill();

    // 3. Core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.width * 0.4, this.height/2, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
