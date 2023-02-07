import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { ApplyOptions } from '@sapphire/decorators'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	route: 'guild/:guildId'
} )
export class UserRoute extends Route {
	public async [ methods.GET ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		try {
			const { guildId } = request.params
			if ( !guildId ) {
				response.status( 400 )
				response.json( {
					message: 'You didn\'t specify a guild.'
				} )
				return
			}

			const guild = await this.container.client.guilds.fetch( guildId )
				.catch( () => null )
			response.json( {
				exists: Boolean( guild )
			} )
		} catch ( e ) {
			response.status( 400 )
			response.json( {
				exists: false,
				message: 'There was an error with your request, but we couldn\'t identify the issue.'
			} )
		}
	}
}
