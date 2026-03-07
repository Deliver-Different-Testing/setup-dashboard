/**
 * DFRNT TMS API Client — adapted from MCP server for Express context.
 *
 * Auth: credential-based login via Hub login page, stores session cookies in memory.
 * Self-healing: 401/302 → re-login → retry. Same pattern as MCP server.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { ApiResponse, BulkResult, Environment, ENVIRONMENTS } from './types/api.js';

/** Common interface for all API client types */
export interface IApiClient {
  get<T = unknown>(endpoint: string): Promise<ApiResponse<T>>;
  post<T = unknown>(endpoint: string, body: unknown): Promise<ApiResponse<T>>;
  put<T = unknown>(endpoint: string, body: unknown): Promise<ApiResponse<T>>;
  delete<T = unknown>(endpoint: string): Promise<ApiResponse<T>>;
  bulkCreate<T = unknown>(endpoint: string, items: unknown[], options?: BulkOptions): Promise<BulkResult>;
  getEnvironment(): Environment;
  getEnvKey(): string;
  isSessionValid(): Promise<boolean>;
}

export interface BulkOptions {
  batchSize?: number;
  delayMs?: number;
  onProgress?: (completed: number, total: number) => void;
  retryAttempts?: number;
  retryDelayMs?: number;
}

const BULK_SESSION_REFRESH_INTERVAL = 200;
const SESSION_RETRY_COOLDOWN_MS = 5 * 60 * 1000;

export class DfrntApiClient {
  private client: AxiosInstance;
  private environment: Environment;
  private envKey: string;
  private initialized = false;
  private lastSessionRetryTime = 0;
  private sessionCookies: string | null = null;
  private username: string;
  private password: string;

  constructor(envKey: string, username: string, password: string) {
    const env = ENVIRONMENTS[envKey];
    if (!env) {
      throw new Error(`Unknown environment: ${envKey}. Available: ${Object.keys(ENVIRONMENTS).join(', ')}`);
    }

    this.environment = env;
    this.envKey = envKey;
    this.username = username;
    this.password = password;

    this.client = axios.create({
      baseURL: env.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Session expiry interceptor — same as MCP server
    this.client.interceptors.response.use(
      response => response,
      async (error: AxiosError) => {
        const status = error.response?.status;
        const isSessionError = status === 401 || status === 302;

        if (isSessionError && this.canRetrySession()) {
          this.lastSessionRetryTime = Date.now();
          console.log(`[api-client] Session error (${status}). Re-logging in...`);

          const ok = await this.login();
          if (ok && error.config) {
            error.config.headers['Cookie'] = this.sessionCookies!;
            return this.client.request(error.config);
          }
          throw new Error('Session expired and auto-login failed. Check credentials.');
        }
        throw error;
      }
    );
  }

  private canRetrySession(): boolean {
    return Date.now() - this.lastSessionRetryTime >= SESSION_RETRY_COOLDOWN_MS;
  }

  /**
   * Login via Hub login page and capture session cookies.
   * The TMS Hub uses form-based auth that sets .AspNetCore.Cookies
   */
  async login(): Promise<boolean> {
    try {
      const loginUrl = this.environment.hubLoginUrl;

      // Step 1: GET login page to get anti-forgery token
      const pageResp = await axios.get(loginUrl, {
        maxRedirects: 0,
        validateStatus: s => s < 400
      });

      const pageCookies = (pageResp.headers['set-cookie'] || []) as string[];
      const cookieHeader = pageCookies.map(c => c.split(';')[0]).join('; ');

      // Extract __RequestVerificationToken from form
      const html = pageResp.data as string;
      const tokenMatch = html.match(/name="__RequestVerificationToken"\s+value="([^"]+)"/);
      const token = tokenMatch?.[1] || '';

      // Step 2: POST credentials
      const formData = new URLSearchParams();
      formData.append('Email', this.username);
      formData.append('Password', this.password);
      if (token) formData.append('__RequestVerificationToken', token);

      const loginResp = await axios.post(loginUrl, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieHeader
        },
        maxRedirects: 0,
        validateStatus: s => s < 400 || s === 302
      });

      const respCookies = (loginResp.headers['set-cookie'] || []) as string[];
      const allCookies = [...pageCookies, ...respCookies];
      this.sessionCookies = allCookies.map(c => c.split(';')[0]).join('; ');

      // Check for auth cookie
      const hasAuthCookie = this.sessionCookies.includes('.AspNetCore.Cookies') ||
                            this.sessionCookies.includes('.AspNet.ApplicationCookie');

      if (hasAuthCookie) {
        this.client.defaults.headers.common['Cookie'] = this.sessionCookies;
        this.initialized = true;
        console.log(`[api-client] Login successful for ${this.environment.name}`);
        return true;
      }

      console.error('[api-client] Login response did not contain auth cookie');
      return false;
    } catch (err) {
      console.error('[api-client] Login failed:', err instanceof Error ? err.message : err);
      return false;
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    const ok = await this.login();
    if (!ok) {
      throw new Error(`Failed to authenticate with ${this.environment.name}. Check DFRNT_USERNAME and DFRNT_PASSWORD.`);
    }
  }

