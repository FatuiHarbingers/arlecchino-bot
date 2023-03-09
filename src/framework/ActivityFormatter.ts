import { container } from '@sapphire/framework'
import type { EmbedBuilder } from '@discordjs/builders'
import { type ActivityItem, getActivity } from '@quority/activity'
import ico2png from 'ico-to-png'
import { request } from 'undici'
import type { TFunction } from 'i18next'
import { DiscussionsStrategy, LogEventsStrategy, RecentChangesStrategy } from './activity-strategies'
import { ProfileType } from '@prisma/client'
import { Wiki } from '@quority/core'
import { Fandom } from '@quority/fandom'

interface EmbedWrapper {
	embed: EmbedBuilder
	type: ProfileType
}

export class ActivityFormatter {
	protected activity: Awaited<ReturnType<typeof getActivity>> | null | undefined = undefined
	public readonly from: Date
	public readonly to: Date
	public readonly wiki: Wiki
	protected sitename: string | null = null
	public strategies: {
		discussions: DiscussionsStrategy
		logevents: LogEventsStrategy
		recentchanges: RecentChangesStrategy
	} | null = null

	public constructor( api: string, from: Date, to: Date ) {
		if ( api.includes( 'fandom' ) ) {
			// @ts-expect-error - different versions
			this.wiki = new Wiki( { api, platform: Fandom } )
		} else {
			this.wiki = new Wiki( { api } )
		}
		this.from = from
		this.to = to
	}

	public async getFavicon(): Promise<Buffer | null> {
		const faviconName = this.wiki.api.host.endsWith( 'fandom.com' )
			? 'Site-favicon.ico'
			: 'Favicon.ico'
		let url = this.wiki.getUrl( `Special:Redirect/file/${ faviconName }` ).href
		let redirect: string | undefined = url

		while ( redirect ) {
			url = redirect
			const { headers, statusCode } = await request( url, { method: 'HEAD' } )
			if ( statusCode > 400 ) return null

			redirect = Array.isArray( headers.location ) ? headers.location.at( 0 ) : headers.location
		}

		const { body, headers } = await request( url )
		const favicon = Buffer.from( await body.arrayBuffer() )
		if ( headers[ 'content-type' ] === 'image/x-icon' ) {
			return ico2png( favicon, 32 )
		} else {
			return favicon
		}
	}

	public async loadActivity(): Promise<ReturnType<typeof getActivity> | null> {
		if ( this.activity === null || Array.isArray( this.activity ) ) return this.activity

		this.activity = await getActivity( this.wiki, this.from, this.to )
		if ( this.activity.length === 0 ) this.activity = null
		return this.activity
	}

	protected loadStrategies(): NonNullable<typeof this[ 'strategies' ]> {
		if ( this.strategies ) return this.strategies

		this.strategies = {
			discussions: new DiscussionsStrategy( this.wiki ),
			logevents: new LogEventsStrategy( this.wiki ),
			recentchanges: new RecentChangesStrategy( this.wiki )
		}
		return this.strategies
	}

	public async getActivityEmbeds( lang: string ): Promise<EmbedWrapper[] | null> {
		const activity = await this.loadActivity()
		if ( !activity ) return null
		const t = container.i18n.getT( lang )

		const embeds: EmbedWrapper[] = []
		for ( const item of activity ) {
			const embed = await this.createEmbed( item, t )
			if ( embed ) embeds.push( embed )
		}

		return embeds
	}

	protected async createEmbed( item: ActivityItem, t: TFunction ): Promise<EmbedWrapper | null> {
		const strategies = this.loadStrategies()

		if ( item.isRecentChanges() ) {
			return {
				embed: strategies.recentchanges.createEmbed( item, t ),
				type: ProfileType.RecentChanges
			}
		} else if ( item.isLogEvents() ) {
			return {
				embed: strategies.logevents.createEmbed( item, t ),
				type: ProfileType.LogEvents
			}
		} else if ( item.isDiscussions() ) {
			return {
				embed: strategies.discussions.createEmbed( item, t ),
				type: ProfileType.Discussions
			}
		}

		return null
	}

	public async getSitename(): Promise<string> {
		if ( !this.sitename ) {
			const siteinfo = await this.wiki.getSiteInfo( 'general' )
			this.sitename = siteinfo.query.general.sitename
		}
		return this.sitename
	}
}
