import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { ApplyOptions } from '@sapphire/decorators'
import { type ChannelsGETResponse, Routes, SnowflakeValidator } from '@arlecchino/api'
import type { APIChannel } from 'discord.js'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	route: Routes.CHANNELS
} )
export class UserRoute extends Route {
	public async [ methods.GET ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		const json = response.json.bind( response ) as ( data: ChannelsGETResponse ) => void

		try {
			const guildId = SnowflakeValidator.parse( request.params.guildId )

			const guild = await this.container.client.guilds.fetch( guildId )
				.catch( () => null )
			const channels = await guild?.channels.fetch()
			if ( channels ) {
				json( {
					channels: [ ...channels.values() ].map( i => i?.toJSON() as APIChannel )
				} )
			} else {
				json( { channels: [] } )
			}
		} catch ( e ) {
			response.status( 400 )
			json( {
				error: 'There was an error with your request, but we couldn\'t identify the issue.'
			} )
		}
	}
}
