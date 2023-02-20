import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { BaseError } from '@sapphire/shapeshift'
import { ApplyOptions } from '@sapphire/decorators'
import { ProfileType as ArlecchinoProfileType, type ProfilesGETResponse, ProfilesGETValidator, Routes, SnowflakeValidator } from '@arlecchino/api'
import { ProfileType as PrismaProfileType } from '@prisma/client'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	name: 'profiles/get',
	route: Routes.PROFILES
} )
export class UserRoute extends Route {
	public async [ methods.GET ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		const json = response.json.bind( response ) as ( data: ProfilesGETResponse ) => void

		try {
			const guild = SnowflakeValidator.parse( request.params.guildId )
			const body = ProfilesGETValidator.parse( request.query )

			const { profile } = this.container.prisma

			const where = body.wiki
				? { configurationGuild: guild, configurationWiki: body.wiki }
				: { configurationGuild: guild }
			const query = await profile.findMany( {
				include: {
					Configuration: true
				},
				where
			} )

			const result: ProfilesGETResponse = []
			const prismaProfileTypeToArlecchino = {
				[ PrismaProfileType.Default ]: ArlecchinoProfileType.DEFAULT,
				[ PrismaProfileType.Discussions ]: ArlecchinoProfileType.DISCUSSIONS,
				[ PrismaProfileType.LogEvents ]: ArlecchinoProfileType.LOGEVENTS,
				[ PrismaProfileType.RecentChanges ]: ArlecchinoProfileType.RECENTCHANGES
			}
			for ( const { avatar, color, name, type, configurationWiki: wiki } of query ) {
				const item: Exclude<ProfilesGETResponse, { error: string }>[ number ] = {
					type: prismaProfileTypeToArlecchino[ type ?? PrismaProfileType.Default ],
					wiki
				}
				if ( avatar ) item.avatar = avatar
				if ( color ) item.color = color
				if ( name ) item.name = name
				result.push( item )
			}

			json( result )
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
