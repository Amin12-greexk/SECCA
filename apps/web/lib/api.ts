// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

// Types
export interface Supplier {
    id: string;
    name: string;
    code?: string | null;
    phone?: string | null;
}

export interface BakuReceiveRequest {
    supplierId: string;
    featherCondition: string;
    invoiceWeightGram: number;
    wetWeightGram: number;
    moisturePercent: number;
    notes?: string;
}

export interface RawBatch {
    id: string;
    batchNumber: string;
    cardId: string;
    supplierId: string;
    supplier?: Supplier;
    featherCondition: string;
    invoiceWeightGram: number;
    wetWeightGram: number;
    originalWetWeightGram?: number;
    moisturePercent: number;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface RackLocation {
    id: string;
    code: string;
    name: string;
    type: string;
}

export interface ProductionLot {
    id: string;
    lotNumber: string;
    externalId?: string | null;
    gradeId: string;
    featherGradeId?: string | null;
    colorGradeId?: string | null;
    wetWeightGram: number;
    dryWeightGramLocked: number;
    moistureBps: number;
    status: string;
    locationId: string;
    grade?: Grade;
    featherGrade?: Grade | null;
    colorGrade?: Grade | null;
    location?: RackLocation;
    createdAt: string;
    updatedAt: string;
}

export interface PecahBonRequest {
    gradeId: string;
    featherGradeId: string;
    colorGradeId: string;
    pecahBonDate: string;
    featherCondition: string;
    pieceCount: number;
    initialWeightGram: number;
    moisturePercent: number;
}

export interface PecahBonEntry {
    id: string;
    pecahBonId?: string | null;
    rawBatchId: string;
    gradeId: string;
    featherGradeId?: string | null;
    colorGradeId?: string | null;
    pecahBonDate: string;
    featherCondition: string;
    pieceCount: number;
    initialWeightGram: number;
    moisturePercent: number;
    dryWeightGram: number;
    grade?: Grade;
    featherGrade?: Grade | null;
    colorGrade?: Grade | null;
    createdAt: string;
    updatedAt: string;
}

export type BakuReceiveResponse = RawBatch;

export interface Grade {
    id: string;
    name: string;
    code: string;
    type: string;
}

export interface GradeTariff {
    id: string;
    shapeGradeId: string;
    featherGradeId?: string | null;
    colorGradeId?: string | null;
    rateRpPerGram: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    shapeGrade?: Grade;
    featherGrade?: Grade | null;
    colorGrade?: Grade | null;
}

export interface MoistureRule {
    id: string;
    gradeId: string | null;
    supplierId: string | null;
    moistureBps: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    grade?: Grade | null;
    supplier?: Supplier | null;
}

export interface PecahBonPreset {
    id: string;
    name: string;
    weightGram: number;
    isActive: boolean;
}

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

export interface CreateUserRequest {
    name: string;
    email: string;
    password: string;
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
function getAuthHeaders(options: { json?: boolean } = { json: true }): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = {};

    if (options.json !== false) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
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
            headers: getAuthHeaders({ json: false }),
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
            headers: getAuthHeaders({ json: false }),
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

export async function getUsers(): Promise<User[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<User[]>(json);
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

export async function createUser(data: CreateUserRequest): Promise<User> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to create user: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<User>(json);
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

// Existing API Functions (updated with auth headers)
export async function getSuppliers(): Promise<Supplier[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
            headers: getAuthHeaders({ json: false }),
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

export async function createSupplier(data: {
    name: string;
    code?: string | null;
    phone?: string | null;
}): Promise<Supplier> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to create supplier: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<Supplier>(json);
    } catch (error) {
        console.error('Error creating supplier:', error);
        throw error;
    }
}

export async function updateSupplier(
    supplierId: string,
    data: {
        name?: string;
        code?: string | null;
        phone?: string | null;
    }
): Promise<Supplier> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/suppliers/${supplierId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to update supplier: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<Supplier>(json);
    } catch (error) {
        console.error('Error updating supplier:', error);
        throw error;
    }
}

export async function deleteSupplier(supplierId: string): Promise<void> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/suppliers/${supplierId}`, {
            method: 'DELETE',
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to delete supplier: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error deleting supplier:', error);
        throw error;
    }
}

export async function getGrades(): Promise<Grade[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch grades: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<Grade[]>(json);
    } catch (error) {
        console.error('Error fetching grades:', error);
        throw error;
    }
}

export async function createGrade(data: { name: string; code: string; type: string }): Promise<Grade> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to create grade: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<Grade>(json);
    } catch (error) {
        console.error('Error creating grade:', error);
        throw error;
    }
}

export async function updateGrade(
    gradeId: string,
    data: { name?: string; code?: string; type?: string }
): Promise<Grade> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to update grade: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<Grade>(json);
    } catch (error) {
        console.error('Error updating grade:', error);
        throw error;
    }
}

export async function deleteGrade(gradeId: string): Promise<void> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
            method: 'DELETE',
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to delete grade: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error deleting grade:', error);
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

export async function getRawBatches(): Promise<RawBatch[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/baku`, {
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch raw batches: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<RawBatch[]>(json);
    } catch (error) {
        console.error('Error fetching raw batches:', error);
        throw error;
    }
}

