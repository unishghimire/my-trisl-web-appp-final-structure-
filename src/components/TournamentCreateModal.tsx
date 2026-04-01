import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Modal from './Modal';
import { useInvisibleImage } from '../hooks/useInvisibleImage';
import { DEFAULT_BANNER, NEXPLAY_LOGO, PRESET_TOURNAMENT_BANNERS } from '../constants';
import { 
  Trophy, 
  Gamepad2, 
  Users, 
  Calendar, 
  DollarSign, 
  FileText, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle2,
  Info,
  Link,
  Trash2,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TournamentCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const STEPS = [
  { id: 1, title: 'Basic Info', icon: Gamepad2, description: 'Tournament identity' },
  { id: 2, title: 'Format', icon: Users, description: 'Match structure' },
  { id: 3, title: 'Economy', icon: DollarSign, description: 'Prizes & Entry' },
  { id: 4, title: 'Rules', icon: FileText, description: 'Terms & Conditions' },
  { id: 5, title: 'Review', icon: CheckCircle2, description: 'Final check' },
];

const TournamentCreateModal: React.FC<TournamentCreateModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<any[]>([]);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const { handlePaste, handleDrop, handleDragOver } = useInvisibleImage({
    onUploadStart: () => setIsUploadingBanner(true),
    onUploadEnd: () => setIsUploadingBanner(false),
    onUploadSuccess: (url) => setFormData(prev => ({ ...prev, bannerUrl: url })),
    onError: (err) => showToast(err, 'error')
  });

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    game: '',
    bannerUrl: '',
    type: 'Battle Royale',
    map: '',
    teamType: 'solo' as 'solo' | 'duo' | 'squad',
    teamSize: 1,
    slots: 100,
    prizePool: 0,
    entryFee: 0,
    startTime: '',
    rules: '',
    prizeDistribution: [
      { rank: 1, amount: 0 },
    ]
  });

  const [selectedGame, setSelectedGame] = useState<any>(null);

  useEffect(() => {
    const fetchGames = async () => {
      const snap = await getDocs(collection(db, 'games'));
      setGames(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchGames();
  }, []);

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        return formData.title.trim() !== '' && formData.game !== '';
      case 2:
        return formData.type !== '' && formData.slots > 0 && formData.startTime !== '';
      case 3:
        const totalPrize = formData.prizeDistribution.reduce((acc, p) => acc + p.amount, 0);
        return formData.prizePool >= 0 && formData.entryFee >= 0 && totalPrize <= formData.prizePool && formData.prizeDistribution.every(p => p.amount >= 0);
      case 4:
        return formData.rules.trim() !== '';
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
    } else {
      showToast('Please fill all required fields correctly', 'error');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleAddRank = () => {
    const nextRank = formData.prizeDistribution.length + 1;
    setFormData({
      ...formData,
      prizeDistribution: [...formData.prizeDistribution, { rank: nextRank, amount: 0 }]
    });
  };

  const handleRemoveRank = (idx: number) => {
    const newDist = formData.prizeDistribution.filter((_, i) => i !== idx)
      .map((p, i) => ({ ...p, rank: i + 1 }));
    setFormData({ ...formData, prizeDistribution: newDist });
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!validateStep()) {
      showToast('Please complete all steps correctly', 'error');
      return;
    }
    setLoading(true);
    try {
      const tournamentData = {
        ...formData,
        hostUid: user.uid,
        currentPlayers: 0,
        status: 'upcoming',
        createdAt: serverTimestamp(),
        startTime: Timestamp.fromDate(new Date(formData.startTime)),
        isFeatured: false,
      };

      await addDoc(collection(db, 'tournaments'), tournamentData);
      showToast('Tournament created successfully!', 'success');
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        title: '',
        game: '',
        bannerUrl: '',
        type: 'Battle Royale',
        map: '',
        teamType: 'solo',
        teamSize: 1,
        slots: 100,
        prizePool: 0,
        entryFee: 0,
        startTime: '',
        rules: '',
        prizeDistribution: [
          { rank: 1, amount: 0 },
        ]
      });
      setCurrentStep(1);
    } catch (error) {
      console.error("Error creating tournament:", error);
      showToast('Failed to create tournament', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tournament Title</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g. Pro League Season 1"
                className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Game</label>
              <select 
                value={formData.game}
                onChange={(e) => {
                  const gameName = e.target.value;
                  const game = games.find(g => g.name === gameName);
                  setSelectedGame(game);
                  setFormData({...formData, game: gameName, type: game?.modes?.[0] || 'Battle Royale'});
                }}
                className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition"
              >
                <option value="">Select a game</option>
                {games.map(g => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase mb-2 tracking-widest">Banner Image (Paste or Drop Image)</label>
              <div className="bg-dark/50 p-4 rounded-2xl border border-gray-800/50 space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-start">
                  <div className="w-full md:w-1/2">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Upload via Paste/Drop</p>
                    <div 
                      onPaste={handlePaste}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      className={`relative w-full aspect-[3/1] rounded-xl border-2 border-dashed transition-all flex items-center justify-center overflow-hidden group cursor-pointer ${isUploadingBanner ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-brand-500 bg-dark'}`}
                    >
                      {isUploadingBanner ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-[10px] text-brand-400 font-bold uppercase">Uploading...</span>
                        </div>
                      ) : (
                        <>
                          <img 
                            src={formData.bannerUrl || DEFAULT_BANNER} 
                            alt="Banner Preview" 
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                            onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                            <Plus className="w-8 h-8 text-white" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="w-full md:w-1/2">
                    <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Or Use URL</p>
                    <div className="relative">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input 
                        type="text" 
                        value={formData.bannerUrl}
                        onChange={(e) => setFormData({...formData, bannerUrl: e.target.value})}
                        placeholder="https://example.com/banner.jpg"
                        className="w-full bg-dark border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-brand-500 outline-none transition"
                      />
                    </div>
                    <p className="text-[9px] text-gray-600 mt-2 italic">Recommended size: 1200x400px. You can skip this to use a default banner.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Or Choose a Preset</p>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_TOURNAMENT_BANNERS.map((url, idx) => (
                      <button
                        key={idx}
                        onClick={() => setFormData({...formData, bannerUrl: url})}
                        className={`relative aspect-[3/1] rounded overflow-hidden border-2 transition-all ${formData.bannerUrl === url ? 'border-brand-500' : 'border-transparent hover:border-gray-600'}`}
                      >
                        <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Team Type</label>
                <select 
                  value={formData.teamType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setFormData({...formData, teamType: val, teamSize: val === 'solo' ? 1 : val === 'duo' ? 2 : 4});
                  }}
                  className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition"
                >
                  <option value="solo">Solo</option>
                  <option value="duo">Duo</option>
                  <option value="squad">Squad</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Game Mode</label>
                {selectedGame?.modes?.length > 0 ? (
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition"
                  >
                    {selectedGame.modes.map((m: string) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    placeholder="e.g. Battle Royale"
                    className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Map (Optional)</label>
                <input 
                  type="text" 
                  value={formData.map}
                  onChange={(e) => setFormData({...formData, map: e.target.value})}
                  placeholder="e.g. Erangel"
                  className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Slots</label>
                <input 
                  type="number" 
                  value={isNaN(formData.slots) ? '' : formData.slots}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setFormData({...formData, slots: isNaN(val) ? 0 : val});
                  }}
                  className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Date & Time</label>
              <input 
                type="datetime-local" 
                value={formData.startTime}
                onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition"
              />
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Prize Pool</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="number" 
                    value={isNaN(formData.prizePool) ? '' : formData.prizePool}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setFormData({...formData, prizePool: isNaN(val) ? 0 : val});
                    }}
                    className="w-full bg-dark border border-gray-800 rounded-lg p-3 pl-10 text-white focus:border-brand-500 outline-none transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Entry Fee</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="number" 
                    value={isNaN(formData.entryFee) ? '' : formData.entryFee}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setFormData({...formData, entryFee: isNaN(val) ? 0 : val});
                    }}
                    className="w-full bg-dark border border-gray-800 rounded-lg p-3 pl-10 text-white focus:border-brand-500 outline-none transition"
                  />
                </div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-500 uppercase">Prize Distribution</label>
                <button 
                  onClick={handleAddRank}
                  className="text-[10px] bg-brand-500/10 text-brand-500 px-2 py-1 rounded-md font-bold hover:bg-brand-500/20 transition"
                >
                  + Add Rank
                </button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {formData.prizeDistribution.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-surface p-3 rounded-lg border border-gray-800 group">
                    <span className="text-sm font-bold text-brand-500 w-12 shrink-0">Rank {p.rank}</span>
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                      <input 
                        type="number" 
                        value={isNaN(p.amount) ? '' : p.amount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          const newDist = [...formData.prizeDistribution];
                          newDist[idx].amount = isNaN(val) ? 0 : val;
                          setFormData({...formData, prizeDistribution: newDist});
                        }}
                        placeholder="Amount"
                        className="w-full bg-dark border border-gray-700 rounded p-2 pl-7 text-sm text-white outline-none focus:border-brand-500"
                      />
                    </div>
                    {formData.prizeDistribution.length > 1 && (
                      <button 
                        onClick={() => handleRemoveRank(idx)}
                        className="p-2 text-gray-500 hover:text-red-500 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-dark rounded-lg border border-gray-800 flex justify-between items-center">
                <span className="text-xs text-gray-500 font-bold uppercase">Total Allocated:</span>
                <span className={`text-sm font-black ${
                  formData.prizeDistribution.reduce((acc, p) => acc + p.amount, 0) > formData.prizePool 
                  ? 'text-red-500' 
                  : 'text-green-500'
                }`}>
                  ₹{formData.prizeDistribution.reduce((acc, p) => acc + p.amount, 0).toLocaleString()} / ₹{formData.prizePool.toLocaleString()}
                </span>
              </div>
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rules & Regulations</label>
              <textarea 
                value={formData.rules}
                onChange={(e) => setFormData({...formData, rules: e.target.value})}
                rows={6}
                placeholder="Enter tournament rules..."
                className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 outline-none transition resize-none"
              />
            </div>
            <div className="bg-brand-500/10 border border-brand-500/20 p-4 rounded-lg flex gap-3">
              <Info className="w-5 h-5 text-brand-500 shrink-0" />
              <p className="text-xs text-gray-300 leading-relaxed">
                By creating this tournament, you agree to manage it fairly and distribute prizes as promised. 
                Players will be notified once the tournament is published.
              </p>
            </div>
          </motion.div>
        );
      case 5:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="space-y-6"
          >
            <div className="bg-surface p-6 rounded-2xl border border-gray-800">
              <h4 className="text-lg font-black text-white mb-4 uppercase tracking-tight">Tournament Summary</h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Title</p>
                    <p className="text-sm text-white font-black">{formData.title}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Game & Mode</p>
                    <p className="text-sm text-white font-black">{formData.game} • {formData.type}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Schedule</p>
                    <p className="text-sm text-white font-black">{new Date(formData.startTime).toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Prize Pool</p>
                    <p className="text-sm text-brand-400 font-black">₹{formData.prizePool.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Entry Fee</p>
                    <p className="text-sm text-white font-black">{formData.entryFee === 0 ? 'FREE' : `₹${formData.entryFee}`}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Slots</p>
                    <p className="text-sm text-white font-black">{formData.slots} Players ({formData.teamType})</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-brand-500/5 border border-brand-500/20 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-brand-500" />
              <p className="text-xs text-gray-400">Everything looks good! Click launch to publish your tournament.</p>
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Create New Tournament"
      maxWidth="max-w-2xl"
    >
      <div className="mb-8">
        <div className="flex justify-between relative">
          {/* Progress Line */}
          <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-800 -z-10" />
          <div 
            className="absolute top-5 left-0 h-0.5 bg-brand-500 transition-all duration-300 -z-10" 
            style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />

          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep >= step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div key={step.id} className="flex flex-col items-center group">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500
                  ${isActive ? 'bg-brand-600 text-white shadow-[0_0_20px_rgba(var(--brand-primary-rgb),0.5)]' : 'bg-gray-800 text-gray-500'}
                  ${isCurrent ? 'ring-4 ring-brand-500/20 scale-110' : ''}
                `}>
                  {isActive && currentStep > step.id ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
                </div>
                <div className="hidden md:flex flex-col items-center mt-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-gray-500'}`}>
                    {step.title}
                  </span>
                  <span className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {step.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-[350px]">
        {renderStep()}
      </div>

      <div className="flex justify-between mt-8 pt-6 border-t border-gray-800">
        <button
          onClick={handleBack}
          disabled={currentStep === 1 || loading}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition ${
            currentStep === 1 ? 'opacity-0 pointer-events-none' : 'text-gray-400 hover:text-white'
          }`}
        >
          <ChevronLeft className="w-5 h-5" /> Back
        </button>

        {currentStep === STEPS.length ? (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-green-600 hover:bg-green-500 text-white px-8 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Launch Tournament'} <Trophy className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 transition"
          >
            Next Step <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </Modal>
  );
};

export default TournamentCreateModal;
