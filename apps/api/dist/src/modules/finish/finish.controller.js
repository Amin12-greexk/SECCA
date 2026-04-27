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
exports.FinishController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../auth/roles.decorator");
const finish_service_1 = require("./finish.service");
const finish_dto_1 = require("./dto/finish.dto");
const query_finish_receipts_dto_1 = require("./dto/query-finish-receipts.dto");
const update_finish_receipt_dto_1 = require("./dto/update-finish-receipt.dto");
let FinishController = class FinishController {
    finishService;
    constructor(finishService) {
        this.finishService = finishService;
    }
    findWorkItemByLp(lpCode) {
        return this.finishService.findWorkItemByLpCode(lpCode);
    }
    listReceipts(query) {
        return this.finishService.listReceipts(query);
    }
    finish(dto) {
        return this.finishService.finish(dto);
    }
    updateReceipt(id, dto) {
        return this.finishService.updateReceipt(id, dto);
    }
    removeReceipt(id) {
        return this.finishService.removeReceipt(id);
    }
};
exports.FinishController = FinishController;
__decorate([
    (0, common_1.Get)("work-item/by-lp/:lpCode"),
    (0, swagger_1.ApiParam)({ name: "lpCode", description: "No LP (contoh: TEI-0466-26) atau lot number internal" }),
    __param(0, (0, common_1.Param)("lpCode")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FinishController.prototype, "findWorkItemByLp", null);
__decorate([
    (0, common_1.Get)("receipts"),
    (0, roles_decorator_1.Roles)("koreksi", "manager"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_finish_receipts_dto_1.QueryFinishReceiptsDto]),
    __metadata("design:returntype", void 0)
], FinishController.prototype, "listReceipts", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [finish_dto_1.FinishDto]),
    __metadata("design:returntype", void 0)
], FinishController.prototype, "finish", null);
__decorate([
    (0, common_1.Patch)("receipts/:id"),
    (0, swagger_1.ApiParam)({ name: "id", description: "Finish receipt id" }),
    (0, roles_decorator_1.Roles)("koreksi", "manager"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_finish_receipt_dto_1.UpdateFinishReceiptDto]),
    __metadata("design:returntype", void 0)
], FinishController.prototype, "updateReceipt", null);
__decorate([
    (0, common_1.Delete)("receipts/:id"),
    (0, swagger_1.ApiParam)({ name: "id", description: "Finish receipt id" }),
    (0, roles_decorator_1.Roles)("koreksi", "manager"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FinishController.prototype, "removeReceipt", null);
exports.FinishController = FinishController = __decorate([
    (0, swagger_1.ApiTags)("finish"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)("manager", "baku", "mitra", "koreksi"),
    (0, common_1.Controller)("finish"),
    __metadata("design:paramtypes", [finish_service_1.FinishService])
], FinishController);
//# sourceMappingURL=finish.controller.js.map