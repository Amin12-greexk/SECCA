"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceabilityController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../auth/roles.decorator");
const traceability_service_1 = require("./traceability.service");
let TraceabilityController = class TraceabilityController {
    traceabilityService;
    constructor(traceabilityService) {
        this.traceabilityService = traceabilityService;
    }
    trace(lotNumber) {
        return this.traceabilityService.traceLot(lotNumber);
    }
};
exports.TraceabilityController = TraceabilityController;
__decorate([
    (0, common_1.Get)(":lotNumber/trace"),
    __param(0, (0, common_1.Param)("lotNumber")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TraceabilityController.prototype, "trace", null);
exports.TraceabilityController = TraceabilityController = __decorate([
    (0, swagger_1.ApiTags)("traceability"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)("manager", "baku", "mitra", "koreksi"),
    (0, common_1.Controller)("lots"),
    __metadata("design:paramtypes", [traceability_service_1.TraceabilityService])
], TraceabilityController);
//# sourceMappingURL=traceability.controller.js.map