import { ScheduledTask, type ScheduledTaskOptions } from '@sapphire/plugin-scheduled-tasks'
import { ApplyOptions  } from '@sapphire/decorators'
import { Time } from '@sapphire/duration'
import { type Configuration, type Profile, ProfileType } from '@prisma/client'
import { EmbedBuilder, time, TimestampStyles } from '@discordjs/builders'
import { BaseStrategy, Wiki } from '@quority/core'
import { type DiscussionsAPI, Fandom } from '@quority/fandom'
import { ChannelType } from 'discord.js'

type ConfigurationWithProfiles = ( Configuration & {
    profiles: Profile[];
} )

@ApplyOptions<ScheduledTaskOptions>( {
	enabled: true,
	interval: Time.Day,
	name: 'summary'
} )
export class UserTask extends ScheduledTask {
	public override async run(): Promise<void> {
		if ( !this.isReady() ) return
		this.container.logger.info( 'Posting daily summary.' )

		const wikis = ( await this.container.prisma.configuration.groupBy( {
			by: [ 'wiki' ]
		} ) ).map( i => i.wiki )
		if ( wikis.length === 0 ) {
			this.container.logger.warn( 'No wikis to check.' )
			return
		}

		const to = new Date()
		const from = new Date( to.getTime() - Time.Day )

		const defaultAvatar = this.container.client.user?.avatarURL( { extension: 'png' } ) ?? ''
		const defaultUsername = this.container.client.user?.username ?? ''

		for ( const api of wikis ) {
			const summary = await this.getSummary( api, from, to )
			if ( !summary ) continue

			try {
				const configs = await this.container.prisma.configuration.findMany( {
					include: { profiles: true },
					where: { wiki: api }
				} )
				if ( configs.length === 0 ) continue

				const perLanguage = await this.sortGuildsPerLanguage( configs )

				for ( const [ lang, guilds ] of perLanguage ) {
					const t = this.container.i18n.getT( lang )
					const embed = new EmbedBuilder()
						.setTitle( t( 'summary:title' ) )
						.setDescription( t( 'summary:description' ) )
						.addFields(
							{ inline: true, name: t( 'summary:from' ), value: time( from, TimestampStyles.LongDate ) },
							{ inline: true, name: t( 'summary:to' ), value: time( to, TimestampStyles.LongDate ) }
						)

					if ( summary.recentchanges.edits ) {
						embed.addFields( {
							name: t( 'summary:recentchanges' ),
							value: t( 'summary:summary-rc', {
								replace: {
									bots: summary.recentchanges.bots.length,
									editors: Object.entries ( summary.recentchanges.editsPerUser )
										.sort( ( a, b ) => b[ 1 ] - a[ 1 ] )
										.slice( 0, 5 )
										.map( ( [ user, edits ] ) => `• **${ user }:** ${ edits }` )
										.join( '\n' ),
									edits: summary.recentchanges.edits,
									newpages: summary.recentchanges.newPages.length,
									users: summary.recentchanges.users.length
								}
							} )
						} )
					}

					if ( summary.logevents.users.length ) {
						embed.addFields( {
							name: t( 'summary:logevents' ),
							value: t( 'summary:summary-le', {
								replace: {
									bots: summary.logevents.bots.length,
									logs: Object.values( summary.logevents.logs ).reduce( ( total, count ) => total + count, 0 ),
									stats: Object.entries( summary.logevents.logs )
										.map( ( [ event, count ] ) => {
											const label = t( `summary:event-${ event }` )
											return `• **${ label }:** ${ count }`
										} )
										.join( '\n' ),
									users: summary.logevents.users.length
								}
							} )
						} )
					}

					if ( summary.discussions?.users.length ) {
						embed.addFields( {
							name: t( 'summary:discussions' ),
							value: t( 'summary:summary-discussions', {
								replace: {
									posts: Object.values( summary.discussions.postsCount ).reduce( ( total, count ) => total + count, 0 ),
									stats: Object.entries( summary.discussions.postsCount )
										.map( ( [ container, count ] ) => {
											const key = `summary:container-${ container.toLowerCase() }`
											const label = t( key )
											return `• **${ label }:** ${ count }`
										} )
										.join( '\n' ),
									top: Object.entries( summary.discussions.postsByUser )
										.sort( ( a, b ) => b[ 1 ] - a[ 1 ] )
										.slice( 0, 5 )
										.map( ( [ user, count ] ) => `• **${ user }:** ${ count }` )
										.join( '\n' ),
									users: summary.discussions.users.length
								}
							} )
						} )
					}

					for ( const config of guilds ) {
						const profile = config.profiles.find( p => p.type === ProfileType.Default )
							?? config.profiles.at( 0 )

						try {
							const channel = await this.container.client.channels.fetch( config.channel )
							if ( !channel || channel.type !== ChannelType.GuildText ) continue

							const webhooks = await channel.fetchWebhooks()
							const webhook = webhooks.find( w => w.owner?.id === this.container.client.user?.id )
								?? webhooks.first()
								?? await channel.createWebhook( {
									avatar: defaultAvatar,
									name: defaultUsername
								} )
							await webhook.send( {
								avatarURL: profile?.avatar ?? defaultAvatar,
								embeds: [ embed.setColor( profile?.color ?? 0x0088ff ) ],
								username: profile?.name ?? defaultUsername,
							} )
						} catch ( e ) {
							this.container.logger.error( `There was an error for ${ api } in ${ config.guild }.`, e )
						}
					}
				}
			} catch ( e ) {
				this.container.logger.error( `There was an error for ${ api }.`, e )
			}
		}
	}

