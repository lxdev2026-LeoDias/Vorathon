import React from 'react';
import { motion } from 'motion/react';
import { Flame, Snowflake, Zap, ArrowRight } from 'lucide-react';
import { PowerUpClass } from '../core/Types';
import { setPowerUpClass } from '../core/Store';
import { GameState } from '../core/GameState';

interface PowerUpSelectionProps {
    onSelect: () => void;
}

export const PowerUpSelection: React.FC<PowerUpSelectionProps> = ({ onSelect }) => {
    const options = [
        {
            id: PowerUpClass.FIRE,
            name: 'Dano de Fogo',
            icon: <Flame size={32} />,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            border: 'border-orange-500/30',
            hover: 'hover:border-orange-500',
            description: 'Ataques que incineram os inimigos com calor intenso.'
        },
        {
            id: PowerUpClass.ICE,
            name: 'Dano de Gelo',
            icon: <Snowflake size={32} />,
            color: 'text-blue-400',
            bg: 'bg-blue-400/10',
            border: 'border-blue-400/30',
            hover: 'hover:border-blue-400',
            description: 'Ataques criogênicos que cristalizam a matéria.'
        },
        {
            id: PowerUpClass.ELECTRIC,
            name: 'Dano Elétrico',
            icon: <Zap size={32} />,
            color: 'text-yellow-400',
            bg: 'bg-yellow-400/10',
            border: 'border-yellow-400/30',
            hover: 'hover:border-yellow-400',
            description: 'Ataques energéticos de alta voltagem e velocidade.'
        }
    ];

    const handleSelect = (puClass: PowerUpClass) => {
        setPowerUpClass(puClass);
        onSelect();
    };

    return (
        <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center p-10 text-white font-sans overflow-hidden bg-[radial-gradient(circle_at_50%_50%,rgba(30,41,59,1)_0%,rgba(2,6,23,1)_100%)]">
            <motion.div 
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center mb-16"
            >
                <h2 className="text-5xl font-black italic tracking-tighter mb-4">ESCOLHA SUA ESSÊNCIA</h2>
                <div className="h-1 w-24 bg-blue-600 mx-auto rounded-full mb-6" />
                <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.3em]">Selecione uma especialização elemental para esta run</p>
            </motion.div>

            <div className="grid grid-cols-3 gap-8 w-full max-w-6xl">
                {options.map((opt, idx) => (
                    <motion.button
                        key={opt.id}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        whileHover={{ y: -10, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelect(opt.id)}
                        className={`flex flex-col items-center text-center p-10 rounded-3xl border ${opt.border} ${opt.bg} ${opt.hover} transition-all group`}
                    >
                        <div className={`p-6 rounded-2xl bg-black/40 mb-8 ${opt.color} group-hover:scale-110 transition-transform shadow-[0_0_30px_rgba(0,0,0,0.5)]`}>
                            {opt.icon}
                        </div>
                        <h3 className={`text-2xl font-black mb-4 ${opt.color}`}>{opt.name}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed mb-8 flex-1">{opt.description}</p>
                        
                        <div className="flex items-center gap-2 text-[10px] font-mono text-white/50 group-hover:text-white transition-colors uppercase tracking-widest">
                            Selecionar <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                    </motion.button>
                ))}
            </div>

            <div className="mt-20 flex gap-12 text-slate-500 font-mono text-[10px] uppercase tracking-widest opacity-30">
                <span>// IDENTIDADE ELEMENTAL</span>
                <span>// PROTOCOLO DE RUN</span>
                <span>// VORATHON CORE</span>
            </div>
        </div>
    );
};
