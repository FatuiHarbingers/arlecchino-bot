import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { BaseError } from '@sapphire/shapeshift'
import { ApplyOptions } from '@sapphire/decorators'
import { ConfigurationsDELETEValidator, Routes, SnowflakeValidator } from '@arlecchino/api'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	name: 'configurations/delete',
	route: Routes.CONFIGURATIONS
} )
export class UserRoute extends Route {
	public async [ methods.DELETE ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		try {
			const guild = SnowflakeValidator.parse( request.params.guildId )
			const body = ConfigurationsDELETEValidator.parse( request.body )

			await this.container.prisma.configuration.delete( {
				where: {
					guild_wiki: {
						guild,
						wiki: body.wiki
					}
				}
			} )

			response.status( 204 )
			response.json( null )
		} catch ( e ) {
			response.status( 400 )
			if ( e instanceof BaseError ) {
				response.json( {
					error: 'Your request is missing required parameters in its body.'
				} )
				return
			}

			response.json( {
				error: 'There was an error with your request, but we couldn\'t identify the issue.'
			} )
		}
	}
}
