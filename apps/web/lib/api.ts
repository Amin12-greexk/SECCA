// API Configuration
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://192.168.11.246:3001";

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
  mergedIntoRawBatchId?: string | null;
  mergedAt?: string | null;
  isMergedSource?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RawBatchUpdateRequest {
  batchNumber?: string;
  supplierId?: string;
  featherCondition?: string;
  invoiceWeightGram?: number;
  wetWeightGram?: number;
  moisturePercent?: number;
  notes?: string;
  updateExistingEntries?: boolean;
}

export interface ProductionRoom {
  id: string;
  code: string;
  name: string;
  type: "FACTORY" | "MINIPLANT";
  createdAt: string;
  updatedAt: string;
  _count?: {
    workers: number;
    lots: number;
    rackLocations: number;
  };
}

export interface RackLocation {
  id: string;
  code: string;
  name: string;
  type: string;
  workerId?: string | null;
  productionRoomId?: string | null;
  productionRoom?: ProductionRoom | null;
  worker?: { id: string; name: string; code?: string | null } | null;
  _count?: { lots: number };
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
  printedAt?: string | null;
  grade?: Grade;
  featherGrade?: Grade | null;
  colorGrade?: Grade | null;
  workItem?: {
    id: string;
    status: string;
    lane: WorkLane;
    workOrder: {
      id: string;
      workerId: string;
      worker?: {
        id: string;
        name: string;
        code?: string | null;
      } | null;
    };
  } | null;
  location?: RackLocation;
  createdAt: string;
  updatedAt: string;
}

export interface RackLotsPaginatedResponse {
  location: RackLocation;
  lots: ProductionLot[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  totalWetWeightGram: number;
}

export interface PecahBonRequest {
  trainerOrderRequestId?: string;
  mitraOrderRequestId?: string;
  gradeId: string;
  featherGradeId: string;
  colorGradeId: string;
  pecahBonDate: string;
  featherCondition: string;
  pieceCount: number;
  initialWeightGram: number;
  moisturePercent: number;
  orderedForName?: string;
  productionRoomId?: string;
}

export interface PecahBonUpdateRequest {
  gradeId: string;
  featherGradeId: string;
  colorGradeId: string;
  featherCondition: string;
  pieceCount: number;
  initialWeightGram: number;
  moisturePercent: number;
  /** Tanggal pecah bon baru (YYYY-MM-DD, hari kalender WIB); kosong = tidak diubah. */
  pecahBonDate?: string;
  /** Kalau tanggal diubah: ikut menggeser LP lain di kartu induk & hari lama yang sama. */
  applyToSiblings?: boolean;
}

export interface PecahBonEntry {
  id: string;
  pecahBonId?: string | null;
  rawBatchId: string;
  gradeId: string;
  featherGradeId?: string | null;
  colorGradeId?: string | null;
  orderedByName?: string | null;
  orderedForName?: string | null;
  pecahBonDate: string;
  featherCondition: string;
  pieceCount: number;
  initialWeightGram: number;
  moisturePercent: number;
  dryWeightGram: number;
  grade?: Grade;
  featherGrade?: Grade | null;
  colorGrade?: Grade | null;
  rawBatch?: RawBatch;
  createdAt: string;
  updatedAt: string;
  /** Tanggal setoran (FinishReceipt.returnedAt) — null berarti LP ini belum disetor. */
  submittedAt?: string | null;
  /** Hanya ada di respons edit: LP lain yang ikut bergeser tanggalnya. */
  shiftedSiblings?: Array<{ id: string; pecahBonDate: string }>;
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

export interface BarangJadi {
  id: string;
  name: string;
  byProducts: ByProductType[];
  resultGrades: ResultGradeType[];
  createdAt: string;
  updatedAt: string;
}

export interface ByProductType {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResultGradeType {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

function isEntityId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sanitizeIdArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .filter((value): value is string => isEntityId(value))
        .map((value) => value.trim()),
    ),
  );
}

function normalizeByProductType(payload: unknown): ByProductType | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const nested = (payload as { byProductType?: unknown }).byProductType;
  if (nested) {
    return normalizeByProductType(nested);
  }

  const row = payload as Partial<ByProductType>;
  if (!isEntityId(row.id) || typeof row.name !== "string") {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  };
}

function normalizeBarangJadi(payload: unknown): BarangJadi | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const row = payload as Partial<BarangJadi> & {
    byProducts?: unknown[];
    resultGrades?: unknown[];
  };
  if (!isEntityId(row.id) || typeof row.name !== "string") {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    byProducts: Array.isArray(row.byProducts)
      ? row.byProducts
          .map((item) => normalizeByProductType(item))
          .filter((item): item is ByProductType => item !== null)
      : [],
    resultGrades: Array.isArray(row.resultGrades)
      ? row.resultGrades
          .map((item) => normalizeResultGradeType(item))
          .filter((item): item is ResultGradeType => item !== null)
      : [],
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  };
}

function normalizeResultGradeType(payload: unknown): ResultGradeType | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const nested = (payload as { resultGradeType?: unknown }).resultGradeType;
  if (nested) {
    return normalizeResultGradeType(nested);
  }

  const row = payload as Partial<ResultGradeType>;
  if (!isEntityId(row.id) || typeof row.name !== "string") {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  };
}

function normalizeUser(payload: unknown): User | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const row = payload as Partial<User> & { uiAccesses?: unknown[] };
  if (
    !isEntityId(row.id) ||
    typeof row.name !== "string" ||
    typeof row.email !== "string" ||
    typeof row.role !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role.toLowerCase(),
    workerId:
      typeof row.workerId === "string" || row.workerId === null
        ? row.workerId
        : undefined,
    phone:
      typeof row.phone === "string" || row.phone === null
        ? row.phone
        : undefined,
    pin: typeof row.pin === "string" || row.pin === null ? row.pin : undefined,
    useCustomUiAccess:
      typeof row.useCustomUiAccess === "boolean"
        ? row.useCustomUiAccess
        : false,
    readOnly: row.readOnly === true,
    uiAccesses: Array.isArray(row.uiAccesses)
      ? row.uiAccesses
          .filter((item) => !!item && typeof item === "object")
          .map((item) => ({
            moduleKey:
              typeof (item as { moduleKey?: unknown }).moduleKey === "string"
                ? (item as { moduleKey: string }).moduleKey
                : "",
            level:
              typeof (item as { level?: unknown }).level === "number"
                ? (item as { level: number }).level
                : 0,
          }))
          .filter((item) => item.moduleKey.length > 0 && item.level > 0)
      : [],
  };
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
    phone?: string | null;
    pin?: string | null;
    role: string;
    workerId?: string | null;
  };
  token: string;
}

export interface RegisterMitraRequest {
  pinKaryawan: string;
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  pin?: string | null;
  role: string;
  workerId?: string | null;
  productionRoomId?: string | null;
  productionRoom?: ProductionRoom | null;
  useCustomUiAccess?: boolean;
  readOnly?: boolean;
  uiAccesses?: Array<{
    moduleKey: string;
    level: number;
  }>;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: string;
  workerId?: string | null;
  productionRoomId?: string | null;
  useCustomUiAccess?: boolean;
  readOnly?: boolean;
  uiAccesses?: Array<{
    moduleKey: string;
    level: number;
  }>;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: string;
  password?: string;
  workerId?: string | null;
  productionRoomId?: string | null;
  useCustomUiAccess?: boolean;
  readOnly?: boolean;
  uiAccesses?: Array<{
    moduleKey: string;
    level: number;
  }>;
}

export interface Worker {
  id: string;
  name: string;
  isMiniplant?: boolean;
  code?: string | null;
  pin?: string | null;
  capacityGram?: number | null;
  trainerId?: string | null;
  trainer?: {
    id: string;
    name: string;
  } | null;
  productionRoomId?: string | null;
  productionRoom?: ProductionRoom | null;
  rackLocation?: RackLocation | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrainerWorkerOrderCandidate extends Worker {
  hasActiveWorkOrder: boolean;
  capacityStats?: {
    monthlyDryInGram: number;
    currentWeekDryInGram: number;
    avgWeeklyDryInGram: number;
    weeksWithSetoran: number;
  };
  activeWorkOrder?: {
    id: string;
    status: string;
    linkedAt: string;
  } | null;
  pendingOrderCount: number;
  pendingOrder?: {
    id: string;
    status: MitraOrderRequestStatus;
    requestedGram: number;
    createdAt: string;
    requestedBy: {
      id: string;
      name: string;
      role: MitraOrderRequesterRole;
    };
  } | null;
  trainerOrder?: {
    status: Extract<MitraOrderRequestStatus, "APPROVED" | "FULFILLED">;
    createdAt: string;
    orderedGram: number;
    assignedLots: Array<{
      lpNumber: string;
    }>;
  } | null;
  isOrderEligible: boolean;
}

export interface WorkerWeeklyStat {
  weekStart: string;
  weekEnd: string;
  totalDryInGram: number;
  totalMainOutGram: number;
  totalByProductGram: number;
  totalAmountRp: number;
  items: number;
}

export interface WorkerWeeklyStatsResponse {
  worker: Worker;
  weeks: WorkerWeeklyStat[];
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RawBatchPageQuery {
  page?: number;
  limit?: number;
  activeOnly?: boolean;
}

export interface PecahBonEntryPageQuery {
  page?: number;
  limit?: number;
}

export interface PecahBonHistoryQuery {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  search?: string;
  order?: "asc" | "desc";
  /** "yes" = cuma yang sudah disetor, "no" = cuma yang belum disetor. */
  submitted?: "all" | "yes" | "no";
}

export type WorkLane = "NEXT_DAY" | "IN_PROGRESS" | "READY_TO_SUBMIT";

export interface WorkOrderBoardItem {
  id: string;
  lotNumber: string;
  lane: WorkLane;
  status: string;
  processState?:
    "NEXT_DAY" | "IN_PROGRESS" | "DRYING" | "DRYING_QC" | "READY_TO_SUBMIT";
  dryingStartedAt?: string | null;
  dryingReadyAt?: string | null;
  grade?: {
    shape?: string | null;
    feather?: string | null;
    color?: string | null;
  };
  location?: {
    code: string;
    name: string;
  } | null;
}

export interface MitraWorkCard {
  id: string;
  lpNumber: string;
  internalLotNumber: string;
  orderDate: string | null;
  workDate: string;
  pecahBonDate: string | null;
  pencabutanStartedAt: string | null;
  stockId: string | null;
  workerId: string;
  workerName: string;
  location: {
    code: string;
    name: string;
  };
  weightGram: number;
  dryWeightGram: number;
  grade: {
    shape?: string | null;
    feather?: string | null;
    color?: string | null;
  };
  lane: WorkLane;
  flowState: "NEXT_DAY" | "IN_PROGRESS" | "READY_TO_SUBMIT";
  dryingReadyAt?: string | null;
  attentionLevel: "NORMAL" | "YELLOW" | "RED";
  ageDays: number;
  /** WorkOrder induk kartu ini. Wajib (bukan opsional) supaya pemanggil tidak
   * diam-diam jatuh ke `card.id` — itu id WorkOrderItem, dan mengirimnya ke
   * endpoint work-orders/:id/cancel bikin 404 "Work order not found". */
  workOrderId: string;
}

export interface WorkOrderBoard {
  workerId: string;
  activeWorkOrder: { id: string; status: string } | null;
  cards: MitraWorkCard[];
  lanes: {
    NEXT_DAY: WorkOrderBoardItem[];
    IN_PROGRESS: WorkOrderBoardItem[];
    READY_TO_SUBMIT: WorkOrderBoardItem[];
  };
  counts: {
    NEXT_DAY: number;
    IN_PROGRESS: number;
    READY_TO_SUBMIT: number;
  };
}

export interface MitraAttendanceRecord {
  date: string | null;
  checkIn: string | null;
  checkOut: string | null;
  status: string | null;
  note: string | null;
  raw: Record<string, unknown>;
}

export interface MitraAttendanceResponse {
  workerId: string;
  pin: string;
  range: {
    from: string | null;
    to: string | null;
  };
  summary: {
    totalRecords: number;
    presentDays: number;
    absentDays: number;
    estimatedPremiumBaseDays: number;
  };
  items: MitraAttendanceRecord[];
}

export type MitraOrderRequestStatus =
  "REQUESTED" | "APPROVED" | "REJECTED" | "FULFILLED";
export type MitraOrderRequesterRole =
  "MITRA" | "TRAINER" | "BAKU" | "MANAGER" | "KOREKSI";

export interface MitraOrderRequest {
  id: string;
  workerId: string | null;
  requestedByUserId: string;
  requestedGram: number;
  note?: string | null;
  status: MitraOrderRequestStatus;
  rejectionReason?: string | null;
  processedByUserId?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lines?: Array<{
    id: string;
    sequence: number;
    weightGram: number;
    lpCount: number;
  }>;
  worker?: {
    id: string;
    name: string;
    code?: string | null;
    capacityGram?: number | null;
    trainerId?: string | null;
    productionRoomId?: string | null;
    productionRoom?: ProductionRoom | null;
    trainer?: {
      productionRoomId?: string | null;
    } | null;
  };
  requestedBy?: {
    id: string;
    name: string;
    role: MitraOrderRequesterRole;
    productionRoomId?: string | null;
    productionRoom?: ProductionRoom | null;
  };
  processedBy?: {
    id: string;
    name: string;
    role: MitraOrderRequesterRole;
  } | null;
}

export interface CreateMitraOrderRequest {
  workerId?: string;
  requestedGram?: number;
  lines?: Array<{
    weightGram: number;
    lpCount: number;
  }>;
  note?: string;
}

export interface CreateTrainerBulkOrderRequest {
  assignments: Array<{
    workerId: string;
    weightGram: number;
    lpCount: number;
  }>;
  note?: string;
  createIndividualRequests?: boolean;
}

export interface CreateTrainerBulkOrderResponse {
  aggregateRequest: MitraOrderRequest;
  workerRequests: MitraOrderRequest[];
  summary: {
    workerCount: number;
    totalRequestedGram: number;
    totalLp: number;
  };
}

type ApiResponse<T> = {
  data: T;
  meta?: { timestamp: string };
};

function unwrap<T>(payload: ApiResponse<T> | T): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in (payload as ApiResponse<T>)
  ) {
    return (payload as ApiResponse<T>).data;
  }

