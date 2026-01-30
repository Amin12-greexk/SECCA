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
exports.LotsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../auth/roles.decorator");
const auto_split_dto_1 = require("./dto/auto-split.dto");
const create_lot_dto_1 = require("./dto/create-lot.dto");
const lots_service_1 = require("./lots.service");
let LotsController = class LotsController {
    lotsService;
    constructor(lotsService) {
        this.lotsService = lotsService;
    }
    create(dto) {
        return this.lotsService.createLot(dto);
    }
    autoSplit(dto) {
        return this.lotsService.autoSplit(dto);
    }
};
exports.LotsController = LotsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_lot_dto_1.CreateLotDto]),
    __metadata("design:returntype", void 0)
], LotsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)("auto-split"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auto_split_dto_1.AutoSplitDto]),
    __metadata("design:returntype", void 0)
], LotsController.prototype, "autoSplit", null);
exports.LotsController = LotsController = __decorate([
    (0, swagger_1.ApiTags)("lots"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)("manager", "baku", "mitra", "koreksi"),
    (0, common_1.Controller)("lots"),
    __metadata("design:paramtypes", [lots_service_1.LotsService])
], LotsController);
//# sourceMappingURL=lots.controller.js.map