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
		const json = response.json.bind( response ) as ( data: ConfigurationPOSTResponse ) => void

		try {
			const guild = SnowflakeValidator.parse( request.params.guildId )
			const { update, ...body } = ConfigurationPOSTValidator.parse( request.body )

			Fandom.interwiki2api( body.wiki ) // just to throw an error if the interwiki is wrong
			const { configuration } = this.container.prisma

			if ( update ) {
				await configuration.update( {
					data: { ...body, guild },
					where: {
						guild_wiki: {
							guild,
							wiki: body.wiki
						}
					}
				} )
			} else {
				const limit = ( await this.container.prisma.guild.findUnique( {
					where: { snowflake: guild }
				} ) )?.limit ?? 1
				const currentCount = await this.container.prisma.configuration.count( {
					where: { guild }
				} )
				if ( currentCount >= limit ) {
					throw new Error( 'Guild is already on the maximum number of wikis it can follow.' )
				}

				const alreadyExists = await this.container.prisma.configuration.findFirst( {
					where: { guild, wiki: body.wiki }
				} )
				if ( alreadyExists ) {
					throw new Error( 'Wiki is already being followed.' )
				}

				await this.container.prisma.configuration.create( { data: { ...body, guild } } )
			}

			json( body )
		} catch ( e ) {
			this.container.logger.error( e )
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