  return payload as T;
}

// Helper: Get auth headers
function getAuthHeaders(
  options: { json?: boolean } = { json: true },
): HeadersInit {
  const token =
    typeof window !== "undefined"
      ? (localStorage.getItem("token") ?? sessionStorage.getItem("token"))
      : null;
  const headers: Record<string, string> = {};

  if (options.json !== false) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function buildQueryString(
  params: Record<string, string | number | boolean | undefined>,
) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

// Auth API Functions
export async function login(data: LoginRequest): Promise<LoginResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Login gagal");
    }

    const json = await response.json();
    const payload = unwrap<{ user: unknown; token: string }>(json);
    const user = normalizeUser(payload.user);
    if (!user) {
      throw new Error("Response login tidak valid");
    }
    return {
      token: payload.token,
      user,
    };
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
}

export async function registerMitra(
  data: RegisterMitraRequest,
): Promise<LoginResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register/mitra`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(message || "Pendaftaran mitra gagal");
    }

    const json = await response.json();
    const payload = unwrap<{ user: unknown; token: string }>(json);
    const user = normalizeUser(payload.user);
    if (!user) {
      throw new Error("Response registrasi tidak valid");
    }
    return {
      token: payload.token,
      user,
    };
  } catch (error) {
    console.error("Error registering mitra:", error);
    throw error;
  }
}

export async function changePassword(
  data: ChangePasswordRequest,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(message || "Gagal mengubah password");
    }

    const json = await response.json();
    return unwrap<{ ok: boolean; message?: string }>(json);
  } catch (error) {
    console.error("Error changing password:", error);
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      console.warn("Logout request failed, but clearing local session anyway");
    }
  } catch (error) {
    console.error("Error logging out:", error);
    // Continue with local logout even if API fails
  }
}

export async function getProfile(): Promise<User> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch profile");
    }

    const json = await response.json();
    const user = normalizeUser(unwrap<unknown>(json));
    if (!user) {
      throw new Error("Response user tidak valid");
    }
    return user;
  } catch (error) {
    console.error("Error fetching profile:", error);
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
    return unwrap<unknown[]>(json)
      .map((item) => normalizeUser(item))
      .filter((item): item is User => item !== null);
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

export async function createUser(data: CreateUserRequest): Promise<User> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to create user: ${response.statusText}`,
      );
    }

    const json = await response.json();
    const user = normalizeUser(unwrap<unknown>(json));
    if (!user) {
      throw new Error("Response user tidak valid");
    }
    return user;
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

export async function updateUser(
  userId: string,
  data: UpdateUserRequest,
): Promise<User> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to update user: ${response.statusText}`,
      );
    }

    const json = await response.json();
    const user = normalizeUser(unwrap<unknown>(json));
    if (!user) {
      throw new Error("Response user tidak valid");
    }
    return user;
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

export async function getWorkers(): Promise<Worker[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/workers`, {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch workers: ${response.statusText}`);
    }

    const json = await response.json();
    return unwrap<Worker[]>(json);
  } catch (error) {
    console.error("Error fetching workers:", error);
    throw error;
  }
}

export async function createWorker(data: {
  name: string;
  code?: string;
  pin?: string;
  capacityGram?: number | null;
  trainerId?: string | null;
}): Promise<Worker> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/workers`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to create worker: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<Worker>(json);
  } catch (error) {
    console.error("Error creating worker:", error);
    throw error;
  }
}

export async function updateWorker(
  workerId: string,
  data: {
    name?: string;
    code?: string | null;
    pin?: string | null;
    capacityGram?: number | null;
    trainerId?: string | null;
  },
): Promise<Worker> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/workers/${workerId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to update worker: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<Worker>(json);
  } catch (error) {
    console.error("Error updating worker:", error);
    throw error;
  }
}

export async function getWorkerWeeklyStats(
  workerId: string,
  weeks = 6,
): Promise<WorkerWeeklyStatsResponse> {
  try {
    const url = new URL(`${API_BASE_URL}/api/workers/${workerId}/weekly-stats`);
    if (weeks) {
      url.searchParams.set("weeks", String(weeks));
    }
    const response = await fetch(url.toString(), {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to fetch stats: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<WorkerWeeklyStatsResponse>(json);
  } catch (error) {
    console.error("Error fetching weekly stats:", error);
    throw error;
  }
}

export async function createWorkOrder(data: {
  workerId: string;
  lotNumbers: string[];
  lane?: WorkLane;
}): Promise<{
  workOrderId: string;
  status: string;
  lane?: WorkLane;
  items: Array<{ workOrderItemId: string; lotNumber: string; lane: WorkLane }>;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/work-orders`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to create work order: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap(json);
  } catch (error) {
    console.error("Error creating work order:", error);
    throw error;
  }
}

export async function getWorkOrderBoard(
  workerId?: string,
  trainerId?: string,
): Promise<WorkOrderBoard> {
  try {
    const url = new URL(`${API_BASE_URL}/api/work-orders/board`);
    if (workerId) url.searchParams.set("workerId", workerId);
    if (trainerId) url.searchParams.set("trainerId", trainerId);
    const response = await fetch(url.toString(), {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to fetch board: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<WorkOrderBoard>(json);
  } catch (error) {
    console.error("Error fetching work order board:", error);
    throw error;
  }
}

export async function cancelWorkOrder(
  workOrderId: string,
  data?: { reassignToWorkerId?: string },
) {
  const res = await fetch(`${API_BASE_URL}/api/work-orders/${workOrderId}/cancel`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data ?? {}),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to cancel work order: ${res.statusText}`,
    );
  }
  const json = await res.json();
  return json.data ?? json;
}

