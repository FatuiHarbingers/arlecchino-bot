import { container, SapphireClient } from '@sapphire/framework'
import { env } from './environment'
import type { Logger } from 'pino'
import { pino } from './pino'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { ScheduledTaskRedisStrategy } from '@sapphire/plugin-scheduled-tasks/register-redis'

export class UserClient extends SapphireClient {
	public constructor() {
		const redisOptions = {
			db: env.REDIS_DB,
			host: env.REDIS_HOST,
			password: env.REDIS_PASSWORD,
			port: env.REDIS_PORT,
			username: env.REDIS_USERNAME
		}
		super( {
			defaultPrefix: env.DISCORD_PREFIX ?? '!',
			i18n: {
				fetchLanguage: context => {
					const { languages } = container.i18n
					const lang = context.interactionGuildLocale ?? context.guild?.preferredLocale ?? 'en-US'
					return languages.has( lang ) ? lang : 'en-US'
				}
			},
			intents: [
				'Guilds'
			],
			loadDefaultErrorListeners: true,
			tasks: {
				strategy: new ScheduledTaskRedisStrategy( {
					bull: {
						connection: redisOptions,
						defaultJobOptions: {
							removeOnComplete: true,
							removeOnFail: true
						}
					}
				} )
			}
		} )
		container.pino = pino
		container.prisma = new PrismaClient()
		container.redis = new Redis( redisOptions )
	}

	public async start(): Promise<void> {
		await this.login( env.DISCORD_TOKEN )
	}
}

declare module '@sapphire/pieces' {
	interface Container {
		pino: Logger
		prisma: PrismaClient
		redis: Redis
	}
}
