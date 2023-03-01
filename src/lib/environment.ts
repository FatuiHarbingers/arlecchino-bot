import { load } from 'ts-dotenv'

export const env = load( {
	API_PORT: Number,
	DISCORD_DEVELOPMENT_SERVER: String,
	DISCORD_OWNER: String,
	DISCORD_PREFIX: {
		optional: true,
		type: String
	},
	DISCORD_TOKEN: String,
	NODE_ENV: [
		'development' as const,
		'production' as const
	],
	REDIS_URL: String
} )
