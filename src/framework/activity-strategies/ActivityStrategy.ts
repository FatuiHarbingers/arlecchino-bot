import type { ActivityItem } from '@quority/activity'
import type { EmbedBuilder } from '@discordjs/builders'
import type { TFunction } from '@sapphire/plugin-i18next'
import type { Wiki } from '@quority/core'

export abstract class ActivityStrategy<T extends ActivityItem> {
	public readonly wiki: Wiki

	public constructor ( wiki: Wiki ) {
		this.wiki = wiki
	}

	public abstract createEmbed( item: T, t: TFunction ): EmbedBuilder

	protected getUrl( target: string ): string {
		return this.wiki.getUrl( target ).href
	}
}
