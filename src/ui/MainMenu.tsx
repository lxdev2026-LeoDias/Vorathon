import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameState } from '../core/GameState';
import { usePlayerState, setGameMode, resetSession, updatePlayerName } from '../core/Store';
import { Zap, Shield, Play, Sword, ShieldAlert, Rocket, Truck, ChevronRight, Sparkles, Trophy, User, X, BrainCircuit } from 'lucide-react';
import { modeSystem } from '../systems/modeSystem';
import { stageSystem } from '../systems/stageSystem';
import { bossSystem } from '../systems/bossSystem';
import { enemySystem } from '../systems/enemySystem';
import { GameModeType } from '../core/Types';
import runesData from '../data/runes.json';
import relicsData from '../data/relics.json';
import { SkillTree } from './SkillTree';

interface MainMenuProps {
  onNavigate: (state: GameState) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onNavigate }) => {
  const [showModes, setShowModes] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [showSkillTree, setShowSkillTree] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const playerState = usePlayerState();
  const [tempName, setTempName] = useState(playerState.session.playerName || '');
  const [selectedMode, setSelectedMode] = useState<GameModeType | null>(null);
  const { equippedRunes, equippedRelics, equippedChaosOrbs, inventory, rankings } = playerState;
  const allRunes = (runesData as any).runes;
  const allRelics = (relicsData as any).relics;
  const chaosOrbs = inventory.chaosOrbs || [];
  const modes = modeSystem.getConfigs();

  const handleStartMode = (type: GameModeType) => {
    setSelectedMode(type);
    setShowNameInput(true);
  };

  const confirmStart = () => {
    if (!selectedMode) return;
    updatePlayerName(tempName);
    resetSession();
    stageSystem.reset();
    bossSystem.reset();
    enemySystem.reset();
    modeSystem.setMode(selectedMode);
    setGameMode(selectedMode);
    onNavigate(GameState.POWERUP_SELECTION);
  };

  return (
    <div className="relative flex h-full bg-[#020617] text-white font-sans overflow-hidden">
      {/* --- BACKGROUND LAYERS --- */}
      
      {/* 1. Starry Space Background */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(15,23,42,1)_0%,rgba(2,6,23,1)_100%)]" />
      
      {/* 2. Perspective Grid */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 perspective-grid z-0 opacity-40">
        <div className="grid-plane" />
      </div>

      {/* 3. Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute bottom-[-10px] w-1 h-1 bg-blue-400/40 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              animation: `float-particle ${5 + Math.random() * 10}s linear infinite`,
              animationDelay: `${Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* 4. Center Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] logo-vignette blur-[100px] opacity-40 pointer-events-none" />

      {/* --- CONTENT --- */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-8 z-10">
        
        {/* HUD Frame Decorative Borders */}
        <div className="absolute inset-16 border border-blue-500/10 pointer-events-none rounded-[40px] shadow-[inset_0_0_100px_rgba(59,130,246,0.05)]" />
        <div className="absolute top-10 left-10 w-20 h-20 border-t-2 border-l-2 border-blue-500/40 rounded-tl-3xl opacity-60" />
        <div className="absolute top-10 right-10 w-20 h-20 border-t-2 border-r-2 border-blue-500/40 rounded-tr-3xl opacity-60" />
        <div className="absolute bottom-10 left-10 w-20 h-20 border-b-2 border-l-2 border-blue-500/40 rounded-bl-3xl opacity-60" />
        <div className="absolute bottom-10 right-10 w-20 h-20 border-b-2 border-r-2 border-blue-500/40 rounded-br-3xl opacity-60" />

        <AnimatePresence mode="wait">
          {!showModes ? (
            <motion.div 
              key="main"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              {/* Central Ship Decoration (Ambient) */}
              <motion.div
                animate={{ y: [0, -10, 0], rotate: [0, 1, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="mb-8 p-6 bg-blue-500/5 rounded-full border border-blue-500/10 backdrop-blur-md shadow-[0_0_50px_rgba(59,130,246,0.1)] group"
              >
                <Rocket size={48} className="text-blue-500/30 group-hover:text-blue-400/60 transition-colors drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
              </motion.div>

              <div className="relative">
                <h1 className="text-8xl md:text-9xl font-black mb-16 tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-blue-300 via-blue-500 to-blue-700 italic animate-[logo-glow_4s_easeInOut_infinite] pr-4">
                  VORATHON
                </h1>
                {/* Horizontal Light Bar behind logo */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-1 bg-blue-400 blur-sm opacity-60 shadow-[0_0_30px_#60a5fa]" />
              </div>

              <div className="flex flex-col gap-6 w-80 z-20">
                <MenuButton 
                  label="JOGAR" 
                  icon={<Play size={22} className="fill-current" />} 
                  onClick={() => setShowModes(true)} 
                  primary 
                />
                <MenuButton 
                  label="RANKING" 
                  icon={<Trophy size={20} />} 
                  onClick={() => setShowRanking(true)} 
                />
                <MenuButton 
                  label="HABILIDADES" 
                  icon={<BrainCircuit size={20} />} 
                  onClick={() => setShowSkillTree(true)} 
                />
                <MenuButton 
                  label="FORJA CELESTIAL" 
                  icon={<Sword size={20} />} 
                  onClick={() => onNavigate(GameState.FORGE)} 
                />
                <MenuButton 
                  label="OPÇÕES" 
                  icon={<ChevronRight size={20} />} 
                  onClick={() => onNavigate(GameState.OPTIONS)} 
                />
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="modes"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="flex flex-col items-center w-full max-w-2xl px-4"
            >
              <h2 className="text-4xl font-black italic mb-12 tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-200">SELECIONE A OPERAÇÃO</h2>
              
              <div className="grid grid-cols-2 gap-6 w-full">
                {modes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => handleStartMode(mode.id)}
                    className="relative p-8 bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl hover:border-blue-500/50 hover:bg-slate-800 transition-all text-left flex flex-col gap-4 group overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
                    
                    <div className="flex justify-between items-start relative z-10">
                      <div className="p-4 bg-slate-950 rounded-xl text-blue-500 border border-white/5 group-hover:text-blue-400 group-hover:border-blue-500/30 transition-all shadow-inner">
                        {mode.playerType === 'SHIP' ? <Rocket size={24} /> : <Truck size={24} />}
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-blue-500/60 uppercase tracking-widest mb-1">
                          Type // 0{mode.id === GameModeType.COSMIC_ASCENSION ? 1 : mode.id === GameModeType.CELESTIAL_COLLAPSE ? 2 : 3}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest px-2 py-0.5 bg-black/40 rounded border border-white/5">
                            {mode.direction}
                        </span>
                      </div>
                    </div>
                    
                    <div className="relative z-10">
                      <h4 className="font-black text-xl mb-2 tracking-tight group-hover:text-blue-200 transition-colors">{mode.name}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed h-12 overflow-hidden opacity-80">{mode.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              <motion.button 
                whileHover={{ x: -10 }}
                onClick={() => setShowModes(false)}
                className="mt-12 text-blue-400/60 hover:text-white font-black text-[10px] uppercase tracking-[0.4em] transition-all flex items-center gap-4 bg-black/40 px-8 py-3 rounded-full border border-white/5 hover:border-blue-500/30"
              >
                <div className="w-8 h-[1px] bg-blue-500/40" />
                CANCELAR CONEXÃO
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- NAME INPUT MODAL --- */}
        <AnimatePresence>
          {showNameInput && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-slate-900 border border-blue-500/30 rounded-3xl p-10 w-full max-w-md shadow-[0_0_100px_rgba(59,130,246,0.1)]"
              >
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="p-4 bg-blue-500/10 rounded-full border border-blue-500/20">
                    <User size={32} className="text-blue-400" />
                  </div>
                  <h3 className="text-3xl font-black italic tracking-tighter text-blue-100">IDENTIFICAÇÃO DO PILOTO</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Insira seu codinome para registro na rede VORATHON e sincronização de rankings.
                  </p>
                  
                  <input 
                    type="text" 
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value.toUpperCase().slice(0, 15))}
                    placeholder="PILOTO"
                    className="w-full bg-black/40 border border-blue-500/30 rounded-xl py-4 px-6 text-center text-2xl font-black italic tracking-[0.2em] focus:border-blue-500 focus:outline-none transition-all placeholder:opacity-20"
                    autoFocus
                  />

                  <div className="flex gap-4 w-full mt-4">
                    <button 
                      onClick={() => setShowNameInput(false)}
                      className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                    >
                      CANCELAR
                    </button>
                    <button 
                      onClick={confirmStart}
                      className="flex-[2] py-4 bg-blue-600 text-white font-black italic rounded-xl hover:bg-blue-500 transition-all shadow-lg active:scale-95"
                    >
                      INICIAR OPERAÇÃO
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- RANKING MODAL --- */}
        <AnimatePresence>
          {showRanking && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowRanking(false)}
                className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 50 }}
                className="relative bg-slate-900/80 border border-yellow-500/30 rounded-[40px] p-12 w-full max-w-2xl shadow-[0_0_100px_rgba(234,179,8,0.1)] overflow-hidden"
              >
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent" />
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-yellow-500/5 blur-[100px] rounded-full" />
                
                <div className="flex justify-between items-center mb-12">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-500/20 rounded-xl border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                      <Trophy size={32} className="text-yellow-500" />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-4xl font-black italic tracking-tighter text-white">RANKING GLOBAL</h3>
                      <span className="text-[10px] text-yellow-500 font-mono tracking-[0.4em] uppercase">Top 10 Melhores Pilotos</span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRanking(false);
                    }}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white relative z-50 cursor-pointer"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                  {rankings && rankings.length > 0 ? (
                    rankings.map((entry: any, i: number) => (
                      <div 
                        key={i} 
                        className={`group flex items-center justify-between p-5 rounded-2xl border transition-all ${
                          i === 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 
                          i === 1 ? 'bg-slate-400/10 border-slate-400/30' :
                          i === 2 ? 'bg-orange-600/10 border-orange-600/30' :
                          'bg-black/20 border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-6">
                          <span className={`w-8 text-2xl font-black italic italic ${
                            i === 0 ? 'text-yellow-500' : 
                            i === 1 ? 'text-slate-400' :
                            i === 2 ? 'text-orange-600' :
                            'text-slate-600'
                          }`}>
                            {i + 1}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-lg font-black tracking-widest text-white group-hover:text-blue-300 transition-colors">{entry.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] font-mono text-slate-500 tracking-wider bg-black/40 px-2 py-0.5 rounded border border-white/5">{entry.mode}</span>
                              <span className="text-[9px] font-mono text-slate-600">{entry.date}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={`text-2xl font-black italic tracking-tighter ${
                            i === 0 ? 'text-yellow-500' : 'text-blue-400'
                          }`}>
                            {entry.score?.toLocaleString() || 0}
                          </span>
                          <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">PONTOS</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-4">
                      <Sparkles size={48} className="opacity-20" />
                      <p className="font-mono text-xs uppercase tracking-[0.3em]">Nenhum registro encontrado</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {showSkillTree && (
            <SkillTree onClose={() => setShowSkillTree(false)} />
          )}
        </AnimatePresence>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-slate-600 font-mono text-[10px] uppercase tracking-[0.5em] opacity-30 select-none">
          V0.2.0-BETA // MULTI-MODE CORE SYSTEM
        </div>
      </div>

      {/* --- SIDEBAR INFO (EQUIPMENT) --- */}
      <div className="relative w-[340px] h-full bg-black/40 backdrop-blur-2xl border-l border-white/5 p-10 flex flex-col items-center justify-center gap-14 shadow-[-50px_0_100px_rgba(0,0,0,0.5)] z-20">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-emerald-500/5 opacity-50" />
          
          <div className="flex flex-col items-center gap-6 relative z-10 w-full">
              <div className="flex items-center gap-3 w-full">
                <div className="flex-grow h-[1px] bg-gradient-to-r from-transparent to-blue-500/30" />
                <h3 className="text-[10px] font-black italic text-blue-400 uppercase tracking-[0.3em] whitespace-nowrap">Rune Matrix</h3>
                <div className="flex-grow h-[1px] bg-gradient-to-l from-transparent to-blue-500/30" />
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                  {equippedRunes.map((id: any, i: number) => {
                      const rune = id ? allRunes.find((r: any) => r.id === id) : null;
                      return (
                          <div key={i} className={`group relative w-20 h-20 rounded-2xl bg-black/40 border-2 ${rune ? 'border-blue-500/50 shadow-[0_0_25px_rgba(59,130,246,0.2)]' : 'border-white/5'} flex items-center justify-center transition-all hover:scale-105`}>
                              <div className="absolute inset-2 border border-white/5 rounded-xl" />
                              {rune ? <span className="text-3xl drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">{rune.icon}</span> : <Zap size={22} className="text-slate-900 group-hover:text-blue-900/20 transition-colors" />}
                          </div>
                      );
                  })}
              </div>
          </div>

          <div className="flex flex-col items-center gap-6 relative z-10 w-full">
              <div className="flex items-center gap-3 w-full">
                <div className="flex-grow h-[1px] bg-gradient-to-r from-transparent to-emerald-500/30" />
                <h3 className="text-[10px] font-black italic text-emerald-400 uppercase tracking-[0.3em] whitespace-nowrap">Relic Cache</h3>
                <div className="flex-grow h-[1px] bg-gradient-to-l from-transparent to-emerald-500/30" />
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                  {equippedRelics.map((id: any, i: number) => {
                      const relic = id ? allRelics.find((r: any) => r.id === id) : null;
                      return (
                          <div key={i} className={`group relative w-20 h-20 rounded-2xl bg-black/40 border-2 ${relic ? 'border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.2)]' : 'border-white/5'} flex items-center justify-center transition-all hover:scale-105`}>
                              <div className="absolute inset-2 border border-white/5 rounded-xl" />
                              {relic ? <span className="text-3xl drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">{relic.icon}</span> : <Shield size={22} className="text-slate-900 group-hover:text-emerald-900/20 transition-colors" />}
                          </div>
                      );
                  })}
              </div>
          </div>

          <div className="flex flex-col items-center gap-6 relative z-10 w-full mt-4">
              <div className="flex items-center gap-3 w-full">
                <div className="flex-grow h-[1px] bg-gradient-to-r from-transparent to-purple-500/30" />
                <h3 className="text-[10px] font-black italic text-purple-400 uppercase tracking-[0.3em] whitespace-nowrap">Chaos Orbs</h3>
                <div className="flex-grow h-[1px] bg-gradient-to-l from-transparent to-purple-500/30" />
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                  {equippedChaosOrbs.map((id: any, i: number) => {
                      const orb = id ? chaosOrbs.find((o: any) => o.id === id) : null;
                      return (
                          <div key={i} className={`group relative w-20 h-20 rounded-2xl bg-black/40 border-2 ${orb ? 'border-purple-500/50 shadow-[0_0_25px_rgba(168,85,247,0.2)]' : 'border-white/5'} flex items-center justify-center transition-all hover:scale-105`}>
                              <div className="absolute inset-2 border border-white/5 rounded-xl" />
                              {orb ? <span className="text-3xl drop-shadow-[0_0_10px_rgba(168,85,247,0.5)] animate-pulse">{orb.icon || '✨'}</span> : <Sparkles size={22} className="text-slate-900 group-hover:text-purple-900/20 transition-colors" />}
                          </div>
                      );
                  })}
              </div>
          </div>
      </div>
    </div>
  );
};

const MenuButton: React.FC<{ label: string; onClick: () => void; primary?: boolean; icon?: React.ReactNode }> = ({ label, onClick, primary, icon }) => {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    setTimeout(() => setClicked(false), 200);
    onClick();
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05, boxShadow: primary ? "0 0 30px rgba(59, 130, 246, 0.4)" : "0 0 20px rgba(59, 130, 246, 0.1)" }}
      whileTap={{ scale: 0.96 }}
      onClick={handleClick}
      className={`relative py-5 px-8 text-lg font-black rounded-lg transition-all flex items-center justify-center gap-4 uppercase tracking-[0.2em] italic overflow-hidden sci-fi-button ${
        primary 
          ? 'bg-blue-600/90 text-white border border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
          : 'bg-slate-950/80 text-blue-100/80 border border-blue-900/50 hover:border-blue-500/50'
      }`}
    >
      {/* Click Flash */}
      <AnimatePresence>
        {clicked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/20 z-10"
          />
        )}
      </AnimatePresence>

      {/* Inner decorative light line */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full hover:animate-[energy-flow_2s_linear_infinite]" />
      
      <span className={primary ? "text-white" : "text-blue-400/70"}>{icon}</span>
      {label}
    </motion.button>
  );
};
