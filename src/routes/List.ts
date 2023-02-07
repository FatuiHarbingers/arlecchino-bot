import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { ApplyOptions } from '@sapphire/decorators'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	route: 'list/:guild'
} )
export class UserRoute extends Route {
	public async [ methods.GET ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		try {
			const { guild } = request.params
			if ( !guild ) {
				response.status( 400 )
				response.json( {
					message: 'You didn\'t specify a guild.'
				} )
				return
			}

			const configurations = this.container.stores.get( 'models' ).get( 'configurations' )
			const wikis = await configurations.getGuildConfigurations( guild )
			response.json( wikis )
		} catch ( e ) {
			response.status( 400 )
			response.json( {
				message: 'There was an error with your request, but we couldn\'t identify the issue.'
			} )
		}
	}
}
