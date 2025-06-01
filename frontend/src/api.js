// api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Interceptor para adicionar o token JWT em cada requisição
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export const auth = {
    login: (email, senha) => {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', senha);

        return api.post('/token', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    },
    register: (userData) => api.post('/register', userData),
    registerAdmin: (userData) => api.post('/register-admin', userData),
    getMe: () => api.get('/me'),
    updateProfile: (userData) => api.put('/me', userData),
};


export const clients = {
    getAll: (searchQuery = null) => {
        return api.get('/clients/', { params: searchQuery ? { search_query: searchQuery } : {} });
    },
    getById: (id) => api.get(`/clients/${id}`),
    getSummary: (id) => api.get(`/clients/${id}/summary`),
    create: (clientData) => api.post('/clients/', clientData),
    update: (id, clientData) => api.put(`/clients/${id}`, clientData),
    delete: (id) => api.delete(`/clients/${id}`),
};

export const carnes = {
    getAll: (clientId = null, statusCarne = null, dataVencimentoInicio = null, dataVencimentoFim = null, searchQuery = null) => {
        const params = {};
        if (clientId) params.id_cliente = clientId;
        if (statusCarne) params.status_carne = statusCarne;
        if (dataVencimentoInicio) params.data_vencimento_inicio = dataVencimentoInicio;
        if (dataVencimentoFim) params.data_vencimento_fim = dataVencimentoFim;
        if (searchQuery) params.search_query = searchQuery;

        return api.get(`/carnes/`, { params: params });
    },
    getById: (id) => api.get(`/carnes/${id}`),
    create: (carneData) => api.post(`/carnes/`, carneData),
    update: (id, carneData) => api.put(`/carnes/${id}`, carneData),
    delete: (id) => api.delete(`/carnes/${id}`),
};

export const parcelas = {
    getByCarneId: (carneId) => api.get(`/carnes/${carneId}/parcelas`),
    getById: (id) => api.get(`/carnes/parcelas/${id}`),
    update: (id, parcelaData) => api.put(`/carnes/parcelas/${id}`, parcelaData),
    delete: (id) => api.delete(`/carnes/parcelas/${id}`),
};

export const pagamentos = {
    create: (pagamentoData) => api.post(`/carnes/pagamentos/`, pagamentoData),
    getById: (id) => api.get(`/carnes/pagamentos/${id}`),
    getByParcelaId: (parcelaId) => api.get(`/carnes/parcelas/${parcelaId}/pagamentos`),
    update: (id, pagamentoData) => api.put(`/carnes/pagamentos/${id}`, pagamentoData),
    delete: (id) => api.delete(`/carnes/pagamentos/${id}`),
};

// Objeto para rotas de relatórios/dashboard
export const reports = {
    getDashboardSummary: () => api.get(`/reports/dashboard/summary`),
    // NOVO: Função para obter o relatório de recebimentos (RF022)
    getReceiptsReport: (startDate, endDate) => {
        return api.get(`/reports/receipts`, {
            params: {
                start_date: startDate,
                end_date: endDate
            }
        });
    },
    // NOVO: Função para obter o relatório de dívidas pendentes por cliente (RF023)
    getPendingDebtsReportByClient: (clientId) => api.get(`/reports/pending-debts-by-client/${clientId}`),
};