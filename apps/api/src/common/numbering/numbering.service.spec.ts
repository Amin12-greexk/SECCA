import { Test } from '@nestjs/testing';
import { NumberingService } from './numbering.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('NumberingService', () => {
  let numberingService: NumberingService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService, NumberingService],
    }).compile();

    numberingService = moduleRef.get(NumberingService);
    prisma = moduleRef.get(PrismaService);
  });

  it('should be defined', () => {
    expect(numberingService).toBeDefined();
  });
});
