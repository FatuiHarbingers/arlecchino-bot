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
		try {
			const guild = SnowflakeValidator.parse( request.params.guildId )

			const configurations = await this.container.prisma.configurations.findMany( {
				where: { guild }
			} )
			response.json( configurations as ConfigurationsGETResponse )
		} catch ( e ) {
			response.status( 400 )
			response.json( {
				error: 'There was an error with your request, but we couldn\'t identify the issue.'
			} )
		}
	}
}
