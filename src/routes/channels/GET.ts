import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { ApplyOptions } from '@sapphire/decorators'
import { Routes, SnowflakeValidator } from '@arlecchino/api'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	route: Routes.CHANNELS
} )
export class UserRoute extends Route {
	public async [ methods.GET ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		try {
			const guildId = SnowflakeValidator.parse( request.params.guildId )

			const guild = await this.container.client.guilds.fetch( guildId )
				.catch( () => null )
			response.json( {
				channels: await guild?.channels.fetch()
			} )
		} catch ( e ) {
			response.status( 400 )
			response.json( {
				error: 'There was an error with your request, but we couldn\'t identify the issue.',
				exists: false
			} )
		}
	}
}
