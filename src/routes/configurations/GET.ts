import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { ApplyOptions } from '@sapphire/decorators'
import { type ConfigurationsGETResponse, Routes, SnowflakeValidator } from '@arlecchino/api'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	name: 'configurations/get',
	route: Routes.CONFIGURATIONS
} )
export class UserRoute extends Route {
	public async [ methods.GET ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		const json = response.json.bind( response ) as ( data: ConfigurationsGETResponse ) => void

		try {
			const guild = SnowflakeValidator.parse( request.params.guildId )

			const configurations = await this.container.prisma.configuration.findMany( {
				where: { guild }
			} )
			json( configurations )
		} catch ( e ) {
			response.status( 400 )
			json( {
				error: 'There was an error with your request, but we couldn\'t identify the issue.'
			} )
		}
	}
}
