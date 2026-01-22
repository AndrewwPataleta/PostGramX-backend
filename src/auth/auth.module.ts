import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ConfigModule } from "../config/config.module";

@Module({
  imports: [ConfigModule],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard]
})
export class AuthModule {}
