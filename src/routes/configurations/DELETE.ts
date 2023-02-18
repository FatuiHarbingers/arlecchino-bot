import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { BaseError } from '@sapphire/shapeshift'
import { ApplyOptions } from '@sapphire/decorators'
import { type ConfigurationsDELETEResponse, ConfigurationsDELETEValidator, Routes, SnowflakeValidator } from '@arlecchino/api'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	name: 'configurations/delete',
	route: Routes.CONFIGURATIONS
} )
export class UserRoute extends Route {
	public async [ methods.DELETE ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		const json = response.json.bind( response ) as ( data: ConfigurationsDELETEResponse ) => void

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
			json( null )
		} catch ( e ) {
			response.status( 400 )
			if ( e instanceof BaseError ) {
				json( {
					error: 'Your request is missing required parameters in its body.'
				} )
				return
			}

			json( {
				error: 'There was an error with your request, but we couldn\'t identify the issue.'
			} )
		}
	}
}
