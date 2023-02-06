import { load } from 'ts-dotenv'

export const env = load( {
	API_PORT: Number,
	DISCORD_DEVELOPMENT_SERVER: {
		optional: true,
		type: String
	},
	DISCORD_OWNER: String,
	DISCORD_PREFIX: {
		optional: true,
		type: String
	},
	DISCORD_TOKEN: String,
	MYSQL_DATABASE: String,
	MYSQL_HOST: String,
	MYSQL_PASSWORD: String,
	MYSQL_PORT: {
		default: 5432,
		type: Number
	},
	MYSQL_USERNAME: String,
	NODE_ENV: [
		'development' as const,
		'production' as const
	],
	REDIS_DB: Number,
	REDIS_HOST: String,
	REDIS_PASSWORD: String,
	REDIS_PORT: Number,
	REDIS_USERNAME: String
} )
