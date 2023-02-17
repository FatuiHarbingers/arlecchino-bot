import { Fandom, type FandomWiki } from 'mw.js'
import { container } from '@sapphire/framework'
import { type Awaitable, bold, EmbedBuilder, hyperlink, strikethrough, time, TimestampStyles } from '@discordjs/builders'
import { type ActivityItem, createActivityItem, type DiscussionsItem, getActivity, type LogEventsItem, type RecentChangesItem } from '@bitomic/wikiactivity-api'
import ico2png from 'ico-to-png'
import { request } from 'undici'
import type { TFunction } from 'i18next'
import { EmbedLimits } from '@sapphire/discord-utilities'
import { isIPv4 } from 'net'

export class ActivityFormatter {
	protected activity: Awaited<ReturnType<typeof getActivity>> | null | undefined = undefined
	public readonly baseUrl: string
	public readonly interwiki: string
	public readonly from: Date
	public readonly to: Date
	#wiki: Required<FandomWiki> | null = null

	public constructor( interwiki: string, from: Date, to: Date ) {
		this.interwiki = interwiki
		this.from = from
		this.to = to

		const match = this.interwiki.match( /^([a-z-]{2,5})\.([a-z-]+)$/ ) ?? this.interwiki.match( /^([a-z-]+)$/ )

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

	public async getActivityEmbeds( lang: string ): Promise<EmbedBuilder[] | null> {
		const activity = await this.loadActivity()
		if ( !activity ) return null
		const t = container.i18n.getT( lang )

		const embeds: EmbedBuilder[] = []
		for ( const activityItem of activity ) {
			const item = createActivityItem( activityItem )
			const embed = await this.createEmbed( item, t )
			if ( embed ) embeds.push( embed )
		}

		return embeds
	}

	protected createEmbed( item: ActivityItem, t: TFunction ): Awaitable<EmbedBuilder | null> {
		if ( item.isRecentChanges() ) {
			return this.createRecentChangesEmbed( item, t )
		} else if ( item.isDiscussions() ) {
			return this.createDiscussionsEmbed( item, t )
		} else if ( item.isLogEvents() ) {
			return this.createLogEventsEmbed( item, t )
		}

		return null
	}

	protected async createDiscussionsEmbed( item: DiscussionsItem, t: TFunction ): Promise<EmbedBuilder> {
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
					replyUrl: item.getUrl( await this.getWiki() ),
					user
				}
			} )
			embed.setDescription( description )
		} else if ( item.isMessageWall() ) {
			const wallUrl = this.getUrl( `Message Wall:${ item.wall }` )

			const i18nKey = item.isReply ? 'left-reply' : 'left-message'
			const description = t( `activity:wall-${ i18nKey }`, {
				replace: {
					replyUrl: item.getUrl( await this.getWiki() ),
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
					replyUrl: item.getUrl( await this.getWiki() ),
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

	protected createLogEventsEmbed( item: LogEventsItem, t: TFunction ): EmbedBuilder {
		const embed = new EmbedBuilder()

		embed.setTimestamp( item.date )
		if ( item.comment.length > 0 ) {
			embed.addFields( {
				name: t( 'activity:log-reason' ),
				value: item.comment
			} )
		}

		const isIp = isIPv4( item.user )
		const userUrl = this.getUrl( isIp ? `Special:Contributions/${ item.user }` : `User:${ item.user }` )
		const author = hyperlink( item.user, userUrl )

		if ( item.isBlock() ) {
			let i18nKey = 'log-block-blocked'
			if ( item.isReblocking() ) i18nKey = 'log-block-reblocked'
			else if ( item.isUnblocking() ) i18nKey = 'log-block-unblocked'

			const targetUser = item.title.split( ':' ).slice( 1 )
				.join( ':' )
			const targetUrl = this.getUrl( `Special:Contributions/${ targetUser }` )
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
			const targetUrl = this.getUrl( item.title )
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
			const fromUrl = this.getUrl( item.title )
			const from = hyperlink( item.title, fromUrl )
			const toUrl = this.getUrl( item.params.target_title )
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

			const targetUrl = this.getUrl( item.title )
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
			const targetUrl = this.getUrl( `User:${ targetUser }` )
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

			const targetUrl = this.getUrl( item.title )
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

	protected createRecentChangesEmbed( item: RecentChangesItem, t: TFunction ): EmbedBuilder {
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

	protected getUrl( target: string ): string {
		return `${ this.baseUrl }${ encodeURI( target ) }`
	}
}
