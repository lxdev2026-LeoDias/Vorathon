import React from 'react';
import { motion } from 'motion/react';
import { Trophy, Target, ShieldAlert, Rocket, ArrowRight } from 'lucide-react';
import { usePlayerState } from '../core/Store';

interface StageResultsProps {
    onContinue: () => void;
}

export const StageResults: React.FC<StageResultsProps> = ({ onContinue }) => {
    const playerState = usePlayerState();
    const { session } = playerState;
    const { phaseStats, phase, score } = session;

    return (
        <div className="w-full h-full bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-10 text-white font-sans overflow-hidden">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-2xl w-full bg-slate-900 border border-blue-500/30 rounded-3xl p-10 shadow-[0_0_50px_rgba(59,130,246,0.15)]"
            >
                <div className="text-center mb-10">
                    <motion.div
                        initial={{ y: -20 }}
                        animate={{ y: 0 }}
                        className="inline-block p-4 bg-blue-600/20 rounded-2xl mb-4"
                    >
                        <Trophy size={48} className="text-blue-500" />
                    </motion.div>
                    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">FASE {phase} CONCLUÍDA</h2>
                    <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Relatório de Operação Estelar</p>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-10">
                    <StatCard 
                        label="PONTOS DA FASE" 
                        value={phaseStats.score.toLocaleString()} 
                        icon={<Rocket className="text-blue-400" size={20} />}
                    />
                    <StatCard 
                        label="TOTAL ACUMULADO" 
                        value={score.toLocaleString()} 
                        icon={<Trophy className="text-yellow-400" size={20} />}
                        highlight
                    />
                    <StatCard 
                        label="INIMIGOS DERROTADOS" 
                        value={phaseStats.kills.toString()} 
                        icon={<Target className="text-red-400" size={20} />}
                    />
                    <StatCard 
                        label="ELITES ELIMINADOS" 
                        value={phaseStats.elitesKilled.toString()} 
                        icon={<ShieldAlert className="text-orange-400" size={20} />}
                    />
                </div>

                <div className="flex flex-col gap-4">
                    <button
                        onClick={onContinue}
                        className="w-full py-5 bg-blue-600 hover:bg-blue-500 transition-all rounded-xl font-bold text-xl flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(59,130,246,0.3)] group"
                    >
                        PRÓXIMA FASE <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                    </button>
                    
                    <p className="text-center text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em]">
                        Todos os sistemas meta-permanentes foram sincronizados
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; highlight?: boolean }> = ({ label, value, icon, highlight }) => (
    <div className={`p-6 rounded-2xl border ${highlight ? 'bg-blue-500/10 border-blue-500/40' : 'bg-slate-950 border-slate-800'} flex flex-col gap-2`}>
        <div className="flex items-center gap-2 text-slate-500 uppercase font-mono text-[10px] tracking-widest">
            {icon}
            {label}
        </div>
        <div className={`text-2xl font-black italic ${highlight ? 'text-blue-400' : 'text-white'}`}>
            {value}
        </div>
    </div>
);
