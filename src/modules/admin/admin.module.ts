import { Module } from '@nestjs/common';
import { AdminModule as AdminJSModule } from '@adminjs/nestjs';
import AdminJS from 'adminjs';
import { Database, Resource } from '@adminjs/typeorm';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { TelegramUser } from '../telegram/entities/telegram-user.entity';

AdminJS.registerAdapter({ Database, Resource });

@Module({
  imports: [
    AdminJSModule.createAdminAsync({
      useFactory: async (dataSource: DataSource) => {
        const dashboardComponent = AdminJS.bundle(
          path.join(__dirname, 'components', 'overview', 'dashboard'),
        );

        const buildDateKeys = (days: number) => {
          const normalizedDays = Math.max(1, days);
          const start = new Date();
          start.setUTCHours(0, 0, 0, 0);
          start.setUTCDate(start.getUTCDate() - (normalizedDays - 1));

          return Array.from({ length: normalizedDays }, (_, index) => {
            const date = new Date(start.getTime());
            date.setUTCDate(start.getUTCDate() + index);
            return date.toISOString().slice(0, 10);
          });
        };

        return {
          adminJsOptions: {
            rootPath: '/admin',
            resources: [
              {
                resource: TelegramUser,
              },
            ],
            dashboard: {
              component: dashboardComponent,
              handler: async () => {
                const totalUsers = await dataSource
                  .getRepository(TelegramUser)
                  .count();
                const chartLabels = buildDateKeys(7);

                return {
                  totalUsers,
                  platformBreakdown: {
                    android: 0,
                    ios: 0,
                    telegram: totalUsers,
                    other: 0,
                  },
                  totalWishItems: 0,
                  shareProfileClicks: 0,
                  wishItemsByPlatform: {
                    android: 0,
                    ios: 0,
                    telegram: 0,
                    other: 0,
                  },
                  totalPartners: 0,
                  totalSurveys: 0,
                  completedSurveys: 0,
                  onboarding: {
                    total: 0,
                    byPlatform: {
                      android: 0,
                      ios: 0,
                      telegram: 0,
                      other: 0,
                    },
                  },
                  lastLogin: {
                    today: 0,
                  },
                  charts: {
                    range: {
                      days: chartLabels.length,
                      start: chartLabels[0],
                      end: chartLabels[chartLabels.length - 1],
                    },
                    userGrowth: chartLabels.map((day) => ({
                      day,
                      breakdown: {
                        android: 0,
                        ios: 0,
                        telegram: 0,
                        other: 0,
                      },
                    })),
                    wishGrowth: chartLabels.map((day) => ({
                      day,
                      breakdown: {
                        android: 0,
                        ios: 0,
                        telegram: 0,
                        other: 0,
                      },
                    })),
                    surveyCompletion: chartLabels.map((day) => ({
                      day,
                      value: 0,
                    })),
                  },
                  presentation: {
                    enabled: true,
                  },
                };
              },
            },
            branding: {
              companyName: 'PostgramX',
            },
          },
        };
      },
      inject: [DataSource],
    }),
  ],
})
export class AdminModule {}
