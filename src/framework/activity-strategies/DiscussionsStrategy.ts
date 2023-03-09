import { EmbedBuilder } from '@discordjs/builders'
import { DiscussionsAPI } from '@quority/fandom'
import { EmbedLimits } from '@sapphire/discord-utilities'
import type { TFunction } from '@sapphire/plugin-i18next'
import { hyperlink } from 'discord.js'
import { ActivityStrategy } from './ActivityStrategy'
import type { DiscussionsItem } from '@quority/activity'

export class DiscussionsStrategy extends ActivityStrategy<DiscussionsItem> {
	public createEmbed( item: DiscussionsItem, t: TFunction ): EmbedBuilder {
		const embed = new EmbedBuilder()

		const userTarget = item.data.creatorIp.length > 0 ? `Special:Contributions${ item.data.creatorIp }` : `User:${ item.data.createdBy.name }`
		const userUrl = this.getUrl( userTarget )
		const user = hyperlink( item.data.creatorIp.length > 0 ? item.data.creatorIp : item.data.createdBy.name, userUrl )

		const containerType = item.data._embedded.thread?.[ 0 ].containerType
		if ( containerType === DiscussionsAPI.ContainerTypes.ArticleComment ) {
			const title = item.data._embedded.thread?.[ 0 ].containerId ?? 'unknown'
			const article = hyperlink( title, this.getUrl( title ) )

			const i18nKey = item.data.isReply ? 'left-reply' : 'left-comment'
			const description = t( `activity:article-${ i18nKey }`, {
				replace: {
					article,
					replyUrl: item.getUrl(),
					user
				}
			} )
			embed.setDescription( description )
		} else if ( item.isMessageWall() ) {
			const wallUrl = this.getUrl( `Message Wall:${ item.wall }` )

			const i18nKey = item.data.isReply ? 'left-reply' : 'left-message'
			const description = t( `activity:wall-${ i18nKey }`, {
				replace: {
					replyUrl: item.getUrl(),
					user,
					wallOwner: item.wall,
					wallUrl
				}
			} )
			embed.setDescription( description )
		} else if ( item.isPost() ) {
			const i18nKey = item.data.isReply ? 'left-reply' : 'created'
			const description = t( `activity:post-${ i18nKey }`, {
				replace: {
					category: item.category,
					replyUrl: item.getUrl(),
					title: item.data.title,
					user
				}
			} )
			embed.setDescription( description )
		}

		if ( item.data.rawContent.length > 0 ) {
			const content = item.data.rawContent.length > EmbedLimits.MaximumFieldValueLength
				? `${ item.data.rawContent.substring( 0, EmbedLimits.MaximumFieldValueLength - 3 ) }...`
				: item.data.rawContent
			embed.addFields( { name: t( 'activity:discussions-content-label' ), value: content } )
		}

		embed.setTimestamp( item.data.creationDate.epochSecond * 1000 )

		return embed
	}
}
