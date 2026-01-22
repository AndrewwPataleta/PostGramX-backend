import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LinkChannelDto } from "./dto/link-channel.dto";
import { VerifyChannelDto } from "./dto/verify-channel.dto";
import { ChannelsService } from "./channels.service";

@Controller("channels")
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post("link")
  async linkChannel(@Req() req: any, @Body() body: LinkChannelDto) {
    return this.channelsService.linkChannel(req.user?.id, body);
  }

  @Post(":id/verify")
  async verifyChannel(@Req() req: any, @Param("id") id: string, @Body() _body: VerifyChannelDto) {
    return this.channelsService.verifyChannel(req.user?.id, id);
  }

  @Get("my")
  async myChannels(@Req() req: any) {
    return this.channelsService.getMyChannels(req.user?.id);
  }

  @Get(":id")
  async getChannel(@Req() req: any, @Param("id") id: string) {
    return this.channelsService.getChannel(req.user?.id, id);
  }
}