export async function getMyAttendance(params?: {
  from?: string;
  to?: string;
}): Promise<MitraAttendanceResponse> {
  try {
    const query = buildQueryString({
      from: params?.from,
      to: params?.to,
    });
    const response = await fetch(`${API_BASE_URL}/api/attendance/me${query}`, {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to fetch attendance: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<MitraAttendanceResponse>(json);
  } catch (error) {
    console.error("Error fetching attendance:", error);
    throw error;
  }
}

export async function createWorkOrderFromMitraOrder(data: {
  workerId: string;
  lotIds: string[];
}): Promise<{
  workOrderId: string;
  status: string;
  lane?: WorkLane;
  items: Array<{ workOrderItemId: string; lotNumber: string; lane: WorkLane }>;
}> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/work-orders/assign-from-mitra-order`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to assign lots: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap(json);
  } catch (error) {
    console.error("Error assigning lots from mitra order rack:", error);
    throw error;
  }
}

export async function startWorkItem(itemId: string) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/work-items/${itemId}/start`,
      {
        method: "POST",
        headers: getAuthHeaders({ json: false }),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to start item: ${response.statusText}`,
      );
    }
    const json = await response.json();
    return unwrap(json);
  } catch (error) {
    console.error("Error starting work item:", error);
    throw error;
  }
}

export async function markWorkItemReady(itemId: string) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/work-items/${itemId}/mark-ready`,
      {
        method: "POST",
        headers: getAuthHeaders({ json: false }),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to mark ready: ${response.statusText}`,
      );
    }
    const json = await response.json();
    return unwrap(json);
  } catch (error) {
    console.error("Error marking work item ready:", error);
    throw error;
  }
}

export async function cancelWorkItem(itemId: string) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/work-items/${itemId}/cancel`,
      {
        method: "POST",
        headers: getAuthHeaders({ json: false }),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to cancel item: ${response.statusText}`,
      );
    }
    const json = await response.json();
    return unwrap(json);
  } catch (error) {
    console.error("Error canceling work item:", error);
    throw error;
  }
}

export async function createMitraOrderRequest(
  data: CreateMitraOrderRequest,
): Promise<MitraOrderRequest> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mitra-orders/requests`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to create request: ${response.statusText}`,
      );
    }
    const json = await response.json();
    return unwrap<MitraOrderRequest>(json);
  } catch (error) {
    console.error("Error creating mitra order request:", error);
    throw error;
  }
}
export async function cancelMitraOrderRequest(id: string): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/mitra-orders/requests/${id}`,
      {
        method: "DELETE",
        headers: getAuthHeaders({ json: false }),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData?.message ||
          `Failed to cancel request: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error canceling mitra order request:", error);
    throw error;
  }
}

export async function updateMitraOrderRequest(
  id: string,
  data: { requestedGram: number; lpCount?: number; note?: string },
): Promise<MitraOrderRequest> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/mitra-orders/requests/${id}`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to update request: ${response.statusText}`,
      );
    }
    const json = await response.json();
    return unwrap<MitraOrderRequest>(json);
  } catch (error) {
    console.error("Error updating mitra order request:", error);
    throw error;
  }
}

export async function createTrainerBulkOrderRequest(
  data: CreateTrainerBulkOrderRequest,
): Promise<CreateTrainerBulkOrderResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/mitra-orders/requests/trainer-bulk`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to create bulk request: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<CreateTrainerBulkOrderResponse>(json);
  } catch (error) {
    console.error("Error creating trainer bulk order request:", error);
    throw error;
  }
}

export async function getTrainerOrderWorkers(params?: {
  trainerId?: string;
  includeUnassigned?: boolean;
}): Promise<TrainerWorkerOrderCandidate[]> {
  try {
    const url = new URL(`${API_BASE_URL}/api/mitra-orders/trainer/workers`);
    if (params?.trainerId) url.searchParams.set("trainerId", params.trainerId);
    if (params?.includeUnassigned)
      url.searchParams.set("includeUnassigned", "true");

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to fetch trainer workers: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<TrainerWorkerOrderCandidate[]>(json);
  } catch (error) {
    console.error("Error fetching trainer order workers:", error);
    throw error;
  }
}

export async function getMitraOrderRequests(params?: {
  workerId?: string;
  status?: MitraOrderRequestStatus;
  requestedByRole?: MitraOrderRequesterRole;
  aggregateOnly?: boolean;
  limit?: number;
}): Promise<MitraOrderRequest[]> {
  try {
    const url = new URL(`${API_BASE_URL}/api/mitra-orders/requests`);
    if (params?.workerId) url.searchParams.set("workerId", params.workerId);
    if (params?.status) url.searchParams.set("status", params.status);
    if (params?.requestedByRole)
      url.searchParams.set("requestedByRole", params.requestedByRole);
    if (params?.aggregateOnly) url.searchParams.set("aggregateOnly", "true");
    if (params?.limit) url.searchParams.set("limit", String(params.limit));

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders({ json: false }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to fetch requests: ${response.statusText}`,
      );
    }
    const json = await response.json();
    return unwrap<MitraOrderRequest[]>(json);
  } catch (error) {
    console.error("Error fetching mitra order requests:", error);
    throw error;
  }
}

export async function getMitraOrderRequestById(
  requestId: string,
): Promise<MitraOrderRequest> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/mitra-orders/requests/${requestId}`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to fetch request: ${response.statusText}`,
      );
    }
    const json = await response.json();
    return unwrap<MitraOrderRequest>(json);
  } catch (error) {
    console.error("Error fetching mitra order request by id:", error);
    throw error;
  }
}

export async function approveMitraOrderRequest(
  requestId: string,
): Promise<MitraOrderRequest> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/mitra-orders/requests/${requestId}/approve`,
      {
        method: "POST",
        headers: getAuthHeaders({ json: false }),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to approve request: ${response.statusText}`,
      );
    }
    const json = await response.json();
    return unwrap<MitraOrderRequest>(json);
  } catch (error) {
    console.error("Error approving mitra request:", error);
    throw error;
  }
}

export async function rejectMitraOrderRequest(
  requestId: string,
  reason?: string,
): Promise<MitraOrderRequest> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/mitra-orders/requests/${requestId}/reject`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason }),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to reject request: ${response.statusText}`,
      );
    }
    const json = await response.json();
    return unwrap<MitraOrderRequest>(json);
  } catch (error) {
    console.error("Error rejecting mitra request:", error);
    throw error;
  }
}

export async function fulfillMitraOrderRequest(
  requestId: string,
): Promise<MitraOrderRequest> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/mitra-orders/requests/${requestId}/fulfill`,
      {
        method: "POST",
        headers: getAuthHeaders({ json: false }),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to fulfill request: ${response.statusText}`,
      );
    }
    const json = await response.json();
    return unwrap<MitraOrderRequest>(json);
  } catch (error) {
    console.error("Error fulfilling mitra request:", error);
    throw error;
  }
}

export async function assignMitraOrderRequestWorker(
  requestId: string,
  workerId: string,
): Promise<MitraOrderRequest> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/mitra-orders/requests/${requestId}/assign-worker`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ workerId }),
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to assign worker: ${response.statusText}`,
      );
    }
    const json = await response.json();
    return unwrap<MitraOrderRequest>(json);
  } catch (error) {
    console.error("Error assigning worker for request:", error);
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
    console.error("Error fetching suppliers:", error);
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
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to create supplier: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<Supplier>(json);
  } catch (error) {
    console.error("Error creating supplier:", error);
    throw error;
  }
}

export async function updateSupplier(
  supplierId: string,
  data: {
    name?: string;
    code?: string | null;
    phone?: string | null;
  },
): Promise<Supplier> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/suppliers/${supplierId}`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to update supplier: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<Supplier>(json);
  } catch (error) {
    console.error("Error updating supplier:", error);
    throw error;
  }
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/suppliers/${supplierId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to delete supplier: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error deleting supplier:", error);
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
    console.error("Error fetching grades:", error);
    throw error;
  }
}

export async function createGrade(data: {
  name: string;
  code: string;
  type: string;
}): Promise<Grade> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/grades`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to create grade: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<Grade>(json);
  } catch (error) {
    console.error("Error creating grade:", error);
    throw error;
  }
}

export async function updateGrade(
  gradeId: string,
  data: { name?: string; code?: string; type?: string },
): Promise<Grade> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to update grade: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<Grade>(json);
  } catch (error) {
    console.error("Error updating grade:", error);
    throw error;
  }
}

export async function deleteGrade(gradeId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/grades/${gradeId}`, {
      method: "DELETE",
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to delete grade: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error deleting grade:", error);
    throw error;
  }
}

export async function submitBakuReceive(
  data: BakuReceiveRequest,
): Promise<BakuReceiveResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/baku/receive`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to submit: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<BakuReceiveResponse>(json);
  } catch (error) {
    console.error("Error submitting baku receive:", error);
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
    console.error("Error fetching raw batches:", error);
    throw error;
  }
}

export async function getRawBatchesPaginated(
  query: RawBatchPageQuery = {},
): Promise<PaginatedResult<RawBatch>> {
  try {
    const queryString = buildQueryString({
      page: query.page,
      limit: query.limit,
      activeOnly: query.activeOnly,
    });
    const response = await fetch(
      `${API_BASE_URL}/api/baku/paginated${queryString}`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch paginated raw batches: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<PaginatedResult<RawBatch>>(json);
  } catch (error) {
    console.error("Error fetching paginated raw batches:", error);
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
    console.error("Error fetching raw batch:", error);
    throw error;
  }
}

export async function updateRawBatch(
  rawBatchId: string,
  data: RawBatchUpdateRequest,
): Promise<RawBatch> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/baku/raw-batch/${rawBatchId}`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const rawMessage =
        typeof errorData.message === "string"
          ? errorData.message
          : Array.isArray(errorData.message)
            ? errorData.message.join(" ")
            : "";
      throw new Error(
        rawMessage || `Gagal memperbarui batch: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<RawBatch>(json);
  } catch (error) {
    console.error("Error updating raw batch:", error);
    throw error;
  }
}

export async function deleteRawBatch(rawBatchId: string): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/baku/raw-batch/${rawBatchId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Gagal menghapus batch: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error deleting raw batch:", error);
    throw error;
  }
}

export async function mergeRawBatches(data: {
  sourceRawBatchIds: string[];
  supplierId: string;
  featherCondition: string;
  moisturePercent: number;
  notes?: string;
  confirmSupplier: boolean;
  confirmFeatherCondition: boolean;
  confirmMoisturePercent: boolean;
  confirmMerge: boolean;
}): Promise<RawBatch> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/baku/raw-batch/merge`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const rawMessage =
        typeof errorData.message === "string"
          ? errorData.message
          : Array.isArray(errorData.message)
            ? errorData.message.join(" ")
            : "";
      throw new Error(
        rawMessage || `Gagal menggabungkan kartu: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<RawBatch>(json);
  } catch (error) {
    console.error("Error merging raw batches:", error);
    throw error;
  }
}

export async function createPecahBon(
  rawBatchId: string,
  data: PecahBonRequest,
): Promise<PecahBonEntry> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/baku/${rawBatchId}/pecah-bon`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const rawMessages = Array.isArray(errorData.message)
        ? errorData.message
        : errorData.message
          ? [errorData.message]
          : [];

      const friendlyMessages = rawMessages.map((message: string) => {
        if (message.includes("gradeId")) return "Bentuk wajib dipilih.";
        if (message.includes("featherGradeId"))
          return "Grade bulu wajib dipilih.";
        if (message.includes("colorGradeId"))
          return "Grade warna wajib dipilih.";
        if (message.includes("pieceCount"))
          return "Jumlah keping wajib diisi (minimal 1).";
        if (message.includes("initialWeightGram"))
          return "Berat wajib diisi (lebih dari 0).";
        if (message.includes("moisturePercent"))
          return "Kadar air wajib diisi (0 - 100).";
        if (message.includes("featherCondition"))
          return "Kondisi baku wajib diisi.";
        if (message.includes("pecahBonDate"))
          return "Tanggal pecah bon tidak valid.";
        if (message.includes("Sisa batch berada di rentang")) return message;
        if (message.includes("Berat lot harus")) return message;
        return message;
      });

      const normalized =
        friendlyMessages.length > 0
          ? Array.from(new Set(friendlyMessages)).join(" ")
          : typeof errorData.message === "string"
            ? errorData.message
            : `Gagal menyimpan pecah bon: ${response.statusText}`;

      throw new Error(normalized);
    }

    const json = await response.json();
    return unwrap<PecahBonEntry>(json);
  } catch (error) {
    console.error("Error creating pecah bon:", error);
    throw error;
  }
}

export async function updatePecahBonEntry(
  entryId: string,
  data: PecahBonUpdateRequest,
): Promise<PecahBonEntry> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/baku/pecah-bon-entry/${entryId}`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const rawMessages = Array.isArray(errorData.message)
        ? errorData.message
        : errorData.message
          ? [errorData.message]
          : [];

      const friendlyMessages = rawMessages.map((message: string) => {
        if (message.includes("gradeId")) return "Bentuk wajib dipilih.";
        if (message.includes("featherGradeId"))
          return "Grade bulu wajib dipilih.";
        if (message.includes("colorGradeId"))
          return "Grade warna wajib dipilih.";
        if (message.includes("pieceCount"))
          return "Jumlah keping wajib diisi (minimal 1).";
        if (message.includes("initialWeightGram"))
          return "Berat wajib diisi (lebih dari 0).";
        if (message.includes("moisturePercent"))
          return "Kadar air wajib diisi (0 - 100).";
        if (message.includes("featherCondition"))
          return "Kondisi baku wajib diisi.";
        return message;
      });

      const normalized =
        friendlyMessages.length > 0
          ? Array.from(new Set(friendlyMessages)).join(" ")
          : typeof errorData.message === "string"
            ? errorData.message
            : `Gagal mengubah pecah bon: ${response.statusText}`;

      throw new Error(normalized);
    }

    const json = await response.json();
    return unwrap<PecahBonEntry>(json);
  } catch (error) {
    console.error("Error updating pecah bon:", error);
    throw error;
  }
}

export async function deletePecahBonEntry(entryId: string): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/baku/pecah-bon/${entryId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Gagal menghapus LP: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error deleting pecah bon entry:", error);
    throw error;
  }
}

export async function markPecahBonPrinted(
  entryId: string,
): Promise<ProductionLot> {
  const response = await fetch(
    `${API_BASE_URL}/api/baku/pecah-bon-entry/${entryId}/printed`,
    {
      method: "POST",
      headers: getAuthHeaders({ json: false }),
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Gagal menandai pecah bon tercetak.");
  }

  const json = await response.json();
  return unwrap<ProductionLot>(json);
}

export async function getPecahBonEntries(
  rawBatchId: string,
): Promise<PecahBonEntry[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/baku/${rawBatchId}/pecah-bon`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch pecah bon entries: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<PecahBonEntry[]>(json);
  } catch (error) {
    console.error("Error fetching pecah bon entries:", error);
    throw error;
  }
}

export async function getPecahBonEntriesPaginated(
  rawBatchId: string,
  query: PecahBonEntryPageQuery = {},
): Promise<PaginatedResult<PecahBonEntry>> {
  try {
    const queryString = buildQueryString({
      page: query.page,
      limit: query.limit,
    });
    const response = await fetch(
      `${API_BASE_URL}/api/baku/${rawBatchId}/pecah-bon/paginated${queryString}`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch paginated pecah bon entries: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<PaginatedResult<PecahBonEntry>>(json);
  } catch (error) {
    console.error("Error fetching paginated pecah bon entries:", error);
    throw error;
  }
}

export async function getPecahBonHistoryPaginated(
  query: PecahBonHistoryQuery = {},
): Promise<PaginatedResult<PecahBonEntry>> {
  try {
    const queryString = buildQueryString({
      page: query.page,
      limit: query.limit,
      from: query.from,
      to: query.to,
      search: query.search,
      order: query.order,
      submitted: query.submitted,
    });
    const response = await fetch(
      `${API_BASE_URL}/api/baku/pecah-bon/history${queryString}`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to fetch koreksi history: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<PaginatedResult<PecahBonEntry>>(json);
  } catch (error) {
    console.error("Error fetching pecah bon history:", error);
    throw error;
  }
}

export async function getPecahBonById(
  pecahBonId: string,
): Promise<PecahBonEntry> {
  try {
    const safeId = encodeURIComponent(pecahBonId.trim());
    const response = await fetch(
      `${API_BASE_URL}/api/baku/pecah-bon/${safeId}`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("LP tidak ditemukan.");
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Gagal memuat pecah bon: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<PecahBonEntry>(json);
  } catch (error) {
    console.error("Error fetching pecah bon by id:", error);
    throw error;
  }
}

export async function getRackLotsByCode(code: string): Promise<{
  location: RackLocation;
  lots: ProductionLot[];
}> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/locations/code/${code}/lots`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch rack lots: ${response.statusText}`);
    }

    const json = await response.json();
    return unwrap<{ location: RackLocation; lots: ProductionLot[] }>(json);
  } catch (error) {
    console.error("Error fetching rack lots:", error);
    throw error;
  }
}

export async function getRackLotsByCodePaginated(
  code: string,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    gradeId?: string;
    printed?: "all" | "printed" | "unprinted";
  },
): Promise<RackLotsPaginatedResponse> {
  try {
    const url = new URL(
      `${API_BASE_URL}/api/locations/code/${code}/lots/paginated`,
    );
    if (params?.page) url.searchParams.set("page", String(params.page));
    if (params?.limit) url.searchParams.set("limit", String(params.limit));
    if (params?.search) url.searchParams.set("search", params.search);
    if (params?.gradeId) url.searchParams.set("gradeId", params.gradeId);
    if (params?.printed) url.searchParams.set("printed", params.printed);

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to fetch paginated rack lots: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<RackLotsPaginatedResponse>(json);
  } catch (error) {
    console.error("Error fetching paginated rack lots:", error);
    throw error;
  }
}

export async function moveLot(
  lotId: string,
  toLocationCode: string,
): Promise<ProductionLot> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/lots/${lotId}/move`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ toLocationCode }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to move lot: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<ProductionLot>(json);
  } catch (error) {
    console.error("Error moving lot:", error);
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
    if (params?.shapeGradeId)
      url.searchParams.set("shapeGradeId", params.shapeGradeId);
    if (params?.featherGradeId)
      url.searchParams.set("featherGradeId", params.featherGradeId);
    if (params?.colorGradeId)
      url.searchParams.set("colorGradeId", params.colorGradeId);

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch grade tariffs: ${response.statusText}`);
    }

    const json = await response.json();
    return unwrap<GradeTariff[]>(json);
  } catch (error) {
    console.error("Error fetching grade tariffs:", error);
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
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to create grade tariff: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<GradeTariff>(json);
  } catch (error) {
    console.error("Error creating grade tariff:", error);
    throw error;
  }
}

