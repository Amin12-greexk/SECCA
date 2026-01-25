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
exports.RulesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const create_grade_tariff_dto_1 = require("./dto/create-grade-tariff.dto");
const create_moisture_rule_dto_1 = require("./dto/create-moisture-rule.dto");
const create_pecah_bon_preset_dto_1 = require("./dto/create-pecah-bon-preset.dto");
const grade_tariff_query_dto_1 = require("./dto/grade-tariff-query.dto");
const moisture_rule_query_dto_1 = require("./dto/moisture-rule-query.dto");
const rules_service_1 = require("./rules.service");
let RulesController = class RulesController {
    rulesService;
    constructor(rulesService) {
        this.rulesService = rulesService;
    }
    createGradeTariff(dto) {
        return this.rulesService.createGradeTariff(dto);
    }
    findGradeTariffs(query) {
        return this.rulesService.findGradeTariffs(query);
    }
    createMoistureRule(dto) {
        return this.rulesService.createMoistureRule(dto);
    }
    findMoistureRules(query) {
        return this.rulesService.findMoistureRules(query);
    }
    createPreset(dto) {
        return this.rulesService.createPecahBonPreset(dto);
    }
    findPresets() {
        return this.rulesService.findPecahBonPresets();
    }
};
exports.RulesController = RulesController;
__decorate([
    (0, common_1.Post)("grade-tariffs"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_grade_tariff_dto_1.CreateGradeTariffDto]),
    __metadata("design:returntype", void 0)
], RulesController.prototype, "createGradeTariff", null);
__decorate([
    (0, common_1.Get)("grade-tariffs"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [grade_tariff_query_dto_1.GradeTariffQueryDto]),
    __metadata("design:returntype", void 0)
], RulesController.prototype, "findGradeTariffs", null);
__decorate([
    (0, common_1.Post)("moisture"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_moisture_rule_dto_1.CreateMoistureRuleDto]),
    __metadata("design:returntype", void 0)
], RulesController.prototype, "createMoistureRule", null);
__decorate([
    (0, common_1.Get)("moisture"),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [moisture_rule_query_dto_1.MoistureRuleQueryDto]),
    __metadata("design:returntype", void 0)
], RulesController.prototype, "findMoistureRules", null);
__decorate([
    (0, common_1.Post)("pecah-bon-presets"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_pecah_bon_preset_dto_1.CreatePecahBonPresetDto]),
    __metadata("design:returntype", void 0)
], RulesController.prototype, "createPreset", null);
__decorate([
    (0, common_1.Get)("pecah-bon-presets"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RulesController.prototype, "findPresets", null);
exports.RulesController = RulesController = __decorate([
    (0, swagger_1.ApiTags)("rules"),
    (0, common_1.Controller)("rules"),
    __metadata("design:paramtypes", [rules_service_1.RulesService])
], RulesController);
//# sourceMappingURL=rules.controller.js.map