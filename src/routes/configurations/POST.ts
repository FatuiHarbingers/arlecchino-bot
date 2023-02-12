import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { BaseError } from '@sapphire/shapeshift'
import { ApplyOptions } from '@sapphire/decorators'
import { Fandom } from 'mw.js'
import { type ConfigurationPOSTResponse, ConfigurationPOSTValidator, Routes, SnowflakeValidator } from '@arlecchino/api'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	name: 'configurations/post',
	route: Routes.CONFIGURATIONS
} )
export class UserRoute extends Route {
	public async [ methods.POST ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		try {
			const guild = SnowflakeValidator.parse( request.params.guildId )
			const { update, ...body } = ConfigurationPOSTValidator.parse( request.body )

			Fandom.interwiki2api( body.wiki ) // just to throw an error if the interwiki is wrong
			const configurations = this.container.stores.get( 'models' ).get( 'configurations' )

			if ( update ) {
				await configurations.update( { ...body, guild } )
			} else {
				await configurations.addWiki( { ...body, guild } )
			}

			response.json( body as ConfigurationPOSTResponse )
		} catch ( e ) {
			this.container.logger.error( e )
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
