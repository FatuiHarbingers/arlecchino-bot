import { AttachmentBuilder, ChannelType, type Webhook } from 'discord.js'
import { sleep } from '@quority/core'
import { ScheduledTask, type ScheduledTaskOptions } from '@sapphire/plugin-scheduled-tasks'
import { ApplyOptions  } from '@sapphire/decorators'
import { Time } from '@sapphire/duration'
import { type Configuration, type Profile, ProfileType } from '@prisma/client'
import { ActivityFormatter } from '../framework'

type ConfigurationWithProfiles = ( Configuration & {
    profiles: Profile[];
} )

@ApplyOptions<ScheduledTaskOptions>( {
	enabled: true,
	interval: Time.Second * 20,
	name: 'activity'
} )
export class UserTask extends ScheduledTask {
	public override async run(): Promise<void> {
		if ( !this.isReady() ) return

		const wikis = ( await this.container.prisma.configuration.groupBy( {
			by: [ 'wiki' ]
		} ) ).map( i => i.wiki )
		if ( wikis.length === 0 ) {
			this.container.logger.warn( 'No wikis to check.' )
			await this.container.redis.set( 'wa:last_check', Date.now() )
			return
		}

		const storedLastCheck = parseInt( await this.container.redis.get( 'wa:last_check' ) ?? '', 10 )

		const lastCheck = isNaN( storedLastCheck )
			? new Date( Date.now() - Time.Minute * 5 )
			: new Date( storedLastCheck )
		// hopefully, the time difference between the server and the bot isn't more than 3 seconds
		const now = new Date( Date.now() - Time.Second * 3 )

		const defaultAvatar = this.container.client.user?.avatarURL( { extension: 'png' } )

		for ( const api of wikis ) {
			try {
				const formatter = new ActivityFormatter( api, lastCheck, now )
				const activity = await formatter.loadActivity()
				if ( !activity ) continue

				const configs = await this.container.prisma.configuration.findMany( {
					include: { profiles: true },
					where: { wiki: api }
				} )
				if ( configs.length === 0 ) continue

				const perLanguage = await this.sortGuildsPerLanguage( configs )
				const favicon = await formatter.getFavicon()
				const attachment = favicon
					? [ new AttachmentBuilder( favicon, { name: 'favicon.png' } ) ]
					: []

				for ( const [ lang, guilds ] of perLanguage ) {
					const embeds = await formatter.getActivityEmbeds( lang )
					if ( !embeds ) break

					for ( const config of guilds ) {
						const webhooks = await this.getWebhooks( config )
						if ( !webhooks ) continue

						let idx: 0 | 1 = 1
						for ( const { embed, type: profileType } of embeds ) {
							const profile = config.profiles.find( p => p.type === profileType )
								?? config.profiles.find( p => p.type === ProfileType.Default )
								?? config.profiles.at( 0 )

							idx = Math.abs( idx - 1 ) as 0 | 1
							const webhook = webhooks[ idx ]

							embed.setColor( profile?.color ?? 0x0088ff )
							embed.setFooter( {
								iconURL: 'attachment://favicon.png',
								text: `${ await formatter.getSitename() }${ embed.data.footer?.text ?? '' }`
							} )

							await webhook.send( {
								avatarURL: profile?.avatar ?? defaultAvatar ?? '',
								embeds: [ embed ],
								files: attachment,
								username: profile?.name ?? this.container.client.user?.username ?? 'Wiki Activity'
							} )
							await sleep( 1000 )
						}
					}
				}
			} catch ( e ) {
				this.container.logger.error( `There was an error for ${ api }.`, e )
			}
		}

		await this.container.redis.set( 'wa:last_check', now.getTime() )
	}

	protected async getWebhooks( config: { channel: string, guild: string } ): Promise<[ Webhook, Webhook ] | null> {
		try {
			const guild = await this.container.client.guilds.fetch( config.guild )
			const channel = await guild.channels.fetch( config.channel )
			if ( !channel?.isTextBased() || channel.isThread() || channel.type === ChannelType.GuildStageVoice ) return null

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
		activity: never
	}
}
