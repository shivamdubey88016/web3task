import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [errorToast, setErrorToastState] = useState(null);

  const setErrorToast = (msg) => {
    setErrorToastState(msg);
    if (msg) {
      setTimeout(() => {
        setErrorToastState(null);
      }, 4000);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          setUser({
            id: res.data._id || res.data.id,
            username: res.data.username,
            email: res.data.email,
            avatarUrl: res.data.avatarUrl
          });
        } catch (error) {
          console.error('Failed to load user session', error);
          logout();
        }
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  const login = async (identity, password) => {
    try {
      const res = await api.post('/auth/login', { identity, password });
      const { token: receivedToken, user: receivedUser } = res.data;
      localStorage.setItem('token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please verify credentials.';
      setErrorToast(message);
      throw new Error(message);
    }
  };

  const register = async (username, email, password) => {
    try {
      const res = await api.post('/auth/register', { username, email, password });
      const { token: receivedToken, user: receivedUser } = res.data;
      localStorage.setItem('token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Try a different username/email.';
      setErrorToast(message);
      throw new Error(message);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, errorToast, setErrorToast }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
