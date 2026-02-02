import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { CreateGradeTariffDto } from "./dto/create-grade-tariff.dto";
import { CreateMoistureRuleDto } from "./dto/create-moisture-rule.dto";
import { CreatePecahBonPresetDto } from "./dto/create-pecah-bon-preset.dto";
import { GradeTariffQueryDto } from "./dto/grade-tariff-query.dto";
import { MoistureRuleQueryDto } from "./dto/moisture-rule-query.dto";
import { RulesService } from "./rules.service";

@ApiTags("rules")
@ApiBearerAuth()
@Roles("manager", "baku", "mitra", "koreksi")
@Controller("rules")
export class RulesController {
  constructor(private readonly rulesService: RulesService) { }

  @Post("grade-tariffs")
  createGradeTariff(@Body() dto: CreateGradeTariffDto) {
    return this.rulesService.createGradeTariff(dto);
  }

  @Get("grade-tariffs")
  findGradeTariffs(@Query() query: GradeTariffQueryDto) {
    return this.rulesService.findGradeTariffs(query);
  }

  @Delete("grade-tariffs/:id")
  deleteGradeTariff(@Param("id") id: string) {
    return this.rulesService.deleteGradeTariff(id);
  }

  @Post("moisture")
  createMoistureRule(@Body() dto: CreateMoistureRuleDto) {
    return this.rulesService.createMoistureRule(dto);
  }

  @Get("moisture")
  findMoistureRules(@Query() query: MoistureRuleQueryDto) {
    return this.rulesService.findMoistureRules(query);
  }

  @Delete("moisture/:id")
  deleteMoistureRule(@Param("id") id: string) {
    return this.rulesService.deleteMoistureRule(id);
  }

  @Post("pecah-bon-presets")
  createPreset(@Body() dto: CreatePecahBonPresetDto) {
    return this.rulesService.createPecahBonPreset(dto);
  }

  @Get("pecah-bon-presets")
  findPresets() {
    return this.rulesService.findPecahBonPresets();
  }

  @Delete("pecah-bon-presets/:id")
  deletePreset(@Param("id") id: string) {
    return this.rulesService.deletePecahBonPreset(id);
  }
}

