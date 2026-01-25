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
const receive_raw_batch_dto_1 = require("./dto/receive-raw-batch.dto");
const baku_service_1 = require("./baku.service");
let BakuController = class BakuController {
    bakuService;
    constructor(bakuService) {
        this.bakuService = bakuService;
    }
    receive(dto) {
        return this.bakuService.receive(dto);
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
exports.BakuController = BakuController = __decorate([
    (0, swagger_1.ApiTags)("baku"),
    (0, common_1.Controller)("baku"),
    __metadata("design:paramtypes", [baku_service_1.BakuService])
], BakuController);
//# sourceMappingURL=baku.controller.js.map