  async get<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    await this.init();
    try {
      const response = await this.client.get(endpoint);
      return { success: true, data: response.data as T, statusCode: response.status };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async post<T = unknown>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    await this.init();
    try {
      const response = await this.client.post(endpoint, body);
      return { success: true, data: response.data as T, statusCode: response.status };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async put<T = unknown>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    await this.init();
    try {
      const response = await this.client.put(endpoint, body);
      return { success: true, data: response.data as T, statusCode: response.status };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async delete<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    await this.init();
    try {
      const response = await this.client.delete(endpoint);
      return { success: true, data: response.data as T, statusCode: response.status };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async bulkCreate<T = unknown>(
    endpoint: string,
    items: unknown[],
    options: BulkOptions = {}
  ): Promise<BulkResult> {
    const { delayMs = 100, retryAttempts = 2, retryDelayMs = 500, onProgress } = options;
    await this.init();

    const results: BulkResult['results'] = [];
    let successCount = 0;

    for (let i = 0; i < items.length; i++) {
      if (i > 0 && i % BULK_SESSION_REFRESH_INTERVAL === 0) {
        this.initialized = false;
        await this.init();
      }

      const item = items[i];
      let lastError: string | undefined;
      let success = false;
      let responseData: unknown;

      for (let attempt = 0; attempt <= retryAttempts; attempt++) {
        try {
          const response = await this.client.post(endpoint, item);
          responseData = response.data;
          success = true;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            if (status === 400 || status === 409) {
              lastError = (error.response?.data as any)?.messages?.join('; ') || lastError;
              break;
            }
          }
          if (attempt < retryAttempts) await this.delay(retryDelayMs * (attempt + 1));
        }
      }

      results.push({
        item, success,
        id: success && responseData ? this.extractId(responseData) : undefined,
        error: success ? undefined : lastError
      });
      if (success) successCount++;
      if (onProgress) onProgress(i + 1, items.length);
      if (i < items.length - 1 && delayMs > 0) await this.delay(delayMs);
    }

    return { total: items.length, success: successCount, failed: items.length - successCount, results };
  }

  async isSessionValid(): Promise<boolean> {
    await this.init();
    try {
      const response = await this.client.get('/api/zoneName');
      return response.status >= 200 && response.status < 400;
    } catch {
      return false;
    }
  }

  getEnvironment(): Environment {
    return this.environment;
  }

  getEnvKey(): string {
    return this.envKey;
  }

  private handleError<T>(error: unknown): ApiResponse<T> {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        error: error.response?.data ? JSON.stringify(error.response.data) : error.message,
        statusCode: error.response?.status
      };
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }

  private extractId(data: unknown): number | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const obj = data as Record<string, unknown>;
    if ('id' in obj && typeof obj.id === 'number') return obj.id;
    if ('Id' in obj && typeof obj.Id === 'number') return obj.Id;
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        const nested = value as Record<string, unknown>;
        if ('id' in nested && typeof nested.id === 'number') return nested.id;
        if ('Id' in nested && typeof nested.Id === 'number') return nested.Id;
      }
    }
    return undefined;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Bearer token client for the External API surface.
 * No login needed — uses pre-generated JWT token.
 */
export class DfrntBearerClient {
  private client: AxiosInstance;
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string, bearerToken: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.client = axios.create({
      baseURL: apiBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${bearerToken}`
      }
    });
  }

  async get<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get(endpoint);
      return { success: true, data: response.data as T, statusCode: response.status };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async post<T = unknown>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post(endpoint, body);
      return { success: true, data: response.data as T, statusCode: response.status };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async put<T = unknown>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put(endpoint, body);
      return { success: true, data: response.data as T, statusCode: response.status };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async delete<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete(endpoint);
      return { success: true, data: response.data as T, statusCode: response.status };
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  async bulkCreate<T = unknown>(
    endpoint: string,
    items: unknown[],
    options: BulkOptions = {}
  ): Promise<BulkResult> {
    const { delayMs = 100, retryAttempts = 2, retryDelayMs = 500, onProgress } = options;
    const results: BulkResult['results'] = [];
    let successCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let lastError: string | undefined;
      let success = false;
      let responseData: unknown;

      for (let attempt = 0; attempt <= retryAttempts; attempt++) {
        try {
          const response = await this.client.post(endpoint, item);
          responseData = response.data;
          success = true;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            if (status === 400 || status === 409) {
              lastError = (error.response?.data as any)?.messages?.join('; ') || lastError;
              break;
            }
          }
          if (attempt < retryAttempts) await new Promise(r => setTimeout(r, retryDelayMs * (attempt + 1)));
        }
      }

      results.push({
        item, success,
        id: success && responseData ? this.extractId(responseData) : undefined,
        error: success ? undefined : lastError
      });
      if (success) successCount++;
      if (onProgress) onProgress(i + 1, items.length);
      if (i < items.length - 1 && delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }

    return { total: items.length, success: successCount, failed: items.length - successCount, results };
  }

  getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }

  private handleError<T>(error: unknown): ApiResponse<T> {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        error: error.response?.data ? JSON.stringify(error.response.data) : error.message,
        statusCode: error.response?.status
      };
    }
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }

  private extractId(data: unknown): number | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const obj = data as Record<string, unknown>;
    if ('id' in obj && typeof obj.id === 'number') return obj.id;
    if ('Id' in obj && typeof obj.Id === 'number') return obj.Id;
    return undefined;
  }
}

/** Endpoint path patterns that route to the External API (Bearer auth) */
const EXTERNAL_API_PATTERNS = [
  /^\/api\/Jobs/i,
  /^\/api\/Rates/i,
  /^\/api\/Webhook/i,
  /^\/api\/JobLabel/i,
];

/**
 * Dual-auth client that routes requests to the correct API surface:
 * - External API endpoints → Bearer token client
 * - Admin Manager endpoints → Cookie auth client
 */
export class DfrntDualClient {
  public adminClient: DfrntApiClient;
  public apiClient: DfrntBearerClient;

  constructor(adminClient: DfrntApiClient, apiClient: DfrntBearerClient) {
    this.adminClient = adminClient;
    this.apiClient = apiClient;
  }

  private isExternalApi(endpoint: string): boolean {
    return EXTERNAL_API_PATTERNS.some(p => p.test(endpoint));
  }

  private route(endpoint: string): DfrntApiClient | DfrntBearerClient {
    return this.isExternalApi(endpoint) ? this.apiClient : this.adminClient;
  }

  async get<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.route(endpoint).get<T>(endpoint);
  }

  async post<T = unknown>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.route(endpoint).post<T>(endpoint, body);
  }

  async put<T = unknown>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.route(endpoint).put<T>(endpoint, body);
  }

  async delete<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.route(endpoint).delete<T>(endpoint);
  }

  async bulkCreate<T = unknown>(
    endpoint: string,
    items: unknown[],
    options: BulkOptions = {}
  ): Promise<BulkResult> {
    return this.route(endpoint).bulkCreate<T>(endpoint, items, options);
  }

  getEnvironment(): Environment {
    return this.adminClient.getEnvironment();
  }

  getEnvKey(): string {
    return this.adminClient.getEnvKey();
  }

  async isSessionValid(): Promise<boolean> {
    return this.adminClient.isSessionValid();
  }
}

export default DfrntApiClient;