export async function deleteGradeTariff(id: string): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/rules/grade-tariffs/${id}`,
      {
        method: "DELETE",
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to delete grade tariff: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error deleting grade tariff:", error);
    throw error;
  }
}

// Moisture Rule API Functions
export async function getMoistureRules(
  gradeId?: string,
  supplierId?: string,
): Promise<MoistureRule[]> {
  try {
    const url = new URL(`${API_BASE_URL}/api/rules/moisture`);
    if (gradeId) url.searchParams.set("gradeId", gradeId);
    if (supplierId) url.searchParams.set("supplierId", supplierId);

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch moisture rules: ${response.statusText}`);
    }

    const json = await response.json();
    return unwrap<MoistureRule[]>(json);
  } catch (error) {
    console.error("Error fetching moisture rules:", error);
    throw error;
  }
}

export async function deleteMoistureRule(id: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rules/moisture/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to delete moisture rule: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error deleting moisture rule:", error);
    throw error;
  }
}

// Pecah Bon Preset API Functions
export async function getPecahBonPresets(): Promise<PecahBonPreset[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/rules/pecah-bon-presets`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch pecah bon presets: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<PecahBonPreset[]>(json);
  } catch (error) {
    console.error("Error fetching pecah bon presets:", error);
    throw error;
  }
}

export async function deletePecahBonPreset(id: string): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/rules/pecah-bon-presets/${id}`,
      {
        method: "DELETE",
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to delete pecah bon preset: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error deleting pecah bon preset:", error);
    throw error;
  }
}

export async function getBarangJadiList(): Promise<BarangJadi[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/barang-jadi`, {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to fetch barang jadi: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<unknown[]>(json)
      .map((item) => normalizeBarangJadi(item))
      .filter((item): item is BarangJadi => item !== null);
  } catch (error) {
    console.error("Error fetching barang jadi:", error);
    throw error;
  }
}

export async function createBarangJadi(data: {
  name: string;
  byProductTypeIds: string[];
  resultGradeTypeIds: string[];
}): Promise<BarangJadi> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/barang-jadi`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name: data.name,
        byProductTypeIds: sanitizeIdArray(data.byProductTypeIds),
        resultGradeTypeIds: sanitizeIdArray(data.resultGradeTypeIds),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to create barang jadi: ${response.statusText}`,
      );
    }

    const json = await response.json();
    const normalized = normalizeBarangJadi(unwrap<unknown>(json));
    if (!normalized) {
      throw new Error("Response barang jadi tidak valid");
    }
    return normalized;
  } catch (error) {
    console.error("Error creating barang jadi:", error);
    throw error;
  }
}

export async function updateBarangJadi(
  id: string,
  data: {
    name: string;
    byProductTypeIds: string[];
    resultGradeTypeIds: string[];
  },
): Promise<BarangJadi> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/barang-jadi/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: data.name,
          byProductTypeIds: sanitizeIdArray(data.byProductTypeIds),
          resultGradeTypeIds: sanitizeIdArray(data.resultGradeTypeIds),
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to update barang jadi: ${response.statusText}`,
      );
    }

    const json = await response.json();
    const normalized = normalizeBarangJadi(unwrap<unknown>(json));
    if (!normalized) {
      throw new Error("Response barang jadi tidak valid");
    }
    return normalized;
  } catch (error) {
    console.error("Error updating barang jadi:", error);
    throw error;
  }
}

export async function deleteBarangJadi(id: string): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/barang-jadi/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to delete barang jadi: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error deleting barang jadi:", error);
    throw error;
  }
}

export async function getByProductTypes(): Promise<ByProductType[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/barang-jadi/by-products`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to fetch by product types: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<unknown[]>(json)
      .map((item) => normalizeByProductType(item))
      .filter((item): item is ByProductType => item !== null);
  } catch (error) {
    console.error("Error fetching by product types:", error);
    throw error;
  }
}

export async function getResultGradeTypes(): Promise<ResultGradeType[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/barang-jadi/result-grades`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to fetch result grade types: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<unknown[]>(json)
      .map((item) => normalizeResultGradeType(item))
      .filter((item): item is ResultGradeType => item !== null);
  } catch (error) {
    console.error("Error fetching result grade types:", error);
    throw error;
  }
}

export async function createByProductType(data: {
  name: string;
}): Promise<ByProductType> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/barang-jadi/by-products`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to create by product type: ${response.statusText}`,
      );
    }

    const json = await response.json();
    const normalized = normalizeByProductType(unwrap<unknown>(json));
    if (!normalized) {
      throw new Error("Response by product tidak valid");
    }
    return normalized;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.toLowerCase().includes("sudah ada")
    ) {
      console.error("Error creating by product type:", error);
    }
    throw error;
  }
}

export async function updateByProductType(
  id: string,
  data: { name: string },
): Promise<ByProductType> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/barang-jadi/by-products/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to update by product type: ${response.statusText}`,
      );
    }

    const json = await response.json();
    const normalized = normalizeByProductType(unwrap<unknown>(json));
    if (!normalized) {
      throw new Error("Response by product tidak valid");
    }
    return normalized;
  } catch (error) {
    console.error("Error updating by product type:", error);
    throw error;
  }
}

export async function deleteByProductType(id: string): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/barang-jadi/by-products/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to delete by product type: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error deleting by product type:", error);
    throw error;
  }
}

export async function createResultGradeType(data: {
  name: string;
}): Promise<ResultGradeType> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/barang-jadi/result-grades`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to create result grade type: ${response.statusText}`,
      );
    }

    const json = await response.json();
    const normalized = normalizeResultGradeType(unwrap<unknown>(json));
    if (!normalized) {
      throw new Error("Response grade hasil tidak valid");
    }
    return normalized;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.toLowerCase().includes("sudah ada")
    ) {
      console.error("Error creating result grade type:", error);
    }
    throw error;
  }
}

export async function updateResultGradeType(
  id: string,
  data: { name: string },
): Promise<ResultGradeType> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/barang-jadi/result-grades/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to update result grade type: ${response.statusText}`,
      );
    }

    const json = await response.json();
    const normalized = normalizeResultGradeType(unwrap<unknown>(json));
    if (!normalized) {
      throw new Error("Response grade hasil tidak valid");
    }
    return normalized;
  } catch (error) {
    console.error("Error updating result grade type:", error);
    throw error;
  }
}

export async function deleteResultGradeType(id: string): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/barang-jadi/result-grades/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to delete result grade type: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error deleting result grade type:", error);
    throw error;
  }
}

// ─── Manager Analytics API ────────────────────────────────────────

export interface GradeUsageParams {
  from: string;
  to: string;
  groupBy?: "combo" | "shape" | "feather" | "color";
  metric?: "initial" | "dry";
  top?: number;
  productionScope?: string;
}

export interface GradeUsageRow {
  key: string;
  gram: number;
  percentage: number;
  lpCount: number;
}

export interface GradeUsageResponse {
  filters: {
    from: string;
    to: string;
    groupBy: string;
    metric: string;
  };
  totalGram: number;
  rows: GradeUsageRow[];
}

export interface CapacityParams {
  from: string;
  to: string;
  productionScope?: "ALL" | "FACTORY_ONLY" | "MINIPLANT_ONLY";
}

export interface CapacitySummary {
  totalGram: number;
  totalLp: number;
  avgGramPerLp: number;
  workingDays?: number;
}

export interface WorkerPerformanceRow {
  workerId: string;
  workerName: string;
  currentGram: number;
  prevGram: number;
  diffGram: number;
  percentage: number;
}

export interface WorkerPerformanceResponse {
  filters: {
    currentFrom: string;
    currentTo: string;
    prevFrom: string;
    prevTo: string;
  };
  turnover: {
    newActiveCount: number;
    inactiveCount: number;
    totalCurrentActive: number;
    totalPrevActive: number;
  };
  topIncreases: WorkerPerformanceRow[];
  topDecreases: WorkerPerformanceRow[];
}

export interface WeeklySeries {
  weekStart: string;
  weekEnd: string;
  totalGram: number;
  lpCount: number;
  avgGramPerLp: number;
}

export interface BucketRow {
  label: string;
  lpCount: number;
}

export interface ProductionSummary {
  finishReceiptCount: number;
  totalDryIn: number;
  totalMainOut: number;
  totalByProduct: number;
  totalSusutProses: number;
  totalSusutHilang: number;
  rendemenMainPct: number;
  rendemenNetPct: number;
  susutProsesPct: number;
  susutHilangPct: number;
  dailyAvgGramOut: number;
  dailyAvgLpOut: number;
  flowStateCounts: Record<string, number>;
}

export interface CapacityResponse {
  filters: { from: string; to: string };
  summary: CapacitySummary;
  production?: ProductionSummary;
  weekly: WeeklySeries[];
  buckets: BucketRow[];
}

export interface PayrollSummaryParams {
  from?: string;
  to?: string;
  workerId?: string;
}

export interface PayrollSummaryRow {
  workerId: string;
  workerName: string;
  items: number;
  dryInGram: number;
  mainOutWeightGram: number;
  byProductWeightGram: number;
  susutProsesGram: number;
  susutHilangGram: number;
  payrollAmountRp: number;
  rendemenMainPctBps: number;
  rendemenNetPctBps: number;
  susutProsesPctBps: number;
  susutHilangPctBps: number;
}

export interface PayrollSummaryResponse {
  filters: {
    from: string;
    to: string;
    workerId: string | null;
  };
  summary: {
    items: number;
    dryInGram: number;
    mainOutWeightGram: number;
    byProductWeightGram: number;
    susutProsesGram: number;
    susutHilangGram: number;
    payrollAmountRp: number;
    rendemenMainPctBps: number;
    rendemenNetPctBps: number;
    susutProsesPctBps: number;
    susutHilangPctBps: number;
  };
  workers: PayrollSummaryRow[];
}

export async function getManagerGradeUsage(
  params: GradeUsageParams,
): Promise<GradeUsageResponse> {
  try {
    const url = new URL(`${API_BASE_URL}/api/analytics/manager/grade-usage`);
    url.searchParams.set("from", params.from);
    url.searchParams.set("to", params.to);
    if (params.groupBy) url.searchParams.set("groupBy", params.groupBy);
    if (params.metric) url.searchParams.set("metric", params.metric);
    if (params.top) url.searchParams.set("top", String(params.top));
    if (params.productionScope && params.productionScope !== 'ALL') {
      url.searchParams.set("scope", params.productionScope);
    }

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to fetch grade usage: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<GradeUsageResponse>(json);
  } catch (error) {
    console.error("Error fetching grade usage:", error);
    throw error;
  }
}

export async function getManagerCapacity(
  params: CapacityParams,
): Promise<CapacityResponse> {
  try {
    const url = new URL(`${API_BASE_URL}/api/analytics/manager/capacity`);
    url.searchParams.set("from", params.from);
    url.searchParams.set("to", params.to);
    if (params.productionScope && params.productionScope !== 'ALL') {
      url.searchParams.set("scope", params.productionScope);
    }

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to fetch capacity: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<CapacityResponse>(json);
  } catch (error) {
    console.error("Error fetching capacity:", error);
    throw error;
  }
}

export interface RealPerformaWorkerRow {
  workerId: string;
  workerName: string;
  totalBjd: number;
  totalBakuKering: number;
  lpCount: number;
  hk: number;
  dailyGramPerHk: number;
  rendemenPctBps: number;
  capacityBand: string;
  isWarning: boolean;
}

export interface RealPerformaPeriodStat {
  periodId: string;
  periodName: string;
  weekStart: string;
  weekEnd: string;
  totalBjd: number;
  totalBakuKering: number;
  totalByProduct: number;
  totalSusutProses: number;
  totalSusutHilang: number;
  lpCount: number;
  workingDays: number;
  dailyCapacityGram: number;
  dailyCapacityLp: number;
  rendemenPctBps: number;
  rendemenNetPctBps: number;
  susutProsesPctBps: number;
  susutHilangPctBps: number;
}

export interface RealPerformaDailyStat {
  dateStr: string;
  dayName: string;
  totalBjd: number;
  totalBakuKering: number;
  totalByProduct: number;
  totalSusutProses: number;
  totalSusutHilang: number;
  lpCount: number;
  rendemenPctBps: number;
  rendemenNetPctBps: number;
  susutProsesPctBps: number;
  susutHilangPctBps: number;
}

export interface RealPerformaResponse {
  filters: { from: string; to: string };
  summary: {
    totalBjd: number;
    totalBakuKering: number;
    overallRendemenBps: number;
    totalSetoranLp: number;
    totalActiveWorkers: number;
  };
  periodStats: RealPerformaPeriodStat[];
  dailyStats?: RealPerformaDailyStat[];
  workerRows: RealPerformaWorkerRow[];
}

