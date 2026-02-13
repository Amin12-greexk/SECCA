import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { CommonModule } from "./common/common.module";
import { PrismaModule } from "./prisma/prisma.module";
import { BakuModule } from "./modules/baku/baku.module";
import { FinishModule } from "./modules/finish/finish.module";
import { GradesModule } from "./modules/grades/grades.module";
import { GradingModule } from "./modules/grading/grading.module";
import { LocationsModule } from "./modules/locations/locations.module";
import { LotsModule } from "./modules/lots/lots.module";
import { PayrollModule } from "./modules/payroll/payroll.module";
import { RulesModule } from "./modules/rules/rules.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { TraceabilityModule } from "./modules/traceability/traceability.module";
import { WorkOrdersModule } from "./modules/work-orders/work-orders.module";
import { WorkItemsModule } from "./modules/work-items/work-items.module";
import { WorkersModule } from "./modules/workers/workers.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    CommonModule,
    SuppliersModule,
    GradesModule,
    WorkersModule,
    LocationsModule,
    RulesModule,
    BakuModule,
    GradingModule,
    LotsModule,
    WorkOrdersModule,
    WorkItemsModule,
    FinishModule,
    TraceabilityModule,
    PayrollModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
