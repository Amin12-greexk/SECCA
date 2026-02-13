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
exports.WorkersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../auth/roles.decorator");
const create_worker_dto_1 = require("./dto/create-worker.dto");
const update_worker_dto_1 = require("./dto/update-worker.dto");
const workers_service_1 = require("./workers.service");
let WorkersController = class WorkersController {
    workersService;
    constructor(workersService) {
        this.workersService = workersService;
    }
    create(dto) {
        return this.workersService.create(dto);
    }
    update(id, dto) {
        return this.workersService.update(id, dto);
    }
    findAll() {
        return this.workersService.findAll();
    }
    weeklyStats(id, weeks) {
        const parsed = weeks ? Number(weeks) : undefined;
        return this.workersService.getWeeklyStats(id, parsed);
    }
};
exports.WorkersController = WorkersController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_worker_dto_1.CreateWorkerDto]),
    __metadata("design:returntype", void 0)
], WorkersController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, swagger_1.ApiParam)({ name: "id" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_worker_dto_1.UpdateWorkerDto]),
    __metadata("design:returntype", void 0)
], WorkersController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], WorkersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":id/weekly-stats"),
    (0, swagger_1.ApiParam)({ name: "id" }),
    (0, roles_decorator_1.Roles)("manager", "trainer", "mitra"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)("weeks")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], WorkersController.prototype, "weeklyStats", null);
exports.WorkersController = WorkersController = __decorate([
    (0, swagger_1.ApiTags)("workers"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)("manager", "baku", "mitra", "koreksi", "trainer"),
    (0, common_1.Controller)("workers"),
    __metadata("design:paramtypes", [workers_service_1.WorkersService])
], WorkersController);
//# sourceMappingURL=workers.controller.js.map