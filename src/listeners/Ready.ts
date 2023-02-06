import { Listener, type ListenerOptions } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events } from 'discord.js'

@ApplyOptions<ListenerOptions>( {
	event: Events.ClientReady,
	once: true
} )
export class UserEvent extends Listener {
	public async run(): Promise<void> {
		this.container.pino.info( 'Client is ready and running.' )

		const scheduledTasks = await this.container.tasks.list( {} ) as Array<{ name: string } | undefined>
		if ( !scheduledTasks.some( s => s?.name === 'activity' ) ) {
			this.container.tasks.create( 'activity', null, 0 )
		}
	}
}
