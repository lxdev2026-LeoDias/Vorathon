import React, { useState } from 'react';
import { ArrowLeft, Save, Download, Upload, CheckCircle2, AlertCircle, FileText, X } from 'lucide-react';
import { getPlayerState, updatePlayerState } from '../core/Store';
import { motion } from 'motion/react';

// Encryption/Decryption helpers (Simple base64 + some XOR for "obfuscated" encryption as requested)
const ENCRYPTION_KEY = 'NEBULA_FORGE_PROTECTION';

const encrypt = (data: string): string => {
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
  }
  return btoa(result);
};

const decrypt = (encoded: string): string => {
  const data = atob(encoded);
  let result = '';
  for (let i = 0; i < data.length; i++) {
    result += String.fromCharCode(data.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
  }
  return result;
};

interface OptionsScreenProps {
  onBack: () => void;
}

export const OptionsScreen: React.FC<OptionsScreenProps> = ({ onBack }) => {
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportStatus, setShowImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const [exportConfig, setExportConfig] = useState({
    runes: true,
    relics: true,
    level: true,
    gold: true,
    shards: true,
    chaosOrbs: true,
    ranking: true
  });

  const handleExport = () => {
    const state = getPlayerState();
    const dataToSave: any = {
      version: '1.0',
      timestamp: Date.now()
    };

    if (exportConfig.runes) {
      dataToSave.runes = state.inventory.runes;
      dataToSave.equippedRunes = state.equippedRunes;
    }
    if (exportConfig.relics) {
      dataToSave.relics = state.inventory.relics;
      dataToSave.equippedRelics = state.equippedRelics;
    }
    if (exportConfig.level) {
      dataToSave.progression = state.progression;
    }
    if (exportConfig.gold) {
      dataToSave.gold = state.currency.gold;
    }
    if (exportConfig.shards) {
      dataToSave.shards = state.currency.primordialShards;
    }
    if (exportConfig.chaosOrbs) {
      dataToSave.chaosOrbs = state.inventory.chaosOrbs;
      dataToSave.equippedChaosOrbs = state.equippedChaosOrbs;
    }
    if (exportConfig.ranking) {
      dataToSave.sessionStats = state.session;
    }

    const encryptedData = encrypt(JSON.stringify(dataToSave));
    const blob = new Blob([encryptedData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nebula_forge_save_${new Date().toISOString().split('T')[0]}.sav`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const encryptedData = event.target?.result as string;
        const decryptedData = JSON.parse(decrypt(encryptedData));
        
        updatePlayerState(prev => {
          const newState = { ...prev };
          
          if (decryptedData.runes) {
            newState.inventory.runes = decryptedData.runes;
            newState.equippedRunes = decryptedData.equippedRunes;
          }
          if (decryptedData.relics) {
            newState.inventory.relics = decryptedData.relics;
            newState.equippedRelics = decryptedData.equippedRelics;
          }
          if (decryptedData.progression) {
            newState.progression = decryptedData.progression;
          }
          if (decryptedData.gold !== undefined) {
            newState.currency.gold = decryptedData.gold;
          }
          if (decryptedData.shards !== undefined) {
            newState.currency.primordialShards = decryptedData.shards;
          }
          if (decryptedData.chaosOrbs) {
            newState.inventory.chaosOrbs = decryptedData.chaosOrbs;
            newState.equippedChaosOrbs = decryptedData.equippedChaosOrbs;
          }
          if (decryptedData.sessionStats) {
            newState.session = decryptedData.sessionStats;
          }
          
          return newState;
        });

        setShowImportStatus({ type: 'success', message: 'Dados importados com sucesso!' });
      } catch (err) {
        console.error('Import error:', err);
        setShowImportStatus({ type: 'error', message: 'Falha na importação: Arquivo inválido ou corrompido.' });
      }
      
      e.target.value = '';
      setTimeout(() => setShowImportStatus(null), 3000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="max-w-2xl mx-auto w-full relative z-10">
        <header className="flex items-center gap-4 mb-12">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-all active:scale-95 group">
            <ArrowLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-5xl font-black italic tracking-tight">OPÇÕES</h1>
            <div className="h-1 w-12 bg-blue-500 mt-1" />
          </div>
        </header>

        <div className="space-y-10">
          <OptionGroup label="DADOS & PROGRESSO">
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setShowExportModal(true)}
                className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-black italic py-4 px-6 rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98] group"
              >
                <Download size={20} className="group-hover:translate-y-0.5 transition-transform" />
                EXPORTAR DADOS
              </button>
              
              <label className="flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-white font-black italic py-4 px-6 rounded-xl transition-all cursor-pointer shadow-lg active:scale-[0.98] group">
                <Upload size={20} className="group-hover:-translate-y-0.5 transition-transform" />
                IMPORTAR DADOS
                <input type="file" className="hidden" accept=".sav" onChange={handleImport} />
              </label>
            </div>
            {showImportStatus && (
              <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
                showImportStatus.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {showImportStatus.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                <span className="font-bold">{showImportStatus.message}</span>
              </div>
            )}
          </OptionGroup>

          <OptionGroup label="ÁUDIO">
            <OptionRange label="Volume Geral" defaultValue={80} />
            <OptionRange label="Música" defaultValue={60} />
            <OptionRange label="Efeitos" defaultValue={100} />
          </OptionGroup>

          <OptionGroup label="GRÁFICOS">
            <OptionToggle label="Tela Cheia" active />
            <OptionToggle label="VSync" active />
            <OptionToggle label="Partículas" active />
          </OptionGroup>
        </div>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowExportModal(false)} />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-8 relative z-10 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Save size={24} className="text-blue-400" />
                </div>
                <h2 className="text-2xl font-black italic">CONFIGURAR EXPORTAÇÃO</h2>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="p-2 hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4 mb-10">
              <ExportOption 
                label="Runas" 
                active={exportConfig.runes} 
                onChange={(val) => setExportConfig(p => ({ ...p, runes: val }))} 
              />
              <ExportOption 
                label="Relíquias" 
                active={exportConfig.relics} 
                onChange={(val) => setExportConfig(p => ({ ...p, relics: val }))} 
              />
              <ExportOption 
                label="Level Atual" 
                active={exportConfig.level} 
                onChange={(val) => setExportConfig(p => ({ ...p, level: val }))} 
              />
              <ExportOption 
                label="Moedas (Gold)" 
                active={exportConfig.gold} 
                onChange={(val) => setExportConfig(p => ({ ...p, gold: val }))} 
              />
              <ExportOption 
                label="Fragmentos Primordiais" 
                active={exportConfig.shards} 
                onChange={(val) => setExportConfig(p => ({ ...p, shards: val }))} 
              />
              <ExportOption 
                label="Orbes do Caos" 
                active={exportConfig.chaosOrbs} 
                onChange={(val) => setExportConfig(p => ({ ...p, chaosOrbs: val }))} 
              />
              <ExportOption 
                label="Rankings / Recordes" 
                active={exportConfig.ranking} 
                onChange={(val) => setExportConfig(p => ({ ...p, ranking: val }))} 
              />
            </div>

            <button 
              onClick={handleExport}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black italic py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <FileText size={20} />
              GERAR ARQUIVO DE SALVAMENTO
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const OptionGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-4">
    <h3 className="text-slate-500 font-mono text-sm tracking-widest">{label}</h3>
    <div className="bg-slate-900 rounded-2xl p-8 flex flex-col gap-6 border border-slate-800 shadow-xl">
      {children}
    </div>
  </div>
);

const OptionRange: React.FC<{ label: string; defaultValue: number }> = ({ label, defaultValue }) => (
  <div className="flex items-center justify-between group">
    <span className="font-bold text-slate-300 group-hover:text-white transition-colors">{label}</span>
    <input 
      type="range" 
      className="w-48 accent-blue-500 h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer" 
      defaultValue={defaultValue} 
    />
  </div>
);

const OptionToggle: React.FC<{ label: string; active?: boolean }> = ({ label, active }) => (
  <div className="flex items-center justify-between group">
    <span className="font-bold text-slate-300 group-hover:text-white transition-colors">{label}</span>
    <button className={`w-12 h-6 rounded-full relative transition-all ${active ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]' : 'bg-slate-700'}`}>
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-md ${active ? 'right-1' : 'left-1'}`} />
    </button>
  </div>
);

const ExportOption: React.FC<{ label: string; active: boolean; onChange: (val: boolean) => void }> = ({ label, active, onChange }) => (
  <button 
    onClick={() => onChange(!active)}
    className={`flex items-center justify-between w-full p-4 rounded-xl border transition-all ${
      active ? 'bg-blue-500/20 border-blue-500/40 text-white' : 'bg-slate-800/40 border-slate-800 text-slate-500 hover:border-slate-700'
    }`}
  >
    <span className="font-bold text-sm tracking-wide">{label}</span>
    <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
      active ? 'bg-blue-500 text-white' : 'bg-slate-700'
    }`}>
      {active && <CheckCircle2 size={14} strokeWidth={4} />}
    </div>
  </button>
);
