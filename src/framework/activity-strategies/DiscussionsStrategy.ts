import type { DiscussionsItem } from '@bitomic/wikiactivity-api'
import { EmbedBuilder } from '@discordjs/builders'
import { EmbedLimits } from '@sapphire/discord-utilities'
import type { TFunction } from '@sapphire/plugin-i18next'
import { hyperlink } from 'discord.js'
import { ActivityStrategy } from './ActivityStrategy'

export class DiscussionsStrategy extends ActivityStrategy<DiscussionsItem> {
	public createEmbed( item: DiscussionsItem, t: TFunction ): EmbedBuilder {
		const embed = new EmbedBuilder()

		const userTarget = item.creatorIp.length > 0 ? `Special:Contributions${ item.creatorIp }` : `User:${ item.createdBy.name }`
		const userUrl = this.getUrl( userTarget )
		const user = hyperlink( item.creatorIp.length > 0 ? item.creatorIp : item.createdBy.name, userUrl )

		if ( item.isArticleComment() ) {
			const title = item._embedded.thread[ 0 ].containerId
			const article = hyperlink( title, this.getUrl( title ) )

			const i18nKey = item.isReply ? 'left-reply' : 'left-comment'
			const description = t( `activity:article-${ i18nKey }`, {
				replace: {
					article,
					replyUrl: item.getUrl( this.wiki ),
					user
				}
			} )
			embed.setDescription( description )
		} else if ( item.isMessageWall() ) {
			const wallUrl = this.getUrl( `Message Wall:${ item.wall }` )

			const i18nKey = item.isReply ? 'left-reply' : 'left-message'
			const description = t( `activity:wall-${ i18nKey }`, {
				replace: {
					replyUrl: item.getUrl( this.wiki ),
					user,
					wallOwner: item.wall,
					wallUrl
				}
			} )
			embed.setDescription( description )
		} else if ( item.isPost() ) {
			const i18nKey = item.isReply ? 'left-reply' : 'created'
			const description = t( `activity:post-${ i18nKey }`, {
				replace: {
					category: item.category,
					replyUrl: item.getUrl( this.wiki ),
					title: item.title,
					user
				}
			} )
			embed.setDescription( description )
		}

		if ( item.rawContent.length > 0 ) {
			const content = item.rawContent.length > EmbedLimits.MaximumFieldValueLength
				? `${ item.rawContent.substring( 0, EmbedLimits.MaximumFieldValueLength - 3 ) }...`
				: item.rawContent
			embed.addFields( { name: t( 'activity:discussions-content-label' ), value: content } )
		}

		embed.setTimestamp( item.creationDate.epochSecond * 1000 )

		return embed
	}
}
