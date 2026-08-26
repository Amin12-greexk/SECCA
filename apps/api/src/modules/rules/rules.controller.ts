import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { CreateGradeTariffDto } from './dto/create-grade-tariff.dto';
import { CreateMoistureRuleDto } from './dto/create-moisture-rule.dto';
import { CreatePecahBonPresetDto } from './dto/create-pecah-bon-preset.dto';
import { GradeTariffQueryDto } from './dto/grade-tariff-query.dto';
import { MoistureRuleQueryDto } from './dto/moisture-rule-query.dto';
import { RulesService } from './rules.service';

@ApiTags('rules')
@ApiBearerAuth()
@Roles('manager', 'baku', 'mitra', 'koreksi', 'admin')
@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Post('grade-tariffs')
  @Roles('manager', 'admin')
  createGradeTariff(
    @Body() dto: CreateGradeTariffDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.rulesService.createGradeTariff(dto, req.user);
  }

  @Get('grade-tariffs')
  findGradeTariffs(@Query() query: GradeTariffQueryDto) {
    return this.rulesService.findGradeTariffs(query);
  }

  @Patch('grade-tariffs/:id')
  @Roles('manager', 'admin')
  updateGradeTariff(
    @Param('id') id: string,
    @Body() dto: Partial<CreateGradeTariffDto>,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.rulesService.updateGradeTariff(id, dto, req.user);
  }

  @Delete('grade-tariffs/:id')
  @Roles('manager', 'admin')
  deleteGradeTariff(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.rulesService.deleteGradeTariff(id, req.user);
  }

  @Post('moisture')
  @Roles('manager', 'admin')
  createMoistureRule(@Body() dto: CreateMoistureRuleDto) {
    return this.rulesService.createMoistureRule(dto);
  }

  @Get('moisture')
  findMoistureRules(@Query() query: MoistureRuleQueryDto) {
    return this.rulesService.findMoistureRules(query);
  }

  @Delete('moisture/:id')
  @Roles('manager', 'admin')
  deleteMoistureRule(@Param('id') id: string) {
    return this.rulesService.deleteMoistureRule(id);
  }

  @Post('pecah-bon-presets')
  @Roles('manager', 'admin')
  createPreset(@Body() dto: CreatePecahBonPresetDto) {
    return this.rulesService.createPecahBonPreset(dto);
  }

  @Get('pecah-bon-presets')
  findPresets() {
    return this.rulesService.findPecahBonPresets();
  }

  @Delete('pecah-bon-presets/:id')
  @Roles('manager', 'admin')
  deletePreset(@Param('id') id: string) {
    return this.rulesService.deletePecahBonPreset(id);
  }

  @Post('result-grade-tariffs')
  @Roles('manager', 'admin')
  createResultGradeTariff(
    @Body()
    dto: {
      resultGradeTypeId: string;
      rateRpPerGram: number;
      effectiveFrom?: string;
    },
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.rulesService.createResultGradeTariff(dto, req.user);
  }

  @Get('result-grade-tariffs')
  findResultGradeTariffs() {
    return this.rulesService.findResultGradeTariffs();
  }

  @Patch('result-grade-tariffs/:id')
  @Roles('manager', 'admin')
  updateResultGradeTariff(
    @Param('id') id: string,
    @Body() dto: { rateRpPerGram?: number; effectiveFrom?: string },
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.rulesService.updateResultGradeTariff(id, dto, req.user);
  }

  @Delete('result-grade-tariffs/:id')
  @Roles('manager', 'admin')
  deleteResultGradeTariff(
    @Param('id') id: string,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.rulesService.deleteResultGradeTariff(id, req.user);
  }

  @Get('tariff-audits')
  findTariffAudits(@Query('tariffType') tariffType?: string) {
    return this.rulesService.findTariffAudits(tariffType);
  }

  @Get('settings/:key')
  getSetting(@Param('key') key: string) {
    return this.rulesService.getSetting(key);
  }

  @Post('settings')
  @Roles('manager', 'admin')
  setSetting(@Body() dto: { key: string; value: string }) {
    return this.rulesService.setSetting(dto.key, dto.value);
  }
}
