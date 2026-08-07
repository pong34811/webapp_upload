import axios from 'axios'

function getCsrfToken() {
  const match = document.cookie.match(/csrftoken=([^;]+)/)
  return match ? match[1] : ''
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method)) {
    config.headers['X-CSRFToken'] = getCsrfToken()
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 403 || err.response?.status === 401) {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  login: (username, password) => api.post('/auth/login/', { username, password }),
  logout: () => api.post('/auth/logout/'),
  me: () => api.get('/auth/me/'),
}

export const destinationAPI = {
  list: () => api.get('/destinations/'),
  create: (data) => api.post('/destinations/', data),
  update: (id, data) => api.put(`/destinations/${id}/`, data),
  remove: (id) => api.delete(`/destinations/${id}/`),
}

export const oauthAPI = {
  start: () => api.get('/oauth/youtube/start/'),
}

export const facebookAPI = {
  authUrl: () => api.get('/oauth/facebook/auth-url/'),
  extend: (token) => api.post('/oauth/facebook/extend/', { access_token: token }),
}

export const uploadAPI = {
  create: (formData, onProgress) =>
    api.post('/uploads/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 30))
        }
      },
    }),
  list: () => api.get('/uploads/'),
  get: (id) => api.get(`/uploads/${id}/`),
  retry: (id) => api.post(`/uploads/${id}/retry/`),
  cancel: (id) => api.post(`/uploads/${id}/cancel/`),
}

export const templateAPI = {
  list: () => api.get('/templates/'),
  create: (data) => api.post('/templates/', data),
  update: (id, data) => api.put(`/templates/${id}/`, data),
  remove: (id) => api.delete(`/templates/${id}/`),
}

export default api
