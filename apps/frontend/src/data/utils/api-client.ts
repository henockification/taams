import { storefrontApiKeyHeaders } from '@/lib/storefront-api-headers';

function storefrontHeadersForEndpoint(endpoint: string): Record<string, string> {
  if (!endpoint.includes('/categories-public') && !endpoint.includes('/packages-public')) {
    return {};
  }
  return storefrontApiKeyHeaders();
}

export class ApiClient {
    private baseURL: string;
  
    constructor() {
      // Use environment variable or fallback to localhost for development
      this.baseURL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3012';
      
      // Log the base URL in development for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('API Client initialized with base URL:', this.baseURL);
      }
    }
  
    async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
      // Get tenant ID from localStorage (non-blocking)
      let tenantId: string | null = null;
      try {
        tenantId = localStorage.getItem('tenantId') || sessionStorage.getItem('tenantId');
      } catch (error) {
        // If storage access fails, continue without tenant header
        console.warn('Failed to get tenant ID from storage:', error);
      }
  
      const sf = storefrontHeadersForEndpoint(endpoint);

      // Only add tenant header if we have one, otherwise pass through unchanged
      if (tenantId) {
        // For FormData, don't override Content-Type - let browser set it
        const isFormData = options.body instanceof FormData;
        const headers = options.headers || {};
        
        let newHeaders;
        if (isFormData) {
          // For FormData, only add tenant header, don't touch Content-Type
          newHeaders = typeof headers === 'object' && !Array.isArray(headers) && !(headers instanceof Headers)
            ? { ...sf, ...headers, 'x-tenant-id': tenantId }
            : { ...sf, 'x-tenant-id': tenantId };
        } else {
          // For JSON, we can safely add tenant header
          newHeaders = typeof headers === 'object' && !Array.isArray(headers) && !(headers instanceof Headers)
            ? { ...sf, ...headers, 'x-tenant-id': tenantId }
            : { ...sf, 'x-tenant-id': tenantId };
        }
        
        const response = await fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers: newHeaders,
          credentials:'include'
        });
        
        // Handle API errors gracefully
        if (!response.ok) {
          console.error(`API request failed: ${response.status} ${response.statusText}`, {
            url: `${this.baseURL}${endpoint}`,
            status: response.status,
          });
        }
        
        return response;
      }
  
      // No tenant ID
      const headers = options.headers || {};
      const newHeaders =
        typeof headers === 'object' && !Array.isArray(headers) && !(headers instanceof Headers)
          ? { ...sf, ...headers }
          : { ...sf };
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: newHeaders,
        credentials: 'include',
      });
      
      // Handle API errors gracefully
      if (!response.ok) {
        console.error(`API request failed: ${response.status} ${response.statusText}`, {
          url: `${this.baseURL}${endpoint}`,
          status: response.status,
        });
      }
      
      return response;
    }
  
    async get(endpoint: string, options: RequestInit = {}) {
      return this.request(endpoint, { ...options, method: 'GET' });
    }
  
    async post(endpoint: string, body?: any, options: RequestInit = {}) {
      // Don't stringify FormData - let the browser handle it
      const processedBody = body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined);
      
      return this.request(endpoint, {
        ...options,
        method: 'POST',
        body: processedBody,
      });
    }
  
    async put(endpoint: string, body?: any, options: RequestInit = {}) {
      return this.request(endpoint, {
        ...options,
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  
    async patch(endpoint: string, body?: any, options: RequestInit = {}) {
      return this.request(endpoint, {
        ...options,
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  
    async delete(endpoint: string, options: RequestInit = {}) {
      return this.request(endpoint, { ...options, method: 'DELETE' });
    }
  }
  
  // Export singleton instance
  export const apiClient = new ApiClient();
  