export async function getManagerRealPerforma(
  params: CapacityParams,
): Promise<RealPerformaResponse> {
  try {
    const url = new URL(`${API_BASE_URL}/api/analytics/manager/real-performa`);
    url.searchParams.set("from", params.from);
    url.searchParams.set("to", params.to);
    if (params.productionScope && params.productionScope !== 'ALL') {
      url.searchParams.set("scope", params.productionScope);
    }

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to fetch real performa: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<RealPerformaResponse>(json);
  } catch (error) {
    console.error("Error fetching real performa:", error);
    throw error;
  }
}
export async function getManagerWorkerPerformance(
  params: CapacityParams,
): Promise<WorkerPerformanceResponse> {
  try {
    const url = new URL(
      `${API_BASE_URL}/api/analytics/manager/worker-performance`,
    );
    url.searchParams.set("from", params.from);
    url.searchParams.set("to", params.to);
    if (params.productionScope && params.productionScope !== 'ALL') {
      url.searchParams.set("scope", params.productionScope);
    }

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to fetch worker performance: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<WorkerPerformanceResponse>(json);
  } catch (error) {
    console.error("Error fetching worker performance:", error);
    throw error;
  }
}

export async function getPayrollSummary(
  params: PayrollSummaryParams,
): Promise<PayrollSummaryResponse> {
  try {
    const url = new URL(`${API_BASE_URL}/api/payroll/summary`);
    if (params.from) url.searchParams.set("from", params.from);
    if (params.to) url.searchParams.set("to", params.to);
    if (params.workerId) url.searchParams.set("workerId", params.workerId);

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Failed to fetch payroll summary: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<PayrollSummaryResponse>(json);
  } catch (error) {
    console.error("Error fetching payroll summary:", error);
    throw error;
  }
}

export interface FinishWorkItemLookup {
  workOrderItemId: string;
  workOrderId: string;
  workOrderStatus: string;
  workOrderItemStatus: string;
  lane: string;
  noLp: string;
  lotNumber: string;
  pecahBonId?: string | null;
  workerId: string;
  workerName: string;
  grade: string;
  dryInGram: number;
  wetWeightGram: number;
  moisturePercent: number;
  submittedAt?: string | null;
  flowState:
    | "NEXT_DAY"
    | "IN_PROGRESS"
    | "DRYING"
    | "DRYING_QC"
    | "READY_TO_SUBMIT"
    | "SUBMITTED"
    | "CANCELED";
  dryingStartedAt?: string | null;
  dryingReadyAt?: string | null;
  dryCheckedAt?: string | null;
  dryingRemainingMinutes?: number;
  canSubmit: boolean;
}

export interface FinishSubmitPayload {
  workOrderItemId: string;
  barangJadiId?: string;
  returnedAt: string;
  mainOutWeightGram: number;
  byProductWeightGram: number;
  notes?: string;
  resultGrades?: Array<{
    resultGradeTypeId: string;
    weightGram: number;
  }>;
  targetLocationId?: string;
}

export interface FinishSubmitResponse {
  lotNumber: string;
  barangJadi?: {
    id: string;
    name: string;
  } | null;
  resultGrades: Array<{
    id: string;
    name: string;
    weightGram: number;
  }>;
  dryInGram: number;
  mainOutGram: number;
  byProductGram: number;
  susutProsesGram: number;
  susutHilangGram: number;
  susutProsesPctBps: number;
  susutHilangPctBps: number;
  rendemenMainPctBps: number;
  rendemenNetPctBps: number;
  payroll: {
    baseGram: number;
    byProductCoefficientPercent: number;
    rateRpPerGram: number;
    amountRp: number;
  };
}

export interface FinishReceiptListItem {
  id: string;
  workOrderItemId: string;
  returnedAt: string;
  noLp: string;
  lotNumber: string;
  barangJadi?: {
    id: string;
    name: string;
  } | null;
  resultGrades: Array<{
    id: string;
    name: string;
    weightGram: number;
  }>;
  workerId: string;
  workerName: string;
  workerPin?: string | null;
  grade: string;
  dryInGram: number;
  mainOutWeightGram: number;
  byProductWeightGram: number;
  susutProsesGram: number;
  susutHilangGram: number;
  susutProsesPctBps: number;
  susutHilangPctBps: number;
  notes?: string | null;
  payroll?: {
    id: string;
    rateRpPerGram: number;
    amountRp: number;
  } | null;
}

export interface QueryFinishReceipts {
  page?: number;
  limit?: number;
  search?: string;
  from?: string;
  to?: string;
  order?: "asc" | "desc";
}

export interface UpdateFinishReceiptPayload {
  returnedAt?: string;
  barangJadiId?: string;
  mainOutWeightGram?: number;
  byProductWeightGram?: number;
  notes?: string;
  resultGrades?: Array<{
    resultGradeTypeId: string;
    weightGram: number;
  }>;
}

export interface UpdateFinishReceiptResponse {
  id: string;
  workOrderItemId: string;
  returnedAt: string;
  barangJadi?: {
    id: string;
    name: string;
  } | null;
  resultGrades: Array<{
    id: string;
    name: string;
    weightGram: number;
  }>;
  mainOutWeightGram: number;
  byProductWeightGram: number;
  dryInGram: number;
  susutProsesGram: number;
  susutHilangGram: number;
  susutProsesPctBps: number;
  susutHilangPctBps: number;
  rendemenMainPctBps: number;
  rendemenNetPctBps: number;
  notes?: string | null;
  payroll: {
    baseGram: number;
    byProductCoefficientPercent: number;
    rateRpPerGram: number;
    amountRp: number;
  };
}

export async function getFinishWorkItemByLp(
  lpCode: string,
): Promise<FinishWorkItemLookup> {
  try {
    const safeCode = encodeURIComponent(lpCode.trim());
    const response = await fetch(
      `${API_BASE_URL}/api/finish/work-item/by-lp/${safeCode}`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to fetch work item by LP: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<FinishWorkItemLookup>(json);
  } catch (error) {
    console.error("Error fetching finish work item:", error);
    throw error;
  }
}

export async function submitFinishSetoran(
  payload: FinishSubmitPayload,
): Promise<FinishSubmitResponse> {
  try {
    const resultGrades = Array.isArray(payload.resultGrades)
      ? payload.resultGrades
          .map((item) => ({
            resultGradeTypeId:
              typeof item?.resultGradeTypeId === "string"
                ? item.resultGradeTypeId.trim()
                : "",
            weightGram: Math.max(0, Math.round(Number(item?.weightGram ?? 0))),
          }))
          .filter(
            (item) => item.resultGradeTypeId.length > 0 && item.weightGram > 0,
          )
      : undefined;
    const response = await fetch(`${API_BASE_URL}/api/finish`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...payload,
        resultGrades,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to submit setoran: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<FinishSubmitResponse>(json);
  } catch (error) {
    console.error("Error submitting finish setoran:", error);
    throw error;
  }
}

export async function getFinishReceipts(
  query: QueryFinishReceipts = {},
): Promise<PaginatedResult<FinishReceiptListItem>> {
  try {
    const queryString = buildQueryString({
      page: query.page,
      limit: query.limit,
      search: query.search,
      from: query.from,
      to: query.to,
      order: query.order,
    });
    const response = await fetch(
      `${API_BASE_URL}/api/finish/receipts${queryString}`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to fetch finish receipts: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<PaginatedResult<FinishReceiptListItem>>(json);
  } catch (error) {
    console.error("Error fetching finish receipts:", error);
    throw error;
  }
}

export async function updateFinishReceipt(
  receiptId: string,
  payload: UpdateFinishReceiptPayload,
): Promise<UpdateFinishReceiptResponse> {
  try {
    const resultGrades = Array.isArray(payload.resultGrades)
      ? payload.resultGrades
          .map((item) => ({
            resultGradeTypeId:
              typeof item?.resultGradeTypeId === "string"
                ? item.resultGradeTypeId.trim()
                : "",
            weightGram: Math.max(0, Math.round(Number(item?.weightGram ?? 0))),
          }))
          .filter(
            (item) => item.resultGradeTypeId.length > 0 && item.weightGram > 0,
          )
      : undefined;
    const response = await fetch(
      `${API_BASE_URL}/api/finish/receipts/${encodeURIComponent(receiptId)}`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...payload,
          resultGrades,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to update finish receipt: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<UpdateFinishReceiptResponse>(json);
  } catch (error) {
    console.error("Error updating finish receipt:", error);
    throw error;
  }
}

export async function deleteFinishReceipt(receiptId: string): Promise<{
  id: string;
  workOrderItemId: string;
  restoredToLane: string;
  restoredLocationCode: string;
}> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/finish/receipts/${encodeURIComponent(receiptId)}`,
      {
        method: "DELETE",
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to delete finish receipt: ${response.statusText}`,
      );
    }

    const json = await response.json();
    return unwrap<{
      id: string;
      workOrderItemId: string;
      restoredToLane: string;
      restoredLocationCode: string;
    }>(json);
  } catch (error) {
    console.error("Error deleting finish receipt:", error);
    throw error;
  }
}

export async function completeDryQcWorkItem(
  workOrderItemId: string,
): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/work-items/${encodeURIComponent(workOrderItemId)}/complete-dry-qc`,
      {
        method: "POST",
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = Array.isArray(errorData?.message)
        ? errorData.message.join(" ")
        : errorData?.message;
      throw new Error(
        message || `Failed to complete dry QC: ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("Error completing dry QC:", error);
    throw error;
  }
}

/* ─── Dashboard Performa (data periode dari Excel) ─────────────── */

/** LEGACY_SUMMARY = sheet ringkasan lama; WEEKLY_PAYROLL_DETAIL = format baru (DATA PERIODE + REKAP PAYROLL). */
export type PerformaImportFormat = "LEGACY_SUMMARY" | "WEEKLY_PAYROLL_DETAIL";

export interface PerformaPeriod {
  id: string;
  label: string;
  sheetName: string;
  format: PerformaImportFormat;
  startDate?: string | null;
  endDate?: string | null;
  year?: number | null;
  sortOrder: number;
  totalMetrics: number;
  totalWorkItems: number;
  totalPayrollRows: number;
  createdAt: string;
}

export interface PerformaLpRow {
  lpNumber?: string | null;
  transactionType?: string | null;
  workerNames: string[];
  workerPins?: Array<string | null>;
  pin?: string | null;
  gradeBaku?: string | null;
  totalBakuBasah?: number | null;
  totalBjd?: number | null;
  rendemenPctBps?: number | null;
  tarifBakuPerGramRp?: number | null;
  upahMentahRp?: number | null;
  upahBarangJadiRp?: number | null;
  upahBorongRp?: number | null;
}

/** Baris reprocess/barang-jadi (pola NO. LP "764/5" dsb) — dilacak terpisah dari LP produksi
 * karena tidak punya baku basah baru, jadi tidak ikut Total BJD/Rendemen utama. */
export interface PerformaReprocessRow {
  reprocessId?: string | null;
  totalBjd?: number | null;
  rendemenPctBps?: number | null;
}

export interface PerformaRow {
  id: string;
  personId: string;
  name: string;
  rawName: string;
  colorHex: string;
  hasCustomColor: boolean;
  rawUserLevel?: string | null;
  normalizedLevel?: string | null;
  levelNumber?: number | null;
  hk?: number | null;
  totalBakuBasah?: number | null;
  totalBjd?: number | null;
  rendemenPctBps?: number | null;
  susutProsesPctBps?: number | null;
  susutHilangPctBps?: number | null;
  gradeBaku?: string | null;
  tarifBakuPerGramRp?: number | null;
  upahMentahRp?: number | null;
  upahBarangJadiRp?: number | null;
  upahBorongRp?: number | null;
  pieceworkWageRp?: number | null;
  /** Cuma terisi untuk "CABUT RUMAH" (cabut bulu di rumah, di luar pabrik) —
   * upahBorongRp/subsidyRp untuk kategori ini bukan angka upah/subsidi
   * sungguhan, jadi tarif+jumlahnya dipisah ke sini untuk rincian di modal. */
  cabutRumahRatePerUnitRp?: number | null;
  cabutRumahQty?: number | null;
  effectivePieceworkRatePerGramRp?: number | null;
  effectivePieceworkRatePerKgRp?: number | null;
  subsidyRp?: number | null;
  premiumRp?: number | null;
  mealAllowanceRp?: number | null;
  deductionRp?: number | null;
  netWageRp?: number | null;
  pin?: string | null;
  noLp?: string | null;
  lpCount?: number | null;
  lpRows?: PerformaLpRow[];
  reprocessBjd?: number | null;
  reprocessCount?: number | null;
  reprocessRows?: PerformaReprocessRow[];
}

export interface PerformaPeriodRef {
  id: string;
  label: string;
  sheetName: string;
  format?: PerformaImportFormat;
  startDate?: string | null;
  endDate?: string | null;
  year?: number | null;
}

export interface PerformaSummaryResponse {
  period: PerformaPeriodRef | null;
  summary: {
    totalPeople: number;
    totalHk: number;
    totalBakuBasah: number;
    totalBjd: number;
    /** BJD reprocess (pola LP "764/5" dst) dijumlah semua orang di periode ini. */
    totalReprocessBjd?: number;
    /** totalBjd + totalReprocessBjd — dipakai untuk kartu "Total BJD" di halaman utama.
     * Rendemen tetap pakai totalBjd murni produksi, tidak berubah. */
    totalBjdWithReprocess?: number;
    weightedRendemenPctBps: number | null;
    weightedSusutProsesPctBps: number | null;
    weightedSusutHilangPctBps: number | null;
    averageRendemenPctBps: number | null;
    averageSusutProsesPctBps: number | null;
    averageSusutHilangPctBps: number | null;
  } | null;
  rows: PerformaRow[];
}

