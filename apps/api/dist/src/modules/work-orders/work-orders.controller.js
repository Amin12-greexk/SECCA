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
exports.WorkOrdersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../auth/roles.decorator");
const assign_from_mitra_order_dto_1 = require("./dto/assign-from-mitra-order.dto");
const create_work_order_dto_1 = require("./dto/create-work-order.dto");
const work_orders_service_1 = require("./work-orders.service");
let WorkOrdersController = class WorkOrdersController {
    workOrdersService;
    constructor(workOrdersService) {
        this.workOrdersService = workOrdersService;
    }
    create(dto) {
        return this.workOrdersService.create(dto);
    }
    assignFromMitraOrder(dto) {
        return this.workOrdersService.assignFromMitraOrder(dto);
    }
    board(workerId) {
        return this.workOrdersService.board(workerId);
    }
    close(id) {
        return this.workOrdersService.close(id);
    }
};
exports.WorkOrdersController = WorkOrdersController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_work_order_dto_1.CreateWorkOrderDto]),
    __metadata("design:returntype", void 0)
], WorkOrdersController.prototype, "create", null);
__decorate([
    (0, common_1.Post)("assign-from-mitra-order"),
    (0, roles_decorator_1.Roles)("trainer", "manager", "baku"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [assign_from_mitra_order_dto_1.AssignFromMitraOrderDto]),
    __metadata("design:returntype", void 0)
], WorkOrdersController.prototype, "assignFromMitraOrder", null);
__decorate([
    (0, common_1.Get)("board"),
    __param(0, (0, common_1.Query)("workerId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkOrdersController.prototype, "board", null);
__decorate([
    (0, common_1.Post)(":id/close"),
    (0, swagger_1.ApiParam)({ name: "id" }),
    (0, roles_decorator_1.Roles)("manager", "baku", "koreksi"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkOrdersController.prototype, "close", null);
exports.WorkOrdersController = WorkOrdersController = __decorate([
    (0, swagger_1.ApiTags)("work-orders"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)("manager", "baku", "mitra", "koreksi", "trainer"),
    (0, common_1.Controller)("work-orders"),
    __metadata("design:paramtypes", [work_orders_service_1.WorkOrdersService])
], WorkOrdersController);
//# sourceMappingURL=work-orders.controller.js.map