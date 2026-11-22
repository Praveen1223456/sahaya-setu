import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const DEMO_USERS = [
  {
    label: 'Citizen (Ramesh Varma)',
    email: 'citizen@sahayasetu.gov.in',
    password: 'password123',
    role: 'citizen',
    department: null,
    icon: '👤',
  },
  {
    label: 'Electricity Dept Admin (K. S. Narayana)',
    email: 'elec.admin@sahayasetu.gov.in',
    password: 'password123',
    role: 'department_admin',
    department: 'electricity',
    icon: '⚡',
  },
  {
    label: 'Water Supply Admin (M. Padma)',
    email: 'water.admin@sahayasetu.gov.in',
    password: 'password123',
    role: 'department_admin',
    department: 'water',
    icon: '💧',
  },
  {
    label: 'Roads & Infra Admin (V. Srinivasa Rao)',
    email: 'roads.admin@sahayasetu.gov.in',
    password: 'password123',
    role: 'department_admin',
    department: 'roads',
    icon: '🚧',
  },
  {
    label: 'Field Employee - Linesman (Suresh Kumar)',
    email: 'elec.field@sahayasetu.gov.in',
    password: 'password123',
    role: 'field_employee',
    department: 'electricity',
    icon: '👷',
  },
  {
    label: 'Field Employee - Plumber (Venkata Ramana)',
    email: 'water.field@sahayasetu.gov.in',
    password: 'password123',
    role: 'field_employee',
    department: 'water',
    icon: '🔧',
  },
  {
    label: 'Super Admin / District Collector',
    email: 'admin@sahayasetu.gov.in',
    password: 'password123',
    role: 'super_admin',
    department: '*',
    icon: '🏛️',
  },
];

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('sahaya_jwt_token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load current user profile from token
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          // Also set legacy staffToken for backward compatibility
          if (data.user?.role !== 'citizen') {
            const tokenMap = {
              electricity: 'elec-demo',
              water: 'water-demo',
              roads: 'roads-demo',
              super_admin: 'control-demo',
            };
            const mapped = tokenMap[data.user?.department] || (data.user?.role === 'super_admin' ? 'control-demo' : 'elec-demo');
            localStorage.setItem('ss.staffToken', mapped);
          }
        } else {
          logout();
        }
      } catch (err) {
        console.warn('Failed to load user profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token]);

  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Login failed');
    }
    localStorage.setItem('sahaya_jwt_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(userData) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Registration failed');
    }
    localStorage.setItem('sahaya_jwt_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('sahaya_jwt_token');
    localStorage.removeItem('ss.staffToken');
    setToken('');
    setUser(null);
  }

  async function switchDemoUser(demoUser) {
    try {
      return await login(demoUser.email, demoUser.password);
    } catch (e) {
      // If user was not yet created, register them on the fly
      return await register({
        name: demoUser.label.split('(')[1]?.replace(')', '') || demoUser.label,
        email: demoUser.email,
        password: demoUser.password,
        role: demoUser.role,
        department: demoUser.department,
      });
    }
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        switchDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