/** Baris biaya per mitra: gabungan produksi (workItems) + payroll (PIN), dipakai di panel Payroll & Biaya. */
export interface PerformaExpenseRow {
  personId: string;
  name: string;
  rawName: string;
  pin: string | null;
  rawUserLevel?: string | null;
  normalizedLevel?: string | null;
  levelNumber: number | null;
  colorHex: string;
  hasCustomColor: boolean;
  hk: number | null;
  totalBakuBasah: number | null;
  totalBjd: number | null;
  rendemenPctBps: number | null;
  weightedSp: number | null;
  weightedSh: number | null;
  gradeBaku?: string | null;
  tarifBakuPerGramRp?: number | null;
  upahMentahRp?: number | null;
  upahBarangJadiRp?: number | null;
  upahBorongRp?: number | null;
  pieceworkWageRp: number | null;
  cabutRumahRatePerUnitRp?: number | null;
  cabutRumahQty?: number | null;
  effectivePieceworkRatePerGramRp?: number | null;
  effectivePieceworkRatePerKgRp?: number | null;
  subsidyRp: number | null;
  premiumRp: number | null;
  mealAllowanceRp: number | null;
  deductionRp: number | null;
  netWageRp: number | null;
  lpCount?: number | null;
  lpRows?: PerformaLpRow[];
  reprocessBjd?: number | null;
  reprocessCount?: number | null;
  reprocessRows?: PerformaReprocessRow[];
  workItemCount: number;
  payrollCount: number;
}

export interface PerformaExpenseSummary {
  totalPeople: number;
  totalHk: number;
  totalBakuBasah: number;
  totalBjd: number;
  weightedRendemenPctBps: number | null;
  averageRendemenPctBps: number | null;
  totalPieceworkWageRp: number;
  totalBorongWageRp?: number | null;
  totalBulananWageRp?: number | null;
  totalBulananCount?: number;
  totalBorongCount?: number;
  totalSubsidyRp: number;
  totalPremiumRp: number;
  totalMealAllowanceRp: number;
  totalDeductionRp: number;
  totalNetWageRp: number;
  totalWorkItems: number;
  totalPayrollRows: number;
}

export interface PerformaExpenseSummaryResponse {
  period: PerformaPeriodRef | null;
  summary: PerformaExpenseSummary | null;
  rows: PerformaExpenseRow[];
}

/** Satu baris = satu bulan (label "MM/YYYY"), gabungan dari seluruh periode WEEKLY_PAYROLL_DETAIL bulan itu. */
export interface PerformaMonthlyExpenseStat extends PerformaExpenseSummary {
  label: string;
  periodCount: number;
}

export interface PerformaMonthlyExpenseStatsResponse {
  months: PerformaMonthlyExpenseStat[];
}

export interface PerformaPerson {
  id: string;
  name: string;
  normalizedName: string;
  workerId?: string | null;
  colorHex: string;
  hasCustomColor: boolean;
  totalPeriods: number;
}

export type PerformaTrendMetric =
  "totalBakuBasah" | "totalBjd" | "rendemen" | "sp" | "sh" | "hk";

export interface PerformaTrendSeries {
  personId: string;
  name: string;
  colorHex: string;
  /** Sejajar index dengan `periods`; null = mitra tidak punya data di periode itu. */
  points: Array<number | null>;
}

export interface PerformaTrendResponse {
  metric: PerformaTrendMetric;
  unit: "bps" | "number";
  periods: Array<{ id: string; label: string; sortOrder: number }>;
  series: PerformaTrendSeries[];
}

export interface PerformaPeriodStat {
  id: string;
  label: string;
  sortOrder: number;
  startDate?: string | null;
  endDate?: string | null;
  totalPeople: number;
  totalHk: number;
  totalBakuBasah: number;
  totalBjd: number;
  totalReprocessBjd?: number;
  totalBjdWithReprocess?: number;
  weightedRendemenPctBps: number | null;
  weightedSusutProsesPctBps: number | null;
  weightedSusutHilangPctBps: number | null;
  averageRendemenPctBps: number | null;
  averageSusutProsesPctBps: number | null;
  averageSusutHilangPctBps: number | null;
  /** Selisih vs periode sebelumnya; null di periode pertama. */
  deltaBakuBasah: number | null;
  deltaBjd: number | null;
  deltaBjdWithReprocess?: number | null;
  deltaHk: number | null;
  deltaRendemenPctBps: number | null;
}

export interface PerformaPeriodStatsResponse {
  periods: PerformaPeriodStat[];
}

export interface PerformaImportResponse {
  importId: string;
  fileName: string;
  totalSheets: number;
  totalRows: number;
  periods: Array<{
    id: string;
    label: string;
    sheetName: string;
    totalRows: number;
    replaced: boolean;
  }>;
  warnings?: Array<{
    rowNumber: number;
    rawName: string;
    column: string;
    message: string;
  }>;
}

/** Pesan error backend bisa string atau array (ValidationPipe). */
async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  const errorData = await response.json().catch(() => ({}));
  const message = Array.isArray(errorData?.message)
    ? errorData.message.join(" ")
    : errorData?.message;
  return message || fallback;
}

export async function getPerformaPeriods(): Promise<PerformaPeriod[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/audit-dashboard/periods`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      throw new Error(
        await readApiError(response, "Gagal memuat data periode."),
      );
    }

    const json = await response.json();
    return unwrap<PerformaPeriod[]>(json);
  } catch (error) {
    console.error("Error fetching performa periods:", error);
    throw error;
  }
}

export async function getPerformaSummary(
  periodId?: string,
): Promise<PerformaSummaryResponse> {
  try {
    const url = `${API_BASE_URL}/api/audit-dashboard/summary${buildQueryString({ periodId })}`;
    const response = await fetch(url, {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      throw new Error(
        await readApiError(response, "Gagal memuat ringkasan periode."),
      );
    }

    const json = await response.json();
    return unwrap<PerformaSummaryResponse>(json);
  } catch (error) {
    console.error("Error fetching performa summary:", error);
    throw error;
  }
}

export async function getPerformaExpenseSummary(
  periodId?: string,
): Promise<PerformaExpenseSummaryResponse> {
  try {
    const url = `${API_BASE_URL}/api/audit-dashboard/expense-summary${buildQueryString({ periodId })}`;
    const response = await fetch(url, {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      throw new Error(
        await readApiError(response, "Gagal memuat ringkasan biaya periode."),
      );
    }

    const json = await response.json();
    return unwrap<PerformaExpenseSummaryResponse>(json);
  } catch (error) {
    console.error("Error fetching performa expense summary:", error);
    throw error;
  }
}

/** Satu pekerja "Anak Harian" (staf pendukung dibayar harian — Cleaning
 * Service, QC, Trainer, dst) — populasi & skema gaji terpisah total dari
 * mitra bulu, tidak ada Baku Basah/BJD/Rendemen/Kapasitas. */
export interface PerformaHarianRow {
  id: string;
  personId: string;
  name: string;
  rawName: string;
  pin: string | null;
  bagian: string | null;
  gapokRp: number | null;
  hariKerjaRaw: string | null;
  hariKerja: number | null;
  upahRp: number | null;
  upahLemburWeekdayRp: number | null;
  upahLemburWeekendRp: number | null;
  uangMakanRp: number | null;
  premiRp: number | null;
  tunjanganRp: number | null;
  potonganRp: number | null;
  totalUpahRp: number | null;
}

export interface PerformaHarianSummary {
  totalPeople: number;
  totalGapokRp: number;
  totalUpahRp: number;
  totalUpahLemburWeekdayRp: number;
  totalUpahLemburWeekendRp: number;
  totalUangMakanRp: number;
  totalPremiRp: number;
  totalTunjanganRp: number;
  totalPotonganRp: number;
  totalUpahBersihRp: number;
}

export interface PerformaHarianBagianStat {
  bagian: string;
  count: number;
  totalUpahRp: number;
}

export interface PerformaHarianSummaryResponse {
  period: PerformaPeriodRef | null;
  summary: PerformaHarianSummary | null;
  rows: PerformaHarianRow[];
  byBagian: PerformaHarianBagianStat[];
}

export async function getPerformaHarianSummary(
  periodId?: string,
): Promise<PerformaHarianSummaryResponse> {
  try {
    const url = `${API_BASE_URL}/api/audit-dashboard/harian-summary${buildQueryString({ periodId })}`;
    const response = await fetch(url, {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      throw new Error(
        await readApiError(response, "Gagal memuat ringkasan Anak Harian."),
      );
    }

    const json = await response.json();
    return unwrap<PerformaHarianSummaryResponse>(json);
  } catch (error) {
    console.error("Error fetching performa harian summary:", error);
    throw error;
  }
}

export interface PerformaExpenseTrendPoint {
  id: string;
  label: string;
  sortOrder: number;
  startDate?: string | null;
  endDate?: string | null;
  /** Upah bersih borong + bulanan. */
  netWageRp: number;
  /** Subsidi + premi + uang makan. */
  allowanceRp: number;
  deductionRp: number;
  /** Upah bersih anak harian. */
  harianRp: number;
}

export async function getPerformaExpenseTrend(): Promise<PerformaExpenseTrendPoint[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/audit-dashboard/expense-trend`,
    { headers: getAuthHeaders({ json: false }) },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal memuat tren pengeluaran."));
  }
  const json = await response.json();
  return unwrap<{ periods: PerformaExpenseTrendPoint[] }>(json).periods;
}

export async function getPerformaMonthlyExpenses(): Promise<PerformaMonthlyExpenseStatsResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/audit-dashboard/monthly-expenses`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      throw new Error(
        await readApiError(response, "Gagal memuat rekap biaya bulanan."),
      );
    }

    const json = await response.json();
    return unwrap<PerformaMonthlyExpenseStatsResponse>(json);
  } catch (error) {
    console.error("Error fetching performa monthly expenses:", error);
    throw error;
  }
}

export async function getPerformaPersons(): Promise<PerformaPerson[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/audit-dashboard/persons`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      throw new Error(await readApiError(response, "Gagal memuat data mitra."));
    }

    const json = await response.json();
    return unwrap<PerformaPerson[]>(json);
  } catch (error) {
    console.error("Error fetching performa persons:", error);
    throw error;
  }
}

export async function getPerformaTrends(
  personIds: string[],
  metric: PerformaTrendMetric,
): Promise<PerformaTrendResponse> {
  try {
    const url = `${API_BASE_URL}/api/audit-dashboard/trends${buildQueryString({
      personIds: personIds.join(","),
      metric,
    })}`;
    const response = await fetch(url, {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      throw new Error(
        await readApiError(response, "Gagal memuat tren individu."),
      );
    }

    const json = await response.json();
    return unwrap<PerformaTrendResponse>(json);
  } catch (error) {
    console.error("Error fetching performa trends:", error);
    throw error;
  }
}

export async function getPerformaPeriodStats(): Promise<PerformaPeriodStatsResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/audit-dashboard/period-stats`,
      {
        headers: getAuthHeaders({ json: false }),
      },
    );

    if (!response.ok) {
      throw new Error(
        await readApiError(response, "Gagal memuat kapasitas periode."),
      );
    }

    const json = await response.json();
    return unwrap<PerformaPeriodStatsResponse>(json);
  } catch (error) {
    console.error("Error fetching performa period stats:", error);
    throw error;
  }
}

export async function updatePerformaPersonColor(
  personId: string,
  colorHex: string | null,
): Promise<PerformaPerson> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/audit-dashboard/persons/${encodeURIComponent(personId)}/color`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ colorHex }),
      },
    );

    if (!response.ok) {
      throw new Error(await readApiError(response, "Gagal menyimpan warna."));
    }

    const json = await response.json();
    return unwrap<PerformaPerson>(json);
  } catch (error) {
    console.error("Error updating performa person color:", error);
    throw error;
  }
}

export async function importPerformaWorkbook(
  file: File,
): Promise<PerformaImportResponse> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    // Content-Type sengaja tidak di-set: browser yang mengisi boundary multipart.
    const response = await fetch(`${API_BASE_URL}/api/audit-dashboard/import`, {
      method: "POST",
      headers: getAuthHeaders({ json: false }),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, "Gagal mengunggah file."));
    }

    const json = await response.json();
    return unwrap<PerformaImportResponse>(json);
  } catch (error) {
    console.error("Error importing performa workbook:", error);
    throw error;
  }
}

