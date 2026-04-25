import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hammer, Zap, Shield, ArrowLeft, Diamond, Info, Sparkles, AlertTriangle, Trash2, X } from 'lucide-react';
import { usePlayerState, equipRune, unequipRune, equipRelic, unequipRelic, equipChaosOrb, unequipChaosOrb, deductShards, destroyChaosOrb, updatePlayerState } from '../core/Store';
import { forgeChaosOrb } from '../systems/forgeSystem';
import runesData from '../data/runes.json';
import relicsData from '../data/relics.json';

interface ForgeScreenProps {
  onBack: () => void;
}

export const ForgeScreen: React.FC<ForgeScreenProps> = ({ onBack }) => {
  const playerState = usePlayerState();
  const { equippedRunes, equippedRelics, equippedChaosOrbs, inventory, currency } = playerState;
  const [hoveredItem, setHoveredItem] = useState<{ item: any, type?: string, pos: { x: number, y: number }, side?: 'left' | 'right' } | null>(null);
  const [selectedItemMenu, setSelectedItemMenu] = useState<{ item: any, pos: { x: number, y: number }, type: 'rune' | 'relic' } | null>(null);
  
  // Selection for forging
  const [selectedRune, setSelectedRune] = useState<any | null>(null);
  const [selectedRelic, setSelectedRelic] = useState<any | null>(null);
  const [isForging, setIsForging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDestruction, setConfirmDestruction] = useState<string | null>(null);

  const allRunes = (runesData as any).runes;
  const allRelics = (relicsData as any).relics;
  const chaosOrbs = inventory.chaosOrbs || [];

  const handleMouseMove = (e: React.MouseEvent, item: any, type?: 'rune' | 'relic' | 'chaos') => {
    // Determine tooltip position based on item type
    let x = e.clientX + 15;
    let y = e.clientY + 15;
    let side: 'left' | 'right' = 'right';

    if (type === 'rune') {
        // Runas (right side of screen) should show tooltip to the left
        x = e.clientX - 15;
        side = 'left';
    }

    setHoveredItem({
        item,
        type,
        pos: { x, y },
        side
    });
  };

  const onItemClick = (e: React.MouseEvent, item: any, type: 'rune' | 'relic') => {
      e.stopPropagation();
      setHoveredItem(null); // Close tooltip when clicking
      setSelectedItemMenu({
          item,
          pos: { x: e.clientX, y: e.clientY },
          type
      });
  };

  const handleEquipFromMenu = () => {
      if (!selectedItemMenu) return;
      const { item, type } = selectedItemMenu;
      
      if (type === 'rune') {
          const emptySlot = equippedRunes.findIndex(id => id === null);
          if (emptySlot !== -1) equipRune(item.id, emptySlot);
      } else {
          const emptySlot = equippedRelics.findIndex(id => id === null);
          if (emptySlot !== -1) equipRelic(item.id, emptySlot);
      }
      setSelectedItemMenu(null);
  };

  const handleForgeFromMenu = () => {
    if (!selectedItemMenu) return;
    const { item, type } = selectedItemMenu;
    
    if (type === 'rune') setSelectedRune(item);
    else setSelectedRelic(item);
    
    setSelectedItemMenu(null);
};

  const handleStartForge = () => {
      if (!selectedRune || !selectedRelic) return;
      
      if (chaosOrbs.length >= 4) {
          setErrorMessage("Limite de Orbes atingido. Destrua um Orbe para criar outro.");
          setTimeout(() => setErrorMessage(null), 3000);
          return;
      }

      if (currency.primordialShards < 10) {
          setErrorMessage("Fragmentos Primordiais insuficientes (Necessário 10)");
          setTimeout(() => setErrorMessage(null), 3000);
          return;
      }

      setIsForging(true);
      setTimeout(() => {
          const result = forgeChaosOrb(selectedRune, selectedRelic);
          if (typeof result === 'string') {
              setErrorMessage(result);
          } else {
              deductShards(10);
              setSelectedRune(null);
              setSelectedRelic(null);
          }
          setIsForging(false);
      }, 2000);
  };

  const handleDestroy = (id: string) => {
      destroyChaosOrb(id);
      // Return 10 shards (resource base)
      updatePlayerState(prev => ({
          ...prev,
          currency: { ...prev.currency, primordialShards: prev.currency.primordialShards + 10 }
      }));
      setConfirmDestruction(null);
  };

  const getRarityColor = (rarity: string) => {
      switch (rarity) {
          case 'MYTHIC': return 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]';
          case 'EPIC': return 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]';
          case 'RARE': return 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]';
          case 'LEGENDARY': return 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]';
          default: return 'bg-slate-600 text-slate-200';
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white p-6 gap-6 font-sans select-none overflow-hidden" onMouseLeave={() => setHoveredItem(null)}>
      {/* Tooltip */}
      <AnimatePresence>
        {hoveredItem && (
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, x: hoveredItem.side === 'left' ? -20 : 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`fixed z-[1000] pointer-events-none ${hoveredItem.item.category === 'CHAOS' ? 'min-w-[400px] p-6' : 'p-4 max-w-xs'} bg-slate-900/95 border border-slate-700/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-200`}
                style={{ 
                    left: hoveredItem.pos.x, 
                    top: hoveredItem.pos.y,
                    transform: hoveredItem.side === 'left' ? 'translateX(-100%)' : 'none'
                }}
            >
                {hoveredItem.item.category === 'CHAOS' ? (
                    /* Chaos Orb Card Style from image */
                    <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-5">
                            <div className="w-16 h-16 bg-slate-950 rounded-2xl border border-purple-500/30 flex items-center justify-center shadow-inner shrink-0 scale-110">
                                <span className="text-4xl drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">{hoveredItem.item.icon}</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <h4 className="text-2xl font-black italic uppercase tracking-wider text-white leading-tight">
                                    {hoveredItem.item.name}
                                </h4>
                                <div className="flex items-center gap-3">
                                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md tracking-widest ${getRarityColor(hoveredItem.item.rarity)}`}>
                                        {hoveredItem.item.rarity}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <p className="text-slate-300 text-[13px] leading-relaxed font-medium italic opacity-80 border-l-2 border-purple-500/30 pl-4 py-1">
                                {hoveredItem.item.description || "Manifestação energética pura."}
                            </p>

                            {/* Passives from components */}
                            {(() => {
                                const rune = allRunes.find((r:any) => r.id === hoveredItem.item.runeId);
                                const relic = allRelics.find((r:any) => r.id === hoveredItem.item.relicId);
                                return (
                                    <div className="flex flex-col gap-2 bg-black/30 p-3 rounded-xl border border-slate-800/50">
                                        {rune?.passive && (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Runa: {rune.name}</span>
                                                <p className="text-[10px] text-slate-400 italic">"{rune.passive}"</p>
                                            </div>
                                        )}
                                        {relic?.passive && (
                                            <div className="flex flex-col gap-1 border-t border-slate-800/50 pt-2">
                                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Relíquia: {relic.name}</span>
                                                <p className="text-[10px] text-slate-400 italic">"{relic.passive}"</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="flex flex-wrap gap-2 mt-1">
                            {hoveredItem.item.tags.map((tag: string) => (
                                <span key={tag} className="text-[10px] font-black uppercase px-3 py-1 bg-slate-800/80 text-slate-400 rounded-lg border border-slate-700/50">
                                    #{tag}
                                </span>
                            ))}
                        </div>

                        {hoveredItem.item.bonuses && (
                            <div className="mt-2 pt-3 border-t border-slate-800/50 flex flex-col gap-2">
                                <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em]">Atributos Adicionais</span>
                                <div className="grid grid-cols-2 gap-2">
                                    {hoveredItem.item.bonuses.map((b: string, i: number) => (
                                        <div key={i} className="flex items-center gap-2 text-[10px] text-amber-400/90 font-black italic bg-amber-500/5 px-2 py-1.5 rounded-lg border border-amber-500/10">
                                            <Sparkles size={10} className="text-amber-500" /> {b}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Standard Tooltip for Runes/Relics */
                    <>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">{hoveredItem.item.icon || '✨'}</span>
                            <div>
                                <h4 className="font-black italic uppercase text-sm tracking-tight">{hoveredItem.item.name}</h4>
                                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${getRarityColor(hoveredItem.item.rarity)}`}>
                                    {hoveredItem.item.rarity}
                                </span>
                            </div>
                        </div>
                        
                        <p className="text-slate-400 text-[10px] leading-relaxed font-mono mb-2">
                            {hoveredItem.item.description}
                        </p>

                        {hoveredItem.item.tags && (
                            <div className="flex flex-wrap gap-1 mb-2">
                                {hoveredItem.item.tags.map((tag: string) => (
                                    <span key={tag} className="text-[7px] font-bold uppercase px-1 py-0.5 bg-slate-800 text-slate-400 rounded">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {hoveredItem.item.passive && (
                            <div className="mt-2 pt-2 border-t border-slate-800">
                                <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest block mb-1">Passiva</span>
                                <p className="text-[9px] text-cyan-200/70 italic leading-snug">{hoveredItem.item.passive}</p>
                            </div>
                        )}

                        {hoveredItem.item.bonuses && hoveredItem.item.bonuses.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-800">
                                <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block mb-1">Bônus de Forja</span>
                                {hoveredItem.item.bonuses.map((b: string, i: number) => (
                                    <div key={i} className="flex items-center gap-1 text-[9px] text-amber-400/80 font-mono italic">
                                        <Sparkles size={8} /> {b}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </motion.div>
        )}
      </AnimatePresence>

      {/* Item Action Menu */}
      <AnimatePresence>
          {selectedItemMenu && (
              <>
                  <div className="fixed inset-0 z-[1500]" onClick={() => setSelectedItemMenu(null)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="fixed z-[1600] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 min-w-[140px] backdrop-blur-xl"
                    style={{ left: selectedItemMenu.pos.x, top: selectedItemMenu.pos.y }}
                  >
                      <button 
                        onClick={handleEquipFromMenu}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-500/10 hover:text-emerald-400 rounded-lg transition-all font-black italic text-[11px] uppercase tracking-wider"
                      >
                          <Zap size={14} className="text-emerald-500" /> Equipar
                      </button>
                      <button 
                        onClick={handleForgeFromMenu}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-500/10 hover:text-blue-400 rounded-lg transition-all font-black italic text-[11px] uppercase tracking-wider"
                      >
                          <Hammer size={14} className="text-blue-500" /> Forjar
                      </button>
                      <div className="h-px bg-slate-800 my-1 mx-2" />
                      <button 
                        onClick={() => setSelectedItemMenu(null)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800 text-slate-500 rounded-lg transition-all font-black italic text-[11px] uppercase tracking-wider"
                      >
                          <X size={14} /> Cancelar
                      </button>
                  </motion.div>
              </>
          )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
          {confirmDestruction && (
              <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-8 bg-slate-900 border border-red-500/30 rounded-2xl max-w-md w-full text-center"
                  >
                      <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
                      <h2 className="text-2xl font-black italic mb-2 tracking-tighter">DESTRUIR ORBE?</h2>
                      <p className="text-slate-400 text-sm mb-8">Deseja destruir este Orbe? Runas e Relíquias serão perdidas permanentemente. Você receberá 10 Fragmentos de volta.</p>
                      
                      <div className="flex gap-4">
                          <button 
                            onClick={() => setConfirmDestruction(null)}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-colors"
                          >
                              CANCELAR
                          </button>
                          <button 
                            onClick={() => handleDestroy(confirmDestruction)}
                            className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-colors"
                          >
                              DESTRUIR
                          </button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Hammer className="text-blue-500" size={32} />
          <h1 className="text-3xl font-black tracking-tighter italic">FORJA CELESTIAL</h1>
        </div>
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg group hover:border-blue-500/50 transition-all">
                <Diamond className="text-blue-400 group-hover:animate-pulse" size={18} />
                <span className="font-mono font-bold">{currency.primordialShards}</span>
            </div>
            <button 
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors font-bold text-sm tracking-widest"
            >
                <ArrowLeft size={18} /> VOLTAR
            </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-6 overflow-hidden" onMouseLeave={() => setHoveredItem(null)}>
        {/* Left: Inventory - Relics */}
        <section className="col-span-3 bg-slate-900/40 rounded-2xl p-6 flex flex-col border border-slate-800 shadow-inner overflow-hidden">
            <h2 className="text-[12px] font-black flex items-center gap-2 mb-4 text-emerald-500 italic uppercase tracking-[0.2em]">
              <Shield size={16} /> Relíquias ({inventory.relics.length})
            </h2>
            <div className="grid grid-cols-4 gap-4 overflow-y-auto pr-2 custom-scrollbar content-start">
              {allRelics.map((item: any) => {
                  const ownedCount = inventory.relics.filter((id: string) => id === item.id).length;
                  const isSelected = selectedRelic?.id === item.id;
                  return (
                      <div key={item.id} className="relative">
                          <motion.div 
                              onClick={(e) => ownedCount > 0 && onItemClick(e, item, 'relic')}
                              onMouseMove={(e) => handleMouseMove(e, item, 'relic')}
                              onMouseLeave={() => setHoveredItem(null)}
                              className={`aspect-square bg-slate-950 border-2 ${isSelected ? 'border-emerald-500 scale-105 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : ownedCount > 0 ? 'border-emerald-900/50 hover:border-emerald-500' : 'border-slate-800/20 opacity-20 grayscale'} rounded-xl flex items-center justify-center transition-all cursor-pointer relative group`}
                          >
                              <span className={ownedCount > 0 ? 'text-3xl' : 'text-2xl'}>{item.icon}</span>
                              {ownedCount > 1 && (
                                  <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-[10px] font-black px-2 py-0.5 rounded border border-slate-950">
                                      {ownedCount}
                                  </span>
                              )}
                          </motion.div>
                      </div>
                  );
              })}
            </div>
        </section>

        {/* Center: The Altar / Fusion & Chaos Orbs Inventory */}
        <section className="col-span-6 flex flex-col items-center py-6 relative bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_var(--tw-gradient-to)_100%)] from-slate-900 to-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-y-auto custom-scrollbar">
          <div className="w-full flex flex-col items-center gap-8 px-12">
              <div className="flex items-center justify-center gap-16 w-full mt-4">
                  <div className="flex flex-col items-center gap-3">
                      <div className={`w-32 h-32 rounded-2xl border-2 flex items-center justify-center transition-all duration-500 relative ${selectedRune ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_40px_rgba(59,130,246,0.3)]' : 'border-slate-800 border-dashed bg-black/20'}`}>
                          {selectedRune ? (
                              <>
                                <span className="text-6xl">{selectedRune.icon}</span>
                                <button onClick={() => setSelectedRune(null)} className="absolute -top-3 -right-3 p-2 bg-slate-800 rounded-full border border-slate-700 hover:text-red-400 shadow-xl"><X size={16}/></button>
                              </>
                          ) : <Zap className="text-slate-800" size={56} />}
                      </div>
                      <span className="text-[12px] font-black text-blue-500 uppercase tracking-[0.2em] italic">Essência Rúnica</span>
                  </div>

                  <div className="relative">
                      <div className="w-24 h-24 rounded-full border-2 border-slate-700 flex items-center justify-center bg-slate-950 shadow-inner">
                          <Sparkles className={`text-amber-500 ${isForging ? 'animate-spin' : 'animate-pulse'}`} size={40} />
                      </div>
                  </div>

                  <div className="flex flex-col items-center gap-3">
                      <div className={`w-32 h-32 rounded-2xl border-2 flex items-center justify-center transition-all duration-500 relative ${selectedRelic ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.3)]' : 'border-slate-800 border-dashed bg-black/20'}`}>
                          {selectedRelic ? (
                              <>
                                <span className="text-6xl">{selectedRelic.icon}</span>
                                <button onClick={() => setSelectedRelic(null)} className="absolute -top-3 -right-3 p-2 bg-slate-800 rounded-full border border-slate-700 hover:text-red-400 shadow-xl"><X size={16}/></button>
                              </>
                          ) : <Shield className="text-slate-800" size={56} />}
                      </div>
                      <span className="text-[12px] font-black text-emerald-500 uppercase tracking-[0.2em] italic">Vínculo Relíquia</span>
                  </div>
              </div>

              <div className="w-full flex flex-col items-center gap-6">
                  <button 
                    disabled={!selectedRune || !selectedRelic || isForging}
                    onClick={handleStartForge}
                    className={`relative group px-24 py-5 overflow-hidden rounded-full transition-all duration-500 border-2 ${!selectedRune || !selectedRelic ? 'opacity-30 grayscale cursor-not-allowed border-slate-800' : 'border-amber-500 hover:border-amber-400 active:scale-95 shadow-[0_0_40px_rgba(245,158,11,0.2)]'}`}
                  >
                    <div className="absolute inset-0 bg-amber-500/10 group-hover:bg-amber-500/20 transition-all" />
                    <span className="relative z-10 font-black uppercase italic tracking-[0.3em] text-base flex items-center gap-4">
                        {isForging ? (
                            <>MANIFESTANDO ORBE...</>
                        ) : (
                            <>FORJAR ORBE DO CAOS (10 <Diamond size={18} className="inline"/>)</>
                        )}
                    </span>
                  </button>
                  
                  {errorMessage && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 text-red-500 font-bold text-[13px] uppercase p-4 bg-red-500/10 rounded-2xl border border-red-500/20"
                      >
                          <AlertTriangle size={18} /> {errorMessage}
                      </motion.div>
                  )}
              </div>

              <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent my-4" />

              <div className="w-full grid grid-cols-2 gap-12">
                  <div className="flex flex-col items-center gap-6">
                      <h3 className="text-[12px] font-black text-purple-400 uppercase tracking-[0.4em] italic mb-2">Inventário de Orbes ({chaosOrbs.length}/4)</h3>
                      <div className="grid grid-cols-2 gap-5">
                        {chaosOrbs.map((item: any) => {
                            const isEquipped = equippedChaosOrbs.includes(item.id);
                            return (
                                <motion.div 
                                    key={item.id} 
                                    onMouseMove={(e) => handleMouseMove(e, item, 'chaos')}
                                    onMouseLeave={() => setHoveredItem(null)}
                                    className={`w-28 h-28 bg-slate-950 border-2 ${isEquipped ? 'border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.4)]' : 'border-slate-800 hover:border-purple-500'} rounded-[2rem] flex items-center justify-center transition-all cursor-pointer relative group`}
                                >
                                    <span className="text-5xl drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">{item.icon}</span>
                                    
                                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-5 transition-opacity rounded-[2rem] z-10">
                                        {!isEquipped && (
                                            <button 
                                                onClick={() => {
                                                    const emptySlot = equippedChaosOrbs.findIndex((s: any) => s === null);
                                                    if (emptySlot !== -1) equipChaosOrb(item.id, emptySlot);
                                                }}
                                                className="p-3 bg-blue-600 rounded-xl hover:bg-blue-500 shadow-2xl transition-transform active:scale-90"
                                                title="Equipar"
                                            >
                                                <Zap size={22} />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setConfirmDestruction(item.id)}
                                            className="p-3 bg-red-600 rounded-xl hover:bg-red-500 shadow-2xl transition-transform active:scale-90"
                                            title="Destruir"
                                        >
                                            <Trash2 size={22} />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                        {Array.from({ length: 4 - chaosOrbs.length }).map((_, i) => (
                            <div key={`empty-inv-${i}`} className="w-28 h-28 bg-black/20 border-2 border-slate-800 border-dashed rounded-[2rem] flex items-center justify-center opacity-30">
                                <Sparkles size={24} className="text-slate-800" />
                            </div>
                        ))}
                      </div>
                  </div>

                  <div className="flex flex-col items-center gap-6">
                      <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] italic mb-2">Matriz Equipada</h3>
                      
                      <div className="flex flex-col gap-8 w-full">
                          <div className="flex flex-col items-center gap-3">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Orbes do Caos</span>
                              <div className="flex gap-4">
                                  {equippedChaosOrbs.map((id, i) => {
                                      const orb = id ? chaosOrbs.find((o:any) => o.id === id) : null;
                                      return (
                                          <motion.div 
                                              key={i} 
                                              initial={id ? { scale: 1.2, filter: "brightness(2)" } : { scale: 1 }}
                                              animate={id ? { scale: 1.1, filter: "brightness(1)" } : { scale: 1 }}
                                              onClick={() => orb && unequipChaosOrb(i)}
                                              onMouseMove={(e) => orb && handleMouseMove(e, orb, 'chaos')}
                                              onMouseLeave={() => setHoveredItem(null)}
                                              className={`w-16 h-16 rounded-[1.25rem] border-2 flex items-center justify-center transition-all ${orb ? 'border-purple-500 bg-purple-500/10 cursor-pointer shadow-[0_0_25px_rgba(168,85,247,0.4)]' : 'border-slate-800/50 border-dashed bg-black/20'}`}
                                          >
                                              {orb ? <span className="text-4xl animate-pulse drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]">{orb.icon}</span> : <div className="w-2 h-2 rounded-full bg-slate-900 shadow-inner" />}
                                          </motion.div>
                                      );
                                  })}
                              </div>
                          </div>

                          <div className="flex justify-center gap-12">
                            <div className="flex flex-col items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Runas</span>
                                <div className="flex gap-4">
                                    {equippedRunes.map((id:string | null, i:number) => {
                                        const rune = id ? allRunes.find((r:any) => r.id === id) : null;
                                        return (
                                            <motion.div 
                                                key={i} 
                                                initial={id ? { scale: 1.2, filter: "brightness(2)" } : { scale: 1 }}
                                                animate={id ? { scale: 1.05, filter: "brightness(1)" } : { scale: 1 }}
                                                onClick={() => rune && unequipRune(i)}
                                                onMouseMove={(e) => rune && handleMouseMove(e, rune, 'rune')}
                                                onMouseLeave={() => setHoveredItem(null)}
                                                className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center transition-all ${rune ? 'border-blue-500 bg-blue-500/10 cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-slate-800/50 border-dashed bg-black/20'}`}
                                            >
                                                {rune ? <span className="text-3xl drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">{rune.icon}</span> : <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Relíquias</span>
                                <div className="flex gap-4">
                                    {equippedRelics.map((id:string | null, i:number) => {
                                        const relic = id ? allRelics.find((r:any) => r.id === id) : null;
                                        return (
                                            <motion.div 
                                                key={i} 
                                                initial={id ? { scale: 1.2, filter: "brightness(2)" } : { scale: 1 }}
                                                animate={id ? { scale: 1.05, filter: "brightness(1)" } : { scale: 1 }}
                                                onClick={() => relic && unequipRelic(i)}
                                                onMouseMove={(e) => relic && handleMouseMove(e, relic, 'relic')}
                                                onMouseLeave={() => setHoveredItem(null)}
                                                className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center transition-all ${relic ? 'border-emerald-500 bg-emerald-500/10 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-slate-800/50 border-dashed bg-black/20'}`}
                                            >
                                                {relic ? <span className="text-3xl drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]">{relic.icon}</span> : <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
        </section>

        {/* Right: Inventory - Runes */}
        <section className="col-span-3 bg-slate-900/40 rounded-2xl p-6 flex flex-col border border-slate-800 shadow-inner overflow-hidden">
            <h2 className="text-[12px] font-black flex items-center gap-2 mb-4 text-blue-500 italic uppercase tracking-[0.2em]">
              <Zap size={16} /> Runas ({inventory.runes.length})
            </h2>
            <div className="grid grid-cols-4 gap-4 overflow-y-auto pr-2 custom-scrollbar content-start">
              {allRunes.map((item: any) => {
                  const ownedCount = inventory.runes.filter((id: string) => id === item.id).length;
                  const isSelected = selectedRune?.id === item.id;
                  return (
                      <div key={item.id} className="relative">
                          <motion.div 
                              onClick={(e) => ownedCount > 0 && onItemClick(e, item, 'rune')}
                              onMouseMove={(e) => handleMouseMove(e, item, 'rune')}
                              onMouseLeave={() => setHoveredItem(null)}
                              className={`aspect-square bg-slate-950 border-2 ${isSelected ? 'border-blue-500 scale-105 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : ownedCount > 0 ? 'border-blue-900/50 hover:border-blue-500' : 'border-slate-800/20 opacity-20 grayscale'} rounded-xl flex items-center justify-center transition-all cursor-pointer relative group`}
                          >
                              <span className={ownedCount > 0 ? 'text-3xl' : 'text-2xl'}>{item.icon}</span>
                              {ownedCount > 1 && (
                                  <span className="absolute -bottom-1 -right-1 bg-blue-600 text-[10px] font-black px-2 py-0.5 rounded border border-slate-950">
                                      {ownedCount}
                                  </span>
                              )}
                          </motion.div>
                      </div>
                  );
              })}
            </div>
        </section>
      </main>
    </div>
  );
};
