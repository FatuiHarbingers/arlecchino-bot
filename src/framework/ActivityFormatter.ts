import { Fandom, type FandomWiki } from 'mw.js'
import { container } from '@sapphire/framework'
import type { EmbedBuilder } from '@discordjs/builders'
import { type ActivityItem, createActivityItem, getActivity } from '@bitomic/wikiactivity-api'
import ico2png from 'ico-to-png'
import { request } from 'undici'
import type { TFunction } from 'i18next'
import { DiscussionsStrategy, LogEventsStrategy, RecentChangesStrategy } from './activity-strategies'
import { ProfileType } from '@prisma/client'

interface EmbedWrapper {
	embed: EmbedBuilder
	type: ProfileType
}

export class ActivityFormatter {
	protected activity: Awaited<ReturnType<typeof getActivity>> | null | undefined = undefined
	public readonly interwiki: string
	public readonly from: Date
	public readonly to: Date
	#wiki: Required<FandomWiki> | null = null
	public strategies: {
		discussions: DiscussionsStrategy
		logevents: LogEventsStrategy
		recentchanges: RecentChangesStrategy
	} | null = null

	public constructor( interwiki: string, from: Date, to: Date ) {
		this.interwiki = interwiki
		this.from = from
		this.to = to
	}

	public get wiki(): Required<FandomWiki> | null {
		return this.#wiki
	}

	public async getWiki(): Promise<Required<FandomWiki>> {
		if ( this.wiki ) return this.wiki
		this.#wiki = await Fandom.getWiki( this.interwiki ).load()
		return this.#wiki
	}

	public async getFavicon(): Promise<Buffer | null> {
		let url = `${ Fandom.interwiki2url( this.interwiki ) }Special:Redirect/file/Site-favicon.ico`
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

		this.activity = await getActivity( await this.getWiki(), this.from, this.to )
		if ( this.activity.length === 0 ) this.activity = null
		return this.activity
	}

	protected async loadStrategies(): Promise<NonNullable<typeof this[ 'strategies' ]>> {
		if ( this.strategies ) return this.strategies

		const wiki = await this.getWiki()
		this.strategies = {
			discussions: new DiscussionsStrategy( wiki ),
			logevents: new LogEventsStrategy( wiki ),
			recentchanges: new RecentChangesStrategy( wiki )
		}
		return this.strategies
	}

	public async getActivityEmbeds( lang: string ): Promise<EmbedWrapper[] | null> {
		const activity = await this.loadActivity()
		if ( !activity ) return null
		const t = container.i18n.getT( lang )

		const embeds: EmbedWrapper[] = []
		for ( const activityItem of activity ) {
			const item = createActivityItem( activityItem )
			const embed = await this.createEmbed( item, t )
			if ( embed ) embeds.push( embed )
		}

		return embeds
	}

	protected async createEmbed( item: ActivityItem, t: TFunction ): Promise<EmbedWrapper | null> {
		const strategies = await this.loadStrategies()

		if ( item.isRecentChanges() ) {
			return {
				embed: strategies.recentchanges.createEmbed( item, t ),
				type: ProfileType.RecentChanges
			}
		} else if ( item.isDiscussions() ) {
			return {
				embed: strategies.discussions.createEmbed( item, t ),
				type: ProfileType.Discussions
			}
		} else if ( item.isLogEvents() ) {
			return {
				embed: strategies.logevents.createEmbed( item, t ),
				type: ProfileType.LogEvents
			}
		}

		return null
	}
}