export async function resetPerformaData(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/audit-dashboard/reset`, {
      method: "POST",
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      throw new Error(
        await readApiError(response, "Gagal mereset data performa."),
      );
    }

    const json = await response.json();
    return unwrap<{ success: boolean; message: string }>(json);
  } catch (error) {
    console.error("Error resetting performa data:", error);
    throw error;
  }
}

/* ─── Dashboard Audit Bulanan (total perusahaan per bulan, khusus admin) ── */

export interface AuditMonthlyPeriod {
  id: string;
  year: number;
  month: number;
  label: string;
  totalBakuBasah: number;
  totalBjd: number;
  weightedRendemenPctBps: number | null;
  totalRows: number;
  totalPersons: number;
  /** Baris berbobot yang NAMA-nya tidak terbaca (mis. VLOOKUP #N/A) — sudah
   * ikut totalBakuBasah/totalBjd di atas tapi tidak ada di rincian per mitra. */
  unattributedRows: number;
  unattributedBjd: number;
  sourceFileName: string;
  updatedAt: string;
  deltaBakuBasah: number | null;
  deltaBjd: number | null;
  deltaRendemenPctBps: number | null;
}

export interface AuditMonthlyImportResponse {
  fileName: string;
  totalSheets: number;
  months: Array<{
    id: string;
    year: number;
    month: number;
    label: string;
    totalRows: number;
    personCount: number;
    unattributedRows: number;
    unattributedBjd: number;
  }>;
  skippedSheets: string[];
}

export interface AuditMonthlyPersonMetric {
  id: string;
  rawName: string;
  totalBakuBasah: number;
  totalBjd: number;
  weightedRendemenPctBps: number | null;
}

export interface AuditMonthlyPersonMetricsResponse {
  period: {
    id: string;
    year: number;
    month: number;
    label: string;
    unattributedRows: number;
    unattributedBjd: number;
  } | null;
  persons: AuditMonthlyPersonMetric[];
}

export async function getAuditMonthlyMonths(): Promise<AuditMonthlyPeriod[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/audit-monthly/months`, {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      throw new Error(
        await readApiError(response, "Gagal memuat data laporan bulanan."),
      );
    }

    const json = await response.json();
    return unwrap<AuditMonthlyPeriod[]>(json);
  } catch (error) {
    console.error("Error fetching audit monthly months:", error);
    throw error;
  }
}

export async function getAuditMonthlyPersonMetrics(
  periodId?: string,
): Promise<AuditMonthlyPersonMetricsResponse> {
  try {
    const url = `${API_BASE_URL}/api/audit-monthly/persons${buildQueryString({ periodId })}`;
    const response = await fetch(url, {
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      throw new Error(
        await readApiError(response, "Gagal memuat performa individu."),
      );
    }

    const json = await response.json();
    return unwrap<AuditMonthlyPersonMetricsResponse>(json);
  } catch (error) {
    console.error("Error fetching audit monthly person metrics:", error);
    throw error;
  }
}

export async function importAuditMonthlyWorkbook(
  file: File,
): Promise<AuditMonthlyImportResponse> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    // Content-Type sengaja tidak di-set: browser yang mengisi boundary multipart.
    const response = await fetch(`${API_BASE_URL}/api/audit-monthly/import`, {
      method: "POST",
      headers: getAuthHeaders({ json: false }),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, "Gagal mengunggah file."));
    }

    const json = await response.json();
    return unwrap<AuditMonthlyImportResponse>(json);
  } catch (error) {
    console.error("Error importing audit monthly workbook:", error);
    throw error;
  }
}

export async function resetAuditMonthlyData(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/audit-monthly/reset`, {
      method: "POST",
      headers: getAuthHeaders({ json: false }),
    });

    if (!response.ok) {
      throw new Error(
        await readApiError(response, "Gagal mereset data laporan bulanan."),
      );
    }

    const json = await response.json();
    return unwrap<{ success: boolean; message: string }>(json);
  } catch (error) {
    console.error("Error resetting audit monthly data:", error);
    throw error;
  }
}

export type EvaluationGroupBy = "mitra" | "grade" | "day" | "week" | "month";

export interface EvaluationMetricRow {
  key: string;
  label: string;
  lpCount: number;
  dryInGram: number;
  mainOutGram: number;
  byProductGram: number;
  susutHilangGram: number;
  rendemenMainPctBps: number;
  rendemenNetPctBps: number;
  susutProsesPctBps: number;
  susutHilangPctBps: number;
}

export interface EvaluationSummary {
  overall: EvaluationMetricRow;
  groups: EvaluationMetricRow[];
}

export async function getFinishEvaluationSummary(params: {
  from?: string;
  to?: string;
  groupBy: EvaluationGroupBy;
}): Promise<EvaluationSummary> {
  try {
    const url = `${API_BASE_URL}/api/finish/evaluation/summary${buildQueryString(params)}`;
    const response = await fetch(url, {
      headers: getAuthHeaders({ json: false }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Gagal memuat rekap evaluasi");
    }
    const json = await response.json();
    return unwrap<EvaluationSummary>(json);
  } catch (error) {
    console.error("Error fetching evaluation summary:", error);
    throw error;
  }
}

export interface ResultGradeTariffItem {
  id: string;
  resultGradeTypeId: string;
  rateRpPerGram: number;
  effectiveFrom: string;
  resultGradeType: {
    id: string;
    name: string;
  };
}

export interface TariffAuditLog {
  id: string;
  tariffType: "GRADE" | "RESULT" | "BY_PRODUCT" | string;
  tariffId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | string;
  previousRateRpPerGram?: number | null;
  newRateRpPerGram?: number | null;
  changedAt: string;
  changedBy: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export async function getTariffAudits(tariffType?: string): Promise<TariffAuditLog[]> {
  const query = tariffType ? `?tariffType=${encodeURIComponent(tariffType)}` : "";
  const response = await fetch(`${API_BASE_URL}/api/rules/tariff-audits${query}`, {
    headers: getAuthHeaders({ json: false }),
  });
  if (!response.ok) throw new Error("Gagal memuat histori perubahan tarif");
  const json = await response.json();
  return unwrap<TariffAuditLog[]>(json);
}

export async function getResultGradeTariffs(): Promise<
  ResultGradeTariffItem[]
> {
  const response = await fetch(
    `${API_BASE_URL}/api/rules/result-grade-tariffs`,
    {
      headers: getAuthHeaders({ json: false }),
    },
  );
  if (!response.ok) throw new Error("Gagal memuat tarif grade hasil");
  const json = await response.json();
  return unwrap<ResultGradeTariffItem[]>(json);
}

export async function createResultGradeTariff(dto: {
  resultGradeTypeId: string;
  rateRpPerGram: number;
}): Promise<ResultGradeTariffItem> {
  const response = await fetch(
    `${API_BASE_URL}/api/rules/result-grade-tariffs`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    },
  );
  if (!response.ok) throw new Error("Gagal menyimpan tarif grade hasil");
  const json = await response.json();
  return unwrap<ResultGradeTariffItem>(json);
}

export async function updateResultGradeTariff(
  id: string,
  dto: { rateRpPerGram?: number; effectiveFrom?: string },
): Promise<ResultGradeTariffItem> {
  const response = await fetch(
    `${API_BASE_URL}/api/rules/result-grade-tariffs/${id}`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    },
  );
  if (!response.ok) throw new Error("Gagal memperbarui tarif grade hasil");
  const json = await response.json();
  return unwrap<ResultGradeTariffItem>(json);
}

export async function updateGradeTariff(
  id: string,
  dto: {
    shapeGradeId?: string;
    featherGradeId?: string | null;
    colorGradeId?: string | null;
    rateRpPerGram?: number;
    effectiveFrom?: string;
    effectiveTo?: string | null;
  },
): Promise<GradeTariff> {
  const response = await fetch(
    `${API_BASE_URL}/api/rules/grade-tariffs/${id}`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    },
  );
  if (!response.ok) throw new Error("Gagal memperbarui tarif grade baku");
  const json = await response.json();
  return unwrap<GradeTariff>(json);
}

export async function deleteResultGradeTariff(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/rules/result-grade-tariffs/${id}`,
    {
      method: "DELETE",
      headers: getAuthHeaders({ json: false }),
    },
  );
  if (!response.ok) throw new Error("Gagal menghapus tarif grade hasil");
}

export async function getSystemSetting(
  key: string,
): Promise<{ key: string; value: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/rules/settings/${encodeURIComponent(key)}`,
    {
      headers: getAuthHeaders({ json: false }),
    },
  );
  if (!response.ok)
    return {
      key,
      value: key === "RAW_MATERIAL_PAYROLL_CALC_BASE" ? "WET" : "",
    };
  const json = await response.json();
  return unwrap<{ key: string; value: string }>(json);
}

export async function setSystemSetting(
  key: string,
  value: string,
): Promise<{ key: string; value: string }> {
  const response = await fetch(`${API_BASE_URL}/api/rules/settings`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ key, value }),
  });
  if (!response.ok) throw new Error("Gagal menyimpan pengaturan");
  const json = await response.json();
  return unwrap<{ key: string; value: string }>(json);
}

export interface WeeklyReportResponse {
  filters: {
    from: string;
    to: string;
    workDayCount: number;
    workDays: string[];
  };
  summary: {
    totalReceipts: number;
    totalDryInGram: number;
    totalMainOutGram: number;
    totalByProductGram: number;
    totalSusutProsesGram: number;
    totalSusutHilangGram: number;
    totalPayrollRp: number;
    rendemenMainBps: number;
    rendemenNetBps: number;
    susutProsesBps: number;
    susutHilangBps: number;
  };
  workers: Array<{
    workerId: string;
    workerName: string;
    workerCode: string | null;
    workerPin: string | null;
    receiptCount: number;
    dryInGram: number;
    mainOutGram: number;
    byProductGram: number;
    payrollAmountRp: number;
    rendemenMainBps: number;
    rendemenNetBps: number;
    attendanceDays: number | null;
    workDayCount: number;
    isFullAttendance: boolean;
    premiumEligible: boolean;
  }>;
  dailyBreakdown: Array<{
    date: string;
    isWorkDay: boolean;
    receiptCount: number;
    dryInGram: number;
    mainOutGram: number;
    payrollRp: number;
  }>;
}

export async function getWeeklyPayrollReport(params: {
  from: string;
  to: string;
  workDays?: string[];
}): Promise<WeeklyReportResponse> {
  try {
    const url = new URL(`${API_BASE_URL}/api/reports/weekly-payroll`);
    url.searchParams.set("from", params.from);
    url.searchParams.set("to", params.to);
    if (params.workDays) {
      url.searchParams.set("workDays", JSON.stringify(params.workDays));
    }
    const response = await fetch(url.toString(), {
      headers: getAuthHeaders({ json: false }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Gagal memuat laporan mingguan");
    }
    const json = await response.json();
    return unwrap<WeeklyReportResponse>(json);
  } catch (error) {
    console.error("Error fetching weekly payroll report:", error);
    throw error;
  }
}

export interface CreateLocationRequest {
  code: string;
  name: string;
  type: string;
  workerId?: string;
}

export interface UpdateLocationRequest {
  code?: string;
  name?: string;
  type?: string;
}

export async function getLocations() {
  const response = await fetch(`${API_BASE_URL}/api/locations`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Gagal mengambil data lokasi");
  }
  const json = await response.json();
  return unwrap<RackLocation[]>(json);
}

export async function createLocation(data: CreateLocationRequest) {
  const response = await fetch(`${API_BASE_URL}/api/locations`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Gagal membuat lokasi");
  }
  const json = await response.json();
  return unwrap<RackLocation>(json);
}

export async function updateLocation(id: string, data: UpdateLocationRequest) {
  const response = await fetch(`${API_BASE_URL}/api/locations/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Gagal memperbarui lokasi");
  }
  const json = await response.json();
  return unwrap<RackLocation>(json);
}

export async function deleteLocation(id: string) {
  const response = await fetch(`${API_BASE_URL}/api/locations/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Gagal menghapus lokasi");
  }
  const json = await response.json();
  return unwrap<{ success: boolean }>(json);
}

export async function getProductionRooms(): Promise<ProductionRoom[]> {
  const response = await fetch(`${API_BASE_URL}/api/production-rooms`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Gagal mengambil data ruang produksi");
  }
  const json = await response.json();
  return unwrap<ProductionRoom[]>(json);
}

export async function createProductionRoom(data: {
  code: string;
  name: string;
  type: "FACTORY" | "MINIPLANT";
}): Promise<ProductionRoom> {
  const response = await fetch(`${API_BASE_URL}/api/production-rooms`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Gagal membuat ruang produksi");
  }
  const json = await response.json();
  return unwrap<ProductionRoom>(json);
}

export async function updateProductionRoom(
  id: string,
  data: {
    code?: string;
    name?: string;
    type?: "FACTORY" | "MINIPLANT";
  }
): Promise<ProductionRoom> {
  const response = await fetch(`${API_BASE_URL}/api/production-rooms/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Gagal mengupdate ruang produksi");
  }
  const json = await response.json();
  return unwrap<ProductionRoom>(json);
}

export async function deleteProductionRoom(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/production-rooms/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Gagal menghapus ruang produksi");
  }
}

export interface TrainerWorkerStat {
  workerId: string;
  workerName: string;
  workerCode: string;
  orderGram: number;
  orderCount: number;
  setoranGram: number;
  setoranCount: number;
  susutGram: number;
  rendemenPctBps?: number;
  rendemenNetPctBps?: number;
  susutProsesPctBps?: number;
  susutHilangPctBps?: number;
}

