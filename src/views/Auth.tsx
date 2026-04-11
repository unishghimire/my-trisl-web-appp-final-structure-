import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';

const Auth: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    inGameId: '',
    inGameName: '',
    phone: '',
    termsAccepted: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const getPasswordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const strengthColor = [
    'bg-[#ef4444]', // 1: red
    'bg-[#f97316]', // 2: orange
    'bg-[#eab308]', // 3: yellow
    'bg-[#22c55e]'  // 4: green
  ][passwordStrength - 1] || 'bg-[#ffffff0f]';
  const strengthWidth = `${(passwordStrength / 4) * 100}%`;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (activeTab === 'register') {
      if (!formData.username) newErrors.username = 'Username is required';
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
      if (!formData.termsAccepted) newErrors.termsAccepted = 'You must accept the terms';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (activeTab === 'login') {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        navigate('/dashboard');
      } else {
        await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        navigate('/complete-profile');
      }
    } catch (error: any) {
      setErrors({ form: error.message });
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      navigate('/dashboard');
    } catch (error: any) {
      setErrors({ form: error.message });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080b14] p-4">
      {/* Radial Glow */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <div className="w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative w-full max-w-[420px] bg-[#0f1420] rounded-[20px] border border-[#ffffff0f] overflow-hidden">
        {/* Top Gradient Border */}
        <div className="h-[3px] w-full bg-gradient-to-r from-[#7c3aed] via-[#4f46e5] to-[#7c3aed]"></div>

        <div className="p-8">
          {/* Logo Row */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-[#7c3aed] rounded-[10px] flex items-center justify-center font-bold text-white">N</div>
            <span className="text-[18px] font-medium text-white">NEX<span className="text-[#7c3aed]">PLAY</span></span>
          </div>

          {/* Security Badge */}
          <div className="inline-flex items-center gap-1.5 bg-[#1e1540] border border-[#7c3aed33] rounded-[20px] px-3 py-1 mb-6">
            <div className="w-1.5 h-1.5 bg-[#a78bfa] rounded-full"></div>
            <span className="text-[11px] text-[#a78bfa]">{activeTab === 'login' ? 'Secure login' : 'Free to join'}</span>
          </div>

          {/* Tab Switcher */}
          <div className="bg-[#080b14] p-1 rounded-[10px] flex mb-8">
            <button 
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-[8px] transition ${activeTab === 'login' ? 'bg-[#7c3aed] text-white' : 'text-[#ffffff44]'}`}
            >
              Sign in
            </button>
            <button 
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-2 text-sm font-medium rounded-[8px] transition ${activeTab === 'register' ? 'bg-[#7c3aed] text-white' : 'text-[#ffffff44]'}`}
            >
              Create account
            </button>
          </div>

          {errors.form && <p className="text-[11px] text-[#f87171] mb-4 text-center">{errors.form}</p>}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {activeTab === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.8px] text-[#ffffff55] mb-2">Username</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ffffff33]" />
                      <input name="username" value={formData.username} onChange={handleInputChange} type="text" className="w-full bg-[#080b14] border border-[#ffffff10] rounded-[10px] py-3 pl-10 pr-4 text-white text-sm focus:border-[#7c3aed55] outline-none" placeholder="Username" />
                    </div>
                    {errors.username && <p className="text-[11px] text-[#f87171] mt-1">{errors.username}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.8px] text-[#ffffff55] mb-2">In-game ID</label>
                    <input name="inGameId" value={formData.inGameId} onChange={handleInputChange} type="text" className="w-full bg-[#080b14] border border-[#ffffff10] rounded-[10px] py-3 px-4 text-white text-sm focus:border-[#7c3aed55] outline-none" placeholder="ID" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.8px] text-[#ffffff55] mb-2">In-game Name</label>
                    <input name="inGameName" value={formData.inGameName} onChange={handleInputChange} type="text" className="w-full bg-[#080b14] border border-[#ffffff10] rounded-[10px] py-3 px-4 text-white text-sm focus:border-[#7c3aed55] outline-none" placeholder="Name" />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-[0.8px] text-[#ffffff55] mb-2">Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ffffff33]" />
                      <input name="phone" value={formData.phone} onChange={handleInputChange} type="tel" className="w-full bg-[#080b14] border border-[#ffffff10] rounded-[10px] py-3 pl-10 pr-4 text-white text-sm focus:border-[#7c3aed55] outline-none" placeholder="+977" />
                    </div>
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block text-[11px] uppercase tracking-[0.8px] text-[#ffffff55] mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ffffff33]" />
                <input name="email" value={formData.email} onChange={handleInputChange} type="email" className="w-full bg-[#080b14] border border-[#ffffff10] rounded-[10px] py-3 pl-10 pr-4 text-white text-sm focus:border-[#7c3aed55] outline-none" placeholder="name@example.com" />
              </div>
              {errors.email && <p className="text-[11px] text-[#f87171] mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.8px] text-[#ffffff55] mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ffffff33]" />
                <input name="password" value={formData.password} onChange={handleInputChange} type={showPassword ? 'text' : 'password'} className="w-full bg-[#080b14] border border-[#ffffff10] rounded-[10px] py-3 pl-10 pr-10 text-white text-sm focus:border-[#7c3aed55] outline-none" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#ffffff33]">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-[#f87171] mt-1">{errors.password}</p>}
              {activeTab === 'register' && (
                <div className="h-[3px] w-full bg-[#ffffff0f] mt-2 rounded-full overflow-hidden">
                    <div className={`h-full ${strengthColor}`} style={{ width: strengthWidth }}></div>
                </div>
              )}
            </div>
            {activeTab === 'register' && (
              <div>
                <label className="block text-[11px] uppercase tracking-[0.8px] text-[#ffffff55] mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ffffff33]" />
                  <input name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} type={showPassword ? 'text' : 'password'} className="w-full bg-[#080b14] border border-[#ffffff10] rounded-[10px] py-3 pl-10 pr-10 text-white text-sm focus:border-[#7c3aed55] outline-none" placeholder="••••••••" />
                </div>
                {errors.confirmPassword && <p className="text-[11px] text-[#f87171] mt-1">{errors.confirmPassword}</p>}
              </div>
            )}
            {activeTab === 'register' && (
                <label className="flex items-center gap-2 cursor-pointer">
                    <input name="termsAccepted" checked={formData.termsAccepted} onChange={handleInputChange} type="checkbox" className="peer sr-only" />
                    <div className="w-4 h-4 border border-[#ffffff22] rounded-[4px] flex items-center justify-center peer-checked:bg-[#7c3aed] peer-checked:border-[#7c3aed]">
                        <Check className="w-3 h-3 text-white hidden peer-checked:block" />
                    </div>
                    <span className="text-[12px] text-[#ffffff44]">I accept the <a href="#" className="text-[#a78bfa]">Terms & Conditions</a> and <a href="#" className="text-[#a78bfa]">Privacy Policy</a></span>
                </label>
            )}
            {errors.termsAccepted && <p className="text-[11px] text-[#f87171] mt-1">{errors.termsAccepted}</p>}

            <button type="submit" className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-[11px] py-3.5 font-medium text-sm flex items-center justify-center gap-2 transition active:scale-[0.98]">
              {activeTab === 'login' ? 'Sign in' : 'Create account'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-[1px] bg-[#ffffff0f]"></div>
            <span className="text-[11px] uppercase text-[#ffffff22]">or continue with</span>
            <div className="flex-1 h-[1px] bg-[#ffffff0f]"></div>
          </div>

          {/* Google Button */}
          <button onClick={handleGoogleSignIn} className="w-full bg-[#0f1420] border border-[#ffffff12] rounded-[11px] py-3.5 flex items-center justify-center gap-3 text-[#ffffffcc] hover:border-[#ffffff22] hover:bg-[#161b2e] transition">
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google
          </button>

          {/* Switch Row */}
          <p className="text-center text-[13px] text-[#ffffff33] mt-6">
            {activeTab === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => setActiveTab(activeTab === 'login' ? 'register' : 'login')} className="text-[#a78bfa] font-medium">
              {activeTab === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
