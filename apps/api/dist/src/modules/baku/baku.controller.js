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
exports.BakuController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../auth/roles.decorator");
const receive_raw_batch_dto_1 = require("./dto/receive-raw-batch.dto");
const create_pecah_bon_dto_1 = require("./dto/create-pecah-bon.dto");
const update_pecah_bon_dto_1 = require("./dto/update-pecah-bon.dto");
const baku_service_1 = require("./baku.service");
let BakuController = class BakuController {
    bakuService;
    constructor(bakuService) {
        this.bakuService = bakuService;
    }
    receive(dto) {
        return this.bakuService.receive(dto);
    }
    findAll() {
        return this.bakuService.findAll();
    }
    findPecahBonById(pecahBonId) {
        return this.bakuService.findPecahBonById(pecahBonId);
    }
    findByCardId(cardId) {
        return this.bakuService.findByCardId(cardId);
    }
    createPecahBon(id, dto) {
        return this.bakuService.createPecahBon(id, dto);
    }
    updatePecahBonEntry(id, dto) {
        return this.bakuService.updatePecahBonEntry(id, dto);
    }
    markPecahBonPrinted(id) {
        return this.bakuService.markPecahBonPrinted(id);
    }
    getPecahBonEntries(id) {
        return this.bakuService.getPecahBonEntries(id);
    }
};
exports.BakuController = BakuController;
__decorate([
    (0, common_1.Post)("receive"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [receive_raw_batch_dto_1.ReceiveRawBatchDto]),
    __metadata("design:returntype", void 0)
], BakuController.prototype, "receive", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BakuController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)("pecah-bon/:pecahBonId"),
    (0, swagger_1.ApiParam)({ name: "pecahBonId" }),
    __param(0, (0, common_1.Param)("pecahBonId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BakuController.prototype, "findPecahBonById", null);
__decorate([
    (0, common_1.Get)(":cardId"),
    (0, swagger_1.ApiParam)({ name: "cardId" }),
    __param(0, (0, common_1.Param)("cardId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BakuController.prototype, "findByCardId", null);
__decorate([
    (0, common_1.Post)(":id/pecah-bon"),
    (0, swagger_1.ApiParam)({ name: "id" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_pecah_bon_dto_1.CreatePecahBonDto]),
    __metadata("design:returntype", void 0)
], BakuController.prototype, "createPecahBon", null);
__decorate([
    (0, common_1.Patch)("pecah-bon-entry/:id"),
    (0, swagger_1.ApiParam)({ name: "id" }),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_pecah_bon_dto_1.UpdatePecahBonDto]),
    __metadata("design:returntype", void 0)
], BakuController.prototype, "updatePecahBonEntry", null);
__decorate([
    (0, common_1.Post)("pecah-bon-entry/:id/printed"),
    (0, swagger_1.ApiParam)({ name: "id" }),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BakuController.prototype, "markPecahBonPrinted", null);
__decorate([
    (0, common_1.Get)(":id/pecah-bon"),
    (0, swagger_1.ApiParam)({ name: "id" }),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BakuController.prototype, "getPecahBonEntries", null);
exports.BakuController = BakuController = __decorate([
    (0, swagger_1.ApiTags)("Baku"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)("manager", "baku", "mitra", "koreksi"),
    (0, common_1.Controller)("baku"),
    __metadata("design:paramtypes", [baku_service_1.BakuService])
], BakuController);
//# sourceMappingURL=baku.controller.js.map