export interface WeeklyTrendPoint {
  periodLabel: string;
  weekStart: string;
  orderGram: number;
  setoranGram: number;
  rendemenPctBps?: number;
  rendemenNetPctBps?: number;
  susutProsesPctBps?: number;
  susutHilangPctBps?: number;
}

export interface TrainerSummaryResponse {
  trainerUserId: string;
  totalAssignedWorkers: number;
  totals: {
    orderGram: number;
    orderCount: number;
    setoranGram: number;
    setoranCount: number;
  };
  workerStats: TrainerWorkerStat[];
  weeklyTrends?: WeeklyTrendPoint[];
}

export async function getTrainerSummary(trainerId?: string): Promise<TrainerSummaryResponse> {
  const query = trainerId ? `?trainerId=${encodeURIComponent(trainerId)}` : "";
  const response = await fetch(`${API_BASE_URL}/api/analytics/trainer/summary${query}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Gagal memuat ringkasan analytics trainer");
  }
  const json = await response.json();
  return unwrap<TrainerSummaryResponse>(json);
}

/* ─── Portal Mitra (/cek): mitra cek performa & gaji sendiri pakai PIN ── */

export interface MitraPortalSession {
  token: string;
  name: string;
  /** Sudah mengganti PIN dengan password sendiri? */
  hasPassword: boolean;
  expiresAt: string;
}

export interface MitraPortalWeek {
  period: PerformaPeriodRef;
  row: PerformaRow;
}

export interface MitraPortalHarianWeek {
  period: PerformaPeriodRef;
  row: {
    bagian: string | null;
    hariKerjaRaw: string | null;
    hariKerja: number | null;
    gapokRp: number | null;
    upahRp: number | null;
    upahLemburWeekdayRp: number | null;
    upahLemburWeekendRp: number | null;
    uangMakanRp: number | null;
    premiRp: number | null;
    tunjanganRp: number | null;
    potonganRp: number | null;
    totalUpahRp: number | null;
  };
}

export interface MitraPortalData {
  name: string;
  hasPassword: boolean;
  /** Minggu sebagai mitra borongan/bulanan (performa + gaji). */
  periods: MitraPortalWeek[];
  /** Minggu sebagai anak harian (hanya gaji). */
  harian: MitraPortalHarianWeek[];
}

export interface MitraPinStatus {
  total: number;
  matched: number;
  /** PIN lama (sebelum login PIN-saja) yang belum bisa dipakai masuk. */
  needsReupload: number;
  /** Mitra yang sudah mengganti PIN dengan password sendiri. */
  withPassword: string[];
  unmatched: Array<{ name: string; suggestions: string[] }>;
  /** Nama lengkap yang sudah dihubungkan ke nama lain di Excel performa. */
  linked: Array<{ name: string; excelNames: string[] }>;
  /** Nama di Excel performa yang belum dimiliki PIN mana pun (terbaru dulu). */
  excelNames: string[];
  updatedAt: string | null;
  issues?: Array<{ row: string; name: string; reason: string }>;
}

/** Sengaja TIDAK memakai getAuthHeaders: token portal mitra terpisah dari
 * token login aplikasi (yang mungkin juga ada di browser yang sama). */
export async function mitraPortalLogin(
  pin: string,
): Promise<MitraPortalSession> {
  const response = await fetch(`${API_BASE_URL}/api/mitra-portal/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal masuk. Coba lagi."));
  }
  return unwrap<MitraPortalSession>(await response.json());
}

/** Masuk dengan nama lengkap + password sendiri (setelah PIN diganti). */
export async function mitraPortalLoginPassword(
  name: string,
  password: string,
): Promise<MitraPortalSession> {
  const response = await fetch(
    `${API_BASE_URL}/api/mitra-portal/login-password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal masuk. Coba lagi."));
  }
  return unwrap<MitraPortalSession>(await response.json());
}

export class MitraPortalSessionError extends Error {}

/** Buat/ganti password. Berhasil = semua sesi lama (termasuk yang ini) berakhir. */
export async function setMitraPortalPassword(
  token: string,
  password: string,
  currentPassword?: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/mitra-portal/password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password, currentPassword }),
  });
  if (response.status === 401) {
    throw new MitraPortalSessionError(
      await readApiError(response, "Sesi berakhir. Masuk lagi."),
    );
  }
  if (!response.ok) {
    throw new Error(
      await readApiError(response, "Gagal menyimpan password. Coba lagi."),
    );
  }
}

export async function getMitraPortalData(
  token: string,
): Promise<MitraPortalData> {
  const response = await fetch(`${API_BASE_URL}/api/mitra-portal/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    throw new MitraPortalSessionError(
      await readApiError(response, "Sesi berakhir. Masuk lagi."),
    );
  }
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal memuat data."));
  }
  return unwrap<MitraPortalData>(await response.json());
}

export async function uploadMitraPins(file: File): Promise<MitraPinStatus> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/mitra-portal/pins`, {
    method: "POST",
    headers: getAuthHeaders({ json: false }),
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal mengunggah file PIN."));
  }
  return unwrap<MitraPinStatus>(await response.json());
}

/* Data pembayaran mitra: Excel format sama dengan performa, tapi file &
 * datanya terpisah — hanya dipakai portal /cek, tidak mengubah dashboard. */

export interface MitraPaymentPeriod {
  id: string;
  label: string;
  sheetName: string;
  startDate?: string | null;
  endDate?: string | null;
  year?: number | null;
  sortOrder: number;
  totalMetrics: number;
  totalHarian: number;
  createdAt: string;
}

export async function uploadMitraPaymentData(
  file: File,
): Promise<PerformaImportResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/mitra-portal/data`, {
    method: "POST",
    headers: getAuthHeaders({ json: false }),
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal mengunggah file."));
  }
  return unwrap<PerformaImportResponse>(await response.json());
}

export async function getMitraPaymentPeriods(): Promise<MitraPaymentPeriod[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/mitra-portal/data/periods`,
    { headers: getAuthHeaders() },
  );
  if (!response.ok) {
    throw new Error(
      await readApiError(response, "Gagal memuat data pembayaran."),
    );
  }
  return unwrap<MitraPaymentPeriod[]>(await response.json());
}

export async function resetMitraPaymentData(): Promise<{
  success: boolean;
  message: string;
}> {
  const response = await fetch(`${API_BASE_URL}/api/mitra-portal/data/reset`, {
    method: "POST",
    headers: getAuthHeaders({ json: false }),
  });
  if (!response.ok) {
    throw new Error(
      await readApiError(response, "Gagal mereset data pembayaran."),
    );
  }
  return unwrap<{ success: boolean; message: string }>(await response.json());
}

export async function resetMitraPassword(
  name: string,
): Promise<MitraPinStatus> {
  const response = await fetch(
    `${API_BASE_URL}/api/mitra-portal/pins/reset-password`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal mereset password."));
  }
  return unwrap<MitraPinStatus>(await response.json());
}

export async function linkMitraExcelName(
  name: string,
  excelName: string | null,
): Promise<MitraPinStatus> {
  const response = await fetch(`${API_BASE_URL}/api/mitra-portal/pins/link`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, excelName }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal menghubungkan nama."));
  }
  return unwrap<MitraPinStatus>(await response.json());
}

export async function getMitraPinStatus(): Promise<MitraPinStatus> {
  const response = await fetch(`${API_BASE_URL}/api/mitra-portal/pins/status`, {
    headers: getAuthHeaders({ json: false }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal memuat status PIN."));
  }
  return unwrap<MitraPinStatus>(await response.json());
}

/* ── Presensi finger ─────────────────────────────────────────────── */

export interface PresensiRecord {
  id: string;
  date: string;
  /** 1 = masuk pagi, 2 = masuk sore (pulang lewat tengah malam) */
  shift: number;
  clockIn: string | null;
  clockOut: string | null;
  minutes: number | null;
  edited: boolean;
}

export interface PresensiPerson {
  pin: string;
  name: string;
  shifts: number[];
  hadirDays: number;
  incompleteDays: number;
  totalMinutes: number;
  avgIn: string | null;
  avgOut: string | null;
  /** Hanya terisi untuk tampilan mingguan atau detail=1. */
  records: PresensiRecord[];
}

export interface PresensiResponse {
  month: string | null;
  months: string[];
  weeks: Array<{ start: string; end: string }>;
  weekStart: string | null;
  range: { from: string; to: string } | null;
  days: string[];
  people: PresensiPerson[];
  totals: { people: number; hadirDays: number; shift1: number; shift2: number };
}

export interface PresensiImportResult {
  fileName: string;
  totalRecords: number;
  keptEdited: number;
  people: number;
  from: string;
  to: string;
  sheets: Array<{ name: string; people: number; records: number }>;
  skippedSheets: string[];
  issues: Array<{ sheet: string; row: number; reason: string }>;
}

export async function getPresensi(params: {
  month?: string;
  weekStart?: string | null;
  shift?: string;
  search?: string;
  detail?: boolean;
}): Promise<PresensiResponse> {
  const query = buildQueryString({
    month: params.month,
    weekStart: params.weekStart || undefined,
    shift: params.shift || undefined,
    search: params.search || undefined,
    detail: params.detail ? "1" : undefined,
  });
  const response = await fetch(`${API_BASE_URL}/api/presensi${query}`, {
    headers: getAuthHeaders({ json: false }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal memuat data presensi."));
  }
  return unwrap<PresensiResponse>(await response.json());
}

export async function uploadPresensi(file: File): Promise<PresensiImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/presensi/import`, {
    method: "POST",
    headers: getAuthHeaders({ json: false }),
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal mengunggah file presensi."));
  }
  return unwrap<PresensiImportResult>(await response.json());
}

export async function savePresensiRecord(input: {
  id?: string;
  pin: string;
  name: string;
  date: string;
  shift: number;
  clockIn: string | null;
  clockOut: string | null;
}): Promise<PresensiRecord> {
  const isUpdate = Boolean(input.id);
  const response = await fetch(
    `${API_BASE_URL}/api/presensi/records${isUpdate ? `/${input.id}` : ""}`,
    {
      method: isUpdate ? "PATCH" : "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(
        isUpdate
          ? { clockIn: input.clockIn, clockOut: input.clockOut }
          : {
              pin: input.pin,
              name: input.name,
              date: input.date,
              shift: input.shift,
              clockIn: input.clockIn,
              clockOut: input.clockOut,
            },
      ),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal menyimpan presensi."));
  }
  return unwrap<PresensiRecord>(await response.json());
}

export async function deletePresensiRecord(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/presensi/records/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders({ json: false }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal menghapus presensi."));
  }
}

export async function resetPresensi(): Promise<{ deleted: number }> {
  const response = await fetch(`${API_BASE_URL}/api/presensi/reset`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal menghapus data presensi."));
  }
  return unwrap<{ deleted: number }>(await response.json());
}

/* ── Penggajian bulanan (file "DATA PENGGAJIAN ..."): terpisah dari Performa ── */

export interface MonthlyPayrollMonth {
  id: string;
  /** YYYY-MM */
  month: string;
  label: string;
  fileName: string | null;
  updatedAt: string;
  mitraCount: number;
  harianCount: number;
  netWageRp: number;
  harianRp: number;
}

export interface MonthlyPayrollResponse {
  period: PerformaPeriodRef | null;
  expense: PerformaExpenseSummaryResponse | null;
  harian: PerformaHarianSummaryResponse | null;
}

export interface MonthlyPayrollImportResult {
  fileName: string;
  months: Array<{
    month: string;
    label: string;
    mitra: number;
    harian: number;
    totalNetWageRp: number;
    totalHarianRp: number;
    replaced: boolean;
  }>;
  skippedSheets: string[];
  issues: Array<{ sheet: string; row: number; reason: string }>;
}

export async function getMonthlyPayrollMonths(): Promise<MonthlyPayrollMonth[]> {
  const response = await fetch(`${API_BASE_URL}/api/payroll-monthly/months`, {
    headers: getAuthHeaders({ json: false }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal memuat daftar bulan penggajian."));
  }
  return unwrap<{ months: MonthlyPayrollMonth[] }>(await response.json()).months;
}

export async function getMonthlyPayroll(month?: string): Promise<MonthlyPayrollResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/payroll-monthly${buildQueryString({ month })}`,
    { headers: getAuthHeaders({ json: false }) },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal memuat penggajian bulanan."));
  }
  return unwrap<MonthlyPayrollResponse>(await response.json());
}

export async function uploadMonthlyPayroll(file: File): Promise<MonthlyPayrollImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/payroll-monthly/import`, {
    method: "POST",
    headers: getAuthHeaders({ json: false }),
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal mengunggah file penggajian."));
  }
  return unwrap<MonthlyPayrollImportResult>(await response.json());
}

export async function deleteMonthlyPayrollMonth(month: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/payroll-monthly/${month}`, {
    method: "DELETE",
    headers: getAuthHeaders({ json: false }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Gagal menghapus bulan."));
  }
}
