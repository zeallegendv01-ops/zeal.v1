/* ══════════════════ API SERVICE ══════════════════ */
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:4000/api'
  : `${window.location.protocol}//${window.location.host}/api`;

class ApiService {
  constructor() {
    this.token = localStorage.getItem('authToken');
  }

  getHeaders(withAuth = false) {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (withAuth && this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  getToken() {
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  isAuthenticated() {
    return !!this.token;
  }

  // AUTH ENDPOINTS
  async register(firstName, lastName, email, password, accountType, phone) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ firstName, lastName, email, password, accountType, phone })
      });
      const data = await response.json();
      if (data.success) {
        this.setToken(data.token);
      }
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.success) {
        this.setToken(data.token);
      }
      return data;
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  async getMe() {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: this.getHeaders(true)
      });
      return await response.json();
    } catch (error) {
      console.error('Get user error:', error);
      return { success: false, message: 'Network error.' };
    }
  }

  async updateProfile(profileData) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: this.getHeaders(true),
        body: JSON.stringify(profileData)
      });
      return await response.json();
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, message: 'Network error.' };
    }
  }

  // PRODUCT ENDPOINTS
  async getAllProducts() {
    try {
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('Get products error:', error);
      return { success: false, data: [] };
    }
  }

  async getProductById(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('Get product error:', error);
      return { success: false };
    }
  }

  async createProduct(productData) {
    try {
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(productData)
      });
      return await response.json();
    } catch (error) {
      console.error('Create product error:', error);
      return { success: false, message: 'Network error.' };
    }
  }

  async updateProduct(id, productData) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(true),
        body: JSON.stringify(productData)
      });
      return await response.json();
    } catch (error) {
      console.error('Update product error:', error);
      return { success: false, message: 'Network error.' };
    }
  }

  async deleteProduct(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(true)
      });
      return await response.json();
    } catch (error) {
      console.error('Delete product error:', error);
      return { success: false, message: 'Network error.' };
    }
  }

  async getSupplierProducts() {
    try {
      const response = await fetch(`${API_BASE_URL}/products/supplier/products`, {
        method: 'GET',
        headers: this.getHeaders(true)
      });
      return await response.json();
    } catch (error) {
      console.error('Get supplier products error:', error);
      return { success: false, data: [] };
    }
  }

  // ORDER ENDPOINTS
  async createOrder(orderData) {
    try {
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(orderData)
      });
      return await response.json();
    } catch (error) {
      console.error('Create order error:', error);
      return { success: false, message: 'Network error.' };
    }
  }

  async getOrders() {
    try {
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'GET',
        headers: this.getHeaders(true)
      });
      return await response.json();
    } catch (error) {
      console.error('Get orders error:', error);
      return { success: false, data: [] };
    }
  }

  async getOrderById(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
        method: 'GET',
        headers: this.getHeaders(true)
      });
      return await response.json();
    } catch (error) {
      console.error('Get order error:', error);
      return { success: false };
    }
  }

  async updateOrderStatus(id, status) {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(true),
        body: JSON.stringify({ status })
      });
      return await response.json();
    } catch (error) {
      console.error('Update order error:', error);
      return { success: false, message: 'Network error.' };
    }
  }

  // PAYMENT ENDPOINTS
  async initializePayment(orderData) {
    try {
      const response = await fetch(`${API_BASE_URL}/payments/initialize`, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(orderData)
      });
      return await response.json();
    } catch (error) {
      console.error('Initialize payment error:', error);
      return { success: false, message: 'Network error.' };
    }
  }

  async verifyPayment(reference) {
    try {
      const response = await fetch(`${API_BASE_URL}/payments/verify/${reference}`, {
        method: 'GET',
        headers: this.getHeaders(true)
      });
      return await response.json();
    } catch (error) {
      console.error('Verify payment error:', error);
      return { success: false, message: 'Network error.' };
    }
  }

  // CONTACT ENDPOINTS
  async sendContactMessage(fullName, email, subject, message) {
    try {
      const response = await fetch(`${API_BASE_URL}/contact`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ fullName, email, subject, message })
      });
      return await response.json();
    } catch (error) {
      console.error('Send contact error:', error);
      return { success: false, message: 'Network error.' };
    }
  }

  // EMAIL VERIFICATION & PASSWORD RESET
  async verifyEmail(token) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ token })
      });
      return await response.json();
    } catch (error) {
      console.error('Verify email error:', error);
      return { success: false, message: 'Network error.' };
    }
  }

  async forgotPassword(email) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email })
      });
      return await response.json();
    } catch (error) {
      console.error('Forgot password error:', error);
      return { success: false, message: 'Network error.' };
    }
  }

  async resetPassword(token, password, confirmPassword) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ token, password, confirmPassword })
      });
      return await response.json();
    } catch (error) {
      console.error('Reset password error:', error);
      return { success: false, message: 'Network error.' };
    }
  }
}

const apiService = new ApiService();
