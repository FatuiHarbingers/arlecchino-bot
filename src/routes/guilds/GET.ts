import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { ApplyOptions } from '@sapphire/decorators'
import { type GuildsGETResponse, Routes, SnowflakeValidator } from '@arlecchino/api'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	name: 'guilds/get',
	route: Routes.GUILDS
} )
export class UserRoute extends Route {
	public async [ methods.GET ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		const json = response.json.bind( response ) as ( data: GuildsGETResponse ) => void

		try {
			const guildId = SnowflakeValidator.parse( request.params.guildId )

			const guild = await this.container.client.guilds.fetch( guildId )
				.catch( () => null )
			const limit = await this.container.prisma.guild.findUnique( { where: { snowflake: guildId } } )
				.then( result => result?.limit ?? 1 )
				.catch( () => 1 )
			json( {
				exists: Boolean( guild ),
				limit
			} )
		} catch ( e ) {
			response.status( 400 )
			this.container.logger.error( e )
			json( {
				error: 'There was an error with your request, but we couldn\'t identify the issue.'
			} )
		}
	}
}
