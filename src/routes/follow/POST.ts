import { type ApiRequest, type ApiResponse, methods, Route, type RouteOptions } from '@sapphire/plugin-api'
import { ApplyOptions } from '@sapphire/decorators'
import { SnowflakeValidator } from '@arlecchino/api'
import { s } from '@sapphire/shapeshift'
import { UserError } from '@sapphire/framework'
import { ChannelType } from 'discord.js'
import { env } from '../../lib'

@ApplyOptions<RouteOptions>( {
	enabled: true,
	name: 'follow/post',
	route: 'follow/:guildId'
} )
export class UserRoute extends Route {
	public async [ methods.POST ]( request: ApiRequest, response: ApiResponse ): Promise<void> {
		try {
			const guildId = SnowflakeValidator.parse( request.params.guildId )
			const { channel: channelId } = s.object( {
				channel: SnowflakeValidator
			} ).parse( request.body )
			const guild = await this.container.client.guilds.fetch( guildId )
			const channel = await guild.channels.fetch( channelId )
			if ( !channel?.isTextBased() || channel.type === ChannelType.GuildAnnouncement ) {
				throw new UserError( { identifier: 'bad-channel' } )
			}

			const locale = guild.preferredLocale.split( '-' ).shift() ?? 'en'
			const devGuild = await this.container.client.guilds.fetch( env.DISCORD_DEVELOPMENT_SERVER )
			const devChannels = await devGuild.channels.fetch()
			const announcements = devChannels.find( i => i?.name === `arlecchino-${ locale }` )
				?? devChannels.find( i => i?.name === `arlecchino-${ locale }` )
			if ( !announcements || announcements.type !== ChannelType.GuildAnnouncement ) {
				throw new UserError( { identifier: 'unavailable-channel' } )
			}

			const result = await announcements.addFollower( channelId )
			response.json( result )
		} catch ( e ) {
			response.status( 400 )
			response.json( {
				error: 'There was an error with your request.'
			} )
		}
	}
}
