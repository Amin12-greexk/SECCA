// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

// Types
export interface Supplier {
    id: string;
    name: string;
    code?: string | null;
}

export interface BakuReceiveRequest {
    supplierId: string;
    origin: string;
    featherCondition: string;
    wetWeightGram: number;
    moisturePercent: number;
    pieceCount: number;
}

export interface RawBatch {
    id: string;
    batchNumber: string;
    cardId: string;
    supplierId: string;
    supplier?: Supplier;
    origin: string;
    featherCondition: string;
    wetWeightGram: number;
    moisturePercent: number;
    pieceCount: number;
    createdAt: string;
    updatedAt: string;
}

export type BakuReceiveResponse = RawBatch;

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
    token: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

type ApiResponse<T> = {
    data: T;
    meta?: { timestamp: string };
};

function unwrap<T>(payload: ApiResponse<T> | T): T {
    if (payload && typeof payload === 'object' && 'data' in (payload as ApiResponse<T>)) {
        return (payload as ApiResponse<T>).data;
    }

    return payload as T;
}

// Helper: Get auth headers
function getAuthHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

// Auth API Functions
export async function login(data: LoginRequest): Promise<LoginResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Login gagal');
        }

        const json = await response.json();
        return unwrap<LoginResponse>(json);
    } catch (error) {
        console.error('Error logging in:', error);
        throw error;
    }
}

export async function logout(): Promise<void> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            console.warn('Logout request failed, but clearing local session anyway');
        }
    } catch (error) {
        console.error('Error logging out:', error);
        // Continue with local logout even if API fails
    }
}

export async function getProfile(): Promise<User> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch profile');
        }

        const json = await response.json();
        return unwrap<User>(json);
    } catch (error) {
        console.error('Error fetching profile:', error);
        throw error;
    }
}

// Existing API Functions (updated with auth headers)
export async function getSuppliers(): Promise<Supplier[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch suppliers: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<Supplier[]>(json);
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
    }
}

export async function submitBakuReceive(data: BakuReceiveRequest): Promise<BakuReceiveResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/baku/receive`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to submit: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<BakuReceiveResponse>(json);
    } catch (error) {
        console.error('Error submitting baku receive:', error);
        throw error;
    }
}