	protected async findBots( wiki: Wiki, users: string[] ): Promise<string[]> {
		const bots: string[] = []
		for ( let i = 0; i < users.length; i += 50 ) {
			const result = ( await wiki.queryList( {
				list: 'users',
				usprop: [ 'rights' ],
				ususers: users.slice( i, 50 )
			} ) ).filter( i => i.rights.includes( 'bot' ) )
			bots.push( ...result.map( i => i.name ) )
		}
		return bots
	}

	protected async getSummary( api: string, from: Date, to: Date ) {
		const wiki = new Wiki( {
			api,
			platform: api.includes( 'fandom.com' ) ? Fandom : BaseStrategy
		} )
		const recentchanges = await this.getRecentChangesSummary( wiki, from, to )
		const logevents = await this.getLogEventsSummary( wiki, from, to )
		const discussions = await this.getDiscussionsSummary( wiki, from, to )

		if ( !recentchanges.edits && !logevents.users.length && !discussions?.users.length ) return null

		return {
			discussions,
			logevents,
			recentchanges
		}
	}

	protected async getDiscussionsSummary( w: Wiki, from: Date, to: Date ) {
		if ( !( w.platform instanceof Fandom ) ) return null
		const wiki = w as Wiki<Fandom>
		const posts: DiscussionsAPI.DiscussionPost[] = []
		const options = {
			limit: 100,
			page: 0
		}
		let lastPage = -1
		do {
			const result = await wiki.custom.wikia.DiscussionPostController.getPosts( options )
			if ( lastPage === -1 ) {
				const extended = result as typeof result & {
					_links?: {
						last?: Array<{
							href?: string
						}>
					}
				}
				const href = extended._links?.last?.at( 0 )?.href
				if ( href ) {
					const url = new URL( href )
					lastPage = parseInt( url.searchParams.get( 'page' ) ?? '0', 10 )
				} else {
					lastPage = 0
				}
			}
			const items = result._embedded[ 'doc:posts' ].filter( i => {
				const creation = i.creationDate.epochSecond * 1000
				return creation >= from.getTime() && creation <= to.getTime()
			} )
			posts.push( ...items )

			if ( items.length < result._embedded[ 'doc:posts' ].length ) break
		} while ( options.page++ <= lastPage )

		const users = [ ...new Set( posts.map( i => i.creatorIp || i.createdBy.name ) ) ]
		const postsByUser = users.reduce( ( list, user ) => {
			list[ user ] = posts.filter( i => i.creatorIp === user || i.createdBy.name === user ).length
			return list
		}, {} as Record<string, number> )
		const postsCount = posts.reduce( ( list, post ) => {
			const container = post._embedded.thread?.[ 0 ].containerType
			if ( container ) {
				list[ container ] ??= 0
				++list[ container ]
			}
			return list
		}, {} as Record<DiscussionsAPI.ContainerTypes, number> )
		return {
			postsByUser,
			postsCount,
			users
		}
	}

