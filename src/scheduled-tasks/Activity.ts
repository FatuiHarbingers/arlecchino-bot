import { AttachmentBuilder, bold, EmbedBuilder, hyperlink, strikethrough, time, TimestampStyles, type Webhook } from 'discord.js'
import { type ActivityItem, createActivityItem, type DiscussionsItem, getActivity, type LogEventsItem, type RecentChangesItem } from '@bitomic/wikiactivity-api'
import { Fandom, type FandomWiki, sleep } from 'mw.js'
import { ScheduledTask, type ScheduledTaskOptions } from '@sapphire/plugin-scheduled-tasks'
import { ApplyOptions  } from '@sapphire/decorators'
import { EmbedLimits } from '@sapphire/discord-utilities'
import ico2png from 'ico-to-png'
import type { IConfiguration } from '../models/Configuration'
import { isIPv4 } from 'net'
import { request } from 'undici'
import type { TFunction } from '@sapphire/plugin-i18next'
import { Time } from '@sapphire/duration'

@ApplyOptions<ScheduledTaskOptions>( {
	enabled: true,
	name: 'activity'
} )
export class UserTask extends ScheduledTask {
	public override async run(): Promise<void> {
		if ( !this.isReady() ) return

		const configurations = this.container.stores.get( 'models' ).get( 'configurations' )
		const wikis = await configurations.getWikis()
		if ( wikis.size === 0 ) return

		const fandom = new Fandom()
		const storedLastCheck = parseInt( await this.container.redis.get( 'wa:last_check' ) ?? '', 10 )

		const lastCheck = isNaN( storedLastCheck )
			? new Date( Date.now() - Time.Minute * 5 )
			: new Date( storedLastCheck )
		// hopefully, the time difference between the server and the bot isn't more than 3 seconds
		const now = new Date( Date.now() - Time.Second * 3 )
		this.container.logger.info( [ new Date().toISOString(), lastCheck.toISOString(), now.toISOString() ] )

		await this.container.redis.set( 'wa:last_check', now.getTime() )
		const defaultAvatar = this.container.client.user?.avatarURL( { extension: 'png' } )

		for ( const interwiki of wikis ) {
			try {
				const wiki = await fandom.getWiki( interwiki ).load()
				const activity = await getActivity( wiki, lastCheck, now )
				if ( activity.length === 0 ) continue

				const configs = await configurations.getWikiGuilds( interwiki )
				if ( configs.length === 0 ) continue

				const perLanguage = await this.sortGuildsPerLanguage( configs )
				const favicon = await this.getFavicon( interwiki )
				const attachment = favicon
					? [ new AttachmentBuilder( favicon, { name: 'favicon.png' } ) ]
					: []

				for ( const [ lang, guilds ] of perLanguage ) {
					const embeds = this.getActivityEmbeds( wiki, activity, lang )

					for ( const config of guilds ) {
						const webhooks = await this.getWebhooks( config )
						if ( !webhooks ) continue

						let idx: 0 | 1 = 1
						for ( const embed of embeds ) {
							idx = Math.abs( idx - 1 ) as 0 | 1
							const webhook = webhooks[ idx ]

							embed.setColor( config.color ?? 0x0088ff )
							embed.setFooter( {
								iconURL: 'attachment://favicon.png',
								text: `${ wiki.sitename }${ embed.data.footer?.text ?? '' }`
							} )

							await webhook.send( {
								avatarURL: config.avatar ?? defaultAvatar ?? '',
								embeds: [ embed ],
								files: attachment,
								username: config.name ?? this.container.client.user?.username ?? 'Wiki Activity'
							} )
							await sleep( 1000 )
						}
					}
				}
			} catch ( e ) {
				this.container.logger.error( `There was an error for ${ interwiki }.`, e )
			}
		}

		this.container.tasks.create( 'activity', null, Time.Second * 20 )
	}

	protected createEmbed( item: ActivityItem, wiki: Required<FandomWiki>, t: TFunction ): EmbedBuilder | null {
		if ( item.isRecentChanges() ) {
			return this.createRecentChangesEmbed( item, wiki, t )
		} else if ( item.isDiscussions() ) {
			return this.createDiscussionsEmbed( item, wiki, t )
		} else if ( item.isLogEvents() ) {
			return this.createLogEventsEmbed( item, wiki, t )
		}

		return null
	}

