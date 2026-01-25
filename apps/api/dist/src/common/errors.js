"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unprocessable = exports.conflict = exports.notFound = exports.badRequest = exports.throwHttpError = void 0;
const common_1 = require("@nestjs/common");
const throwHttpError = (status, code, message, details) => {
    throw new common_1.HttpException({
        error: code,
        message,
        details,
    }, status);
};
exports.throwHttpError = throwHttpError;
const badRequest = (message, details) => (0, exports.throwHttpError)(common_1.HttpStatus.BAD_REQUEST, "BAD_REQUEST", message, details);
exports.badRequest = badRequest;
const notFound = (message, details) => (0, exports.throwHttpError)(common_1.HttpStatus.NOT_FOUND, "NOT_FOUND", message, details);
exports.notFound = notFound;
const conflict = (message, details) => (0, exports.throwHttpError)(common_1.HttpStatus.CONFLICT, "CONFLICT", message, details);
exports.conflict = conflict;
const unprocessable = (message, details) => (0, exports.throwHttpError)(common_1.HttpStatus.UNPROCESSABLE_ENTITY, "UNPROCESSABLE", message, details);
exports.unprocessable = unprocessable;
//# sourceMappingURL=errors.js.map