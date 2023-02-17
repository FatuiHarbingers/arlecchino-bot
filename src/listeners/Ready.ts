import { Listener, type ListenerOptions } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { ActivityType, Events } from 'discord.js'

@ApplyOptions<ListenerOptions>( {
	event: Events.ClientReady,
	once: true
} )
export class UserEvent extends Listener {
	public async run(): Promise<void> {
		this.container.pino.info( 'Client is ready and running.' )

		await this.container.tasks.delete( 'activity' )
		this.container.tasks.create( 'activity', null, 0 )

		const wikiCount = await this.container.prisma.configurations.count()
		this.container.client.user?.setPresence( {
			activities: [ {
				name: `${ wikiCount } wikis`,
				type: ActivityType.Watching
			} ]
		} )
	}
}
