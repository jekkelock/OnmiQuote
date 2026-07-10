import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('jwt_token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      fetch('/api/tenant/info', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => setUser(data.tenant))
        .catch(() => {
          setToken(null);
          localStorage.removeItem('jwt_token');
        });
    }
  }, [token]);

  const login = (newToken) => {
    setToken(newToken);
    localStorage.setItem('jwt_token', newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('jwt_token');
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);