import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simulated Database for Users
  const [usersDb, setUsersDb] = useState([]);

  useEffect(() => {
    // Load existing session and users database
    const storedSession = localStorage.getItem('auth_session');
    if (storedSession) setUser(JSON.parse(storedSession));
    
    const storedUsers = localStorage.getItem('app_users_db');
    if (storedUsers) setUsersDb(JSON.parse(storedUsers));
    
    setLoading(false);
  }, []);

  // Internal helper to save users
  const saveUserToDb = (newUser) => {
    const updated = [...usersDb, newUser];
    setUsersDb(updated);
    localStorage.setItem('app_users_db', JSON.stringify(updated));
    return newUser;
  };

  // Login via explicit email/password check
  const loginWithCredentials = (email, password, expectedRole) => {
    // Expected role from UI for Citizen is 'citizen', but DB uses 'user'
    const dbRole = expectedRole === 'citizen' ? 'user' : expectedRole;

    // SuperAdmin bypass
    if (expectedRole === 'admin' && email === 'admin' && password === 'admin123') {
      const session = { role: 'admin', state: '', district: '', email: 'admin@system.local', username: 'SuperAdmin', superadmin: true };
      localStorage.setItem('auth_session', JSON.stringify(session));
      setUser(session);
      return { success: true };
    }

    const found = usersDb.find(u => u.email === email && u.password === password && u.role === dbRole);
    if (!found) return { success: false, error: 'Invalid credentials or wrong role tab.' };
    
    if (found.role === 'admin' && found.status === 'pending') {
      return { success: false, error: 'Your account is pending Super Admin approval.' };
    }

    const session = { ...found };
    delete session.password; // don't store plain pass
    localStorage.setItem('auth_session', JSON.stringify(session));
    setUser(session);
    return { success: true };
  };

  const registerUser = (name, email, password, state, district) => {
    if (usersDb.find(u => u.email === email)) return { success: false, error: 'Email already registered.' };
    
    // Status immediately active for citizens
    const newUser = { role: 'user', name, email, password, username: name, state, district, status: 'active' };
    saveUserToDb(newUser);
    
    // Return success without logging them in immediately
    return { success: true, message: 'Registration successful. You can now sign in.' };
  };

  const registerAdmin = (email, password, state, district) => {
    if (usersDb.find(u => u.email === email)) return { success: false, error: 'Email already registered.' };
    
    // Status pending for Admins until SuperAdmin approves
    const newAdmin = { role: 'admin', email, password, state, district, username: email.split('@')[0], status: 'pending' };
    saveUserToDb(newAdmin);
    
    // Return success without logging them in immediately
    return { success: true, message: 'Registration sent to Super Admin for approval.' };
  };

  // --- SuperAdmin Tools ---
  const updateSuperAdminFilter = (state, district) => {
    if (user && user.superadmin) {
       setUser({ ...user, state, district });
    }
  };

  const getAllAdmins = () => usersDb.filter(u => u.role === 'admin');
  
  const approveAdmin = (email) => {
    const updated = usersDb.map(u => (u.email === email && u.role === 'admin') ? { ...u, status: 'active' } : u);
    setUsersDb(updated);
    localStorage.setItem('app_users_db', JSON.stringify(updated));
  };
  
  const rejectAdmin = (email) => {
    const updated = usersDb.filter(u => !(u.email === email && u.role === 'admin'));
    setUsersDb(updated);
    localStorage.setItem('app_users_db', JSON.stringify(updated));
  };

  // Maintain original functions just in case for older code, but redirect them to new session logic
  const loginAdmin = (state, district) => {
    // Handled by loginWithCredentials now, but kept for safe fallback if needed
  };

  const loginUser = (state, district, email) => {
    // Geolocation fallback
  };

  const logout = () => {
    localStorage.removeItem('auth_session');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, loading, loginWithCredentials, registerUser, registerAdmin, 
      loginAdmin, loginUser, logout, getAllAdmins, approveAdmin, rejectAdmin, updateSuperAdminFilter
    }}>
      {children}
    </AuthContext.Provider>
  );
};
