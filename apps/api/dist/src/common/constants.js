"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerRackCode = exports.LOCATION_CODES = exports.DEFAULT_MOISTURE_BPS = exports.COMPANY_CODE = void 0;
exports.COMPANY_CODE = "SECCA";
exports.DEFAULT_MOISTURE_BPS = 1200;
exports.LOCATION_CODES = {
    PRE_SALE: "RAK_SEMENTARA",
    MITRA_ORDER: "RAK_MITRA_ORDER",
    FINISHED: "RAK_FINISHED",
};
const workerRackCode = (workerId) => `RAK_MITRA_${workerId}`;
exports.workerRackCode = workerRackCode;
//# sourceMappingURL=constants.js.map