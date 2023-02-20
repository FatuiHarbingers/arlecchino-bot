import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { BaseError } from '@sapphire/shapeshift'
import { ApplyOptions } from '@sapphire/decorators'
import { ProfileType as ArlecchinoProfileType, type ProfilesDELETEResponse, ProfilesDELETEValidator, Routes, SnowflakeValidator } from '@arlecchino/api'
import { ProfileType as PrismaProfileType } from '@prisma/client'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	name: 'profiles/delete',
	route: Routes.PROFILES
} )
export class UserRoute extends Route {
	public async [ methods.DELETE ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		const json = response.json.bind( response ) as ( data: ProfilesDELETEResponse ) => void

		try {
			const guild = SnowflakeValidator.parse( request.params.guildId )
			const body = ProfilesDELETEValidator.parse( request.body )

			const { profile } = this.container.prisma
			const arlecchinoProfileTypeToPrisma = {
				[ ArlecchinoProfileType.DEFAULT ]: PrismaProfileType.Default,
				[ ArlecchinoProfileType.DISCUSSIONS ]: PrismaProfileType.Discussions,
				[ ArlecchinoProfileType.LOGEVENTS ]: PrismaProfileType.LogEvents,
				[ ArlecchinoProfileType.RECENTCHANGES ]: PrismaProfileType.RecentChanges
			}

			await profile.deleteMany( {
				where: {
					configurationGuild: guild,
					configurationWiki: body.wiki,
					type: arlecchinoProfileTypeToPrisma[ body.type ]
				}
			} )

			response.status( 204 )
			json( null )
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
