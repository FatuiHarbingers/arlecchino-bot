import type { ActivityItem } from '@bitomic/wikiactivity-api'
import type { EmbedBuilder } from '@discordjs/builders'
import type { TFunction } from '@sapphire/plugin-i18next'
import type { FandomWiki } from 'mw.js'

export abstract class ActivityStrategy<T extends ActivityItem> {
	public readonly baseUrl: string
	public readonly wiki: Required<FandomWiki>

	public constructor ( wiki: Required<FandomWiki> ) {
		this.wiki = wiki

		const match = this.wiki.interwiki.match( /^([a-z-]{2,5})\.([a-z-]+)$/ ) ?? this.wiki.interwiki.match( /^([a-z-]+)$/ )

		if ( match ) {
			const [ , first, second ] = match
			if ( !first ) {
				this.baseUrl = 'https://community.fandom.com/wiki/'
			} else {
				this.baseUrl = second
					? `https://${ second }.fandom.com/${ first }/wiki/`
					: `https://${ first }.fandom.com/wiki/`
			}
		} else {
			this.baseUrl = 'https://community.fandom.com/wiki/'
		}
	}

	public abstract createEmbed( item: T, t: TFunction ): EmbedBuilder

	protected getUrl( target: string ): string {
		return `${ this.baseUrl }${ encodeURI( target ) }`
	}
}
