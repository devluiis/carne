import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('token'));

    const fetchUser = useCallback(async () => {
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }
        try {
            const response = await auth.getMe();
            // Garante que o perfil do usuário seja armazenado no estado `user`
            setUser(response.data); 
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(response.data)); // Salvar os dados completos do usuário
        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Erro ao fazer parse do usuário do localStorage, limpando dados:", e);
                localStorage.removeItem('user');
                setUser(null);
            }
        }
        fetchUser();
    }, [fetchUser]);


    const login = async (email, password) => {
        setLoading(true);
        try {
            const response = await auth.login(email, password);
            const newToken = response.data.access_token;
            const userData = response.data.user_data; // Captura os dados do usuário do payload
            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(userData)); // Salva os dados do usuário, incluindo o perfil
            setToken(newToken);
            setUser(userData);
            return true;
        } catch (error) {
            console.error('Erro no login:', error);
            setUser(null);
            setLoading(false);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    };

    const register = async (userData) => {
        setLoading(true);
        try {
            await auth.register(userData);
            setLoading(false);
            return true;
        } catch (error) {
            console.error('Erro no registro:', error);
            setLoading(false);
            throw error;
        }
    };

    const registerAdmin = async (userData) => {
        setLoading(true);
        try {
            const response = await auth.registerAdmin(userData);
            setLoading(false);
            return response;
        } catch (error) {
            console.error('Erro no registro de admin:', error);
            setLoading(false);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, register, registerAdmin }}>
            {children}
        </AuthContext.Provider>
    );
};