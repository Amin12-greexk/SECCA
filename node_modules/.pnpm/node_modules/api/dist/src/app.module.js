"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const common_module_1 = require("./common/common.module");
const prisma_module_1 = require("./prisma/prisma.module");
const baku_module_1 = require("./modules/baku/baku.module");
const finish_module_1 = require("./modules/finish/finish.module");
const grades_module_1 = require("./modules/grades/grades.module");
const grading_module_1 = require("./modules/grading/grading.module");
const locations_module_1 = require("./modules/locations/locations.module");
const lots_module_1 = require("./modules/lots/lots.module");
const payroll_module_1 = require("./modules/payroll/payroll.module");
const rules_module_1 = require("./modules/rules/rules.module");
const suppliers_module_1 = require("./modules/suppliers/suppliers.module");
const traceability_module_1 = require("./modules/traceability/traceability.module");
const work_orders_module_1 = require("./modules/work-orders/work-orders.module");
const workers_module_1 = require("./modules/workers/workers.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            common_module_1.CommonModule,
            suppliers_module_1.SuppliersModule,
            grades_module_1.GradesModule,
            workers_module_1.WorkersModule,
            locations_module_1.LocationsModule,
            rules_module_1.RulesModule,
            baku_module_1.BakuModule,
            grading_module_1.GradingModule,
            lots_module_1.LotsModule,
            work_orders_module_1.WorkOrdersModule,
            finish_module_1.FinishModule,
            traceability_module_1.TraceabilityModule,
            payroll_module_1.PayrollModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map