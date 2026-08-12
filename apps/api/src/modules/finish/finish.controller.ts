import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { FinishService } from './finish.service';
import { FinishDto } from './dto/finish.dto';
import { QueryFinishReceiptsDto } from './dto/query-finish-receipts.dto';
import { UpdateFinishReceiptDto } from './dto/update-finish-receipt.dto';

@ApiTags('finish')
@ApiBearerAuth()
@Roles('manager', 'baku', 'mitra', 'koreksi')
@Controller('finish')
export class FinishController {
  constructor(private readonly finishService: FinishService) {}

  @Get('work-item/by-lp/:lpCode')
  @ApiParam({
    name: 'lpCode',
    description: 'No LP (contoh: TEI-0466-26) atau lot number internal',
  })
  findWorkItemByLp(@Param('lpCode') lpCode: string) {
    return this.finishService.findWorkItemByLpCode(lpCode);
  }

  @Get('receipts')
  @Roles('koreksi', 'manager')
  listReceipts(@Query() query: QueryFinishReceiptsDto) {
    return this.finishService.listReceipts(query);
  }

  @Post()
  finish(@Body() dto: FinishDto) {
    return this.finishService.finish(dto);
  }

  @Patch('receipts/:id')
  @ApiParam({ name: 'id', description: 'Finish receipt id' })
  @Roles('koreksi', 'manager')
  updateReceipt(@Param('id') id: string, @Body() dto: UpdateFinishReceiptDto) {
    return this.finishService.updateReceipt(id, dto);
  }

  @Delete('receipts/:id')
  @ApiParam({ name: 'id', description: 'Finish receipt id' })
  @Roles('koreksi', 'manager')
  removeReceipt(@Param('id') id: string) {
    return this.finishService.removeReceipt(id);
  }
}
