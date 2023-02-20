import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { BaseError } from '@sapphire/shapeshift'
import { ApplyOptions } from '@sapphire/decorators'
import { ProfileType as ArlecchinoProfileType, type ProfilesPOSTResponse, ProfilesPOSTValidator, Routes, SnowflakeValidator } from '@arlecchino/api'
import { ProfileType as PrismaProfileType } from '@prisma/client'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	name: 'profiles/post',
	route: Routes.PROFILES
} )
export class UserRoute extends Route {
	public async [ methods.POST ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		const json = response.json.bind( response ) as ( data: ProfilesPOSTResponse ) => void

		try {
			const guild = SnowflakeValidator.parse( request.params.guildId )
			const body = ProfilesPOSTValidator.parse( request.body )

			const { profile } = this.container.prisma
			const arlecchinoProfileTypeToPrisma = {
				[ ArlecchinoProfileType.DEFAULT ]: PrismaProfileType.Default,
				[ ArlecchinoProfileType.DISCUSSIONS ]: PrismaProfileType.Discussions,
				[ ArlecchinoProfileType.LOGEVENTS ]: PrismaProfileType.LogEvents,
				[ ArlecchinoProfileType.RECENTCHANGES ]: PrismaProfileType.RecentChanges
			}

			const create = {
				avatar: body.avatar ?? null,
				color: body.color ?? null,
				configurationGuild: guild,
				configurationWiki: body.wiki,
				name: body.name ?? null,
				type: arlecchinoProfileTypeToPrisma[ body.type ]
			}
			const update = {
				avatar: create.avatar,
				color: create.color,
				name: create.name
			}
			const where = {
				configurationGuild_configurationWiki_type: {
					configurationGuild: guild,
					configurationWiki: body.wiki,
					type: create.type
				}
			}

			await profile.upsert( { create, update, where } )

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
