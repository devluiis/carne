import axios from 'axios';

const API_BASE_URL = "https://carne.onrender.com"; // Certifique-se que esta URL é a do seu backend no Render

export const api = axios.create({
    baseURL: API_BASE_URL,
});

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
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
    },
    register: (userData) => api.post('/register', userData),
    registerAdmin: (userData) => api.post('/register-admin', userData),
    registerAtendenteByAdmin: (userData) => api.post('/register-atendente', userData),
    getMe: () => api.get('/me'),
    updateProfile: (userData) => api.put('/me', userData),
};

export const clients = {
    getAll: (searchQuery = null) => api.get('/clients/', { params: searchQuery ? { search_query: searchQuery } : {} }),
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
        return api.get(`/carnes/`, { params });
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
    renegotiate: (id, renegotiationData) => api.post(`/carnes/parcelas/${id}/renegotiate`, renegotiationData), // NOVO
    delete: (id) => api.delete(`/carnes/parcelas/${id}`),
};

export const pagamentos = {
    create: (pagamentoData) => api.post(`/carnes/pagamentos/`, pagamentoData),
    getById: (id) => api.get(`/carnes/pagamentos/${id}`),
    getByParcelaId: (parcelaId) => api.get(`/carnes/parcelas/${parcelaId}/pagamentos`),
    update: (id, pagamentoData) => api.put(`/carnes/pagamentos/${id}`, pagamentoData),
    delete: (id) => api.delete(`/carnes/pagamentos/${id}`),
};

export const reports = {
    getDashboardSummary: () => api.get(`/reports/dashboard/summary`),
    getReceiptsReport: (startDate, endDate) => api.get(`/reports/receipts`, { params: { start_date: startDate, end_date: endDate } }),
    getPendingDebtsReportByClient: (clientId) => api.get(`/reports/pending-debts-by-client/${clientId}`),
};

const PRODUTOS_API_PREFIX = "/api"; 

export const produtos = {
    getAll: (skip = 0, limit = 100, searchQuery = null, categoria = null, marca = null) => {
        const params = { skip, limit };
        if (searchQuery) params.search_query = searchQuery;
        if (categoria) params.categoria = categoria;
        if (marca) params.marca = marca;
        return api.get(`${PRODUTOS_API_PREFIX}/produtos/`, { params });
    },
    getById: (id) => api.get(`${PRODUTOS_API_PREFIX}/produtos/${id}`),
    create: (produtoData) => api.post(`${PRODUTOS_API_PREFIX}/produtos/`, produtoData),
    update: (id, produtoData) => api.put(`${PRODUTOS_API_PREFIX}/produtos/${id}`, produtoData),
    delete: (id) => api.delete(`${PRODUTOS_API_PREFIX}/produtos/${id}`),
};