	protected createDiscussionsEmbed( item: DiscussionsItem, wiki: Required<FandomWiki>, t: TFunction ): EmbedBuilder {
		const embed = new EmbedBuilder()

		const userTarget = item.creatorIp.length > 0 ? `Special:Contributions${ item.creatorIp }` : `User:${ item.createdBy.name }`
		const userUrl = this.getUrl( wiki.interwiki, userTarget )
		const user = hyperlink( item.creatorIp.length > 0 ? item.creatorIp : item.createdBy.name, userUrl )

		if ( item.isArticleComment() ) {
			const title = item._embedded.thread[ 0 ].containerId
			const article = hyperlink( title, this.getUrl( wiki.interwiki, title ) )

			const i18nKey = item.isReply ? 'left-reply' : 'left-comment'
			const description = t( `activity:article-${ i18nKey }`, {
				replace: {
					article,
					replyUrl: item.getUrl( wiki ),
					user
				}
			} )
			embed.setDescription( description )
		} else if ( item.isMessageWall() ) {
			const wallUrl = this.getUrl( wiki.interwiki, `Message Wall:${ item.wall }` )

			const i18nKey = item.isReply ? 'left-reply' : 'left-message'
			const description = t( `activity:wall-${ i18nKey }`, {
				replace: {
					replyUrl: item.getUrl( wiki ),
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
					replyUrl: item.getUrl( wiki ),
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

	protected createLogEventsEmbed( item: LogEventsItem, wiki: Required<FandomWiki>, t: TFunction ): EmbedBuilder {
		const embed = new EmbedBuilder()

		embed.setTimestamp( item.date )
		if ( item.comment.length > 0 ) {
			embed.addFields( {
				name: t( 'activity:log-reason' ),
				value: item.comment
			} )
		}

		const isIp = isIPv4( item.user )
		const userUrl = this.getUrl( wiki.interwiki, isIp ? `Special:Contributions/${ item.user }` : `User:${ item.user }` )
		const author = hyperlink( item.user, userUrl )

		if ( item.isBlock() ) {
			let i18nKey = 'log-block-blocked'
			if ( item.isReblocking() ) i18nKey = 'log-block-reblocked'
			else if ( item.isUnblocking() ) i18nKey = 'log-block-unblocked'

			const targetUser = item.title.split( ':' ).slice( 1 )
				.join( ':' )
			const targetUrl = this.getUrl( wiki.interwiki, `Special:Contributions/${ targetUser }` )
			const target = hyperlink( targetUser, targetUrl )

			const description = t( `activity:${ i18nKey }`, {
				replace: {
					author,
					target
				}
			} )
			embed.setDescription( description )

			if ( item.isBlocking() || item.isReblocking() ) {
				const expiry = item.expiryDate
				const duration = expiry
					? time( expiry, TimestampStyles.RelativeTime )
					: t( 'activity:log-block-expiry-infinite' )
				embed.addFields( {
					name: t( 'activity:log-block-expiry' ),
					value: duration
				} )
			}
		} else if ( item.isDelete() ) {
			const i18nKey = item.isRestoring() ? 'undeleted' : 'deleted'
			const targetUrl = this.getUrl( wiki.interwiki, item.title )
			const target = hyperlink( item.title, targetUrl )

			const description = t( `activity:log-delete-${ i18nKey }`, {
				replace: {
					author,
					target
				}
			} )
			embed.setDescription( description )
		} else if ( item.isMove() ) {
			const i18nKey = item.params.supressredirect ? 'no-redirect' : 'redirect'
			const fromUrl = this.getUrl( wiki.interwiki, item.title )
			const from = hyperlink( item.title, fromUrl )
			const toUrl = this.getUrl( wiki.interwiki, item.params.target_title )
			const to = hyperlink( item.params.target_title, toUrl )

			const description = t( `activity:log-move-${ i18nKey }`, {
				replace: {
					author,
					from,
					to
				}
			} )
			embed.setDescription( description )
		} else if ( item.isProtect() ) {
			let i18nKey = 'protected'
			if ( item.isModifying() ) i18nKey = 'reprotected'
			else if ( item.isUnprotecting() ) i18nKey = 'unprotected'

			const targetUrl = this.getUrl( wiki.interwiki, item.title )
			const target = hyperlink( item.title, targetUrl )

			const description = t( `activity:log-protect-${ i18nKey }`, {
				replace: {
					author,
					target
				}
			} )
			embed.setDescription( description )

			if ( item.isProtecting() || item.isModifying() ) {
				embed.addFields( {
					name: t( 'activity:log-protect-details' ),
					value: item.params.description
				} )
			}
		} else if ( item.isRights() ) {
			const targetUser = item.title.split( ':' ).slice( 1 )
				.join( ':' )
			const targetUrl = this.getUrl( wiki.interwiki, `User:${ targetUser }` )
			const target = hyperlink( targetUser, targetUrl )

			const description = t( 'activity:log-rights', {
				replace: {
					author,
					target
				}
			} )
			embed.setDescription( description )

			const oldgroups = new Set( item.params.oldgroups )
			const newgroups = new Set( item.params.newgroups )

			let oldData: string
			if ( item.params.oldmetadata.length === 0 ) {
				oldData = t( 'activity:log-rights-none' )
			} else {
				oldData = item.params.oldmetadata.map( item => {
					let detail = newgroups.has( item.group ) ? item.group : strikethrough( item.group )
					if ( item.expiry !== 'infinity' ) {
						const expiry = new Date( item.expiry )
						detail += ` ${  t( 'activity:log-rights-until', {
							replace: {
								time: time( expiry, TimestampStyles.RelativeTime )
							}
						} ) }`
					}
					return detail
				} ).join( '\n' )
			}

			let newData: string
			if ( item.params.newmetadata.length === 0 ) {
				newData = t( 'activity:log-rights-none' )
			} else {
				newData = item.params.newmetadata.map( item => {
					let detail = oldgroups.has( item.group ) ? item.group : bold( item.group )
					if ( item.expiry !== 'infinity' ) {
						const expiry = new Date( item.expiry )
						detail += ` ${  t( 'activity:log-rights-until', {
							replace: {
								time: time( expiry, TimestampStyles.RelativeTime )
							}
						} ) }`
					}
					return detail
				} ).join( '\n' )
			}

			embed.addFields(
				{
					inline: true,
					name: t( 'activity:log-rights-old-groups' ),
					value: oldData
				},
				{
					inline: true,
					name: t( 'activity:log-rights-new-groups' ),
					value: newData
				}
			)
		} else if ( item.isUpload() ) {
			let i18nKey = 'uploaded'
			if ( item.isOverwriting() ) i18nKey = 'reuploaded'
			else if ( item.isReverting() ) i18nKey = 'reverted'

			const targetUrl = this.getUrl( wiki.interwiki, item.title )
			const target = hyperlink( item.title, targetUrl )
			const description = t( `activity:log-upload-${ i18nKey }`, {
				replace: {
					author,
					target
				}
			} )
			embed.setDescription( description )
		}

		return embed
	}

	protected async getFavicon( wiki: string ): Promise<Buffer | null> {
		let url = `${ Fandom.interwiki2url( wiki ) }Special:Redirect/file/Site-favicon.ico`
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

	protected createRecentChangesEmbed( item: RecentChangesItem, wiki: Required<FandomWiki>, t: TFunction ): EmbedBuilder {
		const embed = new EmbedBuilder()

		const userUrl = this.getUrl( wiki.interwiki, item.anon ? `Special:Contributions/${ item.user }` : `User:${ item.user }` )
		const user = hyperlink( item.user, userUrl )

		const pageUrl = this.getUrl( wiki.interwiki, item.title )
		const page = hyperlink( item.title, pageUrl )

		const sizediff = item.sizediff < 0 ? `- ${ Math.abs( item.sizediff ) }` : `+ ${ item.sizediff }`
		const diffUrl = `${ this.parseInterwiki( wiki.interwiki ) }?diff=${ item.revid }`
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

	protected async getWebhooks( config: { channel: string, guild: string } ): Promise<[ Webhook, Webhook ] | null> {
		try {
			const guild = await this.container.client.guilds.fetch( config.guild )
			const channel = await guild.channels.fetch( config.channel )
			if ( !channel?.isTextBased() || channel.isThread() ) return null

			const channelWebhooks = await channel.fetchWebhooks()
			const ownedWebhooks = channelWebhooks.filter( w => w.owner?.id === this.container.client.user?.id )

			const first = ownedWebhooks.at( 0 )
			const last = ownedWebhooks.at( 1 )
			if ( first && last ) {
				return [ first, last ]
			} else if ( first ) {
				const w = await channel.createWebhook( { name: 'Wiki Activity' } )
				return [ first, w ]
			} else {
				const w1 = await channel.createWebhook( { name: 'Wiki Activity' } )
				const w2 = await channel.createWebhook( { name: 'Wiki Activity' } )
				return [ w1, w2 ]
			}
		} catch ( e ) {
			this.container.logger.error( `There was an error while trying to fetch the webhooks from guild ${ config.guild } (channel ${ config.channel }).`, e )
		}

		return null
	}

	protected isReady(): boolean {
		if ( !this.container.client.isReady() ) {
			this.container.logger.warn( 'Client isn\'t ready yet; skipping task.' )
			this.container.tasks.create( 'activity', null, Time.Second * 20 )
			return false
		}

		return true
	}

	protected getUrl( interwiki: string, target: string ): string {
		return `${ this.parseInterwiki( interwiki ) }${ encodeURI( target ) }`
	}

	protected parseInterwiki( interwiki: string ): string {
		const match = interwiki.match( /^([a-z-]{2,5})\.([a-z-]+)$/ ) ?? interwiki.match( /^([a-z-]+)$/ )
		if ( !match ) return 'https://community.fandom.com/wiki/'
		const [ , first, second ] = match
		if ( !first ) return 'https://community.fandom.com/wiki/'
		return second
			? `https://${ second }.fandom.com/${ first }/wiki/`
			: `https://${ first }.fandom.com/wiki/`
	}

	protected async sortGuildsPerLanguage( configs: IConfiguration[] ): Promise<Map<string, IConfiguration[]>> {
		const perLanguage = new Map<string, IConfiguration[]>()

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

	protected getActivityEmbeds( wiki: Required<FandomWiki>, activity: Awaited<ReturnType<typeof getActivity>>, lang: string ): EmbedBuilder[] {
		const t = this.container.i18n.getT( lang )

		const embeds: EmbedBuilder[] = []
		for ( const activityItem of activity ) {
			const item = createActivityItem( activityItem )
			const embed = this.createEmbed( item, wiki, t )

			if ( embed ) embeds.push( embed )
		}

		return embeds
	}
}

declare module '@sapphire/plugin-scheduled-tasks' {
	interface ScheduledTasks {
		activity: never
	}
}
