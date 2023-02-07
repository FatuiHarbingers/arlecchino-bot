import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { BaseError, s } from '@sapphire/shapeshift'
import { ApplyOptions } from '@sapphire/decorators'
import { SnowflakeRegex } from '@sapphire/discord-utilities'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	route: 'register'
} )
export class UserRoute extends Route {
	public async [ methods.POST ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		try {
			const parser = s.object( {
				guild: s.string.regex( SnowflakeRegex ),
				wiki: s.string.regex( /^([a-z-]{2,5}\.)?\w+$/ )
			} ).strict
			const body = parser.parse( request.body )

			const configurations = this.container.stores.get( 'models' ).get( 'configurations' )
			await configurations.delete( body )

			response.json( {
				message: 'Successful operation.'
			} )
		} catch ( e ) {
			response.status( 400 )
			if ( e instanceof BaseError ) {
				response.json( {
					message: 'Your request is missing required parameters in its body.'
				} )
				return
			}

			response.json( {
				message: 'There was an error with your request, but we couldn\'t identify the issue.'
			} )
		}
	}
}
