import type { RecentChangesItem } from '@bitomic/wikiactivity-api'
import { EmbedBuilder, hyperlink } from '@discordjs/builders'
import type { TFunction } from '@sapphire/plugin-i18next'
import { ActivityStrategy } from './ActivityStrategy'

export class RecentChangesStrategy extends ActivityStrategy<RecentChangesItem> {
	public createEmbed( item: RecentChangesItem, t: TFunction ): EmbedBuilder {
		const embed = new EmbedBuilder()

		const userUrl = this.getUrl( item.anon ? `Special:Contributions/${ item.user }` : `User:${ item.user }` )
		const user = hyperlink( item.user, userUrl )

		const pageUrl = this.getUrl( item.title )
		const page = hyperlink( item.title, pageUrl )

		const sizediff = item.sizediff < 0 ? `- ${ Math.abs( item.sizediff ) }` : `+ ${ item.sizediff }`
		const diffUrl = `${ this.baseUrl }?diff=${ item.revid }`
		const diff = hyperlink( sizediff, diffUrl )

		const i18nKey = item.type === 'edit' ? 'edited' : 'created'
		const description = t( `activity:rc-${ i18nKey }`, {
			replace: {
				diff,
				page,
				user
			}
		} )
		embed.setDescription( description )

		if ( item.comment ) {
			embed.addFields( {
				name: t( 'activity:rc-summary' ),
				value: item.comment
			} )
		}

		embed.setFooter( {
			text: ` • ${ item.revid }`
		} )
		embed.setTimestamp( item.date )
		return embed
	}
}
