import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, Shield, User, Loader2, Users, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const INDIA_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", 
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", 
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", 
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", 
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

export default function LoginPage() {
  const { loginWithCredentials, registerUser, registerAdmin } = useAuth();
  
  // view = 'init' | 'citizen' | 'admin'
  const [view, setView] = useState('init');
  // mode = 'login' | 'register'
  const [mode, setMode] = useState('login');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Shared Forms
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration Only
  const [name, setName] = useState(''); // citizen
  const [stateField, setStateField] = useState(''); // admin
  const [districtField, setDistrictField] = useState(''); // admin

  const handleBack = () => {
    setView('init');
    setMode('login');
    setError(null);
    setSuccessMsg(null);
    setEmail('');
    setPassword('');
    setShowPassword(false);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    // Request notification permissions explicitly on a user gesture
    if ("Notification" in window && Notification.permission !== "granted") {
      try { await Notification.requestPermission(); } catch (e) {}
    }

    try {
      if (view === 'citizen' && mode === 'register') {
        if (!name || !email || !password) throw new Error("Please fill out all fields.");
        
        // Auto Geolocation for Citizen Registration
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const { latitude: lat, longitude: lng } = pos.coords;
              try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                const data = await res.json();
                if (data && data.address) {
                  const state = data.address.state;
                  const district = data.address.state_district || data.address.county || data.address.city;
                  if (state && district) {
                    const res = registerUser(name, email, password, state, district);
                    if (!res.success) setError(res.error);
                    else {
                      setSuccessMsg(res.message);
                      setMode('login');
                      setPassword(''); // clear pass for security
                    }
                  } else {
                    setError("Could not determine detailed location.");
                  }
                } else setError("Failed to reverse geocode.");
              } catch (err) { setError("Geocoding API error."); }
              finally { setLoading(false); }
            },
            (err) => { setError("Location access required for Citizen Registration!"); setLoading(false); },
            { timeout: 10000, enableHighAccuracy: true }
        );
        return; // wait for geo callback
      } 
      
      else if (view === 'admin' && mode === 'register') {
        if (!email || !password || !stateField || !districtField) throw new Error("Please fill out all fields.");
        const res = registerAdmin(email, password, stateField, districtField);
        if (!res.success) throw new Error(res.error);
        else {
          setSuccessMsg(res.message);
          setMode('login');
          setPassword('');
        }
      } 
      
      else if (mode === 'login') {
        if (!email || !password) throw new Error("Please enter email and password.");
        const res = loginWithCredentials(email, password, view);
        if (!res.success) throw new Error(res.error);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (view === 'init') {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold font-mono text-white mb-4">
              AIoT <span className="text-primary-500">RoadMonitor</span>
            </h1>
            <p className="text-gray-400 text-lg">Select your portal to continue</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Citizen Box */}
            <button 
              onClick={() => { setView('citizen'); setMode('login'); }}
              className="glass-card hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(255,107,0,0.2)] transition-all duration-300 p-8 rounded-3xl text-center group border border-white/5 bg-dark-900/50"
            >
              <div className="w-20 h-20 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary-500/20 transition-colors">
                <Users className="w-10 h-10 text-primary-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Citizen Portal</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Access local road hazard maps, receive live driving alerts, and track pothole repairs in your district.
              </p>
            </button>

            {/* Admin Box */}
            <button 
              onClick={() => { setView('admin'); setMode('login'); }}
              className="glass-card hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] transition-all duration-300 p-8 rounded-3xl text-center group border border-white/5 bg-dark-900/50"
            >
              <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-500/20 transition-colors">
                <Shield className="w-10 h-10 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Official Admin</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Monitor real-time AI and NodeMCU hardware sensor data, manage repair lifecycles, and view global analytics.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8 animate-fade-in relative overflow-hidden">
        {/* Decorative Glow */}
        <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl ${view === 'admin' ? 'bg-blue-500/20' : 'bg-primary-500/20'}`} />
        
        <button onClick={handleBack} className="absolute top-6 left-6 text-gray-400 hover:text-white flex items-center gap-1 text-xs font-semibold uppercase tracking-wider">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center mb-8 mt-6">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${view === 'admin' ? 'bg-blue-500/20 text-blue-400' : 'bg-primary-500/20 text-primary-400'}`}>
            {view === 'admin' ? <Shield className="w-6 h-6" /> : <Users className="w-6 h-6" />}
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {view === 'admin' ? 'Admin Portal' : 'Citizen Portal'}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Toggle Login/Register */}
        <div className="flex bg-dark-900 rounded-lg p-1 mb-6">
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'login' ? `bg-white/10 text-white shadow-lg border border-white/5` : 'text-gray-400 hover:text-white'}`}
            onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'register' ? `bg-white/10 text-white shadow-lg border border-white/5` : 'text-gray-400 hover:text-white'}`}
            onClick={() => { setMode('register'); setError(null); setSuccessMsg(null); }}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        
        {successMsg && (
          <div className="mb-6 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          
          {/* Name Field (Citizen Register) */}
          {mode === 'register' && view === 'citizen' && (
            <div>
               <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Full Name</label>
               <input type="text" value={name} onChange={e => setName(e.target.value)}
                 className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500" required />
            </div>
          )}

          {/* District & State Fields (Admin Register) */}
          {mode === 'register' && view === 'admin' && (
             <>
               <div className="grid grid-cols-2 gap-2">
                 <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">State</label>
                    <select value={stateField} onChange={e => setStateField(e.target.value)}
                      className="w-full bg-dark-900 border border-white/10 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-blue-500" required>
                      <option value="" disabled>Select State</option>
                      {INDIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">District</label>
                    <input type="text" placeholder="Tirunelveli" value={districtField} onChange={e => setDistrictField(e.target.value)}
                      className="w-full bg-dark-900 border border-white/10 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-blue-500 placeholder:text-gray-600" required />
                 </div>
               </div>
             </>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email / Username</label>
            <input type="text" placeholder="Enter email" value={email} onChange={e => setEmail(e.target.value)}
              className={`w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none ${view === 'admin' ? 'focus:border-blue-500' : 'focus:border-primary-500'} placeholder:text-gray-600`} required />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                className={`w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none ${view === 'admin' ? 'focus:border-blue-500' : 'focus:border-primary-500'} placeholder:text-gray-600`} 
                required 
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {mode === 'register' && view === 'citizen' && (
             <div className="p-3 mt-4 bg-white/5 rounded-xl border border-white/10 font-medium flex items-start gap-3 text-xs text-gray-400">
               <MapPin className="w-5 h-5 flex-shrink-0 text-primary-400" />
               <p>Your State & District will be auto-located securely via GPS during registration.</p>
             </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 mt-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-75 relative overflow-hidden group text-white 
              ${view === 'admin' ? 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'bg-primary-600 hover:bg-primary-500 shadow-[0_0_20px_rgba(255,107,0,0.3)]'}
            `}
          >
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</> : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>

        </form>
      </div>
    </div>
  );
}
