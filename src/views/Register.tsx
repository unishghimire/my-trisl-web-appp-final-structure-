import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { motion } from 'motion/react';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle, XCircle, ShieldCheck, Phone, Hash } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

const Register: React.FC = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [inGameId, setInGameId] = useState('');
    const [inGameName, setInGameName] = useState('');
    const [phone, setPhone] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [error, setError] = useState('');

    const [passwordStrength, setPasswordStrength] = useState(0);
    const [passwordFeedback, setPasswordFeedback] = useState<string[]>([]);

    const { showToast } = useNotification();
    const navigate = useNavigate();

    useEffect(() => {
        const feedback: string[] = [];
        let strength = 0;

        if (password.length >= 8) strength += 1;
        else feedback.push('At least 8 characters');

        if (/[A-Z]/.test(password)) strength += 1;
        else feedback.push('One uppercase letter');

        if (/[0-9]/.test(password)) strength += 1;
        else feedback.push('One number');

        if (/[^A-Za-z0-9]/.test(password)) strength += 1;
        else feedback.push('One special character');

        setPasswordStrength(strength);
        setPasswordFeedback(feedback);
    }, [password]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (passwordStrength < 3) {
            setError('Please choose a stronger password');
            return;
        }

        if (!agreeTerms) {
            setError('You must agree to the Terms & Conditions');
            return;
        }

        if (!inGameId.trim() || !inGameName.trim() || !phone.trim()) {
            setError('In-Game ID, In-Game Name, and Phone Number are required');
            return;
        }

        setIsLoading(true);

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await updateProfile(user, {
                displayName: username
            });

            const newUser = {
                uid: user.uid,
                email: user.email || '',
                username: username,
                role: 'player',
                balance: 0,
                totalEarnings: 0,
                inGameId: inGameId,
                inGameName: inGameName,
                teamName: '',
                phone: phone,
                isBanned: false,
                createdAt: serverTimestamp(),
            };

            await setDoc(doc(db, 'users', user.uid), newUser);
            await setDoc(doc(db, 'users_public', user.uid), {
                uid: user.uid,
                username: username,
                totalEarnings: 0,
                inGameId: inGameId,
                inGameName: inGameName,
                role: 'player',
                updatedAt: serverTimestamp(),
            });

            showToast('Welcome to Nexplay, ' + username + '!', 'success');
            navigate('/dashboard');
        } catch (err: any) {
            console.error('Registration error:', err);
            setError(err.message || 'Registration failed');
            showToast('Registration failed', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setIsGoogleLoading(true);

        try {
            await signInWithPopup(auth, googleProvider);
            showToast('Welcome to Nexplay!', 'success');
            navigate('/dashboard');
        } catch (err: any) {
            console.error('Google Sign-In error:', err);
            setError(err.message || 'Google Sign-In failed');
            showToast('Google Sign-In failed', 'error');
        } finally {
            setIsGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full"
            >
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 mb-4">
                        <ShieldCheck className="w-8 h-8 text-brand-500" />
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight uppercase">Join Nexplay</h2>
                    <p className="text-gray-500 mt-2 font-medium">Create your account to start competing</p>
                </div>

                <div className="bg-card border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-purple-600"></div>
                    
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Username</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-500 transition">
                                    <User className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="block w-full pl-12 pr-4 py-4 bg-dark border border-gray-700 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition font-bold"
                                    placeholder="Choose a username"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-500 transition">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-12 pr-4 py-4 bg-dark border border-gray-700 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition font-bold"
                                    placeholder="Enter your email"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">In-Game ID (UID)</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-500 transition">
                                    <Hash className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={inGameId}
                                    onChange={(e) => setInGameId(e.target.value)}
                                    className="block w-full pl-12 pr-4 py-4 bg-dark border border-gray-700 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition font-bold"
                                    placeholder="Enter your in-game ID"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">In-Game Name</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-500 transition">
                                    <User className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={inGameName}
                                    onChange={(e) => setInGameName(e.target.value)}
                                    className="block w-full pl-12 pr-4 py-4 bg-dark border border-gray-700 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition font-bold"
                                    placeholder="Enter your in-game name"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-500 transition">
                                    <Phone className="w-5 h-5" />
                                </div>
                                <input
                                    type="tel"
                                    required
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="block w-full pl-12 pr-4 py-4 bg-dark border border-gray-700 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition font-bold"
                                    placeholder="Enter your phone number"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-500 transition">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-12 pr-12 py-4 bg-dark border border-gray-700 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition font-bold"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            
                            {/* Password Strength Indicator */}
                            {password.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    <div className="flex gap-1 h-1">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div 
                                                key={i} 
                                                className={`flex-grow rounded-full transition-colors ${
                                                    i <= passwordStrength 
                                                        ? passwordStrength <= 2 ? 'bg-red-500' : passwordStrength === 3 ? 'bg-yellow-500' : 'bg-green-500'
                                                        : 'bg-gray-800'
                                                }`}
                                            ></div>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                        {passwordFeedback.map((f, i) => (
                                            <div key={i} className="flex items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                                <XCircle className="w-3 h-3 mr-1 text-red-500/50" /> {f}
                                            </div>
                                        ))}
                                        {passwordFeedback.length === 0 && (
                                            <div className="flex items-center text-[10px] text-green-500 font-bold uppercase tracking-wider">
                                                <CheckCircle className="w-3 h-3 mr-1" /> Password is strong
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Confirm Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-500 transition">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="block w-full pl-12 pr-4 py-4 bg-dark border border-gray-700 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition font-bold"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="flex items-start">
                            <input
                                id="agree-terms"
                                type="checkbox"
                                checked={agreeTerms}
                                onChange={(e) => setAgreeTerms(e.target.checked)}
                                className="mt-1 h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-700 rounded bg-dark cursor-pointer"
                            />
                            <label htmlFor="agree-terms" className="ml-2 block text-xs font-bold text-gray-400 cursor-pointer select-none leading-relaxed">
                                I agree to the <Link to="/privacy" className="text-brand-500 hover:underline">Terms & Conditions</Link> and <Link to="/privacy" className="text-brand-500 hover:underline">Privacy Policy</Link>
                            </label>
                        </div>

                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-xs font-bold"
                            >
                                {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || isGoogleLoading}
                            className="w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-2xl shadow-lg text-sm font-black text-white bg-brand-600 hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Create Account <ArrowRight className="ml-2 w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-800"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-card text-gray-500 font-bold uppercase tracking-widest text-[10px]">Or continue with</span>
                            </div>
                        </div>

                        <div className="mt-6">
                            <button
                                onClick={handleGoogleSignIn}
                                disabled={isLoading || isGoogleLoading}
                                className="w-full flex items-center justify-center py-4 px-4 border border-gray-700 rounded-2xl shadow-sm bg-dark text-sm font-black text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGoogleLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            />
                                            <path
                                                fill="#34A853"
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            />
                                            <path
                                                fill="#FBBC05"
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            />
                                            <path
                                                fill="#EA4335"
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            />
                                        </svg>
                                        Google
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-800 text-center">
                        <p className="text-sm text-gray-500 font-medium">
                            Already have an account?{' '}
                            <Link to="/login" className="text-brand-500 font-black hover:text-brand-400 transition uppercase tracking-wider text-xs">
                                Login Here
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Register;
