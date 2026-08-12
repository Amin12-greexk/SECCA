import { PartialType } from '@nestjs/swagger';
import { CreateProductionRoomDto } from './create-production-room.dto';

export class UpdateProductionRoomDto extends PartialType(
  CreateProductionRoomDto,
) {}