	protected async getLogEventsSummary( wiki: Wiki, from: Date, to: Date ) {
		const events = new Set( [
			'block', 'delete', 'move', 'protect', 'rights', 'upload'
		] as const )
		type SetType<C extends Set<unknown>> = C extends Set<infer T> ? T : unknown
		type Event = SetType<typeof events>

		const logevents = ( await wiki.queryList( {
			ledir: 'newer',
			leend: to.toISOString(),
			lelimit: 'max',
			leprop: [ 'title', 'type', 'user' ],
			lestart: from.toISOString(),
			list: 'logevents'
		} ) ).filter( i => events.has( i.type as Event ) )
		const users = [ ...new Set( logevents.map( i => i.user ) ) ]
		const bots = await this.findBots( wiki, users )
		const logsPerUser = users.reduce( ( list, user ) => {
			list[ user ] = logevents.filter( i => i.user === user ).length
			return list
		}, {} as Record<string, number> )
		const logs = [ ...events ].reduce( ( list, event ) => {
			list[ event ] = logevents.filter( i => i.type === event ).length
			return list
		}, {} as Record<Event, number> )

		return {
			bots,
			logs,
			logsPerUser,
			users
		}
	}

	protected async getRecentChangesSummary( wiki: Wiki, from: Date, to: Date ) {
		const recentchanges = await wiki.queryList( {
			list: 'recentchanges',
			rcdir: 'newer',
			rcend: to.toISOString(),
			rclimit: 'max',
			rcprop: [ 'title', 'user' ],
			rcstart: from.toISOString(),
			rctype: [ 'categorize', 'edit', 'new' ]
		} )
		const users = [ ...new Set( recentchanges.map( i => i.user ) ) ]
		const bots = await this.findBots( wiki, users )
		const edits = recentchanges.length
		const pages = new Set( recentchanges.map( i => i.title ) ).size
		const editsPerUser = users.reduce( ( list, user ) => {
			list[ user ] = recentchanges.filter( i => i.user === user ).length
			return list
		}, {} as Record<string, number> )
		const newPages = recentchanges.filter( i => i.type === 'new' )

		return {
			bots,
			edits,
			editsPerUser,
			newPages,
			pages,
			users
		}
	}

	protected isReady(): boolean {
		if ( !this.container.client.isReady() ) {
			this.container.logger.warn( 'Client isn\'t ready yet; skipping task.' )
			return false
		}

		return true
	}

	protected async sortGuildsPerLanguage( configs: ConfigurationWithProfiles[] ): Promise<Map<string, ConfigurationWithProfiles[]>> {
		const perLanguage = new Map<string, ConfigurationWithProfiles[]>()

		for ( const config of configs ) {
			try {
				const guild = await this.container.client.guilds.fetch( config.guild )
				const lang = await this.container.i18n.fetchLanguage( { channel: null, guild, user: null } )
				if ( !lang ) {
					this.container.logger.warn( `Couldn't fetch a language for guild ${ config.guild }.` )
					continue
				}

				const list = perLanguage.get( lang ) ?? []
				list.push( config )
				if ( !perLanguage.has( lang ) ) perLanguage.set( lang, list )
			} catch ( e ) {
				this.container.logger.error( `There was an error while trying to fetch guild ${ config.guild }.`, e )
			}
		}

		return perLanguage
	}
}

declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		summary: never
	}
}