export async function getRawBatchByCardId(cardId: string): Promise<RawBatch> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/baku/${cardId}`, {
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch raw batch: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<RawBatch>(json);
    } catch (error) {
        console.error('Error fetching raw batch:', error);
        throw error;
    }
}

export async function createPecahBon(rawBatchId: string, data: PecahBonRequest): Promise<PecahBonEntry> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/baku/${rawBatchId}/pecah-bon`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to create pecah bon: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<PecahBonEntry>(json);
    } catch (error) {
        console.error('Error creating pecah bon:', error);
        throw error;
    }
}

export async function getPecahBonEntries(rawBatchId: string): Promise<PecahBonEntry[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/baku/${rawBatchId}/pecah-bon`, {
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch pecah bon entries: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<PecahBonEntry[]>(json);
    } catch (error) {
        console.error('Error fetching pecah bon entries:', error);
        throw error;
    }
}

export async function getRackLotsByCode(code: string): Promise<{
    location: RackLocation;
    lots: ProductionLot[];
}> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/locations/code/${code}/lots`, {
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch rack lots: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<{ location: RackLocation; lots: ProductionLot[] }>(json);
    } catch (error) {
        console.error('Error fetching rack lots:', error);
        throw error;
    }
}

export async function moveLot(lotId: string, toLocationCode: string): Promise<ProductionLot> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/lots/${lotId}/move`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ toLocationCode }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to move lot: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<ProductionLot>(json);
    } catch (error) {
        console.error('Error moving lot:', error);
        throw error;
    }
}

export async function getGradeTariffs(params?: {
    shapeGradeId?: string;
    featherGradeId?: string;
    colorGradeId?: string;
}): Promise<GradeTariff[]> {
    try {
        const url = new URL(`${API_BASE_URL}/api/rules/grade-tariffs`);
        if (params?.shapeGradeId) url.searchParams.set('shapeGradeId', params.shapeGradeId);
        if (params?.featherGradeId) url.searchParams.set('featherGradeId', params.featherGradeId);
        if (params?.colorGradeId) url.searchParams.set('colorGradeId', params.colorGradeId);

        const response = await fetch(url.toString(), {
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch grade tariffs: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<GradeTariff[]>(json);
    } catch (error) {
        console.error('Error fetching grade tariffs:', error);
        throw error;
    }
}

export async function createGradeTariff(data: {
    shapeGradeId: string;
    featherGradeId?: string | null;
    colorGradeId?: string | null;
    rateRpPerGram: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
}): Promise<GradeTariff> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/rules/grade-tariffs`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to create grade tariff: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<GradeTariff>(json);
    } catch (error) {
        console.error('Error creating grade tariff:', error);
        throw error;
    }
}

export async function deleteGradeTariff(id: string): Promise<void> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/rules/grade-tariffs/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to delete grade tariff: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error deleting grade tariff:', error);
        throw error;
    }
}

// Moisture Rule API Functions
export async function getMoistureRules(gradeId?: string, supplierId?: string): Promise<MoistureRule[]> {
    try {
        const url = new URL(`${API_BASE_URL}/api/rules/moisture`);
        if (gradeId) url.searchParams.set('gradeId', gradeId);
        if (supplierId) url.searchParams.set('supplierId', supplierId);

        const response = await fetch(url.toString(), {
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch moisture rules: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<MoistureRule[]>(json);
    } catch (error) {
        console.error('Error fetching moisture rules:', error);
        throw error;
    }
}

export async function deleteMoistureRule(id: string): Promise<void> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/rules/moisture/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to delete moisture rule: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error deleting moisture rule:', error);
        throw error;
    }
}

// Pecah Bon Preset API Functions
export async function getPecahBonPresets(): Promise<PecahBonPreset[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/rules/pecah-bon-presets`, {
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch pecah bon presets: ${response.statusText}`);
        }

        const json = await response.json();
        return unwrap<PecahBonPreset[]>(json);
    } catch (error) {
        console.error('Error fetching pecah bon presets:', error);
        throw error;
    }
}

export async function deletePecahBonPreset(id: string): Promise<void> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/rules/pecah-bon-presets/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders({ json: false }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to delete pecah bon preset: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error deleting pecah bon preset:', error);
        throw error;
    }
}
