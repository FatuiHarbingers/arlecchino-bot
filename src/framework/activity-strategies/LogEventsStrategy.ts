import type { LogEventsItem, UploadEventItem } from '@quority/activity'
import { bold, EmbedBuilder, hyperlink, strikethrough, time, TimestampStyles } from '@discordjs/builders'
import type { TFunction } from '@sapphire/plugin-i18next'
import { isIPv4 } from 'net'
import { ActivityStrategy } from './ActivityStrategy'

export class LogEventsStrategy extends ActivityStrategy<LogEventsItem> {
	public createEmbed( item: LogEventsItem, t: TFunction ): EmbedBuilder {
		const embed = new EmbedBuilder()

		embed.setTimestamp( item.date )
		if ( item.data.comment.length > 0 ) {
			embed.addFields( {
				name: t( 'activity:log-reason' ),
				value: item.data.comment
			} )
		}

		const isIp = isIPv4( item.data.user )
		const userUrl = this.getUrl( isIp ? `Special:Contributions/${ item.data.user }` : `User:${ item.data.user }` )
		const author = hyperlink( item.data.user, userUrl )

		if ( item.isBlock() ) {
			let i18nKey = 'log-block-blocked'
			if ( item.isReblocking() ) i18nKey = 'log-block-reblocked'
			else if ( item.isUnblocking() ) i18nKey = 'log-block-unblocked'

			const targetUser = item.data.title.split( ':' ).slice( 1 )
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
				const duration = !expiry || isNaN( expiry as unknown as number )
					? t( 'activity:log-block-expiry-infinite' )
					: time( expiry, TimestampStyles.RelativeTime )
				embed.addFields( {
					name: t( 'activity:log-block-expiry' ),
					value: duration
				} )
			}
		} else if ( item.isDelete() ) {
			const i18nKey = item.isRestoring() ? 'undeleted' : 'deleted'
			const targetUrl = this.getUrl( item.data.title )
			const target = hyperlink( item.data.title, targetUrl )

			const description = t( `activity:log-delete-${ i18nKey }`, {
				replace: {
					author,
					target
				}
			} )
			embed.setDescription( description )
		} else if ( item.isMove() ) {
			const { params } = item.data as unknown as {
				params: {
					supressredirect?: boolean
					target_title: string
				}
			}
			const i18nKey = params.supressredirect ? 'no-redirect' : 'redirect'
			const fromUrl = this.getUrl( item.data.title )
			const from = hyperlink( item.data.title, fromUrl )
			const toUrl = this.getUrl( params.target_title )
			const to = hyperlink( params.target_title, toUrl )

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

			const targetUrl = this.getUrl( item.data.title )
			const target = hyperlink( item.data.title, targetUrl )

			const description = t( `activity:log-protect-${ i18nKey }`, {
				replace: {
					author,
					target
				}
			} )
			embed.setDescription( description )

			const { params } = item.data as unknown as { params: { description: string } }
			if ( item.isProtecting() || item.isModifying() ) {
				embed.addFields( {
					name: t( 'activity:log-protect-details' ),
					value: params.description
				} )
			}
		} else if ( item.isRights() ) {
			const targetUser = item.data.title.split( ':' ).slice( 1 )
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

			const { params } = item.data as unknown as {
				params: {
					oldgroups: string[]
					oldmetadata: Array<{
						expiry: string
						group: string
					}>
					newgroups: string[]
					newmetadata: Array<{
						expiry: string
						group: string
					}>
				}
			}
			const oldgroups = new Set( params.oldgroups )
			const newgroups = new Set( params.newgroups )

			let oldData: string
			if ( params.oldmetadata.length === 0 ) {
				oldData = t( 'activity:log-rights-none' )
			} else {
				oldData = params.oldmetadata.map( item => {
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
			if ( params.newmetadata.length === 0 ) {
				newData = t( 'activity:log-rights-none' )
			} else {
				newData = params.newmetadata.map( item => {
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
		} else {
			const upload = item as UploadEventItem
			let i18nKey = 'uploaded'
			if ( upload.isOverwriting() ) i18nKey = 'reuploaded'
			else if ( upload.isReverting() ) i18nKey = 'reverted'

			const targetUrl = this.getUrl( upload.data.title )
			const target = hyperlink( upload.data.title, targetUrl )
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
}
