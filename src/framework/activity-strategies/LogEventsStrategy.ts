import type { LogEventsItem } from '@bitomic/wikiactivity-api'
import { bold, EmbedBuilder, hyperlink, strikethrough, time, TimestampStyles } from '@discordjs/builders'
import type { TFunction } from '@sapphire/plugin-i18next'
import { isIPv4 } from 'net'
import { ActivityStrategy } from './ActivityStrategy'

export class LogEventsStrategy extends ActivityStrategy<LogEventsItem> {
	public createEmbed( item: LogEventsItem, t: TFunction ): EmbedBuilder {
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
}
