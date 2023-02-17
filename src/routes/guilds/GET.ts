import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { ApplyOptions } from '@sapphire/decorators'
import { type GuildGETResponse, Routes, SnowflakeValidator } from '@arlecchino/api'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	name: 'guilds/get',
	route: Routes.GUILD
} )
export class UserRoute extends Route {
	public async [ methods.GET ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		try {
			const guildId = SnowflakeValidator.parse( request.params.guildId )

			const guild = await this.container.client.guilds.fetch( guildId )
				.catch( () => null )
			const limit = await this.container.prisma.guild.findUnique( { where: { snowflake: guildId } } )
				.then( result => result?.limit ?? 0 )
			response.json( {
				exists: Boolean( guild ),
				limit
			} as GuildGETResponse )
		} catch ( e ) {
			response.status( 400 )
			response.json( {
				error: 'There was an error with your request, but we couldn\'t identify the issue.'
			} )
		}
	}
}
