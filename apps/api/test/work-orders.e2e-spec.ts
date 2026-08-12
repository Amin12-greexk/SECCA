import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import {
  PrismaClient,
  GradeType,
  LotStatus,
  WorkLane,
  RackType,
  WorkOrderStatus,
} from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { LOCATION_CODES } from '../src/common/constants';

describe('Work orders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let token: string;
  let workerId: string;
  let gradeId: string;
  let preSaleLocationId: string;
  const lotIds: string[] = [];
  const lotNumbers: string[] = [];
  const createdWorkOrders: string[] = [];
  const createdWorkItems: string[] = [];

  const createLot = async (suffix: string) => {
    const lotNumber = `LP-${suffix}`;
    const lot = await prisma.productionLot.create({
      data: {
        lotNumber,
        gradeId,
        wetWeightGram: 100,
        dryWeightGramLocked: 90,
        moistureBps: 1200,
        status: LotStatus.AVAILABLE,
        locationId: preSaleLocationId,
      },
    });
    lotIds.push(lot.id);
    lotNumbers.push(lotNumber);
    return lotNumber;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix('api');
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = new PrismaClient();

    const jwtService = moduleFixture.get(JwtService);
    token = jwtService.sign({ sub: 'e2e', role: 'manager' });

    const testId = `e2e-${Date.now()}`;

    const worker = await prisma.worker.create({
      data: {
        name: `Worker ${testId}`,
        code: `W-${testId}`,
      },
    });
    workerId = worker.id;

    const grade = await prisma.grade.create({
      data: {
        name: `Grade ${testId}`,
        code: `GR-${testId}`,
        type: GradeType.BENTUK,
      },
    });
    gradeId = grade.id;

    const preSale = await prisma.rackLocation.upsert({
      where: { code: LOCATION_CODES.PRE_SALE },
      update: { name: 'Rak Sementara', type: RackType.PRE_SALE },
      create: {
        code: LOCATION_CODES.PRE_SALE,
        name: 'Rak Sementara',
        type: RackType.PRE_SALE,
      },
    });
    preSaleLocationId = preSale.id;

    await prisma.gradeTariff.create({
      data: {
        shapeGradeId: gradeId,
        featherGradeId: null,
        colorGradeId: null,
        rateRpPerGram: 10,
        effectiveFrom: new Date('2020-01-01'),
        effectiveTo: null,
      },
    });
  });

  afterAll(async () => {
    await prisma.finishReceipt.deleteMany({
      where: { workOrderItemId: { in: createdWorkItems } },
    });
    await prisma.payrollEntry.deleteMany({
      where: { workOrderItemId: { in: createdWorkItems } },
    });
    await prisma.workOrderItem.deleteMany({
      where: { id: { in: createdWorkItems } },
    });
    await prisma.workerActiveWorkOrder.deleteMany({
      where: { workOrderId: { in: createdWorkOrders } },
    });
    await prisma.workOrder.deleteMany({
      where: { id: { in: createdWorkOrders } },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { lotId: { in: lotIds } },
    });
    await prisma.productionLot.deleteMany({
      where: { id: { in: lotIds } },
    });
    await prisma.gradeTariff.deleteMany({
      where: { shapeGradeId: gradeId },
    });
    await prisma.grade.deleteMany({ where: { id: gradeId } });
    await prisma.rackLocation.deleteMany({ where: { workerId } });
    await prisma.worker.deleteMany({ where: { id: workerId } });
    await prisma.$disconnect();
    await app.close();
  });

  it('gating: second order for same worker is rejected', async () => {
    const lot1 = await createLot('A1');

    const createRes = await request(app.getHttpServer())
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ workerId, lotNumbers: [lot1] })
      .expect(201);

    const workOrderId = createRes.body.data.workOrderId as string;
    const itemId = createRes.body.data.items[0].workOrderItemId as string;
    createdWorkOrders.push(workOrderId);
    createdWorkItems.push(itemId);

    const lot2 = await createLot('A2');
    await request(app.getHttpServer())
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ workerId, lotNumbers: [lot2] })
      .expect(409);
  });

  it('release gating after finish, then allow new order', async () => {
    const workItemId = createdWorkItems[0];
    await request(app.getHttpServer())
      .post('/api/finish')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workOrderItemId: workItemId,
        returnedAt: new Date().toISOString(),
        mainOutWeightGram: 80,
        byProductWeightGram: 0,
      })
      .expect(201);

    const lot3 = await createLot('B1');
    const createRes = await request(app.getHttpServer())
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ workerId, lotNumbers: [lot3] })
      .expect(201);

    const workOrderId = createRes.body.data.workOrderId as string;
    const itemId = createRes.body.data.items[0].workOrderItemId as string;
    createdWorkOrders.push(workOrderId);
    createdWorkItems.push(itemId);
  });

  it('cancel NEXT_DAY item returns lot and closes order', async () => {
    const itemId = createdWorkItems[1];
    const cancelRes = await request(app.getHttpServer())
      .post(`/api/work-items/${itemId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(cancelRes.body.data.status).toBe('CANCELED');

    const item = await prisma.workOrderItem.findUnique({
      where: { id: itemId },
      include: { lot: true, workOrder: true },
    });
    expect(item?.lot.status).toBe(LotStatus.AVAILABLE);
    expect(item?.lot.locationId).toBe(preSaleLocationId);
    expect(item?.workOrder.status).toBe(WorkOrderStatus.COMPLETED);

    const active = await prisma.workerActiveWorkOrder.findUnique({
      where: { workerId },
    });
    expect(active).toBeNull();
  });

  it('lane transitions NEXT_DAY -> IN_PROGRESS -> READY_TO_SUBMIT', async () => {
    const lot4 = await createLot('C1');
    const createRes = await request(app.getHttpServer())
      .post('/api/work-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ workerId, lotNumbers: [lot4], lane: WorkLane.NEXT_DAY })
      .expect(201);

    const workOrderId = createRes.body.data.workOrderId as string;
    const itemId = createRes.body.data.items[0].workOrderItemId as string;
    createdWorkOrders.push(workOrderId);
    createdWorkItems.push(itemId);

    const startRes = await request(app.getHttpServer())
      .post(`/api/work-items/${itemId}/start`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(startRes.body.data.lane).toBe('IN_PROGRESS');

    const readyRes = await request(app.getHttpServer())
      .post(`/api/work-items/${itemId}/mark-ready`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(readyRes.body.data.lane).toBe('READY_TO_SUBMIT');

    await request(app.getHttpServer())
      .post('/api/finish')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workOrderItemId: itemId,
        returnedAt: new Date().toISOString(),
        mainOutWeightGram: 80,
        byProductWeightGram: 0,
      })
      .expect(201);
  });
});
